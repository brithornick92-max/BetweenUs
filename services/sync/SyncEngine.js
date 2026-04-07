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
import CrashReporting from '../CrashReporting';

// ─── Config ─────────────────────────────────────────────────────────

const SYNC_TABLES = [
  'journal_entries',
  'prompt_answers',
  'memories',
  'rituals',
  'check_ins',
  'vibes',
  'love_notes',
];

const PULL_TABLES = [...SYNC_TABLES, 'attachments'];

const PULL_PAGE_SIZE = 200;
const MIN_SYNC_INTERVAL_MS = 10_000; // 10 seconds between full cycles
const MAX_PUSH_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000; // exponential backoff base
const SYNC_TIMEOUT_MS = 30_000; // 30s max for a full sync cycle

/** Maps SQLite table → Supabase couple_data.data_type */
const TABLE_TO_TYPE = {
  journal_entries: 'journal',
  prompt_answers: 'prompt_answer',
  memories: 'memory',
  rituals: 'ritual',
  check_ins: 'check_in',
  vibes: 'vibe',
  love_notes: 'love_note',
  attachments: 'attachment_meta',
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
  // Per-device read state — each device tracks independently.
  // Syncing sender's is_read:true would make the partner's copy appear already-read.
  'is_read', 'read_at',
  // Expiry is per-device: only the recipient who opened the note has a local timer.
  // The sender's copy is permanent; syncing expires_at would erase their archive.
  'expires_at',
]);

// ─── State ──────────────────────────────────────────────────────────

let _syncing = false;
let _coupleId = null;
let _userId = null;
let _isPremium = false;
let _listeners = [];
let _lastSyncAt = 0;
let _operationChain = Promise.resolve();
let _realtimeChannel = null;

const DEFAULT_PULL_CURSOR = Object.freeze({
  updatedAt: '1970-01-01T00:00:00.000Z',
  key: null,
});

// ─── Helpers ────────────────────────────────────────────────────────

function emit(event, data) {
  _listeners.forEach(fn => {
    try { fn(event, data); } catch (e) {
      if (__DEV__) console.warn('[Sync] Listener error:', e?.message);
    }
  });
}

function canSync() {
  // Supabase client must exist and user must be in a couple.
  // We do NOT gate on _isPremium here — that caused a startup race condition
  // where notes saved before entitlements loaded were permanently stuck as
  // 'pending' and never pushed. Supabase RLS enforces premium limits server-side.
  return !!supabase && !!_coupleId && !!_userId;
}

function enqueueSyncOperation(fn) {
  const operation = _operationChain
    .catch(() => {})
    .then(fn);

  _operationChain = operation.catch(() => {});
  return operation;
}

function parsePullCursor(meta) {
  if (meta?.cursor) {
    try {
      const parsed = typeof meta.cursor === 'string'
        ? JSON.parse(meta.cursor)
        : meta.cursor;

      if (parsed?.updatedAt) {
        return {
          updatedAt: parsed.updatedAt,
          key: parsed.key || null,
        };
      }
    } catch (err) {
      if (__DEV__) console.warn('[Sync] Failed to parse stored cursor:', err?.message);
    }
  }

  return {
    updatedAt: meta?.last_pulled_at || DEFAULT_PULL_CURSOR.updatedAt,
    key: null,
  };
}

function toCursor(row) {
  return {
    updatedAt: row?.updated_at || DEFAULT_PULL_CURSOR.updatedAt,
    key: row?.key || null,
  };
}

function isCursorAfter(candidate, current) {
  if (!candidate?.updatedAt) return false;
  if (!current?.updatedAt) return true;
  if (candidate.updatedAt > current.updatedAt) return true;
  if (candidate.updatedAt < current.updatedAt) return false;

  const candidateKey = candidate.key || '';
  const currentKey = current.key || '';
  return candidateKey > currentKey;
}

function applyPullCursor(query, cursor) {
  if (cursor?.key) {
    return query.or(
      `updated_at.gt.${cursor.updatedAt},and(updated_at.eq.${cursor.updatedAt},key.gt.${cursor.key})`
    );
  }

  return query.gt('updated_at', cursor?.updatedAt || DEFAULT_PULL_CURSOR.updatedAt);
}

