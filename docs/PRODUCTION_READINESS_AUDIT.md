# Production Readiness Audit

Status: refreshed for the Supabase source-of-truth storage model.

## Storage

- Supabase is authoritative for synced content.
- Device persistence is cache-only.
- App config no longer includes the device database plugin.
- Removed device auth persistence and credential fallback paths.

## Release Checks

- Run lint and the Jest suite.
- Run the storage audit search from `docs/SECURITY_AUDIT_2026-04-23.md`.
- Confirm Supabase migrations are applied, including the migration that drops legacy key-material and wrapped-content columns.
- Confirm account deletion, unlinking, offline queue replay, media upload, and push-token cleanup in a staging build.
