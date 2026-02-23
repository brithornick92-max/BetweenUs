import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * 2026 STORAGE ARCHITECTURE: BETWEEN US
 * Focus: High-performance local caching, data integrity, and atomic-ish writes.
 *
 * ⚠️ MIGRATION NOTE: promptStorage, journalStorage, checkInStorage, and
 * biometricVaultStorage use the legacy EncryptionService (v1, device-only
 * nacl_secretbox). This data is NOT end-to-end encrypted between partners
 * and is NOT synced via SyncEngine.
 *
 * New code should use DataLayer (services/data/DataLayer.js) which stores
 * data in SQLite with E2EEncryption (v3, couple-aware) and syncs via
 * SyncEngine → Supabase.
 *
 * ✅ Includes: promptStorage, journalStorage, checkInStorage, myDatesStorage, calendarStorage,
 *             userStorage, coupleStorage, settingsStorage
 */

export const STORAGE_KEYS = {
  // Authentication & Identity
  USER_ID: "@betweenus:userId",
  ONBOARDING_COMPLETED: "@betweenus:onboardingCompleted",
  USER_PROFILE: "@betweenus:userProfile",
  PARTNER_LABEL: "@betweenus:partnerLabel",

  // Couple State (Shared)
  COUPLE_ID: "@betweenus:coupleId",
  COUPLE_ROLE: "@betweenus:coupleRole",
  PARTNER_PROFILE: "@betweenus:partnerProfile",
  LAST_PARTNER_ACTIVITY: "@betweenus:lastPartnerActivity",

  // Security
  APP_LOCK_ENABLED: "@betweenus:appLockEnabled",
  APP_LOCK_PIN: "@betweenus:appLockPin",
  BIOMETRICS_AVAILABLE: "@betweenus:biometricsAvailable",
  THEME_MODE: "@betweenus:themeMode",
  NOTIFICATION_SETTINGS: "@betweenus:notificationSettings",
  PRIVACY_SETTINGS: "@betweenus:privacySettings",

  // Core Content
  PROMPT_ANSWERS: "@betweenus:promptAnswers",
  JOURNAL_ENTRIES: "@betweenus:journalEntries",
  CHECK_INS: "@betweenus:checkIns",
  CALENDAR_EVENTS: "@betweenus:calendarEvents",
  MY_DATES: "@betweenus:myDates",

  // Subscription Logic
  PREMIUM_STATUS: "@betweenus:premiumStatus",
  PARTNER_PREMIUM_STATUS: "@betweenus:partnerPremiumStatus",

  // Premium Value Loop Storage Keys
  MEMORIES: "@betweenus:memories",
  RITUAL_HISTORY: "@betweenus:ritualHistory",
  RITUAL_SYNC_QUEUE: "@betweenus:ritualSyncQueue",
  CUSTOM_RITUAL_FLOWS: "@betweenus:customRitualFlows",
  VIBE_HISTORY: "@betweenus:vibeHistory",
  VIBE_SYNC_QUEUE: "@betweenus:vibeSyncQueue",
  ANNIVERSARY_THEMES: "@betweenus:anniversaryThemes",
  ANNIVERSARY_VIBE_HISTORY: "@betweenus:anniversaryVibeHistory",
  EDITORIAL_PROMPTS: "@betweenus:editorialPrompts",
  PROMPT_SYNC_QUEUE: "@betweenus:promptSyncQueue",
  MEMORY_EXPORT_CACHE: "@betweenus:memoryExportCache",
  BIOMETRIC_VAULT: "@betweenus:biometricVault",
  
  // Cloud Sync Storage Keys
  CLOUD_SYNC_STATUS: "@betweenus:cloudSyncStatus",
  CLOUD_BACKUP_METADATA: "@betweenus:cloudBackupMetadata",
  LAST_CLOUD_SYNC: "@betweenus:lastCloudSync",
  CLOUD_SYNC_QUEUE: "@betweenus:cloudSyncQueue",
  
  // Ritual Reminder Storage Keys
  RITUAL_REMINDERS: "@betweenus:ritualReminders",

  // Love Notes
  LOVE_NOTES: "@betweenus:loveNotes",
};

/**
 * UTILS: Data Integrity & ID Generation
 */
const safeParse = (raw) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn("[Storage] Parse Error:", e);
    return null;
  }
};

const makeId = (prefix) => {
  // Use crypto-quality randomness to avoid ID collisions in concurrent writes
  try {
    const { randomUUID } = require('expo-crypto');
    return `${prefix}_${randomUUID()}`;
  } catch {
    // Fallback if expo-crypto unavailable
    const entropy = Math.random().toString(36).substring(2, 10) +
      Math.random().toString(36).substring(2, 10);
    return `${prefix}_${Date.now()}_${entropy}`;
  }
};

