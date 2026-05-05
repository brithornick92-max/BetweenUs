# Between Us — Production Issues Tracker

## Critical Blockers (🔴 Must Fix Before Release)

### Issue #1: Double Content Filtering System Conflict
- **Priority:** 🔴 CRITICAL
- **Status:** ✅ RESOLVED 2026-05-05
- **Effort:** 2-3 hours
- **Risk:** Low (new system well-tested)
- **Files:** PromptsScreen.js, DateNightScreen.js, IntimacyPositionsScreen.jsx, WeeklyContentSetService.js, utils/stableWeeklyContent.js
- **Root Cause:** Two incompatible content filtering systems were previously active.
- **Resolution:** Live content paths now use the personalized weekly allocation model only.
- **Acceptance Criteria:**
  - [x] No live content path applies a separate release gate before personalized allocation
  - [x] Free users start with 20 prompts, 20 dates, and 5 sex positions
  - [x] Premium users start with 100 prompts, 100 dates, and 10 sex positions
  - [x] Boundary changes do not backfill additional cards in the same week
  - [x] WeeklyContentSetService and stable allocation tests pass

---

### Issue #2: Missing npm Scripts
- **Priority:** 🔴 CRITICAL
- **Status:** ✅ RESOLVED 2026-05-05
- **Effort:** <30 minutes
- **Risk:** Minimal
- **Files:** package.json
- **Root Cause:** `npm run pre-deploy` referenced missing validation scripts in the historical audit.
- **Resolution:** `test`, `validate:ios`, and `validate:android` now exist; `pre-deploy` runs all three validation steps.
- **Current Scripts:**
  ```json
  "pre-deploy": "npm test && npm run validate:ios && npm run validate:android",
  "test": "jest",
  "validate:ios": "npm run lint && npx tsc --noEmit",
  "validate:android": "npm run lint && npx tsc --noEmit"
  ```
- **Acceptance Criteria:**
  - [x] `npm run test` script exists
  - [x] `npm run validate:ios` script exists
  - [x] `npm run validate:android` script exists
  - [x] `npm run pre-deploy` runs all validation steps in sequence

---

### Issue #3: Content Release Schedule Ambiguity
- **Priority:** 🟠 HIGH
- **Status:** ✅ RESOLVED 2026-05-05
- **Effort:** 4 hours
- **Risk:** Medium (affects UX)
- **Files:** CRITICAL_LOGIC_ISSUES.md, docs/PERSONALIZED_CONTENT_MODEL.md, WeeklyContentSetService.js
- **Root Cause:** The release schedule needed one documented personal-week anchor.
- **Resolution:** The schedule is cumulative and anchored to signup for free users and premium start for premium users.
- **Acceptance Criteria:**
  - [x] Document defines when free users transition from week 0 to week 1+
  - [x] Free rotations are cumulative
  - [x] Premium rotations are cumulative from premium start
  - [x] Test cases cover release schedule transitions
  - [x] Release schedule behavior matches product requirements

---

### Issue #4: Weak Error Recovery in Offline Queue Flush
- **Priority:** 🟠 HIGH
- **Status:** ✅ RESOLVED 2026-05-05
- **Effort:** 1-2 hours
- **Risk:** Low
- **Files:** SupabaseDataLayer.js (lines 2015-2100)
- **Root Cause:** Non-offline errors could be retried without clear reporting/status.
- **Resolution:** Queue flush failures now remain in the queue with attempt counts and last-error metadata, report through CrashReporting, and surface via `DataContext.syncStatus` / `OfflineIndicator`.
- **Acceptance Criteria:**
  - [x] All non-offline errors reported to Sentry/CrashReporting
  - [x] User sees sync warning via OfflineIndicator
  - [x] Queue items retry on next sync attempt until max attempts
  - [x] Test case verifies failed items are retained and reported

---

