import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Cache-only device persistence.
 *
 * Supabase is the source of truth for user, couple, entitlement, and content
 * data. This module remains as a compatibility layer for UI caches, optimistic
 * state, offline retry queues, and non-authoritative display preferences.
 */

const CACHE_PREFIX = "@betweenus:cache:";
const APP_PREFIX = CACHE_PREFIX.replace(/cache:$/, "");
const LEGACY_KEY_PREFIXES = ["prompt_rating_"];
const LEGACY_KEYS = ["pending_shared_anniversary_date"];

const key = (name) => `${CACHE_PREFIX}${name}`;

const isLegacyLocalKey = (item) => (
  (item.startsWith(APP_PREFIX) && !item.startsWith(CACHE_PREFIX))
  || LEGACY_KEYS.includes(item)
  || LEGACY_KEY_PREFIXES.some((prefix) => item.startsWith(prefix))
);

export const STORAGE_KEYS = {
  USER_ID: key("userId"),
  ONBOARDING_COMPLETED: key("onboardingCompleted"),
  PENDING_ONBOARDING: key("pendingOnboarding"),
  USER_PROFILE: key("userProfile"),
  PARTNER_LABEL: key("partnerLabel"),
  COUPLE_ID: key("coupleId"),
  COUPLE_ROLE: key("coupleRole"),
  PARTNER_PROFILE: key("partnerProfile"),
  LAST_PARTNER_ACTIVITY: key("lastPartnerActivity"),
  APP_LOCK_ENABLED: key("appLockEnabled"),
  BIOMETRICS_AVAILABLE: key("biometricsAvailable"),
  THEME_MODE: key("themeMode"),
  NOTIFICATION_SETTINGS: key("notificationSettings"),
  PRIVACY_SETTINGS: key("privacySettings"),
  KEEPSAKE_SETTINGS: key("keepsakeSettings"),
  PROMPT_ANSWERS: key("promptAnswers"),
  JOURNAL_ENTRIES: key("journalEntries"),
  CHECK_INS: key("checkIns"),
  CALENDAR_EVENTS: key("calendarEvents"),
  MY_DATES: key("myDates"),
  PREMIUM_STATUS: key("premiumStatus"),
  PARTNER_PREMIUM_STATUS: key("partnerPremiumStatus"),
  PREMIUM_PROMPT_LIBRARY_STARTED_AT: key("premiumPromptLibraryStartedAt"),
  PREMIUM_SELF_STARTED_AT: key("premiumSelfStartedAt"),
  SAVED_PROMPTS_FOR_LATER: key("savedPromptsForLater"),
  PARTNER_PROMPT_DAILY_QUOTE: key("partnerPromptDailyQuote"),
  CONTENT_DECK_RESTORES: key("contentDeckRestores"),
  WEEKLY_CONTENT_ALLOCATIONS: key("weeklyContentAllocations"),
  MEMORIES: key("memories"),
  RITUAL_HISTORY: key("ritualHistory"),
  RITUAL_SYNC_QUEUE: key("ritualSyncQueue"),
  CUSTOM_RITUAL_FLOWS: key("customRitualFlows"),
  VIBE_HISTORY: key("vibeHistory"),
  PARTNER_VIBE_HISTORY: key("partnerVibeHistory"),
  VIBE_SYNC_QUEUE: key("vibeSyncQueue"),
  ANNIVERSARY_THEMES: key("anniversaryThemes"),
  ANNIVERSARY_VIBE_HISTORY: key("anniversaryVibeHistory"),
  EDITORIAL_PROMPTS: key("editorialPrompts"),
  PROMPT_SYNC_QUEUE: key("promptSyncQueue"),
  MEMORY_EXPORT_CACHE: key("memoryExportCache"),
  CLOUD_SYNC_STATUS: key("cloudSyncStatus"),
  CLOUD_BACKUP_METADATA: key("cloudBackupMetadata"),
  LAST_CLOUD_SYNC: key("lastCloudSync"),
  CLOUD_SYNC_QUEUE: key("cloudSyncQueue"),
  RITUAL_REMINDERS: key("ritualReminders"),
  LOVE_NOTES: key("loveNotes"),
  DATE_TRIED_FALLBACK: key("dateTriedFallback"),
  INTIMACY_TRIED_FALLBACK: key("intimacyTriedFallback"),
};

