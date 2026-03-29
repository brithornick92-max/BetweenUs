# Between Us — Production Readiness Audit

**Date:** February 25, 2026 (updated March 22, 2026)  
**Scope:** iOS App Store submission, full codebase + database SQL review  
**Status:** Repo green for iOS submission; remaining items are external App Store / production-environment follow-ups

## March 22, 2026 Addendum

- Release scope confirmed as **iOS App Store only**. Android signing is therefore **out of scope** for this submission and should not be treated as an iOS blocker.
- Repo-side fixes completed since the March 20 audit:
   - Premium cloud-sync gating no longer enables sync implicitly before entitlements resolve.
   - Attachment sync now pulls remote attachment metadata instead of being upload-only.
   - RevenueCat selects the correct platform API key at runtime.
   - Startup no longer triggers the push notification permission prompt automatically; permission is requested from explicit user action in notification settings.
   - Deep-link parsing for custom scheme URLs was fixed for paths like `betweenus://love-note/:id`.
   - Push token persistence and partner notification RPC calls now surface Supabase write failures instead of silently succeeding.
   - Jest coverage was repaired for SecureStore-backed auth/session storage and expanded for deep-link and push flows.
- Validation after these fixes:
   - `npm test -- --runInBand` → **13/13 suites passing, 183 tests passing**
   - `node scripts/validateDeployment.cjs` with required env vars present → **passes**