### Issue #5: Unsafe Offline Queue Persistence
- **Priority:** 🟠 HIGH
- **Status:** ✅ RESOLVED 2026-05-05
- **Effort:** 2-3 hours
- **Risk:** Medium (complex state machine)
- **Files:** SupabaseDataLayer.js, PolishEngine.js
- **Root Cause:** AsyncStorage queue replay needed explicit in-flight and idempotent replay semantics.
- **Resolution:** Queue items are normalized, marked `in_flight` before network writes, stale in-flight items recover to pending, queued inserts replay through upserts, queued deletes tolerate already-deleted rows, and calendar replay avoids public APIs that can enqueue duplicates.
- **Acceptance Criteria:**
  - [x] Queue items marked as "in-flight" before network attempt
  - [x] Only removed from AsyncStorage after successful Supabase write
  - [x] Idempotent replay prevents duplicate inserts after crash recovery
  - [x] Test case verifies stale in-flight recovery

---

## High-Priority Issues (🟡 Should Fix in v1.1)

### Issue #6: Coverage Verification
- **Priority:** 🟡 HIGH
- **Status:** ❌ OPEN
- **Effort:** 4 hours
- **Risk:** Low
- **Files:** package.json, jest.config.cjs
- **Root Cause:** Jest now has an npm script, but coverage thresholds and offline queue integration coverage are not yet enforced.
- **Impact:** CI can run tests, but production readiness still lacks a coverage baseline for the highest-risk offline queue paths.
- **Recommendation:** 
  - Set coverage threshold to 60%+ for new code
  - Add integration tests for offline queue
- **Acceptance Criteria:**
  - [x] `npm test` script exists
  - [ ] Coverage report shows ≥50% overall (jest minimum)
  - [x] Integration tests for offline queue pass
  - [x] pre-deploy includes test step

---

### Issue #7: Incomplete Sentry/CrashReporting Breadcrumbs
- **Priority:** 🟡 MEDIUM-HIGH
- **Status:** ❌ OPEN
- **Effort:** 2-3 hours
- **Risk:** Low
- **Files:** CrashReporting.js, services/
- **Root Cause:** Missing breadcrumbs for user actions before crash
- **Impact:** Harder to diagnose crashes in production
- **Recommendation:** Add breadcrumbs for:
  - Content loading/filtering
  - Offline mutations
  - Premium feature access
  - Partner sync events
- **Acceptance Criteria:**
  - [ ] Sentry crashes include action breadcrumbs
  - [ ] Can trace user flow up to crash point
  - [ ] No sensitive data in breadcrumbs

---

### Issue #8: RevenueCat Integration Gaps
- **Priority:** 🟡 MEDIUM-HIGH
- **Status:** ✅ RESOLVED 2026-05-05
- **Effort:** 2-3 hours
- **Risk:** Medium
- **Files:** SubscriptionContext.js, RevenueCatService.js, App.js
- **Root Cause:** RevenueCat startup and customer-info requests needed timeout guards.
- **Resolution:** RevenueCat init, identify, offerings, and customer-info reads now use 5s timeout guards. Offerings timeout falls back to free mode, subscription status falls back to non-premium, and timeouts are reported to CrashReporting.
- **Acceptance Criteria:**
  - [x] RevenueCat init has 5s timeout
  - [x] App continues if RevenueCat timeout occurs
  - [x] Premium status defaults to false if unavailable
  - [x] Error reported to Sentry/CrashReporting

---

### Issue #9: Deep Link Validation Missing
- **Priority:** 🟡 MEDIUM
- **Status:** ✅ RESOLVED 2026-05-05
- **Effort:** 2 hours
- **Risk:** Low
- **Files:** App.js, navigation/
- **Root Cause:** URL and notification routes did not consistently reject malformed ID parameters.
- **Resolution:** DeepLinkHandler now validates required IDs, rejects extra path segments, supports current route aliases, and passes auth callback URLs through safely. App-level React Navigation linking rejects malformed prompt/date paths before state creation.
- **Acceptance Criteria:**
  - [x] Required deep link parameters validated
  - [x] Invalid links logged to Sentry/CrashReporting
  - [x] Invalid links are refused instead of navigating with null/unsafe params

---

### Issue #10: Android Validation Missing from pre-deploy
- **Priority:** 🟡 MEDIUM
- **Status:** ✅ RESOLVED 2026-05-05
- **Effort:** <30 minutes
- **Risk:** Minimal
- **Files:** package.json
- **Root Cause:** pre-deploy only validates iOS; Android not tested
- **Resolution:** Added `validate:android` and included it in `pre-deploy`.
- **Acceptance Criteria:**
  - [x] `npm run validate:android` script exists
  - [x] pre-deploy includes Android validation

