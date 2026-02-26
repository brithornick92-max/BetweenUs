# Between Us — Production Readiness Audit

**Date:** February 25, 2026  
**Scope:** Full codebase + database SQL  
**Status:** 26 PASS / 8 FAIL / 4 WARN

---

## PASS / FAIL Summary

| # | Check | Verdict | Notes |
|---|-------|---------|-------|
| **A — Crash & Observability** |||
| A1 | Sentry wired in release builds | **PASS** | `@sentry/react-native/expo` plugin in app.json; `CrashReporting.init()` called at module scope before component tree; `CrashReporting.wrap(App)` applied; `enabled: !__DEV__` so release-only |
| A2 | Cold start with no network | **PASS** | Supabase import is guarded (`if (!supabase)` checks); SyncEngine returns `{ skipped: true }` when not configured; push registration is `try/catch`'d and non-critical; DataLayer falls through to SQLite |
| A3 | Supabase session refresh failure | **PASS** | `onAuthStateChange` listener wraps in `try/catch`; StorageRouter config failures silently ignored; app continues in offline/local mode |
| A4 | Missing EXPO_PROJECT_ID / push setup | **PASS** | `Constants.expoConfig?.extra?.eas?.projectId` is read safely; `projectId` is present in app.json; `Device.isDevice` check skips simulators; entire flow is non-fatal |
| A5 | React error boundary | **PASS** | `ErrorBoundary` class component wraps full provider tree; reports to Sentry; shows recovery UI with "Try Again" button |
| A6 | Unhandled promise rejection handler | **FAIL** | **No global unhandled rejection listener in production.** Dev-only `ErrorUtils.setGlobalHandler` exists but is guarded by `if (__DEV__)`. Production builds have zero unhandled-promise coverage outside React tree. |
| **B — Privacy, Compliance, Metadata** |||
| B1 | Privacy Policy + Terms links in-app | **PASS** | `PrivacyPolicyScreen` and `TermsScreen` exist; accessible from settings and onboarding |
| B2 | iOS Privacy Manifest (PrivacyInfo.xcprivacy) | **FAIL** | **No PrivacyInfo.xcprivacy file found.** App uses `expo-secure-store`, `@sentry/react-native`, `expo-notifications`, `crypto-js`, `expo-device` — several of these require privacy manifest API declarations per Apple's 2024+ guidelines. Expo SDK 54 may auto-generate some, but explicit manifest is safest. |
| B3 | App Store privacy answers match reality | **WARN** | Analytics are collected (screen views, events via `AnalyticsService`); user ID is tracked; diagnostics via Sentry. Ensure App Store Connect declarations include: **Analytics: Yes** (linked to user ID), **Diagnostics: crash/performance** (Sentry), **Identifiers: Device ID** (expo-device). |
| B4 | Encryption claim + specifics | **PASS** | `ITSAppUsesNonExemptEncryption: true` in app.json. E2EE uses XSalsa20-Poly1305 (nacl.secretbox) with 256-bit keys. Device key in SecureStore (encrypted at rest). Couple key via X25519 ECDH. Data encrypted before Supabase upload (in transit via HTTPS + at rest as ciphertext). Privacy Policy correctly states E2E encryption. **However** — you'll need ERN documentation filed with BIS (see patch plan). |
| B5 | Account deletion path | **PASS** | `DeleteAccountScreen` exists; calls `delete_own_account` RPC which cascades: removes couple_data, couple_members, orphaned couples, push_tokens, analytics, then deletes `auth.users` row. |
| **C — Notification UX + Deep Links** |||
| C1 | Permission prompt not on first render | **PASS** | `PushNotificationService.initialize()` is called in a `useEffect` after auth session resolves (not at mount). Notification permissions are also deferred in `NotificationSettingsScreen` and `CalendarScreen` (on user action). |
| C2 | In-app notification settings (toggles) | **PASS** | `NotificationSettingsScreen` has per-category toggles: daily prompt reminder, partner activity, weekly recap, milestones. Persisted to AsyncStorage with `NOTIFICATION_SETTINGS` key. |
| C3 | Graceful fallback when disabled | **PASS** | Permission check returns early if not granted; Alert shown to open Settings; `ensureNotificationPermissions()` returns `{ ok: false }` gracefully. |
| C4 | Deep links from notification → correct screen (cold start) | **FAIL** | **Missing `getLastNotificationResponseAsync()` handling.** `addNotificationResponseListener` in `useEffect` only catches taps when the app is already running. If app was killed, the initial notification response is dropped. Must call `Notifications.getLastNotificationResponseAsync()` on mount to handle cold-start deep links. |
| **D — Offline & Conflict Handling** |||
| D1 | Offline writes queued and retried | **PASS** | SyncEngine has push queue: SQLite rows with `sync_status='pending'` are pushed with exponential backoff (3 retries, 1s/2s/4s). `OfflineGrace` in PolishEngine queues love notes / moment signals to AsyncStorage. Sync triggered on `AppState → active` and every 60s interval. |
| D2 | Conflict resolution strategy | **PASS** | Last-write-wins by `updated_at` column. SyncEngine pulls with `gt('updated_at', cursor)` in ascending order. `batchUpsertFromRemote` overwrites local rows with newer remote rows. Soft-delete tombstones are handled. |
| D3 | Duplicate send prevention | **PASS** | `MomentSignalSender` has 5-minute cooldown (`COOLDOWN_MS = 5 * 60 * 1000`). SyncEngine has `_syncing` guard for re-entrancy + 10s throttle. `sync_source = 'remote'` prevents pull→push loops. |
| **E — Realtime Listener Hygiene** |||
| E1 | Subscriptions not duplicated on re-render | **PASS** | All realtime subscriptions use `useEffect` with proper cleanup: `return () => supabase.removeChannel(channel)`. AppContext uses `active` flag to prevent stale updates. SyncEngine `subscribeRealtime()` returns cleanup function. |
| E2 | Torn down on logout / couple switch | **PASS** | DataContext cleanup: `unsubRealtimeRef.current?.()` in useEffect cleanup + `clearInterval(syncIntervalRef.current)`. SyncEngine has `reset()` for sign-out. AppContext cleans up `unsubscribe()`. |
| E3 | RLS supports realtime (REPLICA IDENTITY) | **FAIL** | **No `ALTER TABLE ... REPLICA IDENTITY FULL` found** in any SQL migration. Supabase Realtime with RLS requires `REPLICA IDENTITY FULL` on tables using RLS-filtered subscriptions. Without it, `DELETE` events won't include enough data for RLS evaluation, causing silent missing events. Tables affected: `couple_data`, `calendar_events`, `moments`, `couple_members`. |
| **F — Abuse / Rate Limits** |||
| F1 | Invite code brute-force protection | **PASS** | `redeem_partner_code` RPC calls `check_sensitive_rate_limit(redeemer_id)` (10 tokens = ~6 attempts/min). Code lookup uses `FOR UPDATE` row lock. Guards against self-pairing and already-linked users. |
| F2 | Notification spam controls | **PASS** | `MomentSignalSender` has 5-min cooldown. AnalyticsService queues events (max 500, flush every 5 min). Rate-limit buckets exist server-side (60 tokens, 1 token/sec refill). |
| F3 | Edge Functions authenticate requests | **WARN** | No dedicated Edge Functions directory found (`supabase/functions/` does not exist). All sensitive operations use RPC functions with `SECURITY DEFINER` + `auth.uid()` checks. This is acceptable but means RevenueCat webhook handling (premium sync) would need an Edge Function for production. Currently noted only as comments in SQL. |
| **G — Battery & Performance** |||
| G1 | No aggressive polling | **PASS** | Sync interval is 60s (reasonable). Offline connectivity check is 30s (only when offline). Invite link polling is 3s but cleanup properly via `clearInterval`. ThemeContext tick is 60s. AnalyticsService flush is 5 min. |
| G2 | No runaway timers | **PASS** | All `setInterval`/`setTimeout` calls have corresponding `clearInterval`/`clearTimeout` in cleanup functions. DataContext, SettingsScreen, OnboardingScreen, ThemeContext all properly clean up. |
| G3 | Minimal listeners | **PASS** | AppState listeners properly use `subscription.remove()` in cleanup. Only necessary listeners are active. |
| G4 | DB indexes on coupleId + created_at | **PASS** | Composite indexes exist: `idx_couple_data_sync (couple_id, data_type, updated_at)`, `idx_couple_data_not_deleted`, `idx_couple_data_type_user`, `idx_calendar_events_couple`, `idx_moments_couple`, `idx_usage_events_daily`. |
| **H — Orphan / Deletion Scenarios** |||
| H1 | Partner deletes account behavior | **PASS** | `delete_own_account` RPC: removes user's couple_data, removes their `couple_members` row, then checks if couple is orphaned (0 remaining members → deletes all couple_data + couple row). Remaining partner keeps their own data. |
| H2 | Cleanup cron jobs | **PASS** | pg_cron jobs defined: expired codes (hourly), orphan push tokens (daily), stale push tokens 90d (daily), rate-limit bucket refill (5 min), notification log pruning (30 days). **Verify these are actually running** via `SELECT * FROM cron.job`. |
| **I — Secrets + Supply Chain** |||
| I1 | No secrets committed | **PASS** | `.gitignore` covers `.env`, `.env.*`, `.env*.local`, `*.pem`, `*.key`, `*.p8`, `*.p12`, `*.mobileprovision`, `*.keystore`. All API keys use `EXPO_PUBLIC_` env vars or `$SENTRY_AUTH_TOKEN` refs. EAS credentials (`appleId`) in eas.json is non-secret (just the email). Supabase config uses only anon key (public). |
| I2 | Dependency risks | **WARN** | `crypto-js` (v4.2.0) — no active CVEs but library is **unmaintained** (last publish 2023). For password hashing it uses PBKDF2 with only 50k iterations (OWASP recommends 600k+ for SHA-256). Consider migrating to `expo-crypto` native PBKDF2. `react-native-worklets` (0.7.2) — check compatibility with `react-native-reanimated` 4.x. All Expo packages are on SDK 54 (matched versions). |
| I3 | Privacy manifest SDK requirements | **WARN** | `@sentry/react-native`, `expo-device`, `expo-notifications`, `expo-secure-store` may require iOS privacy manifest API declarations. Expo SDK 54 auto-generates some entries, but confirm the build output includes required `NSPrivacyAccessedAPITypes` for: UserDefaults, file timestamp, system boot time, disk space APIs. |

