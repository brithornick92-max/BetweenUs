/**
 * SupabaseDataLayer.js — Cloud-first data access layer for Between Us
 *
 * Replaces the old device-database stack with direct
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
 *   • Device persistence is used only for cache and offline mutation queueing.
 */

import { supabase, TABLES } from '../../config/supabase';
import { randomUUID } from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import CrashReporting from '../CrashReporting';
import { getPromptById } from '../../utils/contentLoader';
import { getDailyContentDateKey } from '../../utils/dailyContentDate';
import { loveNoteStorage, storage, STORAGE_KEYS } from '../../utils/storage';

// ─── Module state ────────────────────────────────────────────────────────────

let _userId = null;
let _coupleId = null;
let _calendarChannel = null;
let _isFlushingQueue = false;
const CACHE_FALLBACK = Symbol('CACHE_FALLBACK');
const QUEUE_IN_FLIGHT_TIMEOUT_MS = 2 * 60 * 1000;
const MAX_QUEUE_ATTEMPTS = 5;


// ─── Signed URL cache to prevent connection exhaustion ───────────────────────
const _signedUrlCache = new Map();
const SIGNED_URL_CACHE_TTL = 3000 * 1000; // 50 minutes (URLs expire in 1 hour)
const MAX_CACHE_SIZE = 500; // Prevent memory leaks by limiting cache size

function getCachedSignedUrl(cacheKey) {
  const cached = _signedUrlCache.get(cacheKey);
  if (!cached) return null;
  
  const now = Date.now();
  if (now - cached.timestamp > SIGNED_URL_CACHE_TTL) {
    _signedUrlCache.delete(cacheKey);
    return null;
  }
  
  return cached.url;
}

function setCachedSignedUrl(cacheKey, url) {
  // Prevent unbounded cache growth
  if (_signedUrlCache.size >= MAX_CACHE_SIZE) {
    // Remove oldest entries (first 100)
    const entries = Array.from(_signedUrlCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    entries.slice(0, 100).forEach(([key]) => _signedUrlCache.delete(key));
  }
  
  _signedUrlCache.set(cacheKey, { url, timestamp: Date.now() });
}

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
  return `@betweenus:cache:data:${userId || 'anonymous'}:${scope}`;
}

function makeId() {
  return randomUUID();
}

function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function promptDateKey(date = new Date()) {
  return getDailyContentDateKey(date);
}

function getSupabaseOrNull() {
  return supabase;
}

function isOfflineCapableError(error) {
  const message = String(error?.message || '').toLowerCase();

  return (
    !supabase
    || message.includes('not configured')
    || message.includes('network')
    || message.includes('fetch')
    || message.includes('offline')
    || message.includes('timeout')
    || message.includes('timed out')
    || message.includes('failed to fetch')
    || message.includes('network request failed')
    || message.includes('not paired')
    || message.includes('couple_id is required')
  );
}

function isMissingRowError(error) {
  const message = String(error?.message || '').toLowerCase();

  return (
    error?.code === 'PGRST116'
    || message.includes('0 rows')
    || message.includes('no rows')
    || message.includes('multiple (or no) rows returned')
    || message.includes('json object requested')
  );
}

function normalizeSnapshotIndex(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function normalizeSnapshotCount(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 1;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function getPromptRowId(row) {
  return row?.value?.promptId || row?.prompt_id || row?.promptId || null;
}

function getPromptRowDateKey(row) {
  return row?.value?.dateKey || row?.date_key || row?.dateKey || null;
}

async function getOfflineQueue() {
  return storage.get(offlineQueueKey(_userId), []);
}

async function setOfflineQueue(queue) {
  await storage.set(offlineQueueKey(_userId), Array.isArray(queue) ? queue : []);
}

function normalizeQueueItem(item) {
  const queuedAt = item?.queuedAt || now();

  return {
    mutationId: item?.mutationId || randomUUID(),
    queuedAt,
    status: item?.status || 'pending',
    attempts: Number.isFinite(Number(item?.attempts)) ? Number(item.attempts) : 0,
    lastError: item?.lastError || null,
    inFlightAt: item?.inFlightAt || null,
    updatedAt: item?.updatedAt || queuedAt,
    ...item,
  };
}

function recoverStaleQueueItem(item) {
  const normalized = normalizeQueueItem(item);

  if (normalized.status !== 'in_flight' || !normalized.inFlightAt) {
    return normalized;
  }

  const inFlightAt = new Date(normalized.inFlightAt).getTime();
  const isStale =
    !Number.isFinite(inFlightAt) ||
    Date.now() - inFlightAt > QUEUE_IN_FLIGHT_TIMEOUT_MS;

  if (!isStale) {
    return normalized;
  }

  return {
    ...normalized,
    status: 'pending',
    inFlightAt: null,
    updatedAt: now(),
  };
}

async function enqueueOfflineMutation(mutation) {
  const queue = await getOfflineQueue();

  queue.push(normalizeQueueItem({
    mutationId: randomUUID(),
    queuedAt: now(),
    status: 'pending',
    attempts: 0,
    lastError: null,
    inFlightAt: null,
    updatedAt: now(),
    ...mutation,
  }));

  await setOfflineQueue(queue);
  CrashReporting.addBreadcrumb('sync', 'Queued offline mutation', {
    entity: mutation?.entity,
    action: mutation?.action,
    id: mutation?.id,
  });
}

async function loadCache(scope) {
  return storage.get(cacheKey(_userId, scope), []);
}

async function saveCache(scope, rows) {
  await storage.set(cacheKey(_userId, scope), Array.isArray(rows) ? rows : []);
}

function isPendingCacheRow(row) {
  return (
    row?.sync_status === 'pending'
    || row?.remoteSynced === false
    || row?.isRemote === false
  );
}

async function replaceCache(scope, rows) {
  const incomingRows = Array.isArray(rows) ? rows.filter(Boolean) : [];
  const incomingIds = new Set(incomingRows.map((row) => row?.id).filter(Boolean));
  const cachedRows = await loadCache(scope);
  const pendingRows = (cachedRows || []).filter((row) =>
    row?.id && !incomingIds.has(row.id) && isPendingCacheRow(row)
  );

  const next = [...incomingRows, ...pendingRows];
  await saveCache(scope, next);
  return next;
}

async function replaceCacheSubset(scope, rows, shouldReplaceRow, { sortBy = 'created_at', descending = true } = {}) {
  const incomingRows = Array.isArray(rows) ? rows.filter(Boolean) : [];
  const incomingIds = new Set(incomingRows.map((row) => row?.id).filter(Boolean));
  const cachedRows = await loadCache(scope);

  const retainedRows = (cachedRows || []).filter((row) => {
    if (!row?.id || incomingIds.has(row.id)) return false;
    if (isPendingCacheRow(row)) return true;
    return typeof shouldReplaceRow === 'function' ? !shouldReplaceRow(row) : true;
  });

  const next = [...incomingRows, ...retainedRows];

  next.sort((a, b) => {
    const av = a?.[sortBy] ?? '';
    const bv = b?.[sortBy] ?? '';

    if (av === bv) return 0;

    return descending
      ? String(bv).localeCompare(String(av))
      : String(av).localeCompare(String(bv));
  });

  await saveCache(scope, next);
  return next;
}

async function upsertCacheRow(scope, row, { sortBy = 'created_at', descending = true } = {}) {
  const rows = await loadCache(scope);
  const next = [row, ...rows.filter((item) => item?.id !== row?.id)];

  next.sort((a, b) => {
    const av = a?.[sortBy] ?? '';
    const bv = b?.[sortBy] ?? '';

    if (av === bv) return 0;

    return descending
      ? String(bv).localeCompare(String(av))
      : String(av).localeCompare(String(bv));
  });

  await saveCache(scope, next);
  return row;
}

async function removeCacheRow(scope, id) {
  const rows = await loadCache(scope);
  await saveCache(scope, rows.filter((item) => item?.id !== id));
}

async function runCloudOperation({ perform, onSuccess, onOffline, fallbackOnAnyError = false }) {
  try {
    const result = await perform();
    return onSuccess ? await onSuccess(result) : result;
  } catch (error) {
    if ((!fallbackOnAnyError && !isOfflineCapableError(error)) || !onOffline) throw error;
    return onOffline(error);
  }
}

/**
 * Insert a row into couple_data.
 * `id` becomes both the PK and the `key` so it can be used as a stable
 * client-side identifier and for ON CONFLICT upserts.
 */
async function cdInsert(dataType, id, value) {
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
      is_private: false,
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
async function cdUpsert(dataType, id, value) {
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
      is_private: false,
      updated_at: now(),
    }, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) throw error;

  return data;
}

async function cdSoftDeleteIfExists(id) {
  try {
    await cdSoftDelete(id);
  } catch (error) {
    if (isMissingRowError(error) || String(error?.message || '').includes('No deletable row')) {
      return;
    }
    throw error;
  }
}

/**
 * Update the `value` of an existing couple_data row.
 */
async function cdUpdate(id, valuePatch) {
  const sb = getSupabaseOrNull();

  if (!sb) throw new Error('Supabase is not configured');

  const { data: existingRows, error: fetchError } = await sb
    .from(TABLES.COUPLE_DATA)
    .select('value')
    .eq('id', id)
    .limit(1);

  if (fetchError) throw fetchError;

  const existing = Array.isArray(existingRows) ? existingRows[0] : existingRows;
  if (!existing) throw new Error('No matching row found to update');

  const merged = { ...(existing?.value || {}), ...valuePatch };

  const { data: updatedRows, error } = await sb
    .from(TABLES.COUPLE_DATA)
    .update({ value: merged, is_private: false, updated_at: now() })
    .eq('id', id)
    .select('*')
    .limit(1);

  if (error) throw error;

  const updated = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;
  if (!updated) throw new Error('No matching row found to update');

  return updated;
}

async function cdGetValue(id) {
  const sb = getSupabaseOrNull();

  if (!sb || !id) return null;

  const { data, error } = await sb
    .from(TABLES.COUPLE_DATA)
    .select('value')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;

  return data?.value || null;
}

/**
 * Soft-delete a couple_data row.
 */
async function cdSoftDelete(id) {
  const sb = getSupabaseOrNull();

  if (!sb) throw new Error('Supabase is not configured');

  const { data, error } = await sb
    .from(TABLES.COUPLE_DATA)
    .update({
      is_deleted: true,
      deleted_at: now(),
      updated_at: now(),
    })
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) throw new Error('No deletable row found for this account.');
}