- Remaining risk is now concentrated in manual release/compliance steps and live-environment verification, not in known repo-side blockers.

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
| A6 | Unhandled promise rejection handler | **PASS** | `global.ErrorUtils.setGlobalHandler` installed at module scope in App.js (outside `__DEV__` guard). Reports to Sentry via `CrashReporting.captureException` with `isFatal` + `source: 'globalHandler'` tags. Dev builds still show the red box. |
| **B — Privacy, Compliance, Metadata** |||
| B1 | Privacy Policy + Terms links in-app | **PASS** | `PrivacyPolicyScreen` and `TermsScreen` exist; accessible from settings and onboarding |
| B2 | iOS Privacy Manifest (PrivacyInfo.xcprivacy) | **PASS** | `privacyManifests` declared in app.json under `ios`. Covers 4 API types (UserDefaults CA92.1, FileTimestamp C617.1, DiskSpace E174.1, SystemBootTime 35F9.1) and 2 collected data types (DeviceID for analytics, marked linked because analytics events are attached to signed-in user IDs; CrashData for app functionality). |
| B3 | App Store privacy answers match reality | **WARN** | Repo metadata now reflects linked analytics identifiers, but App Store Connect still needs to match reality. Declare: **Analytics: Yes** (linked to user ID), **Diagnostics: crash/performance** (Sentry), **Identifiers: Device ID** (linked, not used for tracking). |
| B4 | Encryption claim + specifics | **PASS** | `ITSAppUsesNonExemptEncryption: false` in app.json to match the exempt export-compliance path currently indicated by App Store Connect. The app still uses E2EE with XSalsa20-Poly1305 (nacl.secretbox), 256-bit keys, SecureStore-backed device keys, and X25519 ECDH for couple key exchange. Data is encrypted before Supabase upload and stored remotely as ciphertext. |
| B5 | Account deletion path | **PASS** | `DeleteAccountScreen` exists; calls `delete_own_account` RPC which cascades: removes couple_data, couple_members, orphaned couples, push_tokens, analytics, then deletes `auth.users` row. |
| **C — Notification UX + Deep Links** |||
| C1 | Permission prompt not on first render | **PASS** | Startup push registration is now silent-only and exits if permission has not already been granted. Notification permissions are requested from explicit user actions in `NotificationSettingsScreen` and `CalendarScreen`. |
| C2 | In-app notification settings (toggles) | **PASS** | `NotificationSettingsScreen` has per-category toggles: daily prompt reminder, partner activity, weekly recap, milestones. Persisted to AsyncStorage with `NOTIFICATION_SETTINGS` key. |
| C3 | Graceful fallback when disabled | **PASS** | Permission check returns early if not granted; Alert shown to open Settings; `ensureNotificationPermissions()` returns `{ ok: false }` gracefully. |
| C4 | Deep links from notification → correct screen (cold start) | **PASS** | `getLastNotificationResponseAsync()` called in AppContent `useEffect` gated on `navReady`. 500ms delay ensures navigation stack is mounted. Guard flag prevents double-processing. Covers killed-app scenario. |
| **D — Offline & Conflict Handling** |||
| D1 | Offline writes queued and retried | **PASS** | SyncEngine has push queue: SQLite rows with `sync_status='pending'` are pushed with exponential backoff (3 retries, 1s/2s/4s). `OfflineGrace` in PolishEngine queues love notes / moment signals to AsyncStorage. Sync triggered on `AppState → active` and every 60s interval. |
| D2 | Conflict resolution strategy | **PASS** | Last-write-wins by `updated_at` column. SyncEngine pulls with `gt('updated_at', cursor)` in ascending order. `batchUpsertFromRemote` overwrites local rows with newer remote rows. Soft-delete tombstones are handled. |
| D3 | Duplicate send prevention | **PASS** | `MomentSignalSender` has 5-minute cooldown (`COOLDOWN_MS = 5 * 60 * 1000`). SyncEngine has `_syncing` guard for re-entrancy + 10s throttle. `sync_source = 'remote'` prevents pull→push loops. |
| **E — Realtime Listener Hygiene** |||
| E1 | Subscriptions not duplicated on re-render | **PASS** | All realtime subscriptions use `useEffect` with proper cleanup: `return () => supabase.removeChannel(channel)`. AppContext uses `active` flag to prevent stale updates. SyncEngine `subscribeRealtime()` returns cleanup function. |
| E2 | Torn down on logout / couple switch | **PASS** | DataContext cleanup: `unsubRealtimeRef.current?.()` in useEffect cleanup + `clearInterval(syncIntervalRef.current)`. SyncEngine has `reset()` for sign-out. AppContext cleans up `unsubscribe()`. |
| E3 | RLS supports realtime (REPLICA IDENTITY) | **PASS** | `REPLICA IDENTITY FULL` applied to all realtime-subscribed tables (`couple_data`, `calendar_events`, `moments`, `couple_members`, `couples`) in `supabase-realtime-replica-identity.sql`. Ensures UPDATE/DELETE events include full row data for RLS evaluation. |
| **F — Abuse / Rate Limits** |||
| F1 | Invite code brute-force protection | **PASS** | `redeem_partner_code` RPC calls `check_sensitive_rate_limit(redeemer_id)` (10 tokens = ~6 attempts/min). Code lookup uses `FOR UPDATE` row lock. Guards against self-pairing and already-linked users. |
| F2 | Notification spam controls | **PASS** | `MomentSignalSender` has 5-min cooldown. AnalyticsService queues events (max 500, flush every 5 min). Rate-limit buckets exist server-side (60 tokens, 1 token/sec refill). |
| F3 | Edge Functions authenticate requests | **PASS** | RevenueCat webhook Edge Function created at `supabase/functions/revenuecathook/index.ts`. Verifies bearer token, updates `user_entitlements` via service_role, propagates couple premium. All RPC functions also use `SECURITY DEFINER` + `auth.uid()` checks. Deploy with: `supabase functions deploy revenuecathook --no-verify-jwt`. |
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
| I2 | Dependency risks | **PASS** | `crypto-js` replaced with `@noble/hashes` (audited, maintained) for PBKDF2 and `expo-crypto` for SHA-256 / random bytes. Password hash comparison bug (operator precedence) fixed. `react-native-worklets` (0.7.2) — check compatibility with `react-native-reanimated` 4.x. All Expo packages are on SDK 54 (matched versions). |
| I3 | Privacy manifest SDK requirements | **PASS** | `PrivacyInfo.xcprivacy` updated to include `NSPrivacyCollectedDataTypes` (DeviceID for analytics, CrashData for app functionality). API types cover UserDefaults, FileTimestamp, DiskSpace, SystemBootTime. CocoaPods deps auto-add additional reasons during build. Confirmed matching `app.json` `privacyManifests` declarations. |

---

## Previously-FAIL Items — Now Resolved

All four FAIL items from the original audit have been fixed. Details below for reference.

### ~~FAIL~~ A6: Global error handler — **RESOLVED**
**Fix applied:** `global.ErrorUtils.setGlobalHandler` installed at module scope in App.js (outside `__DEV__` guard). Reports to Sentry with `isFatal` + `source: 'globalHandler'` context. Dev builds preserve red box via `defaultHandler` passthrough.

