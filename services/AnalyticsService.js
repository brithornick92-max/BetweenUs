/**
 * AnalyticsService.js — Privacy-respecting analytics for Between Us
 *
 * Design principles (per brand guardrails):
 *   • No PII — only anonymous user IDs and event types
 *   • Local-first — events stored in AsyncStorage, batched to Supabase
 *   • No third-party SDKs — keeps the app lean and private
 *   • Opt-out capable — respects a user setting
 *   • Minimal — only tracks what informs product decisions
 *
 * Events tracked:
 *   • Screen views (which screens are visited, duration)
 *   • Feature usage (prompts, dates, journal, rituals, love notes)
 *   • Premium conversion points (which paywall triggers convert)
 *   • Content engagement (which heat levels, categories are popular)
 *   • Errors (non-PII crash breadcrumbs)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import SecureCacheStore from './security/SecureCacheStore';

const ANALYTICS_QUEUE_KEY = '@bu_analytics_queue';
const ANALYTICS_ENABLED_KEY = '@bu_analytics_enabled';
const ANALYTICS_QUEUE_SERVICE = 'betweenus_analytics';
const MAX_QUEUE_SIZE = 500;
const FLUSH_INTERVAL = 5 * 60 * 1000; // 5 minutes

// ─── Event Types ─────────────────────────────────────────────────────────────

export const AnalyticsEvent = Object.freeze({
  // Navigation
  SCREEN_VIEW: 'screen_view',
  SESSION_START: 'session_start',
  SESSION_END: 'session_end',

  // Content engagement
  PROMPT_VIEWED: 'prompt_viewed',
  PROMPT_ANSWERED: 'prompt_answered',
  PROMPT_SKIPPED: 'prompt_skipped',
  DATE_VIEWED: 'date_viewed',
  DATE_LIKED: 'date_liked',
  DATE_SKIPPED: 'date_skipped',
  JOURNAL_ENTRY_CREATED: 'journal_entry_created',
  LOVE_NOTE_SENT: 'love_note_sent',
  RITUAL_COMPLETED: 'ritual_completed',
  VIBE_SENT: 'vibe_sent',

  // Premium
  PAYWALL_SHOWN: 'paywall_shown',
  PAYWALL_DISMISSED: 'paywall_dismissed',
  PURCHASE_STARTED: 'purchase_started',
  PURCHASE_COMPLETED: 'purchase_completed',
  PURCHASE_FAILED: 'purchase_failed',

  // Premium features
  PREMIUM_FEATURE_USED: 'premium_feature_used',
  PREMIUM_FEATURE_GATED: 'premium_feature_gated',
  RESTORE_STARTED: 'restore_started',
  RESTORE_COMPLETED: 'restore_completed',
  RESTORE_FAILED: 'restore_failed',

  // Features
  FILTER_USED: 'filter_used',
  SURPRISE_ME_USED: 'surprise_me_used',
  EXPORT_STARTED: 'export_started',
  PARTNER_LINKED: 'partner_linked',
  SYNC_COMPLETED: 'sync_completed',

  // Errors
  ERROR_BOUNDARY: 'error_boundary',
  ENCRYPTION_FAILED: 'encryption_failed',
  SYNC_FAILED: 'sync_failed',

  // Funnel & milestone events
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  FIRST_PROMPT_ANSWERED: 'first_prompt_answered',
  PARTNER_INVITED: 'partner_invited',
  REFERRAL_SHARED: 'referral_shared',
  REFERRAL_APPLIED: 'referral_applied',
  STREAK_MILESTONE: 'streak_milestone',
});

// ─── Service ─────────────────────────────────────────────────────────────────

let _queue = [];
let _enabled = true;
let _userId = null;
let _flushTimer = null;
let _flushing = false;
let _supabase = null;

// Simple session ID (random per app launch)
const _sessionId = (() => {
  try {
    return require('expo-crypto').randomUUID();
  } catch {
    return Date.now().toString(36) + '_anon';
  }
})();

const AnalyticsService = {
  /**
   * Initialize analytics. Call once after auth resolves.
   * @param {Object} options
   * @param {string} options.userId - Anonymous user ID
   * @param {Object} [options.supabase] - Supabase client for remote flush
   */
  async init({ userId, supabase } = {}) {
    _userId = userId || null;
    _supabase = supabase || null;

    // Respect user opt-out
    try {
      const enabled = await AsyncStorage.getItem(ANALYTICS_ENABLED_KEY);
      _enabled = enabled !== 'false';
    } catch {
      _enabled = true;
    }

    // Load persisted queue
    _queue = await SecureCacheStore.getJson(ANALYTICS_QUEUE_KEY, [], {
      service: ANALYTICS_QUEUE_SERVICE,
    });

    // Start periodic flush
    this._startFlushTimer();
  },

  /**
   * Track an event.
   * @param {string} event - One of AnalyticsEvent values
   * @param {Object} [properties] - Event-specific properties (no PII!)
   */
  track(event, properties = {}) {
    if (!_enabled) return;

    const entry = {
      event,
      properties,
      userId: _userId,
      timestamp: new Date().toISOString(),
      sessionId: _sessionId,
    };

    _queue.push(entry);

    // Cap queue size
    if (_queue.length > MAX_QUEUE_SIZE) {
      _queue = _queue.slice(-MAX_QUEUE_SIZE);
    }

    // Persist to disk (fire-and-forget)
    SecureCacheStore.setJson(ANALYTICS_QUEUE_KEY, _queue, {
      service: ANALYTICS_QUEUE_SERVICE,
    }).catch(() => {});
  },

  /**
   * Track a screen view.
   */
  trackScreen(screenName) {
    this.track(AnalyticsEvent.SCREEN_VIEW, { screen: screenName });
  },

  /**
   * Track a paywall impression.
   */
  trackPaywall(feature, action = 'shown') {
    const event = action === 'dismissed' ? AnalyticsEvent.PAYWALL_DISMISSED : AnalyticsEvent.PAYWALL_SHOWN;
    this.track(event, { feature });
  },

  /**
   * Track a purchase funnel event.
   */
  trackPurchase(action, properties = {}) {
    const eventMap = {
      started: AnalyticsEvent.PURCHASE_STARTED,
      completed: AnalyticsEvent.PURCHASE_COMPLETED,
      failed: AnalyticsEvent.PURCHASE_FAILED,
      restore_started: AnalyticsEvent.RESTORE_STARTED,
      restore_completed: AnalyticsEvent.RESTORE_COMPLETED,
      restore_failed: AnalyticsEvent.RESTORE_FAILED,
    };
    const event = eventMap[action];
    if (event) this.track(event, properties);
  },

  /**
   * Track premium feature access (used or gated).
   */
  trackPremiumFeature(featureId, granted) {
    this.track(
      granted ? AnalyticsEvent.PREMIUM_FEATURE_USED : AnalyticsEvent.PREMIUM_FEATURE_GATED,
      { feature: featureId }
    );
  },

  /**
   * Track content engagement.
   */
  trackContent(type, properties = {}) {
    this.track(type, properties);
  },

  /**
   * Flush events to Supabase (if configured).
   */
  async flush() {
    if (!_supabase || _queue.length === 0 || _flushing) return;
    _flushing = true;

    const batch = _queue.splice(0, _queue.length);

    try {
      // Write to analytics_events table (create this via migration)
      const { error } = await _supabase
        .from('analytics_events')
        .insert(batch.map(e => ({
          user_id: e.userId,
          event: e.event,
          properties: e.properties,
          timestamp: e.timestamp,
          session_id: e.sessionId,
        })));

      if (error) {
        // Put events back if flush failed
        _queue = [...batch, ..._queue].slice(-MAX_QUEUE_SIZE);
      }

      // Clear persisted queue on success
      await SecureCacheStore.setJson(ANALYTICS_QUEUE_KEY, _queue, {
        service: ANALYTICS_QUEUE_SERVICE,
      });
    } catch {
      // Restore queue on network failure and persist to survive app kill
      _queue = [...batch, ..._queue].slice(-MAX_QUEUE_SIZE);
      await SecureCacheStore.setJson(ANALYTICS_QUEUE_KEY, _queue, {
        service: ANALYTICS_QUEUE_SERVICE,
      }).catch(() => {});
    } finally {
      _flushing = false;
    }
  },

  /**
   * Enable or disable analytics tracking.
   */
  async setEnabled(enabled) {
    _enabled = enabled;
    await AsyncStorage.setItem(ANALYTICS_ENABLED_KEY, String(enabled));
    if (!enabled) {
      await this.clearLocalCache();
    }
  },

  /** Check if analytics is enabled */
  get isEnabled() {
    return _enabled;
  },

  /** Set user ID (call after auth) */
  setUser(userId) {
    _userId = userId;
  },

  /** Get current queue size (for debugging) */
  get queueSize() {
    return _queue.length;
  },

  async clearLocalCache() {
    _queue = [];
    await SecureCacheStore.removeItem(ANALYTICS_QUEUE_KEY, {
      service: ANALYTICS_QUEUE_SERVICE,
    });
  },

  _startFlushTimer() {
    if (_flushTimer) clearInterval(_flushTimer);
    _flushTimer = setInterval(() => {
      this.flush().catch(() => {});
    }, FLUSH_INTERVAL);
  },

  /** Clean up (call on app unmount) */
  destroy() {
    if (_flushTimer) {
      clearInterval(_flushTimer);
      _flushTimer = null;
    }
  },
};

export default AnalyticsService;
