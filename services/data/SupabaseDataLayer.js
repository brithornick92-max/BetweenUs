/**
 * SupabaseDataLayer.js — Cloud-first data access layer for Between Us
 *
 * Replaces the local-first SQLite + E2EE + SyncEngine stack with direct
 * Supabase reads and writes.  The public API is intentionally identical to
 * DataLayer.js so every screen and context continues to work unchanged.
 *
 * Architecture:
 *   • All structured content (journals, prompts, memories, check-ins, vibes,
 *     date plans) is stored in the `couple_data` table as plaintext JSON in
 *     the `value` column, protected by Supabase RLS.
 *   • Calendar events use their dedicated `calendar_events` table.
 *   • Media files are uploaded to Supabase Storage (`couple-media` for images,
 *     `attachments` for videos) and referenced by path in `value.mediaPath`.
 *   • Local storage is used only for cache and offline mutation queueing.
 */

import { supabase, TABLES } from '../../config/supabase';
import { randomUUID } from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import PartnerNotifications from '../PartnerNotifications';
import { getPromptById } from '../../utils/contentLoader';
import { storage, STORAGE_KEYS } from '../../utils/storage';

// ─── Module state ────────────────────────────────────────────────────────────

let _userId = null;
let _coupleId = null;
let _calendarChannel = null;
let _isFlushingQueue = false;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const now = () => new Date().toISOString();
const CACHE_SCOPES = Object.freeze({
  journals: 'journals',
  prompts: 'prompts',
  memories: 'memories',
  checkIns: 'checkIns',
  vibes: 'vibes',
  calendar: 'calendar',
  datePlans: 'datePlans',
});

function offlineQueueKey(userId) {
  return `${STORAGE_KEYS.CLOUD_SYNC_QUEUE}:${userId || 'anonymous'}`;
}

function cacheKey(userId, scope) {
  return `@betweenus:dataCache:${userId || 'anonymous'}:${scope}`;
}

function makeId(prefix = 'row') {
  return `${prefix}_${randomUUID()}`;
}

function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getSupabaseOrNull() {
  return supabase;
}

function isOfflineCapableError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    !supabase
    || message.includes('network')
    || message.includes('fetch')
    || message.includes('offline')
    || message.includes('timeout')
    || message.includes('failed to fetch')
  );
}

async function getOfflineQueue() {
  return storage.get(offlineQueueKey(_userId), []);
}

async function setOfflineQueue(queue) {
  await storage.set(offlineQueueKey(_userId), Array.isArray(queue) ? queue : []);
}

async function enqueueOfflineMutation(mutation) {
  const queue = await getOfflineQueue();
  queue.push({
    mutationId: randomUUID(),
    queuedAt: now(),
    ...mutation,
  });
  await setOfflineQueue(queue);
}

async function loadCache(scope) {
  return storage.get(cacheKey(_userId, scope), []);
}

async function saveCache(scope, rows) {
  await storage.set(cacheKey(_userId, scope), Array.isArray(rows) ? rows : []);
}

async function replaceCache(scope, rows) {
  await saveCache(scope, rows);
  return rows;
}

async function upsertCacheRow(scope, row, { sortBy = 'created_at', descending = true } = {}) {
  const rows = await loadCache(scope);
  const next = [row, ...rows.filter((item) => item?.id !== row?.id)];
  next.sort((a, b) => {
    const av = a?.[sortBy] ?? '';
    const bv = b?.[sortBy] ?? '';
    if (av === bv) return 0;
    return descending ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
  });
  await saveCache(scope, next);
  return row;
}

async function removeCacheRow(scope, id) {
  const rows = await loadCache(scope);
  await saveCache(scope, rows.filter((item) => item?.id !== id));
}

async function runCloudOperation({ perform, onSuccess, onOffline }) {
  try {
    const result = await perform();
    return onSuccess ? await onSuccess(result) : result;
  } catch (error) {
    if (!isOfflineCapableError(error) || !onOffline) throw error;
    return onOffline(error);
  }
}

/**
 * Insert a row into couple_data.
 * `id` becomes both the PK and the `key` so it can be used as a stable
 * client-side identifier and for ON CONFLICT upserts.
 */
