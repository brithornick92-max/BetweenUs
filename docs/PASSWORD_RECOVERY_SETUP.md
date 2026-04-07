# Password Recovery Setup

The password recovery flow is configured to use Resend from the Supabase Edge Function at `supabase/functions/password-recovery/index.ts`.

## Required Secrets

Set these in Supabase before deploying the function:

```bash
supabase secrets set RESEND_API_KEY="<your-resend-api-key>"
supabase secrets set RECOVERY_CODE_FROM_EMAIL="Between Us <auth@brittanyapps.com>"
supabase secrets set RECOVERY_CODE_PEPPER="<random-long-secret>"
```

Notes:

- `RESEND_API_KEY`: API key from Resend.
- `RECOVERY_CODE_FROM_EMAIL`: verified sender identity in Resend. Current sender: `Between Us <auth@brittanyapps.com>`.
- `RECOVERY_CODE_PEPPER`: extra server-side secret mixed into the hashed recovery code. Use a long random value.

## Deploy Steps

Run the migration and deploy the Edge Function:

```bash
supabase db push
supabase functions deploy password-recovery --no-verify-jwt
```

## Resend Domain Setup

In Resend:

1. Add and verify your sending domain.
2. Verify `brittanyapps.com` and use `auth@brittanyapps.com` as the sender address.
3. Generate an API key for the Supabase function.

## Current Client Flow

The app flow is:

1. User taps `Email me a recovery code.` from sign-in.
2. App calls the `password-recovery` Edge Function with `{ action: 'send', email }`.
3. Resend delivers a 6-digit code.
4. User enters code + new password.
5. App calls the Edge Function with `{ action: 'verify', email, code, password }`.
6. Function verifies the code server-side and updates the Supabase auth password.

## Files

- `supabase/functions/password-recovery/index.ts`
- `supabase/migrations/20260407120000_password_recovery_codes.sql`
- `screens/ResetPasswordScreen.js`