const ensureArray = (v) => (Array.isArray(v) ? v : []);
const ensureObject = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const dayKeyLocal = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * CORE STORAGE ENGINE (Singleton)
 */
export const storage = {
  async get(key, defaultValue = null) {
    try {
      const value = await AsyncStorage.getItem(key);
      const parsed = safeParse(value);
      return parsed === null ? defaultValue : parsed;
    } catch (error) {
      return defaultValue;
    }
  },

  async set(key, value) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  },

  // Batch update for high-end state synchronization
  async multiSet(keyValuePairs) {
    try {
      const pairs = Object.entries(keyValuePairs).map(([k, v]) => [k, JSON.stringify(v)]);
      await AsyncStorage.multiSet(pairs);
      return true;
    } catch (e) {
      return false;
    }
  },

  async remove(key) {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  },

  async clearSession() {
    try {
      const keysToClear = Object.values(STORAGE_KEYS).filter(
        (k) => k !== STORAGE_KEYS.ONBOARDING_COMPLETED
      );
      await AsyncStorage.multiRemove(keysToClear);
      return true;
    } catch (error) {
      return false;
    }
  },
};

/**
 * DOMAIN: Prompt Answers
 * @deprecated Use DataLayer.savePromptAnswer() / DataLayer.getPromptAnswers()
 * for couple-aware E2EE + cross-device sync.
 * Shape:
 * PROMPT_ANSWERS = {
 *   [dateKey]: {
 *     [promptId]: { answer, timestamp, isRevealed?, revealAt? }
 *   }
 * }
 */
export const promptStorage = {
  async getAll() {
    const data = await storage.get(STORAGE_KEYS.PROMPT_ANSWERS, {});
    const all = ensureObject(data);
    
    // Decrypt answers if encrypted
    const { default: EncryptionService } = await import('../services/EncryptionService');
    const decrypted = {};
    
    for (const [dateKey, byDate] of Object.entries(all)) {
      decrypted[dateKey] = {};
      for (const [promptId, answer] of Object.entries(byDate)) {
        if (answer.isEncrypted) {
          try {
            const data = await EncryptionService.decryptJson(answer.encryptedData);
            decrypted[dateKey][promptId] = data
              ? { ...data, isEncrypted: false }
              : { ...answer, decryptionFailed: true };
          } catch (error) {
            console.error('Failed to decrypt answer:', error);
            decrypted[dateKey][promptId] = { ...answer, decryptionFailed: true };
          }
        } else {
          decrypted[dateKey][promptId] = answer;
        }
      }
    }
    
    return decrypted;
  },

  async getAnswer(dateKey, promptId) {
    const all = await this.getAll();
    return all?.[dateKey]?.[promptId] || null;
  },

  async setAnswer(dateKey, promptId, payload) {
    const rawData = await storage.get(STORAGE_KEYS.PROMPT_ANSWERS, {}) || {};
    const all = ensureObject(rawData);
    const byDate = ensureObject(all[dateKey]);

    const answerData =
      typeof payload === "string"
        ? { answer: payload, timestamp: Date.now() }
        : { ...(payload || {}), timestamp: payload?.timestamp || Date.now() };

    // Encrypt the answer before saving
    const { default: EncryptionService } = await import('../services/EncryptionService');
    const encryptedPayload = await EncryptionService.encryptJson({
      content: answerData.answer,
      timestamp: answerData.timestamp,
      promptId: promptId,
    });

    byDate[promptId] = {
      encryptedData: encryptedPayload,
      isEncrypted: true,
      encryptedAt: Date.now(),
      promptId: promptId,
    };
    all[dateKey] = byDate;
    await storage.set(STORAGE_KEYS.PROMPT_ANSWERS, all);
    
    return answerData; // Return decrypted for immediate use
  },

  async deleteAnswer(dateKey, promptId) {
    const all = await storage.get(STORAGE_KEYS.PROMPT_ANSWERS, {}) || {};
    const byDate = ensureObject(all[dateKey]);
    delete byDate[promptId];
    all[dateKey] = byDate;
    return storage.set(STORAGE_KEYS.PROMPT_ANSWERS, all);
  },

  async getAllAnswersForDate(dateKey) {
    const all = await this.getAll();
    const byDate = ensureObject(all[dateKey]);
    return Object.values(byDate);
  },
};

/**
 * DOMAIN: Journal
 * @deprecated Use DataLayer.saveJournalEntry() / DataLayer.getJournalEntries()
 * for couple-aware E2EE + cross-device sync.
 * Automatically encrypts sensitive journal data
 */
