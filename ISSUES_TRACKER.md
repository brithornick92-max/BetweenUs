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
- **Status:** ❌ OPEN
- **Effort:** <30 minutes
- **Risk:** Minimal
- **Files:** package.json
- **Root Cause:** `npm run pre-deploy` references non-existent scripts (`test`, `validate:ios`)
- **Impact:** CI/CD pipeline will fail; cannot build releases
- **Recommendation:** Add missing scripts:
  ```json
  "test": "jest --passWithNoTests",
  "validate:ios": "expo run:ios --configuration Release",
  "validate:android": "expo run:android --configuration Release"
  ```
- **Acceptance Criteria:**
  - [ ] `npm run test` completes without error
  - [ ] `npm run validate:ios` completes without error
  - [ ] `npm run pre-deploy` runs all steps in sequence
  - [ ] CI/CD pipeline can execute pre-deploy

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
- **Status:** ❌ OPEN
- **Effort:** 1-2 hours
- **Risk:** Low
- **Files:** SupabaseDataLayer.js (lines 2015-2100)
- **Root Cause:** Non-offline errors silently swallowed in offline queue flush
- **Impact:** Offline mutations silently lost; users lose data without notification
- **Recommendation:** Add error reporting and user notification for non-recoverable errors
- **Acceptance Criteria:**
  - [ ] All non-offline errors reported to Sentry
  - [ ] User sees toast notification for queue flush failures
  - [ ] Queue items retry on next sync attempt
  - [ ] Production logs show no silent failures

---

### Issue #5: Unsafe Offline Queue Persistence
- **Priority:** 🟠 HIGH
- **Status:** ❌ OPEN
- **Effort:** 2-3 hours
- **Risk:** Medium (complex state machine)
- **Files:** SupabaseDataLayer.js, PolishEngine.js
- **Root Cause:** No transaction semantics for AsyncStorage queue; app crash during flush causes duplicates
- **Impact:** Data corruption (duplicate records) if app crashes during queue flush
- **Recommendation:** Implement atomic queue updates with in-flight markers
- **Acceptance Criteria:**
  - [ ] Queue items marked as "in-flight" before network attempt
  - [ ] Only removed from AsyncStorage after successful Supabase write AND local write-back
  - [ ] No duplicates created if app crashes mid-flush
  - [ ] Test case verifies crash recovery

---

## High-Priority Issues (🟡 Should Fix in v1.1)

### Issue #6: Missing Test Script & Coverage Verification
- **Priority:** 🟡 HIGH
- **Status:** ❌ OPEN
- **Effort:** 4 hours
- **Risk:** Low
- **Files:** package.json, jest.config.cjs
- **Root Cause:** Jest configured but test script undefined; unknown coverage
- **Impact:** Cannot verify code quality in CI/CD; no baseline coverage
- **Recommendation:** 
  - Add `test` script to package.json
  - Set coverage threshold to 60%+ for new code
  - Add integration tests for offline queue
- **Acceptance Criteria:**
  - [ ] `npm test` runs all test suites
  - [ ] Coverage report shows ≥50% overall (jest minimum)
  - [ ] Integration tests for offline queue pass
  - [ ] pre-deploy includes test step

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
- **Status:** ❌ OPEN
- **Effort:** 2-3 hours
- **Risk:** Medium
- **Files:** SubscriptionContext.js, RevenueCatService.js, App.js
- **Root Cause:** No timeout handling; startup can block on RevenueCat requests
- **Impact:** Slow/frozen app if RevenueCat service is down
- **Recommendation:** Add timeout shield and graceful fallback
- **Acceptance Criteria:**
  - [ ] RevenueCat init has 5s timeout
  - [ ] App continues if RevenueCat timeout occurs
  - [ ] Premium status defaults to false if unavailable
  - [ ] Error reported to Sentry

---

### Issue #9: Deep Link Validation Missing
- **Priority:** 🟡 MEDIUM
- **Status:** ❌ OPEN
- **Effort:** 2 hours
- **Risk:** Low
- **Files:** App.js, navigation/
- **Root Cause:** No parameter validation for deep links
- **Impact:** Could navigate to invalid screens with malformed parameters
- **Recommendation:** Add schema validation before routing
- **Acceptance Criteria:**
  - [ ] All deep link parameters validated
  - [ ] Invalid links logged to Sentry
  - [ ] User sees error screen instead of crash

