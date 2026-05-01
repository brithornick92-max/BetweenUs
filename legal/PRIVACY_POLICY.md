# Privacy Policy

**Last Updated: April 29, 2026**

At Between Us, your privacy matters. This Privacy Policy explains what we collect, how we use it, how we protect it, and the choices you have when you use the Between Us mobile app and related services.

---

## Our Privacy Commitment

We believe relationship content should be handled carefully. That's why we:

- Do not sell your personal data
- Do not use advertising networks or track you across other apps or websites
- Protect synced data with account authentication, Supabase row-level security, HTTPS/TLS, provider access controls, and platform security tools
- Give you in-app tools to export data, delete data, unlink from a partner, and delete your account
- Use only limited analytics, diagnostics, and crash reporting to improve reliability

**Important security clarification:** Between Us does not currently provide end-to-end encryption for core synced content such as journals, prompt answers, memories, check-ins, vibes, calendar events, or date plans. Core content is stored in Supabase as structured data and protected by authentication, row-level access controls, transport security, and provider-side security controls. App lock, PIN, Face ID, and Touch ID help protect access on your device, but they are not a promise that synced content is encrypted end-to-end.

---

## 1. Information We Collect

### 1.1 Information You Provide

**Account information**

- Email address
- Supabase account user ID
- RevenueCat app user ID, subscription status, and entitlement status
- Display name
- Partner names or nicknames
- Relationship start date, if you add one
- Password or authentication credentials handled through Supabase Auth

**Relationship content and preferences**

- Journal entries and prompt answers
- Shared memories and milestones
- Check-ins, vibes, and moment signals
- Date plans, calendar events, titles, dates, optional locations, and notes
- Tried/favorite sex positions, rituals, love notes, and similar relationship content
- Optional media attachments that you choose to add to journals or memories
- Heat level, energy level, relationship climate, tone, and content preferences
- Soft boundary settings, hidden categories, and paused content
- Inside jokes, nicknames, shared references, and local preference history
- Data export requests and support messages you send us

### 1.2 Information Collected Automatically

**Device and app information**

- Device type and model
- Operating system version
- App version and build information
- App, authentication, subscription, session, and push notification identifiers used to operate the service

**Usage, analytics, and diagnostics**

- Screen views, paywall events, feature usage, export events, and similar product interaction events
- Daily usage counts used to enforce free-tier limits
- Crash reports, performance traces, error logs, limited Sentry session replays, and optional user feedback. Session replays are configured for diagnostics, but may process on-screen app interaction data.
- Notification delivery records and push tokens if notifications are enabled

### 1.3 Device Permissions

We request device permissions only when needed:

- **Camera:** Optional photo or video capture where the app offers it and you choose to use it
- **Photo Library:** Choosing media attachments for supported features and, on Android, saving certain exported snapshot images when you request it
- **Microphone:** Recording a voice note only if a build exposes that feature and you choose to use it
- **Notifications:** Sending reminders, partner activity alerts, weekly recaps, milestone celebrations, and other app notifications if enabled
- **Face ID / Touch ID:** Optional app lock. Biometric matching is handled by your device. Between Us receives only a success/failure result and does not collect, store, or transmit biometric templates

### 1.4 Information We Do Not Collect

We do not intentionally collect:

- Precise location data
- Contact lists
- Biometric templates
- Credit card numbers or payment credentials
- Advertising identifiers for cross-app tracking
- Your sexual orientation as an account field, except to the extent you voluntarily include sensitive information in content you create

Payments are handled by Apple and RevenueCat. We receive subscription status and entitlement information, not your full payment details.

---

## 2. How We Use Your Information

We use your information to:

- Create and manage your account
- Link and unlink partner accounts
- Save, display, sync, and recover your relationship content
- Provide prompts, date ideas, calendar features, memories, signals, recaps, and personalization
- Enforce free-tier limits and premium entitlements
- Send notifications if you enable them
- Process subscriptions through Apple and RevenueCat
- Respond to support, privacy, and data requests
- Fix bugs, monitor crashes, improve performance, and understand feature usage
- Prevent fraud, abuse, unauthorized access, and Terms violations
- Comply with legal obligations and protect rights, safety, and security

