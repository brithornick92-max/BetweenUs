/**
 * SyncEngine.js — Bidirectional sync between SQLite ↔ Supabase
 *
 * Design:
 *   • Push: scan SQLite rows where sync_status='pending', encrypt
 *     sensitive fields with couple key, upsert into Supabase.
 *   • Pull: query Supabase rows WHERE updated_at > last_pulled_at,
 *     decrypt, upsert into SQLite.
 *   • Conflict resolution: last-write-wins by `updated_at`.
 *   • Attachments: upload encrypted blobs to Supabase Storage.
 *   • Runs on demand + periodic (AppState 'active', NetInfo 'connected').
 *
 * Tables synced:
 *   journal_entries  →  couple_data (type='journal')
 *   prompt_answers   →  couple_data (type='prompt_answer')
 *   memories         →  couple_data (type='memory')
 *   rituals          →  couple_data (type='ritual')
 *   check_ins        →  couple_data (type='check_in')
 *   vibes            →  couple_data (type='vibe')
 *   attachments      →  couple_data (type='attachment_meta') + Storage bucket
 *
 * Only ciphertext goes to Supabase. Metadata (timestamps, type, mood labels)
 * goes unencrypted so Supabase RLS + sorting works.
 */

import Database from '../db/Database';
import E2EEncryption from '../e2ee/E2EEncryption';
import EncryptedAttachments from '../e2ee/EncryptedAttachments';
import { supabase, TABLES } from '../../config/supabase';

// ─── Config ─────────────────────────────────────────────────────────

const SYNC_TABLES = [
  'journal_entries',
  'prompt_answers',
  'memories',
  'rituals',
  'check_ins',
  'vibes',
  'love_notes',
    'prompt_ratings',
  ];

/** Maps SQLite table → Supabase couple_data.data_type */
const TABLE_TO_TYPE = {
  journal_entries: 'journal',
  prompt_answers: 'prompt_answer',
  memories: 'memory',
  rituals: 'ritual',
  check_ins: 'check_in',
  vibes: 'vibe',
  love_notes: 'love_note',
    prompt_ratings: 'prompt_rating',
  };

/** Columns that contain ciphertext (don't re-encrypt; pass through). */
const CIPHER_COLUMNS = new Set([
  'title_cipher', 'body_cipher', 'answer_cipher', 'partner_answer_cipher',
  'note_cipher', 'file_name_cipher',
  'mood_cipher', 'tags_cipher', 'heat_level_cipher',
  'text_cipher', 'sender_name_cipher',
]);

/** Columns that should NOT be sent to Supabase. */
const LOCAL_ONLY_COLUMNS = new Set([
  'sync_status', 'sync_version', 'sync_source', 'local_uri',
  // Sensitive metadata — only cipher versions go to remote
  'mood', 'tags', 'heat_level',
]);

// ─── State ──────────────────────────────────────────────────────────

let _syncing = false;
let _coupleId = null;
let _userId = null;
let _isPremium = false;
let _listeners = [];

// ─── Helpers ────────────────────────────────────────────────────────

function emit(event, data) {
  _listeners.forEach(fn => {
    try { fn(event, data); } catch { /* ignore listener errors */ }
  });
}

function canSync() {
  return !!supabase && !!_coupleId && !!_userId && _isPremium;
}

/**
 * Build the Supabase couple_data row from a local SQLite row.
 * Cipher columns are already encrypted locally — pass them through.
 * Non-cipher data stays as unencrypted metadata.
 */
