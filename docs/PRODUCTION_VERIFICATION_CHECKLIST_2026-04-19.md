# Production Verification Checklist

Last updated: April 19, 2026

Use this after applying the pending hosted Supabase migrations.

## Auth And Recovery

- Create a new account with email/password.
- Sign in with email/password.
- Request a magic link and confirm sign-in works.
- Request a password recovery code.
- Verify the 6-digit code and set a new password.
- Confirm the old password no longer works.
- Confirm the new password works.
- Sign out locally and confirm only this device is signed out.
- Sign in again and trigger global sign-out.
- Confirm other sessions are revoked.

## Pairing

- Generate a partner invite code.
- Redeem the invite code from the second account.
- Generate a QR pairing code from an existing couple.
- Redeem the QR pairing code from the second device/account path.
- Unlink from the couple and confirm both local and remote state remain consistent.

## Storage And Media

- Upload a couple photo and confirm signed URL viewing works.
- Delete that couple photo and confirm it is no longer accessible.
- Create an encrypted attachment and sync it.
- Open that attachment on the partner side and confirm decryption works.
- Send an encrypted whisper.
- Play the whisper on the partner side.
- Confirm the whisper object is deleted after playback.

## Notifications

- Enable notifications on a physical device.
- Confirm push token registration succeeds.
- Trigger a partner notification and confirm delivery.
- Disable notifications and confirm token removal succeeds.

## Sync And Premium

- Save a shared memory and confirm it syncs.
- Save a private memory and confirm it stays private.
- Verify premium entitlement resolution for a linked couple.
- Verify unlinking removes shared premium from the partner when expected.

## Schema Sanity Checks

- Confirm `password_recovery_codes` exists in the hosted schema.
- Confirm `password_recovery_request_limits` exists in the hosted schema.
- Confirm `attachments`, `whispers`, and `couple-media` buckets exist.
- Confirm storage object policies restrict access to authenticated couple members.

## Sign-Off Rule

Do not mark Supabase production-ready until all checks above pass and the refreshed `supabase/remote-schema.sql` is committed.