# Production Question and Content Audit - 2026-05-10

Scope: code, content, cache, Supabase sync, entitlement, weekly scheduler, reveal, invite, notification, and OTA safety audit for the checklist in the production audit map. This was a production code audit plus automated verification, not manual device testing.

No debug panel was added. No native dependency, app config, migration, or store-build requirement was introduced by this audit.

## Executive verdict

No production-blocking repeat-question issue remains in the current working tree.

Daily prompts are now assigned, not casually randomized. Linked couples read the shared Supabase assignment first, reuse a same-day scoped cache only as a display backup, deterministically select a prompt if no row exists, save the shared assignment, and re-read after saving so the first writer wins. Solo users use a user-scoped deterministic selection and same-day cache.

The daily prompt pool is not the free weekly prompt pool. It uses the dedicated Today Between Us catalog: 183 prompts, heat 1-3 only, with a 183-day no-repeat rotation target.

Catalog duplicate checks passed across prompts, Today Between Us, quiz questions, dates, and intimacy positions.

## Changes applied during audit

- Hardened the daily prompt loader in `context/ContentContext.js`.
- Added same-day scoped daily prompt cache validation by date and scope.
- Added linked-couple shared assignment read/save/re-read behavior.
- Preserved first cloud writer on duplicate daily assignment inserts.
- Increased question no-repeat target to 183 days and made OTA catalog expansion stable for the current cycle.
- Added deterministic emergency fallback so unexpected loader errors do not drop users onto the same static fallback question.
- Added `npm run audit:content` via `scripts/audit-content-integrity.cjs`.
- Added regression coverage for cache fallback, cloud first-writer-wins, no-repeat windows, OTA-stable rotation, and duplicate assignment preservation.

## Audit results by area

### 1. Daily question / prompt rotation

Result: Pass with one known product decision.

- Selection is deterministic by `dateKey + scope`, where scope is `couple:<coupleId>` when linked and `user:<userId>` otherwise.
- Linked couples use Supabase shared assignment key `daily_prompt_YYYY-MM-DD`.
- The app stores same-day prompt cache with `dateKey`, `scope`, and `promptId`; stale scope/date cache is ignored.
- Opening the app repeatedly on the same day does not reshuffle.
- Supabase failure no longer causes random prompt selection. It uses same-day cache or deterministic selection.
- Duplicate insert races preserve the existing row and re-read cloud state.
- Emergency fallback is deterministic after scope is known, not the same static fallback prompt.
- Today Between Us has exactly 183 daily prompts, matching the 183-day no-repeat cycle.

Product decision: the day key is local-device based with a 4am rollover. Partners in different time zones can briefly be on different day keys. If the product requires one worldwide couple day, the day key should move to a couple/server timezone rule later.

### 2. Duplicate content

Result: Pass.

- No duplicate IDs.
- No duplicate exact text/title.
- No duplicate normalized text/title.
- No duplicate normalized first-80-character starts.
- No cross-surface duplicate normalized question text across prompts, Today Between Us, and quiz.
- Existing semantic-ish Jest similarity test also passed.

### 3. Content eligibility

Result: Pass for daily prompts. Watch item for general free weekly prompt heat.

- Daily prompts use the dedicated Today Between Us pool, not the smaller weekly free deck.
- Daily prompts are heat 1-3 only.
- Weekly free and premium libraries are cumulative, not destructive rotations.
- `releaseWeek` is metadata for audit/catalog order; runtime access is driven by stable weekly allocation and tier limits.
- Locked preview counts are currently 0 for prompts, dates, and positions.

Watch item: free weekly prompt access currently allows heat 4/5 through the configured free prompt deck. This does not affect daily prompt repeats, but confirm it matches product intent.

### 4. Free vs premium state

Result: Pass.

- Unknown RevenueCat/offering failures fall back to free mode, not premium/random behavior.
- RevenueCat entitlement checks use the configured `Between Us Pro` entitlement.
- Premium effective state is self premium OR couple premium.
- Free/premium content tests passed.
- Free daily prompt pool is not tiny; it is 183 dedicated prompts.

### 5. User identity / couple identity

Result: Pass.

- Daily prompt scope uses `user.uid || user.id`.
- Linked daily prompt scope uses active couple ID.
- Active couple ID is read from storage and profile fallback.
- Sign out clears local cache/session data.
- Couple data writes are scoped to authenticated couple state.
- Invite/linking tests passed.

### 6. Local cache / stale data

Result: Pass for daily prompt behavior.