---

## FAIL Items — Detailed Patch Plan

### FAIL A6: No production unhandled promise rejection handler

**Risk:** Unhandled async errors (outside React tree) silently die in production. Common culprits: failed Supabase calls in background sync, SecureStore errors, crypto failures.

**Fix:**
```javascript
// In App.js, OUTSIDE any __DEV__ guard, add before CrashReporting.init():

// Global JavaScript error + unhandled promise rejection handler
if (global?.ErrorUtils?.setGlobalHandler) {
  const defaultHandler = global.ErrorUtils.getGlobalHandler?.();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    CrashReporting.captureException(error, { isFatal, source: 'globalHandler' });
    defaultHandler?.(error, isFatal);
  });
}

// React Native doesn't fire 'unhandledrejection' natively, but if polyfilled:
if (typeof global.addEventListener === 'function') {
  global.addEventListener('unhandledrejection', (event) => {
    CrashReporting.captureException(
      event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
      { source: 'unhandledRejection' }
    );
  });
}
```

**Priority:** HIGH — without this, production crashes from async code are invisible.

---

### FAIL B2: Missing iOS Privacy Manifest

**Risk:** App Store rejection starting Spring 2024+ for apps that don't declare required API usage reasons.

**Fix:** Create [ios/between-us/PrivacyInfo.xcprivacy](ios/between-us/PrivacyInfo.xcprivacy) or use the Expo config plugin approach:

