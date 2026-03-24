# Between Us — App Store Submission Checklist

**Date:** March 22, 2026  
**Submission scope:** iOS App Store only  
**Repo status:** Automated checks passing (`13/13` test suites, deployment validator passing)

## Release Verdict

There are no known **repo-side** blockers remaining for iOS App Store submission.

The remaining work is operational and store-side:

1. Complete App Store Connect privacy answers
2. File ERN / self-classification for encryption
3. Verify production Supabase environment state
4. Perform final real-device iOS smoke tests

## Current iOS Config Snapshot

- App name: `Between Us`
- Bundle ID: `com.brittany.betweenus`
- Version: `1.0.0`
- Build number: `1.0.0` in `app.json`, with EAS `appVersionSource: remote` and production `autoIncrement: true`
- iOS deployment target: `17.1`
- URL scheme: `betweenus`
- Encryption flag: `ITSAppUsesNonExemptEncryption = true`
- Privacy manifest: present in `app.json`
- Sentry Expo plugin: configured
- EAS submit config: `appleId`, `ascAppId`, and `appleTeamId` present

## App Store Connect Privacy Answers

Use these answers in **App Store Connect → App Privacy**.

### Top-level answers

1. Do you or your third-party partners collect data? → **Yes**
2. Do you or your third-party partners use data for tracking? → **No**

### Data collected

1. **Contact Info → Email Address**
   Purpose: **App Functionality**
   Linked to the user: **Yes**
   Used for tracking: **No**

2. **Identifiers → Device ID**
   Purpose: **Analytics**
   Linked to the user: **Yes**
   Used for tracking: **No**

3. **Diagnostics → Crash Data**
   Purpose: **App Functionality**
   Linked to the user: **No**
   Used for tracking: **No**

4. **Diagnostics → Performance Data**
   Purpose: **App Functionality**
   Linked to the user: **No**
   Used for tracking: **No**

5. **Usage Data → Product Interaction**
   Purpose: **Analytics**
   Linked to the user: **Yes**
   Used for tracking: **No**

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
- The app includes an in-app Privacy Policy, Terms, and account deletion flow
- Account deletion is available in Settings → Privacy & Security → Delete Account

NOTIFICATIONS:
- Push notification permission is requested only from explicit user action in-app

ENCRYPTION:
ITSAppUsesNonExemptEncryption is set to YES. The app uses client-side encryption for private synced data before upload.
```

## Encryption / ERN Checklist

Because the app declares `ITSAppUsesNonExemptEncryption = true`, complete one of the following before or during submission compliance work:

1. File the required self-classification / ERN paperwork with BIS, or
2. Use an existing applicable classification if you already have one

Keep the following details handy:

- Encryption used for confidential user data
- NaCl-based encrypted payload flow
- 256-bit key material
- Ciphertext stored remotely, plaintext kept off the server

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

## Final Go / No-Go

### Go if all of these are true

1. App Store privacy answers are entered
2. Encryption compliance filing is handled
3. Real-device smoke tests pass
4. Production Supabase environment is verified

### No-Go if any of these are still unknown

1. Notification cold-start routing on a release build
2. Offline-to-online sync recovery on a release build
3. App Store privacy declarations
4. Encryption compliance status