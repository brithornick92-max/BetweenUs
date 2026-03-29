/**
 * ExperimentService.js — Lightweight A/B testing framework for Between Us
 *
 * Design:
 *   • Deterministic assignment via hash(userId + experimentId) — stable across sessions
 *   • Experiments defined locally with optional remote override via Supabase
 *   • Variant exposure tracked through AnalyticsService
 *   • No third-party SDK required
 *
 * Usage:
 *   const variant = ExperimentService.getVariant('paywall_copy_test');
 *   // Returns 'control' | 'variant_a' | 'variant_b' | ...
 *
 *   ExperimentService.trackExposure('paywall_copy_test');
 *   // Fires an analytics event so you can correlate with outcomes
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import AnalyticsService from './AnalyticsService';

const EXPERIMENTS_CACHE_KEY = '@bu_experiments_cache';
const ASSIGNMENTS_KEY = '@bu_experiment_assignments';
const REMOTE_FETCH_INTERVAL = 60 * 60 * 1000; // 1 hour

// ─── Local Experiment Definitions ─────────────────────────────────────────────
// Add experiments here. Remote config from Supabase can override these.

const LOCAL_EXPERIMENTS = {
  // Example: uncomment to run an experiment
  // paywall_copy_test: {
  //   id: 'paywall_copy_test',
  //   variants: ['control', 'emotional', 'value_focused'],
  //   weights: [0.34, 0.33, 0.33],
  //   enabled: true,
  // },
};

// ─── Internals ────────────────────────────────────────────────────────────────

let _userId = null;
let _supabase = null;
let _experiments = { ...LOCAL_EXPERIMENTS };
let _assignments = {};
let _lastRemoteFetch = 0;

/**
 * Simple deterministic hash for experiment assignment.
 * Maps userId + experimentId → number in [0, 1).
 */
function hashAssignment(userId, experimentId) {
  const str = `${userId}:${experimentId}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) / 2147483647; // Normalize to [0, 1)
}

function pickVariant(experiment, hashValue) {
  const { variants, weights } = experiment;
  if (!variants || variants.length === 0) return 'control';

  // If no weights, distribute evenly
  const w = weights && weights.length === variants.length
    ? weights
    : variants.map(() => 1 / variants.length);

  let cumulative = 0;
  for (let i = 0; i < variants.length; i++) {
    cumulative += w[i];
    if (hashValue < cumulative) return variants[i];
  }
  return variants[variants.length - 1];
}

// ─── Service ──────────────────────────────────────────────────────────────────

const ExperimentService = {
  /**
   * Initialize experiments. Call after auth resolves.
   */
  async init({ userId, supabase } = {}) {
    _userId = userId || null;
    _supabase = supabase || null;

    // Load cached assignments
    try {
      const stored = await AsyncStorage.getItem(ASSIGNMENTS_KEY);
      _assignments = stored ? JSON.parse(stored) : {};
    } catch {
      _assignments = {};
    }

    // Load cached remote experiments
    try {
      const cached = await AsyncStorage.getItem(EXPERIMENTS_CACHE_KEY);
      if (cached) {
        const { experiments, fetchedAt } = JSON.parse(cached);
        _experiments = { ...LOCAL_EXPERIMENTS, ...experiments };
        _lastRemoteFetch = fetchedAt || 0;
      }
    } catch {
      // Use local only
    }

    // Fetch remote experiments in background
    this._fetchRemoteExperiments().catch(() => {});
  },

  /**
   * Get the assigned variant for an experiment.
   * Returns 'control' if experiment doesn't exist or is disabled.
   */
  getVariant(experimentId) {
    // Return cached assignment if exists
    if (_assignments[experimentId]) {
      return _assignments[experimentId];
    }

    const experiment = _experiments[experimentId];
    if (!experiment || !experiment.enabled) return 'control';
    if (!_userId) return 'control';

    // Deterministic assignment
    const hash = hashAssignment(_userId, experimentId);
    const variant = pickVariant(experiment, hash);

    // Cache assignment
    _assignments[experimentId] = variant;
    AsyncStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(_assignments)).catch(() => {});

    return variant;
  },

  /**
   * Track that a user was exposed to an experiment variant.
   * Call this when the variant actually affects UX (not just on assignment).
   */
  trackExposure(experimentId) {
    const variant = this.getVariant(experimentId);
    AnalyticsService.track('experiment_exposure', {
      experiment: experimentId,
      variant,
    });
  },

  /**
   * Track a conversion event tied to an experiment.
   */
  trackConversion(experimentId, conversionEvent, properties = {}) {
    const variant = this.getVariant(experimentId);
    AnalyticsService.track('experiment_conversion', {
      experiment: experimentId,
      variant,
      conversion_event: conversionEvent,
      ...properties,
    });
  },

  /**
   * Get all active experiments and their assignments for the current user.
   */
  getActiveExperiments() {
    const active = {};
    for (const [id, exp] of Object.entries(_experiments)) {
      if (exp.enabled) {
        active[id] = {
          ...exp,
          assignedVariant: this.getVariant(id),
        };
      }
    }
    return active;
  },

  /**
   * Force a variant for testing (dev only).
   */
  async overrideVariant(experimentId, variant) {
    _assignments[experimentId] = variant;
    await AsyncStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(_assignments));
  },

  /**
   * Reset all experiment assignments (forces re-bucketing).
   */
  async resetAssignments() {
    _assignments = {};
    await AsyncStorage.removeItem(ASSIGNMENTS_KEY);
  },

  /** Set user ID (call after auth) */
  setUser(userId) {
    _userId = userId;
  },

  // ─── Remote Config ────────────────────────────────────────────────────────

  async _fetchRemoteExperiments() {
    if (!_supabase) return;
    if (Date.now() - _lastRemoteFetch < REMOTE_FETCH_INTERVAL) return;

    try {
      const { data, error } = await _supabase
        .from('experiments')
        .select('id, variants, weights, enabled')
        .eq('enabled', true);

      if (error) {
        if (__DEV__) console.warn('[Experiments] Failed to fetch remote experiments:', error.message);
        return;
      }

      if (data && Array.isArray(data)) {
        const remote = {};
        for (const exp of data) {
          remote[exp.id] = {
            id: exp.id,
            variants: exp.variants || ['control', 'treatment'],
            weights: exp.weights || null,
            enabled: true,
          };
        }

        _experiments = { ...LOCAL_EXPERIMENTS, ...remote };
        _lastRemoteFetch = Date.now();

        await AsyncStorage.setItem(EXPERIMENTS_CACHE_KEY, JSON.stringify({
          experiments: remote,
          fetchedAt: _lastRemoteFetch,
        }));
      }
    } catch (err) {
      if (__DEV__) console.warn('[Experiments] Remote fetch exception:', err.message);
    }
  },
};

export default ExperimentService;
