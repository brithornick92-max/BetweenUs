/**
 * DataLayer.js — Unified local-first + E2EE data access layer
 *
 * This is the single entry point the rest of the app should use for
 * reading/writing user data. It:
 *
 *   1. Encrypts sensitive fields via E2EEncryption
 *   2. Writes to SQLite (instant, offline-first)
 *   3. Triggers background sync to Supabase (if premium + coupled)
 *
 * Think of it as a replacement for the scattered direct calls to
 * AsyncStorage / LocalStorageService. Screens and contexts import
 * DataLayer instead.
 *
 * Key tier rules:
 *   • If user has a coupleId → use 'couple' key (both can decrypt)
 *   • If solo (no partner) → use 'device' key (only this device)
 *
 * Everything is async, but reads hit SQLite (< 1ms) so the UI
 * never waits on the network.
 */

import Database from '../db/Database';
import E2EEncryption from '../e2ee/E2EEncryption';
import EncryptedAttachments from '../e2ee/EncryptedAttachments';
import SyncEngine from '../sync/SyncEngine';
import { storage, promptStorage, journalStorage, STORAGE_KEYS } from '../../utils/storage';

// ─── Helpers ────────────────────────────────────────────────────────

let _userId = null;
let _legacyLocalUserId = null; // old Crypto.randomUUID() for isOwn on pre-fix notes
let _coupleId = null;
let _coupleKeyAvailable = false;
let _calendarChannel = null;
const legacyMigrationKey = (userId) => `@betweenus:legacyDataMigrated:${userId}`;
const legacyCalendarMigrationKey = (userId) => `@betweenus:legacyCalendarMigrated:${userId}`;

function getSupabaseConfigSync() {
  try {
    return require('../../config/supabase');
  } catch {
    return { supabase: null, TABLES: {} };
  }
}

function buildCalendarMetadata(event) {
  return {
    ...(event?.metadata || {}),
    isDateNight: !!(event?.isDateNight || event?.eventType === 'dateNight'),
    notify: !!event?.notify,
    notifyMins: Number(event?.notifyMins ?? 60) || 60,
    notificationId: event?.notificationId || null,
  };
}

function buildDatePlanFromEvent(event, sourceEventId) {
  if (!(event?.isDateNight || event?.eventType === 'dateNight')) {
    return null;
  }

  return {
    title: event?.title || '',
    locationType: event?.location ? 'out' : 'home',
    heat: 2,
    load: 2,
    style: 'mixed',
    steps: event?.notes ? [event.notes] : ['Plan the vibe.', 'Enjoy the moment.'],
    sourceEventId,
  };
}

function mapRemoteCalendarRow(remoteRow) {
  return {
    id: remoteRow.id,
    title: remoteRow.title,
    location: remoteRow.location || '',
    notes: remoteRow.description || '',
    eventType: remoteRow.event_type || 'general',
    isDateNight: remoteRow.event_type === 'dateNight' || remoteRow.event_type === 'date_night' || !!remoteRow.metadata?.isDateNight,
    whenTs: new Date(remoteRow.event_date).getTime(),
    notify: !!remoteRow.metadata?.notify,
    notifyMins: Number(remoteRow.metadata?.notifyMins ?? 60) || 60,
    notificationId: remoteRow.metadata?.notificationId || null,
    metadata: remoteRow.metadata || {},
    createdAt: remoteRow.created_at || Date.now(),
    updatedAt: remoteRow.updated_at || remoteRow.created_at || Date.now(),
  };
}

function isUuid(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function serializeDatePlanForMetadata(plan) {
  if (!plan) return null;
  return {
    locationType: plan.locationType || 'home',
    heat: plan.heat ?? 2,
    load: plan.load ?? 2,
    style: plan.style || 'mixed',
    steps: Array.isArray(plan.steps) ? plan.steps : [],
  };
}

async function readLegacyEncryptedList(storageKey, sortFn) {
  try {
    const raw = await storage.get(storageKey, null);
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return sortFn ? [...raw].sort(sortFn) : raw;
    }

    const { default: EncryptionService } = await import('../../services/EncryptionService');
    const decrypted = await EncryptionService.decryptJson(raw);
    const list = Array.isArray(decrypted) ? decrypted : [];
    return sortFn ? list.sort(sortFn) : list;
  } catch {
    return [];
  }
}

/**
 * Determine the key tier for encryption.
 *
 * POLICY: If the user is coupled (_coupleId is set), shared content
 * MUST use 'couple' tier. We never silently fall back to 'device' for
 * shared content — that would produce ciphertext the partner can't read.
 *
 * If you need to check availability before writing, call
 * `DataLayer.canEncryptForCouple()` first. If it returns false,
 * the UI should show a "Reconnect to sync" banner.
 */
function keyTier() {
  return _coupleId ? 'couple' : 'device';
}

/**
 * For explicit solo/private content, always use device key regardless
 * of pairing state.
 */
function deviceTier() {
  return 'device';
}

function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Debounced push — wait 500ms after the last write before pushing.
 * Batches rapid writes into a single sync cycle.
 */
let _pushTimer = null;
function debouncedPush() {
  if (_pushTimer) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => {
    SyncEngine.pushNow().catch(() => {});
  }, 500);
}

// ─── Init / teardown ────────────────────────────────────────────────