- Daily prompt cache is scoped by date and couple/user scope.
- Same-day cache is display backup only; cloud wins for linked couples.
- Cache is cleared on sign-out through `storage.clearSession()`.
- Stale linked local cache is ignored when cloud has a shared assignment.

### 7. Supabase sync

Result: Pass.

- Daily prompt assignment is stored as shared couple data with first-writer preservation.
- Prompt answers are private rows.
- Prompt-answer uniqueness is enforced for live answers by couple/user/prompt/day.
- Prompt answer status rows expose status without private text.
- Offline queue, memory snapshot, auth-state, and backend policy contract tests passed.

### 8. Date / time / reset

Result: Pass with timezone caveat.

- Date key format is `YYYY-MM-DD`.
- Daily rollover is local time at 4am.
- Foreground/reopen uses the same date key until rollover.
- No UTC/local mismatch was found inside the current daily prompt code path.

Known caveat: local device timezone is the source of truth. Travel or partners in different time zones can cause temporary desync.

### 9. Partner reveal flow

Result: Pass by contract tests.

- Answers are private until server reveal.
- Reveal goes through Supabase RPC `reveal_prompt_answer`.
- Status rows exist without answer text.
- Backend policy contracts cover privacy, reveal, couple scoping, and notification routing.

### 10. Weekly content scheduler

Result: Pass.

- Free: starts with 20 prompts, 20 dates, 5 positions; adds 5/5/1 weekly.
- Premium: starts with 100 prompts, 100 dates, 10 positions; adds 15/15/3 weekly.
- Libraries are cumulative.
- Stable weekly allocation tests passed.
- Free weekly deck visibility tests passed.

### 11. Content catalog integrity

Result: Pass.

Current catalog totals:

- Prompts: 748
- Today Between Us prompts: 183
- Daily quiz questions: 365
- Dates: 707
- Intimacy positions: 200

The validator reported 0 prompt issues and 0 date issues.

### 12. App version / build / OTA

Result: OTA-safe.

- No native config/dependency change was required.
- `app.json` uses Expo Updates with `runtimeVersion.policy = appVersion`.
- This can ship as OTA to users on the same runtime/app version.
- Existing RevenueCat debug screen is `__DEV__` gated and not mounted in production.

### 13-22. Onboarding, invite, notifications, locked content, privacy, empty states, device differences, and automated tests

Result: No direct blockers found in audited code/tests.

- Onboarding/sign-in/sign-out clears and restores relevant state.
- Invite and couple-linking tests passed.
- Push notification and partner notification tests passed.
- Paywall/access tests passed.
- Backend policy tests cover private data scoping, anonymous denial, deletion ownership, and prompt privacy.
- Device-difference causes that remain plausible for an already-released live user are stale OTA/build, local timezone/date differences, or old cached state before this OTA reaches the device.

## Residual risks

P2 - Local timezone day key: current daily prompt reset is based on each device's local 4am day. This is intentional in code but can desync traveling/cross-timezone partners.

P2 - Answered prompts are not excluded forever. The current guarantee is no repeat within the 183-day Today Between Us cycle when the pool remains intact. After the cycle, a previously answered prompt can become eligible again. If the desired rule is "never repeat answered prompts," that needs a stricter product rule and likely server-backed history.

P3 - Free weekly prompt heat: free weekly prompt decks can include heat 4/5 based on current free access flags. Daily prompts remain heat 1-3. Confirm whether that is desired for the broader prompt library.

P3 - Existing users still need the OTA. A friend already on production will not see these fixes until the OTA is published to her installed runtime and her app accepts the update.

## Verification run

- `npm run audit:content` - passed.
- `node scripts/validateContent.cjs` - passed, 0 issues.
- `node scripts/audit-weekly-content-release.cjs` - passed, no duplicate IDs/text.
- `node scripts/audit-free-premium-weekly-preview.cjs` - completed; confirmed free/premium surface sizes.
- Daily/rotation/couple cache Jest suite - 5 suites, 23 tests passed.
- Content catalog/similarity Jest suite - 6 suites, 37 tests passed.
- Weekly/access/security Jest suite - 9 suites, 117 tests passed.
- Sync/notification/linking/RevenueCat Jest suite - 9 suites, 83 tests passed.
- Full Jest suite - 79 suites, 653 tests passed.
- `npx eslint context/ContentContext.js __tests__/context/ContentContext.dailyPrompt.test.js` - passed.
- `git diff --check` - passed.
- `npm audit --omit=dev --audit-level=high` - passed, 0 vulnerabilities.
