/**
 * DataLayer.js — Unified local cache + Supabase sync access layer
 *
 * This is the single entry point the rest of the app should use for
 * reading/writing user data. It:
 *
 *   1. Writes canonical app data to SQLite as a local cache / offline queue
 *   2. Triggers background sync to Supabase (if premium + coupled)
 *   3. Falls back to legacy E2EE reads only for older rows not yet migrated
 *
 * Think of it as a replacement for the scattered direct calls to
 * AsyncStorage / LocalStorageService. Screens and contexts import
 * DataLayer instead.
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
import CouplePresenceService from '../couple/CouplePresenceService';
import SyncEngine from '../sync/SyncEngine';
import * as naclUtil from 'tweetnacl-util';
import { storage, promptStorage, journalStorage, STORAGE_KEYS } from '../../utils/storage';
import { getPromptById } from '../../utils/contentLoader';

// ─── Helpers ────────────────────────────────────────────────────────

let _userId = null;
let _legacyLocalUserId = null; // old Crypto.randomUUID() for isOwn on pre-fix notes
let _coupleId = null;
let _isPremium = false;
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
      resolvedUserId = await (await import('../../utils/storage')).userStorage.getUserId();
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

async function ensureVerifiedCoupleState({ requireRemoteCheck = false } = {}) {
  await ensureLocalIdentityState();

  if (!_coupleId) {
    _coupleKeyAvailable = false;
    return { coupleId: null, hasCoupleKey: false, status: 'unpaired' };
  }

  const verified = await CouplePresenceService.getVerifiedCoupleState({
    currentCoupleId: _coupleId,
    userId: _userId,
    requireRemoteCheck,
  });

  _coupleId = verified.coupleId || null;
  _coupleKeyAvailable = !!verified.hasCoupleKey;
  SyncEngine.configure({ userId: _userId, coupleId: _coupleId, isPremium: _isPremium });

  return verified;
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
      .select('public_key, wrapped_couple_key')
      .eq('couple_id', _coupleId)
      .eq('user_id', remoteUserId)
      .maybeSingle();
    if (myMembershipError) throw myMembershipError;

    if (myMembership?.wrapped_couple_key) {
      const unwrapped = await CoupleKeyService.unwrapKeyForDevice(myMembership.wrapped_couple_key);
      if (unwrapped?.length === 32) {
        await CoupleKeyService.storeCoupleKey(_coupleId, unwrapped);
        _coupleKeyAvailable = true;
        return true;
      }
    }

    // Legacy fallback: only attempt direct re-derivation if this device still
    // has the same keypair that was originally registered for this membership.
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

function parseJsonValue(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseTagsValue(value) {
  return Array.isArray(value) ? value : (parseJsonValue(value, []) || []);
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

async function flushWriteThrough() {
  if (SyncEngine.isConfigured) {
    try {
      if (_pushTimer) {
        clearTimeout(_pushTimer);
        _pushTimer = null;
      }
      await SyncEngine.pushNow();
      return;
    } catch (err) {
      if (__DEV__) console.warn('[DataLayer] Immediate push failed, falling back to debounce:', err?.message);
    }
  }

  debouncedPush();
}

async function enforceCoupleVisibilityPolicy() {
  if (!_userId || !_coupleId) return;

  try {
    const db = await Database.init();
    const ts = new Date().toISOString();

    const journalRows = await db.getAllAsync(
      `SELECT id, title, body, title_cipher, body_cipher, mood, mood_cipher, tags, tags_cipher, couple_id
       FROM journal_entries
       WHERE user_id = ?
         AND deleted_at IS NULL
         AND (is_private = 1 OR couple_id IS NULL)`,
      [_userId]
    );

    for (const row of journalRows || []) {
      try {
        let title = row.title ?? null;
        let body = row.body ?? null;
        let moodPlain = row.mood ?? null;
        let tagsPlain = parseTagsValue(row.tags);

        if ((!title || !body || (!moodPlain && row.mood_cipher) || (!row.tags && row.tags_cipher)) && row.title_cipher) {
          const titleInfo = E2EEncryption.inspect(row.title_cipher);
          const sourceKt = titleInfo?.keyTier || 'device';
          const sourceCid = sourceKt === 'couple' ? (row.couple_id || _coupleId) : null;
          title = title ?? await E2EEncryption.decryptString(row.title_cipher, sourceKt, sourceCid);
          body = body ?? await E2EEncryption.decryptString(row.body_cipher, sourceKt, sourceCid);
          if (!moodPlain && row.mood_cipher) {
            moodPlain = await E2EEncryption.decryptString(row.mood_cipher, sourceKt, sourceCid).catch(() => row.mood ?? null);
          }
          if (!row.tags && row.tags_cipher) {
            tagsPlain = await E2EEncryption.decryptJson(row.tags_cipher, sourceKt, sourceCid).catch(() => parseTagsValue(row.tags));
          }
        }

        if (!title && !body) continue;

        await db.runAsync(
          `UPDATE journal_entries
           SET title = ?,
               body = ?,
               title_cipher = NULL,
               body_cipher = NULL,
               mood = ?,
               mood_cipher = NULL,
               tags = ?,
               tags_cipher = NULL,
               is_private = 0,
               couple_id = ?,
               updated_at = ?,
               sync_status = 'pending',
               sync_version = sync_version + 1
           WHERE id = ?`,
          [
            title,
            body,
            moodPlain,
            tagsPlain ? JSON.stringify(tagsPlain) : null,
            _coupleId,
            ts,
            row.id,
          ]
        );
      } catch (rowErr) {
        if (__DEV__) console.warn('[DataLayer] Journal visibility migration skipped row:', rowErr?.message);
      }
    }

    const memoryRows = await db.getAllAsync(
      `SELECT id, body, body_cipher, mood, mood_cipher, couple_id
       FROM memories
       WHERE user_id = ?
         AND deleted_at IS NULL
         AND (is_private = 1 OR couple_id IS NULL)`,
      [_userId]
    );

    for (const row of memoryRows || []) {
      try {
        let content = row.body ?? null;
        let moodPlain = row.mood ?? null;

        if ((!content || (!moodPlain && row.mood_cipher)) && row.body_cipher) {
          const info = E2EEncryption.inspect(row.body_cipher);
          const sourceKt = info?.keyTier || 'device';
          const sourceCid = sourceKt === 'couple' ? (row.couple_id || _coupleId) : null;
          content = content ?? await E2EEncryption.decryptString(row.body_cipher, sourceKt, sourceCid);
          if (!moodPlain && row.mood_cipher) {
            moodPlain = await E2EEncryption.decryptString(row.mood_cipher, sourceKt, sourceCid).catch(() => row.mood ?? null);
          }
        }

        if (!content) continue;

        await db.runAsync(
          `UPDATE memories
           SET body = ?,
               body_cipher = NULL,
               mood = ?,
               mood_cipher = NULL,
               is_private = 0,
               couple_id = ?,
               updated_at = ?,
               sync_status = 'pending',
               sync_version = sync_version + 1
           WHERE id = ?`,
          [content, moodPlain, _coupleId, ts, row.id]
        );
      } catch (rowErr) {
        if (__DEV__) console.warn('[DataLayer] Memory visibility migration skipped row:', rowErr?.message);
      }
    }

    debouncedPush();
  } catch (error) {
    if (__DEV__) console.warn('[DataLayer] Failed enforcing shared visibility policy:', error?.message);
  }
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
    _isPremium = !!isPremium;

    // Check if the couple key is actually available
    if (coupleId) {
      _coupleKeyAvailable = await E2EEncryption.hasCoupleKey(coupleId);
      if (!_coupleKeyAvailable) {
        _coupleKeyAvailable = await tryRestoreCoupleKey();
      }
    } else {
      _coupleKeyAvailable = false;
    }

    await Database.init();
    await enforceCoupleVisibilityPolicy();

    SyncEngine.configure({ userId: _userId, coupleId: _coupleId, isPremium: _isPremium });
    await enforceCoupleVisibilityPolicy();

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
    if (isPremium !== undefined) _isPremium = !!isPremium;

    // Re-check couple key availability
    if (coupleId) {
      _coupleKeyAvailable = await E2EEncryption.hasCoupleKey(coupleId);
      if (!_coupleKeyAvailable) {
        _coupleKeyAvailable = await tryRestoreCoupleKey();
      }
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
      if (!alreadyMigrated) {
        const legacyPrompts = await promptStorage.getAll();
        for (const [dk, byDate] of Object.entries(legacyPrompts || {})) {
          for (const [promptId, payload] of Object.entries(byDate || {})) {
            const answer = payload?.answer || payload?.content;
            if (!answer || !String(answer).trim()) continue;

            const existing = await Database.getPromptAnswerByPromptAndDate(_userId, String(promptId), dk);
            if (existing) continue;

            const heatLevel = Number(payload?.heatLevel ?? payload?.heat_level ?? 5) || 5;

            await Database.insertPromptAnswer({
              id: payload?.id,
              user_id: _userId,
              couple_id: _coupleId,
              prompt_id: String(promptId),
              date_key: dk,
              answer,
              heat_level: heatLevel,
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

          await Database.insertJournal({
            id: entry.id,
            user_id: _userId,
            couple_id: _coupleId || null,
            title,
            body,
            mood: entry?.mood ?? null,
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

  async getCoupleStateStatus({ requireRemoteCheck = false } = {}) {
    return ensureVerifiedCoupleState({ requireRemoteCheck });
  },

  /**
   * Full reset (sign-out / account delete).
   */
  async reset({ clearLocalData = false } = {}) {
    const resetUserId = _userId;
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
    await SyncEngine.reset({ clearLocalData, userId: resetUserId });
  },

  // ─── Journal ──────────────────────────────────────────────────


  async _writeCloudFirst(tableName, localDraft, offlineMethod, ...offlineArgs) {
    if (SyncEngine.isConfigured) {
      try {
        const remoteAcknowledge = await SyncEngine.pushSingleRecord(tableName, localDraft);
        // Hydrated!
        return remoteAcknowledge;
      } catch (err) {
        if (__DEV__) console.warn('[DataLayer] Cloud-first write failed:', err?.message);
      }
    }
    
    // Offline Path / Fallback
    const localResult = await Database[offlineMethod](...offlineArgs);
    debouncedPush();
    return localResult;
  },

  async saveJournalEntry({  title, body, mood, tags, isPrivate = false, imageUri = null, mediaUri, mimeType, fileName , _createdAt, _updatedAt }) { 
    await ensureLocalIdentityState();

    const forceShared = true;
    const coupleId = _coupleId || null;

    let mediaRef = null;
    if (mediaUri) {
      const att = await EncryptedAttachments.encryptAndStore({
        sourceUri: mediaUri,
        fileName: fileName || 'journal_attachment',
        mimeType: mimeType || 'video/quicktime',
        userId: _userId,
        coupleId,
        parentType: 'journal',
        parentId: null,
        keyTier: coupleId ? 'couple' : 'device',
      });
      mediaRef = att.id;
    }

    const draft = {
      id: Database.makeId('jrn'),
      user_id: _userId,
      couple_id: coupleId,
      title,
      body,
      title_cipher: null,
      body_cipher: null,
      mood,
      mood_cipher: null,
      tags,
      tags_cipher: null,
      is_private: false,
      photo_uri: mediaRef ? null : (imageUri || null),
      media_ref: mediaRef,
      created_at: _createdAt || new Date().toISOString(),
      updated_at: _updatedAt || new Date().toISOString()
    };
    const row = await this._writeCloudFirst('journal_entries', draft, 'insertJournal', draft);

    if (mediaRef && row?.id) {
      try {
        const db = await Database.init();
        await db.runAsync(
          `UPDATE attachments SET parent_id = ? WHERE id = ?`,
          [row.id, mediaRef]
        );
      } catch (err) {
        if (__DEV__) console.warn('[DataLayer] Failed to link attachment to journal:', err?.message);
        try { await EncryptedAttachments.deleteAttachment(mediaRef); } catch { /* ok */ }
        throw new Error('Failed to attach media to journal');
      }
    }

    await flushWriteThrough();

    // Notify partner when sharing a journal entry (not private)
    if (forceShared) {
      PartnerNotifications.journalShared().catch(() => {});
    }

    return row;
  },

  async updateJournalEntry(id, { title, body, mood, tags, imageUri, mediaUri, mimeType, fileName }) {
    await ensureLocalIdentityState();

    const updates = {};
    const coupleId = _coupleId || null;

    let effectiveTitle = title;
    let effectiveBody = body;

    const existingRow = (mediaUri !== undefined || imageUri !== undefined)
      ? await Database.getJournalById(id)
      : null;

    if (effectiveTitle !== undefined) updates.title = effectiveTitle;
    if (effectiveBody !== undefined) updates.body = effectiveBody;
    if (effectiveTitle !== undefined) updates.title_cipher = null;
    if (effectiveBody !== undefined) updates.body_cipher = null;
    if (mood !== undefined) updates.mood = mood;
    if (mood !== undefined) updates.mood_cipher = null;
    if (tags !== undefined) updates.tags = tags;
    if (tags !== undefined) updates.tags_cipher = null;
    updates.couple_id = coupleId;

    let replacementMediaRef = null;
    if (mediaUri !== undefined) {
      if (mediaUri) {
        const att = await EncryptedAttachments.encryptAndStore({
          sourceUri: mediaUri,
          fileName: fileName || 'journal_attachment',
          mimeType: mimeType || 'video/quicktime',
          userId: _userId,
          coupleId,
          parentType: 'journal',
          parentId: id,
          keyTier: coupleId ? 'couple' : 'device',
        });
        replacementMediaRef = att.id;
        updates.media_ref = replacementMediaRef;
      } else {
        updates.media_ref = null;
      }
      updates.photo_uri = null;
    }

    if (imageUri !== undefined) {
      updates.photo_uri = imageUri ?? null;
      updates.media_ref = null;
    }

    const existingRowForUpdate = await Database.getJournalById(id);
    const draft = { ...existingRowForUpdate, ...updates, id, updated_at: new Date().toISOString() };
    const row = await this._writeCloudFirst('journal_entries', draft, 'updateJournal', id, updates);

    if (replacementMediaRef && row?.id) {
      try {
        const db = await Database.init();
        await db.runAsync(
          `UPDATE attachments SET parent_id = ? WHERE id = ?`,
          [row.id, replacementMediaRef]
        );
      } catch (err) {
        if (__DEV__) console.warn('[DataLayer] Failed to relink journal attachment:', err?.message);
        try { await EncryptedAttachments.deleteAttachment(replacementMediaRef); } catch { /* ok */ }
        throw new Error('Failed to attach media to journal');
      }
    }

    const previousMediaRef = existingRow?.media_ref || null;
    if (previousMediaRef && previousMediaRef !== replacementMediaRef && (mediaUri !== undefined || imageUri !== undefined)) {
      try { await EncryptedAttachments.deleteAttachment(previousMediaRef); } catch { /* ok */ }
    }

    await flushWriteThrough();
    return row;
  },

  async deleteJournalEntry(id) {
    const entry = await Database.getJournalById(id);
    if (entry?.media_ref) {
      try { await EncryptedAttachments.deleteAttachment(entry.media_ref); } catch { /* ok */ }
    }
    if (entry) {
      const rowDraft = { ...entry, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      await this._writeCloudFirst('journal_entries', rowDraft, 'softDeleteJournal', id);
    }
  },

  async getJournalEntries({ limit = 50, offset = 0, mood, visibility } = {}) {
    await ensureLocalIdentityState();
    const verifiedCoupleState = await ensureVerifiedCoupleState({ requireRemoteCheck: true });

    if (visibility === 'private') {
      return [];
    }

    if (visibility === 'shared' && verifiedCoupleState.status === 'unpaired') {
      return [];
    }

    // If the couple key isn't loaded yet, attempt to restore it once before
    // decrypting so shared/partner entries aren't needlessly locked.
    if (_coupleId && !_coupleKeyAvailable) {
      await tryRestoreCoupleKey();
    }
    const rows = visibility
      ? await Database.getJournalFeed(_userId, { coupleId: _coupleId, limit, offset, mood, visibility })
      : await Database.getJournals(_userId, { limit, offset, mood });
    return Promise.all((rows || []).map(r => this._decryptJournal(r)));
  },

  async getJournalEntry(id) {
    await ensureLocalIdentityState();
    await ensureVerifiedCoupleState({ requireRemoteCheck: true });
    if (_coupleId && !_coupleKeyAvailable) {
      await tryRestoreCoupleKey();
    }
    const row = await Database.getJournalById(id);
    return row ? this._decryptJournal(row) : null;
  },

  async _decryptJournal(row) {
    if (!row) return null;
    const info = row.title_cipher ? E2EEncryption.inspect(row.title_cipher) : null;
    const kt = info?.keyTier || keyTier();
    const cid = kt === 'couple' ? (row.couple_id || _coupleId) : null;
    try {
      let decryptedMediaUri = null;
      let attachmentMimeType = null;
      if (row.media_ref) {
        try {
          const attachment = await Database.getAttachmentById(row.media_ref);
          attachmentMimeType = attachment?.mime_type || null;
          decryptedMediaUri = await EncryptedAttachments.getDecryptedUri(row.media_ref, kt, cid);
        } catch (mediaErr) {
          if (__DEV__) console.warn('[DataLayer] Journal media decrypt failed:', mediaErr?.message);
        }
      }
      const plainTitle = typeof row.title === 'string' ? row.title : null;
      const plainBody = typeof row.body === 'string' ? row.body : null;
      const decryptedMood = !row.mood && row.mood_cipher
        ? await E2EEncryption.decryptString(row.mood_cipher, kt, cid).catch(() => null)
        : null;
      const decryptedTags = !row.tags && row.tags_cipher
        ? await E2EEncryption.decryptJson(row.tags_cipher, kt, cid).catch(() => null)
        : null;
      return {
        ...row,
        title: plainTitle ?? await E2EEncryption.decryptString(row.title_cipher, kt, cid),
        body: plainBody ?? await E2EEncryption.decryptString(row.body_cipher, kt, cid),
        mood: row.mood ?? decryptedMood ?? null,
        tags: row.tags != null ? parseTagsValue(row.tags) : (decryptedTags || []),
        mediaRef: row.media_ref || null,
        mediaUri: decryptedMediaUri,
        mediaType: attachmentMimeType,
        mediaKind: attachmentMimeType?.startsWith('video/') ? 'video' : (decryptedMediaUri ? 'image' : null),
      };
    } catch (err) {
      if (__DEV__) console.warn('[DataLayer] Journal decryption failed:', err?.message);
      return { ...row, mood: row.mood ?? null, title: null, body: null, tags: [], locked: false };
    }
  },

  // ─── Prompt Answers ───────────────────────────────────────────

  async savePromptAnswer({ promptId, answer, heatLevel, _createdAt, _updatedAt }) {
    await ensureLocalIdentityState();
    const resolvedHeatLevel = typeof heatLevel === 'number'
      ? heatLevel
      : (getPromptById(promptId)?.heat || 1);
    const dk = _createdAt ? dateKey(new Date(_createdAt)) : dateKey();
    const coupleId = _coupleId || null;

    const existing = await Database.getPromptAnswerByPromptAndDate(_userId, promptId, dk);
    let row;
    if (existing) {
      const updates = {
          answer,
          answer_cipher: null,
          heat_level: resolvedHeatLevel,
          heat_level_cipher: null,
      };
      const draft = { ...existing, ...updates, updated_at: _updatedAt || new Date().toISOString() };
      row = await this._writeCloudFirst('prompt_answers', draft, 'updatePromptAnswer', existing.id, updates);
    } else {
      const draft = {
          id: Database.makeId('ans'),
          user_id: _userId,
          couple_id: coupleId,
          prompt_id: promptId,
          date_key: dk,
          answer,
          partner_answer: null,
          answer_cipher: null,
          heat_level: resolvedHeatLevel,
          heat_level_cipher: null,
          is_revealed: 0,
          created_at: _createdAt || new Date().toISOString(),
          updated_at: _updatedAt || new Date().toISOString()
      };
      row = await this._writeCloudFirst('prompt_answers', draft, 'insertPromptAnswer', draft);
    }
    return row;
  },

  async revealPromptAnswer(id) {
    const existing = await Database.getPromptAnswerById(id);
    if (!existing) return null;
    const updates = {
      is_revealed: true,
      reveal_at: new Date().toISOString(),
    };
    const draft = { ...existing, ...updates, updated_at: new Date().toISOString() };
    return await this._writeCloudFirst('prompt_answers', draft, 'updatePromptAnswer', id, updates);
  },

  async getPromptAnswers({ dateKey: dk, promptId, limit = 100 } = {}) {
    const rows = await Database.getPromptAnswers(_userId, { dateKey: dk, promptId, limit });
    return Promise.all((rows || []).map(r => this._decryptPromptAnswer(r)));
  },

  async getSharedPromptAnswers({ dateKey: dk, promptId, limit = 100 } = {}) {
    await ensureLocalIdentityState();
    const verifiedCoupleState = await ensureVerifiedCoupleState({ requireRemoteCheck: true });

    if (verifiedCoupleState.status === 'unpaired' || !_coupleId) {
      return [];
    }

    if (_coupleId && !_coupleKeyAvailable) {
      await tryRestoreCoupleKey();
    }

    const rows = await Database.getSharedPromptAnswers(_coupleId, { dateKey: dk, promptId, limit });
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
    const info = row.answer_cipher ? E2EEncryption.inspect(row.answer_cipher) : null;
    const kt = info?.keyTier || keyTier();
    const cid = kt === 'couple' ? (row.couple_id || _coupleId) : null;
    const promptHeat = getPromptById(row.prompt_id)?.heat;
    if (!row.answer && kt === 'couple' && !cid) {
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
        answer: typeof row.answer === 'string'
          ? row.answer
          : await E2EEncryption.decryptString(row.answer_cipher, kt, cid),
        partnerAnswer: typeof row.partner_answer === 'string'
          ? row.partner_answer
          : row.partner_answer_cipher
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

  async saveMemory({  content, type = 'moment', mood, isPrivate = false, mediaUri, mimeType, fileName , _createdAt, _updatedAt }) {
    await ensureLocalIdentityState();
    const forceShared = true;
    const coupleId = _coupleId || null;

    let mediaRef = null;

    // Handle attachment if present
    if (mediaUri) {
      const att = await EncryptedAttachments.encryptAndStore({
        sourceUri: mediaUri,
        fileName: fileName || 'attachment',
        mimeType: mimeType || 'image/jpeg',
        userId: _userId,
        coupleId,
        parentType: 'memory',
        parentId: null, // will link after insert
        keyTier: coupleId ? 'couple' : 'device',
      });
      mediaRef = att.id;
    }

    const draft = {
      id: Database.makeId('mem'),
      user_id: _userId,
      couple_id: coupleId,
      type,
      body: content,
      body_cipher: null,
      media_ref: mediaRef,
      mood,
      mood_cipher: null,
      is_private: false,
      created_at: _createdAt || new Date().toISOString(),
      updated_at: _updatedAt || new Date().toISOString()
    };
    const row = await this._writeCloudFirst('memories', draft, 'insertMemory', draft);

    // Link attachment parent_id now that we have the memory row id
    if (mediaRef && row?.id) {
      try {
        const db = await Database.init();
        await db.runAsync(
          `UPDATE attachments SET parent_id = ? WHERE id = ?`,
          [row.id, mediaRef]
        );
      } catch (attErr) {
        if (__DEV__) console.warn('[DataLayer] Failed to link attachment to memory:', attErr?.message);
      }
    }

    await flushWriteThrough();

    // Notify partner when a shared memory is saved
    if (forceShared && _coupleId) {
      PartnerNotifications.memorySaved(null, type).catch(() => {});
    }

    return row;
  },

  async getMemories({ type, limit = 100, offset = 0 } = {}) {
    const rows = await Database.getMemories(_userId, { type, limit, offset });
    return Promise.all((rows || []).map(r => this._decryptMemory(r)));
  },

  async getSharedMemories({ type, limit = 100, offset = 0 } = {}) {
    await ensureLocalIdentityState();
    const verifiedCoupleState = await ensureVerifiedCoupleState({ requireRemoteCheck: true });

    if (verifiedCoupleState.status === 'unpaired' || !_coupleId) {
      return [];
    }

    if (_coupleId && !_coupleKeyAvailable) {
      await tryRestoreCoupleKey();
    }

    const rows = await Database.getSharedMemories(_coupleId, { type, limit, offset });
    return Promise.all((rows || []).map(r => this._decryptMemory(r)));
  },

  async _decryptMemory(row) {
    if (!row) return null;
    const info = row.body_cipher ? E2EEncryption.inspect(row.body_cipher) : null;
    const kt = info?.keyTier || keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    try {
      return {
        ...row,
        content: typeof row.body === 'string'
          ? row.body
          : await E2EEncryption.decryptString(row.body_cipher, kt, cid),
      };
    } catch (err) {
      if (__DEV__) console.warn('[DataLayer] Memory decryption failed:', err?.message);
      return { ...row, content: null, locked: false };
    }
  },

  async deleteMemory(id) {
    const existing = await Database.getMemoryById(id);
    if (existing) {
        const draft = { ...existing, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        await this._writeCloudFirst('memories', draft, 'softDeleteMemory', id);
    }
  },

  // ─── Rituals (retired) ───────────────────────────────────────

  async saveRitual() {
    throw new Error('Rituals are no longer supported');
  },

  async getRituals() {
    return [];
  },

  // ─── Check-ins ────────────────────────────────────────────────

  async saveCheckIn({  mood, intimacy, notes, touch , _createdAt, _updatedAt }) { 
    await ensureLocalIdentityState();
    const coupleId = _coupleId || null;

    const draft = {
      id: Database.makeId('chk'),
      user_id: _userId,
      couple_id: coupleId,
      payload_json: JSON.stringify({ mood, intimacy, notes, touch }),
      body_cipher: null,
      mood,
      mood_cipher: null,
      date_key: _createdAt ? dateKey(new Date(_createdAt)) : dateKey(),
      created_at: _createdAt || new Date().toISOString(),
      updated_at: _updatedAt || new Date().toISOString()
    };
    const row = await this._writeCloudFirst('check_ins', draft, 'insertCheckIn', draft);
    return row;
  },

  async getCheckIns({ limit = 100, offset = 0 } = {}) {
    const rows = await Database.getCheckIns(_userId, { limit, offset });
    return Promise.all((rows || []).map(async (row) => {
      const payload = parseJsonValue(row.payload_json, null);
      if (payload) {
        return { ...row, ...payload };
      }
      const info = row.body_cipher ? E2EEncryption.inspect(row.body_cipher) : null;
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
    const payload = parseJsonValue(row.payload_json, null);
    if (payload) {
      return { ...row, ...payload };
    }
    const info = row.body_cipher ? E2EEncryption.inspect(row.body_cipher) : null;
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

  async saveVibe({ vibe, note, _createdAt, _updatedAt }) { 
    await ensureLocalIdentityState();
    const coupleId = _coupleId || null;

    const draft = {
      id: Database.makeId('vibe'),
      user_id: _userId,
      couple_id: coupleId,
      vibe,
      note: note ?? null,
      note_cipher: null,
      created_at: _createdAt || new Date().toISOString(),
      updated_at: _updatedAt || new Date().toISOString()
    };
    const row = await this._writeCloudFirst('vibes', draft, 'insertVibe', draft);
    return row;
  },

  async getVibes({ limit = 100 } = {}) {
    const rows = await Database.getVibes(_userId, { limit });
    return Promise.all((rows || []).map(async (row) => {
      const info = row.note_cipher ? E2EEncryption.inspect(row.note_cipher) : null;
      const kt = info?.keyTier || keyTier();
      const cid = kt === 'couple' ? _coupleId : null;
      try {
        return {
          ...row,
          note: typeof row.note === 'string'
            ? row.note
            : row.note_cipher
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
    const info = row.note_cipher ? E2EEncryption.inspect(row.note_cipher) : null;
    const kt = info?.keyTier || keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    try {
      return {
        ...row,
        note: typeof row.note === 'string'
          ? row.note
          : row.note_cipher
          ? await E2EEncryption.decryptString(row.note_cipher, kt, cid)
          : null,
      };
    } catch {
      return { ...row, note: null, locked: true };
    }
  },

  // ─── Calendar Events ──────────────────────────────────────────

  async saveCalendarEvent(event, { syncSource = 'local', markSynced = false } = {}) {
    await ensureLocalIdentityState();
    const createdAtIso = new Date(event?.createdAt || Date.now()).toISOString();
    const updatedAtIso = new Date(event?.updatedAt || Date.now()).toISOString();

    const row = await Database.upsertCalendarEvent({
      id: event?.id,
      user_id: _userId,
      couple_id: _coupleId || null,
      title: event?.title || '',
      location: event?.location || '',
      notes: event?.notes || '',
      title_cipher: null,
      location_cipher: null,
      notes_cipher: null,
      event_type: event?.eventType || 'general',
      when_ts: event?.whenTs,
      is_date_night: !!(event?.isDateNight || event?.eventType === 'dateNight'),
      notify: !!event?.notify,
      notify_mins: Number(event?.notifyMins ?? 60) || 60,
      notification_id: event?.notificationId || null,
      metadata_json: JSON.stringify(event?.metadata || {}),
      metadata_cipher: null,
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
    const info = row.title_cipher ? E2EEncryption.inspect(row.title_cipher) : null;
    const kt = info?.keyTier || keyTier();
    const cid = kt === 'couple' ? (row.couple_id || _coupleId) : null;
    try {
      const plainMetadata = row.metadata_json != null
        ? (parseJsonValue(row.metadata_json, {}) || {})
        : null;
      const decryptedMetadata = !plainMetadata && row.metadata_cipher
        ? await E2EEncryption.decryptJson(row.metadata_cipher, kt, cid).catch(() => null)
        : null;
      return {
        id: row.id,
        title: typeof row.title === 'string'
          ? row.title
          : row.title_cipher
          ? await E2EEncryption.decryptString(row.title_cipher, kt, cid)
          : '',
        location: typeof row.location === 'string'
          ? row.location
          : row.location_cipher
          ? await E2EEncryption.decryptString(row.location_cipher, kt, cid)
          : '',
        notes: typeof row.notes === 'string'
          ? row.notes
          : row.notes_cipher
          ? await E2EEncryption.decryptString(row.notes_cipher, kt, cid)
          : '',
        eventType: row.event_type || 'general',
        isDateNight: !!row.is_date_night,
        whenTs: Number(row.when_ts),
        notify: !!row.notify,
        notifyMins: Number(row.notify_mins ?? 60) || 60,
        notificationId: row.notification_id || null,
        metadata: plainMetadata || decryptedMetadata || {},
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
    await ensureLocalIdentityState();
    const body = {
      locationType: plan?.locationType || 'home',
      heat: plan?.heat ?? 2,
      load: plan?.load ?? 2,
      style: plan?.style || 'mixed',
      steps: Array.isArray(plan?.steps) ? plan.steps : [],
    };
    const createdAtIso = new Date(plan?.createdAt || Date.now()).toISOString();
    const updatedAtIso = new Date(plan?.updatedAt || Date.now()).toISOString();

    const row = await Database.upsertDatePlan({
      id: plan?.id,
      user_id: _userId,
      couple_id: _coupleId || null,
      source_event_id: plan?.sourceEventId || null,
      title: plan?.title || '',
      body_json: JSON.stringify(body),
      title_cipher: null,
      body_cipher: null,
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
    const info = row.title_cipher ? E2EEncryption.inspect(row.title_cipher) : null;
    const kt = info?.keyTier || keyTier();
    const cid = kt === 'couple' ? (row.couple_id || _coupleId) : null;
    try {
      const plainBody = row.body_json != null
        ? (parseJsonValue(row.body_json, {}) || {})
        : null;
      const decryptedBody = !plainBody && row.body_cipher
        ? await E2EEncryption.decryptJson(row.body_cipher, kt, cid).catch(() => null)
        : null;
      const body = plainBody || decryptedBody || {};
      return {
        id: row.id,
        title: typeof row.title === 'string'
          ? row.title
          : row.title_cipher
          ? await E2EEncryption.decryptString(row.title_cipher, kt, cid)
          : '',
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

  // ─── Love Notes (retired) ──────────────────────────────────────

  async saveLoveNote() {
    throw new Error('Love Notes are no longer supported');
  },

  async getLoveNotes() {
    return [];
  },

  async getLoveNote() {
    return null;
  },

  async markLoveNoteRead(id) {
    return { id, skipped: true };
  },

  async purgeExpiredLoveNotes() {
    return undefined;
  },

  async deleteLoveNote() {
    return undefined;
  },

  async getUnreadLoveNoteCount() {
    return 0;
  },

  async getLoveNoteImageUri() {
    return null;
  },

  async _decryptLoveNote() {
    return null;
  },

  // ─── Attachments ──────────────────────────────────────────────

  async addAttachment(opts) {
    await ensureLocalIdentityState();
    return EncryptedAttachments.encryptAndStore({
      ...opts,
      userId: _userId,
      coupleId: _coupleId || null,
      keyTier: keyTier(),
    });
  },

  async getDecryptedAttachment(attachmentId) {
    await ensureLocalIdentityState();
    return EncryptedAttachments.getDecryptedUri(
      attachmentId, keyTier(), _coupleId || null
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