const DataLayer = {
  /**
   * Initialize the data layer. Call once at app start (after auth).
   */
  async init({ userId, coupleId, isPremium = false, legacyLocalUserId = null }) {
    _userId = userId;
    _legacyLocalUserId = legacyLocalUserId;
    _coupleId = coupleId;

    // Check if the couple key is actually available
    if (coupleId) {
      _coupleKeyAvailable = await E2EEncryption.hasCoupleKey(coupleId);
    } else {
      _coupleKeyAvailable = false;
    }

    await Database.init();

    SyncEngine.configure({ userId, coupleId, isPremium });

    // Initial pull from Supabase (get partner's latest data)
    if (isPremium && coupleId) {
      SyncEngine.pullNow().catch(err =>
        console.warn('[DataLayer] Initial pull failed:', err.message)
      );
    }
  },

  /**
   * Update config (e.g. when couple links, premium changes).
   */
  async reconfigure({ userId, coupleId, isPremium, legacyLocalUserId }) {
    if (userId) _userId = userId;
    if (legacyLocalUserId !== undefined) _legacyLocalUserId = legacyLocalUserId;
    if (coupleId !== undefined) _coupleId = coupleId;

    // Re-check couple key availability
    if (coupleId) {
      _coupleKeyAvailable = await E2EEncryption.hasCoupleKey(coupleId);
    } else {
      _coupleKeyAvailable = false;
    }

    SyncEngine.configure({ userId, coupleId, isPremium });
  },

  /**
   * Backfill legacy AsyncStorage records into SQLite + E2EE once per user.
   * This rescues older prompt answers and journal entries so they appear in
   * export/read flows that now use DataLayer exclusively.
   */
  async migrateLegacyStorage() {
    if (!_userId) {
      return {
        migratedPrompts: 0,
        migratedJournals: 0,
        migratedCalendarEvents: 0,
        migratedDatePlans: 0,
        skipped: true,
      };
    }

    const markerKey = legacyMigrationKey(_userId);
    const calendarMarkerKey = legacyCalendarMigrationKey(_userId);
    const [alreadyMigrated, alreadyMigratedCalendar] = await Promise.all([
      storage.get(markerKey, false),
      storage.get(calendarMarkerKey, false),
    ]);
    if (alreadyMigrated && alreadyMigratedCalendar) {
      return {
        migratedPrompts: 0,
        migratedJournals: 0,
        migratedCalendarEvents: 0,
        migratedDatePlans: 0,
        skipped: true,
      };
    }

    let migratedPrompts = 0;
    let migratedJournals = 0;
    let migratedCalendarEvents = 0;
    let migratedDatePlans = 0;

    try {
      const kt = keyTier();
      const cid = kt === 'couple' ? _coupleId : null;

      if (!alreadyMigrated) {
        const legacyPrompts = await promptStorage.getAll();
        for (const [dk, byDate] of Object.entries(legacyPrompts || {})) {
          for (const [promptId, payload] of Object.entries(byDate || {})) {
            const answer = payload?.answer || payload?.content;
            if (!answer || !String(answer).trim()) continue;

            const existing = await Database.getPromptAnswerByPromptAndDate(_userId, String(promptId), dk);
            if (existing) continue;

            const heatLevel = Number(payload?.heatLevel ?? payload?.heat_level ?? 5) || 5;
            const answerCipher = await E2EEncryption.encryptString(answer, kt, cid);
            const heatCipher = await E2EEncryption.encryptString(String(heatLevel), kt, cid);

            await Database.insertPromptAnswer({
              id: payload?.id,
              user_id: _userId,
              couple_id: _coupleId,
              prompt_id: String(promptId),
              date_key: dk,
              answer_cipher: answerCipher,
              heat_level: heatLevel,
              heat_level_cipher: heatCipher,
              is_revealed: !!(payload?.isRevealed ?? payload?.is_revealed),
              reveal_at: payload?.revealAt
                ? new Date(payload.revealAt).toISOString()
                : (payload?.reveal_at ?? null),
              created_at: payload?.timestamp
                ? new Date(payload.timestamp).toISOString()
                : undefined,
            });
            migratedPrompts += 1;
          }
        }

        const legacyJournals = await journalStorage.getEntries();
        for (const entry of legacyJournals || []) {
          if (!entry?.id) continue;

          const existing = await Database.getJournalById(entry.id);
          if (existing) continue;

          const title = entry?.title || '';
          const body = entry?.body || entry?.content || '';
          if (!title.trim() && !body.trim()) continue;

          const isPrivate = entry?.isPrivate === true
            ? true
            : entry?.isShared === true
              ? false
              : true;
          const journalKt = isPrivate ? deviceTier() : keyTier();
          const journalCid = journalKt === 'couple' ? _coupleId : null;

          const titleCipher = await E2EEncryption.encryptString(title, journalKt, journalCid);
          const bodyCipher = await E2EEncryption.encryptString(body, journalKt, journalCid);
          const moodCipher = entry?.mood
            ? await E2EEncryption.encryptString(entry.mood, journalKt, journalCid)
            : null;

          await Database.insertJournal({
            id: entry.id,
            user_id: _userId,
            title_cipher: titleCipher,
            body_cipher: bodyCipher,
            mood: entry?.mood ?? null,
            mood_cipher: moodCipher,
            is_private: isPrivate,
            created_at: entry?.createdAt ? new Date(entry.createdAt).toISOString() : undefined,
          });
          migratedJournals += 1;
        }

        await storage.set(markerKey, true);
      }

      if (!alreadyMigratedCalendar) {
        const [legacyCalendarEvents, legacyDatePlans] = await Promise.all([
          readLegacyEncryptedList(STORAGE_KEYS.CALENDAR_EVENTS),
          readLegacyEncryptedList(STORAGE_KEYS.MY_DATES, (a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
        ]);

        for (const event of legacyCalendarEvents || []) {
          if (!event?.id || !event?.whenTs) continue;
          const existing = await Database.getCalendarEventById(event.id);
          if (existing) continue;

          await this.saveCalendarEvent({
            id: event.id,
            title: event.title || '',
            location: event.location || '',
            notes: event.notes || '',
            whenTs: event.whenTs,
            eventType: event.eventType || (event.isDateNight ? 'dateNight' : 'general'),
            isDateNight: !!event.isDateNight,
            notify: !!event.notify,
            notifyMins: Number(event.notifyMins ?? 60) || 60,
            notificationId: event.notificationId || null,
            metadata: event.metadata || {},
            createdAt: event.createdAt || event.updatedAt || Date.now(),
            updatedAt: event.updatedAt || event.createdAt || Date.now(),
          }, { syncSource: event.isRemote ? 'remote' : 'local', markSynced: !!event.isRemote || !!event.supabaseId });
          migratedCalendarEvents += 1;
        }

        for (const plan of legacyDatePlans || []) {
          if (!plan?.id) continue;
          const existing = await Database.getDatePlanById(plan.id);
          if (existing) continue;

          await this.saveDatePlan({
            ...plan,
            createdAt: plan.createdAt || Date.now(),
            updatedAt: plan.updatedAt || plan.createdAt || Date.now(),
          }, { syncSource: plan.sourceEventId ? 'remote' : 'local', markSynced: !!plan.sourceEventId });
          migratedDatePlans += 1;
        }

        await storage.set(calendarMarkerKey, true);
      }

      if (migratedPrompts || migratedJournals || migratedCalendarEvents || migratedDatePlans) {
        debouncedPush();
      }

      return {
        migratedPrompts,
        migratedJournals,
        migratedCalendarEvents,
        migratedDatePlans,
        skipped: false,
      };
    } catch (error) {
      console.warn('[DataLayer] Legacy migration failed:', error?.message);
      return {
        migratedPrompts,
        migratedJournals,
        migratedCalendarEvents,
        migratedDatePlans,
        skipped: false,
        error: error?.message,
      };
    }
  },

  /**
   * Check if we can encrypt/decrypt for the couple.
   * If false, the UI should show "Reconnect" and disable shared writes.
   */
  canEncryptForCouple() {
    return !!_coupleId && _coupleKeyAvailable;
  },

  /**
   * Returns true if the user is paired but couple key is missing.
   * UI should show a reconnect/re-pair banner.
   */
  needsReconnect() {
    return !!_coupleId && !_coupleKeyAvailable;
  },

  /**
   * Full reset (sign-out / account delete).
   */
  async reset() {
    if (_pushTimer) { clearTimeout(_pushTimer); _pushTimer = null; }
    _userId = null;
    _coupleId = null;
    _coupleKeyAvailable = false;
    const { supabase } = getSupabaseConfigSync();
    if (_calendarChannel && supabase) {
      try {
        supabase.removeChannel(_calendarChannel);
      } catch {}
    }
    _calendarChannel = null;
    E2EEncryption.clearCache();
    await SyncEngine.reset();
  },

  // ─── Journal ──────────────────────────────────────────────────

  async saveJournalEntry({ title, body, mood, tags, isPrivate = false }) {
    // Private entries always use device key; shared entries use couple key
    const kt = isPrivate ? deviceTier() : keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    const titleCipher = await E2EEncryption.encryptString(title, kt, cid);
    const bodyCipher = await E2EEncryption.encryptString(body, kt, cid);

    // Encrypt sensitive metadata — keep coarse buckets unencrypted for sorting
    const moodCipher = mood ? await E2EEncryption.encryptString(mood, kt, cid) : null;
    const tagsCipher = tags?.length ? await E2EEncryption.encryptJson(tags, kt, cid) : null;

    const row = await Database.insertJournal({
      user_id: _userId,
      title_cipher: titleCipher,
      body_cipher: bodyCipher,
      mood,       // unencrypted coarse label for local calendar/filters
      mood_cipher: moodCipher,  // encrypted exact value for Supabase
      tags,
      tags_cipher: tagsCipher,  // encrypted exact value for Supabase
      is_private: isPrivate,
    });

    debouncedPush();
    return row;
  },

  async updateJournalEntry(id, { title, body, mood, tags, isPrivate }) {
    const updates = {};
    // Use device key for private entries, couple key for shared
    const kt = isPrivate ? deviceTier() : keyTier();
    const cid = kt === 'couple' ? _coupleId : null;

    // When toggling private→shared, we must re-encrypt title and body
    // with the couple key even if the caller didn't provide new values.
    let effectiveTitle = title;
    let effectiveBody = body;
    if (isPrivate === false && (effectiveTitle === undefined || effectiveBody === undefined)) {
      const existing = await this.getJournalEntry(id);
      if (existing && existing.is_private) {
        if (effectiveTitle === undefined) effectiveTitle = existing.title;
        if (effectiveBody === undefined) effectiveBody = existing.body;
      }
    }

    if (effectiveTitle !== undefined) updates.title_cipher = await E2EEncryption.encryptString(effectiveTitle, kt, cid);
    if (effectiveBody !== undefined) updates.body_cipher = await E2EEncryption.encryptString(effectiveBody, kt, cid);
    if (mood !== undefined) updates.mood = mood;
    if (tags !== undefined) updates.tags = tags;
    if (isPrivate !== undefined) updates.is_private = isPrivate;

    const row = await Database.updateJournal(id, updates);
    debouncedPush();
    return row;
  },

  async deleteJournalEntry(id) {
    await Database.softDeleteJournal(id);
    debouncedPush();
  },

  async getJournalEntries({ limit = 50, offset = 0, mood } = {}) {
    const rows = await Database.getJournals(_userId, { limit, offset, mood });
    return Promise.all((rows || []).map(r => this._decryptJournal(r)));
  },

  async getJournalEntry(id) {
    const row = await Database.getJournalById(id);
    return row ? this._decryptJournal(row) : null;
  },

  async _decryptJournal(row) {
    if (!row) return null;
    // Detect which key tier the envelope was encrypted with
    const info = E2EEncryption.inspect(row.title_cipher);
    const kt = info?.keyTier || keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    try {
      return {
        ...row,
        title: await E2EEncryption.decryptString(row.title_cipher, kt, cid),
        body: await E2EEncryption.decryptString(row.body_cipher, kt, cid),
        tags: row.tags ? JSON.parse(row.tags) : [],
        is_private: !!row.is_private,
      };
    } catch (err) {
      // Decryption failed — return with locked flag
      console.warn('[DataLayer] Journal decryption failed:', err?.message);
      return { ...row, title: null, body: null, tags: [], locked: true };
    }
  },

  // ─── Prompt Answers ───────────────────────────────────────────

  async savePromptAnswer({ promptId, answer, heatLevel = 5 }) {
    const kt = keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    const answerCipher = await E2EEncryption.encryptString(answer, kt, cid);
    const heatCipher = await E2EEncryption.encryptString(String(heatLevel), kt, cid);
    const dk = dateKey();

    const row = await Database.insertPromptAnswer({
      user_id: _userId,
      couple_id: _coupleId,
      prompt_id: promptId,
      date_key: dk,
      answer_cipher: answerCipher,
      heat_level: heatLevel,          // unencrypted for local sorting
      heat_level_cipher: heatCipher,  // encrypted for Supabase
    });

    debouncedPush();
    return row;
  },

  async revealPromptAnswer(id) {
    const row = await Database.updatePromptAnswer(id, {
      is_revealed: true,
      reveal_at: new Date().toISOString(),
    });
    debouncedPush();
    return row;
  },

  async getPromptAnswers({ dateKey: dk, promptId, limit = 100 } = {}) {
    const rows = await Database.getPromptAnswers(_userId, { dateKey: dk, promptId, limit });
    return Promise.all((rows || []).map(r => this._decryptPromptAnswer(r)));
  },

  async getPromptAnswerForToday(promptId) {
    const dk = dateKey();
    const row = await Database.getPromptAnswerByPromptAndDate(_userId, promptId, dk);
    return row ? this._decryptPromptAnswer(row) : null;
  },

  async _decryptPromptAnswer(row) {
    if (!row) return null;
    const info = E2EEncryption.inspect(row.answer_cipher);
    const kt = info?.keyTier || keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    try {
      return {
        ...row,
        answer: await E2EEncryption.decryptString(row.answer_cipher, kt, cid),
        partnerAnswer: row.partner_answer_cipher
          ? await E2EEncryption.decryptString(row.partner_answer_cipher, kt, cid)
          : null,
        is_revealed: !!row.is_revealed,
      };
    } catch (err) {
      console.warn('[DataLayer] Prompt answer decryption failed:', err?.message);
      return { ...row, answer: null, partnerAnswer: null, locked: true };
    }
  },

  // ─── Memories ─────────────────────────────────────────────────

  async saveMemory({ content, type = 'moment', mood, isPrivate = false, mediaUri, mimeType, fileName }) {
    const kt = isPrivate ? deviceTier() : keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    const bodyCipher = await E2EEncryption.encryptString(content, kt, cid);
    const moodCipher = mood ? await E2EEncryption.encryptString(mood, kt, cid) : null;

    let mediaRef = null;

    // Handle attachment if present
    if (mediaUri) {
      const att = await EncryptedAttachments.encryptAndStore({
        sourceUri: mediaUri,
        fileName: fileName || 'attachment',
        mimeType: mimeType || 'image/jpeg',
        userId: _userId,
        coupleId: _coupleId,
        parentType: 'memory',
        parentId: null, // will link after insert
        keyTier: kt,
      });
      mediaRef = att.id;
    }

    const row = await Database.insertMemory({
      user_id: _userId,
      couple_id: _coupleId,
      type,
      body_cipher: bodyCipher,
      media_ref: mediaRef,
      mood,
      mood_cipher: moodCipher,
      is_private: isPrivate,
    });

    debouncedPush();
    return row;
  },

  async getMemories({ type, limit = 100, offset = 0 } = {}) {
    const rows = await Database.getMemories(_userId, { type, limit, offset });
    return Promise.all((rows || []).map(r => this._decryptMemory(r)));
  },

  async _decryptMemory(row) {
    if (!row) return null;
    const info = E2EEncryption.inspect(row.body_cipher);
    const kt = info?.keyTier || keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    try {
      return {
        ...row,
        content: await E2EEncryption.decryptString(row.body_cipher, kt, cid),
        is_private: !!row.is_private,
      };
    } catch (err) {
      console.warn('[DataLayer] Memory decryption failed:', err?.message);
      return { ...row, content: null, locked: true };
    }
  },

  async deleteMemory(id) {
    await Database.softDeleteMemory(id);
    debouncedPush();
  },

  // ─── Rituals ──────────────────────────────────────────────────

  async saveRitual({ flowId, responses, streakDay = 1 }) {
    const kt = keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    const bodyCipher = await E2EEncryption.encryptJson(responses, kt, cid);

    const row = await Database.insertRitual({
      user_id: _userId,
      couple_id: _coupleId,
      flow_id: flowId,
      body_cipher: bodyCipher,
      streak_day: streakDay,
    });

    debouncedPush();
    return row;
  },

  async getRituals({ limit = 100, offset = 0 } = {}) {
    const rows = await Database.getRituals(_userId, { limit, offset });
    return Promise.all((rows || []).map(async (row) => {
      const info = E2EEncryption.inspect(row.body_cipher);
      const kt = info?.keyTier || keyTier();
      const cid = kt === 'couple' ? _coupleId : null;
      try {
        return {
          ...row,
          responses: await E2EEncryption.decryptJson(row.body_cipher, kt, cid),
        };
      } catch {
        return { ...row, responses: null, locked: true };
      }
    }));
  },

  // ─── Check-ins ────────────────────────────────────────────────

  async saveCheckIn({ mood, intimacy, notes, touch }) {
    const kt = keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    const bodyCipher = await E2EEncryption.encryptJson(
      { mood, intimacy, notes, touch },
      kt, cid
    );
    const moodCipher = mood ? await E2EEncryption.encryptString(mood, kt, cid) : null;

    const row = await Database.insertCheckIn({
      user_id: _userId,
      couple_id: _coupleId,
      body_cipher: bodyCipher,
      mood,                // unencrypted label for local calendar display
      mood_cipher: moodCipher,  // encrypted for Supabase
      date_key: dateKey(),
    });

    debouncedPush();
    return row;
  },

  async getCheckIns({ limit = 100, offset = 0 } = {}) {
    const rows = await Database.getCheckIns(_userId, { limit, offset });
    return Promise.all((rows || []).map(async (row) => {
      const info = E2EEncryption.inspect(row.body_cipher);
      const kt = info?.keyTier || keyTier();
      const cid = kt === 'couple' ? _coupleId : null;
      try {
        const data = await E2EEncryption.decryptJson(row.body_cipher, kt, cid);
        return { ...row, ...(data || {}) };
      } catch {
        return { ...row, locked: true };
      }
    }));
  },

  async getCheckInForToday() {
    const row = await Database.getCheckInByDate(_userId, dateKey());
    if (!row) return null;
    const info = E2EEncryption.inspect(row.body_cipher);
    const kt = info?.keyTier || keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    try {
      const data = await E2EEncryption.decryptJson(row.body_cipher, kt, cid);
      return { ...row, ...(data || {}) };
    } catch {
      return { ...row, locked: true };
    }
  },

  // ─── Vibes ────────────────────────────────────────────────────

  async saveVibe({ vibe, note }) {
    const kt = keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    const noteCipher = note
      ? await E2EEncryption.encryptString(note, kt, cid)
      : null;

    const row = await Database.insertVibe({
      user_id: _userId,
      couple_id: _coupleId,
      vibe,
      note_cipher: noteCipher,
    });

    debouncedPush();
    return row;
  },

  async getVibes({ limit = 100 } = {}) {
    const rows = await Database.getVibes(_userId, { limit });
    return Promise.all((rows || []).map(async (row) => {
      const info = E2EEncryption.inspect(row.note_cipher);
      const kt = info?.keyTier || keyTier();
      const cid = kt === 'couple' ? _coupleId : null;
      try {
        return {
          ...row,
          note: row.note_cipher
            ? await E2EEncryption.decryptString(row.note_cipher, kt, cid)
            : null,
        };
      } catch {
        return { ...row, note: null, locked: true };
      }
    }));
  },

  async getLatestVibe() {
    const row = await Database.getLatestVibe(_userId);
    if (!row) return null;
    const info = E2EEncryption.inspect(row.note_cipher);
    const kt = info?.keyTier || keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    try {
      return {
        ...row,
        note: row.note_cipher
          ? await E2EEncryption.decryptString(row.note_cipher, kt, cid)
          : null,
      };
    } catch {
      return { ...row, note: null, locked: true };
    }
  },

  // ─── Calendar Events ──────────────────────────────────────────

  async saveCalendarEvent(event, { syncSource = 'local', markSynced = false } = {}) {
    const kt = keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    const titleCipher = await E2EEncryption.encryptString(event?.title || '', kt, cid);
    const locationCipher = await E2EEncryption.encryptString(event?.location || '', kt, cid);
    const notesCipher = await E2EEncryption.encryptString(event?.notes || '', kt, cid);
    const metadataCipher = await E2EEncryption.encryptJson(event?.metadata || {}, kt, cid);
    const createdAtIso = new Date(event?.createdAt || Date.now()).toISOString();
    const updatedAtIso = new Date(event?.updatedAt || Date.now()).toISOString();

    const row = await Database.upsertCalendarEvent({
      id: event?.id,
      user_id: _userId,
      couple_id: _coupleId,
      title_cipher: titleCipher,
      location_cipher: locationCipher,
      notes_cipher: notesCipher,
      event_type: event?.eventType || 'general',
      when_ts: event?.whenTs,
      is_date_night: !!(event?.isDateNight || event?.eventType === 'dateNight'),
      notify: !!event?.notify,
      notify_mins: Number(event?.notifyMins ?? 60) || 60,
      notification_id: event?.notificationId || null,
      metadata_cipher: metadataCipher,
      created_at: createdAtIso,
      updated_at: updatedAtIso,
    }, {
      syncStatus: markSynced ? 'synced' : 'pending',
      syncSource,
    });

    return row;
  },

  async refreshCalendarEventsFromRemote({ limit = 5000 } = {}) {
    await this.pushPendingCalendarEvents();

    const { supabase, TABLES } = getSupabaseConfigSync();

    if (supabase && _coupleId) {
      try {
        const { data: remoteEvents, error } = await supabase
          .from(TABLES.CALENDAR_EVENTS)
          .select('*')
          .eq('couple_id', _coupleId)
          .order('event_date', { ascending: true });

        if (!error && Array.isArray(remoteEvents)) {
          for (const remoteRow of remoteEvents) {
            const mappedEvent = mapRemoteCalendarRow(remoteRow);
            await this.saveCalendarEvent(mappedEvent, { syncSource: 'remote', markSynced: true });

            const myDateData = remoteRow.metadata?.myDateData;
            if (myDateData) {
              const existingPlans = await Database.getDatePlansBySourceEvent(_userId, remoteRow.id);
              await this.saveDatePlan({
                ...myDateData,
                title: remoteRow.title,
                sourceEventId: remoteRow.id,
                id: existingPlans?.[0]?.id || `md_${remoteRow.id}`,
                createdAt: remoteRow.created_at || Date.now(),
                updatedAt: remoteRow.updated_at || remoteRow.created_at || Date.now(),
              }, { syncSource: 'remote', markSynced: true });
            }
          }

          const remoteIds = new Set(remoteEvents.map((row) => row.id));
          const existingEvents = await this.getCalendarEvents({ limit });
          for (const event of existingEvents || []) {
            if (event?.isRemote && !remoteIds.has(event.id)) {
              await this.deleteCalendarEvent(event.id);
            }
          }
        }
      } catch (error) {
        console.warn('[DataLayer] Calendar remote refresh failed:', error?.message);
      }
    }

    return this.getCalendarEvents({ limit });
  },

  async pushPendingCalendarEvents({ limit = 200 } = {}) {
    const { supabase, TABLES } = getSupabaseConfigSync();
    if (!supabase || !_coupleId || !_userId) {
      return { pushed: 0, deleted: 0, failed: 0 };
    }

    const pendingRows = await Database.getPendingCalendarEvents(_userId, { limit });
    let pushed = 0;
    let deleted = 0;
    let failed = 0;

    for (const row of pendingRows || []) {
      try {
        if (row.deleted_at) {
          if (isUuid(row.id)) {
            const { error } = await supabase
              .from(TABLES.CALENDAR_EVENTS)
              .delete()
              .eq('id', row.id);
            if (error) throw error;
          }
          await Database.markCalendarEventSynced(row.id, { syncSource: isUuid(row.id) ? 'remote' : 'local' });
          await Database.markDatePlansSyncedBySourceEvent(row.id, { syncSource: isUuid(row.id) ? 'remote' : 'local' });
          deleted += 1;
          continue;
        }

        const event = await this._decryptCalendarEvent(row);
        const linkedPlans = await Database.getDatePlansBySourceEvent(_userId, row.id);
        const primaryPlan = linkedPlans?.[0] ? await this._decryptDatePlan(linkedPlans[0]) : null;
        const metadata = {
          ...buildCalendarMetadata(event),
          ...(primaryPlan ? { myDateData: serializeDatePlanForMetadata(primaryPlan) } : {}),
        };

        if (isUuid(row.id)) {
          const { error } = await supabase
            .from(TABLES.CALENDAR_EVENTS)
            .update({
              title: event.title,
              description: event.notes || null,
              event_date: new Date(event.whenTs).toISOString(),
              event_type: event.eventType || 'general',
              location: event.location || null,
              metadata,
            })
            .eq('id', row.id);
          if (error) throw error;

          await Database.markCalendarEventSynced(row.id, { syncSource: 'remote' });
          await Database.markDatePlansSyncedBySourceEvent(row.id, { syncSource: 'remote' });
          pushed += 1;
          continue;
        }

        const { data: inserted, error } = await supabase
          .from(TABLES.CALENDAR_EVENTS)
          .insert({
            couple_id: _coupleId,
            title: event.title,
            description: event.notes || null,
            event_date: new Date(event.whenTs).toISOString(),
            event_type: event.eventType || 'general',
            location: event.location || null,
            metadata,
            created_by: _userId,
          })
          .select('id')
          .single();
        if (error || !inserted?.id) throw error || new Error('Calendar remote insert failed');

        await Database.replaceCalendarEventId(row.id, inserted.id);
        pushed += 1;
      } catch (error) {
        console.warn('[DataLayer] Pending calendar push failed:', error?.message);
        failed += 1;
      }
    }

    return { pushed, deleted, failed };
  },

  async createCalendarEvent(event) {
    const { supabase, TABLES } = getSupabaseConfigSync();
    const metadata = buildCalendarMetadata(event);
    let remoteId = event?.id || null;
    let remoteSynced = false;

    if (supabase && _coupleId && _userId) {
      try {
        const { data: inserted, error } = await supabase
          .from(TABLES.CALENDAR_EVENTS)
          .insert({
            couple_id: _coupleId,
            title: event?.title?.trim(),
            description: event?.notes || null,
            event_date: new Date(event.whenTs).toISOString(),
            event_type: event?.eventType || 'general',
            location: event?.location || null,
            metadata: {
              ...metadata,
              ...(buildDatePlanFromEvent(event, null)
                ? { myDateData: buildDatePlanFromEvent(event, null) }
                : {}),
            },
            created_by: _userId,
          })
          .select('id')
          .single();

        if (!error && inserted?.id) {
          remoteId = inserted.id;
          remoteSynced = true;
        }
      } catch (error) {
        console.warn('[DataLayer] Calendar remote create failed:', error?.message);
      }
    }

    const savedEvent = await this.saveCalendarEvent({
      ...event,
      id: remoteId || undefined,
      metadata,
    }, {
      syncSource: remoteSynced ? 'remote' : 'local',
      markSynced: remoteSynced,
    });

    const datePlan = buildDatePlanFromEvent(event, savedEvent?.id);
    if (datePlan) {
      await this.saveDatePlan(datePlan, {
        syncSource: remoteSynced ? 'remote' : 'local',
        markSynced: remoteSynced,
      });
    }

    return { ...savedEvent, remoteSynced };
  },

  async getCalendarEvents({ limit = 1000 } = {}) {
    const rows = await Database.getCalendarEvents(_userId, { limit });
    return Promise.all((rows || []).map(r => this._decryptCalendarEvent(r)));
  },

  async deleteCalendarEvent(id, { deleteRemote = false, remoteId } = {}) {
    const { supabase, TABLES } = getSupabaseConfigSync();
    const linkedPlans = await Database.getDatePlansBySourceEvent(_userId, id);

    if (deleteRemote && supabase) {
      try {
        const { error } = await supabase
          .from(TABLES.CALENDAR_EVENTS)
          .delete()
          .eq('id', remoteId || id);
        if (error) {
          throw error;
        }
      } catch (error) {
        console.warn('[DataLayer] Calendar remote delete failed:', error?.message);
        throw error;
      }
    }

    await Database.softDeleteCalendarEvent(id);
    for (const plan of linkedPlans || []) {
      await Database.softDeleteDatePlan(plan.id);
    }

    if (deleteRemote && isUuid(remoteId || id)) {
      await Database.markCalendarEventSynced(id, { syncSource: 'remote' });
      await Database.markDatePlansSyncedBySourceEvent(id, { syncSource: 'remote' });
    }
  },

  subscribeCalendarEvents(onChange) {
    const { supabase, TABLES } = getSupabaseConfigSync();
    if (!supabase || !_coupleId) {
      return () => {};
    }

    if (_calendarChannel) {
      try {
        supabase.removeChannel(_calendarChannel);
      } catch {}
      _calendarChannel = null;
    }

    _calendarChannel = supabase
      .channel(`calendar_${_coupleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLES.CALENDAR_EVENTS, filter: `couple_id=eq.${_coupleId}` },
        async () => {
          await this.refreshCalendarEventsFromRemote();
          onChange?.();
        }
      )
      .subscribe();

    return () => {
      if (_calendarChannel && supabase) {
        try {
          supabase.removeChannel(_calendarChannel);
        } catch {}
        _calendarChannel = null;
      }
    };
  },

  async _decryptCalendarEvent(row) {
    if (!row) return null;
    const info = E2EEncryption.inspect(row.title_cipher);
    const kt = info?.keyTier || keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    try {
      const metadata = row.metadata_cipher
        ? await E2EEncryption.decryptJson(row.metadata_cipher, kt, cid)
        : {};
      return {
        id: row.id,
        title: await E2EEncryption.decryptString(row.title_cipher, kt, cid),
        location: row.location_cipher
          ? await E2EEncryption.decryptString(row.location_cipher, kt, cid)
          : '',
        notes: row.notes_cipher
          ? await E2EEncryption.decryptString(row.notes_cipher, kt, cid)
          : '',
        eventType: row.event_type || 'general',
        isDateNight: !!row.is_date_night,
        whenTs: Number(row.when_ts),
        notify: !!row.notify,
        notifyMins: Number(row.notify_mins ?? 60) || 60,
        notificationId: row.notification_id || null,
        metadata: metadata || {},
        createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
        updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
        isRemote: row.sync_source === 'remote',
        supabaseId: row.sync_source === 'remote' ? row.id : null,
      };
    } catch (err) {
      console.warn('[DataLayer] Calendar event decryption failed:', err?.message);
      return { ...row, title: null, location: '', notes: '', metadata: {}, locked: true };
    }
  },

  // ─── Date Plans ───────────────────────────────────────────────

  async saveDatePlan(plan, { syncSource = 'local', markSynced = false } = {}) {
    const kt = keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    const titleCipher = await E2EEncryption.encryptString(plan?.title || '', kt, cid);
    const bodyCipher = await E2EEncryption.encryptJson({
      locationType: plan?.locationType || 'home',
      heat: plan?.heat ?? 2,
      load: plan?.load ?? 2,
      style: plan?.style || 'mixed',
      steps: Array.isArray(plan?.steps) ? plan.steps : [],
    }, kt, cid);
    const createdAtIso = new Date(plan?.createdAt || Date.now()).toISOString();
    const updatedAtIso = new Date(plan?.updatedAt || Date.now()).toISOString();

    const row = await Database.upsertDatePlan({
      id: plan?.id,
      user_id: _userId,
      couple_id: _coupleId,
      source_event_id: plan?.sourceEventId || null,
      title_cipher: titleCipher,
      body_cipher: bodyCipher,
      created_at: createdAtIso,
      updated_at: updatedAtIso,
    }, {
      syncStatus: markSynced ? 'synced' : 'pending',
      syncSource,
    });

    return row;
  },

  async getDatePlans({ limit = 1000 } = {}) {
    const rows = await Database.getDatePlans(_userId, { limit });
    return Promise.all((rows || []).map(r => this._decryptDatePlan(r)));
  },

  async deleteDatePlan(id) {
    await Database.softDeleteDatePlan(id);
  },

  async _decryptDatePlan(row) {
    if (!row) return null;
    const info = E2EEncryption.inspect(row.title_cipher);
    const kt = info?.keyTier || keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    try {
      const body = row.body_cipher
        ? await E2EEncryption.decryptJson(row.body_cipher, kt, cid)
        : {};
      return {
        id: row.id,
        title: await E2EEncryption.decryptString(row.title_cipher, kt, cid),
        sourceEventId: row.source_event_id || null,
        locationType: body?.locationType || 'home',
        heat: body?.heat ?? 2,
        load: body?.load ?? 2,
        style: body?.style || 'mixed',
        steps: Array.isArray(body?.steps) ? body.steps : [],
        createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
        updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
        isRemote: row.sync_source === 'remote',
      };
    } catch (err) {
      console.warn('[DataLayer] Date plan decryption failed:', err?.message);
      return { ...row, title: null, steps: [], locked: true };
    }
  },

  // ─── Love Notes (E2EE + couple-synced) ─────────────────────────

  /**
   * Save a love note. Text and sender name are encrypted with the couple
   * key so only the two partners can read them. If a photo is attached,
   * it is encrypted via EncryptedAttachments (file bytes never leave the
   * device in plaintext).
   */
  async saveLoveNote({ text, stationeryId, senderName, imageUri, invisibleInk = false }) {
    const kt = keyTier();
    const cid = kt === 'couple' ? _coupleId : null;

    // Pre-check: if couple tier is required, make sure the key exists
    if (kt === 'couple' && !_coupleKeyAvailable) {
      // Re-check in case it became available after init
      _coupleKeyAvailable = await E2EEncryption.hasCoupleKey(_coupleId);
      if (!_coupleKeyAvailable) {
        throw new Error(
          'COUPLE_KEY_MISSING: Your partner encryption key is not available yet. ' +
          'Please make sure both partners have completed pairing.'
        );
      }
    }

    const textCipher = text
      ? await E2EEncryption.encryptString(text, kt, cid)
      : null;
    const senderCipher = senderName
      ? await E2EEncryption.encryptString(senderName, kt, cid)
      : null;

    let mediaRef = null;
    if (imageUri) {
      const att = await EncryptedAttachments.encryptAndStore({
        sourceUri: imageUri,
        fileName: `love_note_${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        userId: _userId,
        coupleId: _coupleId,
        parentType: 'love_note',
        parentId: null, // linked after insert
        keyTier: kt,
      });
      mediaRef = att.id;
    }

    const row = await Database.insertLoveNote({
      user_id: _userId,
      couple_id: _coupleId,
      text_cipher: textCipher,
      stationery_id: stationeryId || null,
      sender_name_cipher: senderCipher,
      media_ref: mediaRef,
      is_read: true, // sender has "read" their own note
      is_invisible_ink: !!invisibleInk,
    });

    // Link the attachment to this note
    if (mediaRef) {
      try {
        const db = await Database.init();
        await db.runAsync(
          `UPDATE attachments SET parent_id = ? WHERE id = ?`,
          [row.id, mediaRef]
        );
      } catch (err) {
        console.warn('[DataLayer] Failed to link attachment to love note:', err?.message);
        try { await EncryptedAttachments.deleteAttachment(mediaRef); } catch { /* ok */ }
        throw new Error('Failed to attach image to note');
      }
    }

    debouncedPush();
    return row;
  },

  /**
   * Get all love notes for the couple, decrypted.
   * Returns notes from BOTH partners (sorted newest-first).
   */
  async getLoveNotes({ limit = 100, offset = 0 } = {}) {
    const rows = await Database.getLoveNotes(_userId, _coupleId, { limit, offset });
    return Promise.all((rows || []).map(r => this._decryptLoveNote(r)));
  },

  /**
   * Get a single love note by ID, decrypted.
   */
  async getLoveNote(id) {
    const row = await Database.getLoveNoteById(id, _coupleId);
    return row ? this._decryptLoveNote(row) : null;
  },

  /**
   * Mark a love note as read (for the receiving partner).
   */
  async markLoveNoteRead(id) {
    const result = await Database.markLoveNoteRead(id, _userId, _coupleId);
    debouncedPush();
    return result;
  },

  /** Soft-delete all expired love notes and push deletion to sync. */
  async purgeExpiredLoveNotes() {
    await Database.purgeExpiredLoveNotes();
    debouncedPush();
  },

  /**
   * Soft-delete a love note.
   */
  async deleteLoveNote(id) {
    // Also clean up the encrypted attachment file
    const note = await Database.getLoveNoteById(id, _coupleId);
    if (note?.media_ref) {
      try {
        await EncryptedAttachments.deleteAttachment(note.media_ref);
      } catch { /* ok — attachment may already be gone */ }
    }
    await Database.softDeleteLoveNote(id);
    debouncedPush();
  },

  /**
   * Count unread love notes (notes sent by the partner).
   */
  async getUnreadLoveNoteCount() {
    return Database.getUnreadLoveNoteCount(_userId, _coupleId);
  },

  /**
   * Get a decrypted local URI for a love note's photo.
   * Returns null if the note has no attachment.
   */
  async getLoveNoteImageUri(mediaRef) {
    if (!mediaRef) return null;
    try {
      return await EncryptedAttachments.getDecryptedUri(
        mediaRef, keyTier(), _coupleId
      );
    } catch (err) {
      console.warn('[DataLayer] Love note image decryption failed:', err?.message);
      return null;
    }
  },

  /** @private */
  async _decryptLoveNote(row) {
    if (!row) return null;
    const info = E2EEncryption.inspect(row.text_cipher);
    const kt = info?.keyTier || keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    try {
      // Decrypt the photo to a temp URI if present
      let decryptedImageUri = null;
      if (row.media_ref) {
        try {
          decryptedImageUri = await EncryptedAttachments.getDecryptedUri(
            row.media_ref, kt, cid
          );
        } catch { /* photo may be still uploading/downloading */ }
      }

      return {
        id: row.id,
        text: await E2EEncryption.decryptString(row.text_cipher, kt, cid),
        stationeryId: row.stationery_id,
        senderName: row.sender_name_cipher
          ? await E2EEncryption.decryptString(row.sender_name_cipher, kt, cid)
          : null,
        imageUri: decryptedImageUri,
        mediaRef: row.media_ref,
        isRead: !!row.is_read,
        readAt: row.read_at,
        expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : null,
        isOwn: row.user_id === _userId || row.user_id === _legacyLocalUserId,
        userId: row.user_id,
        invisibleInk: !!row.is_invisible_ink,
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
      };
    } catch (err) {
      console.warn('[DataLayer] Love note decryption failed:', err?.message);
      return {
        id: row.id,
        text: null,
        stationeryId: row.stationery_id,
        senderName: null,
        imageUri: null,
        isRead: !!row.is_read,
        expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : null,
        isOwn: row.user_id === _userId || row.user_id === _legacyLocalUserId,
        invisibleInk: !!row.is_invisible_ink,
        createdAt: new Date(row.created_at).getTime(),
        locked: true,
      };
    }
  },

  // ─── Attachments ──────────────────────────────────────────────

  async addAttachment(opts) {
    return EncryptedAttachments.encryptAndStore({
      ...opts,
      userId: _userId,
      coupleId: _coupleId,
      keyTier: keyTier(),
    });
  },

  async getDecryptedAttachment(attachmentId) {
    return EncryptedAttachments.getDecryptedUri(
      attachmentId, keyTier(), _coupleId
    );
  },

  async deleteAttachment(attachmentId) {
    return EncryptedAttachments.deleteAttachment(attachmentId);
  },

  // ─── Sync controls ───────────────────────────────────────────

  /** Trigger a full sync cycle. */
  async sync() {
    return SyncEngine.sync();
  },

  /**
   * Pull only — bypasses the sync throttle. Use when you need the freshest
   * remote data immediately (e.g. inbox open, deep link landing).
   */
  async pullNow() {
    return SyncEngine.pullNow();
  },

  /** Subscribe to realtime changes from partner. Returns unsubscribe fn. */
  subscribeRealtime() {
    return SyncEngine.subscribeRealtime();
  },

  /** Listen to sync lifecycle events. Returns unsubscribe fn. */
  onSyncEvent(fn) {
    return SyncEngine.onSyncEvent(fn);
  },

  /** Purge soft-deleted rows older than N days. */
  async purgeOldData(daysOld = 30) {
    return Database.purgeDeleted(daysOld);
  },

  /** Clean up temp decrypted files. */
  async clearCache() {
    return EncryptedAttachments.clearDecryptedCache();
  },
};

export default DataLayer;

