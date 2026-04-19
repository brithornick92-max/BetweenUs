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
import PushNotificationService from '../PushNotificationService';
import PartnerNotifications from '../PartnerNotifications';
import CoupleKeyService from '../security/CoupleKeyService';
import SyncEngine from '../sync/SyncEngine';
import naclUtil from 'tweetnacl-util';
import { storage, promptStorage, journalStorage, STORAGE_KEYS } from '../../utils/storage';
import { getPromptById } from '../../utils/contentLoader';

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

async function resolveRemoteUserId() {
  const { supabase } = getSupabaseConfigSync();

  if (supabase) {
    try {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id && isUuid(data.user.id)) {
        return data.user.id;
      }
    } catch (_) {}
  }

  return isUuid(_userId) ? _userId : null;
}

async function ensureLocalIdentityState() {
  if (!_userId) {
    const { supabase } = getSupabaseConfigSync();
    let resolvedUserId = null;

    if (supabase) {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user?.id) {
          resolvedUserId = data.user.id;
        }
      } catch (_) {}
    }

    if (!resolvedUserId) {
      resolvedUserId = await storage.get(STORAGE_KEYS.USER_ID, null);
    }

    if (resolvedUserId) {
      _userId = resolvedUserId;
    }
  }

  if (_coupleId === null || _coupleId === undefined) {
    _coupleId = await storage.get(STORAGE_KEYS.COUPLE_ID, null);
  }

  if (_coupleId && !_coupleKeyAvailable) {
    _coupleKeyAvailable = await E2EEncryption.hasCoupleKey(_coupleId);
  }

  return { userId: _userId, coupleId: _coupleId };
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

function buildCalendarPartnerNotification(event, eventId) {
  const eventType = event?.eventType || (event?.isDateNight ? 'dateNight' : 'general');
  const title = eventType === 'dateNight' ? 'New date plan' : 'New shared event';
  const eventTitle = event?.title?.trim() || 'A new plan';
  const body = `${eventTitle} was added to your timeline.`;

  return {
    title,
    body,
    data: {
      type: 'calendar_event_created',
      route: 'calendar',
      eventId,
      eventType,
    },
  };
}

