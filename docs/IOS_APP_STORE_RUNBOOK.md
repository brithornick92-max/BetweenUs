# Between Us — iOS App Store Runbook

**Date:** March 22, 2026  
**Scope:** iOS App Store only  
**Audience:** Release operator / app owner

## Goal

This runbook turns the remaining App Store submission work into a concrete execution sequence.

Use this document together with:

1. [docs/APP_STORE_SUBMISSION_CHECKLIST.md](docs/APP_STORE_SUBMISSION_CHECKLIST.md#L1)
2. [docs/PRODUCTION_READINESS_AUDIT.md](docs/PRODUCTION_READINESS_AUDIT.md#L1)

## Phase 1 — Preflight

Run these locally before building:

```bash
npm test -- --runInBand
npm run validate
```

Expected result:

1. All tests pass
2. Deployment validation passes

## Phase 2 — Confirm Production Inputs

Before the production build, verify these are configured in EAS / your CI environment:

1. `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
2. `EXPO_PUBLIC_SUPABASE_URL`
3. `EXPO_PUBLIC_SUPABASE_ANON_KEY`
4. `EXPO_PUBLIC_SENTRY_DSN`
5. Any Sentry auth token or release-upload secrets required by your build process

## Phase 3 — Production Environment Check

Confirm the live backend is actually ready before you ship a binary.

### Supabase

Verify:

1. Required migrations are applied in production
2. Realtime / replica identity changes are applied
3. RPCs used by the app are present
4. `pg_cron` jobs exist and are active
5. RevenueCat webhook function is deployed if used for entitlement propagation

Minimum SQL sanity check:

```sql
SELECT * FROM cron.job;
```

### RevenueCat

Verify:

1. iOS API key is the correct production key
2. Offerings exist
3. The entitlement identifier matches app expectations
4. Products are approved / available for the target storefronts you care about

### Sentry

Verify:

1. Production releases upload successfully
2. Source maps / debug symbols are available after a build

## Phase 4 — Build The iOS Production Binary

Build the production binary with EAS:

```bash
eas build --platform ios --profile production
```

After build completion:

1. Install the build if you need a final smoke test on device
2. Confirm the binary version/build number in App Store Connect is the one you expect
3. Confirm export compliance answers in App Store Connect match the binary's `ITSAppUsesNonExemptEncryption` value before submitting the build for review

### Export Compliance Check

For this app, the production IPA should contain `ITSAppUsesNonExemptEncryption = false` because App Store Connect currently classifies the implementation on the exempt documentation path.

If App Store Connect raises `ITMS-90592`, assume the questionnaire answers are out of sync with the binary before changing code. Verify the built IPA first, then make sure the questionnaire answers and the plist both stay on the same exempt path.

## Phase 5 — Real Device Smoke Test

Use a real iPhone with the production-style build.

Run these tests in order:

1. Cold start online
   Expected: app opens cleanly with no startup crash

2. Cold start offline / airplane mode
   Expected: app still opens and local content remains usable

3. Offline write then reconnect
   Expected: local content persists and sync resumes after reconnect

4. Notification opt-in from the in-app settings screen
   Expected: permission prompt appears only when explicitly enabled there

5. Notification cold-start route
   Expected: kill app, tap notification, land on correct screen

6. Auth callback flow
   Expected: sign-in / magic-link callback returns correctly to the app

7. Couple linking flow
   Expected: invite + redeem flow completes on two accounts/devices

8. Account deletion flow
   Expected: in-app delete account flow completes without leaving the app in a broken auth state

9. Privacy and Terms screens
   Expected: both open from the app and are reachable for review

## Phase 6 — App Store Connect Setup

### Privacy

Enter the privacy answers from:

1. [docs/APP_STORE_SUBMISSION_CHECKLIST.md](docs/APP_STORE_SUBMISSION_CHECKLIST.md#L22)

### Review Notes

Paste the prepared review notes from:

1. [docs/APP_STORE_SUBMISSION_CHECKLIST.md](docs/APP_STORE_SUBMISSION_CHECKLIST.md#L46)

### Age Rating

Recommended rating from the audit:

1. `17+`
2. Mature / suggestive themes acknowledged appropriately

### Encryption Compliance

The app is on the exempt export compliance path (`ITSAppUsesNonExemptEncryption = false`). Confirm the App Store Connect questionnaire answers are aligned to the exempt path before final submission.

## Phase 7 — Submit

If your production build is already complete and selected in App Store Connect, submit with either the UI or EAS.

EAS submit command:

```bash
eas submit --platform ios --profile production
```

If you prefer App Store Connect manually:

1. Select the built binary
2. Confirm metadata
3. Confirm privacy answers
4. Confirm export compliance answers
5. Submit for review

## Go / No-Go Gate

### Go

Proceed only if all of the following are true:

1. Tests pass
2. Deployment validation passes
3. Production env is verified
4. Real-device iPhone smoke tests pass
5. Privacy answers are entered
6. Encryption compliance is handled

### No-Go

Do not submit if any of these remain unknown:

1. Notification cold-start routing on release build
2. Offline-to-online sync recovery on release build
3. Production RevenueCat offerings / entitlement mapping
4. App Store Connect privacy answers
5. Export compliance / encryption filing status

## Final Command Sequence

If everything is ready, this is the shortest path:

```bash
npm test -- --runInBand
npm run validate
eas build --platform ios --profile production
eas submit --platform ios --profile production
```