---

## 3. Storage, Security, and Local Data

### 3.1 Core Synced Content

The active storage architecture uses Supabase as the canonical source of truth for core app content. When you are signed in and paired, core relationship content can be stored in Supabase tables and Supabase Storage so it can be synced, recovered, and shown to authorized account or couple members.

Core synced content is protected by:

- Supabase Auth
- Row-level security policies
- HTTPS/TLS in transit
- Provider-side storage security and access controls
- Access controls in our app and backend functions

Core synced content is **not** currently encrypted end-to-end before upload.

### 3.2 Device Cache and Offline Use

Between Us also keeps device cache for responsiveness, offline continuity, settings, and pending offline writes. Device cache may include:

- Cached synced content
- Drafts or queued writes waiting to sync
- App settings and privacy settings
- App-lock enabled state and operating-system biometric result state
- Scheduled notification ids and in-memory push-token state
- Cache-only preference history such as inside jokes and content tuning

Some preferences, including energy level, relationship climate, and soft boundaries, may also sync to your profile so they can be restored across devices.

### 3.3 App Lock and Biometrics

App lock, PIN, Face ID, and Touch ID are device-access controls. They help prevent someone using your device from opening Between Us without authorization. They do not change how synced data is stored on our servers.

### 3.4 Media Attachments

Media you choose to attach may be stored locally and/or uploaded to Supabase Storage so the feature can work across devices or with your linked partner. Uploaded media is protected by access controls and transport security, but is not currently promised to be end-to-end encrypted.

### 3.5 Analytics and Diagnostics

We use first-party analytics stored through Supabase and Sentry diagnostics to understand reliability and product usage. Sentry is configured without default PII, uses limited session replay sampling, and scrubs known token-like URL values before sending events where our code can do so.

---

## 4. Sharing and Disclosure

### 4.1 With Your Linked Partner

When you link with a partner, content in your shared couple space may be available to the linked partner according to the feature flow. For example:

- Shared journals, prompt answers, memories, vibes, calendar events, date plans, and similar couple-space content are stored in the linked couple space
- Prompt answers are designed to reveal through the app's shared reveal flow
- Vibe and moment signals are sent to your linked partner as connectivity allows
- Soft boundaries are intended as your private content controls, though some related settings may sync to your profile for restoration

Unlinking dissolves the shared couple connection and stops future shared syncing. It does not delete your separate account automatically.

### 4.2 With Service Providers

We use service providers to operate the app:

- **Supabase:** Authentication, database, storage, row-level access controls, backend functions, and push-token related data
- **RevenueCat:** Subscription management, entitlement status, app user identifiers, and purchase-related metadata
- **Sentry:** Crash reporting, performance monitoring, limited session replays, and optional user feedback
- **Expo:** Push notification delivery, app updates, and Expo platform services
- **Apple:** App distribution, in-app purchases, subscriptions, and payment processing

These providers process data under their own terms and privacy policies and may collect data independently as needed to provide their services.

### 4.3 We Do Not Sell or Share for Advertising

We do not sell your personal data. We do not share your relationship content with advertisers, data brokers, marketing companies, social media platforms, or ad networks.

### 4.4 Legal, Safety, and Business Transfers

We may disclose information if reasonably necessary to:

- Comply with valid legal process
- Protect rights, property, safety, and security
- Prevent fraud, abuse, or unauthorized use
- Investigate or enforce Terms violations
- Complete a merger, acquisition, financing, or sale of assets, subject to appropriate protections

We will try to notify you of legal requests unless prohibited by law or if notification would create risk.

---

## 5. Your Privacy Rights and Choices

Depending on where you live, you may have rights to access, correct, delete, export, restrict, object to, or receive a copy of personal data. You can contact us to exercise those rights.

### 5.1 Access and Export