const safeParse = (raw) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);
const ensureObject = (value) => (
  value && typeof value === "object" && !Array.isArray(value) ? value : {}
);
const toTimestampMs = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const dayKeyLocal = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const makeId = (prefix = "row") => {
  try {
    const { randomUUID } = require("expo-crypto");
    return `${prefix}_${randomUUID()}`;
  } catch {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
};

export const storage = {
  async get(storageKey, defaultValue = null) {
    try {
      const value = await AsyncStorage.getItem(storageKey);
      const parsed = safeParse(value);
      return parsed === null ? defaultValue : parsed;
    } catch {
      return defaultValue;
    }
  },

  async set(storageKey, value) {
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  async multiSet(keyValuePairs) {
    try {
      const pairs = Object.entries(keyValuePairs).map(([k, v]) => [k, JSON.stringify(v)]);
      await AsyncStorage.multiSet(pairs);
      return true;
    } catch {
      return false;
    }
  },

  async remove(storageKey) {
    try {
      await AsyncStorage.removeItem(storageKey);
      return true;
    } catch {
      return false;
    }
  },

  async clearSession() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const appCacheKeys = keys.filter((item) => item.startsWith(CACHE_PREFIX) || isLegacyLocalKey(item));
      if (appCacheKeys.length) await AsyncStorage.multiRemove(appCacheKeys);
      return true;
    } catch {
      return false;
    }
  },

  async purgeLegacyLocalStorage() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const legacyKeys = keys.filter(isLegacyLocalKey);
      if (legacyKeys.length) await AsyncStorage.multiRemove(legacyKeys);
      return true;
    } catch {
      return false;
    }
  },
};

export const promptStorage = {
  async getAll() {
    return ensureObject(await storage.get(STORAGE_KEYS.PROMPT_ANSWERS, {}));
  },
  async getAnswer(dateKey, promptId) {
    const all = await this.getAll();
    return all?.[dateKey]?.[promptId] || null;
  },
  async setAnswer(dateKey, promptId, payload) {
    const all = await this.getAll();
    const byDate = ensureObject(all[dateKey]);
    const answerData = typeof payload === "string"
      ? { answer: payload, timestamp: Date.now() }
      : { ...(payload || {}), timestamp: payload?.timestamp || Date.now() };
    byDate[promptId] = { ...answerData, promptId };
    all[dateKey] = byDate;
    await storage.set(STORAGE_KEYS.PROMPT_ANSWERS, all);
    return answerData;
  },
  async deleteAnswer(dateKey, promptId) {
    const all = await this.getAll();
    const byDate = ensureObject(all[dateKey]);
    delete byDate[promptId];
    all[dateKey] = byDate;
    return storage.set(STORAGE_KEYS.PROMPT_ANSWERS, all);
  },
  async getAllAnswersForDate(dateKey) {
    const all = await this.getAll();
    return Object.values(ensureObject(all[dateKey]));
  },
};

export const savedPromptStorage = {
  async getAll() {
    return ensureArray(await storage.get(STORAGE_KEYS.SAVED_PROMPTS_FOR_LATER, []))
      .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  },
  async save(prompt) {
    if (!prompt?.id) return null;
    const saved = await this.getAll();
    const entry = {
      id: String(prompt.id),
      promptId: String(prompt.id),
      text: prompt.text || prompt.prompt || '',
      heat: prompt.heat || prompt.heatLevel || prompt.level || 1,
      category: prompt.category || 'Reflection',
      savedAt: Date.now(),
    };
    const next = [entry, ...saved.filter((item) => String(item.promptId || item.id) !== entry.promptId)];
    await storage.set(STORAGE_KEYS.SAVED_PROMPTS_FOR_LATER, next);
    return entry;
  },
  async remove(promptId) {
    const saved = await this.getAll();
    return storage.set(
      STORAGE_KEYS.SAVED_PROMPTS_FOR_LATER,
      saved.filter((item) => String(item.promptId || item.id) !== String(promptId))
    );
  },
};

