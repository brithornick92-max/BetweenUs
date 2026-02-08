// utils/abTestingFramework.js
// ──────────────────────────────────────────────────────────────────
// Stub A/B testing framework.  Replace with a real provider
// (e.g. Statsig, LaunchDarkly, Firebase Remote Config) when ready.
// Every method is safe to call and returns sensible defaults so that
// abTestManager.js (the only consumer) never crashes.
// ──────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';

const TESTS_KEY = 'ab_framework_tests';

class ABTestingFramework {
  /**
   * Assign a user to a variant for the given experiment.
   * Returns { variant: 'control' | 'treatment', experimentId } or null.
   */
  async assignUserToTest(userId, experimentId) {
    try {
      const existing = await AsyncStorage.getItem(`ab_${experimentId}_${userId}`);
      if (existing) return JSON.parse(existing);

      // Simple 50/50 split
      const variant = Math.random() < 0.5 ? 'control' : 'treatment';
      const assignment = { experimentId, variant, assignedAt: Date.now() };
      await AsyncStorage.setItem(`ab_${experimentId}_${userId}`, JSON.stringify(assignment));
      return assignment;
    } catch (error) {
      console.warn('abTestingFramework.assignUserToTest failed:', error.message);
      return null;
    }
  }

  /**
   * Return a map of currently active tests (experimentId → config).
   */
  getActiveTests() {
    // No active tests by default – register experiments via registerTest().
    return {};
  }

  /**
   * Track a conversion / event for an experiment.
   */
  async trackTestEvent(userId, experimentId, eventType, eventData = {}) {
    try {
      const key = `ab_events_${experimentId}`;
      const raw = await AsyncStorage.getItem(key);
      const events = raw ? JSON.parse(raw) : [];
      events.push({ userId, eventType, ...eventData, ts: Date.now() });
      await AsyncStorage.setItem(key, JSON.stringify(events));
    } catch (error) {
      console.warn('abTestingFramework.trackTestEvent failed:', error.message);
    }
  }

  /**
   * Analyse results for an experiment over the given number of days.
   * Returns a summary object (stub returns empty analysis).
   */
  async analyzeTestResults(experimentId, _days = 30) {
    return {
      experimentId,
      sampleSize: 0,
      controlConversions: 0,
      treatmentConversions: 0,
      significant: false,
      message: 'Stub framework – integrate a real provider for meaningful analysis.',
    };
  }

  /**
   * Export all test data for debugging / migration.
   */
  async exportTestData() {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const abKeys = allKeys.filter((k) => k.startsWith('ab_'));
      const pairs = await AsyncStorage.multiGet(abKeys);
      const data = {};
      for (const [key, val] of pairs) {
        data[key] = val ? JSON.parse(val) : null;
      }
      return data;
    } catch (error) {
      console.warn('abTestingFramework.exportTestData failed:', error.message);
      return {};
    }
  }

  /**
   * Remove data for expired / completed tests.
   */
  async cleanupExpiredTests() {
    // No-op in stub – a real provider manages TTL server-side.
    console.log('abTestingFramework.cleanupExpiredTests: no-op (stub)');
  }
}

export default new ABTestingFramework();