function toRemoteRow(tableName, row) {
  const dataType = TABLE_TO_TYPE[tableName];
  const metadata = {};
  const encryptedPayload = {};

  for (const [k, v] of Object.entries(row)) {
    if (LOCAL_ONLY_COLUMNS.has(k)) continue;
    if (CIPHER_COLUMNS.has(k)) {
      encryptedPayload[k] = v;
    } else {
      metadata[k] = v;
    }
  }

  return {
    couple_id: _coupleId,
    key: `${dataType}_${row.id}`,
    data_type: dataType,
    created_by: row.user_id || _userId,
    is_private: !!row.is_private,
    // Metadata columns (unencrypted for sorting/filtering on server)
    value: JSON.stringify(metadata),
    // Encrypted payload (already ciphertext from local E2EE)
    encrypted_value: Object.keys(encryptedPayload).length
      ? JSON.stringify(encryptedPayload)
      : null,
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

/**
 * Reconstruct a local SQLite row from a Supabase couple_data row.
 * Rows from remote always get sync_source='remote' to prevent
 * pull→push re-entrancy loops.
 */
function fromRemoteRow(tableName, remoteRow) {
  let metadata = {};
  let cipherFields = {};

  try {
    metadata = remoteRow.value ? JSON.parse(remoteRow.value) : {};
  } catch { /* corrupted metadata — skip */ }

  try {
    cipherFields = remoteRow.encrypted_value ? JSON.parse(remoteRow.encrypted_value) : {};
  } catch { /* corrupted cipher — skip */ }

  return {
    ...metadata,
    ...cipherFields,
    sync_status: 'synced',
    sync_source: 'remote',
    sync_version: metadata.sync_version || 0,
  };
}

// ─── Push (local → Supabase) ────────────────────────────────────────

async function pushTable(tableName) {
  const pending = await Database.getPendingSync(tableName);
  if (!pending.length) return { pushed: 0, failed: 0 };

  const sb = supabase;
  let pushed = 0;
  let failed = 0;
  const syncedIds = [];

  for (const row of pending) {
    try {
      const remote = toRemoteRow(tableName, row);

      // Tombstone: if soft-deleted locally, mark as deleted on remote
      if (row.deleted_at) {
        remote.is_deleted = true;
        remote.deleted_at = row.deleted_at;
      }

      const { error } = await sb
        .from(TABLES.COUPLE_DATA)
        .upsert(remote, { onConflict: 'couple_id,key' });

      if (error) throw error;
      syncedIds.push(row.id);
      pushed++;
    } catch (err) {
      console.warn(`[Sync] Push ${tableName}/${row.id} failed:`, err.message);
      failed++;
    }
  }

  if (syncedIds.length) {
    await Database.markSynced(tableName, syncedIds);
  }

  return { pushed, failed };
}

// ─── Pull (Supabase → local) ────────────────────────────────────────

async function pullTable(tableName) {
  const dataType = TABLE_TO_TYPE[tableName];
  const meta = await Database.getSyncMeta(tableName);
  const lastPulled = meta?.last_pulled_at || '1970-01-01T00:00:00.000Z';

  const sb = supabase;
  let query = sb
    .from(TABLES.COUPLE_DATA)
    .select('*')
    .eq('couple_id', _coupleId)
    .eq('data_type', dataType)
    .gt('updated_at', lastPulled)
    .order('updated_at', { ascending: true })
    .limit(200);

  const { data: rows, error } = await query;
  if (error) throw error;
  if (!rows || !rows.length) return { pulled: 0 };

  // Separate tombstones from live rows
  const liveRows = [];
  const tombstoneRows = [];
  for (const remoteRow of rows) {
    if (remoteRow.is_deleted || remoteRow.deleted_at) {
      tombstoneRows.push(remoteRow);
    } else {
      liveRows.push(remoteRow);
    }
  }

  // Convert to local format
  const localRows = liveRows.map(r => fromRemoteRow(tableName, r));

  // Batch upsert in a single transaction (atomic)
  const results = await Database.batchUpsertFromRemote(tableName, localRows);

  // Apply tombstones: soft-delete locally
  for (const remote of tombstoneRows) {
    try {
      const parsed = remote.value ? JSON.parse(remote.value) : {};
      if (parsed.id) {
        const db = await Database.init();
        await db.runAsync(
          `UPDATE ${tableName} SET deleted_at = ?, sync_status = 'synced', sync_source = 'remote' WHERE id = ?`,
          [remote.deleted_at || new Date().toISOString(), parsed.id]
        );
      }
    } catch (err) {
      console.warn(`[Sync] Tombstone apply ${tableName} failed:`, err.message);
    }
  }

  // Update cursor to the latest timestamp we saw
  let latestTimestamp = lastPulled;
  for (const row of rows) {
    if (row.updated_at > latestTimestamp) {
      latestTimestamp = row.updated_at;
    }
  }

  await Database.setSyncMeta(tableName, { last_pulled_at: latestTimestamp });
  return { pulled: results.inserted + results.updated + tombstoneRows.length };
}

// ─── Full sync cycle ────────────────────────────────────────────────

const SyncEngine = {
  /**
   * Configure the sync engine. Call when auth state or couple changes.
   */
  configure({ userId, coupleId, isPremium }) {
    _userId = userId || _userId;
    _coupleId = coupleId || _coupleId;
    _isPremium = typeof isPremium === 'boolean' ? isPremium : _isPremium;
  },

  /**
   * Run a full push + pull cycle for all tables.
   * Safe to call frequently — guards against re-entrant runs.
   */
  async sync() {
    if (_syncing) return { skipped: true };
    if (!canSync()) return { skipped: true, reason: 'not configured' };

    _syncing = true;
    emit('sync:start', null);

    const results = { pushed: 0, pulled: 0, failed: 0, attachments: { uploaded: 0, failed: 0 } };

    try {
      // 1. Push local changes
      for (const table of SYNC_TABLES) {
        const r = await pushTable(table);
        results.pushed += r.pushed;
        results.failed += r.failed;
      }

      // 2. Pull remote changes
      for (const table of SYNC_TABLES) {
        const r = await pullTable(table);
        results.pulled += r.pulled;
      }

      // 3. Upload pending attachments
      try {
        results.attachments = await EncryptedAttachments.uploadAllPending();
      } catch (err) {
        console.warn('[Sync] Attachment upload batch failed:', err.message);
      }

      // 4. Push attachment metadata (the rows in attachments table)
      try {
        const attPush = await pushTable('attachments');
        results.pushed += attPush.pushed;
        results.failed += attPush.failed;
      } catch { /* ignore */ }

      emit('sync:complete', results);
    } catch (err) {
      emit('sync:error', { error: err.message });
      console.error('[Sync] Cycle failed:', err);
    } finally {
      _syncing = false;
    }

    return results;
  },

  /**
   * Push only (useful right after a write).
   */
  async pushNow() {
    if (!canSync()) return;
    for (const table of SYNC_TABLES) {
      await pushTable(table);
    }
  },

  /**
   * Pull only (useful on app foreground).
   */
  async pullNow() {
    if (!canSync()) return;
    for (const table of SYNC_TABLES) {
      await pullTable(table);
    }
  },

  /**
   * Subscribe to Supabase Realtime for couple_data changes.
   * Returns an unsubscribe function.
   */
  subscribeRealtime() {
    if (!supabase || !_coupleId) return () => {};

    const channel = supabase
      .channel(`couple_sync_${_coupleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLES.COUPLE_DATA,
          filter: `couple_id=eq.${_coupleId}`,
        },
        async (payload) => {
          // A partner wrote something — pull that table
          const dataType = payload.new?.data_type || payload.old?.data_type;
          const tableName = Object.entries(TABLE_TO_TYPE).find(([, v]) => v === dataType)?.[0];
          if (tableName) {
            try {
              await pullTable(tableName);
              emit('sync:realtime', { table: tableName, event: payload.eventType });
            } catch (err) {
              console.warn('[Sync] Realtime pull failed:', err.message);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Listen to sync events.
   * @param {Function} fn — (event, data) => void
   * @returns {Function} unsubscribe
   */
  onSyncEvent(fn) {
    _listeners.push(fn);
    return () => {
      _listeners = _listeners.filter(l => l !== fn);
    };
  },

  /**
   * Full reset (sign-out / delete account).
   */
  async reset() {
    _syncing = false;
    _coupleId = null;
    _userId = null;
    _isPremium = false;
    _listeners = [];
    await Database.wipeAll();
  },

  /** Check if sync is currently running. */
  get isSyncing() {
    return _syncing;
  },

  /** Check if sync is possible with current config. */
  get isConfigured() {
    return canSync();
  },
};

export default SyncEngine;