export const journalStorage = {
  async getEntries() {
    return ensureArray(await storage.get(STORAGE_KEYS.JOURNAL_ENTRIES, []))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },
  async saveEntry(entry) {
    const entries = await this.getEntries();
    const isUpdate = !!entry?.id;
    const processed = {
      ...(entry || {}),
      id: isUpdate ? entry.id : makeId("jrnl"),
      createdAt: isUpdate ? entry.createdAt : Date.now(),
      updatedAt: Date.now(),
    };
    const next = isUpdate
      ? entries.map((item) => (item.id === processed.id ? processed : item))
      : [processed, ...entries];
    await storage.set(STORAGE_KEYS.JOURNAL_ENTRIES, next);
    return processed;
  },
  async deleteEntry(entryId) {
    const entries = await this.getEntries();
    return storage.set(STORAGE_KEYS.JOURNAL_ENTRIES, entries.filter((item) => item.id !== entryId));
  },
};

export const loveNoteStorage = {
  async getNotes() {
    return ensureArray(await storage.get(STORAGE_KEYS.LOVE_NOTES, []))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },
  async saveNote(note) {
    const notes = await this.getNotes();
    const isUpdate = !!note?.id && notes.some((item) => item.id === note.id);
    const processed = {
      ...(note || {}),
      id: isUpdate ? note.id : makeId("note"),
      isRead: note?.isRead ?? false,
      createdAt: isUpdate ? note.createdAt : Date.now(),
      updatedAt: Date.now(),
    };
    const next = isUpdate
      ? notes.map((item) => (item.id === processed.id ? processed : item))
      : [processed, ...notes];
    await storage.set(STORAGE_KEYS.LOVE_NOTES, next);
    return processed;
  },
  async markRead(noteId) {
    const notes = await this.getNotes();
    return storage.set(
      STORAGE_KEYS.LOVE_NOTES,
      notes.map((item) => item.id === noteId ? { ...item, isRead: true, readAt: Date.now() } : item)
    );
  },
  async deleteNote(noteId) {
    const notes = await this.getNotes();
    return storage.set(STORAGE_KEYS.LOVE_NOTES, notes.filter((item) => item.id !== noteId));
  },
  async getUnreadCount() {
    const notes = await this.getNotes();
    return notes.filter((item) => !item.isRead).length;
  },
};

