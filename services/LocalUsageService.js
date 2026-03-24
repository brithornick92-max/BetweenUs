import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * @deprecated Use FREE_LIMITS from utils/featureFlags.js instead.
 * Kept only for backward compatibility — values now match featureFlags.
 */
export const FREE_TIER_LIMITS = {
  promptsPerDay: 1,
  visibleDates: 3,
  fullDateFlowsPerWeek: 1,
  journalEntriesVisible: 0,
  surpriseMeEnabled: false,
};

class LocalUsageService {
  constructor() {
    this.prefix = 'usage';
  }

  _todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  _storageKey(userId, dateKey) {
    return `${this.prefix}_${userId}_${dateKey}`;
  }

  _weekKey(date = new Date()) {
    const d = date instanceof Date ? new Date(date) : new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diffToMonday = (day + 6) % 7;
    d.setDate(d.getDate() - diffToMonday);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const dateOfMonth = String(d.getDate()).padStart(2, '0');
    return `${year}-W-${month}-${dateOfMonth}`;
  }

  _weeklyStorageKey(userId, weekKey) {
    return `${this.prefix}_weekly_${userId}_${weekKey}`;
  }

  async resetIfNewDay(userId) {
    const today = this._todayKey();
    const key = this._storageKey(userId, today);
    const existing = await AsyncStorage.getItem(key);
    if (!existing) {
      await AsyncStorage.setItem(
        key,
        JSON.stringify({ date: today, prompts: 0, dates: 0, challenges: 0 })
      );
    }
  }

  async getDailyUsage(userId) {
    const today = this._todayKey();
    const key = this._storageKey(userId, today);
    const stored = await AsyncStorage.getItem(key);
    if (!stored) {
      const empty = { date: today, prompts: 0, dates: 0, challenges: 0 };
      await AsyncStorage.setItem(key, JSON.stringify(empty));
      return empty;
    }
    try {
      return JSON.parse(stored);
    } catch {
      const empty = { date: today, prompts: 0, dates: 0, challenges: 0 };
      await AsyncStorage.setItem(key, JSON.stringify(empty));
      return empty;
    }
  }

  async incrementDailyUsage(userId, type) {
    const usage = await this.getDailyUsage(userId);
    usage[type] = (usage[type] || 0) + 1;
    usage.lastUpdated = new Date().toISOString();
    const key = this._storageKey(userId, usage.date);
    await AsyncStorage.setItem(key, JSON.stringify(usage));
    return usage;
  }

  async getWeeklyUsage(userId) {
    const week = this._weekKey();
    const key = this._weeklyStorageKey(userId, week);
    const stored = await AsyncStorage.getItem(key);
    if (!stored) {
      const empty = { week, dateFlows: 0, unlockedDateId: null };
      await AsyncStorage.setItem(key, JSON.stringify(empty));
      return empty;
    }
    try {
      return JSON.parse(stored);
    } catch {
      const empty = { week, dateFlows: 0, unlockedDateId: null };
      await AsyncStorage.setItem(key, JSON.stringify(empty));
      return empty;
    }
  }

  async incrementWeeklyUsage(userId, type, metadata = {}) {
    const usage = await this.getWeeklyUsage(userId);
    usage[type] = (usage[type] || 0) + 1;
    if (metadata.unlockedDateId !== undefined) {
      usage.unlockedDateId = metadata.unlockedDateId;
    }
    usage.lastUpdated = new Date().toISOString();
    const key = this._weeklyStorageKey(userId, usage.week);
    await AsyncStorage.setItem(key, JSON.stringify(usage));
    return usage;
  }
}

export default new LocalUsageService();
