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
 *   • No SQLite, no encryption, no sync queue.
 */

import { supabase, TABLES } from '../../config/supabase';
import { randomUUID } from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import PartnerNotifications from '../PartnerNotifications';
import { getPromptById } from '../../utils/contentLoader';

// ─── Module state ────────────────────────────────────────────────────────────

let _userId = null;
let _coupleId = null;
let _calendarChannel = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const now = () => new Date().toISOString();

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
  const storagePath = `${coupleId}/${fileId}.${ext}`;

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

// ─── Public API ───────────────────────────────────────────────────────────────

const SupabaseDataLayer = {

  // ─── Init ───────────────────────────────────────────────────────────────

  async init({ userId, coupleId, isPremium = false }) {
    _userId = userId;
    _coupleId = coupleId || null;
  },

  async reconfigure({ userId, coupleId, isPremium }) {
    if (userId !== undefined) _userId = userId;
    if (coupleId !== undefined) _coupleId = coupleId || null;

  },

  async reset() {
    const sb = getSupabaseOrNull();
    if (_calendarChannel && sb) {
      try { sb.removeChannel(_calendarChannel); } catch {}
      _calendarChannel = null;
    }
    _userId = null;
    _coupleId = null;
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

    const row = await cdInsert('journal', id, value);
    PartnerNotifications.journalShared().catch(() => {});
    return mapJournalRow(row);
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

    const row = await cdUpdate(id, patch);
    return mapJournalRow(row);
  },

  async deleteJournalEntry(id) {
    await cdSoftDelete(id);
  },

  async getJournalEntries({ limit = 50, offset = 0, mood, visibility } = {}) {
    if (visibility === 'private') return [];
    if (visibility === 'shared' && !_coupleId) return [];

    const rows = await cdQuery('journal', {
      limit,
      offset,
      filter: (q) => {
        let query = q;
        if (visibility === 'shared') {
          // Both partners' entries are visible in shared mode
          query = query;
        } else {
          query = query.eq('created_by', _userId);
        }
        if (mood) {
          query = query.eq('value->>mood', mood);
        }
        return query;
      },
    });

    return Promise.all(rows.map(r => mapJournalRow(r)));
  },

  async getJournalEntry(id) {
    const sb = getSupabaseOrNull();
    if (!sb) return null;
    const { data, error } = await sb
      .from(TABLES.COUPLE_DATA)
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return null;
    return mapJournalRow(data);
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
    if (existing) {
      row = await cdUpdate(existing.id, value);
    } else {
      const id = makeId('ans');
      row = await cdInsert('prompt_answer', id, value);
    }

    return mapPromptRow(row);
  },

  async revealPromptAnswer(id) {
    const row = await cdUpdate(id, { isRevealed: true, revealAt: now() });
    return mapPromptRow(row);
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
    return Promise.all(rows.map(r => mapPromptRow(r)));
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
    const myRows = rows.filter(r => r.created_by === _userId);
    const partnerRows = rows.filter(r => r.created_by !== _userId);

    return Promise.all(myRows.map(r => {
      const partner = partnerRows.find(p =>
        p.value?.promptId === r.value?.promptId && p.value?.dateKey === r.value?.dateKey
      ) || null;
      return mapPromptRow(r, partner);
    }));
  },

  async getPromptAnswerForToday(promptId) {
    const dk = dateKey();
    const row = await this._findPromptAnswer(promptId, dk, _userId);
    if (!row) return null;
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

    const row = await cdInsert('memory', id, value, { isPrivate: false });

    if (_coupleId) {
      PartnerNotifications.memorySaved(null, type).catch(() => {});
    }

    return mapMemoryRow(row);
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
    return Promise.all(rows.map(r => mapMemoryRow(r)));
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
    return Promise.all(rows.map(r => mapMemoryRow(r)));
  },

  async deleteMemory(id) {
    await cdSoftDelete(id);
  },

  // ─── Check-ins ───────────────────────────────────────────────────────────

  async saveCheckIn({ mood, intimacy, notes, touch, _createdAt }) {
    const dk = _createdAt ? dateKey(new Date(_createdAt)) : dateKey();
    const id = makeId('chk');
    const value = { mood, intimacy, notes, touch, dateKey: dk };

    // Upsert by replacing any existing check-in for today
    const existing = await this._findCheckInByDate(dk);
    let row;
    if (existing) {
      row = await cdUpdate(existing.id, value);
    } else {
      row = await cdInsert('check_in', id, value);
    }

    const v = row.value || {};
    return { ...row, ...v };
  },

  async getCheckIns({ limit = 100, offset = 0 } = {}) {
    const rows = await cdQuery('check_in', {
      limit,
      offset,
      filter: (q) => q.eq('created_by', _userId),
    });
    return rows.map(r => ({ ...r, ...(r.value || {}) }));
  },

  async getCheckInForToday() {
    const row = await this._findCheckInByDate(dateKey());
    if (!row) return null;
    return { ...row, ...(row.value || {}) };
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
    const row = await cdInsert('vibe', id, value);
    return { ...row, ...(row.value || {}) };
  },

  async getVibes({ limit = 100 } = {}) {
    const rows = await cdQuery('vibe', {
      limit,
      filter: (q) => q.eq('created_by', _userId),
    });
    return rows.map(r => ({ ...r, ...(r.value || {}) }));
  },

  async getLatestVibe() {
    const sb = getSupabaseOrNull();
    if (!sb || !_coupleId) return null;
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
    if (!data) return null;
    return { ...data, ...(data.value || {}) };
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
    if (!sb || !_coupleId || !_userId) throw new Error('Not configured for calendar');

    const metadata = this._buildCalendarMetadata(event);
    const { data, error } = await sb
      .from(TABLES.CALENDAR_EVENTS)
      .insert({
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

    if (event?.isDateNight || event?.eventType === 'dateNight') {
      await this._saveDatePlanForEvent(event, data.id).catch(() => {});
    }

    PartnerNotifications.calendarEventCreated?.().catch(() => {});
    return { ...mapCalendarRow(data), remoteSynced: true };
  },

  async updateCalendarEvent(event) {
    const sb = getSupabaseOrNull();
    if (!sb) throw new Error('Supabase not configured');
    const eventId = event?.id;
    if (!eventId) throw new Error('Calendar event id required');

    const metadata = this._buildCalendarMetadata(event);
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
    await this._saveDatePlanForEvent(event, eventId).catch(() => {});
    return { ...mapCalendarRow(data), remoteSynced: true };
  },

  async getCalendarEvents({ limit = 1000 } = {}) {
    const sb = getSupabaseOrNull();
    if (!sb || !_coupleId) return [];

    const { data, error } = await sb
      .from(TABLES.CALENDAR_EVENTS)
      .select('*')
      .eq('couple_id', _coupleId)
      .order('event_date', { ascending: true })
      .limit(limit);

    if (error) {
      if (__DEV__) console.warn('[SupabaseDataLayer] getCalendarEvents failed:', error?.message);
      return [];
    }
    return (data || []).map(mapCalendarRow);
  },

  async deleteCalendarEvent(id, { deleteRemote = false } = {}) {
    const sb = getSupabaseOrNull();
    if (!sb) return;

    if (deleteRemote || true) { // always delete from Supabase since there's no local cache
      const { error } = await sb
        .from(TABLES.CALENDAR_EVENTS)
        .delete()
        .eq('id', id);
      if (error) throw error;
    }

    // Clean up any date plans linked to this event
    await cdQuery('date_plan', {
      filter: (q) => q.eq('value->>sourceEventId', id),
    }).then(plans => Promise.all(plans.map(p => cdSoftDelete(p.id)))).catch(() => {});
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
    const row = await cdUpsert('date_plan', id, value);
    return mapDatePlanRow(row);
  },

  async getDatePlans({ limit = 1000 } = {}) {
    const rows = await cdQuery('date_plan', { limit });
    return rows.map(mapDatePlanRow);
  },

  async deleteDatePlan(id) {
    await cdSoftDelete(id);
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

  async sync() { return null; },
  async pullNow() { return null; },
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
      // Dynamically import SQLite layer and E2EE — they may not exist in future
      const [{ default: Database }, { default: E2EEncryption }] = await Promise.all([
        import('../db/Database').catch(() => ({ default: null })),
        import('../e2ee/E2EEncryption').catch(() => ({ default: null })),
      ]);

      if (!Database || !E2EEncryption || !_coupleId || !_userId) {
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
            const info = E2EEncryption.inspect(row.title_cipher);
            const kt = info?.keyTier || 'device';
            const cid = kt === 'couple' ? (row.couple_id || _coupleId) : null;
            const title = await E2EEncryption.decryptString(row.title_cipher, kt, cid).catch(() => '');
            const body = await E2EEncryption.decryptString(row.body_cipher, kt, cid).catch(() => '');
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
            const info = E2EEncryption.inspect(row.answer_cipher);
            const kt = info?.keyTier || 'device';
            const cid = kt === 'couple' ? (row.couple_id || _coupleId) : null;
            const answer = await E2EEncryption.decryptString(row.answer_cipher, kt, cid).catch(() => '');

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
            const info = E2EEncryption.inspect(row.body_cipher);
            const kt = info?.keyTier || 'device';
            const cid = kt === 'couple' ? (row.couple_id || _coupleId) : null;
            const content = await E2EEncryption.decryptString(row.body_cipher, kt, cid).catch(() => '');

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
            const info = E2EEncryption.inspect(row.body_cipher);
            const kt = info?.keyTier || 'device';
            const cid = kt === 'couple' ? (row.couple_id || _coupleId) : null;
            const body = await E2EEncryption.decryptJson(row.body_cipher, kt, cid).catch(() => ({}));
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
            const info = E2EEncryption.inspect(row.note_cipher);
            const kt = info?.keyTier || 'device';
            const cid = kt === 'couple' ? (row.couple_id || _coupleId) : null;
            const note = row.note_cipher
              ? await E2EEncryption.decryptString(row.note_cipher, kt, cid).catch(() => null)
              : null;
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