export const journalStorage = {
  async getEntries() {
    const data = await storage.get(STORAGE_KEYS.JOURNAL_ENTRIES, []);
    const entries = ensureArray(data).sort((a, b) => b.createdAt - a.createdAt);
    
    // Decrypt entries if encrypted
    const { default: EncryptionService } = await import('../services/EncryptionService');
    const decryptedEntries = await Promise.all(
      entries.map(async (entry) => {
        if (entry.isEncrypted) {
          try {
            const data = await EncryptionService.decryptJson(entry.encryptedData);
            if (!data) return { ...entry, decryptionFailed: true };
            return {
              ...entry,
              title: data.title,
              content: data.content,
              mood: data.mood,
              isEncrypted: false,
            };
          } catch (error) {
            console.error('Failed to decrypt journal entry:', error);
            return { ...entry, decryptionFailed: true };
          }
        }
        return entry;
      })
    );
    
    return decryptedEntries;
  },

  async saveEntry(entry) {
    const entries = await storage.get(STORAGE_KEYS.JOURNAL_ENTRIES, []) || [];
    const isUpdate = !!entry.id;

    const processedEntry = {
      ...entry,
      id: isUpdate ? entry.id : makeId("jrnl"),
      updatedAt: Date.now(),
      createdAt: isUpdate ? entry.createdAt : Date.now(),
    };

    // Encrypt the entry before saving
    const { default: EncryptionService } = await import('../services/EncryptionService');
    const encryptedData = await EncryptionService.encryptJson({
      title: processedEntry.title || '',
      content: processedEntry.content || '',
      mood: processedEntry.mood || null,
    });
    const encryptedEntry = {
      ...processedEntry,
      encryptedData,
      isEncrypted: true,
      encryptedAt: Date.now(),
      title: undefined,
      content: undefined,
      mood: undefined,
    };

    const newEntries = isUpdate
      ? entries.map((e) => (e.id === entry.id ? encryptedEntry : e))
      : [encryptedEntry, ...entries];

    await storage.set(STORAGE_KEYS.JOURNAL_ENTRIES, newEntries);
    return processedEntry; // Return decrypted entry for immediate use
  },

  async deleteEntry(entryId) {
    const entries = await storage.get(STORAGE_KEYS.JOURNAL_ENTRIES, []) || [];
    return storage.set(
      STORAGE_KEYS.JOURNAL_ENTRIES,
      entries.filter((e) => e.id !== entryId)
    );
  },
};

/**
 * DOMAIN: Love Notes
 * Share love notes and pictures with your partner.
 * Shape: [ { id, text, imageUri?, senderName?, isRead, createdAt, updatedAt } ]
 * ⚠️ Encrypted at rest via EncryptionService (device-local key).
 *    Legacy plaintext notes are decrypted transparently on read.
 */
export const loveNoteStorage = {
  /** Decrypt a single note entry — handles both encrypted and legacy plaintext */
  async _decryptNote(note) {
    if (!note?.isEncrypted || !note?.encryptedData) return note;
    try {
      const { default: EncryptionService } = await import('../services/EncryptionService');
      const data = await EncryptionService.decryptJson(note.encryptedData);
      return data ? { ...data, isEncrypted: false } : { ...note, decryptionFailed: true };
    } catch {
      return { ...note, decryptionFailed: true };
    }
  },

  /** Encrypt a note's sensitive fields, keeping id/isRead/timestamps in the clear for indexing */
  async _encryptNote(note) {
    try {
      const { default: EncryptionService } = await import('../services/EncryptionService');
      const { id, isRead, readAt, createdAt, updatedAt, isEncrypted, encryptedData, encryptedAt, ...sensitive } = note;
      const encryptedPayload = await EncryptionService.encryptJson(sensitive);
      return { id, isRead, readAt, createdAt, updatedAt, encryptedData: encryptedPayload, isEncrypted: true, encryptedAt: Date.now() };
    } catch {
      // Encryption failed — fall back to plaintext rather than losing data
      return note;
    }
  },

  async getNotes() {
    const data = await storage.get(STORAGE_KEYS.LOVE_NOTES, []);
    const notes = ensureArray(data);
    const decrypted = await Promise.all(notes.map(n => this._decryptNote(n)));
    return decrypted.sort((a, b) => b.createdAt - a.createdAt);
  },

  async saveNote(note) {
    const notes = await storage.get(STORAGE_KEYS.LOVE_NOTES, []) || [];
    const isUpdate = !!note.id && notes.some((n) => n.id === note.id);

    const processed = {
      ...note,
      id: isUpdate ? note.id : makeId("note"),
      updatedAt: Date.now(),
      createdAt: isUpdate ? note.createdAt : Date.now(),
      isRead: note.isRead ?? false,
    };

    // Encrypt before persisting
    const encrypted = await this._encryptNote(processed);

    const next = isUpdate
      ? notes.map((n) => (n.id === encrypted.id ? encrypted : n))
      : [encrypted, ...notes];

    await storage.set(STORAGE_KEYS.LOVE_NOTES, next);
    return processed; // Return decrypted for immediate use
  },

  async markRead(noteId) {
    const notes = await storage.get(STORAGE_KEYS.LOVE_NOTES, []) || [];
    const updated = notes.map((n) =>
      n.id === noteId ? { ...n, isRead: true, readAt: Date.now() } : n
    );
    await storage.set(STORAGE_KEYS.LOVE_NOTES, updated);
  },

  async deleteNote(noteId) {
    const notes = await storage.get(STORAGE_KEYS.LOVE_NOTES, []) || [];
    return storage.set(
      STORAGE_KEYS.LOVE_NOTES,
      notes.filter((n) => n.id !== noteId)
    );
  },

  async getUnreadCount() {
    const notes = await this.getNotes();
    return notes.filter((n) => !n.isRead).length;
  },
};