---

### Issue #10: Android Validation Missing from pre-deploy
- **Priority:** 🟡 MEDIUM
- **Status:** ❌ OPEN
- **Effort:** <30 minutes
- **Risk:** Minimal
- **Files:** package.json
- **Root Cause:** pre-deploy only validates iOS; Android not tested
- **Impact:** Android build could fail on release
- **Recommendation:** Add validate:android script
- **Acceptance Criteria:**
  - [ ] `npm run validate:android` completes without error
  - [ ] pre-deploy includes Android validation

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
| #1: Double Filtering | 🔴 CRITICAL | OPEN | 2-3h | ✅ YES |
| #2: Missing Scripts | 🔴 CRITICAL | OPEN | <30m | ✅ YES |
| #3: Release Schedule | 🟠 HIGH | OPEN | 4h | ⚠️ YES |
| #4: Error Recovery | 🟠 HIGH | OPEN | 1-2h | ⚠️ YES |
| #5: Queue Persistence | 🟠 HIGH | OPEN | 2-3h | ⚠️ YES |
| #6: Test Coverage | 🟡 MEDIUM-HIGH | OPEN | 4h | ℹ️ NO |
| #7: Sentry Breadcrumbs | 🟡 MEDIUM-HIGH | OPEN | 2-3h | ℹ️ NO |
| #8: RevenueCat Timeout | 🟡 MEDIUM-HIGH | OPEN | 2-3h | ℹ️ NO |
| #9: Deep Link Validation | 🟡 MEDIUM | OPEN | 2h | ℹ️ NO |
| #10: Android Validation | 🟡 MEDIUM | OPEN | <30m | ℹ️ NO |
| #11: Update Dependencies | 🟢 LOW | OPTIONAL | 1h | ℹ️ NO |
| #12: Performance Monitor | 🟢 LOW | OPTIONAL | 4-6h | ℹ️ NO |

**Total Critical Effort:** ~10-12 hours  
**Total High-Priority Effort:** ~20-25 hours  
**Total for Production Ready:** ~30-37 hours (4-5 days for 1 engineer)

---

## Recommended Fix Order

### Week 1: Critical Blockers
1. **Issue #2** (30m) - Add missing npm scripts — unblocks all other testing
2. **Issue #1** (2-3h) - Resolve double filtering — affects user experience
3. **Issue #3** (2h) - Document content release schedule clearly
4. **Issue #4** (1-2h) - Add error reporting for offline failures
5. **Issue #5** (2-3h) - Implement atomic queue persistence

### Week 2: High-Priority Quality
1. **Issue #6** (2-3h) - Set up test suite and coverage verification
2. **Issue #8** (1-2h) - Add RevenueCat timeout handling
3. **Issue #7** (1-2h) - Enhance Sentry breadcrumbs

### Week 3: Final Polish
1. **Issue #9** (1-2h) - Add deep link validation
2. **Issue #10** (15m) - Add Android validation
3. **Full QA** (2-3 days) - Comprehensive testing on both platforms

---

## Success Criteria for Production Release

### Must Have ✅
- [ ] All critical blockers (#1-5) resolved
- [ ] Both iOS and Android builds successful
- [ ] No crashes on test accounts (Sentry clean for 24h)
- [ ] Premium/free boundary verified working
- [ ] Offline queue tested with network failures
- [ ] Deep link routing verified
- [ ] Startup time < 3 seconds on iPhone 12/Pixel 6

### Should Have ✅
- [ ] Test suite passes with >60% coverage
- [ ] No high/critical security findings
- [ ] Sentry has comprehensive breadcrumbs
- [ ] Android validation added

### Nice to Have ✅
- [ ] Dependencies updated
- [ ] Performance monitoring enabled
- [ ] E2E test suite for critical flows

---

**Last Updated:** April 28, 2026  
**Audit Status:** Production NOT Ready (5 critical issues)  
**Estimated Release Date:** May 5-7, 2026 (after fixes)
