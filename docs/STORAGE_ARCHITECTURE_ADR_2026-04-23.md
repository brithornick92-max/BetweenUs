# Storage Architecture ADR - Supabase Source of Truth

## Decision

Between Us uses Supabase as the source of truth for account, couple, entitlement, and synced content data. Device persistence is cache-only and may be cleared or rebuilt from Supabase.

## Consequences

- Writes for product data go through the Supabase-backed data layer.
- AsyncStorage is allowed only for cache, offline retry queues, scheduling ids, and non-authoritative UI preferences.
- Supabase Auth sessions are not persisted by the app on device.
- Deleted legacy device-database modules remain only as removed history in git, not active code.
- Schema setup no longer creates legacy key-material or wrapped-content columns.

## Operational Notes

- Offline writes are queued as cache entries and flushed when Supabase is available.
- If cache is missing or corrupt, the app should recover by reading Supabase.
- Tests should assert Supabase/cache behavior, not a device-database source model.
