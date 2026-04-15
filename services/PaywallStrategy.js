/**
 * PaywallStrategy — Smart paywall re-targeting and timing
 *
 * Tracks paywall dismissals and shows the paywall again at
 * high-intent moments with appropriate cooldown periods.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const PAYWALL_STATE_KEY = '@betweenus:paywall_strategy';

const PaywallStrategy = {
  _state: null,

  async _load() {
    if (this._state) return this._state;
    try {
      const raw = await AsyncStorage.getItem(PAYWALL_STATE_KEY);
      this._state = raw ? JSON.parse(raw) : {
        dismissCount: 0,
        lastDismissedAt: null,
        lastShownAt: null,
        convertedFeatures: [],
      };
    } catch {
      this._state = { dismissCount: 0, lastDismissedAt: null, lastShownAt: null, convertedFeatures: [] };
    }
    return this._state;
  },

  async _save() {
    if (!this._state) return;
    try {
      await AsyncStorage.setItem(PAYWALL_STATE_KEY, JSON.stringify(this._state));
    } catch {}
  },

  /** Record that the user dismissed the paywall. */
  async recordDismissal() {
    const state = await this._load();
    state.dismissCount++;
    state.lastDismissedAt = Date.now();
    await this._save();
  },

  /** Record that the paywall was shown. */
  async recordShown() {
    const state = await this._load();
    state.lastShownAt = Date.now();
    await this._save();
  },

  /**
   * Should we show the paywall at this moment?
   * Rules:
   *   - Never show within 24h of last dismissal
   *   - Never show within 4h of last shown
   *   - After 3+ dismissals, only show once per week
   *   - Always show on first encounter of a gated feature
   */
  async shouldShow(featureId) {
    const state = await this._load();
    const now = Date.now();

    // First time hitting this feature? Always show.
    if (featureId && !state.convertedFeatures?.includes(featureId)) {
      return true;
    }

    const hoursSinceShown = state.lastShownAt ? (now - state.lastShownAt) / 3600000 : Infinity;
    const hoursSinceDismissed = state.lastDismissedAt ? (now - state.lastDismissedAt) / 3600000 : Infinity;

    // Cooldown after being shown
    if (hoursSinceShown < 4) return false;

    // Cooldown after dismissal
    if (hoursSinceDismissed < 24) return false;

    // After 3+ dismissals, weekly cooldown
    if (state.dismissCount >= 3 && hoursSinceDismissed < 168) return false;

    return true;
  },

  /** Mark a feature as "seen paywall for this". */
  async markFeatureSeen(featureId) {
    if (!featureId) return;
    const state = await this._load();
    if (!state.convertedFeatures) state.convertedFeatures = [];
    if (!state.convertedFeatures.includes(featureId)) {
      state.convertedFeatures.push(featureId);
      await this._save();
    }
  },
};

export default PaywallStrategy;