- View your content in the app
- Export supported data through the in-app export flow
- Request a copy of personal data by contacting support

**Export note:** The app prepares a plaintext JSON export for the system share sheet and removes its temporary export file from app storage after the export flow completes. Copies you save or share from the share sheet are controlled by the destination you choose.

### 5.2 Control and Deletion

- Edit or delete supported entries in the app
- Disable notifications in app or device settings
- Change privacy and soft-boundary settings
- Unlink from your partner
- Delete your account from Settings

Account deletion removes active account data, profile records, your couple membership, your user-created couple data, push tokens, analytics events tied to your user ID, device cache, and the Supabase auth user as described in the app's deletion flow. Backup copies may persist for a limited period before routine purge, and some information may be retained where required for legal, security, fraud-prevention, or accounting reasons.

### 5.3 Regional Disclosures

**EU/UK users:** GDPR rights may include access, rectification, erasure, portability, restriction, objection, withdrawal of consent where processing is based on consent, and lodging a complaint with a supervisory authority.

**California users:** CCPA/CPRA rights may include the right to know, delete, correct, opt out of sale or sharing, limit use/disclosure of sensitive personal information where applicable, and non-discrimination for exercising rights. We do not sell personal information and do not share it for cross-context behavioral advertising.

---

## 6. Data Retention

- We retain account data while your account is active
- We retain relationship content until you delete it, delete your account, or a cleanup process applies to your couple space
- We retain analytics, diagnostics, notification logs, rate-limit records, and security records for operational periods appropriate to their purpose
- Deleted data is removed from active systems promptly where technically feasible
- Backup copies may persist for a limited period before routine purge
- Some records may be retained where needed for legal, tax, billing, security, fraud-prevention, or dispute purposes

---

## 7. Children's Privacy

Between Us is for adults only. You must be at least 18 years old to use the app. We do not knowingly collect personal information from minors. If we learn that a minor has created an account, we will take steps to delete it.

---

## 8. International Data Transfers

Our app and service providers may process data in the United States and other countries where they operate. International transfer protections depend on the provider, destination country, and applicable law.

---

## 9. Third-Party Services

### 9.1 Services We Use

- **Supabase:** Authentication, database, storage, backend functions, and realtime features
- **RevenueCat:** Subscription management and entitlement status
- **Sentry:** Crash reporting, performance monitoring, limited session replays, and optional feedback
- **Expo:** Push notifications, app updates, and Expo services
- **Apple:** App distribution, subscriptions, in-app purchases, and payments

### 9.2 Their Privacy Policies

- [Supabase Privacy Policy](https://supabase.com/privacy)
- [RevenueCat Privacy Policy](https://www.revenuecat.com/privacy)
- [Sentry Privacy Policy](https://sentry.io/privacy/)
- [Expo Privacy Policy](https://expo.dev/privacy)
- [Apple Privacy Policy](https://www.apple.com/privacy/)

---

## 10. Changes to This Policy

We may update this policy from time to time. Material changes may be communicated by updated legal documents, in-app notice, email, App Store metadata updates, or support communications where appropriate. Continued use after an update means you accept the updated policy to the extent permitted by law.

---

## 11. Contact Us

**Privacy questions and data requests**
Email: brittanyapps@outlook.com

**Support**
Email: brittanyapps@outlook.com

For data requests, include the email address associated with your account and the type of request. We aim to respond to data requests within 30 days.

---

## Summary

**What we do**

- Protect synced content with authentication, row-level access controls, HTTPS/TLS, and provider security controls
- Let you export and delete supported data
- Use app-lock controls on your device when enabled
- Use limited analytics and diagnostics to improve reliability
- Never sell your data

**What we do not do**

- Provide end-to-end encryption for core synced content at this time
- Sell your data
- Share relationship content with advertisers or data brokers
- Track you across other apps or websites for advertising
- Collect biometric templates or payment card details

**Your privacy matters to us. If you have questions or concerns, please reach out.**

*Last Updated: April 29, 2026*