async function notifyPartnerAboutCalendarEvent(supabase, event, eventId) {
  if (!supabase || !_coupleId || !eventId) return;

  const notificationPayload = buildCalendarPartnerNotification(event, eventId);
  await PushNotificationService.notifyPartner(supabase, notificationPayload);
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

async function tryRestoreCoupleKey() {
  if (!_coupleId) return false;

  const { supabase, TABLES } = getSupabaseConfigSync();
  if (!supabase || !TABLES?.COUPLE_MEMBERS) return false;

  try {
    const currentPublicKey = await CoupleKeyService.getDevicePublicKeyB64();
    const { data: authData } = await supabase.auth.getUser();
    const remoteUserId = authData?.user?.id;
    if (!remoteUserId) return false;

    const { data: myMembership, error: myMembershipError } = await supabase
      .from(TABLES.COUPLE_MEMBERS)
      .select('public_key')
      .eq('couple_id', _coupleId)
      .eq('user_id', remoteUserId)
      .maybeSingle();
    if (myMembershipError) throw myMembershipError;

    // Only attempt restoration if this device still has the same keypair
    // that was originally registered for this couple membership.
    if (!myMembership?.public_key || myMembership.public_key !== currentPublicKey) {
      return false;
    }

    const { data: partnerMembership, error: partnerMembershipError } = await supabase
      .from(TABLES.COUPLE_MEMBERS)
      .select('public_key')
      .eq('couple_id', _coupleId)
      .neq('user_id', remoteUserId)
      .maybeSingle();
    if (partnerMembershipError) throw partnerMembershipError;
    if (!partnerMembership?.public_key) return false;

    const partnerPublicKey = naclUtil.decodeBase64(partnerMembership.public_key);
    const coupleKey = await CoupleKeyService.deriveFromKeyExchange(partnerPublicKey);
    await CoupleKeyService.storeCoupleKey(_coupleId, coupleKey);
    _coupleKeyAvailable = true;
    return true;
  } catch (error) {
    if (__DEV__) console.warn('[DataLayer] Couple key restore failed:', error?.message);
    return false;
  }
}

async function resolveLocalWriteTier({ syncSource = 'local', allowRemoteCacheFallback = false } = {}) {
  await ensureLocalIdentityState();
  const kt = keyTier();
  if (kt !== 'couple') {
    return { keyTier: kt, coupleId: null };
  }

  if (_coupleKeyAvailable) {
    return { keyTier: 'couple', coupleId: _coupleId };
  }

  _coupleKeyAvailable = await E2EEncryption.hasCoupleKey(_coupleId);
  if (_coupleKeyAvailable) {
    return { keyTier: 'couple', coupleId: _coupleId };
  }

  _coupleKeyAvailable = await tryRestoreCoupleKey();
  if (_coupleKeyAvailable) {
    return { keyTier: 'couple', coupleId: _coupleId };
  }

  if (allowRemoteCacheFallback && syncSource === 'remote') {
    return { keyTier: 'device', coupleId: null };
  }

  throw new Error(
    'COUPLE_KEY_MISSING: Your partner encryption key is not available yet. ' +
    'Please make sure both partners have completed pairing.'
  );
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
    SyncEngine.pushNow().catch((err) => {
      if (__DEV__) console.warn('[DataLayer] Background push failed:', err?.message);
    });
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
        SyncEngine.pullNow().catch((err) => {
          if (__DEV__) console.warn('[DataLayer] Initial pull failed:', err.message);
        });
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
      if (__DEV__) console.warn('[DataLayer] Legacy migration failed:', error?.message);
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
    // Flush any pending writes before tearing down
    if (_pushTimer) {
      clearTimeout(_pushTimer);
      _pushTimer = null;
      try { await SyncEngine.pushNow(); } catch (e) { if (__DEV__) console.warn('[DataLayer] flush before reset failed:', e?.message); }
    }
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

  async saveJournalEntry({ title, body, mood, tags, isPrivate = false, imageUri = null }) {
    await ensureLocalIdentityState();

    // Private entries always use device key; shared entries must resolve
    // the active write tier and couple-key availability first.
    const { keyTier: kt, coupleId } = isPrivate
      ? { keyTier: deviceTier(), coupleId: null }
      : await resolveLocalWriteTier();
    const cid = kt === 'couple' ? coupleId : null;
    const titleCipher = await E2EEncryption.encryptString(title, kt, cid);
    const bodyCipher = await E2EEncryption.encryptString(body, kt, cid);

    // Encrypt sensitive metadata — keep coarse buckets unencrypted for sorting
    const moodCipher = mood ? await E2EEncryption.encryptString(mood, kt, cid) : null;
    const tagsCipher = tags?.length ? await E2EEncryption.encryptJson(tags, kt, cid) : null;

    const row = await Database.insertJournal({
      user_id: _userId,
      couple_id: isPrivate ? null : coupleId,
      title_cipher: titleCipher,
      body_cipher: bodyCipher,
      mood,       // unencrypted coarse label for local calendar/filters
      mood_cipher: moodCipher,  // encrypted exact value for Supabase
      tags,
      tags_cipher: tagsCipher,  // encrypted exact value for Supabase
      is_private: isPrivate,
      photo_uri: imageUri || null,
    });

    debouncedPush();

    // Notify partner when sharing a journal entry (not private)
    if (!isPrivate) {
      PartnerNotifications.journalShared().catch(() => {});
    }

    return row;
  },

  async updateJournalEntry(id, { title, body, mood, tags, isPrivate, imageUri }) {
    await ensureLocalIdentityState();

    const updates = {};
    // Use device key for private entries; shared updates must resolve
    // the active write tier and couple-key availability first.
    const { keyTier: kt, coupleId } = isPrivate === true
      ? { keyTier: deviceTier(), coupleId: null }
      : await resolveLocalWriteTier();
    const cid = kt === 'couple' ? coupleId : null;

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
    if (mood !== undefined) updates.mood_cipher = mood ? await E2EEncryption.encryptString(mood, kt, cid) : null;
    if (tags !== undefined) updates.tags = tags;
    if (tags !== undefined) updates.tags_cipher = tags?.length ? await E2EEncryption.encryptJson(tags, kt, cid) : null;
    if (isPrivate !== undefined) updates.is_private = isPrivate;
    if (isPrivate !== undefined) updates.couple_id = isPrivate ? null : coupleId;
    if (imageUri !== undefined) updates.photo_uri = imageUri ?? null;

    const row = await Database.updateJournal(id, updates);
    debouncedPush();
    return row;
  },

  async deleteJournalEntry(id) {
    await Database.softDeleteJournal(id);
    debouncedPush();
  },

  async getJournalEntries({ limit = 50, offset = 0, mood, visibility } = {}) {
    const rows = visibility
      ? await Database.getJournalFeed(_userId, { coupleId: _coupleId, limit, offset, mood, visibility })
      : await Database.getJournals(_userId, { limit, offset, mood });
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
    const cid = kt === 'couple' ? (row.couple_id || _coupleId) : null;
    try {
      const decryptedMood = row.mood_cipher
        ? await E2EEncryption.decryptString(row.mood_cipher, kt, cid).catch(() => null)
        : null;
      const decryptedTags = row.tags_cipher
        ? await E2EEncryption.decryptJson(row.tags_cipher, kt, cid).catch(() => null)
        : null;
      return {
        ...row,
        title: await E2EEncryption.decryptString(row.title_cipher, kt, cid),
        body: await E2EEncryption.decryptString(row.body_cipher, kt, cid),
        mood: row.mood ?? decryptedMood ?? null,
        tags: row.tags ? JSON.parse(row.tags) : (decryptedTags || []),
        is_private: !!row.is_private,
      };
    } catch (err) {
      // Decryption failed — return with locked flag
      if (__DEV__) console.warn('[DataLayer] Journal decryption failed:', err?.message);
      return { ...row, mood: row.mood ?? null, title: null, body: null, tags: [], locked: true };
    }
  },

  // ─── Prompt Answers ───────────────────────────────────────────

  async savePromptAnswer({ promptId, answer, heatLevel }) {
    await ensureLocalIdentityState();
    const kt = keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    const resolvedHeatLevel = typeof heatLevel === 'number'
      ? heatLevel
      : (getPromptById(promptId)?.heat || 1);
    const answerCipher = await E2EEncryption.encryptString(answer, kt, cid);
    const heatCipher = await E2EEncryption.encryptString(String(resolvedHeatLevel), kt, cid);
    const dk = dateKey();

    const existing = await Database.getPromptAnswerByPromptAndDate(_userId, promptId, dk);
    const row = existing
      ? await Database.updatePromptAnswer(existing.id, {
          answer_cipher: answerCipher,
          heat_level: resolvedHeatLevel,
          heat_level_cipher: heatCipher,
        })
      : await Database.insertPromptAnswer({
          user_id: _userId,
          couple_id: _coupleId,
          prompt_id: promptId,
          date_key: dk,
          answer_cipher: answerCipher,
          heat_level: resolvedHeatLevel,
          heat_level_cipher: heatCipher,
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
    await ensureLocalIdentityState();
    const info = E2EEncryption.inspect(row.answer_cipher);
    const kt = info?.keyTier || keyTier();
    const cid = kt === 'couple' ? (row.couple_id || _coupleId) : null;
    const promptHeat = getPromptById(row.prompt_id)?.heat;
    if (kt === 'couple' && !cid) {
      return {
        ...row,
        heat_level: typeof promptHeat === 'number' ? promptHeat : (row.heat_level ?? 1),
        answer: null,
        partnerAnswer: null,
        locked: true,
      };
    }
    try {
      return {
        ...row,
        heat_level: typeof promptHeat === 'number' ? promptHeat : (row.heat_level ?? 1),
        answer: await E2EEncryption.decryptString(row.answer_cipher, kt, cid),
        partnerAnswer: row.partner_answer_cipher
          ? await E2EEncryption.decryptString(row.partner_answer_cipher, kt, cid)
          : null,
        is_revealed: !!row.is_revealed,
      };
    } catch (err) {
      if (err?.message !== 'E2EE: couple key requested but no coupleId provided') {
        if (__DEV__) console.warn('[DataLayer] Prompt answer decryption failed:', err?.message);
      }
      return {
        ...row,
        heat_level: typeof promptHeat === 'number' ? promptHeat : (row.heat_level ?? 1),
        answer: null,
        partnerAnswer: null,
        locked: true,
      };
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
      if (__DEV__) console.warn('[DataLayer] Memory decryption failed:', err?.message);
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
    const { keyTier: kt, coupleId: cid } = await resolveLocalWriteTier({
      syncSource,
      allowRemoteCacheFallback: true,
    });
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
    await this.healLegacyCalendarDeletes({ limit: Math.min(limit, 200) });
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
        }
      } catch (error) {
        if (__DEV__) console.warn('[DataLayer] Calendar remote refresh failed:', error?.message);
      }
    }

    return this.getCalendarEvents({ limit });
  },

  async healLegacyCalendarDeletes({ limit = 200 } = {}) {
    if (!_userId) {
      return 0;
    }

    const rows = await Database.getPendingDeletedRemoteCalendarEvents(_userId, { limit });
    let restored = 0;

    for (const row of rows || []) {
      await Database.restoreCalendarEvent(row.id, { syncStatus: 'synced', syncSource: 'remote' });
      await Database.restoreDatePlansBySourceEvent(row.id, { syncStatus: 'synced', syncSource: 'remote' });
      restored += 1;
    }

    return restored;
  },

  async pushPendingCalendarEvents({ limit = 200 } = {}) {
    const { supabase, TABLES } = getSupabaseConfigSync();
    if (!supabase || !_coupleId || !_userId) {
      return { pushed: 0, deleted: 0, failed: 0 };
    }

    const remoteUserId = await resolveRemoteUserId();
    if (!remoteUserId) {
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
            .upsert({
              id: row.id,
              couple_id: _coupleId,
              title: event.title,
              description: event.notes || null,
              event_date: new Date(event.whenTs).toISOString(),
              event_type: event.eventType || 'general',
              location: event.location || null,
              metadata,
              created_by: remoteUserId,
            }, { onConflict: 'id' });
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
            created_by: remoteUserId,
          })
          .select('id')
          .single();
        if (error || !inserted?.id) throw error || new Error('Calendar remote insert failed');

        await Database.replaceCalendarEventId(row.id, inserted.id);
        await notifyPartnerAboutCalendarEvent(supabase, event, inserted.id);
        pushed += 1;
      } catch (error) {
        if (__DEV__) console.warn('[DataLayer] Pending calendar push failed:', error?.message);
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
    const remoteUserId = await resolveRemoteUserId();

    if (supabase && _coupleId && remoteUserId) {
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
            created_by: remoteUserId,
          })
          .select('id')
          .single();

        if (!error && inserted?.id) {
          remoteId = inserted.id;
          remoteSynced = true;
          await notifyPartnerAboutCalendarEvent(supabase, event, inserted.id);
        }
      } catch (error) {
        if (__DEV__) console.warn('[DataLayer] Calendar remote create failed:', error?.message);
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

  async updateCalendarEvent(event) {
    const { supabase, TABLES } = getSupabaseConfigSync();
    const eventId = event?.id;
    if (!eventId) {
      throw new Error('Calendar event id is required for updates');
    }

    const metadata = buildCalendarMetadata(event);
    const datePlan = buildDatePlanFromEvent(event, eventId);
    const linkedPlans = await Database.getDatePlansBySourceEvent(_userId, eventId);
    const primaryPlan = linkedPlans?.[0] || null;
    let remoteSynced = false;

    if (supabase && (event?.isRemote || event?.supabaseId || isUuid(eventId))) {
      try {
        const payload = {
          title: event?.title?.trim(),
          description: event?.notes || null,
          event_date: new Date(event.whenTs).toISOString(),
          event_type: event?.eventType || 'general',
          location: event?.location || null,
          metadata: {
            ...metadata,
            ...(datePlan ? { myDateData: buildDatePlanFromEvent(event, null) } : {}),
          },
        };

        if (!datePlan) {
          delete payload.metadata.myDateData;
        }

        const { error } = await supabase
          .from(TABLES.CALENDAR_EVENTS)
          .update(payload)
          .eq('id', event?.supabaseId || eventId);

        if (error) throw error;
        remoteSynced = true;
      } catch (error) {
        if (__DEV__) console.warn('[DataLayer] Calendar remote update failed:', error?.message);
      }
    }

    const savedEvent = await this.saveCalendarEvent({
      ...event,
      id: eventId,
      metadata,
      updatedAt: Date.now(),
    }, {
      syncSource: remoteSynced ? 'remote' : 'local',
      markSynced: remoteSynced,
    });

    if (datePlan) {
      await this.saveDatePlan({
        ...datePlan,
        id: primaryPlan?.id,
        sourceEventId: eventId,
        createdAt: primaryPlan?.created_at || event?.createdAt || Date.now(),
        updatedAt: Date.now(),
      }, {
        syncSource: remoteSynced ? 'remote' : 'local',
        markSynced: remoteSynced,
      });
    } else {
      for (const plan of linkedPlans || []) {
        await Database.softDeleteDatePlan(plan.id);
      }
      if (remoteSynced) {
        await Database.markDatePlansSyncedBySourceEvent(eventId, { syncSource: 'remote' });
      }
    }

    return { ...savedEvent, remoteSynced };
  },

  async getCalendarEvents({ limit = 1000 } = {}) {
    const rows = await Database.getCalendarEvents(_userId, { limit });
    return Promise.all((rows || []).map(r => this._decryptCalendarEvent(r)));
  },

  async deleteCalendarEvent(id, { deleteRemote = false, remoteId, markSyncedAfterDelete = false } = {}) {
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
        if (__DEV__) console.warn('[DataLayer] Calendar remote delete failed:', error?.message);
        throw error;
      }
    }

    await Database.softDeleteCalendarEvent(id);
    for (const plan of linkedPlans || []) {
      await Database.softDeleteDatePlan(plan.id);
    }

    if ((deleteRemote || markSyncedAfterDelete) && isUuid(remoteId || id)) {
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
        async (payload) => {
          const deletedEventId = payload?.eventType === 'DELETE' ? payload?.old?.id : null;

          if (deletedEventId) {
            await this.deleteCalendarEvent(deletedEventId, { markSyncedAfterDelete: true });
          } else {
            await this.refreshCalendarEventsFromRemote();
          }

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
    const cid = kt === 'couple' ? (row.couple_id || _coupleId) : null;
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
      if (__DEV__) console.warn('[DataLayer] Calendar event decryption failed:', err?.message);
      return {
        id: row.id,
        title: 'Locked shared event',
        location: '',
        notes: '',
        eventType: row.event_type || 'general',
        isDateNight: !!row.is_date_night,
        whenTs: Number(row.when_ts),
        notify: !!row.notify,
        notifyMins: Number(row.notify_mins ?? 60) || 60,
        notificationId: row.notification_id || null,
        metadata: {},
        createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
        updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
        isRemote: row.sync_source === 'remote',
        supabaseId: row.sync_source === 'remote' ? row.id : null,
        locked: true,
      };
    }
  },

  // ─── Date Plans ───────────────────────────────────────────────

  async saveDatePlan(plan, { syncSource = 'local', markSynced = false } = {}) {
    const { keyTier: kt, coupleId: cid } = await resolveLocalWriteTier({
      syncSource,
      allowRemoteCacheFallback: true,
    });
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
    const cid = kt === 'couple' ? (row.couple_id || _coupleId) : null;
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
      if (__DEV__) console.warn('[DataLayer] Date plan decryption failed:', err?.message);
      return {
        id: row.id,
        title: 'Locked date plan',
        sourceEventId: row.source_event_id || null,
        locationType: 'home',
        heat: 2,
        load: 2,
        style: 'mixed',
        steps: [],
        createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
        updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
        isRemote: row.sync_source === 'remote',
        locked: true,
      };
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
    await ensureLocalIdentityState();
    const { keyTier: kt, coupleId: cid } = await resolveLocalWriteTier();

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
        if (__DEV__) console.warn('[DataLayer] Failed to link attachment to love note:', err?.message);
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
      if (__DEV__) console.warn('[DataLayer] Love note image decryption failed:', err?.message);
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
        } catch (imgErr) {
          if (__DEV__) console.warn('[DataLayer] Love note image decrypt failed:', imgErr?.message);
        }
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
      if (__DEV__) console.warn('[DataLayer] Love note decryption failed:', err?.message);
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