/**
 * DOMAIN: Check-Ins
 * @deprecated Use DataLayer.saveCheckIn() / DataLayer.getCheckIns()
 * for couple-aware E2EE + cross-device sync.
 * ⚠️ Encrypted at rest via EncryptionService (device-local key).
 *    Legacy plaintext entries are readable transparently.
 * Compatible with your CheckInScreen:
 * - getTodayCheckIn()
 * - saveCheckIn({ mood, closeness, touch, intimacy, space })
 */
export const checkInStorage = {
  /** Decrypt a single check-in entry */
  async _decryptEntry(entry) {
    if (!entry?.isEncrypted || !entry?.encryptedData) return entry;
    try {
      const { default: EncryptionService } = await import('../services/EncryptionService');
      const data = await EncryptionService.decryptJson(entry.encryptedData);
      return data ? { ...data, isEncrypted: false } : entry;
    } catch {
      return { ...entry, decryptionFailed: true };
    }
  },

  /** Encrypt a check-in entry, keeping dateKey and timestamp in the clear */
  async _encryptEntry(entry) {
    try {
      const { default: EncryptionService } = await import('../services/EncryptionService');
      const { isEncrypted, encryptedData, encryptedAt, ...sensitive } = entry;
      const encryptedPayload = await EncryptionService.encryptJson(sensitive);
      return { encryptedData: encryptedPayload, isEncrypted: true, encryptedAt: Date.now(), timestamp: entry.timestamp };
    } catch {
      return entry;
    }
  },

  async getAll() {
    const raw = ensureObject(await storage.get(STORAGE_KEYS.CHECK_INS, {}));
    const decrypted = {};
    for (const [dateKey, entry] of Object.entries(raw)) {
      decrypted[dateKey] = await this._decryptEntry(entry);
    }
    return decrypted;
  },

  async getTodayCheckIn() {
    const all = await this.getAll();
    return all[dayKeyLocal()] || null;
  },

  async saveCheckIn(payload) {
    // Read raw (encrypted) data to avoid decrypt→re-encrypt cycle for other days
    const all = ensureObject(await storage.get(STORAGE_KEYS.CHECK_INS, {}));
    const today = dayKeyLocal();

    // Decrypt today's existing entry to merge with
    const existingDecrypted = all[today] ? await this._decryptEntry(all[today]) : {};

    const merged = {
      ...(existingDecrypted || {}),
      ...(payload || {}),
      timestamp: Date.now(),
      synced: false,
    };

    // Encrypt and store
    all[today] = await this._encryptEntry(merged);
    await storage.set(STORAGE_KEYS.CHECK_INS, all);
    return merged; // Return decrypted for immediate use
  },

  // Backwards compatibility
  async saveDailyCheckIn(mood, note = "") {
    return this.saveCheckIn({ mood, note });
  },

  async getRecentStats(days = 14) {
    const history = await this.getAll();
    return Object.entries(history)
      .sort((a, b) => new Date(b[0]) - new Date(a[0]))
      .slice(0, days);
  },
};

/**
 * DOMAIN: My Dates
 * Compatible with your screens:
 * - getMyDates()
 * - addMyDate(date)
 * - updateMyDate(date)
 * - deleteMyDate(id)
 */
