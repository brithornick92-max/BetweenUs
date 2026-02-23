/**
 * connectionMemory.js — Local behavioral memory for Between Us
 *
 * A lightweight, privacy-first store that remembers how the couple
 * engages with the app — not what they say, but what they gravitate
 * toward. Used to make "Surprise Me" context-aware, power soft
 * continuity ("pick up where you left off"), and gently shape
 * the home screen without any cloud dependency.
 *
 * Everything stays on-device in AsyncStorage. Nothing here is
 * ever synced to Supabase or sent to analytics.
 *
 * Stored signals:
 *   • preferredLoad        — which load levels they tap most (1/2/3)
 *   • preferredStyle       — which interaction styles they tap most (talking/doing/mixed)
 *   • preferredHeat        — which heat levels they tap most (1-5)
 *   • preferredHeatLevel   — comfort zone (median of last 10 selections)
 *   • timeOfDayPatterns    — when they tend to open the app
 *   • lastSurpriseIds      — avoid repeating the same date idea
 *   • sessionLengths       — short/medium/long engagement trend
 *   • lastVisitedScreen    — for soft continuity
 *   • lastPromptCategory   — for "more like this" suggestions
 *   • featureAffinities    — which features they return to
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const MEMORY_KEY = '@betweenus:connectionMemory';
const MAX_RECENT_IDS = 20;
const MAX_DIM_HISTORY = 30;
const MAX_SESSION_LENGTHS = 15;

// ─── Default shape ──────────────────────────────────────────────

function defaultMemory() {
  return {
    preferredLoad: [],           // last N load selections (1/2/3)
    preferredStyle: [],          // last N style selections (talking/doing/mixed)
    preferredHeat: [],           // last N heat selections (1-5)
    preferredHeatLevel: null,    // median of recent heat selections
    heatHistory: [],             // raw last-10 heat selections
    timeOfDayPatterns: {         // count of opens by time bucket
      morning: 0,   // 5am–11am
      afternoon: 0, // 11am–5pm
      evening: 0,   // 5pm–9pm
      night: 0,     // 9pm–5am
    },
    lastSurpriseIds: [],         // IDs of recently shown Surprise Me dates
    sessionLengths: [],          // last N session durations in seconds
    lastVisitedScreen: null,     // screen name for soft continuity
    lastVisitedAt: null,         // ISO timestamp
    lastPromptCategory: null,    // category string
    lastPromptId: null,          // for "continue where you left off"
    featureAffinities: {},       // { featureName: hitCount }
    updatedAt: null,
  };
}

// ─── Time-of-day helpers ────────────────────────────────────────

function getTimeBucket(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

function getDominantTimeBucket(patterns) {
  let max = 0;
  let dominant = 'evening'; // sensible default
  for (const [bucket, count] of Object.entries(patterns)) {
    if (count > max) {
      max = count;
      dominant = bucket;
    }
  }
  return dominant;
}

function median(arr) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ─── Core API ───────────────────────────────────────────────────

const ConnectionMemory = {
  _cache: null,

  async _load() {
    if (this._cache) return this._cache;
    try {
      const raw = await AsyncStorage.getItem(MEMORY_KEY);
      this._cache = raw ? { ...defaultMemory(), ...JSON.parse(raw) } : defaultMemory();
    } catch {
      this._cache = defaultMemory();
    }
    return this._cache;
  },

  async _save() {
    if (!this._cache) return;
    this._cache.updatedAt = new Date().toISOString();
    try {
      await AsyncStorage.setItem(MEMORY_KEY, JSON.stringify(this._cache));
    } catch {
      // Non-critical — memory is ephemeral by design
    }
  },

  /** Record a session open (tracks time-of-day pattern). */
  async recordSessionOpen() {
    const mem = await this._load();
    const bucket = getTimeBucket();
    mem.timeOfDayPatterns[bucket] = (mem.timeOfDayPatterns[bucket] || 0) + 1;
    await this._save();
  },

  /** Record a session duration in seconds. */
  async recordSessionLength(seconds) {
    const mem = await this._load();
    mem.sessionLengths = [seconds, ...mem.sessionLengths].slice(0, MAX_SESSION_LENGTHS);
    await this._save();
  },

  /** Record a load, style, or heat dimension selection. */
  async recordDimensionSelection({ load, style, heat } = {}) {
    const mem = await this._load();
    if (load) {
      mem.preferredLoad = [load, ...mem.preferredLoad.filter(l => l !== load)].slice(0, MAX_DIM_HISTORY);
    }
    if (style) {
      mem.preferredStyle = [style, ...mem.preferredStyle.filter(s => s !== style)].slice(0, MAX_DIM_HISTORY);
    }
    if (heat) {
      mem.preferredHeat = [heat, ...mem.preferredHeat.filter(h => h !== heat)].slice(0, MAX_DIM_HISTORY);
    }
    await this._save();
  },

  /** @deprecated Use recordDimensionSelection instead. */
  async recordMoodSelection(mood) {
    // Legacy no-op kept so old call sites don't crash
  },

  /** Record a heat level selection. */
  async recordHeatSelection(level) {
    if (typeof level !== 'number') return;
    const mem = await this._load();
    mem.heatHistory = [level, ...mem.heatHistory].slice(0, 10);
    mem.preferredHeatLevel = median(mem.heatHistory);
    await this._save();
  },

  /** Record that a Surprise Me date was shown (avoid repeats). */
  async recordSurpriseShown(dateId) {
    if (!dateId) return;
    const mem = await this._load();
    mem.lastSurpriseIds = [dateId, ...mem.lastSurpriseIds.filter(id => id !== dateId)].slice(0, MAX_RECENT_IDS);
    await this._save();
  },

  /** Record the last screen the user visited (for soft continuity). */
  async recordScreenVisit(screenName) {
    if (!screenName) return;
    const mem = await this._load();
    mem.lastVisitedScreen = screenName;
    mem.lastVisitedAt = new Date().toISOString();
    await this._save();
  },

  /** Record the last prompt category and ID the user engaged with. */
  async recordPromptEngagement(category, promptId) {
    const mem = await this._load();
    if (category) mem.lastPromptCategory = category;
    if (promptId) mem.lastPromptId = promptId;
    await this._save();
  },

  /** Record a feature tap (for affinity tracking). */
  async recordFeatureUse(featureName) {
    if (!featureName) return;
    const mem = await this._load();
    mem.featureAffinities[featureName] = (mem.featureAffinities[featureName] || 0) + 1;
    await this._save();
  },

  // ─── Read helpers ──────────────────────────────────────────────

  /** Get the user's preferred load and style dimensions (most-used first). */
  async getPreferredDimensions(topN = 2) {
    const mem = await this._load();
    const countFreq = (arr) => {
      const counts = {};
      for (const v of arr) counts[v] = (counts[v] || 0) + 1;
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        .map(([val]) => val);
    };
    return {
      load: countFreq(mem.preferredLoad),
      style: countFreq(mem.preferredStyle),
      heat: countFreq(mem.preferredHeat),
    };
  },

  /** @deprecated Legacy alias — returns empty array. Use getPreferredDimensions. */
  async getPreferredMoods() {
    return [];
  },

  /** Get the user's comfort heat level (median). */
  async getPreferredHeatLevel() {
    const mem = await this._load();
    return mem.preferredHeatLevel;
  },

  /** Get the dominant time-of-day the user engages. */
  async getDominantTime() {
    const mem = await this._load();
    return getDominantTimeBucket(mem.timeOfDayPatterns);
  },

  /** Get current time bucket. */
  getCurrentTimeBucket() {
    return getTimeBucket();
  },

  /** Get IDs of recently shown Surprise Me dates. */
  async getRecentSurpriseIds() {
    const mem = await this._load();
    return mem.lastSurpriseIds;
  },

  /** Get average session length in seconds. */
  async getAverageSessionLength() {
    const mem = await this._load();
    if (!mem.sessionLengths.length) return null;
    const sum = mem.sessionLengths.reduce((a, b) => a + b, 0);
    return Math.round(sum / mem.sessionLengths.length);
  },

  /** Get soft-continuity state. */
  async getContinuityState() {
    const mem = await this._load();
    if (!mem.lastVisitedScreen || !mem.lastVisitedAt) return null;

    const elapsed = Date.now() - new Date(mem.lastVisitedAt).getTime();
    const hoursSince = elapsed / (1000 * 60 * 60);

    // Only suggest continuity within 48 hours
    if (hoursSince > 48) return null;

    return {
      screen: mem.lastVisitedScreen,
      visitedAt: mem.lastVisitedAt,
      hoursSince: Math.round(hoursSince * 10) / 10,
      lastPromptCategory: mem.lastPromptCategory,
      lastPromptId: mem.lastPromptId,
    };
  },

  /** Get the full memory snapshot (for debugging / analytics). */
  async getSnapshot() {
    return this._load();
  },

  /** Clear all memory (for sign-out / account delete). */
  async clear() {
    this._cache = null;
    await AsyncStorage.removeItem(MEMORY_KEY);
  },
};

export default ConnectionMemory;
