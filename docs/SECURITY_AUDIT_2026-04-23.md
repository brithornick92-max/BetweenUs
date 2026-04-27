# Security Audit - Current Storage Model

Status: updated after the Supabase source-of-truth cleanup.

## Active Model

- Supabase Auth is the only authentication authority.
- Supabase tables and Supabase Storage are the source of truth for synced app data.
- Device persistence is limited to cache, offline retry queues, display preferences, notification scheduling ids, and temporary media playback/cache files.
- The app does not store Supabase sessions, passwords, or content keys in device storage.
- Legacy device database and key-management modules have been removed or replaced with no-op compatibility facades.

## Removed Surfaces

- Device database persistence for canonical app content.
- Local auth accounts and password restore fallback.
- Key exchange and wrapped-key pairing flows.
- App-layer content secrecy wrappers.
- Secure credential storage for silent re-auth.

## Remaining Local Cache

- `utils/storage.js` wraps AsyncStorage with `@betweenus:cache:` keys.
- Supabase data caches are rebuildable and non-authoritative.
- Offline mutation queues are retried through the Supabase data layer.
- Notification services may keep scheduled notification ids so they can cancel or replace reminders.

## Verification

Run a repository audit search before release for removed storage modules, removed device database dependencies, and removed app-layer secrecy modules.
