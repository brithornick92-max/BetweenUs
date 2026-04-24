# Storage Architecture ADR

Date: 2026-04-23

## Decision

The core app storage model is:

- Supabase is the canonical source of truth.
- Local storage exists only for cache, drafts, and the offline write queue.
- Offline writes are accepted locally, marked pending, and synced to Supabase later.
- Core app content is not encrypted client-side before sync.

This replaces the older "local-first + client-side encrypted sync" direction for core product data.

## Rationale

- A single canonical store simplifies conflict handling, backup, recovery, and multi-device behavior.
- Local persistence still matters for responsiveness and offline use, but it should not define truth.
- Removing client-side encryption for core content removes key-management complexity, device-pairing failure modes, and locked-data recovery issues.
- The offline queue remains important, but it is an implementation detail, not the system of record.

## Architectural Rules

- Reads should prefer Supabase-backed truth when online, with local data used as a cache for speed and offline continuity.
- Local tables must be safe to delete and rebuild from Supabase, except for unsynced drafts or queued writes.
- Sync logic should treat pending local writes as a queue to drain, not as an equal peer in bidirectional reconciliation.
- Conflict resolution should favor server truth once a write is acknowledged by Supabase.
- "Private because encrypted locally" is not a product assumption anymore for core content. Privacy is enforced by auth, RLS, transport security, and server-side controls.

## Scope

Applies to core content:

- journal entries
- prompt answers
- memories
- check-ins
- vibes
- calendar/date-planning data

Out of scope for this ADR:

- app lock / biometric vault features
- password storage and auth secrets
- platform-secure storage for tokens and local credentials
- any future feature that explicitly requires separate cryptographic handling

## Current Repo Gaps

As of this ADR, the repo still contains the previous model in several places:

- `services/data/DataLayer.js` assumes local encryption of core content before persistence.
- `services/sync/SyncEngine.js` assumes ciphertext columns are the sync payload.
- `services/db/Database.js` persists core content in `*_cipher` columns and documents ciphertext as the local source shape.
- `services/security/CoupleKeyService.js` and related pairing flows are part of the current shared-content path.
- Tests in `__tests__/services/DataLayer.test.js` and `__tests__/services/SyncEngine.test.js` assert the encrypted-sync model.
- Product/docs copy in `docs/` still refers to encrypted sync for shared content.

## Migration Consequences

To implement this ADR cleanly, the codebase should move toward:

1. Core content schemas that store plain application data locally, with sync metadata kept separately.
2. A queue model where local writes are marked `pending` and pushed to Supabase without client-side content encryption.
3. Pull/rehydration flows that can rebuild local cache from Supabase canonical data.
4. A reduced role for couple-key management, limited to any feature that still explicitly needs it.
5. Updated tests and product/legal copy once the implementation changes are complete.

## Non-Goals

- This ADR does not require removing all secure local storage.
- This ADR does not require changing auth/session handling.
- This ADR does not prescribe the exact queue table design.

## Implementation Guidance

- Keep local-first UI responsiveness.
- Treat SQLite/AsyncStorage as disposable operational state, not canonical history.
- Preserve offline creation and editing by storing drafts or queued mutations locally until sync succeeds.
- Do not update external/product claims about encrypted shared content until the shipped implementation actually matches this ADR.
