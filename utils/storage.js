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
  const entropy = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${Date.now()}_${entropy}`;
};

const ensureArray = (v) => (Array.isArray(v) ? v : []);
const ensureObject = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const dayKeyLocal = (date = new Date()) => date.toISOString().split("T")[0];

/**
 * CORE STORAGE ENGINE (Singleton)
 */
export const storage = {
  async get(key) {
    try {
      const value = await AsyncStorage.getItem(key);
      return safeParse(value);
    } catch (error) {
      return null;
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
    const data = await storage.get(STORAGE_KEYS.PROMPT_ANSWERS);
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
    const rawData = await storage.get(STORAGE_KEYS.PROMPT_ANSWERS) || {};
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
    const all = await storage.get(STORAGE_KEYS.PROMPT_ANSWERS) || {};
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
    const data = await storage.get(STORAGE_KEYS.JOURNAL_ENTRIES);
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
    const entries = await storage.get(STORAGE_KEYS.JOURNAL_ENTRIES) || [];
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
    const entries = await storage.get(STORAGE_KEYS.JOURNAL_ENTRIES) || [];
    return storage.set(
      STORAGE_KEYS.JOURNAL_ENTRIES,
      entries.filter((e) => e.id !== entryId)
    );
  },
};

/**
 * DOMAIN: Check-Ins
 * @deprecated Use DataLayer.saveCheckIn() / DataLayer.getCheckIns()
 * for couple-aware E2EE + cross-device sync.
 * Compatible with your CheckInScreen:
 * - getTodayCheckIn()
 * - saveCheckIn({ mood, closeness, touch, intimacy, space })
 */
export const checkInStorage = {
  async getAll() {
    return ensureObject(await storage.get(STORAGE_KEYS.CHECK_INS));
  },

  async getTodayCheckIn() {
    const all = await this.getAll();
    return all[dayKeyLocal()] || null;
  },

  async saveCheckIn(payload) {
    const all = await this.getAll();
    const today = dayKeyLocal();

    all[today] = {
      ...(all[today] || {}),
      ...(payload || {}),
      timestamp: Date.now(),
      synced: false,
    };

    await storage.set(STORAGE_KEYS.CHECK_INS, all);
    return all[today];
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
    const data = await storage.get(STORAGE_KEYS.MY_DATES);
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
    return ensureArray(await storage.get(STORAGE_KEYS.CALENDAR_EVENTS));
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
    return (await storage.get(STORAGE_KEYS.ONBOARDING_COMPLETED)) === true;
  },

  async setOnboardingCompleted(v) {
    return storage.set(STORAGE_KEYS.ONBOARDING_COMPLETED, !!v);
  },

  async getProfile() {
    return await storage.get(STORAGE_KEYS.USER_PROFILE);
  },

  async setProfile(profile) {
    return storage.set(STORAGE_KEYS.USER_PROFILE, profile);
  },

  async getPartnerLabel() {
    return await storage.get(STORAGE_KEYS.PARTNER_LABEL);
  },

  async setPartnerLabel(label) {
    return storage.set(STORAGE_KEYS.PARTNER_LABEL, label);
  },
};

/**
 * DOMAIN: Couple
 * Matches what AppContext expects.
 */
export const coupleStorage = {
  async getCoupleData() {
    const [coupleId, role, partnerProfile] = await Promise.all([
      storage.get(STORAGE_KEYS.COUPLE_ID),
      storage.get(STORAGE_KEYS.COUPLE_ROLE),
      storage.get(STORAGE_KEYS.PARTNER_PROFILE),
    ]);

    return {
      coupleId: coupleId || null,
      role: role || null,
      partnerProfile: partnerProfile || null,
    };
  },

  async setCoupleData({ coupleId, role, partnerProfile = null }) {
    return storage.multiSet({
      [STORAGE_KEYS.COUPLE_ID]: coupleId,
      [STORAGE_KEYS.COUPLE_ROLE]: role,
      [STORAGE_KEYS.PARTNER_PROFILE]: partnerProfile,
    });
  },

  async clearCouple() {
    await storage.remove(STORAGE_KEYS.COUPLE_ID);
    await storage.remove(STORAGE_KEYS.COUPLE_ROLE);
    await storage.remove(STORAGE_KEYS.PARTNER_PROFILE);
    return true;
  },
};

/**
 * DOMAIN: Settings
 * Matches what AppContext expects.
 */
export const settingsStorage = {
  async getAppLockEnabled() {
    return (await storage.get(STORAGE_KEYS.APP_LOCK_ENABLED)) === true;
  },

  async setAppLockEnabled(enabled) {
    return storage.set(STORAGE_KEYS.APP_LOCK_ENABLED, !!enabled);
  },

  async getDateNightDefaults() {
    return await storage.get("@betweenus:dateNightDefaults");
  },

  async setDateNightDefaults(defaults) {
    return storage.set("@betweenus:dateNightDefaults", defaults);
  },
};
/**
 * DOMAIN: Premium Value Loop - Memories
 * Relationship memory storage with timeline generation
 */
export const memoryStorage = {
  async getMemories() {
    return ensureArray(await storage.get(STORAGE_KEYS.MEMORIES));
  },

  async addMemory(memory) {
    const memories = await this.getMemories();
    const processedMemory = {
      ...memory,
      id: memory.id || makeId("mem"),
      createdAt: memory.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    
    const newMemories = [processedMemory, ...memories.filter(m => m.id !== processedMemory.id)];
    await storage.set(STORAGE_KEYS.MEMORIES, newMemories);
    return processedMemory;
  },

  async updateMemory(memory) {
    if (!memory?.id) return null;
    const memories = await this.getMemories();
    const processed = { ...memory, updatedAt: Date.now() };
    const newMemories = [processed, ...memories.filter(m => m.id !== processed.id)];
    await storage.set(STORAGE_KEYS.MEMORIES, newMemories);
    return processed;
  },

  async deleteMemory(memoryId) {
    const memories = await this.getMemories();
    return storage.set(STORAGE_KEYS.MEMORIES, memories.filter(m => m.id !== memoryId));
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
 */
export const ritualStorage = {
  async getRitualHistory() {
    return ensureArray(await storage.get(STORAGE_KEYS.RITUAL_HISTORY));
  },

  async addRitual(ritual) {
    const history = await this.getRitualHistory();
    const processedRitual = {
      ...ritual,
      id: ritual.id || makeId("ritual"),
      createdAt: ritual.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    
    const newHistory = [processedRitual, ...history.filter(r => r.id !== processedRitual.id)];
    await storage.set(STORAGE_KEYS.RITUAL_HISTORY, newHistory);
    return processedRitual;
  },

  async getCustomFlows() {
    return ensureArray(await storage.get(STORAGE_KEYS.CUSTOM_RITUAL_FLOWS));
  },

  async addCustomFlow(flow) {
    const flows = await this.getCustomFlows();
    const processedFlow = {
      ...flow,
      id: flow.id || makeId("flow"),
      createdAt: flow.createdAt || Date.now(),
      updatedAt: Date.now(),
      isPremium: true,
    };
    
    const newFlows = [processedFlow, ...flows.filter(f => f.id !== processedFlow.id)];
    await storage.set(STORAGE_KEYS.CUSTOM_RITUAL_FLOWS, newFlows);
    return processedFlow;
  },

  async deleteCustomFlow(flowId) {
    const flows = await this.getCustomFlows();
    return storage.set(STORAGE_KEYS.CUSTOM_RITUAL_FLOWS, flows.filter(f => f.id !== flowId));
  },
};

/**
 * DOMAIN: Premium Value Loop - Vibe History
 * Track vibe signal history for analytics and themes
 */
export const vibeStorage = {
  async getVibeHistory() {
    return ensureArray(await storage.get(STORAGE_KEYS.VIBE_HISTORY));
  },

  async addVibeEntry(vibe, userId) {
    const history = await this.getVibeHistory();
    const entry = {
      id: makeId("vibe"),
      vibe,
      userId,
      timestamp: Date.now(),
      synced: false,
    };
    
    const newHistory = [entry, ...history.slice(0, 99)]; // Keep last 100 entries
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
    const raw = ensureObject(await storage.get(STORAGE_KEYS.BIOMETRIC_VAULT));
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
    const vault = ensureObject(await storage.get(STORAGE_KEYS.BIOMETRIC_VAULT));
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
    return ensureObject(await storage.get(STORAGE_KEYS.CLOUD_SYNC_STATUS));
  },

  async setSyncStatus(status) {
    return storage.set(STORAGE_KEYS.CLOUD_SYNC_STATUS, {
      ...status,
      lastUpdated: Date.now(),
    });
  },

  async getBackupMetadata() {
    return ensureArray(await storage.get(STORAGE_KEYS.CLOUD_BACKUP_METADATA));
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
    return await storage.get(STORAGE_KEYS.LAST_CLOUD_SYNC);
  },

  async setLastSyncTime(timestamp = Date.now()) {
    return storage.set(STORAGE_KEYS.LAST_CLOUD_SYNC, timestamp);
  },

  async getSyncQueue() {
    return ensureArray(await storage.get(STORAGE_KEYS.CLOUD_SYNC_QUEUE));
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
    const cache = ensureObject(await storage.get(STORAGE_KEYS.MEMORY_EXPORT_CACHE));
    return cache[exportId] || null;
  },

  async setCachedExport(exportId, exportData) {
    const cache = ensureObject(await storage.get(STORAGE_KEYS.MEMORY_EXPORT_CACHE));
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
