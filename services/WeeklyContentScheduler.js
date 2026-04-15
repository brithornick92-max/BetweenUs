/**
 * WeeklyContentScheduler
 *
 * Drips content over time so users see fresh prompts and dates each week.
 * Each content item has a `releaseWeek` (0-based). Week 0 is the user's
 * install week; every Monday a new batch unlocks.
 *
 * Items without a `releaseWeek` are always available (backwards-compatible).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const INSTALL_DATE_KEY = 'weekly_content_install_date';

class WeeklyContentScheduler {
  constructor() {
    this._installDate = null;
    this._currentWeek = 0;
    this._ready = false;
  }

  /* ───── lifecycle ───── */

  async init() {
    if (this._ready) return;
    const stored = await AsyncStorage.getItem(INSTALL_DATE_KEY);
    if (stored) {
      this._installDate = new Date(stored);
    } else {
      // First launch — anchor to the most recent Monday so week boundaries
      // always fall on Mondays.
      const now = new Date();
      const day = now.getDay(); // 0 = Sunday
      const diffToMonday = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setDate(monday.getDate() - diffToMonday);
      monday.setHours(0, 0, 0, 0);
      this._installDate = monday;
      await AsyncStorage.setItem(INSTALL_DATE_KEY, monday.toISOString());
    }
    this._currentWeek = this._computeWeek();
    this._ready = true;
  }

  /** Whether init() has completed. */
  get ready() {
    return this._ready;
  }

  /* ───── week math ───── */

  /** Compute weeks from install date. */
  _computeWeek() {
    if (!this._installDate) return 0;
    const now = new Date();
    const ms = now.getTime() - this._installDate.getTime();
    return Math.max(0, Math.floor(ms / (7 * 24 * 60 * 60 * 1000)));
  }

  /** How many full weeks since install (0-based). Uses cached value after init. */
  getCurrentWeek() {
    if (this._ready) return this._currentWeek;
    return 0; // Before init, only week-0 content is available
  }

  /* ───── filtering ───── */

  /** Returns true if the item is available to the user right now. */
  isAvailable(item) {
    if (item.releaseWeek == null) return true; // legacy / untagged
    return item.releaseWeek <= this.getCurrentWeek();
  }

  /** Returns true if the item was released THIS week. */
  isNewThisWeek(item) {
    if (item.releaseWeek == null) return false;
    return item.releaseWeek === this.getCurrentWeek();
  }

  /** Filter an array of items to only those currently available. */
  filterAvailable(items) {
    const week = this.getCurrentWeek();
    return items.filter(i => i.releaseWeek == null || i.releaseWeek <= week);
  }

  /** Return only items released this week. */
  getNewThisWeek(items) {
    const week = this.getCurrentWeek();
    return items.filter(i => i.releaseWeek === week);
  }

  /** Summary for UI banners ("12 new prompts this week!"). */
  getNewContentCounts(prompts, dates) {
    return {
      newPrompts: this.getNewThisWeek(prompts).length,
      newDates: this.getNewThisWeek(dates).length,
    };
  }
}

export default new WeeklyContentScheduler();
