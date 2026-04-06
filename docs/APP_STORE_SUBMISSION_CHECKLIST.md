# Between Us — App Store Submission Checklist

**Date:** April 6, 2026  
**Submission scope:** iOS App Store only  
**Repo status:** Automated checks passing (`13/13` test suites, deployment validator passing)

## Release Verdict

There are no known **repo-side** blockers remaining for iOS App Store submission.

The remaining work is operational and store-side:

1. Complete App Store Connect privacy answers
2. Complete export compliance questionnaire in App Store Connect (exempt path)
3. Verify production Supabase environment state
4. Perform final real-device iOS smoke tests

## Current iOS Config Snapshot

- App name: `Between Us`
- Bundle ID: `com.brittany.betweenus`
- Version: `1.0.0`
- Build number: `1.0.0` in `app.json`, with EAS `appVersionSource: remote` and production `autoIncrement: true`
- iOS deployment target: `17.1`
- URL scheme: `betweenus`
- Encryption flag: `ITSAppUsesNonExemptEncryption = false`
- Privacy manifest: present in `app.json`
- Sentry Expo plugin: configured
- EAS submit config: `appleId`, `ascAppId`, and `appleTeamId` present

## App Store Connect Privacy Answers

Use these answers in **App Store Connect → App Privacy**.

Before filling the final form for a release candidate, generate the privacy report from the archived build in Xcode Organizer and reconcile these answers against that report. The archived binary is the source of truth.

### Top-level answers

1. Do you or your third-party partners collect data? → **Yes**
2. Do you or your third-party partners use data for tracking? → **No**

### Data collected

1. **Contact Info → Email Address**
   Purpose: **App Functionality**
   Linked to the user: **Yes**
   Used for tracking: **No**

2. **User Content → Other User Content**
   Purpose: **App Functionality**
   Linked to the user: **Yes**
   Used for tracking: **No**

3. **User Content → Photos or Videos**
   Purpose: **App Functionality**
   Linked to the user: **Yes**
   Used for tracking: **No**

4. **User Content → Audio Data**
   Purpose: **App Functionality**
   Linked to the user: **Yes**
   Used for tracking: **No**

5. **Identifiers → Device ID**
   Purpose: **Analytics**
   Linked to the user: **Yes**
   Used for tracking: **No**

6. **Diagnostics → Crash Data**
   Purpose: **App Functionality**
   Linked to the user: **No**
   Used for tracking: **No**

7. **Diagnostics → Performance Data**
   Purpose: **App Functionality**
   Linked to the user: **No**
   Used for tracking: **No**

7. **Usage Data → Product Interaction**
   Purpose: **Analytics**
   Linked to the user: **Yes**
   Used for tracking: **No**

Important: the app privacy answers in App Store Connect should reflect the full shipped experience, including account email and user-content categories. The app's own privacy manifest in the repo currently emphasizes app-defined analytics and diagnostics, while linked SDK manifests and the archive privacy report may add more categories. Use the archive privacy report as the final source of truth.

## Archive Privacy Report Workflow

Run this for the actual build you plan to submit:

1. Build/archive the iOS app
2. Open the archive in Xcode Organizer
3. Control-click the archive and choose `Generate Privacy Report`
4. Review collected-data categories from the app and linked SDKs
5. Confirm App Store Connect matches the report for email, diagnostics, identifiers, usage data, and any user-content categories present in the binary
6. If the report differs from this checklist, update this checklist before submission

## Review Notes To Paste Into App Store Connect

```text
Between Us is a couples app focused on connection, journaling, prompts, date planning, and private partner interactions.

TEST FLOW:
1. Create an account with email and password
2. Invite a partner from the app
3. Redeem the invite code on a second account to link the couple

KEY FEATURES:
- Daily shared prompts
- Shared calendar and date planning
- Partner “vibe signal” interactions
- Love notes and relationship reflections
- Optional premium subscription for expanded content and sync features

DATA HANDLING:
- Private synced content is encrypted before upload
- Optional photo and voice-note attachments are encrypted before upload
- The app uses limited pseudonymous analytics plus crash/performance diagnostics, including limited Sentry session replay, to improve reliability
- The app includes an in-app Privacy Policy, Terms, and account deletion flow
- Account deletion is available in Settings → Privacy & Security → Delete Account

NOTIFICATIONS:
- Push notification permission is requested only from explicit user action in-app

ENCRYPTION:
The app uses client-side encryption for private synced data before upload. App Store Connect currently classifies this implementation on the exempt path, so `ITSAppUsesNonExemptEncryption` should be set to `NO` in the shipped plist.
```

## Encryption / Export Compliance Checklist

App Store Connect currently classifies this app on the exempt documentation path. Keep the following aligned for submission:

1. `ITSAppUsesNonExemptEncryption = false` in the shipped plist
2. Export compliance answers in App Store Connect aligned to the exempt path

Keep the following details handy:

