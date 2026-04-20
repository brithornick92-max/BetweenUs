# Supabase Migration Runbook

Last updated: April 19, 2026

This runbook covers the production-side steps that still need to happen outside the codebase after the recent Supabase audit and local migration work.

## Goal

Apply all pending database and storage migrations to the hosted Supabase project, then regenerate the committed schema dump so the repository matches production.

## Migrations That Must Exist In Production

- `20260407120000_password_recovery_codes.sql`
- `20260407143000_password_recovery_request_limits.sql`
- `20260419170000_storage_buckets_and_policies.sql`

## Why This Matters

- The password recovery edge function reads and writes `password_recovery_codes` and `password_recovery_request_limits`.
- The app now depends on tracked bucket/policy setup for `attachments`, `whispers`, and `couple-media`.
- The committed `supabase/remote-schema.sql` was previously missing those recovery objects and did not prove Storage configuration.

## Preconditions

- You have access to the hosted Supabase project.
- You are authenticated in the Supabase CLI for the correct account.
- You know which project ref this app should target.

## Recommended Commands

Run these from the repository root.

### 1. Link the local repo to the hosted project

```bash
supabase link --project-ref <your-project-ref>
```

If the project is already linked, confirm the ref before proceeding.

### 2. Apply pending migrations to the hosted database

```bash
supabase db push
```

If you prefer reviewing SQL first:

```bash
supabase migration list
```

### 3. Regenerate the committed schema dump

Use the hosted database connection or the linked project workflow your team standardizes on. One common pattern is:

```bash
supabase db dump --linked --schema public,storage --file supabase/remote-schema.sql
```

If your CLI version or team workflow differs, use the equivalent dump command that refreshes `supabase/remote-schema.sql` from the hosted project.

### 4. Verify the dump contains the expected objects

Check for:

- `password_recovery_codes`
- `password_recovery_request_limits`
- `storage.buckets`
- `attachments`
- `whispers`
- `couple-media`
- storage object policies for those buckets

## Expected Production Outcomes

After the push and dump refresh:

- Password recovery code send/verify should stop depending on undeclared schema state.
- Storage bucket configuration should be reproducible from migrations.
- The repo schema dump should become trustworthy again for future audits.

## If `supabase status` Fails Locally

That usually blocks local Docker-based development only. It does not necessarily block `supabase link` or `supabase db push` against a hosted project.

If local Docker is unavailable:

- skip local emulation
- work directly against the hosted project
- use `supabase link` and `supabase db push`

## Commit Expectation

Commit all of the following together after the hosted push succeeds:

- any newly applied migration files already in the repo
- refreshed `supabase/remote-schema.sql`
- any follow-up docs if the final command syntax needed project-specific adjustments