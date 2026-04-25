# Security Audit — Between Us
Date: 2026-04-24

## Summary

The app's security posture is solid. All critical controls are in place. This document records what was verified, one storage path mismatch that was fixed, and a small set of low-risk notes.

---

## ✅ Source of Truth: Supabase

**Status: Correct.**

- `services/localfirst/index.js` exports `SupabaseDataLayer` as the active `DataLayer`.
- `SupabaseDataLayer` writes all core content (journals, prompt answers, memories, check-ins, vibes, calendar events, date plans) directly to Supabase `couple_data` and `calendar_events` tables.
- Local storage (`AsyncStorage`) is used **only** for:
  - Offline mutation queue (`@betweenus:cloudSyncQueue:*`)
  - Read cache per scope (`@betweenus:dataCache:*`)
  - Migration markers (`@betweenus:supabaseMigrated:*`)
  - App settings (theme, app lock, notification prefs)
  - Onboarding state flags
- The legacy `DataLayer.js` (SQLite + E2EE + SyncEngine) is retained only for the one-time `migrateLegacyStorage()` path and is not used for any live reads or writes.
- The `STORAGE_ARCHITECTURE_ADR_2026-04-23.md` decision is implemented correctly.

---

## ✅ Auth & Session Handling

**Status: Correct.**

- Auth is handled entirely by Supabase (`SupabaseAuthService`).
- Session tokens are stored in **SecureStore** via `SecureSupabaseStorage` (chunked to handle >2048 byte tokens). Not in AsyncStorage.
- `autoRefreshToken: true` and `persistSession: true` are set on the Supabase client.
- Sign-out uses `scope: 'global'` by default, revoking all refresh tokens across devices.
- Account deletion uses the `delete_own_account()` server-side RPC, which cascades cleanly.
- Stored credentials (for silent re-auth) are written to platform SecureStore by `SupabaseAuthService`. `EncryptionService` is currently a compatibility no-op, so do not describe this path as application-layer encrypted.
- Auth timeout is 15 seconds with a `Promise.race` guard on all auth calls.

---

## ✅ Row Level Security

**Status: Correct. All tables have RLS enabled with appropriate policies.**

| Table | RLS Enabled | Policy Summary |
|---|---|---|
| `profiles` | ✅ | Users can only read/write their own row |
| `couples` | ✅ | Members can view/update; only creator can insert |
| `couple_members` | ✅ | Members can view their couple's memberships; can only insert/delete/update own row |
| `couple_data` | ✅ | Members can select (excluding others' private rows); only creator can insert/update/delete; insert gated by premium + data type limits |
| `calendar_events` | ✅ | Members can view; only premium members can insert/update/delete |
| `moments` | ✅ | Members can view (excluding others' private); only creator can insert/update/delete |
| `partner_link_codes` | ✅ | Creator can view own codes; insert requires ownership check |
| `user_entitlements` | ✅ | Users can only read own row; **client INSERT and UPDATE are explicitly denied** (service role only) |
| `push_tokens` | ✅ | Users can only read/write/delete own tokens |
| `usage_events` | ✅ | Users can insert own events (couple membership verified); couple members can read |
| `analytics_events` | ✅ | Users can only read/write own rows |
| `notification_log` | ✅ | Service role only |
| `password_recovery_codes` | ✅ | Service role only |
| `password_recovery_request_limits` | ✅ | Service role only |
| `rate_limit_buckets` | ✅ | Service role only |

**Storage buckets (all private, RLS enforced):**

| Bucket | Public | Policy |
|---|---|---|
| `couple-media` | ❌ | Couple members only; path must be `couples/{couple_id}/...` |
| `attachments` | ❌ | Couple members only; path must be `{couple_id}/...` |
| `whispers` | ❌ | Couple members only; path must be `{couple_id}/...` |

---

## ✅ API Key Security

**Status: Correct.**

- Only the **anon key** is used client-side (`EXPO_PUBLIC_SUPABASE_ANON_KEY`).
- No service role key is present anywhere in the client codebase (confirmed by search).
- The anon key is safe to ship in the client bundle — it is scoped to the RLS policies above.
- Keys are loaded from `EXPO_PUBLIC_*` env vars, which are baked into the build at EAS build time and never committed to source (`.gitignore` covers `.env` and `.env.local`).
- The `.env.example` file contains only placeholder values.

---

## ✅ HTTPS / Transport Security

**Status: Correct.**

- All Supabase API calls go to `https://*.supabase.co` — TLS enforced by Supabase.
- Push notifications go to `https://exp.host` via the `send_expo_push` server-side function — never from the client directly.
- No HTTP endpoints are used anywhere in the codebase.
- `detectSessionInUrl: false` is set on the Supabase client (correct for React Native — prevents URL-based session injection).

---

## ✅ Server/Database Access Controls

**Status: Correct.**

- Sensitive RPCs (`delete_own_account`, `leave_couple`, `create_couple_for_qr`, `redeem_pairing_code`) use `SECURITY DEFINER` with `SET row_security TO 'off'` internally, but all verify `auth.uid()` at the top before doing anything.
- `send_expo_push` is `REVOKE`d from `PUBLIC` and only granted to `service_role` — clients cannot call it directly.
- `user_entitlements` writes are blocked at the RLS layer for all authenticated clients. Entitlement updates come only from the RevenueCat webhook Edge Function (`revenuecathook`).
- Rate limiting is enforced server-side via `check_sensitive_rate_limit()` on pairing code redemption.
- The `notify_partner` function has an anti-spoof check: `IF auth.uid() IS NOT NULL AND sender_id != auth.uid() THEN RAISE EXCEPTION`.

---

## 🔧 Fix Applied: `couple-media` Upload Path

**Issue:** `SupabaseDataLayer.uploadMedia()` was uploading images to `{couple_id}/{fileId}.{ext}` in the `couple-media` bucket. The RLS policy for `couple-media` requires the path to be `couples/{couple_id}/...` (it checks `(storage.foldername(name))[1] = 'couples'` and `(storage.foldername(name))[2] = couple_id`). The old path would fail the RLS check silently.

**Fix:** Updated `uploadMedia()` in `SupabaseDataLayer.js` to use `couples/{couple_id}/{fileId}.{ext}` for the `couple-media` bucket, matching the RLS policy.

---

## Low-Risk Notes (No Action Required)

1. **Legacy `DataLayer.js` still imports E2EEncryption / SyncEngine.** These are only exercised during `migrateLegacyStorage()` for users upgrading from the old SQLite stack. Once all users have migrated, these files can be removed. No security risk — they are not in the active write path.

2. **`promptStorage`, `journalStorage`, `checkInStorage` in `utils/storage.js` are marked `@deprecated`** and encrypt with a device-local key. They are only read during `migrateLegacyStorage()`. No new writes go through them.

3. **Stored credentials in SecureStore.** The `SupabaseAuthService.storeCredentials()` path stores email+password for silent re-auth in platform SecureStore. This is noted as a known accepted risk in `AuthContext.js` with a comment to migrate to PKCE/OAuth long-term. Because `EncryptionService` is currently a compatibility no-op, there is no additional application-layer encryption on top of SecureStore.

4. **`vibeStorage`, `memoryStorage`, `ritualStorage` in `utils/storage.js`** still write to AsyncStorage with device-local encryption. These are legacy local-only features. If any of these need to become Supabase-backed, they should go through `SupabaseDataLayer` like the other content types.