- Encryption used for confidential user data
- NaCl-based encrypted payload flow
- 256-bit key material
- Ciphertext stored remotely, plaintext kept off the server

## ITMS-90592 Fix

If App Store Connect rejects the upload with `ITMS-90592: Invalid Export Compliance Code`, treat it as a metadata mismatch first.

For this app, the App Store Connect questionnaire currently resolves to the exempt path, so the shipped IPA must match that classification:

1. Open the app in App Store Connect
2. Go to the export compliance / encryption questionnaire for the rejected build
3. Answer the encryption questions so they resolve to the exempt path
4. Ensure the next uploaded binary ships with `ITSAppUsesNonExemptEncryption = false`
5. Re-upload the build if the rejected binary already contains the wrong plist value

This is not usually a code-signing or plist-generation bug unless the IPA itself is missing the key.

## Final iPhone Smoke Tests

Run these on a real iPhone release build before pressing submit:

1. Launch app with network available → verify normal cold start
2. Launch app in airplane mode → verify app still opens and local data works
3. Create local content offline → restore network → verify sync resumes
4. Send a notification, kill app, tap notification → verify correct screen opens
5. Enable notifications from Settings screen → verify prompt appears only there
6. Create account → link partner → verify pairing flow completes
7. Delete account from in-app settings → verify the flow completes cleanly
8. Open Terms and Privacy Policy screens from the app

## Production Environment Checks

These are not repo changes, but they still need confirmation:

1. Required EAS secrets are present for production builds
2. Production Supabase migrations are applied
3. Production RPCs used by the app are deployed
4. `pg_cron` jobs are present and active
5. RevenueCat offerings and entitlement mapping are correct in production
6. Sentry release upload works for production builds

## App Store Review Feedback — v1.0 Rejection (March 27, 2026)

### Guideline 3.1.2(c) — Subscriptions: Terms of Use (EULA) Link

**Issue:** App Store metadata is missing a functional link to the Terms of Use (EULA).

**Required App Store Connect Changes:**

1. **Option A (Recommended):** In the App Store description, add a line like:
   ```
   Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
   ```
2. **Option B:** Add a custom EULA in App Store Connect → App Information → License Agreement (EULA).

**In-App Fix (Done):** EULA link added to both paywall screens (PremiumPaywall and PremiumScreen) alongside existing Terms of Service and Privacy Policy links.

**Ensure these are also set in App Store Connect:**
- Privacy Policy URL field (App Store Connect → App Information)
- In-app subscription flow already shows: subscription title, length, price, and links to Terms, Privacy Policy, and EULA

### Guideline 2.3.2 — Accurate Metadata: Cloud Sync

**Issue:** App description and/or screenshots reference cloud sync without indicating it requires a premium subscription.

**Required App Store Connect Changes:**

1. Update the App Store description to clearly mark cloud sync as a premium feature. Example wording:
   ```
   Premium features (available via in-app subscription) include unlimited prompts,
   love notes, date night planning, cloud sync, and more.
   ```
2. If screenshots show cloud sync, either:
   - Remove cloud sync from screenshots, or
   - Add a visible "Premium" badge or label in the screenshot

### Review Notes Update

Include this in the Notes field for the resubmission:

```text
Changes made for this resubmission:

1. [3.1.2(c)] Added the Terms of Use (EULA) link to the in-app subscription purchase flow, and the App Store description has been updated to include the EULA link as well.

2. [2.3.2] Updated App Store metadata to clearly identify cloud sync as a premium subscription feature.

3. Improved pairing and shared-content reliability for review testing:
   - fixed QR/invite linking and existing-couple repair behavior
   - fixed shared prompt consistency so both partners see the same daily prompt for the day
   - fixed prompt reflection saving from both the home prompt entry point and the full prompt screen
   - fixed shared love note and calendar sync reliability for paired users

4. Notification behavior remains user-initiated only:
   push permission is requested only after explicit in-app action.

If needed for review, the core test flow is: create two accounts, link them as partners, open Today's Moment on both devices, and verify the same shared daily prompt appears for both partners.
```

---

## Final Go / No-Go

### Go if all of these are true

1. App Store privacy answers are entered
2. Encryption compliance filing is handled
3. Real-device smoke tests pass
4. Production Supabase environment is verified
5. App Store description includes Terms of Use (EULA) link
6. App Store description clearly marks cloud sync as a premium feature
7. Privacy Policy URL is set in App Store Connect

## Residual Risk

Before final submission, reconcile three sources against the same release archive:

1. The archive privacy report generated by Xcode Organizer
2. App Store Connect → App Privacy answers
3. The repo copies of `app.json` and `ios/BetweenUs/PrivacyInfo.xcprivacy`

If the archive report lists collected data categories beyond the current repo manifest, update the repo and App Store Connect to match the archive before submitting.

### No-Go if any of these are still unknown

1. Notification cold-start routing on a release build
2. Offline-to-online sync recovery on a release build
3. App Store privacy declarations
4. Encryption compliance status