/**
 * Query couple_data rows for the current couple by data_type.
 * Always filters out soft-deleted rows.
 */
async function cdQuery(dataType, { limit = 100, offset = 0, filter } = {}) {
  const sb = getSupabaseOrNull();

  if (!sb) return CACHE_FALLBACK;
  if (!_coupleId) return CACHE_FALLBACK;

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
    if (isOfflineCapableError(error)) {
      if (__DEV__) {
        console.warn(`[SupabaseDataLayer] cdQuery(${dataType}) using cache fallback:`, error?.message);
      }

      return CACHE_FALLBACK;
    }

    throw error;
  }

  return data || [];
}

function isCacheFallback(value) {
  return value === CACHE_FALLBACK;
}

// ─── Media upload helpers ─────────────────────────────────────────────────────

const IMAGE_BUCKET = 'couple-media';
const VIDEO_BUCKET = 'attachments';

/**
 * Upload a local file URI to Supabase Storage.
 * Returns the storage path for use in value.mediaPath.
 */
async function uploadMedia({ localUri, mimeType, coupleId, throwOnError = false }) {
  const sb = getSupabaseOrNull();

  if (!sb || !coupleId) {
    if (throwOnError) {
      throw new Error('Media upload requires a paired account.');
    }

    return null;
  }

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

    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

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
    if (throwOnError) throw err;
    return null;
  }
}

function stripQueueOnlyFields(payload = {}) {
  const { localMediaUri, ...cloudPayload } = payload || {};
  return cloudPayload;
}

async function deleteStoredMedia(bucket, storagePath) {
  const sb = getSupabaseOrNull();

  if (!sb || !bucket || !storagePath) return;

  try {
    await sb.storage.from(bucket).remove([storagePath]);
  } catch (err) {
    if (__DEV__) console.warn('[SupabaseDataLayer] Media cleanup failed:', err?.message);
  }
}

async function deleteUploadedMedia(mediaData) {
  if (!mediaData?.bucket || !mediaData?.storagePath) return;
  await deleteStoredMedia(mediaData.bucket, mediaData.storagePath);
}

async function deleteStoredMediaFromValue(value) {
  if (!value?.mediaBucket || !value?.mediaPath) return;
  await deleteStoredMedia(value.mediaBucket, value.mediaPath);
}

async function prepareQueuedPayloadForCloud(payload = {}) {
  const cleanPayload = stripQueueOnlyFields(payload);

  if (!payload?.localMediaUri || cleanPayload.mediaPath) {
    return cleanPayload;
  }

  const mediaData = await uploadMedia({
    localUri: payload.localMediaUri,
    mimeType: cleanPayload.mimeType,
    coupleId: _coupleId,
    throwOnError: true,
  });

  const next = {
    ...cleanPayload,
    mediaPath: mediaData.storagePath,
    mediaBucket: mediaData.bucket,
    mimeType: mediaData.mimeType || cleanPayload.mimeType || null,
  };

  if (hasOwn(cleanPayload, 'photoUri')) {
    next.photoUri = null;
  }

  return next;
}

async function performQueuedCoupleDataMutation(dataType, item) {
  const payload = await prepareQueuedPayloadForCloud(item.payload);

  try {
    if (item.action === 'insert') await cdUpsert(dataType, item.id, payload);
    if (item.action === 'update') await cdUpdate(item.id, payload);
  } catch (error) {
    if (item.payload?.localMediaUri && payload?.mediaPath) {
      await deleteStoredMedia(payload.mediaBucket, payload.mediaPath);
    }

    throw error;
  }
}