### ~~FAIL~~ B2: iOS Privacy Manifest — **RESOLVED**
**Fix applied:** `privacyManifests` added to `ios` section of app.json. Declares 4 API types (UserDefaults, FileTimestamp, DiskSpace, SystemBootTime) and 2 collected data types (DeviceID, CrashData).

### ~~FAIL~~ C4: Cold-start notification deep link — **RESOLVED**
**Fix applied:** `getLastNotificationResponseAsync()` called in AppContent `useEffect` gated on `navReady`. 500ms delay ensures navigation stack is mounted. Guard flag prevents double-processing.

### ~~FAIL~~ E3: REPLICA IDENTITY FULL — **RESOLVED**
**Fix applied:** Migration in `database/supabase-realtime-replica-identity.sql` sets `REPLICA IDENTITY FULL` on all 5 realtime-subscribed tables (`couple_data`, `calendar_events`, `moments`, `couple_members`, `couples`). **Ensure this migration has been run against the production Supabase instance.**

---

## WARN Items — Recommended Actions

| # | Item | Action |
|---|------|--------|
| B3 | App Store privacy answers | In App Store Connect → App Privacy: **Analytics: Yes** (linked to signed-in user ID via AnalyticsService), **Diagnostics: Yes** (crash data + performance via Sentry), **Identifiers: Yes** (device ID, linked, not used for tracking). See detailed answers below. |

### B3 — App Store Connect Privacy Answers (step-by-step)

In **App Store Connect → Your App → App Privacy**, answer:

1. **Do you or your third-party partners collect data?** → **Yes**
2. **Data types collected:**
   - **Identifiers → Device ID** — Collected for analytics/service operations. **Linked** to the account because analytics events are associated with signed-in user IDs. **Not used for tracking.**
   - **Diagnostics → Crash Data** — Sentry collects anonymous crash reports. `sendDefaultPii: false`, email/IP stripped in `beforeSend`. **Not linked** to identity.
   - **Diagnostics → Performance Data** — Sentry tracing (10% session sample). **Not linked.**
   - **Usage Data → Product Interaction** — Screen views and feature engagement via AnalyticsService. **Linked to user** because events are attached to the signed-in user ID. **Not used for tracking.**
3. **Do you or your third-party partners use data for tracking?** → **No**
4. **Contact Info / Email** → Collected for authentication only → **Linked to identity** → Purpose: **App Functionality**

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
stored on our servers. App Store Connect currently classifies this on the exempt path, so the shipped plist should use ITSAppUsesNonExemptEncryption=NO.

DATA DELETION: Settings → Privacy & Security → Delete Account
(immediately deletes all user data, couple data, and auth record).
```

### ERN/Encryption Documentation
App Store Connect currently classifies this app on the exempt documentation path. Keep the questionnaire answers and shipped plist aligned with `ITSAppUsesNonExemptEncryption: false`.

Keep these details handy in case Apple requests clarification:
1. XSalsa20-Poly1305 for end-to-end encrypted content
2. X25519 ECDH for couple key exchange
3. 256-bit key material used for user data confidentiality

---

## Pre-Submission Checklist

- [x] Apply FAIL A6 fix (global error handler)
- [x] Apply FAIL B2 fix (privacy manifest in app.json)
- [x] Apply FAIL C4 fix (cold-start notification routing)
- [x] Apply FAIL E3 fix (REPLICA IDENTITY FULL migration)
- [x] Fix premium cloud-sync gating and attachment sync completeness
- [x] Fix RevenueCat platform key selection
- [x] Defer push permission prompt to explicit user action
- [x] Repair Jest coverage for SecureStore-backed auth/session path
- [x] Run full automated validation (`13/13` test suites passing; deployment validator passing)
- [ ] Verify cron jobs are running: `SELECT * FROM cron.job`
- [ ] Verify App Store Connect privacy answers match B3 recommendations
- [ ] File ERN self-classification with BIS (annual)
- [ ] Build → inspect PrivacyInfo.xcprivacy in .app bundle
- [ ] Test: kill app → send notification → tap → verify correct screen opens
- [ ] Test: airplane mode → create content → restore network → verify sync

## Final iOS Release Assessment

For **App Store submission only**, there are no known repo-side blockers remaining from this audit. The remaining work is:

1. App Store Connect privacy declarations
2. ERN / encryption filing
3. Production Supabase verification (cron jobs / migrations / RPC availability)
4. Real-device notification and offline-sync verification on an iOS release build
