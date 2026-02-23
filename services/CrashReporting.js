/**
 * CrashReporting.js — Lightweight Sentry wrapper for Between Us
 *
 * Centralizes crash reporting init and capture so the rest of the app
 * never references Sentry directly. Safe no-op if @sentry/react-native
 * isn't installed yet (graceful degradation).
 *
 * Install: npx expo install @sentry/react-native
 * Then set SENTRY_DSN in your env or app.json extra.
 */

let Sentry = null;
let _initialized = false;

try {
  Sentry = require('@sentry/react-native');
} catch {
  Sentry = null;
}

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || null;

const CrashReporting = {
  /**
   * Initialize Sentry. Call once in App.js before anything else.
   * Safe to call even if @sentry/react-native isn't installed.
   */
  init() {
    if (_initialized || !Sentry || !SENTRY_DSN) {
      if (__DEV__ && !Sentry) {
        console.log('[CrashReporting] @sentry/react-native not installed — skipping');
      }
      return;
    }

    try {
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: __DEV__ ? 'development' : 'production',
        enableAutoSessionTracking: true,
        sessionTrackingIntervalMillis: 30000,
        // Don't send in DEV unless explicitly opted in
        enabled: !__DEV__,
        // No PII — Between Us is a privacy-first app
        sendDefaultPii: false,
        // Performance — sample 20% of transactions in production
        tracesSampleRate: __DEV__ ? 1.0 : 0.2,
        // Session Replay (10% normal, 100% on error)
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1,
        // Structured logs
        enableLogs: true,
        // Integrations: replay + user feedback widget
        integrations: [
          Sentry.mobileReplayIntegration(),
          Sentry.feedbackIntegration(),
        ],
        // Strip PII from breadcrumbs
        beforeBreadcrumb(breadcrumb) {
          // Redact any URL that might contain tokens
          if (breadcrumb.data?.url) {
            breadcrumb.data.url = breadcrumb.data.url.replace(
              /access_token=[^&]+/g,
              'access_token=REDACTED'
            );
          }
          return breadcrumb;
        },
        // Scrub sensitive data from events
        beforeSend(event) {
          // Remove user email/IP for privacy
          if (event.user) {
            delete event.user.email;
            delete event.user.ip_address;
          }
          return event;
        },
      });
      _initialized = true;
    } catch (err) {
      // Sentry init failure should never crash the app
      console.warn('[CrashReporting] Sentry init failed:', err?.message);
    }
  },

  /**
   * Identify the current user (anonymous ID only — no PII).
   * Call after auth resolves.
   */
  setUser(userId) {
    if (!Sentry || !_initialized) return;
    try {
      Sentry.setUser(userId ? { id: userId } : null);
    } catch { /* ignore */ }
  },

  /**
   * Set a tag for filtering (e.g., premium status, couple status).
   */
  setTag(key, value) {
    if (!Sentry || !_initialized) return;
    try {
      Sentry.setTag(key, value);
    } catch { /* ignore */ }
  },

  /**
   * Capture a JavaScript exception.
   * Use for caught errors that should still be reported.
   */
  captureException(error, context) {
    if (!Sentry || !_initialized) {
      if (__DEV__) console.error('[CrashReporting]', error?.message, context);
      return;
    }
    try {
      Sentry.captureException(error, context ? { extra: context } : undefined);
    } catch { /* ignore */ }
  },

  /**
   * Capture a text message (info/warning level).
   */
  captureMessage(message, level = 'info') {
    if (!Sentry || !_initialized) return;
    try {
      Sentry.captureMessage(message, level);
    } catch { /* ignore */ }
  },

  /**
   * Add a breadcrumb for debugging context.
   */
  addBreadcrumb(category, message, data) {
    if (!Sentry || !_initialized) return;
    try {
      Sentry.addBreadcrumb({ category, message, data, level: 'info' });
    } catch { /* ignore */ }
  },

  /**
   * Wrap the root component with Sentry's error boundary if available.
   * Falls back to passing children through unchanged.
   */
  wrap(RootComponent) {
    if (!Sentry || !_initialized || !Sentry.wrap) return RootComponent;
    try {
      return Sentry.wrap(RootComponent);
    } catch {
      return RootComponent;
    }
  },

  /** Check if Sentry is available and initialized */
  get isAvailable() {
    return !!Sentry && _initialized;
  },
};

export default CrashReporting;