async function upsertQueuedCalendarEvent(event, id) {
  const sb = getSupabaseOrNull();

  if (!sb) throw new Error('Supabase not configured');
  if (!_coupleId || !_userId) throw new Error('Not configured for calendar');

  const metadata = SupabaseDataLayer._buildCalendarMetadata(event);
  const { data, error } = await sb
    .from(TABLES.CALENDAR_EVENTS)
    .upsert({
      id,
      couple_id: _coupleId,
      title: event?.title?.trim() || '',
      description: event?.notes || null,
      event_date: new Date(event?.whenTs).toISOString(),
      event_type: event?.eventType || 'general',
      location: event?.location || null,
      metadata,
      created_by: _userId,
      updated_at: now(),
    }, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function deleteQueuedCalendarEvent(id) {
  const sb = getSupabaseOrNull();

  if (!sb) throw new Error('Supabase not configured');

  const { error } = await sb
    .from(TABLES.CALENDAR_EVENTS)
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Get a short-lived signed URL for a stored media file.
 * Caches URLs to prevent database connection exhaustion.
 */
async function getSignedMediaUrl(bucket, storagePath, expiresIn = 3600) {
  const sb = getSupabaseOrNull();

  if (!sb || !storagePath) return null;

  // Check cache first
  const cacheKey = `${bucket}:${storagePath}`;
  const cached = getCachedSignedUrl(cacheKey);
  if (cached) return cached;

  try {
    const { data, error } = await sb.storage
      .from(bucket)
      .createSignedUrl(storagePath, expiresIn);

    if (error) throw error;

    const signedUrl = data?.signedUrl || null;
    if (signedUrl) {
      setCachedSignedUrl(cacheKey, signedUrl);
    }
    return signedUrl;
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
    is_private: false,
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
  const isRevealed = !!(v.isRevealed || pv?.isRevealed);

  return {
    id: row.id,
    user_id: row.created_by,
    couple_id: row.couple_id,
    prompt_id: v.promptId,
    date_key: v.dateKey,
    answer: v.answer || null,
    partnerAnswer: pv?.answer || v.partnerAnswer || null,
    heat_level: typeof promptHeat === 'number' ? promptHeat : (v.heatLevel ?? 1),
    is_revealed: isRevealed,
    reveal_at: v.revealAt || pv?.revealAt || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapPartnerOnlyPromptRow(partnerRow) {
  if (!partnerRow) return null;

  const v = partnerRow.value || {};
  const promptHeat = getPromptById(v.promptId)?.heat;

  return {
    id: null,
    user_id: _userId,
    couple_id: partnerRow.couple_id,
    prompt_id: v.promptId,
    date_key: v.dateKey,
    answer: null,
    partnerAnswer: v.answer || null,
    heat_level: typeof promptHeat === 'number' ? promptHeat : (v.heatLevel ?? 1),
    is_revealed: !!v.isRevealed,
    reveal_at: v.revealAt || null,
    created_at: partnerRow.created_at,
    updated_at: partnerRow.updated_at,
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
    is_private: false,
    media_ref: v.mediaPath || null,
    mime_type: v.mimeType || null,
    mediaUri,

    // Grouped Snapshot metadata
    snapshot_id: v.snapshot_id || null,
    snapshot_index: normalizeSnapshotIndex(v.snapshot_index),
    snapshot_count: normalizeSnapshotCount(v.snapshot_count),
    snapshot_created_at: v.snapshot_created_at || null,

    occurred_at: v.occurred_at || null,
    created_at: v.occurred_at || row.created_at,
    updated_at: row.updated_at,
  };
}

function mapCalendarRow(row) {
  if (!row) return null;

  const isDateNight = row.event_type === 'dateNight'
    || row.event_type === 'date_night'
    || !!row.metadata?.isDateNight;

  return {
    id: row.id,
    title: row.title || '',
    location: row.location || '',
    notes: row.description || '',
    eventType: isDateNight ? 'dateNight' : (row.event_type || 'general'),
    isDateNight,
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
  const photoUri = hasOwn(value, 'photoUri') ? value.photoUri : (base.photo_uri || null);
  const mediaRef = hasOwn(value, 'mediaPath') ? value.mediaPath : (base.mediaRef || null);
  const mediaType = hasOwn(value, 'mimeType') ? value.mimeType : (base.mediaType || null);
  const localMediaUri = value.localMediaUri || null;
  const mediaUri = localMediaUri || photoUri || (mediaRef ? (base.mediaUri || null) : null);

  return {
    id,
    user_id: _userId,
    couple_id: _coupleId,
    title: value.title || '',
    body: value.body || '',
    mood: value.mood || null,
    tags: value.tags || [],
    is_private: false,
    photo_uri: photoUri || null,
    mediaRef: mediaRef || null,
    mediaUri,
    mediaType: mediaType || null,
    mediaKind: (mediaType || '').startsWith('video/')
      ? 'video'
      : (mediaUri || mediaRef ? 'image' : null),
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

    // Grouped Snapshot metadata
    snapshot_id: value.snapshot_id || null,
    snapshot_index: normalizeSnapshotIndex(value.snapshot_index),
    snapshot_count: normalizeSnapshotCount(value.snapshot_count),
    snapshot_created_at: value.snapshot_created_at || null,

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
  const isDateNight = !!(event?.isDateNight || event?.eventType === 'dateNight' || event?.eventType === 'date_night');

  return {
    id,
    title: event?.title || '',
    location: event?.location || '',
    notes: event?.notes || '',
    eventType: isDateNight ? 'dateNight' : (event?.eventType || 'general'),
    isDateNight,
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

  getCurrentUserId() {
    return _userId;
  },

  async reset() {
    const sb = getSupabaseOrNull();

    if (_calendarChannel && sb) {
      try {
        sb.removeChannel(_calendarChannel);
      } catch {}

      _calendarChannel = null;
    }

    _userId = null;
    _coupleId = null;
    _isFlushingQueue = false;
    _signedUrlCache.clear();
  },

  canWriteForCouple() {
    return !!_coupleId;
  },

  needsReconnect() {
    return false;
  },

  async getCoupleStateStatus() {
    return {
      coupleId: _coupleId,
      status: _coupleId ? 'paired' : 'unpaired',
    };
  },

  // ─── Journal ────────────────────────────────────────────────────────────

  async saveJournalEntry({ title, body, mood, tags, imageUri = null, mediaUri, mimeType }) {
    const id = makeId('jrn');

    const buildValue = (mediaData = null, { includeLocalMedia = false } = {}) => ({
      title: title || '',
      body: body || '',
      mood: mood || null,
      tags: tags || [],
      photoUri: mediaData ? null : (imageUri || null),
      mediaPath: mediaData?.storagePath || null,
      mediaBucket: mediaData?.bucket || null,
      mimeType: mediaData?.mimeType || mimeType || null,
      ...(includeLocalMedia && mediaUri ? { localMediaUri: mediaUri } : {}),
    });

    return runCloudOperation({
      perform: async () => {
        const mediaData = mediaUri
          ? await uploadMedia({
            localUri: mediaUri,
            mimeType,
            coupleId: _coupleId,
            throwOnError: true,
          })
          : null;
        const value = buildValue(mediaData);

        try {
          return await cdInsert('journal', id, value);
        } catch (error) {
          await deleteUploadedMedia(mediaData);
          throw error;
        }
      },
      onSuccess: async (row) => {
        const mapped = await mapJournalRow(row);
        await upsertCacheRow(CACHE_SCOPES.journals, mapped);
        return mapped;
      },
      onOffline: async () => {
        const value = buildValue(null, { includeLocalMedia: true });
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
      fallbackOnAnyError: true,
    });
  },

  async updateJournalEntry(id, { title, body, mood, tags, imageUri, mediaUri, mimeType }) {
    const basePatch = {};

    if (title !== undefined) basePatch.title = title;
    if (body !== undefined) basePatch.body = body;
    if (mood !== undefined) basePatch.mood = mood;
    if (tags !== undefined) basePatch.tags = tags;

    const buildOfflinePatch = () => {
      const patch = { ...basePatch };

      if (mediaUri !== undefined) {
        if (mediaUri) {
          patch.mediaPath = null;
          patch.mediaBucket = null;
          patch.mimeType = mimeType || null;
          patch.photoUri = null;
          patch.localMediaUri = mediaUri;
        } else {
          patch.mediaPath = null;
          patch.mediaBucket = null;
          patch.mimeType = null;
          patch.photoUri = null;
        }
      }

      if (imageUri !== undefined) {
        patch.photoUri = imageUri || null;
        patch.mediaPath = null;
        patch.mediaBucket = null;
        patch.mimeType = null;
        delete patch.localMediaUri;
      }

      return patch;
    };

    const buildCloudPatch = async () => {
      const patch = { ...basePatch };
      let mediaData = null;

      if (mediaUri) {
        mediaData = await uploadMedia({
          localUri: mediaUri,
          mimeType,
          coupleId: _coupleId,
          throwOnError: true,
        });
        patch.mediaPath = mediaData.storagePath;
        patch.mediaBucket = mediaData.bucket;
        patch.mimeType = mediaData.mimeType;
        patch.photoUri = null;
      } else if (mediaUri === null) {
        patch.mediaPath = null;
        patch.mediaBucket = null;
        patch.mimeType = null;
        patch.photoUri = null;
      }

      if (imageUri !== undefined) {
        patch.photoUri = imageUri || null;
        patch.mediaPath = null;
        patch.mediaBucket = null;
        patch.mimeType = null;
      }

      return { patch, mediaData };
    };

    const replacesMedia = mediaUri !== undefined || imageUri !== undefined;

    return runCloudOperation({
      perform: async () => {
        if (!_coupleId) throw new Error('Not paired — couple_id is required for shared data');

        const previousValue = replacesMedia ? await cdGetValue(id).catch(() => null) : null;
        const { patch, mediaData } = await buildCloudPatch();

        try {
          const row = await cdUpdate(id, patch);

          if (
            previousValue?.mediaPath
            && previousValue.mediaPath !== patch.mediaPath
          ) {
            deleteStoredMediaFromValue(previousValue).catch(() => {});
          }

          return row;
        } catch (error) {
          await deleteUploadedMedia(mediaData);
          throw error;
        }
      },
      onSuccess: async (row) => {
        const mapped = await mapJournalRow(row);
        await upsertCacheRow(CACHE_SCOPES.journals, mapped);
        return mapped;
      },
      onOffline: async () => {
        const patch = buildOfflinePatch();
        const existing = await this.getJournalEntry(id);
        const hasPatch = (key) => hasOwn(patch, key);
        const shouldPreservePendingLocalMedia =
          !hasPatch('mediaPath')
          && !hasPatch('photoUri')
          && existing?.sync_status === 'pending'
          && !!existing?.mediaUri
          && !existing?.mediaRef
          && !existing?.photo_uri;

        const mapped = makeOfflineJournalRow(id, {
          title: patch.title ?? existing?.title ?? '',
          body: patch.body ?? existing?.body ?? '',
          mood: patch.mood ?? existing?.mood ?? null,
          tags: patch.tags ?? existing?.tags ?? [],
          photoUri: hasPatch('photoUri') ? patch.photoUri : (existing?.photo_uri ?? null),
          mediaPath: hasPatch('mediaPath') ? patch.mediaPath : (existing?.mediaRef ?? null),
          mimeType: hasPatch('mimeType') ? patch.mimeType : (existing?.mediaType ?? null),
          localMediaUri: hasPatch('localMediaUri')
            ? patch.localMediaUri
            : (shouldPreservePendingLocalMedia ? existing.mediaUri : null),
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
      fallbackOnAnyError: true,
    });
  },

  async deleteJournalEntry(id) {
    return runCloudOperation({
      perform: async () => {
        if (!_coupleId) throw new Error('Not paired — couple_id is required for shared data');

        const previousValue = await cdGetValue(id).catch(() => null);
        await cdSoftDelete(id);
        deleteStoredMediaFromValue(previousValue).catch(() => {});
      },
      onSuccess: async () => {
        await removeCacheRow(CACHE_SCOPES.journals, id);
      },
      onOffline: async () => {
        await enqueueOfflineMutation({ entity: 'journal', action: 'delete', id });
        await removeCacheRow(CACHE_SCOPES.journals, id);
      },
      fallbackOnAnyError: true,
    });
  },

  async getJournalEntries({ limit = 50, offset = 0, mood, visibility } = {}) {
    const shouldReadShared = !!_coupleId && visibility !== 'owned';

    const rows = await cdQuery('journal', {
      limit,
      offset,
      filter: (q) => {
        let query = q;

        if (!shouldReadShared) {
          query = query.eq('created_by', _userId);
        }

        if (mood) query = query.eq('value->>mood', mood);

        return query;
      },
    });

    if (!isCacheFallback(rows)) {
      const mapped = await Promise.all(rows.map((r) => mapJournalRow(r)));
      return replaceCacheSubset(CACHE_SCOPES.journals, mapped, (row) =>
        (_coupleId && visibility !== 'owned') || row?.user_id === _userId
      );
    }

    const cached = await loadCache(CACHE_SCOPES.journals);

    return cached
      .filter((row) => (_coupleId && visibility !== 'owned') || row?.user_id === _userId)
      .filter((row) => !mood || row?.mood === mood)
      .slice(offset, offset + limit);
  },

  async getJournalEntry(id) {
    const cached = await loadCache(CACHE_SCOPES.journals);
    const cachedRow = cached.find((row) => row?.id === id);

    if (cachedRow) return cachedRow;

    if (!_coupleId) return null;

    const sb = getSupabaseOrNull();
    if (!sb) return null;

    const { data, error } = await sb
      .from(TABLES.COUPLE_DATA)
      .select('*')
      .eq('id', id)
      .eq('data_type', 'journal')
      .or('is_deleted.is.null,is_deleted.eq.false')
      .maybeSingle();

    if (error || !data) return null;

    const mapped = await mapJournalRow(data);
    if (mapped) await upsertCacheRow(CACHE_SCOPES.journals, mapped);
    return mapped;
  },

  async _getCachedPromptAnswer(promptId, dk, userId) {
    const cached = await loadCache(CACHE_SCOPES.prompts);

    return cached.find((entry) =>
      entry?.prompt_id === promptId
      && entry?.date_key === dk
      && entry?.user_id === userId
    ) || null;
  },

  async _getCachedCheckInByDate(dk) {
    const cached = await loadCache(CACHE_SCOPES.checkIns);
    return cached.find((entry) => entry?.dateKey === dk && entry?.user_id === _userId) || null;
  },

  async _getCachedLatestVibe() {
    const cached = await loadCache(CACHE_SCOPES.vibes);
    return cached.find((row) => row?.user_id === _userId) || null;
  },

  // ─── Prompt Answers ──────────────────────────────────────────────────────

  async savePromptAnswer({ promptId, answer, heatLevel, dateKey: explicitDateKey, _createdAt }) {
    const resolvedHeatLevel = typeof heatLevel === 'number'
      ? heatLevel
      : (getPromptById(promptId)?.heat || 1);

    const dk = explicitDateKey || (_createdAt ? promptDateKey(new Date(_createdAt)) : promptDateKey());

    const found = await this._findPromptAnswer(promptId, dk, _userId);
    const cachedExisting = isCacheFallback(found)
      ? await this._getCachedPromptAnswer(promptId, dk, _userId)
      : null;

    const existing = isCacheFallback(found) ? null : found;

    const value = {
      promptId,
      dateKey: dk,
      answer,
      heatLevel: resolvedHeatLevel,
      isRevealed: existing?.value?.isRevealed ?? cachedExisting?.is_revealed ?? false,
      revealAt: existing?.value?.revealAt ?? cachedExisting?.reveal_at ?? null,
    };

    const id = existing?.id || cachedExisting?.id || makeId('ans');

    return runCloudOperation({
      perform: async () => (existing ? cdUpdate(existing.id, value) : cdInsert('prompt_answer', id, value)),
      onSuccess: async (remoteRow) => {
        const mapped = await mapPromptRow(remoteRow);
        await upsertCacheRow(CACHE_SCOPES.prompts, mapped);
        return mapped;
      },
      onOffline: async () => {
        const pendingId = existing?.id || cachedExisting?.id || id;

        const mapped = makeOfflinePromptRow(pendingId, {
          promptId,
          dateKey: dk,
          answer,
          heatLevel: resolvedHeatLevel,
          ...value,
        }, cachedExisting || {});

        await enqueueOfflineMutation({
          entity: 'prompt_answer',
          action: existing || cachedExisting ? 'update' : 'insert',
          id: pendingId,
          payload: value,
        });

        await upsertCacheRow(CACHE_SCOPES.prompts, mapped);
        return mapped;
      },
      fallbackOnAnyError: true,
    });
  },

  async revealPromptAnswer(id) {
    const patch = { isRevealed: true, revealAt: now() };

    return runCloudOperation({
      perform: async () => {
        if (!_coupleId) throw new Error('Not paired — couple_id is required for shared data');
        return cdUpdate(id, patch);
      },
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

        await enqueueOfflineMutation({
          entity: 'prompt_answer',
          action: 'update',
          id,
          payload: patch,
        });

        await upsertCacheRow(CACHE_SCOPES.prompts, mapped);
        return mapped;
      },
      fallbackOnAnyError: true,
    });
  },

  async deletePromptAnswer(id) {
    if (!id) throw new Error('Prompt answer id is required');

    return runCloudOperation({
      perform: async () => {
        if (!_coupleId) throw new Error('Not paired — couple_id is required for shared data');
        return cdSoftDelete(id);
      },
      onSuccess: async () => {
        await removeCacheRow(CACHE_SCOPES.prompts, id);
      },
      onOffline: async () => {
        await enqueueOfflineMutation({
          entity: 'prompt_answer',
          action: 'delete',
          id,
        });

        await removeCacheRow(CACHE_SCOPES.prompts, id);
      },
      fallbackOnAnyError: true,
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

    if (!isCacheFallback(rows)) {
      const mapped = await Promise.all(rows.map((r) => mapPromptRow(r)));
      return replaceCacheSubset(CACHE_SCOPES.prompts, mapped, (row) =>
        row?.user_id === _userId
        && (!dk || row?.date_key === dk)
        && (!promptId || row?.prompt_id === promptId)
      );
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

    const sourceRows = isCacheFallback(rows) ? await loadCache(CACHE_SCOPES.prompts) : rows;
    const filteredRows = (sourceRows || [])
      .filter((row) => !dk || getPromptRowDateKey(row) === dk)
      .filter((row) => !promptId || getPromptRowId(row) === promptId)
      .slice(0, limit);

    if (!isCacheFallback(rows)) {
      const mapped = await Promise.all(rows.map((r) => mapPromptRow(r)));
      await replaceCacheSubset(CACHE_SCOPES.prompts, mapped, (row) =>
        (!dk || row?.date_key === dk)
        && (!promptId || row?.prompt_id === promptId)
      );
    }

    const myRows = filteredRows.filter((r) => (r.created_by || r.user_id) === _userId);
    const partnerRows = filteredRows.filter((r) => (r.created_by || r.user_id) !== _userId);

    return Promise.all(myRows.map((r) => {
      const partner = partnerRows.find((p) =>
        getPromptRowId(p) === getPromptRowId(r)
        && getPromptRowDateKey(p) === getPromptRowDateKey(r)
      ) || null;

      if (r.value) return mapPromptRow(r, partner);

      return {
        ...r,
        partnerAnswer: partner?.answer || r.partnerAnswer || null,
        is_revealed: !!(r.is_revealed || partner?.is_revealed),
        reveal_at: r.reveal_at || partner?.reveal_at || null,
      };
    }));
  },

  async getPromptAnswerForToday(promptId, explicitDateKey = null) {
    const dk = explicitDateKey || promptDateKey();
    const row = await this._findPromptAnswer(promptId, dk, _userId);

    if (isCacheFallback(row)) {
      return this._getCachedPromptAnswer(promptId, dk, _userId);
    }

    const partnerRow = await this._findPartnerPromptAnswer(promptId, dk);

    if (!row) {
      return isCacheFallback(partnerRow) ? null : mapPartnerOnlyPromptRow(partnerRow);
    }

    return mapPromptRow(row, isCacheFallback(partnerRow) ? null : partnerRow);
  },

  async _findPromptAnswer(promptId, dk, userId) {
    const sb = getSupabaseOrNull();

    if (!sb) return CACHE_FALLBACK;
    if (!_coupleId) return CACHE_FALLBACK;

    const { data, error } = await sb
      .from(TABLES.COUPLE_DATA)
      .select('*')
      .eq('couple_id', _coupleId)
      .eq('data_type', 'prompt_answer')
      .eq('created_by', userId)
      .eq('value->>promptId', promptId)
      .eq('value->>dateKey', dk)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .maybeSingle();

    if (error) {
      if (isOfflineCapableError(error)) return CACHE_FALLBACK;
      if (isMissingRowError(error)) return null;
      throw error;
    }

    return data || null;
  },

  async _findPartnerPromptAnswer(promptId, dk) {
    const sb = getSupabaseOrNull();

    if (!sb) return CACHE_FALLBACK;
    if (!_coupleId || !_userId) return null;

    const { data, error } = await sb
      .from(TABLES.COUPLE_DATA)
      .select('*')
      .eq('couple_id', _coupleId)
      .eq('data_type', 'prompt_answer')
      .neq('created_by', _userId)
      .eq('value->>promptId', promptId)
      .eq('value->>dateKey', dk)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .maybeSingle();

    if (error) {
      if (isOfflineCapableError(error)) return CACHE_FALLBACK;
      if (isMissingRowError(error)) return null;
      throw error;
    }

    return data || null;
  },

  // ─── Memories ────────────────────────────────────────────────────────────

  async saveMemory({
    content,
    type = 'moment',
    mood,
    isPrivate = false,
    mediaUri,
    mimeType,
    snapshot_id = null,
    snapshot_index = null,
    snapshot_count = null,
    snapshot_created_at = null,
  }) {
    const id = makeId('mem');

    const buildValue = (mediaData = null, { includeLocalMedia = false } = {}) => ({
      content: content || '',
      type,
      mood: mood || null,
      mediaPath: mediaData?.storagePath || null,
      mediaBucket: mediaData?.bucket || null,
      mimeType: mediaData?.mimeType || mimeType || null,
      ...(includeLocalMedia && mediaUri ? { localMediaUri: mediaUri } : {}),

      // Grouped Snapshot metadata
      snapshot_id,
      snapshot_index,
      snapshot_count,
      snapshot_created_at,
    });

    return runCloudOperation({
      perform: async () => {
        const mediaData = mediaUri
          ? await uploadMedia({
            localUri: mediaUri,
            mimeType,
            coupleId: _coupleId,
            throwOnError: true,
          })
          : null;
        const value = buildValue(mediaData);

        try {
          return await cdInsert('memory', id, value);
        } catch (error) {
          await deleteUploadedMedia(mediaData);
          throw error;
        }
      },
      onSuccess: async (row) => {
        const mapped = await mapMemoryRow(row);
        await upsertCacheRow(CACHE_SCOPES.memories, mapped);

        return mapped;
      },
      onOffline: async () => {
        const value = buildValue(null, { includeLocalMedia: true });
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
      fallbackOnAnyError: true,
    });
  },

  async getMemories({ type, limit = 100, offset = 0, ownedOnly = false } = {}) {
    if (!_coupleId) {
      const cached = await loadCache(CACHE_SCOPES.memories);

      return cached
        .filter((row) => row?.user_id === _userId)
        .filter((row) => !type || row?.type === type)
        .slice(offset, offset + limit);
    }

    const rows = await cdQuery('memory', {
      limit,
      offset,
      filter: (q) => {
        let query = _coupleId && !ownedOnly ? q : q.eq('created_by', _userId);

        if (type) query = query.eq('value->>type', type);

        return query;
      },
    });

    if (!isCacheFallback(rows)) {
      const mapped = await Promise.all(rows.map((r) => mapMemoryRow(r)));
      return replaceCacheSubset(CACHE_SCOPES.memories, mapped, (row) =>
        ((_coupleId && !ownedOnly) || row?.user_id === _userId)
        && (!type || row?.type === type)
      );
    }

    const cached = await loadCache(CACHE_SCOPES.memories);

    return cached
      .filter((row) => (_coupleId && !ownedOnly) || row?.user_id === _userId)
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

    if (!isCacheFallback(rows)) {
      const mapped = await Promise.all(rows.map((r) => mapMemoryRow(r)));
      return replaceCacheSubset(CACHE_SCOPES.memories, mapped, (row) =>
        !type || row?.type === type
      );
    }

    const cached = await loadCache(CACHE_SCOPES.memories);

    return cached
      .filter((row) => !type || row?.type === type)
      .slice(offset, offset + limit);
  },

  async updateMemory(id, updates = {}) {
    if (!id) throw new Error('Memory id is required');

    const valuePatch = {};
    if ('content' in updates) valuePatch.content = updates.content || '';
    if ('type' in updates) valuePatch.type = updates.type || 'moment';
    if ('moment_type' in updates) valuePatch.type = updates.moment_type || 'moment';
    if ('mood' in updates) valuePatch.mood = updates.mood || null;
    if ('snapshot_id' in updates) valuePatch.snapshot_id = updates.snapshot_id || null;
    if ('snapshot_index' in updates) valuePatch.snapshot_index = updates.snapshot_index ?? null;
    if ('snapshot_count' in updates) valuePatch.snapshot_count = updates.snapshot_count ?? null;
    if ('snapshot_created_at' in updates) valuePatch.snapshot_created_at = updates.snapshot_created_at || null;
    if ('occurred_at' in updates) valuePatch.occurred_at = updates.occurred_at || null;

    const cachedRows = await loadCache(CACHE_SCOPES.memories);
    const cached = cachedRows.find((row) => row?.id === id) || {};
    const cachedUpdate = {
      id,
      user_id: cached.user_id || _userId,
      couple_id: cached.couple_id || _coupleId,
      ...cached,
      ...updates,
      type: valuePatch.type || cached.type || 'moment',
      content: 'content' in valuePatch ? valuePatch.content : (cached.content || ''),
      mood: 'mood' in valuePatch ? valuePatch.mood : (cached.mood || null),
      snapshot_id: 'snapshot_id' in valuePatch ? valuePatch.snapshot_id : (cached.snapshot_id || null),
      snapshot_index: 'snapshot_index' in valuePatch ? normalizeSnapshotIndex(valuePatch.snapshot_index) : normalizeSnapshotIndex(cached.snapshot_index),
      snapshot_count: 'snapshot_count' in valuePatch ? normalizeSnapshotCount(valuePatch.snapshot_count) : normalizeSnapshotCount(cached.snapshot_count),
      snapshot_created_at: 'snapshot_created_at' in valuePatch ? valuePatch.snapshot_created_at : (cached.snapshot_created_at || null),
      occurred_at: 'occurred_at' in valuePatch ? valuePatch.occurred_at : (cached.occurred_at || null),
      created_at: 'occurred_at' in valuePatch ? (valuePatch.occurred_at || cached.created_at) : cached.created_at,
      updated_at: now(),
    };

    return runCloudOperation({
      perform: async () => {
        if (!_coupleId) throw new Error('Not paired — couple_id is required for shared data');
        return cdUpdate(id, valuePatch);
      },
      onSuccess: async (row) => {
        const mapped = await mapMemoryRow(row);
        await upsertCacheRow(CACHE_SCOPES.memories, mapped);
        return mapped;
      },
      onOffline: async () => {
        await enqueueOfflineMutation({
          entity: 'memory',
          action: 'update',
          id,
          payload: valuePatch,
        });

        await upsertCacheRow(CACHE_SCOPES.memories, cachedUpdate);
        return cachedUpdate;
      },
      fallbackOnAnyError: true,
    });
  },

  async deleteMemory(id) {
    return runCloudOperation({
      perform: async () => {
        if (!_coupleId) throw new Error('Not paired — couple_id is required for shared data');

        const previousValue = await cdGetValue(id).catch(() => null);
        await cdSoftDelete(id);
        deleteStoredMediaFromValue(previousValue).catch(() => {});
      },
      onSuccess: async () => {
        await removeCacheRow(CACHE_SCOPES.memories, id);
      },
      onOffline: async () => {
        await enqueueOfflineMutation({
          entity: 'memory',
          action: 'delete',
          id,
        });

        await removeCacheRow(CACHE_SCOPES.memories, id);
      },
      fallbackOnAnyError: true,
    });
  },

  // ─── Check-ins ───────────────────────────────────────────────────────────

  async saveCheckIn({ mood, intimacy, notes, touch, _createdAt }) {
    const dk = _createdAt ? dateKey(new Date(_createdAt)) : dateKey();
    const id = makeId('chk');
    const value = { mood, intimacy, notes, touch, dateKey: dk };

    const found = await this._findCheckInByDate(dk);
    const cachedExisting = isCacheFallback(found) ? await this._getCachedCheckInByDate(dk) : null;
    const existing = isCacheFallback(found) ? null : found;

    return runCloudOperation({
      perform: async () => (existing ? cdUpdate(existing.id, value) : cdInsert('check_in', id, value)),
      onSuccess: async (row) => {
        const mapped = { ...row, ...(row.value || {}) };
        await upsertCacheRow(CACHE_SCOPES.checkIns, mapped);
        return mapped;
      },
      onOffline: async () => {
        const pendingId = existing?.id || cachedExisting?.id || id;
        const mapped = makeOfflineCheckInRow(pendingId, value, cachedExisting || {});

        await enqueueOfflineMutation({
          entity: 'check_in',
          action: existing || cachedExisting ? 'update' : 'insert',
          id: pendingId,
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

    if (!isCacheFallback(rows)) {
      const mapped = rows.map((r) => ({ ...r, ...(r.value || {}) }));
      await replaceCache(CACHE_SCOPES.checkIns, mapped);
      return mapped;
    }

    const cached = await loadCache(CACHE_SCOPES.checkIns);

    return cached
      .filter((row) => row?.user_id === _userId)
      .slice(offset, offset + limit);
  },

  async getCheckInForToday() {
    const dk = dateKey();
    const row = await this._findCheckInByDate(dk);

    if (isCacheFallback(row)) {
      return this._getCachedCheckInByDate(dk);
    }

    if (!row) {
      return null;
    }

    const mapped = { ...row, ...(row.value || {}) };
    await upsertCacheRow(CACHE_SCOPES.checkIns, mapped);
    return mapped;
  },

  async _findCheckInByDate(dk) {
    const sb = getSupabaseOrNull();

    if (!sb) return CACHE_FALLBACK;
    if (!_coupleId) return null;

    const { data, error } = await sb
      .from(TABLES.COUPLE_DATA)
      .select('*')
      .eq('couple_id', _coupleId)
      .eq('data_type', 'check_in')
      .eq('created_by', _userId)
      .eq('value->>dateKey', dk)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .maybeSingle();

    if (error) {
      if (isOfflineCapableError(error)) return CACHE_FALLBACK;
      if (isMissingRowError(error)) return null;
      throw error;
    }

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

        await enqueueOfflineMutation({
          entity: 'vibe',
          action: 'insert',
          id,
          payload: value,
        });

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

    if (!isCacheFallback(rows)) {
      const mapped = rows.map((r) => ({ ...r, ...(r.value || {}) }));
      await replaceCache(CACHE_SCOPES.vibes, mapped);
      return mapped;
    }

    const cached = await loadCache(CACHE_SCOPES.vibes);

    return cached
      .filter((row) => row?.user_id === _userId)
      .slice(0, limit);
  },

  async getLatestVibe() {
    const sb = getSupabaseOrNull();

    if (!sb) {
      return this._getCachedLatestVibe();
    }

    if (!_coupleId) return null;

    const { data, error } = await sb
      .from(TABLES.COUPLE_DATA)
      .select('*')
      .eq('couple_id', _coupleId)
      .eq('data_type', 'vibe')
      .eq('created_by', _userId)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isOfflineCapableError(error)) {
        return this._getCachedLatestVibe();
      }

      if (isMissingRowError(error)) return null;

      throw error;
    }

    if (!data) {
      return null;
    }

    const mapped = { ...data, ...(data.value || {}) };
    await upsertCacheRow(CACHE_SCOPES.vibes, mapped);
    return mapped;
  },

  // ─── Rituals / Love Notes ───────────────────────────────────────────────

  async saveRitual() {
    throw new Error('Rituals are no longer supported');
  },

  async getRituals() {
    return [];
  },

  async saveLoveNote(note = {}) {
    return loveNoteStorage.saveNote(note);
  },

  async getLoveNotes({ limit = 100 } = {}) {
    const notes = await loveNoteStorage.getNotes();
    return notes.slice(0, limit);
  },

  async getLoveNote(id) {
    const notes = await loveNoteStorage.getNotes();
    return notes.find((note) => note?.id === id) || null;
  },

  async markLoveNoteRead(id) {
    await loveNoteStorage.markRead(id);
    return this.getLoveNote(id);
  },

  async purgeExpiredLoveNotes() {
    return undefined;
  },

  async deleteLoveNote(id) {
    return loveNoteStorage.deleteNote(id);
  },

  async getUnreadLoveNoteCount() {
    return loveNoteStorage.getUnreadCount();
  },

  async getLoveNoteImageUri() {
    return null;
  },

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
        await upsertCacheRow(CACHE_SCOPES.calendar, mapped, {
          sortBy: 'whenTs',
          descending: false,
        });

        return mapped;
      },
      onOffline: async () => {
        const mapped = makeOfflineCalendarRow(id, event);

        await enqueueOfflineMutation({
          entity: 'calendar',
          action: 'insert',
          id,
          payload: event,
        });

        await upsertCacheRow(CACHE_SCOPES.calendar, mapped, {
          sortBy: 'whenTs',
          descending: false,
        });

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
        await upsertCacheRow(CACHE_SCOPES.calendar, mapped, {
          sortBy: 'whenTs',
          descending: false,
        });

        return mapped;
      },
      onOffline: async () => {
        const cached = (await loadCache(CACHE_SCOPES.calendar)).find((row) => row?.id === eventId) || {};
        const mapped = makeOfflineCalendarRow(eventId, event, cached);

        await enqueueOfflineMutation({
          entity: 'calendar',
          action: 'update',
          id: eventId,
          payload: event,
        });

        await upsertCacheRow(CACHE_SCOPES.calendar, mapped, {
          sortBy: 'whenTs',
          descending: false,
        });

        return mapped;
      },
    });
  },

  async getCalendarEvents({ limit = 1000 } = {}) {
    const sb = getSupabaseOrNull();

    if (!sb) {
      const cached = await loadCache(CACHE_SCOPES.calendar);
      return cached.slice(0, limit);
    }

    if (!_coupleId) return [];

    const { data, error } = await sb
      .from(TABLES.CALENDAR_EVENTS)
      .select('*')
      .eq('couple_id', _coupleId)
      .order('event_date', { ascending: true })
      .limit(limit);

    if (error) {
      if (isOfflineCapableError(error)) {
        if (__DEV__) {
          console.warn('[SupabaseDataLayer] getCalendarEvents using cache fallback:', error?.message);
        }

        const cached = await loadCache(CACHE_SCOPES.calendar);
        return cached.slice(0, limit);
      }

      throw error;
    }

    const mapped = (data || []).map(mapCalendarRow);
    await replaceCache(CACHE_SCOPES.calendar, mapped);
    return mapped;
  },

  async deleteCalendarEvent(id, { deleteRemote = false, remoteId } = {}) {
    const sb = getSupabaseOrNull();
    const targetId = remoteId || id;

    await runCloudOperation({
      perform: async () => {
        if (!sb) throw new Error('Supabase not configured');

        const { data, error } = await sb
          .from(TABLES.CALENDAR_EVENTS)
          .delete()
          .eq('id', targetId)
          .select('id');

        if (error) {
          const { data: rpcData, error: rpcError } = await sb.rpc('delete_calendar_event_if_member', {
            p_event_id: targetId,
          });

          if (rpcError) throw error;
          if (rpcData !== true) {
            throw new Error('Calendar event could not be deleted. You may not have permission to delete this event.');
          }

          return;
        }

        if (!Array.isArray(data) || data.length === 0) {
          const { data: rpcData, error: rpcError } = await sb.rpc('delete_calendar_event_if_member', {
            p_event_id: targetId,
          });

          if (rpcError) throw rpcError;
          if (rpcData !== true) {
            throw new Error('Calendar event could not be deleted. You may not have permission to delete this event.');
          }
        }
      },
      onSuccess: async () => {
        await removeCacheRow(CACHE_SCOPES.calendar, id);
        if (targetId !== id) await removeCacheRow(CACHE_SCOPES.calendar, targetId);
      },
      onOffline: async () => {
        await enqueueOfflineMutation({
          entity: 'calendar',
          action: 'delete',
          id: targetId,
        });

        await removeCacheRow(CACHE_SCOPES.calendar, id);
        if (targetId !== id) await removeCacheRow(CACHE_SCOPES.calendar, targetId);
      },
    });

    const relatedDatePlanIds = new Set();
    const sourceEventIds = [...new Set([id, targetId].filter(Boolean))];
    const cachedPlans = await loadCache(CACHE_SCOPES.datePlans);

    cachedPlans
      .filter((plan) => sourceEventIds.includes(plan?.sourceEventId))
      .forEach((plan) => {
        if (plan?.id) relatedDatePlanIds.add(plan.id);
      });

    for (const sourceEventId of sourceEventIds) {
      const remotePlans = await cdQuery('date_plan', {
        limit: 50,
        filter: (q) => q.eq('value->>sourceEventId', sourceEventId),
      }).catch(() => []);

      if (Array.isArray(remotePlans)) {
        remotePlans.forEach((plan) => {
          if (plan?.id) relatedDatePlanIds.add(plan.id);
        });
      }
    }

    await Promise.all(
      [...relatedDatePlanIds].map((planId) => this.deleteDatePlan(planId))
    );
  },

  async refreshCalendarEventsFromRemote({ limit = 5000 } = {}) {
    return this.getCalendarEvents({ limit });
  },

  async healLegacyCalendarDeletes() {
    return 0;
  },

  async pushPendingCalendarEvents() {
    return { pushed: 0, deleted: 0, failed: 0 };
  },

  subscribeCalendarEvents(onChange) {
    const sb = getSupabaseOrNull();

    if (!sb || !_coupleId) return () => {};

    if (_calendarChannel) {
      try {
        sb.removeChannel(_calendarChannel);
      } catch {}

      _calendarChannel = null;
    }

    _calendarChannel = sb
      .channel(`calendar_${_coupleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLES.CALENDAR_EVENTS,
          filter: `couple_id=eq.${_coupleId}`,
        },
        () => {
          onChange?.();
        }
      )
      .subscribe();

    return () => {
      if (_calendarChannel && sb) {
        try {
          sb.removeChannel(_calendarChannel);
        } catch {}

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
    const existing = await cdQuery('date_plan', {
      filter: (q) => q.eq('value->>sourceEventId', eventId),
    });

    if (!(event?.isDateNight || event?.eventType === 'dateNight')) {
      if (Array.isArray(existing) && existing[0]) {
        await cdSoftDelete(existing[0].id);
        await removeCacheRow(CACHE_SCOPES.datePlans, existing[0].id);
      }
      return;
    }

    const plan = {
      title: event?.title || '',
      sourceEventId: eventId,
      locationType: event?.location ? 'out' : 'home',
      heat: 2,
      load: 2,
      style: 'mixed',
      steps: event?.notes ? [event.notes] : ['Plan the vibe.', 'Enjoy the moment.'],
    };

    const row = Array.isArray(existing) && existing[0]
      ? await cdUpdate(existing[0].id, plan)
      : await cdInsert('date_plan', makeId('dp'), plan);

    const mapped = mapDatePlanRow(row);
    if (mapped) await upsertCacheRow(CACHE_SCOPES.datePlans, mapped);
    return mapped;
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

        await enqueueOfflineMutation({
          entity: 'date_plan',
          action: 'upsert',
          id,
          payload: value,
        });

        await upsertCacheRow(CACHE_SCOPES.datePlans, mapped);
        return mapped;
      },
    });
  },

  async getDatePlans({ limit = 1000 } = {}) {
    const rows = await cdQuery('date_plan', { limit });

    if (!isCacheFallback(rows)) {
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
        await enqueueOfflineMutation({
          entity: 'date_plan',
          action: 'delete',
          id,
        });

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

  async getAttachmentUrl(storagePath) {
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
    if (_isFlushingQueue || !_userId || !supabase) {
      return { flushed: 0, remaining: 0 };
    }

    if (!_coupleId) {
      const queue = await getOfflineQueue();
      return { flushed: 0, remaining: Array.isArray(queue) ? queue.length : 0 };
    }

    _isFlushingQueue = true;

    let flushed = 0;
    let failed = 0;

    const performQueuedMutation = async (item) => {
      switch (item.entity) {
        case 'journal':
          if (item.action === 'insert' || item.action === 'update') {
            await performQueuedCoupleDataMutation('journal', item);
          }
          if (item.action === 'delete') await cdSoftDeleteIfExists(item.id);
          break;

        case 'prompt_answer':
          if (item.action === 'insert') await cdUpsert('prompt_answer', item.id, item.payload);
          if (item.action === 'update') await cdUpdate(item.id, item.payload);
          if (item.action === 'delete') await cdSoftDeleteIfExists(item.id);
          break;

        case 'memory':
          if (item.action === 'insert' || item.action === 'update') {
            await performQueuedCoupleDataMutation('memory', item);
          }
          if (item.action === 'delete') await cdSoftDeleteIfExists(item.id);
          break;

        case 'check_in':
          if (item.action === 'insert') await cdUpsert('check_in', item.id, item.payload);
          if (item.action === 'update') await cdUpdate(item.id, item.payload);
          break;

        case 'vibe':
          if (item.action === 'insert') await cdUpsert('vibe', item.id, item.payload);
          break;

        case 'calendar':
          if (item.action === 'insert' || item.action === 'update') {
            await upsertQueuedCalendarEvent(item.payload, item.id);
          }
          if (item.action === 'delete') {
            await deleteQueuedCalendarEvent(item.id);
          }
          break;

        case 'date_plan':
          if (item.action === 'upsert') await cdUpsert('date_plan', item.id, item.payload);
          if (item.action === 'delete') await cdSoftDeleteIfExists(item.id);
          break;

        default:
          throw new Error(`Unknown offline mutation entity: ${item.entity || 'missing'}`);
      }
    };

    try {
      let queue = (await getOfflineQueue()).map(recoverStaleQueueItem);
      await setOfflineQueue(queue);

      for (const rawItem of queue) {
        const item = normalizeQueueItem(rawItem);

        if (item.status === 'in_flight') {
          continue;
        }

        const inFlightItem = {
          ...item,
          status: 'in_flight',
          inFlightAt: now(),
          updatedAt: now(),
        };

        queue = queue.map((queued) =>
          queued.mutationId === item.mutationId ? inFlightItem : queued
        );
        await setOfflineQueue(queue);

        try {
          await performQueuedMutation(inFlightItem);

          flushed += 1;
          queue = queue.filter((queued) => queued.mutationId !== item.mutationId);
          await setOfflineQueue(queue);
        } catch (error) {
          failed += 1;

          const attempts = Number(item.attempts || 0) + 1;
          const failedItem = {
            ...item,
            status: attempts >= MAX_QUEUE_ATTEMPTS ? 'failed' : 'pending',
            attempts,
            lastError: error?.message || 'Unknown sync error',
            inFlightAt: null,
            updatedAt: now(),
          };

          queue = queue.map((queued) =>
            queued.mutationId === item.mutationId ? failedItem : queued
          );
          await setOfflineQueue(queue);

          CrashReporting.captureException(error, {
            source: 'supabase_offline_queue_flush',
            entity: item.entity,
            action: item.action,
            mutationId: item.mutationId,
            attempts,
            offlineCapable: isOfflineCapableError(error),
          });

          if (__DEV__) {
            console.warn('[SupabaseDataLayer] Queue flush failed:', error?.message);
          }

          if (isOfflineCapableError(error)) {
            break;
          }
        }
      }

      return {
        flushed,
        failed,
        remaining: queue.length,
      };
    } finally {
      _isFlushingQueue = false;
    }
  },

  async sync() {
    return this.flushOfflineQueue();
  },

  async pullNow() {
    return this.flushOfflineQueue();
  },

  subscribeRealtime() {
    return () => {};
  },

  onSyncEvent() {
    return () => {};
  },

  async purgeOldData() {
    return null;
  },

  async clearCache() {
    return null;
  },

  async migrateLegacyStorage() {
    const { storage: migrationStorage } = await import('../../utils/storage');
    const markerKey = `@betweenus:cache:supabaseMigrated:${_userId}`;
    const alreadyMigrated = await migrationStorage.get(markerKey, false);

    if (alreadyMigrated) {
      return { skipped: true };
    }

    await migrationStorage.set(markerKey, true);
    return { skipped: true, reason: 'legacy_local_storage_removed' };
  },
};

export default SupabaseDataLayer;
