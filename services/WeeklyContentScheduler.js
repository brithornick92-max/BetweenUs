/**
 * WeeklyContentScheduler
 *
 * Tracks weekly freshness for content.
 *
 * Important:
 * - releaseWeek is now treated as "featured/new this week" metadata.
 * - It should NOT be the main premium access gate.
 * - Premium users should be able to access the full eligible library.
 * - Free users should see small unlocked previews plus locked premium previews,
 *   handled by ContentAccessService / WeeklyContentSetService.
 *
 * Legacy hard-gate behavior is still available through:
 *   filterReleasedThroughCurrentWeek(items)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const INSTALL_DATE_KEY = '@betweenus:cache:weeklyContentInstallDate';

class WeeklyContentScheduler {
  constructor() {
    this._installDate = null;
    this._ready = false;
  }

  /* ───── lifecycle ───── */

  async init() {
    if (this._ready) return;

    const stored = await AsyncStorage.getItem(INSTALL_DATE_KEY);

    if (stored) {
      this._installDate = new Date(stored);
    } else {
      const monday = this._getMostRecentMonday(new Date());
      this._installDate = monday;
      await AsyncStorage.setItem(INSTALL_DATE_KEY, monday.toISOString());
    }

    this._ready = true;
  }

  get ready() {
    return this._ready;
  }

  _getMostRecentMonday(date) {
    const day = date.getDay(); // 0 = Sunday
    const diffToMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(date);

    monday.setDate(monday.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);

    return monday;
  }

  /* ───── week math ───── */

  _computeWeek() {
    if (!this._installDate) return 0;

    const now = new Date();
    const ms = now.getTime() - this._installDate.getTime();

    return Math.max(0, Math.floor(ms / (7 * 24 * 60 * 60 * 1000)));
  }

  getCurrentWeek() {
    if (!this._ready) return 0;

    return this._computeWeek();
  }

  /* ───── featured/newness helpers ───── */

  isReleasedThroughCurrentWeek(item) {
    if (item.releaseWeek == null) return true;

    return item.releaseWeek <= this.getCurrentWeek();
  }

  isNewThisWeek(item) {
    if (item.releaseWeek == null) return false;

    return item.releaseWeek === this.getCurrentWeek();
  }

  /**
   * New default behavior:
   * Return all items.
   *
   * releaseWeek is no longer used as the main access gate.
   * This preserves full-library value for premium users.
   */
  /**
   * Compatibility helper.
   *
   * releaseWeek no longer blocks access by default.
   * Use isReleasedThroughCurrentWeek() only for legacy drip-gated surfaces.
   */
  isAvailable(_item) {
    return true;
  }

  filterAvailable(items = []) {
    return Array.isArray(items) ? items : [];
  }

  /**
   * Legacy hard-drip behavior.
   * Use only if a specific surface intentionally wants releaseWeek gating.
   */
  filterReleasedThroughCurrentWeek(items = []) {
    const week = this.getCurrentWeek();

    return (Array.isArray(items) ? items : []).filter(
      (item) => item.releaseWeek == null || item.releaseWeek <= week
    );
  }

  getNewThisWeek(items = []) {
    const week = this.getCurrentWeek();

    return (Array.isArray(items) ? items : []).filter(
      (item) => item.releaseWeek === week
    );
  }

  getNewContentCounts(prompts = [], dates = [], positions = []) {
    return {
      newPrompts: this.getNewThisWeek(prompts).length,
      newDates: this.getNewThisWeek(dates).length,
      newPositions: this.getNewThisWeek(positions).length,
    };
  }
}

export default new WeeklyContentScheduler();