---

## Low-Priority Issues (🟢 Nice to Have)

### Issue #11: Update Dependencies
- **Priority:** 🟢 LOW
- **Status:** ℹ️ OPTIONAL
- **Effort:** 1 hour
- **Risk:** Low
- **Recommendation:** Update to latest stable versions
  - react-native: 0.81.5 → 0.82.x
  - @sentry/react-native: ~7.2.0 → ~7.20.x
- **Acceptance Criteria:**
  - [ ] No breaking changes in new versions
  - [ ] Tests pass with new versions
  - [ ] No new vulnerabilities reported

---

### Issue #12: Add Performance Monitoring
- **Priority:** 🟢 LOW
- **Status:** ℹ️ OPTIONAL
- **Effort:** 4-6 hours
- **Risk:** Low
- **Recommendation:** Add Sentry Performance Monitoring
- **Acceptance Criteria:**
  - [ ] Track startup time
  - [ ] Monitor API response times
  - [ ] Profile memory usage on older devices

---

## Summary Table

| Issue | Priority | Status | Effort | Blocker |
|-------|----------|--------|--------|---------|
| #1: Double Filtering | 🔴 CRITICAL | RESOLVED | 2-3h | ✅ YES |
| #2: Missing Scripts | 🔴 CRITICAL | RESOLVED | <30m | ✅ YES |
| #3: Release Schedule | 🟠 HIGH | RESOLVED | 4h | ⚠️ YES |
| #4: Error Recovery | 🟠 HIGH | RESOLVED | 1-2h | ⚠️ YES |
| #5: Queue Persistence | 🟠 HIGH | RESOLVED | 2-3h | ⚠️ YES |
| #6: Coverage Verification | 🟡 MEDIUM-HIGH | OPEN | 4h | ℹ️ NO |
| #7: Sentry Breadcrumbs | 🟡 MEDIUM-HIGH | OPEN | 2-3h | ℹ️ NO |
| #8: RevenueCat Timeout | 🟡 MEDIUM-HIGH | RESOLVED | 2-3h | ℹ️ NO |
| #9: Deep Link Validation | 🟡 MEDIUM | RESOLVED | 2h | ℹ️ NO |
| #10: Android Validation | 🟡 MEDIUM | RESOLVED | <30m | ℹ️ NO |
| #11: Update Dependencies | 🟢 LOW | OPTIONAL | 1h | ℹ️ NO |
| #12: Performance Monitor | 🟢 LOW | OPTIONAL | 4-6h | ℹ️ NO |

**Remaining Critical/High Effort:** no open critical blockers in this tracker; coverage thresholding and expanded breadcrumbs remain quality follow-ups.  
**Resolved in this tracker:** content release conflict, release schedule ambiguity, missing scripts, Android validation, offline queue recovery/persistence, RevenueCat timeout handling, deep link validation.

---

## Recommended Fix Order

### Remaining Quality Follow-Ups
1. **Issue #6** - Add coverage thresholding if CI needs a hard coverage gate.
2. **Issue #7** - Add broader Sentry breadcrumbs for more user flows.
3. **Full QA** - Exercise purchase, auth callback, offline replay, and partner-linking flows on physical iOS/Android devices.

---

## Success Criteria for Production Release

### Must Have ✅
- [x] Remaining critical blockers (#4-5) resolved
- [ ] Both iOS and Android builds successful
- [ ] No crashes on test accounts (Sentry clean for 24h)
- [ ] Premium/free boundary verified working
- [x] Offline queue tested with network failures
- [ ] Deep link routing verified
- [ ] Startup time < 3 seconds on iPhone 12/Pixel 6

### Should Have ✅
- [ ] Test suite passes with >60% coverage
- [ ] No high/critical security findings
- [ ] Sentry has comprehensive breadcrumbs
- [x] Android validation added

### Nice to Have ✅
- [ ] Dependencies updated
- [ ] Performance monitoring enabled
- [ ] E2E test suite for critical flows

---

**Last Updated:** May 5, 2026  
**Audit Status:** Production still needs offline queue fixes and QA. Content-release and script blockers are resolved.  
**Estimated Release Date:** After remaining offline queue fixes and platform QA.