function clearRealtimeChannel() {
  if (!supabase || !_realtimeChannel) return;

  try {
    supabase.removeChannel(_realtimeChannel);
  } catch (err) {
    if (__DEV__) console.warn('[Sync] Failed to remove realtime channel:', err?.message);
  } finally {
    _realtimeChannel = null;
  }
}

/**
 * Build the Supabase couple_data row from a local SQLite row.
 * Cipher columns are already encrypted locally — pass them through.
 * Non-cipher data stays as unencrypted metadata.
 */
function toRemoteRow(tableName, row) {
  const dataType = TABLE_TO_TYPE[tableName];
  if (!dataType) throw new Error(`[Sync] Unknown table: ${tableName}`);
  if (!row?.id) throw new Error(`[Sync] Row missing id for ${tableName}`);
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
    // MUST use the Supabase auth UUID (_userId) — not the local SQLite user_id.
    // RLS requires created_by = auth.uid(). Local rows may have a different
    // UUID stored in user_id (legacy Crypto.randomUUID from AppContext).
    created_by: _userId,
    // love_notes are always couple-shared; the table has no is_private column
    is_private: tableName === 'love_notes' ? false : !!row.is_private,
    // Metadata object — passed as a plain JS object so PostgREST stores it
    // as a JSONB object (not a JSONB string). Returning it as an object
    // ensures fromRemoteRow can read it back without JSON.parse.
    value: metadata,
    // Encrypted payload is text, not JSONB — must stay as a JSON string.
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
    // value is a JSONB column — PostgREST returns it as a JS object,
    // but older rows or edge cases may have been stored as a JSON string.
    // Handle both to be safe.
    if (remoteRow.value !== null && remoteRow.value !== undefined) {
      metadata = typeof remoteRow.value === 'string'
        ? JSON.parse(remoteRow.value)
        : remoteRow.value;
    }
  } catch (e) {
    CrashReporting.captureException(
      new Error(`[Sync] Corrupted metadata in ${tableName}: ${e?.message}`),
      { key: remoteRow.key }
    );
    return null; // skip this row
  }

  try {
    cipherFields = remoteRow.encrypted_value ? JSON.parse(remoteRow.encrypted_value) : {};
  } catch (e) {
    CrashReporting.captureException(
      new Error(`[Sync] Corrupted cipher payload in ${tableName}: ${e?.message}`),
      { key: remoteRow.key }
    );
    return null; // skip this row
  }

  // Validate: must have an id
  if (!metadata.id) {
    CrashReporting.captureMessage(`[Sync] Remote row missing id for ${tableName}`, 'warning');
    return null;
  }

  return {
    ...metadata,
    couple_id: remoteRow.couple_id ?? metadata.couple_id ?? null,
    ...cipherFields,
    sync_status: 'synced',
    sync_source: 'remote',
    sync_version: metadata.sync_version || 0,
  };
}