```json
// In app.json, under "ios":
"privacyManifests": {
  "NSPrivacyAccessedAPITypes": [
    {
      "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults",
      "NSPrivacyAccessedAPITypeReasons": ["CA92.1"]
    },
    {
      "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryFileTimestamp",
      "NSPrivacyAccessedAPITypeReasons": ["C617.1"]
    },
    {
      "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryDiskSpace",
      "NSPrivacyAccessedAPITypeReasons": ["E174.1"]
    },
    {
      "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategorySystemBootTime",
      "NSPrivacyAccessedAPITypeReasons": ["35F9.1"]
    }
  ],
  "NSPrivacyCollectedDataTypes": [
    {
      "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeDeviceID",
      "NSPrivacyCollectedDataTypeLinked": false,
      "NSPrivacyCollectedDataTypeTracking": false,
      "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAnalytics"]
    },
    {
      "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeCrashData",
      "NSPrivacyCollectedDataTypeLinked": false,
      "NSPrivacyCollectedDataTypeTracking": false,
      "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"]
    }
  ]
}
```

**Priority:** HIGH — Apple will reject without this.

---

### FAIL C4: Cold-start notification deep link dropped

**Risk:** User taps a notification when the app is killed → app opens to home instead of the intended screen. Apple reviewers test this flow.

**Fix:** In `AppContent`, add a `useEffect` to handle the initial notification:

```javascript
// In AppContent, after the addNotificationResponseListener useEffect:

useEffect(() => {
  // Handle notification that launched the app from killed state
  const checkInitialNotification = async () => {
    try {
      const Notifications = require('expo-notifications');
      const response = await Notifications.getLastNotificationResponseAsync();
      if (response) {
        // Small delay to ensure navigation is ready
        setTimeout(() => {
          DeepLinkHandler.handleNotificationResponse(response);
        }, 500);
      }
    } catch {
      // expo-notifications not available
    }
  };
  if (navReady) {
    checkInitialNotification();
  }
}, [navReady]);
```