export const myDatesStorage = {
  async getMyDates() {
    const data = await storage.get(STORAGE_KEYS.MY_DATES, []);
    return ensureArray(data).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },

  async addMyDate(date) {
    const list = await this.getMyDates();
    const processed = {
      ...date,
      id: date.id || makeId("date"),
      createdAt: date.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    await storage.set(
      STORAGE_KEYS.MY_DATES,
      [processed, ...list.filter((d) => d.id !== processed.id)]
    );
    return processed;
  },

  async updateMyDate(date) {
    if (!date?.id) return null;
    const list = await this.getMyDates();
    const processed = { ...date, updatedAt: Date.now() };
    await storage.set(
      STORAGE_KEYS.MY_DATES,
      [processed, ...list.filter((d) => d.id !== processed.id)]
    );
    return processed;
  },

  async deleteMyDate(id) {
    const list = await this.getMyDates();
    return storage.set(STORAGE_KEYS.MY_DATES, list.filter((d) => d.id !== id));
  },
};

/**
 * DOMAIN: Calendar
 * Compatible with your CalendarScreen:
 * - getEvents()
 * - addEvent(event)
 * - deleteEvent(id)
 * Also keeps upsertEvent()
 */
export const calendarStorage = {
  async getEvents() {
    return ensureArray(await storage.get(STORAGE_KEYS.CALENDAR_EVENTS, []));
  },

  async upsertEvent(event) {
    const events = await this.getEvents();
    const id = event.id || makeId("evt");
    const newEvent = { ...event, id, updatedAt: Date.now() };

    const filtered = events.filter((e) => e.id !== id);
    await storage.set(STORAGE_KEYS.CALENDAR_EVENTS, [newEvent, ...filtered]);
    return newEvent;
  },

  // Alias used in some screens
  async addEvent(event) {
    return this.upsertEvent(event);
  },

  async deleteEvent(eventId) {
    const events = await this.getEvents();
    await storage.set(
      STORAGE_KEYS.CALENDAR_EVENTS,
      events.filter((e) => e.id !== eventId)
    );
    return true;
  },
};

/**
 * DOMAIN: User
 * Matches what AppContext expects.
 */
export const userStorage = {
  async isOnboardingCompleted() {
    return (await storage.get(STORAGE_KEYS.ONBOARDING_COMPLETED, false)) === true;
  },

  async setOnboardingCompleted(v) {
    return storage.set(STORAGE_KEYS.ONBOARDING_COMPLETED, !!v);
  },

  async getProfile() {
    return await (await import('./encryptedStorage')).encryptedStorage.get(STORAGE_KEYS.USER_PROFILE, {});
  },

  async setProfile(profile) {
    return (await import('./encryptedStorage')).encryptedStorage.set(STORAGE_KEYS.USER_PROFILE, profile);
  },

  async getPartnerLabel() {
    return await (await import('./encryptedStorage')).encryptedStorage.get(STORAGE_KEYS.PARTNER_LABEL, null);
  },

  async setPartnerLabel(label) {
    return (await import('./encryptedStorage')).encryptedStorage.set(STORAGE_KEYS.PARTNER_LABEL, label);
  },
};

/**
 * DOMAIN: Couple
 * Matches what AppContext expects.
 */
export const coupleStorage = {
  async getCoupleData() {
    const [coupleId, role, partnerProfile] = await Promise.all([
      (await import('./encryptedStorage')).encryptedStorage.get(STORAGE_KEYS.COUPLE_ID, null),
      storage.get(STORAGE_KEYS.COUPLE_ROLE, null),
      (await import('./encryptedStorage')).encryptedStorage.get(STORAGE_KEYS.PARTNER_PROFILE, {}),
    ]);

    return {
      coupleId: coupleId || null,
      role: role || null,
      partnerProfile: partnerProfile || null,
    };
  },

  async setCoupleData({ coupleId, role, partnerProfile = null }) {
    await (await import('./encryptedStorage')).encryptedStorage.set(STORAGE_KEYS.COUPLE_ID, coupleId);
    await storage.set(STORAGE_KEYS.COUPLE_ROLE, role);
    await (await import('./encryptedStorage')).encryptedStorage.set(STORAGE_KEYS.PARTNER_PROFILE, partnerProfile);
    return true;
  },

  async clearCouple() {
    await (await import('./encryptedStorage')).encryptedStorage.remove(STORAGE_KEYS.COUPLE_ID);
    await storage.remove(STORAGE_KEYS.COUPLE_ROLE);
    await (await import('./encryptedStorage')).encryptedStorage.remove(STORAGE_KEYS.PARTNER_PROFILE);
    return true;
  },
};

/**
 * DOMAIN: Settings
 * Matches what AppContext expects.
 */
export const settingsStorage = {
  async getAppLockEnabled() {
    return (await storage.get(STORAGE_KEYS.APP_LOCK_ENABLED, false)) === true;
  },

  async setAppLockEnabled(enabled) {
    return storage.set(STORAGE_KEYS.APP_LOCK_ENABLED, !!enabled);
  },

  async getDateNightDefaults() {
    return await storage.get("@betweenus:dateNightDefaults", {});
  },

  async setDateNightDefaults(defaults) {
    return storage.set("@betweenus:dateNightDefaults", defaults);
  },
};
/**
 * DOMAIN: Premium Value Loop - Memories
 * Relationship memory storage with timeline generation
 * ⚠️ Encrypted at rest via EncryptionService (device-local key).
 *    Legacy plaintext memories are readable transparently.
 */
export const memoryStorage = {
  /** Decrypt a single memory — handles both encrypted and legacy plaintext */
  async _decryptMemory(mem) {
    if (!mem?.isEncrypted || !mem?.encryptedData) return mem;
    try {
      const { default: EncryptionService } = await import('../services/EncryptionService');
      const data = await EncryptionService.decryptJson(mem.encryptedData);
      return data ? { ...data, isEncrypted: false } : { ...mem, decryptionFailed: true };
    } catch {
      return { ...mem, decryptionFailed: true };
    }
  },

  /** Encrypt a memory, keeping id/createdAt/updatedAt/type/date in the clear for filtering */
  async _encryptMemory(mem) {
    try {
      const { default: EncryptionService } = await import('../services/EncryptionService');
      const { id, createdAt, updatedAt, type, date, isEncrypted, encryptedData, encryptedAt, ...sensitive } = mem;
      const encryptedPayload = await EncryptionService.encryptJson(sensitive);
      return { id, createdAt, updatedAt, type, date, encryptedData: encryptedPayload, isEncrypted: true, encryptedAt: Date.now() };
    } catch {
      return mem;
    }
  },

  async getMemories() {
    const raw = ensureArray(await storage.get(STORAGE_KEYS.MEMORIES, []));
    return Promise.all(raw.map(m => this._decryptMemory(m)));
  },

  async addMemory(memory) {
    // Read raw to avoid decrypt→re-encrypt cycle on all entries
    const rawMemories = ensureArray(await storage.get(STORAGE_KEYS.MEMORIES, []));
    const processedMemory = {
      ...memory,
      id: memory.id || makeId("mem"),
      createdAt: memory.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    
    const encrypted = await this._encryptMemory(processedMemory);
    const newMemories = [encrypted, ...rawMemories.filter(m => m.id !== processedMemory.id)];
    await storage.set(STORAGE_KEYS.MEMORIES, newMemories);
    return processedMemory; // Return decrypted for immediate use
  },

  async updateMemory(memory) {
    if (!memory?.id) return null;
    const rawMemories = ensureArray(await storage.get(STORAGE_KEYS.MEMORIES, []));
    const processed = { ...memory, updatedAt: Date.now() };
    const encrypted = await this._encryptMemory(processed);
    const newMemories = [encrypted, ...rawMemories.filter(m => m.id !== processed.id)];
    await storage.set(STORAGE_KEYS.MEMORIES, newMemories);
    return processed;
  },

  async deleteMemory(memoryId) {
    const rawMemories = ensureArray(await storage.get(STORAGE_KEYS.MEMORIES, []));
    return storage.set(STORAGE_KEYS.MEMORIES, rawMemories.filter(m => m.id !== memoryId));
  },

  async getMemoriesByType(type) {
    const memories = await this.getMemories();
    return memories.filter(memory => memory.type === type);
  },

  async getMemoriesForDateRange(startDate, endDate) {
    const memories = await this.getMemories();
    return memories.filter(memory => {
      const memoryDate = new Date(memory.date);
      return memoryDate >= startDate && memoryDate <= endDate;
    });
  },
};

/**
 * DOMAIN: Premium Value Loop - Rituals
 * Night ritual storage with history and custom flows
 * ⚠️ Encrypted at rest via EncryptionService (device-local key).
 */
export const ritualStorage = {
  async _decryptItem(item) {
    if (!item?.isEncrypted || !item?.encryptedData) return item;
    try {
      const { default: EncryptionService } = await import('../services/EncryptionService');
      const data = await EncryptionService.decryptJson(item.encryptedData);
      return data ? { ...data, isEncrypted: false } : { ...item, decryptionFailed: true };
    } catch {
      return { ...item, decryptionFailed: true };
    }
  },

  async _encryptItem(item) {
    try {
      const { default: EncryptionService } = await import('../services/EncryptionService');
      const { id, createdAt, updatedAt, isPremium, isEncrypted, encryptedData, encryptedAt, ...sensitive } = item;
      const encryptedPayload = await EncryptionService.encryptJson(sensitive);
      return { id, createdAt, updatedAt, isPremium, encryptedData: encryptedPayload, isEncrypted: true, encryptedAt: Date.now() };
    } catch {
      return item;
    }
  },

  async getRitualHistory() {
    const raw = ensureArray(await storage.get(STORAGE_KEYS.RITUAL_HISTORY, []));
    return Promise.all(raw.map(r => this._decryptItem(r)));
  },

  async addRitual(ritual) {
    const rawHistory = ensureArray(await storage.get(STORAGE_KEYS.RITUAL_HISTORY, []));
    const processedRitual = {
      ...ritual,
      id: ritual.id || makeId("ritual"),
      createdAt: ritual.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    
    const encrypted = await this._encryptItem(processedRitual);
    const newHistory = [encrypted, ...rawHistory.filter(r => r.id !== processedRitual.id)];
    await storage.set(STORAGE_KEYS.RITUAL_HISTORY, newHistory);
    return processedRitual;
  },

  async getCustomFlows() {
    const raw = ensureArray(await storage.get(STORAGE_KEYS.CUSTOM_RITUAL_FLOWS, []));
    return Promise.all(raw.map(f => this._decryptItem(f)));
  },

  async addCustomFlow(flow) {
    const rawFlows = ensureArray(await storage.get(STORAGE_KEYS.CUSTOM_RITUAL_FLOWS, []));
    const processedFlow = {
      ...flow,
      id: flow.id || makeId("flow"),
      createdAt: flow.createdAt || Date.now(),
      updatedAt: Date.now(),
      isPremium: true,
    };
    
    const encrypted = await this._encryptItem(processedFlow);
    const newFlows = [encrypted, ...rawFlows.filter(f => f.id !== processedFlow.id)];
    await storage.set(STORAGE_KEYS.CUSTOM_RITUAL_FLOWS, newFlows);
    return processedFlow;
  },

  async deleteCustomFlow(flowId) {
    const rawFlows = ensureArray(await storage.get(STORAGE_KEYS.CUSTOM_RITUAL_FLOWS, []));
    return storage.set(STORAGE_KEYS.CUSTOM_RITUAL_FLOWS, rawFlows.filter(f => f.id !== flowId));
  },
};

/**
 * DOMAIN: Premium Value Loop - Vibe History
 * Track vibe signal history for analytics and themes
 */
/**
 * ⚠️ Encrypted at rest via EncryptionService (device-local key).
 */
export const vibeStorage = {
  async _decryptEntry(entry) {
    if (!entry?.isEncrypted || !entry?.encryptedData) return entry;
    try {
      const { default: EncryptionService } = await import('../services/EncryptionService');
      const data = await EncryptionService.decryptJson(entry.encryptedData);
      return data ? { ...data, isEncrypted: false } : { ...entry, decryptionFailed: true };
    } catch {
      return { ...entry, decryptionFailed: true };
    }
  },

  async _encryptEntry(entry) {
    try {
      const { default: EncryptionService } = await import('../services/EncryptionService');
      const { id, timestamp, synced, isEncrypted, encryptedData, encryptedAt, ...sensitive } = entry;
      const encryptedPayload = await EncryptionService.encryptJson(sensitive);
      return { id, timestamp, synced, encryptedData: encryptedPayload, isEncrypted: true, encryptedAt: Date.now() };
    } catch {
      return entry;
    }
  },

  async getVibeHistory() {
    const raw = ensureArray(await storage.get(STORAGE_KEYS.VIBE_HISTORY, []));
    return Promise.all(raw.map(e => this._decryptEntry(e)));
  },

  async addVibeEntry(vibe, userId) {
    const rawHistory = ensureArray(await storage.get(STORAGE_KEYS.VIBE_HISTORY, []));
    const entry = {
      id: makeId("vibe"),
      vibe,
      userId,
      timestamp: Date.now(),
      synced: false,
    };
    
    const encrypted = await this._encryptEntry(entry);
    const newHistory = [encrypted, ...rawHistory.slice(0, 99)]; // Keep last 100 entries
    await storage.set(STORAGE_KEYS.VIBE_HISTORY, newHistory);
    return entry;
  },

  async getRecentVibes(days = 7) {
    const history = await this.getVibeHistory();
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    return history.filter(entry => entry.timestamp > cutoff);
  },
};

/**
 * DOMAIN: Premium Value Loop - Biometric Vault
 * @deprecated Use BiometricVault service directly with E2EEncryption.
 * Secure storage for premium users with biometric protection
 */
export const biometricVaultStorage = {
  async getVaultData() {
    const raw = ensureObject(await storage.get(STORAGE_KEYS.BIOMETRIC_VAULT, {}));
    if (!Object.keys(raw).length) return raw;

    const { default: EncryptionService } = await import('../services/EncryptionService');
    const decrypted = {};

    for (const [key, entry] of Object.entries(raw)) {
      if (entry?.encryptedData) {
        try {
          const value = await EncryptionService.decryptJson(entry.encryptedData);
          if (value != null) {
            decrypted[key] = {
              ...entry,
              value,
              isEncrypted: false,
            };
          } else {
            decrypted[key] = { ...entry, decryptionFailed: true };
          }
        } catch {
          decrypted[key] = { ...entry, decryptionFailed: true };
        }
      } else {
        decrypted[key] = entry;
      }
    }

    return decrypted;
  },

  async setVaultData(data) {
    return storage.set(STORAGE_KEYS.BIOMETRIC_VAULT, data);
  },

  async addToVault(key, value) {
    const vault = ensureObject(await storage.get(STORAGE_KEYS.BIOMETRIC_VAULT, {}));
    const { default: EncryptionService } = await import('../services/EncryptionService');
    const encryptedData = await EncryptionService.encryptJson(value);
    vault[key] = {
      encryptedData,
      isEncrypted: true,
      timestamp: Date.now(),
    };
    return this.setVaultData(vault);
  },

  async removeFromVault(key) {
    const vault = await this.getVaultData();
    delete vault[key];
    return this.setVaultData(vault);
  },

  async clearVault() {
    return storage.remove(STORAGE_KEYS.BIOMETRIC_VAULT);
  },
};

/**
 * DOMAIN: Premium Value Loop - Cloud Sync
 * Cloud backup and synchronization for premium users
 */
export const cloudSyncStorage = {
  async getSyncStatus() {
    return ensureObject(await storage.get(STORAGE_KEYS.CLOUD_SYNC_STATUS, {}));
  },

  async setSyncStatus(status) {
    return storage.set(STORAGE_KEYS.CLOUD_SYNC_STATUS, {
      ...status,
      lastUpdated: Date.now(),
    });
  },

  async getBackupMetadata() {
    return ensureArray(await storage.get(STORAGE_KEYS.CLOUD_BACKUP_METADATA, []));
  },

  async addBackupMetadata(metadata) {
    const backups = await this.getBackupMetadata();
    const processedMetadata = {
      ...metadata,
      id: metadata.id || makeId("backup"),
      createdAt: metadata.createdAt || Date.now(),
    };
    
    const newBackups = [processedMetadata, ...backups.slice(0, 9)]; // Keep last 10 backups
    await storage.set(STORAGE_KEYS.CLOUD_BACKUP_METADATA, newBackups);
    return processedMetadata;
  },

  async getLastSyncTime() {
    return await storage.get(STORAGE_KEYS.LAST_CLOUD_SYNC, null);
  },

  async setLastSyncTime(timestamp = Date.now()) {
    return storage.set(STORAGE_KEYS.LAST_CLOUD_SYNC, timestamp);
  },

  async getSyncQueue() {
    return ensureArray(await storage.get(STORAGE_KEYS.CLOUD_SYNC_QUEUE, []));
  },

  async setSyncQueue(queue) {
    return storage.set(STORAGE_KEYS.CLOUD_SYNC_QUEUE, ensureArray(queue));
  },

  async addToSyncQueue(item) {
    const queue = await this.getSyncQueue();
    const queueItem = {
      ...item,
      id: item.id || makeId("sync"),
      queuedAt: Date.now(),
      attempts: 0,
    };
    
    const newQueue = [...queue, queueItem];
    await storage.set(STORAGE_KEYS.CLOUD_SYNC_QUEUE, newQueue);
    return queueItem;
  },

  async removeFromSyncQueue(itemId) {
    const queue = await this.getSyncQueue();
    return storage.set(STORAGE_KEYS.CLOUD_SYNC_QUEUE, queue.filter(item => item.id !== itemId));
  },

  async clearSyncQueue() {
    return storage.remove(STORAGE_KEYS.CLOUD_SYNC_QUEUE);
  },
};

/**
 * DOMAIN: Premium Value Loop - Memory Export Cache
 * Cache exported memory data for performance
 */
export const memoryExportStorage = {
  async getCachedExport(exportId) {
    const cache = ensureObject(await storage.get(STORAGE_KEYS.MEMORY_EXPORT_CACHE, {}));
    return cache[exportId] || null;
  },

  async setCachedExport(exportId, exportData) {
    const cache = ensureObject(await storage.get(STORAGE_KEYS.MEMORY_EXPORT_CACHE, {}));
    cache[exportId] = {
      ...exportData,
      cachedAt: Date.now(),
    };
    
    // Keep only last 5 exports to manage storage
    const entries = Object.entries(cache);
    if (entries.length > 5) {
      const sorted = entries.sort(([,a], [,b]) => b.cachedAt - a.cachedAt);
      const newCache = Object.fromEntries(sorted.slice(0, 5));
      return storage.set(STORAGE_KEYS.MEMORY_EXPORT_CACHE, newCache);
    }
    
    return storage.set(STORAGE_KEYS.MEMORY_EXPORT_CACHE, cache);
  },

  async clearExportCache() {
    return storage.remove(STORAGE_KEYS.MEMORY_EXPORT_CACHE);
  },
};
