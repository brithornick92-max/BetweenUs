import AsyncStorage from '@react-native-async-storage/async-storage';

export const FREE_TIER_LIMITS = {
  promptsPerDay: 1,
  visibleDates: 10,
  journalEntriesVisible: 7,
  surpriseMeEnabled: false,
};

class LocalUsageService {
  constructor() {
    this.prefix = 'usage';
  }

  _todayKey() {
    return new Date().toISOString().split('T')[0];
  }

  _storageKey(userId, dateKey) {
    return `${this.prefix}_${userId}_${dateKey}`;
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
}

export default new LocalUsageService();