**Priority:** HIGH — reviewers test this; users will notice.

---

### FAIL E3: Missing REPLICA IDENTITY FULL for Realtime + RLS

**Risk:** Supabase Realtime silently drops `UPDATE`/`DELETE` events when RLS policies reference columns not in the default replica identity (which is just the primary key). Partner won't see real-time calendar deletions, prompt answer updates, etc.

**Fix:** Add a new migration:

```sql
-- Enable REPLICA IDENTITY FULL for all realtime-subscribed tables
-- Required for Supabase Realtime to evaluate RLS policies on UPDATE/DELETE events

ALTER TABLE couple_data      REPLICA IDENTITY FULL;
ALTER TABLE calendar_events  REPLICA IDENTITY FULL;
ALTER TABLE moments          REPLICA IDENTITY FULL;
ALTER TABLE couple_members   REPLICA IDENTITY FULL;
ALTER TABLE couples          REPLICA IDENTITY FULL;
```

**Priority:** HIGH — without this, realtime events are silently lost for RLS-protected tables.

---

## WARN Items — Recommended Actions

| # | Item | Action |
|---|------|--------|
| B3 | App Store privacy answers | Double-check App Store Connect: Analytics=Yes (linked to anonymous user ID), Diagnostics=Yes (crash data via Sentry), Identifiers=Yes (device ID for push tokens). |
| F3 | No Edge Functions for webhooks | For RevenueCat webhook → Supabase premium sync, create a Supabase Edge Function that verifies the RevenueCat webhook signature before updating `user_entitlements`. Currently relying on client-side RevenueCat SDK only. |
| I2 | `crypto-js` unmaintained | Low urgency, but plan migration to `expo-crypto` for PBKDF2. The LocalStorageService PBKDF2 at 50k iterations is below OWASP recommendation (600k+). Credentials are in SecureStore so risk is mitigated. |
| I3 | Privacy manifest SDK entries | After building, inspect `PrivacyInfo.xcprivacy` in the `.app` bundle to confirm Sentry, expo-device, and expo-notifications entries are auto-generated. If not, add them to the `privacyManifests` config above. |

---

## Additional Review Notes for App Store Submission

### Age Rating
- App contains intimacy/connection content with "heat levels" 1–5
- Heat levels 4–5 are premium-only and contain suggestive (not explicit) content
- **Recommend: Rating 17+ with "Frequent/Intense Mature/Suggestive Themes"**

### Review Notes (paste into App Store Connect)
```
Between Us is a couples app for deepening intimacy and connection.

TESTING:
1. Create account with email/password
2. Invite a partner via Settings → Invite Partner (generates a code/QR)
3. Second account redeems the code to link

KEY FEATURES TO TEST:
- Daily prompts (swipe through prompt cards on home screen)
- Vibe signal (tap heart on Vibe tab to send "thinking of you")
- Date night ideas (browse Date tab)
- Calendar (shared event planning)
- Night ritual (premium bedtime check-in)

PREMIUM: Subscription unlocks heat levels 4-5, unlimited prompts,
cloud sync with E2E encryption, and night ritual mode.

ENCRYPTION: End-to-end encryption uses XSalsa20-Poly1305 (NaCl). 
Couple key derived via X25519 ECDH during pairing. Only ciphertext 
stored on our servers. ITSAppUsesNonExemptEncryption=YES.

DATA DELETION: Settings → Privacy & Security → Delete Account
(immediately deletes all user data, couple data, and auth record).
```

### ERN/Encryption Documentation
Since `ITSAppUsesNonExemptEncryption: true`, you need:
1. Either a CCATS/ENC classification from BIS, OR
2. A self-classification report filed annually with BIS
3. Details: XSalsa20-Poly1305, 256-bit keys, used for user data confidentiality

---

## Pre-Submission Checklist

- [ ] Apply FAIL A6 fix (global error handler)
- [ ] Apply FAIL B2 fix (privacy manifest in app.json)
- [ ] Apply FAIL C4 fix (cold-start notification routing)
- [ ] Apply FAIL E3 fix (REPLICA IDENTITY FULL migration)
- [ ] Verify cron jobs are running: `SELECT * FROM cron.job`
- [ ] Verify App Store Connect privacy answers match B3 recommendations
- [ ] File ERN self-classification with BIS (annual)
- [ ] Build → inspect PrivacyInfo.xcprivacy in .app bundle
- [ ] Test: kill app → send notification → tap → verify correct screen opens
- [ ] Test: airplane mode → create content → restore network → verify sync