async function cdInsert(dataType, id, value, { isPrivate = false } = {}) {
  const sb = getSupabaseOrNull();
  if (!sb) throw new Error('Supabase is not configured');
  if (!_coupleId) throw new Error('Not paired — couple_id is required for shared data');

  const { data, error } = await sb
    .from(TABLES.COUPLE_DATA)
    .insert({
      id,
      couple_id: _coupleId,
      key: id,
      value,
      data_type: dataType,
      created_by: _userId,
      is_private: isPrivate,
      created_at: now(),
      updated_at: now(),
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Upsert a row into couple_data by id (PK).
 */
async function cdUpsert(dataType, id, value, { isPrivate = false } = {}) {
  const sb = getSupabaseOrNull();
  if (!sb) throw new Error('Supabase is not configured');
  if (!_coupleId) throw new Error('Not paired — couple_id is required for shared data');

  const { data, error } = await sb
    .from(TABLES.COUPLE_DATA)
    .upsert({
      id,
      couple_id: _coupleId,
      key: id,
      value,
      data_type: dataType,
      created_by: _userId,
      is_private: isPrivate,
      updated_at: now(),
    }, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update the `value` of an existing couple_data row.
 */
async function cdUpdate(id, valuePatch) {
  const sb = getSupabaseOrNull();
  if (!sb) throw new Error('Supabase is not configured');

  // Merge with existing value
  const { data: existing, error: fetchError } = await sb
    .from(TABLES.COUPLE_DATA)
    .select('value')
    .eq('id', id)
    .single();
  if (fetchError) throw fetchError;

  const merged = { ...(existing?.value || {}), ...valuePatch };

  const { data, error } = await sb
    .from(TABLES.COUPLE_DATA)
    .update({ value: merged, updated_at: now() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Soft-delete a couple_data row.
 */
async function cdSoftDelete(id) {
  const sb = getSupabaseOrNull();
  if (!sb) throw new Error('Supabase is not configured');

  const { error } = await sb
    .from(TABLES.COUPLE_DATA)
    .update({ is_deleted: true, deleted_at: now(), updated_at: now() })
    .eq('id', id);

  if (error) throw error;
}

/**
 * Query couple_data rows for the current couple by data_type.
 * Always filters out soft-deleted rows.
 */
async function cdQuery(dataType, { limit = 100, offset = 0, filter } = {}) {
  const sb = getSupabaseOrNull();
  if (!sb) return [];
  if (!_coupleId) return [];

  let query = sb
    .from(TABLES.COUPLE_DATA)
    .select('*')
    .eq('couple_id', _coupleId)
    .eq('data_type', dataType)
    .or('is_deleted.is.null,is_deleted.eq.false')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filter) {
    query = filter(query);
  }

  const { data, error } = await query;
  if (error) {
    if (__DEV__) console.warn(`[SupabaseDataLayer] cdQuery(${dataType}) failed:`, error?.message);
    return [];
  }
  return data || [];
}

// ─── Media upload helpers ─────────────────────────────────────────────────────

const IMAGE_BUCKET = 'couple-media';
const VIDEO_BUCKET = 'attachments';

/**
 * Upload a local file URI to Supabase Storage.
 * Returns the storage path for use in value.mediaPath.
 */
async function uploadMedia({ localUri, mimeType, coupleId }) {
  const sb = getSupabaseOrNull();
  if (!sb || !coupleId) return null;

  const isVideo = mimeType?.startsWith('video/');
  const bucket = isVideo ? VIDEO_BUCKET : IMAGE_BUCKET;
  const ext = mimeType?.split('/')[1]?.replace('quicktime', 'mov') || 'jpg';
  const fileId = randomUUID();
  // couple-media RLS policy requires path: couples/{couple_id}/{file}
  // attachments RLS policy requires path: {couple_id}/{file}
  const storagePath = isVideo
    ? `${coupleId}/${fileId}.${ext}`
    : `couples/${coupleId}/${fileId}.${ext}`;

  try {
    const b64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));

    const { error } = await sb.storage
      .from(bucket)
      .upload(storagePath, bytes, {
        contentType: isVideo ? 'application/octet-stream' : mimeType,
        upsert: false,
      });

    if (error) throw error;
    return { storagePath, bucket, mimeType };
  } catch (err) {
    if (__DEV__) console.warn('[SupabaseDataLayer] Media upload failed:', err?.message);
    return null;
  }
}

/**
 * Get a short-lived signed URL for a stored media file.
 */
async function getSignedMediaUrl(bucket, storagePath, expiresIn = 3600) {
  const sb = getSupabaseOrNull();
  if (!sb || !storagePath) return null;
  try {
    const { data, error } = await sb.storage
      .from(bucket)
      .createSignedUrl(storagePath, expiresIn);
    if (error) throw error;
    return data?.signedUrl || null;
  } catch (err) {
    if (__DEV__) console.warn('[SupabaseDataLayer] Signed URL failed:', err?.message);
    return null;
  }
}

// ─── Row mappers ─────────────────────────────────────────────────────────────

async function mapJournalRow(row) {
  if (!row) return null;
  const v = row.value || {};
  let mediaUri = null;
  let mediaType = null;
  let mediaKind = null;

  if (v.mediaPath && v.mediaBucket) {
    mediaUri = await getSignedMediaUrl(v.mediaBucket, v.mediaPath);
    mediaType = v.mimeType || null;
    mediaKind = mediaType?.startsWith('video/') ? 'video' : (mediaUri ? 'image' : null);
  }

  return {
    id: row.id,
    user_id: row.created_by,
    couple_id: row.couple_id,
    title: v.title || '',
    body: v.body || '',
    mood: v.mood || null,
    tags: v.tags || [],
    is_private: !!row.is_private,
    photo_uri: v.photoUri || null,
    mediaRef: v.mediaPath || null,
    mediaUri,
    mediaType,
    mediaKind,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function mapPromptRow(row, partnerRow = null) {
  if (!row) return null;
  const v = row.value || {};
  const pv = partnerRow?.value || null;
  const promptHeat = getPromptById(v.promptId)?.heat;
  return {
    id: row.id,
    user_id: row.created_by,
    couple_id: row.couple_id,
    prompt_id: v.promptId,
    date_key: v.dateKey,
    answer: v.answer || null,
    partnerAnswer: pv?.answer || null,
    heat_level: typeof promptHeat === 'number' ? promptHeat : (v.heatLevel ?? 1),
    is_revealed: !!v.isRevealed,
    reveal_at: v.revealAt || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function mapMemoryRow(row) {
  if (!row) return null;
  const v = row.value || {};
  let mediaUri = null;

  if (v.mediaPath && v.mediaBucket) {
    mediaUri = await getSignedMediaUrl(v.mediaBucket, v.mediaPath);
  }

  return {
    id: row.id,
    user_id: row.created_by,
    couple_id: row.couple_id,
    type: v.type || 'moment',
    content: v.content || '',
    mood: v.mood || null,
    is_private: !!row.is_private,
    media_ref: v.mediaPath || null,
    mime_type: v.mimeType || null,
    mediaUri,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapCalendarRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title || '',
    location: row.location || '',
    notes: row.description || '',
    eventType: row.event_type || 'general',
    isDateNight: row.event_type === 'dateNight' || row.event_type === 'date_night' || !!row.metadata?.isDateNight,
    whenTs: new Date(row.event_date).getTime(),
    notify: !!row.metadata?.notify,
    notifyMins: Number(row.metadata?.notifyMins ?? 60) || 60,
    notificationId: row.metadata?.notificationId || null,
    metadata: row.metadata || {},
    createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
    isRemote: true,
    supabaseId: row.id,
  };
}

function mapDatePlanRow(row) {
  if (!row) return null;
  const v = row.value || {};
  return {
    id: row.id,
    title: v.title || '',
    sourceEventId: v.sourceEventId || null,
    locationType: v.locationType || 'home',
    heat: v.heat ?? 2,
    load: v.load ?? 2,
    style: v.style || 'mixed',
    steps: Array.isArray(v.steps) ? v.steps : [],
    createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
    isRemote: true,
  };
}

function makeOfflineJournalRow(id, value, base = {}) {
  const timestamp = now();
  return {
    id,
    user_id: _userId,
    couple_id: _coupleId,
    title: value.title || '',
    body: value.body || '',
    mood: value.mood || null,
    tags: value.tags || [],
    is_private: false,
    photo_uri: value.photoUri || null,
    mediaRef: value.mediaPath || null,
    mediaUri: value.photoUri || base.mediaUri || null,
    mediaType: value.mimeType || base.mediaType || null,
    mediaKind: (value.mimeType || base.mediaType || '').startsWith('video/')
      ? 'video'
      : ((value.photoUri || base.mediaUri) ? 'image' : null),
    created_at: base.created_at || timestamp,
    updated_at: timestamp,
    sync_status: 'pending',
  };
}

function makeOfflinePromptRow(id, value, base = {}) {
  const timestamp = now();
  const promptHeat = getPromptById(value.promptId)?.heat;
  return {
    id,
    user_id: _userId,
    couple_id: _coupleId,
    prompt_id: value.promptId,
    date_key: value.dateKey,
    answer: value.answer || null,
    partnerAnswer: base.partnerAnswer || null,
    heat_level: typeof promptHeat === 'number' ? promptHeat : (value.heatLevel ?? 1),
    is_revealed: !!value.isRevealed,
    reveal_at: value.revealAt || null,
    created_at: base.created_at || timestamp,
    updated_at: timestamp,
    sync_status: 'pending',
  };
}

function makeOfflineMemoryRow(id, value, base = {}) {
  const timestamp = now();
  return {
    id,
    user_id: _userId,
    couple_id: _coupleId,
    type: value.type || 'moment',
    content: value.content || '',
    mood: value.mood || null,
    is_private: false,
    media_ref: value.mediaPath || null,
    mime_type: value.mimeType || null,
    mediaUri: base.mediaUri || null,
    created_at: base.created_at || timestamp,
    updated_at: timestamp,
    sync_status: 'pending',
  };
}

function makeOfflineCheckInRow(id, value, base = {}) {
  const timestamp = now();
  return {
    id,
    user_id: _userId,
    couple_id: _coupleId,
    ...value,
    created_at: base.created_at || timestamp,
    updated_at: timestamp,
    sync_status: 'pending',
  };
}

function makeOfflineVibeRow(id, value, base = {}) {
  const timestamp = now();
  return {
    id,
    user_id: _userId,
    couple_id: _coupleId,
    ...value,
    created_at: base.created_at || timestamp,
    updated_at: timestamp,
    sync_status: 'pending',
  };
}

function makeOfflineCalendarRow(id, event, base = {}) {
  const ts = Date.now();
  return {
    id,
    title: event?.title || '',
    location: event?.location || '',
    notes: event?.notes || '',
    eventType: event?.eventType || 'general',
    isDateNight: !!(event?.isDateNight || event?.eventType === 'dateNight'),
    whenTs: event?.whenTs,
    notify: !!event?.notify,
    notifyMins: Number(event?.notifyMins ?? 60) || 60,
    notificationId: event?.notificationId || null,
    metadata: event?.metadata || {},
    createdAt: base.createdAt || ts,
    updatedAt: ts,
    isRemote: false,
    remoteSynced: false,
    sync_status: 'pending',
  };
}

function makeOfflineDatePlanRow(id, plan, base = {}) {
  const ts = Date.now();
  return {
    id,
    title: plan?.title || '',
    sourceEventId: plan?.sourceEventId || null,
    locationType: plan?.locationType || 'home',
    heat: plan?.heat ?? 2,
    load: plan?.load ?? 2,
    style: plan?.style || 'mixed',
    steps: Array.isArray(plan?.steps) ? plan.steps : [],
    createdAt: base.createdAt || ts,
    updatedAt: ts,
    isRemote: false,
    remoteSynced: false,
    sync_status: 'pending',
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

const SupabaseDataLayer = {

  // ─── Init ───────────────────────────────────────────────────────────────

  async init({ userId, coupleId, isPremium = false }) {
    _userId = userId;
    _coupleId = coupleId || null;
    await this.flushOfflineQueue();
  },

  async reconfigure({ userId, coupleId, isPremium }) {
    if (userId !== undefined) _userId = userId;
    if (coupleId !== undefined) _coupleId = coupleId || null;
    await this.flushOfflineQueue();
  },

  async reset() {
    const sb = getSupabaseOrNull();
    if (_calendarChannel && sb) {
      try { sb.removeChannel(_calendarChannel); } catch {}
      _calendarChannel = null;
    }
    _userId = null;
    _coupleId = null;
    _isFlushingQueue = false;
  },

  // No E2EE — these always resolve cleanly
  canEncryptForCouple() { return false; },
  needsReconnect() { return false; },

  async getCoupleStateStatus() {
    return {
      coupleId: _coupleId,
      hasCoupleKey: false,
      status: _coupleId ? 'paired' : 'unpaired',
    };
  },

  // ─── Journal ────────────────────────────────────────────────────────────

  async saveJournalEntry({ title, body, mood, tags, imageUri = null, mediaUri, mimeType, fileName }) {
    const id = makeId('jrn');
    let mediaData = null;

    if (mediaUri) {
      mediaData = await uploadMedia({ localUri: mediaUri, mimeType, coupleId: _coupleId });
    }

    const value = {
      title: title || '',
      body: body || '',
      mood: mood || null,
      tags: tags || [],
      photoUri: mediaData ? null : (imageUri || null),
      mediaPath: mediaData?.storagePath || null,
      mediaBucket: mediaData?.bucket || null,
      mimeType: mediaData?.mimeType || null,
    };

    return runCloudOperation({
      perform: async () => cdInsert('journal', id, value),
      onSuccess: async (row) => {
        const mapped = await mapJournalRow(row);
        await upsertCacheRow(CACHE_SCOPES.journals, mapped);
        PartnerNotifications.journalShared().catch(() => {});
        return mapped;
      },
      onOffline: async () => {
        const mapped = makeOfflineJournalRow(id, value);
        await enqueueOfflineMutation({
          entity: 'journal',
          action: 'insert',
          id,
          payload: value,
        });
        await upsertCacheRow(CACHE_SCOPES.journals, mapped);
        return mapped;
      },
    });
  },

  async updateJournalEntry(id, { title, body, mood, tags, imageUri, mediaUri, mimeType }) {
    const patch = {};
    if (title !== undefined) patch.title = title;
    if (body !== undefined) patch.body = body;
    if (mood !== undefined) patch.mood = mood;
    if (tags !== undefined) patch.tags = tags;

    if (mediaUri !== undefined) {
      if (mediaUri) {
        const mediaData = await uploadMedia({ localUri: mediaUri, mimeType, coupleId: _coupleId });
        if (mediaData) {
          patch.mediaPath = mediaData.storagePath;
          patch.mediaBucket = mediaData.bucket;
          patch.mimeType = mediaData.mimeType;
          patch.photoUri = null;
        }
      } else {
        patch.mediaPath = null;
        patch.mediaBucket = null;
        patch.mimeType = null;
      }
    }

    if (imageUri !== undefined) {
      patch.photoUri = imageUri || null;
      patch.mediaPath = null;
    }

    return runCloudOperation({
      perform: async () => cdUpdate(id, patch),
      onSuccess: async (row) => {
        const mapped = await mapJournalRow(row);
        await upsertCacheRow(CACHE_SCOPES.journals, mapped);
        return mapped;
      },
      onOffline: async () => {
        const existing = await this.getJournalEntry(id);
        const mapped = makeOfflineJournalRow(id, {
          title: patch.title ?? existing?.title ?? '',
          body: patch.body ?? existing?.body ?? '',
          mood: patch.mood ?? existing?.mood ?? null,
          tags: patch.tags ?? existing?.tags ?? [],
          photoUri: patch.photoUri ?? existing?.photo_uri ?? null,
          mediaPath: patch.mediaPath ?? existing?.mediaRef ?? null,
          mimeType: patch.mimeType ?? existing?.mediaType ?? null,
        }, existing || {});
        await enqueueOfflineMutation({
          entity: 'journal',
          action: 'update',
          id,
          payload: patch,
        });
        await upsertCacheRow(CACHE_SCOPES.journals, mapped);
        return mapped;
      },
    });
  },

  async deleteJournalEntry(id) {
    return runCloudOperation({
      perform: async () => cdSoftDelete(id),
      onSuccess: async () => {
        await removeCacheRow(CACHE_SCOPES.journals, id);
      },
      onOffline: async () => {
        await enqueueOfflineMutation({ entity: 'journal', action: 'delete', id });
        await removeCacheRow(CACHE_SCOPES.journals, id);
      },
    });
  },

  async getJournalEntries({ limit = 50, offset = 0, mood, visibility } = {}) {
    if (visibility === 'private') return [];
    if (visibility === 'shared' && !_coupleId) return [];

    const rows = await cdQuery('journal', {
      limit,
      offset,
      filter: (q) => {
        let query = q;
        if (visibility !== 'shared') {
          query = query.eq('created_by', _userId);
        }
        if (mood) {
          query = query.eq('value->>mood', mood);
        }
        return query;
      },
    });

    if (rows.length) {
      const mapped = await Promise.all(rows.map(r => mapJournalRow(r)));
      await replaceCache(CACHE_SCOPES.journals, mapped);
      return mapped;
    }

    const cached = await loadCache(CACHE_SCOPES.journals);
    return cached
      .filter((entry) => visibility === 'shared' || entry?.user_id === _userId)
      .filter((entry) => !mood || entry?.mood === mood)
      .slice(offset, offset + limit);
  },

  async getJournalEntry(id) {
    const sb = getSupabaseOrNull();
    if (!sb) {
      const cached = await loadCache(CACHE_SCOPES.journals);
      return cached.find((entry) => entry?.id === id) || null;
    }
    const { data, error } = await sb
      .from(TABLES.COUPLE_DATA)
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) {
      const cached = await loadCache(CACHE_SCOPES.journals);
      return cached.find((entry) => entry?.id === id) || null;
    }
    const mapped = await mapJournalRow(data);
    await upsertCacheRow(CACHE_SCOPES.journals, mapped);
    return mapped;
  },

  // ─── Prompt Answers ──────────────────────────────────────────────────────

  async savePromptAnswer({ promptId, answer, heatLevel, _createdAt }) {
    const resolvedHeatLevel = typeof heatLevel === 'number'
      ? heatLevel
      : (getPromptById(promptId)?.heat || 1);
    const dk = _createdAt ? dateKey(new Date(_createdAt)) : dateKey();

    // Check for existing answer for this prompt/date by this user
    const existing = await this._findPromptAnswer(promptId, dk, _userId);

    const value = {
      promptId,
      dateKey: dk,
      answer,
      heatLevel: resolvedHeatLevel,
      isRevealed: existing?.value?.isRevealed || false,
      revealAt: existing?.value?.revealAt || null,
    };

    let row;
    const id = existing?.id || makeId('ans');

    return runCloudOperation({
      perform: async () => (existing ? cdUpdate(existing.id, value) : cdInsert('prompt_answer', id, value)),
      onSuccess: async (remoteRow) => {
        const mapped = await mapPromptRow(remoteRow);
        await upsertCacheRow(CACHE_SCOPES.prompts, mapped);
        return mapped;
      },
      onOffline: async () => {
        const cached = existing ? (await this.getPromptAnswerForToday(promptId)) : null;
        const mapped = makeOfflinePromptRow(id, value, cached || {});
        await enqueueOfflineMutation({
          entity: 'prompt_answer',
          action: existing ? 'update' : 'insert',
          id,
          payload: value,
        });
        await upsertCacheRow(CACHE_SCOPES.prompts, mapped);
        return mapped;
      },
    });
  },

  async revealPromptAnswer(id) {
    const patch = { isRevealed: true, revealAt: now() };
    return runCloudOperation({
      perform: async () => cdUpdate(id, patch),
      onSuccess: async (row) => {
        const mapped = await mapPromptRow(row);
        await upsertCacheRow(CACHE_SCOPES.prompts, mapped);
        return mapped;
      },
      onOffline: async () => {
        const cached = await loadCache(CACHE_SCOPES.prompts);
        const existing = cached.find((row) => row?.id === id) || {};
        const mapped = makeOfflinePromptRow(id, {
          promptId: existing.prompt_id,
          dateKey: existing.date_key,
          answer: existing.answer,
          heatLevel: existing.heat_level,
          ...patch,
        }, existing);
        await enqueueOfflineMutation({ entity: 'prompt_answer', action: 'update', id, payload: patch });
        await upsertCacheRow(CACHE_SCOPES.prompts, mapped);
        return mapped;
      },
    });
  },

  async getPromptAnswers({ dateKey: dk, promptId, limit = 100 } = {}) {
    const rows = await cdQuery('prompt_answer', {
      limit,
      filter: (q) => {
        let query = q.eq('created_by', _userId);
        if (dk) query = query.eq('value->>dateKey', dk);
        if (promptId) query = query.eq('value->>promptId', promptId);
        return query;
      },
    });
    if (rows.length) {
      const mapped = await Promise.all(rows.map(r => mapPromptRow(r)));
      await replaceCache(CACHE_SCOPES.prompts, mapped);
      return mapped;
    }
    const cached = await loadCache(CACHE_SCOPES.prompts);
    return cached
      .filter((row) => row?.user_id === _userId)
      .filter((row) => !dk || row?.date_key === dk)
      .filter((row) => !promptId || row?.prompt_id === promptId)
      .slice(0, limit);
  },

  async getSharedPromptAnswers({ dateKey: dk, promptId, limit = 100 } = {}) {
    if (!_coupleId) return [];

    const rows = await cdQuery('prompt_answer', {
      limit,
      filter: (q) => {
        let query = q;
        if (dk) query = query.eq('value->>dateKey', dk);
        if (promptId) query = query.eq('value->>promptId', promptId);
        return query;
      },
    });

    // Pair up my answers with partner's answers for the same prompt+date
    const sourceRows = rows.length ? rows : await loadCache(CACHE_SCOPES.prompts);
    const myRows = sourceRows.filter(r => (r.created_by || r.user_id) === _userId);
    const partnerRows = sourceRows.filter(r => (r.created_by || r.user_id) !== _userId);

    return Promise.all(myRows.map(r => {
      const partner = partnerRows.find(p =>
        (p.value?.promptId || p.prompt_id) === (r.value?.promptId || r.prompt_id)
        && (p.value?.dateKey || p.date_key) === (r.value?.dateKey || r.date_key)
      ) || null;
      return r.value ? mapPromptRow(r, partner) : r;
    }));
  },

  async getPromptAnswerForToday(promptId) {
    const dk = dateKey();
    const row = await this._findPromptAnswer(promptId, dk, _userId);
    if (!row) {
      const cached = await loadCache(CACHE_SCOPES.prompts);
      return cached.find((entry) => entry?.prompt_id === promptId && entry?.date_key === dk && entry?.user_id === _userId) || null;
    }
    // Also look for partner's answer to attach it
    const partnerRow = await this._findPartnerPromptAnswer(promptId, dk);
    return mapPromptRow(row, partnerRow);
  },

  async _findPromptAnswer(promptId, dk, userId) {
    const sb = getSupabaseOrNull();
    if (!sb || !_coupleId) return null;
    const { data } = await sb
      .from(TABLES.COUPLE_DATA)
      .select('*')
      .eq('couple_id', _coupleId)
      .eq('data_type', 'prompt_answer')
      .eq('created_by', userId)
      .eq('value->>promptId', promptId)
      .eq('value->>dateKey', dk)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .maybeSingle();
    return data || null;
  },

  async _findPartnerPromptAnswer(promptId, dk) {
    const sb = getSupabaseOrNull();
    if (!sb || !_coupleId || !_userId) return null;
    const { data } = await sb
      .from(TABLES.COUPLE_DATA)
      .select('*')
      .eq('couple_id', _coupleId)
      .eq('data_type', 'prompt_answer')
      .neq('created_by', _userId)
      .eq('value->>promptId', promptId)
      .eq('value->>dateKey', dk)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .maybeSingle();
    return data || null;
  },

  // ─── Memories ────────────────────────────────────────────────────────────

  async saveMemory({ content, type = 'moment', mood, isPrivate = false, mediaUri, mimeType, fileName }) {
    const id = makeId('mem');
    let mediaData = null;

    if (mediaUri) {
      mediaData = await uploadMedia({ localUri: mediaUri, mimeType, coupleId: _coupleId });
    }

    const value = {
      content: content || '',
      type,
      mood: mood || null,
      mediaPath: mediaData?.storagePath || null,
      mediaBucket: mediaData?.bucket || null,
      mimeType: mediaData?.mimeType || null,
    };

    return runCloudOperation({
      perform: async () => cdInsert('memory', id, value, { isPrivate: false }),
      onSuccess: async (row) => {
        const mapped = await mapMemoryRow(row);
        await upsertCacheRow(CACHE_SCOPES.memories, mapped);
        if (_coupleId) {
          PartnerNotifications.memorySaved(null, type).catch(() => {});
        }
        return mapped;
      },
      onOffline: async () => {
        const mapped = makeOfflineMemoryRow(id, value, { mediaUri });
        await enqueueOfflineMutation({
          entity: 'memory',
          action: 'insert',
          id,
          payload: value,
        });
        await upsertCacheRow(CACHE_SCOPES.memories, mapped);
        return mapped;
      },
    });
  },

  async getMemories({ type, limit = 100, offset = 0 } = {}) {
    const rows = await cdQuery('memory', {
      limit,
      offset,
      filter: (q) => {
        let query = q.eq('created_by', _userId);
        if (type) query = query.eq('value->>type', type);
        return query;
      },
    });
    if (rows.length) {
      const mapped = await Promise.all(rows.map(r => mapMemoryRow(r)));
      await replaceCache(CACHE_SCOPES.memories, mapped);
      return mapped;
    }
    const cached = await loadCache(CACHE_SCOPES.memories);
    return cached
      .filter((row) => row?.user_id === _userId)
      .filter((row) => !type || row?.type === type)
      .slice(offset, offset + limit);
  },

  async getSharedMemories({ type, limit = 100, offset = 0 } = {}) {
    if (!_coupleId) return [];
    const rows = await cdQuery('memory', {
      limit,
      offset,
      filter: (q) => {
        let query = q;
        if (type) query = query.eq('value->>type', type);
        return query;
      },
    });
    if (rows.length) {
      const mapped = await Promise.all(rows.map(r => mapMemoryRow(r)));
      await replaceCache(CACHE_SCOPES.memories, mapped);
      return mapped;
    }
    const cached = await loadCache(CACHE_SCOPES.memories);
    return cached
      .filter((row) => !type || row?.type === type)
      .slice(offset, offset + limit);
  },

  async deleteMemory(id) {
    return runCloudOperation({
      perform: async () => cdSoftDelete(id),
      onSuccess: async () => {
        await removeCacheRow(CACHE_SCOPES.memories, id);
      },
      onOffline: async () => {
        await enqueueOfflineMutation({ entity: 'memory', action: 'delete', id });
        await removeCacheRow(CACHE_SCOPES.memories, id);
      },
    });
  },

  // ─── Check-ins ───────────────────────────────────────────────────────────

  async saveCheckIn({ mood, intimacy, notes, touch, _createdAt }) {
    const dk = _createdAt ? dateKey(new Date(_createdAt)) : dateKey();
    const id = makeId('chk');
    const value = { mood, intimacy, notes, touch, dateKey: dk };

    // Upsert by replacing any existing check-in for today
    const existing = await this._findCheckInByDate(dk);
    return runCloudOperation({
      perform: async () => (existing ? cdUpdate(existing.id, value) : cdInsert('check_in', id, value)),
      onSuccess: async (row) => {
        const mapped = { ...row, ...(row.value || {}) };
        await upsertCacheRow(CACHE_SCOPES.checkIns, mapped);
        return mapped;
      },
      onOffline: async () => {
        const mapped = makeOfflineCheckInRow(existing?.id || id, value);
        await enqueueOfflineMutation({
          entity: 'check_in',
          action: existing ? 'update' : 'insert',
          id: existing?.id || id,
          payload: value,
        });
        await upsertCacheRow(CACHE_SCOPES.checkIns, mapped);
        return mapped;
      },
    });
  },

  async getCheckIns({ limit = 100, offset = 0 } = {}) {
    const rows = await cdQuery('check_in', {
      limit,
      offset,
      filter: (q) => q.eq('created_by', _userId),
    });
    if (rows.length) {
      const mapped = rows.map(r => ({ ...r, ...(r.value || {}) }));
      await replaceCache(CACHE_SCOPES.checkIns, mapped);
      return mapped;
    }
    const cached = await loadCache(CACHE_SCOPES.checkIns);
    return cached.filter((row) => row?.user_id === _userId).slice(offset, offset + limit);
  },

  async getCheckInForToday() {
    const row = await this._findCheckInByDate(dateKey());
    if (!row) {
      const cached = await loadCache(CACHE_SCOPES.checkIns);
      return cached.find((entry) => entry?.dateKey === dateKey()) || null;
    }
    const mapped = { ...row, ...(row.value || {}) };
    await upsertCacheRow(CACHE_SCOPES.checkIns, mapped);
    return mapped;
  },

  async _findCheckInByDate(dk) {
    const sb = getSupabaseOrNull();
    if (!sb || !_coupleId) return null;
    const { data } = await sb
      .from(TABLES.COUPLE_DATA)
      .select('*')
      .eq('couple_id', _coupleId)
      .eq('data_type', 'check_in')
      .eq('created_by', _userId)
      .eq('value->>dateKey', dk)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .maybeSingle();
    return data || null;
  },

  // ─── Vibes ───────────────────────────────────────────────────────────────

  async saveVibe({ vibe, note, _createdAt }) {
    const id = makeId('vibe');
    const value = { vibe, note: note || null };
    return runCloudOperation({
      perform: async () => cdInsert('vibe', id, value),
      onSuccess: async (row) => {
        const mapped = { ...row, ...(row.value || {}) };
        await upsertCacheRow(CACHE_SCOPES.vibes, mapped);
        return mapped;
      },
      onOffline: async () => {
        const mapped = makeOfflineVibeRow(id, value);
        await enqueueOfflineMutation({ entity: 'vibe', action: 'insert', id, payload: value });
        await upsertCacheRow(CACHE_SCOPES.vibes, mapped);
        return mapped;
      },
    });
  },

  async getVibes({ limit = 100 } = {}) {
    const rows = await cdQuery('vibe', {
      limit,
      filter: (q) => q.eq('created_by', _userId),
    });
    if (rows.length) {
      const mapped = rows.map(r => ({ ...r, ...(r.value || {}) }));
      await replaceCache(CACHE_SCOPES.vibes, mapped);
      return mapped;
    }
    const cached = await loadCache(CACHE_SCOPES.vibes);
    return cached.filter((row) => row?.user_id === _userId).slice(0, limit);
  },

  async getLatestVibe() {
    const sb = getSupabaseOrNull();
    if (!sb || !_coupleId) {
      const cached = await loadCache(CACHE_SCOPES.vibes);
      return cached.find((row) => row?.user_id === _userId) || null;
    }
    const { data } = await sb
      .from(TABLES.COUPLE_DATA)
      .select('*')
      .eq('couple_id', _coupleId)
      .eq('data_type', 'vibe')
      .eq('created_by', _userId)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) {
      const cached = await loadCache(CACHE_SCOPES.vibes);
      return cached.find((row) => row?.user_id === _userId) || null;
    }
    const mapped = { ...data, ...(data.value || {}) };
    await upsertCacheRow(CACHE_SCOPES.vibes, mapped);
    return mapped;
  },

  // ─── Rituals / Love Notes (retired) ─────────────────────────────────────

  async saveRitual() { throw new Error('Rituals are no longer supported'); },
  async getRituals() { return []; },
  async saveLoveNote() { throw new Error('Love Notes are no longer supported'); },
  async getLoveNotes() { return []; },
  async getLoveNote() { return null; },
  async markLoveNoteRead(id) { return { id, skipped: true }; },
  async purgeExpiredLoveNotes() { return undefined; },
  async deleteLoveNote() { return undefined; },
  async getUnreadLoveNoteCount() { return 0; },
  async getLoveNoteImageUri() { return null; },

  // ─── Calendar Events ─────────────────────────────────────────────────────

  async createCalendarEvent(event) {
    const sb = getSupabaseOrNull();
    if (!_coupleId || !_userId) throw new Error('Not configured for calendar');

    const metadata = this._buildCalendarMetadata(event);
    const id = event?.id || randomUUID();
    return runCloudOperation({
      perform: async () => {
        if (!sb) throw new Error('Supabase not configured');
        const { data, error } = await sb
          .from(TABLES.CALENDAR_EVENTS)
          .insert({
            id,
            couple_id: _coupleId,
            title: event?.title?.trim() || '',
            description: event?.notes || null,
            event_date: new Date(event.whenTs).toISOString(),
            event_type: event?.eventType || 'general',
            location: event?.location || null,
            metadata,
            created_by: _userId,
          })
          .select('*')
          .single();
        if (error) throw error;
        return data;
      },
      onSuccess: async (data) => {
        if (event?.isDateNight || event?.eventType === 'dateNight') {
          await this._saveDatePlanForEvent(event, data.id).catch(() => {});
        }
        const mapped = { ...mapCalendarRow(data), remoteSynced: true };
        await upsertCacheRow(CACHE_SCOPES.calendar, mapped, { sortBy: 'whenTs', descending: false });
        PartnerNotifications.calendarEventCreated?.().catch(() => {});
        return mapped;
      },
      onOffline: async () => {
        const mapped = makeOfflineCalendarRow(id, event);
        await enqueueOfflineMutation({ entity: 'calendar', action: 'insert', id, payload: event });
        await upsertCacheRow(CACHE_SCOPES.calendar, mapped, { sortBy: 'whenTs', descending: false });
        if (event?.isDateNight || event?.eventType === 'dateNight') {
          await this.saveDatePlan({
            title: event?.title || '',
            sourceEventId: id,
            locationType: event?.location ? 'out' : 'home',
            heat: 2,
            load: 2,
            style: 'mixed',
            steps: event?.notes ? [event.notes] : ['Plan the vibe.', 'Enjoy the moment.'],
          });
        }
        return mapped;
      },
    });
  },

  async updateCalendarEvent(event) {
    const sb = getSupabaseOrNull();
    const eventId = event?.id;
    if (!eventId) throw new Error('Calendar event id required');

    const metadata = this._buildCalendarMetadata(event);
    return runCloudOperation({
      perform: async () => {
        if (!sb) throw new Error('Supabase not configured');
        const { data, error } = await sb
          .from(TABLES.CALENDAR_EVENTS)
          .update({
            title: event?.title?.trim() || '',
            description: event?.notes || null,
            event_date: new Date(event.whenTs).toISOString(),
            event_type: event?.eventType || 'general',
            location: event?.location || null,
            metadata,
            updated_at: now(),
          })
          .eq('id', eventId)
          .select('*')
          .single();
        if (error) throw error;
        return data;
      },
      onSuccess: async (data) => {
        await this._saveDatePlanForEvent(event, eventId).catch(() => {});
        const mapped = { ...mapCalendarRow(data), remoteSynced: true };
        await upsertCacheRow(CACHE_SCOPES.calendar, mapped, { sortBy: 'whenTs', descending: false });
        return mapped;
      },
      onOffline: async () => {
        const cached = (await loadCache(CACHE_SCOPES.calendar)).find((row) => row?.id === eventId) || {};
        const mapped = makeOfflineCalendarRow(eventId, event, cached);
        await enqueueOfflineMutation({ entity: 'calendar', action: 'update', id: eventId, payload: event });
        await upsertCacheRow(CACHE_SCOPES.calendar, mapped, { sortBy: 'whenTs', descending: false });
        return mapped;
      },
    });
  },

  async getCalendarEvents({ limit = 1000 } = {}) {
    const sb = getSupabaseOrNull();
    if (!sb || !_coupleId) {
      const cached = await loadCache(CACHE_SCOPES.calendar);
      return cached.slice(0, limit);
    }

    const { data, error } = await sb
      .from(TABLES.CALENDAR_EVENTS)
      .select('*')
      .eq('couple_id', _coupleId)
      .order('event_date', { ascending: true })
      .limit(limit);

    if (error) {
      if (__DEV__) console.warn('[SupabaseDataLayer] getCalendarEvents failed:', error?.message);
      const cached = await loadCache(CACHE_SCOPES.calendar);
      return cached.slice(0, limit);
    }
    const mapped = (data || []).map(mapCalendarRow);
    await replaceCache(CACHE_SCOPES.calendar, mapped);
    return mapped;
  },

  async deleteCalendarEvent(id, { deleteRemote = false } = {}) {
    const sb = getSupabaseOrNull();
    await runCloudOperation({
      perform: async () => {
        if (!sb) throw new Error('Supabase not configured');
        const { error } = await sb.from(TABLES.CALENDAR_EVENTS).delete().eq('id', id);
        if (error) throw error;
      },
      onSuccess: async () => {
        await removeCacheRow(CACHE_SCOPES.calendar, id);
      },
      onOffline: async () => {
        await enqueueOfflineMutation({ entity: 'calendar', action: 'delete', id });
        await removeCacheRow(CACHE_SCOPES.calendar, id);
      },
    });

    const cachedPlans = await loadCache(CACHE_SCOPES.datePlans);
    await Promise.all(
      cachedPlans
        .filter((plan) => plan?.sourceEventId === id)
        .map((plan) => this.deleteDatePlan(plan.id))
    );
  },

  async refreshCalendarEventsFromRemote({ limit = 5000 } = {}) {
    return this.getCalendarEvents({ limit });
  },

  async healLegacyCalendarDeletes() { return 0; },
  async pushPendingCalendarEvents() { return { pushed: 0, deleted: 0, failed: 0 }; },

  subscribeCalendarEvents(onChange) {
    const sb = getSupabaseOrNull();
    if (!sb || !_coupleId) return () => {};

    if (_calendarChannel) {
      try { sb.removeChannel(_calendarChannel); } catch {}
      _calendarChannel = null;
    }

    _calendarChannel = sb
      .channel(`calendar_${_coupleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLES.CALENDAR_EVENTS, filter: `couple_id=eq.${_coupleId}` },
        () => { onChange?.(); }
      )
      .subscribe();

    return () => {
      if (_calendarChannel && sb) {
        try { sb.removeChannel(_calendarChannel); } catch {}
        _calendarChannel = null;
      }
    };
  },

  _buildCalendarMetadata(event) {
    return {
      ...(event?.metadata || {}),
      isDateNight: !!(event?.isDateNight || event?.eventType === 'dateNight'),
      notify: !!event?.notify,
      notifyMins: Number(event?.notifyMins ?? 60) || 60,
      notificationId: event?.notificationId || null,
    };
  },

  async _saveDatePlanForEvent(event, eventId) {
    if (!(event?.isDateNight || event?.eventType === 'dateNight')) return;
    const existing = await cdQuery('date_plan', {
      filter: (q) => q.eq('value->>sourceEventId', eventId),
    });
    const plan = {
      title: event?.title || '',
      sourceEventId: eventId,
      locationType: event?.location ? 'out' : 'home',
      heat: 2,
      load: 2,
      style: 'mixed',
      steps: event?.notes ? [event.notes] : ['Plan the vibe.', 'Enjoy the moment.'],
    };
    if (existing?.[0]) {
      await cdUpdate(existing[0].id, plan);
    } else {
      await cdInsert('date_plan', makeId('dp'), plan);
    }
  },

  // ─── Date Plans ──────────────────────────────────────────────────────────

  async saveDatePlan(plan) {
    const id = plan?.id || makeId('dp');
    const value = {
      title: plan?.title || '',
      sourceEventId: plan?.sourceEventId || null,
      locationType: plan?.locationType || 'home',
      heat: plan?.heat ?? 2,
      load: plan?.load ?? 2,
      style: plan?.style || 'mixed',
      steps: Array.isArray(plan?.steps) ? plan.steps : [],
    };
    return runCloudOperation({
      perform: async () => cdUpsert('date_plan', id, value),
      onSuccess: async (row) => {
        const mapped = mapDatePlanRow(row);
        await upsertCacheRow(CACHE_SCOPES.datePlans, mapped);
        return mapped;
      },
      onOffline: async () => {
        const mapped = makeOfflineDatePlanRow(id, plan);
        await enqueueOfflineMutation({ entity: 'date_plan', action: 'upsert', id, payload: value });
        await upsertCacheRow(CACHE_SCOPES.datePlans, mapped);
        return mapped;
      },
    });
  },

  async getDatePlans({ limit = 1000 } = {}) {
    const rows = await cdQuery('date_plan', { limit });
    if (rows.length) {
      const mapped = rows.map(mapDatePlanRow);
      await replaceCache(CACHE_SCOPES.datePlans, mapped);
      return mapped;
    }
    const cached = await loadCache(CACHE_SCOPES.datePlans);
    return cached.slice(0, limit);
  },

  async deleteDatePlan(id) {
    return runCloudOperation({
      perform: async () => cdSoftDelete(id),
      onSuccess: async () => {
        await removeCacheRow(CACHE_SCOPES.datePlans, id);
      },
      onOffline: async () => {
        await enqueueOfflineMutation({ entity: 'date_plan', action: 'delete', id });
        await removeCacheRow(CACHE_SCOPES.datePlans, id);
      },
    });
  },

  // ─── Attachments ─────────────────────────────────────────────────────────

  async addAttachment({ sourceUri, mimeType, coupleId }) {
    const cid = coupleId || _coupleId;
    const result = await uploadMedia({ localUri: sourceUri, mimeType, coupleId: cid });
    if (!result) throw new Error('Attachment upload failed');
    return { id: result.storagePath, ...result };
  },

  async getDecryptedAttachment(storagePath) {
    // For the cloud-first layer, find the bucket by prefix convention
    const bucket = storagePath?.endsWith('.mov') || storagePath?.endsWith('.mp4')
      ? VIDEO_BUCKET
      : IMAGE_BUCKET;
    return getSignedMediaUrl(bucket, storagePath);
  },

  async deleteAttachment(storagePath) {
    const sb = getSupabaseOrNull();
    if (!sb || !storagePath) return;
    const bucket = storagePath?.endsWith('.mov') || storagePath?.endsWith('.mp4')
      ? VIDEO_BUCKET
      : IMAGE_BUCKET;
    await sb.storage.from(bucket).remove([storagePath]).catch(() => {});
  },

  // ─── Sync stubs (no-ops — everything is cloud-first) ─────────────────────

  async flushOfflineQueue() {
    if (_isFlushingQueue || !_userId || !_coupleId || !supabase) return { flushed: 0, remaining: 0 };
    _isFlushingQueue = true;
    let flushed = 0;
    try {
      const queue = await getOfflineQueue();
      const remaining = [];

      for (const item of queue) {
        try {
          switch (item.entity) {
            case 'journal':
              if (item.action === 'insert') await cdInsert('journal', item.id, item.payload);
              if (item.action === 'update') await cdUpdate(item.id, item.payload);
              if (item.action === 'delete') await cdSoftDelete(item.id);
              break;
            case 'prompt_answer':
              if (item.action === 'insert') await cdInsert('prompt_answer', item.id, item.payload);
              if (item.action === 'update') await cdUpdate(item.id, item.payload);
              break;
            case 'memory':
              if (item.action === 'insert') await cdInsert('memory', item.id, item.payload);
              if (item.action === 'delete') await cdSoftDelete(item.id);
              break;
            case 'check_in':
              if (item.action === 'insert') await cdInsert('check_in', item.id, item.payload);
              if (item.action === 'update') await cdUpdate(item.id, item.payload);
              break;
            case 'vibe':
              if (item.action === 'insert') await cdInsert('vibe', item.id, item.payload);
              break;
            case 'calendar':
              if (item.action === 'insert') await this.createCalendarEvent({ ...item.payload, id: item.id });
              if (item.action === 'update') await this.updateCalendarEvent({ ...item.payload, id: item.id });
              if (item.action === 'delete') {
                const { error } = await supabase.from(TABLES.CALENDAR_EVENTS).delete().eq('id', item.id);
                if (error) throw error;
              }
              break;
            case 'date_plan':
              if (item.action === 'upsert') await cdUpsert('date_plan', item.id, item.payload);
              if (item.action === 'delete') await cdSoftDelete(item.id);
              break;
            default:
              break;
          }
          flushed += 1;
        } catch (error) {
          remaining.push(item);
          if (!isOfflineCapableError(error)) {
            if (__DEV__) console.warn('[SupabaseDataLayer] Queue flush failed:', error?.message);
          }
        }
      }

      await setOfflineQueue(remaining);
      return { flushed, remaining: remaining.length };
    } finally {
      _isFlushingQueue = false;
    }
  },
  async sync() { return this.flushOfflineQueue(); },
  async pullNow() { return this.flushOfflineQueue(); },
  subscribeRealtime() { return () => {}; },
  onSyncEvent() { return () => {}; },
  async purgeOldData() { return null; },
  async clearCache() { return null; },

  // ─── Legacy migration (SQLite → Supabase) ────────────────────────────────
  //
  // Called once at app startup for users who have local SQLite data.
  // Decrypts each row and writes it to Supabase couple_data.
  // Safe to re-run — existing Supabase rows are skipped via upsert.

  async migrateLegacyStorage() {
    const { storage } = await import('../../utils/storage');
    const markerKey = `@betweenus:supabaseMigrated:${_userId}`;
    const alreadyMigrated = await storage.get(markerKey, false);

    if (alreadyMigrated) {
      return { skipped: true };
    }

    let migrated = 0;
    let failed = 0;

    try {
      // Dynamically import SQLite layer — it may not exist in future
      const { default: Database } = await import('../db/Database').catch(() => ({ default: null }));

      if (!Database || !_coupleId || !_userId) {
        await storage.set(markerKey, true);
        return { skipped: true, reason: 'dependencies_unavailable' };
      }

      const sb = getSupabaseOrNull();
      if (!sb) {
        return { skipped: true, reason: 'supabase_unavailable' };
      }

      // ── Journal entries ──────────────────────────────────────────────────
      try {
        const jRows = await Database.getJournals(_userId, { limit: 500 });
        for (const row of jRows || []) {
          try {
            // E2EE is removed; we cannot decrypt old blobs here anymore.
            // A dedicated migration script should have run before removal.
            const title = 'Archived Journal (Encryption Removed)';
            const body = 'This entry was archived before the app moved to a cloud-first architecture.';
            const mood = row.mood || null;

            const value = { title, body, mood, tags: [], photoUri: row.photo_uri || null, mediaPath: null };
            await sb.from(TABLES.COUPLE_DATA).upsert({
              id: row.id,
              couple_id: _coupleId,
              key: row.id,
              value,
              data_type: 'journal',
              created_by: row.user_id || _userId,
              is_private: false,
              created_at: row.created_at || now(),
              updated_at: row.updated_at || now(),
            }, { onConflict: 'id', ignoreDuplicates: true });
            migrated++;
          } catch { failed++; }
        }
      } catch (e) {
        if (__DEV__) console.warn('[SupabaseDataLayer] Journal migration failed:', e?.message);
      }

      // ── Prompt answers ───────────────────────────────────────────────────
      try {
        const pRows = await Database.getPromptAnswers(_userId, { limit: 500 });
        for (const row of pRows || []) {
          try {
            // E2EE is removed.
            const answer = 'Archived Answer';

            const value = {
              promptId: row.prompt_id,
              dateKey: row.date_key,
              answer,
              heatLevel: row.heat_level || 1,
              isRevealed: !!row.is_revealed,
              revealAt: row.reveal_at || null,
            };
            await sb.from(TABLES.COUPLE_DATA).upsert({
              id: row.id,
              couple_id: _coupleId,
              key: row.id,
              value,
              data_type: 'prompt_answer',
              created_by: row.user_id || _userId,
              is_private: false,
              created_at: row.created_at || now(),
              updated_at: row.updated_at || now(),
            }, { onConflict: 'id', ignoreDuplicates: true });
            migrated++;
          } catch { failed++; }
        }
      } catch (e) {
        if (__DEV__) console.warn('[SupabaseDataLayer] Prompt migration failed:', e?.message);
      }

      // ── Memories ─────────────────────────────────────────────────────────
      try {
        const mRows = await Database.getMemories(_userId, { limit: 500 });
        for (const row of mRows || []) {
          try {
            // E2EE is removed.
            const content = 'Archived Memory';

            const value = {
              content,
              type: row.type || 'moment',
              mood: row.mood || null,
              mediaPath: null, // encrypted blobs can't be trivially migrated
              mediaBucket: null,
              mimeType: null,
            };
            await sb.from(TABLES.COUPLE_DATA).upsert({
              id: row.id,
              couple_id: _coupleId,
              key: row.id,
              value,
              data_type: 'memory',
              created_by: row.user_id || _userId,
              is_private: false,
              created_at: row.created_at || now(),
              updated_at: row.updated_at || now(),
            }, { onConflict: 'id', ignoreDuplicates: true });
            migrated++;
          } catch { failed++; }
        }
      } catch (e) {
        if (__DEV__) console.warn('[SupabaseDataLayer] Memory migration failed:', e?.message);
      }

      // ── Check-ins ────────────────────────────────────────────────────────
      try {
        const cRows = await Database.getCheckIns(_userId, { limit: 500 });
        for (const row of cRows || []) {
          try {
            // E2EE is removed.
            const body = {};
            const value = { ...body, dateKey: row.date_key };
            await sb.from(TABLES.COUPLE_DATA).upsert({
              id: row.id,
              couple_id: _coupleId,
              key: row.id,
              value,
              data_type: 'check_in',
              created_by: row.user_id || _userId,
              is_private: false,
              created_at: row.created_at || now(),
              updated_at: row.updated_at || now(),
            }, { onConflict: 'id', ignoreDuplicates: true });
            migrated++;
          } catch { failed++; }
        }
      } catch (e) {
        if (__DEV__) console.warn('[SupabaseDataLayer] Check-in migration failed:', e?.message);
      }

      // ── Vibes ────────────────────────────────────────────────────────────
      try {
        const vRows = await Database.getVibes(_userId, { limit: 500 });
        for (const row of vRows || []) {
          try {
            // E2EE is removed.
            const note = null;
            const value = { vibe: row.vibe, note };
            await sb.from(TABLES.COUPLE_DATA).upsert({
              id: row.id,
              couple_id: _coupleId,
              key: row.id,
              value,
              data_type: 'vibe',
              created_by: row.user_id || _userId,
              is_private: false,
              created_at: row.created_at || now(),
              updated_at: row.updated_at || now(),
            }, { onConflict: 'id', ignoreDuplicates: true });
            migrated++;
          } catch { failed++; }
        }
      } catch (e) {
        if (__DEV__) console.warn('[SupabaseDataLayer] Vibe migration failed:', e?.message);
      }

      await storage.set(markerKey, true);
      if (__DEV__) console.log(`[SupabaseDataLayer] Migration complete: ${migrated} rows, ${failed} failed`);
      return { migrated, failed, skipped: false };

    } catch (error) {
      if (__DEV__) console.warn('[SupabaseDataLayer] Migration error:', error?.message);
      return { migrated, failed, skipped: false, error: error?.message };
    }
  },
};

export default SupabaseDataLayer;