// ─── Push (local → Supabase) ────────────────────────────────────────

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function pushTable(tableName) {
  const pending = await Database.getPendingSync(tableName);
  if (!pending.length) return { pushed: 0, failed: 0 };

  const sb = supabase;
  let pushed = 0;
  let failed = 0;
  const syncedIds = [];

  for (const row of pending) {
    let lastErr = null;
    for (let attempt = 0; attempt < MAX_PUSH_RETRIES; attempt++) {
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
        lastErr = null;
        break; // success
      } catch (err) {
        lastErr = err;
        // Don't retry permanent RLS / permission errors — only transient ones
        const isPermanent = err?.code === '42501' || err?.message?.includes('row-level security');
        if (isPermanent) break;
        if (attempt < MAX_PUSH_RETRIES - 1) {
          await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
        }
      }
    }
    if (lastErr) {
      if (__DEV__) console.warn(
        `[Sync] Push ${tableName}/${row.id} failed after ${MAX_PUSH_RETRIES} attempts:`,
        lastErr?.message,
        lastErr?.code ? `(code: ${lastErr.code})` : ''
      );
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
  let cursor = parsePullCursor(meta);

  const sb = supabase;
  let totalPulled = 0;

  // Paginate: keep fetching until we get fewer rows than page size
  while (true) {
    let query = sb
      .from(TABLES.COUPLE_DATA)
      .select('*')
      .eq('couple_id', _coupleId)
      .eq('data_type', dataType)
      .order('updated_at', { ascending: true })
      .order('key', { ascending: true });

    query = applyPullCursor(query, cursor);

    const { data: rows, error } = await query
      .limit(PULL_PAGE_SIZE);

    if (error) throw error;
    if (!rows || !rows.length) break;

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

    // Convert to local format, filtering out invalid rows
    const localRows = [];
    const processedLiveRows = [];
    for (const remoteRow of liveRows) {
      const localRow = fromRemoteRow(tableName, remoteRow);
      if (!localRow) continue;
      localRows.push(localRow);
      processedLiveRows.push(remoteRow);
    }

    // Batch upsert in a single transaction (atomic)
    const results = await Database.batchUpsertFromRemote(tableName, localRows);

    // Apply tombstones: soft-delete locally
    for (const remote of tombstoneRows) {
      try {
        let parsed = {};
        if (remote.value) {
          parsed = typeof remote.value === 'string' ? JSON.parse(remote.value) : remote.value;
        }
        if (parsed.id) {
          const db = await Database.init();
          await db.runAsync(
            `UPDATE ${tableName} SET deleted_at = ?, sync_status = 'synced', sync_source = 'remote' WHERE id = ?`,
            [remote.deleted_at || new Date().toISOString(), parsed.id]
          );
        }
      } catch (err) {
        if (__DEV__) console.warn(`[Sync] Tombstone apply ${tableName} failed:`, err.message);
      }
    }

    // Advance cursor only for rows that were successfully processed
    // (prevents permanently skipping corrupted rows that fromRemoteRow rejected)
    for (const row of [...processedLiveRows, ...tombstoneRows]) {
      const rowCursor = toCursor(row);
      if (isCursorAfter(rowCursor, cursor)) {
        cursor = rowCursor;
      }
    }

    totalPulled += results.inserted + results.updated + tombstoneRows.length;

    // If we got fewer than the page size, we've caught up
    if (rows.length < PULL_PAGE_SIZE) break;
  }

  await Database.setSyncMeta(tableName, {
    last_pulled_at: cursor.updatedAt,
    cursor: JSON.stringify(cursor),
  });
  return { pulled: totalPulled };
}

// ─── Full sync cycle ────────────────────────────────────────────────

const SyncEngine = {
  /**
   * Configure the sync engine. Call when auth state or couple changes.
   */
  configure({ userId, coupleId, isPremium }) {
    const previousCoupleId = _coupleId;

    if (userId !== undefined) {
      _userId = userId || null;
    }
    if (coupleId !== undefined) {
      _coupleId = coupleId || null;
    }
    _isPremium = typeof isPremium === 'boolean' ? isPremium : _isPremium;

    if (previousCoupleId && previousCoupleId !== _coupleId) {
      clearRealtimeChannel();
    }
  },

  /**
   * Run a full push + pull cycle for all tables.
   * Safe to call frequently — guards against re-entrant runs and throttles.
   */
  async sync() {
    if (!canSync()) return { skipped: true, reason: 'not configured' };

    return enqueueSyncOperation(async () => {
      if (!canSync()) return { skipped: true, reason: 'not configured' };
      if (_syncing) return { skipped: true, reason: 'in_progress' };

      // Throttle: don't allow more than one sync per MIN_SYNC_INTERVAL_MS
      const now = Date.now();
      if (now - _lastSyncAt < MIN_SYNC_INTERVAL_MS) {
        return { skipped: true, reason: 'throttled' };
      }

      _syncing = true;
      _lastSyncAt = now;
      emit('sync:start', null);

      const results = { pushed: 0, pulled: 0, failed: 0, attachments: { uploaded: 0, failed: 0 } };

      let timer;
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Sync timed out (30s)')), SYNC_TIMEOUT_MS);
      });

      try {
        await Promise.race([this._performSyncCycle(results), timeout]);
        emit('sync:complete', results);
      } catch (err) {
        emit('sync:error', { error: err.message });
        CrashReporting.captureException(err, { source: 'sync_cycle' });
      } finally {
        clearTimeout(timer);
        _syncing = false;
      }

      return results;
    });
  },

  /** @private Internal sync logic — called by sync() under timeout guard. */
  async _performSyncCycle(results) {
      // 1. Upload pending attachment files FIRST so they exist in Storage
      //    before love_notes rows (which reference media_ref) reach the partner.
      let attachmentUploadOk = false;
      try {
        results.attachments = await EncryptedAttachments.uploadAllPending();
        attachmentUploadOk = true;
      } catch (err) {
        if (__DEV__) console.warn('[Sync] Attachment upload batch failed:', err.message);
      }

      // 2. Push attachment metadata ONLY if uploads succeeded
      //    (prevents partner from seeing broken media_ref references)
      if (attachmentUploadOk) {
        try {
          const attPush = await pushTable('attachments');
          results.pushed += attPush.pushed;
          results.failed += attPush.failed;
        } catch (e) {
          if (__DEV__) console.warn('[Sync] Attachment metadata push failed:', e?.message);
          CrashReporting.captureException(e, { source: 'sync_attach_push' });
        }
      }

      // 3. Push all other local changes (journals, etc.)
      //    Skip love_notes if attachments failed — prevents partner seeing broken media_ref
      for (const table of SYNC_TABLES) {
        if (table === 'love_notes' && !attachmentUploadOk) continue;
        const r = await pushTable(table);
        results.pushed += r.pushed;
        results.failed += r.failed;
      }

      // 4. Pull remote changes
      for (const table of PULL_TABLES) {
        const r = await pullTable(table);
        results.pulled += r.pulled;
      }
  },

  /**
   * Push only (useful right after a write).
   */
  async pushNow() {
    if (!canSync()) return;
    return enqueueSyncOperation(async () => {
      if (!canSync()) return { skipped: true, reason: 'not configured' };

      // Upload encrypted attachment files FIRST so they exist in Storage
      // before love_notes rows (which reference media_ref) reach the partner.
      let attachmentsOk = false;
      try {
        await EncryptedAttachments.uploadAllPending();
        attachmentsOk = true;
      } catch (err) {
        if (__DEV__) console.warn('[Sync] pushNow attachment upload failed:', err?.message);
      }
      // Push attachment metadata so partner can discover the files
      if (attachmentsOk) {
        try {
          await pushTable('attachments');
        } catch (err) {
          if (__DEV__) console.warn('[Sync] pushNow attachment meta push failed:', err?.message);
        }
      }
      // Now push all other tables (journals, etc.)
      // Skip love_notes if attachments failed — prevents partner seeing broken media_ref
      for (const table of SYNC_TABLES) {
        if (table === 'love_notes' && !attachmentsOk) continue;
        await pushTable(table);
      }

      return { pushed: true };
    });
  },

  /**
   * Pull only (useful on app foreground).
   */
  async pullNow() {
    if (!canSync()) return;
    return enqueueSyncOperation(async () => {
      if (!canSync()) return { skipped: true, reason: 'not configured' };
      for (const table of PULL_TABLES) {
        await pullTable(table);
      }
      return { pulled: true };
    });
  },

  /**
   * Subscribe to Supabase Realtime for couple_data changes.
   * Returns an unsubscribe function.
   */
  subscribeRealtime() {
    if (!supabase || !_coupleId) return () => {};

    clearRealtimeChannel();

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
              await enqueueSyncOperation(async () => {
                if (!canSync()) return;
                await pullTable(tableName);
              });
              emit('sync:realtime', { table: tableName, event: payload.eventType });
            } catch (err) {
              if (__DEV__) console.warn('[Sync] Realtime pull failed:', err.message);
            }
          }
        }
      )
      .subscribe();

    _realtimeChannel = channel;

    return () => {
      if (_realtimeChannel === channel) {
        _realtimeChannel = null;
      }
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
    clearRealtimeChannel();
    _syncing = false;
    _coupleId = null;
    _userId = null;
    _isPremium = false;
    _listeners = [];
    _lastSyncAt = 0;
    _operationChain = Promise.resolve();
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