export const checkInStorage = {
  async getAll() {
    return ensureObject(await storage.get(STORAGE_KEYS.CHECK_INS, {}));
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

export const userStorage = {
  getUserId: () => storage.get(STORAGE_KEYS.USER_ID, null),
  setUserId: (userId) => storage.set(STORAGE_KEYS.USER_ID, userId),
  isOnboardingCompleted: async () => (await storage.get(STORAGE_KEYS.ONBOARDING_COMPLETED, false)) === true,
  setOnboardingCompleted: (value) => storage.set(STORAGE_KEYS.ONBOARDING_COMPLETED, !!value),
  getProfile: () => storage.get(STORAGE_KEYS.USER_PROFILE, {}),
  setProfile: (profile) => storage.set(STORAGE_KEYS.USER_PROFILE, ensureObject(profile)),
};

export const coupleStorage = {
  async getCoupleData() {
    const [coupleId, role, partnerProfile] = await Promise.all([
      storage.get(STORAGE_KEYS.COUPLE_ID, null),
      storage.get(STORAGE_KEYS.COUPLE_ROLE, null),
      storage.get(STORAGE_KEYS.PARTNER_PROFILE, null),
    ]);
    return { coupleId, role, partnerProfile };
  },
  async setCoupleData({ coupleId, role, partnerProfile = null }) {
    await Promise.all([
      storage.set(STORAGE_KEYS.COUPLE_ID, coupleId),
      storage.set(STORAGE_KEYS.COUPLE_ROLE, role),
      storage.set(STORAGE_KEYS.PARTNER_PROFILE, partnerProfile),
    ]);
    return true;
  },
  async clearCouple() {
    await Promise.all([
      storage.remove(STORAGE_KEYS.COUPLE_ID),
      storage.remove(STORAGE_KEYS.COUPLE_ROLE),
      storage.remove(STORAGE_KEYS.PARTNER_PROFILE),
    ]);
    return true;
  },
};

export const settingsStorage = {
  getThemeMode: (defaultValue = "dark") => storage.get(STORAGE_KEYS.THEME_MODE, defaultValue),
  setThemeMode: (mode) => storage.set(STORAGE_KEYS.THEME_MODE, mode),
  getAppLockEnabled: async () => (await storage.get(STORAGE_KEYS.APP_LOCK_ENABLED, false)) === true,
  setAppLockEnabled: (enabled) => storage.set(STORAGE_KEYS.APP_LOCK_ENABLED, !!enabled),
  getPrivacySettings: () => storage.get(STORAGE_KEYS.PRIVACY_SETTINGS, {}),
  setPrivacySettings: (settings) => storage.set(STORAGE_KEYS.PRIVACY_SETTINGS, ensureObject(settings)),
  getNotificationSettings: () => storage.get(STORAGE_KEYS.NOTIFICATION_SETTINGS, {}),
  setNotificationSettings: (settings) => storage.set(STORAGE_KEYS.NOTIFICATION_SETTINGS, ensureObject(settings)),
  getKeepsakeSettings: () => storage.get(STORAGE_KEYS.KEEPSAKE_SETTINGS, {}),
  setKeepsakeSettings: (settings) => storage.set(STORAGE_KEYS.KEEPSAKE_SETTINGS, ensureObject(settings)),
  getDateNightDefaults: () => storage.get(key("dateNightDefaults"), {}),
  setDateNightDefaults: (defaults) => storage.set(key("dateNightDefaults"), ensureObject(defaults)),
};

function collectionStorage(storageKey, prefix) {
  return {
    async getItems() {
      return ensureArray(await storage.get(storageKey, []));
    },
    async addItem(item) {
      const items = await this.getItems();
      const processed = {
        ...(item || {}),
        id: item?.id || makeId(prefix),
        createdAt: item?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      await storage.set(storageKey, [processed, ...items.filter((row) => row.id !== processed.id)]);
      return processed;
    },
    async updateItem(item) {
      if (!item?.id) return null;
      const items = await this.getItems();
      const processed = { ...item, updatedAt: Date.now() };
      await storage.set(storageKey, [processed, ...items.filter((row) => row.id !== processed.id)]);
      return processed;
    },
    async deleteItem(itemId) {
      const items = await this.getItems();
      return storage.set(storageKey, items.filter((row) => row.id !== itemId));
    },
  };
}

const memories = collectionStorage(STORAGE_KEYS.MEMORIES, "mem");
export const memoryStorage = {
  getMemories: () => memories.getItems(),
  addMemory: (memory) => memories.addItem(memory),
  updateMemory: (memory) => memories.updateItem(memory),
  deleteMemory: (memoryId) => memories.deleteItem(memoryId),
  async getMemoriesByType(type) {
    return (await memories.getItems()).filter((memory) => memory.type === type);
  },
  async getMemoriesForDateRange(startDate, endDate) {
    return (await memories.getItems()).filter((memory) => {
      const memoryDate = new Date(memory.date);
      return memoryDate >= startDate && memoryDate <= endDate;
    });
  },
};

const ritualHistory = collectionStorage(STORAGE_KEYS.RITUAL_HISTORY, "ritual");
const customFlows = collectionStorage(STORAGE_KEYS.CUSTOM_RITUAL_FLOWS, "flow");
export const ritualStorage = {
  getRitualHistory: () => ritualHistory.getItems(),
  addRitual: (ritual) => ritualHistory.addItem(ritual),
  getCustomFlows: () => customFlows.getItems(),
  addCustomFlow: (flow) => customFlows.addItem({ ...(flow || {}), isPremium: true }),
  deleteCustomFlow: (flowId) => customFlows.deleteItem(flowId),
};

export const vibeStorage = {
  getVibeHistory: () => storage.get(STORAGE_KEYS.VIBE_HISTORY, []),
  async addVibeEntry(vibe, userId, options = {}) {
    const history = ensureArray(await storage.get(STORAGE_KEYS.VIBE_HISTORY, []));
    const entry = {
      id: makeId("vibe"),
      vibe,
      userId,
      source: options.source || null,
      timestamp: options.timestamp ?? Date.now(),
      synced: false,
    };
    await storage.set(STORAGE_KEYS.VIBE_HISTORY, [entry, ...history.slice(0, 99)]);
    return entry;
  },
  async getRecentVibes(days = 7, options = {}) {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    return (await this.getVibeHistory()).filter((entry) => {
      const timestamp = toTimestampMs(entry?.timestamp);
      if (timestamp === null || timestamp <= cutoff) return false;
      return options.source ? entry?.source === options.source : true;
    });
  },
  async addPartnerVibeEntry(vibe, options = {}) {
    const history = ensureArray(await storage.get(STORAGE_KEYS.PARTNER_VIBE_HISTORY, []));
    const entry = {
      id: makeId("pvibe"),
      vibe,
      source: options.source || null,
      timestamp: options.timestamp ?? Date.now(),
      isPartner: true,
    };
    await storage.set(STORAGE_KEYS.PARTNER_VIBE_HISTORY, [entry, ...history.slice(0, 99)]);
    return entry;
  },
  async getRecentPartnerVibes(days = 7, options = {}) {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const history = ensureArray(await storage.get(STORAGE_KEYS.PARTNER_VIBE_HISTORY, []));
    return history.filter((entry) => {
      const timestamp = toTimestampMs(entry?.timestamp);
      if (timestamp === null || timestamp <= cutoff) return false;
      return options.source ? entry?.source === options.source : true;
    });
  },
};

export const cloudSyncStorage = {
  getSyncStatus: () => storage.get(STORAGE_KEYS.CLOUD_SYNC_STATUS, {}),
  async setSyncStatus(status) {
    return storage.set(STORAGE_KEYS.CLOUD_SYNC_STATUS, {
      ...(status || {}),
      lastUpdated: Date.now(),
    });
  },
  getBackupMetadata: () => storage.get(STORAGE_KEYS.CLOUD_BACKUP_METADATA, []),
  async addBackupMetadata(metadata) {
    const backups = ensureArray(await storage.get(STORAGE_KEYS.CLOUD_BACKUP_METADATA, []));
    const processed = { ...(metadata || {}), id: metadata?.id || makeId("backup"), createdAt: metadata?.createdAt || Date.now() };
    await storage.set(STORAGE_KEYS.CLOUD_BACKUP_METADATA, [processed, ...backups.slice(0, 9)]);
    return processed;
  },
  getLastSyncTime: () => storage.get(STORAGE_KEYS.LAST_CLOUD_SYNC, null),
  setLastSyncTime: (timestamp = Date.now()) => storage.set(STORAGE_KEYS.LAST_CLOUD_SYNC, timestamp),
  getSyncQueue: () => storage.get(STORAGE_KEYS.CLOUD_SYNC_QUEUE, []),
  setSyncQueue: (queue) => storage.set(STORAGE_KEYS.CLOUD_SYNC_QUEUE, ensureArray(queue)),
  async addToSyncQueue(item) {
    const queue = ensureArray(await storage.get(STORAGE_KEYS.CLOUD_SYNC_QUEUE, []));
    const queueItem = { ...(item || {}), id: item?.id || makeId("sync"), queuedAt: Date.now(), attempts: 0 };
    await storage.set(STORAGE_KEYS.CLOUD_SYNC_QUEUE, [...queue, queueItem]);
    return queueItem;
  },
  async removeFromSyncQueue(itemId) {
    const queue = ensureArray(await storage.get(STORAGE_KEYS.CLOUD_SYNC_QUEUE, []));
    return storage.set(STORAGE_KEYS.CLOUD_SYNC_QUEUE, queue.filter((item) => item.id !== itemId));
  },
  clearSyncQueue: () => storage.remove(STORAGE_KEYS.CLOUD_SYNC_QUEUE),
};

export const memoryExportStorage = {
  async getCachedExport(exportId) {
    const cache = ensureObject(await storage.get(STORAGE_KEYS.MEMORY_EXPORT_CACHE, {}));
    return cache[exportId] || null;
  },
  async setCachedExport(exportId, exportData) {
    const cache = ensureObject(await storage.get(STORAGE_KEYS.MEMORY_EXPORT_CACHE, {}));
    cache[exportId] = { ...(exportData || {}), cachedAt: Date.now() };
    const entries = Object.entries(cache).sort(([, a], [, b]) => b.cachedAt - a.cachedAt);
    return storage.set(STORAGE_KEYS.MEMORY_EXPORT_CACHE, Object.fromEntries(entries.slice(0, 5)));
  },
  clearExportCache: () => storage.remove(STORAGE_KEYS.MEMORY_EXPORT_CACHE),
};
