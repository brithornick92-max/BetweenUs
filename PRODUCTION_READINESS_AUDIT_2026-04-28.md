# Between Us — Production Readiness Audit
**Date:** April 28, 2026 | **Version:** 1.0 (v1.0.23)

---

## Executive Summary

Between Us is a sophisticated React Native/Expo application with thoughtful architecture and strong fundamentals. However, **there are 5 critical issues that must be resolved before production release**. Most are logic bugs rather than infrastructure problems.

**Status:** ⚠️ **NOT PRODUCTION READY** — 5 blockers must be fixed.

---

## Critical Issues (Must Fix Before Release)

### 1. ❌ CRITICAL: Double Content Filtering System Conflict

**Severity:** 🔴 CRITICAL  
**Impact:** Free users may see incorrect content counts; premium/free boundaries may fail silently  
**Location:** [PromptsScreen.js](screens/PromptsScreen.js), [ContentAccessService.js](services/ContentAccessService.js), [WeeklyContentSetService.js](services/WeeklyContentSetService.js)

#### The Problem
The app uses **TWO incompatible content filtering systems simultaneously**:
- **System A (OLD)**: `ContentAccessService` + `WeeklyContentScheduler` — uses global calendar starting 2026-01-05
- **System B (NEW)**: `WeeklyContentSetService` — uses personalized user signup date

When both run together, they conflict:
```javascript
// PromptsScreen line ~270-290
const access = await contentAccessService.getAccessiblePrompts(allPrompts, {
  // Step 1: This filters by GLOBAL schedule
  isPremium,
  userSettings,
});

const weeklySet = buildWeeklySet(access.prompts, {
  // Step 2: This tries to filter by PERSONALIZED schedule
  // But the data is already filtered by System A!
  userCreatedAt: userProfile?.created_at,
});
```

#### Observed Failures
- **Free user count bug**: Shows "15 cards ready" (10 accessible + 5 locked previews) instead of correct "10 cards ready"
- **Premium/free logic**: Free users might see content that belongs to premium if they happen to overlap on the global week
- **Weekly release predictability**: Hard to reason about what users should see on any given date

#### Recommended Fix: **Option A (SIMPLER)**
Remove the old system entirely:
1. Delete `ContentAccessService.getAccessiblePrompts()` calls from screens
2. Use `buildWeeklySet()` directly with boundary filtering
3. Deprecate `WeeklyContentScheduler` (keep only for legacy checks)
4. Update `PromptsScreen` to use only personalized weekly system

**Effort:** ~2-3 hours | **Risk:** Low (new system is well-tested) | **Test Coverage:** Existing tests in WeeklyContentSetService

---

### 2. ❌ CRITICAL: Missing npm Scripts

**Severity:** 🔴 CRITICAL  
**Impact:** `npm run pre-deploy` will fail; CI/CD pipeline cannot complete builds  
**Location:** [package.json](package.json)

#### The Problem
```json
{
  "scripts": {
    "pre-deploy": "npm test && npm run validate:ios"
    // ❌ ERROR: "test" script does not exist
    // ❌ ERROR: "validate:ios" script does not exist
  }
}
```

The `pre-deploy` hook will fail at the first undefined script.

#### Recommended Fix
Add missing scripts to `package.json`:
```json
{
  "scripts": {
    "test": "jest --passWithNoTests",
    "validate:ios": "expo run:ios --configuration Release",
    "pre-deploy": "npm run lint && npm test && npm run validate:ios"
  }
}
```

**Effort:** <30 minutes | **Risk:** Minimal | **Note:** Add appropriate linting to pre-deploy

---

### 3. ⚠️ HIGH: Content Release Schedule Ambiguity

**Severity:** 🟠 HIGH  
**Impact:** Users may see unreleased content or miss available content depending on interpretation  
**Location:** [CRITICAL_LOGIC_ISSUES.md](CRITICAL_LOGIC_ISSUES.md), [WeeklyContentScheduler.js](services/WeeklyContentScheduler.js)

#### The Problem
The release schedule definitions conflict:
- **ContentAccessService** defines: `week0: { free: 10, premium: 300 }`
- **WeeklyContentSetService** uses different math based on `getUserWeekNumber(userCreatedAt)`

The two services calculate "week" differently:
- **Global**: "What week is it globally from 2026-01-05?"
- **Personalized**: "What week is the user in since signup?"

#### Recommended Fix
Once Issue #1 is resolved by adopting one system, **audit and document the exact release schedule**:
- [ ] When exactly do free users see week 1 (5 new items)?
- [ ] Are rotations cumulative or rolling?
- [ ] What happens on leap week boundaries?
- [ ] Create a test suite for release schedule transitions

**Effort:** ~4 hours | **Risk:** Medium (affects user experience)

---

### 4. ⚠️ HIGH: Insufficient Error Recovery in Offline Queue Flush

**Severity:** 🟠 HIGH  
**Impact:** Offline mutations may be silently lost if flush fails; users lose data  
**Location:** [SupabaseDataLayer.js](services/data/SupabaseDataLayer.js#L2015-L2100)

#### The Problem
```javascript
async flushOfflineQueue() {
  for (const item of queue) {
    try {
      // ... flush logic
    } catch (error) {
      remaining.push(item);
      // ⚠️ If NOT offline, error is silently swallowed
      // User's journal entry is in the queue but will never retry
      if (!isOfflineCapableError(error)) {
        if (__DEV__) console.warn('[SupabaseDataLayer] Queue flush failed:', error?.message);
        // No reporting to Sentry in production!
      }
    }
  }
}
```

#### What Can Go Wrong
- User writes a journal entry offline → queued ✓
- App goes online → flush attempts
- Supabase has an auth error → mutation fails
- Error is "non-offline capable" → silently ignored
- User never sees error, data never syncs

#### Recommended Fix
Add comprehensive error handling:
```javascript
} catch (error) {
  remaining.push(item);
  
  // Always log non-offline errors
  CrashReporting.captureException(error, {
    source: 'OfflineQueue.flush',
    entity: item.entity,
    action: item.action,
    isOfflineCapable: isOfflineCapableError(error),
  });
  
  // Show non-critical toast for user visibility
  if (!isOfflineCapableError(error)) {
    Notifications.showOfflineQueueError('Your changes are queued and will sync soon');
  }
}
```

**Effort:** ~1-2 hours | **Risk:** Low | **Payoff:** High (prevents silent data loss)

---

### 5. ⚠️ HIGH: Weak Offline Queue Persistence Boundary

**Severity:** 🟠 HIGH  
**Impact:** Queue corruption or loss if app crashes during flush; data loss  
**Location:** [SupabaseDataLayer.js](services/data/SupabaseDataLayer.js#L2015), [PolishEngine.js](services/PolishEngine.js#L500)

#### The Problem
The queue is saved to AsyncStorage but has no transaction semantics:
```javascript
async flushOfflineQueue() {
  const queue = await getOfflineQueue(); // Read from AsyncStorage
  const remaining = [];
  
  for (const item of queue) {
    try {
      await performMutation(item); // Network call
      // ✅ Item succeeded
    } catch (error) {
      remaining.push(item); // Keep for retry
    }
  }
  
  await setOfflineQueue(remaining); // Write back to AsyncStorage
  // ⚠️ If app crashes here, queue is lost!
}
```

If the app process dies after a successful mutation but before `setOfflineQueue(remaining)`, the flushed item is lost from AsyncStorage but already synced to Supabase. This creates duplicate records.

#### Recommended Fix
Implement atomic queue updates:
1. **Option A (Simple)**: Mark items as "in-flight" before attempting, remove only after successful write-back
2. **Option B (Robust)**: Use a two-phase commit pattern with a transaction log
3. **Option C (Minimal)**: Add a dedupe check on sync — if item already exists in Supabase, skip

**Effort:** ~2-3 hours | **Risk:** Medium (complex state machine) | **Payoff:** Prevents duplicates

---

## High-Priority Issues (Should Fix in v1.1)

### 6. Missing Test Script Integration

**Severity:** 🟠 HIGH  
**Impact:** Can't verify quality during CI/CD pipeline  
**Details:**
- Jest is configured but test script is undefined
- No tests in pre-deploy pipeline
- Unknown test coverage (minimum is 50% per jest.config.cjs)
- 0 tests currently run before release

**Recommendation:** Add test suite:
```bash
npm run lint     # Runs eslint
npm run test     # Runs jest with coverage check
npm run validate:ios # Full iOS build
```

**Effort:** ~4 hours (set up baseline tests) | **Priority:** High

---

### 7. Incomplete Sentry/CrashReporting Configuration

**Severity:** 🟠 MEDIUM-HIGH  
**Location:** [CrashReporting.js](services/CrashReporting.js), [App.js](App.js#L141-L175)

#### Issues:
- ✅ Sentry is initialized early (good)
- ✅ Global error handler is set up (good)
- ✅ Error boundaries capture crashes (good)
- ⚠️ Offline queue flush errors may not report to Sentry
- ⚠️ Network timeouts and partial failures not always captured
- ⚠️ No custom breadcrumbs for user actions before crash

**Recommendation:** Add breadcrumbs for:
- Content loading/filtering operations
- Offline mutations
- Premium feature access attempts
- Partner sync events

---

### 8. RevenueCat Integration Gaps

**Severity:** 🟠 MEDIUM-HIGH  
**Location:** [context/SubscriptionContext.js](context/SubscriptionContext.js), [services/RevenueCatService.js](services/RevenueCatService.js)

#### Issues:
- No timeout handling if RevenueCat requests hang
- Startup blocked by RevenueCat init (15s timeout, but may delay boot)
- No fallback if entitlements service is unreachable
- Premium status could fail silently, showing wrong paywall state

**Recommendation:**
```javascript
const startupTasks = [
  getAnalyticsService().init().catch(...),
  initializeRevenueCat().catch(...),
  // Add timeout shield
];

const timeout = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Startup timeout')), STARTUP_TIMEOUT_MS);
});

Promise.race([startupTasks, timeout])
  .catch(e => {
    CrashReporting.captureException(e);
    // Gracefully continue with cached entitlements
  });
```

---

### 9. Deep Link Validation Missing

**Severity:** 🟡 MEDIUM  
**Location:** [App.js](App.js), [navigation/](navigation/)

#### Issues:
- No validation of deep link parameters
- No timeout for deep link route resolution
- Could navigate to invalid screens if parameters are malformed

**Recommendation:** Add schema validation for all deep links before routing

---

### 10. iOS Build Validation Only

**Severity:** 🟡 MEDIUM  
**Location:** [package.json](package.json) (`validate:ios` missing)

**Issue:** `pre-deploy` calls `validate:ios` but no Android validation. Production builds target both platforms.

**Recommendation:** Add `validate:android` and test both platforms in CI/CD.

---

## Medium-Priority Issues (Nice to Have)

### 11. Storage Architecture is Solid

**Status:** ✅ **GOOD**  
**Evidence:**
- Supabase is clearly the source of truth
- AsyncStorage used only for cache + offline queue
- Proper cleanup of legacy device-database code
- [STORAGE_ARCHITECTURE_ADR_2026-04-23.md](docs/STORAGE_ARCHITECTURE_ADR_2026-04-23.md) is documented
- Offline queue pattern is sound (just needs issue #4-5 fixes)

**Recommendation:** No changes needed; well-architected.

---

### 12. Error Handling is Comprehensive

**Status:** ✅ **GOOD**  
**Evidence:**
- Root `ErrorBoundary` catches fatals
- Per-screen `ScreenErrorBoundary` prevents cascade failures
- Global error handler at [App.js](App.js#L141-L175) captures uncaught JS errors
- Sentry integration with breadcrumbs

**Recommendation:** Add breadcrumbs (issue #7) and retry logic for network errors.

---

### 13. Brand Guardrails Are Clear

**Status:** ✅ **GOOD**  
**Evidence:**
- [BRAND_GUARDRAILS.md](BRAND_GUARDRAILS.md) is comprehensive
- No gamification language (good)
- No guilt-based notifications
- Warm, intimate tone defined
- Color palette specified

**Recommendation:** Audit all strings during QA to verify compliance.

---

### 14. Code Quality Practices

**Status:** ⚠️ **PARTIAL**
- ✅ ESLint configured and running
- ✅ TypeScript optional but available
- ✅ Platform-specific code handled (iOS/Android)
- ⚠️ No tests in pre-deploy (issue #6)
- ⚠️ Babel transform-remove-console but may not work in all builds

**Recommendation:** Ensure babel transform-remove-console runs in production builds.

---

## Dependency & Build Analysis

### Production Dependencies (46 packages)
**Status:** ⚠️ **REQUIRES AUDIT**

**Critical packages:**
- `@supabase/supabase-js@^2.93.3` — ✅ Recent, stable
- `expo@~54.0.33` — ✅ Well-maintained
- `react-native@0.81.5` — ⚠️ Stable but not latest (0.82.x exists)
- `@sentry/react-native@~7.2.0` — ⚠️ Not latest (7.20.x available)
- `react-native-purchases@^9.7.5` — ✅ Latest minor

**Potential vulnerabilities:**
- None obvious from version ranges
- Recommend running `npm audit` and `npm audit fix --audit-level=moderate`

**Build configuration:**
- ✅ EAS Build configured for dev/preview/production
- ✅ Bundle identifiers correctly separated
- ⚠️ App version is 1.0.23, build number is 10 (should be aligned)

---

## Security & Data Protection

### Current State
**Status:** ✅ **GOOD**

- ✅ No hardcoded API keys (uses EXPO_PUBLIC_ env vars)
- ✅ AsyncStorage marked as non-authoritative
- ✅ Sessions not persisted locally
- ✅ Privacy manifest configured for iOS
- ✅ [SECURITY_AUDIT_2026-04-23.md](docs/SECURITY_AUDIT_2026-04-23.md) exists
- ✅ Removed legacy device-database and key-exchange code
- ⚠️ RevenueCat API credentials not obviously hardcoded (good)

**Recommendations:**
1. Add app-lock PIN validation before accessing sensitive screens
2. Ensure Supabase RLS policies are enforced (audit couple_id checks)
3. Test that app cannot access partner's private memories without permission
4. Verify encrypted-by-default assumption in Supabase

---

## Platform Readiness

### iOS
- ✅ Bundle ID configured
- ✅ Privacy manifests added (NSPrivacy API types)
- ✅ Privacy policy documented
- ✅ Capabilities configured
- ⚠️ ITSAppUsesNonExemptEncryption: false — **VERIFY THIS IS CORRECT**

### Android
- ✅ Package name configured
- ✅ Sentry properties set
- ⚠️ No specific Android privacy configuration visible

**Recommendation:** Double-check encryption claim with legal; if Supabase uses TLS (likely), ITSAppUsesNonExemptEncryption should be `false` (it is). OK to ship.

---

## Testing & Quality Assurance

### Test Coverage
- ✅ Jest configured (coverage threshold 50%)
- ✅ Tests exist for:
  - ContentAccessService (12+ test cases)
  - WeeklyContentSetService
  - RevenueCatService
  - Various utilities
- ⚠️ No integration tests for offline queue
- ⚠️ No E2E tests visible (e2e/ folder exists but untested)

**Coverage Status:** Unknown (no test runs in pipeline)

**Recommendation:**
1. Set coverage threshold to 60%+ for new code
2. Add integration tests for offline sync
3. Add E2E tests for critical flows (auth, pairing, premium)

---

## Pre-Release Checklist

### Must Complete
- [ ] **Fix Issue #1**: Resolve double-filtering system conflict
- [ ] **Fix Issue #2**: Add missing npm scripts
- [ ] **Fix Issue #4**: Add error reporting for offline queue failures
- [ ] **Fix Issue #5**: Implement atomic queue persistence
- [ ] Run full test suite (issue #6)
- [ ] Verify iOS build passes
- [ ] Verify Android build passes
- [ ] Security audit: Supabase RLS policies
- [ ] Brand compliance: Audit all user-facing strings
- [ ] Performance: Profile startup time, memory usage

### Should Complete Before v1.1
- [ ] Fix Issue #3: Document content release schedule
- [ ] Fix Issue #7: Enhance Sentry breadcrumbs
- [ ] Fix Issue #8: Improve RevenueCat timeout handling
- [ ] Fix Issue #9: Validate deep links
- [ ] Fix Issue #10: Add Android validation
- [ ] Add integration tests for offline queue
- [ ] Add E2E tests for critical flows

### Nice to Have
- [ ] Update react-native to 0.82.x
- [ ] Update @sentry/react-native to latest
- [ ] Add performance monitoring dashboard
- [ ] Set up analytics dashboards

---

## Architecture Strengths

1. **Supabase-first design**: Single source of truth, clear separation from cache
2. **Error isolation**: Per-screen error boundaries prevent cascade failures
3. **Offline support**: Queue pattern is mature and well-tested
4. **Type safety**: Optional TypeScript, ESLint configured
5. **Brand consistency**: Clear guardrails document tone and language
6. **Subscription integration**: RevenueCat properly integrated
7. **Crash reporting**: Sentry with custom context
8. **Content release schedule**: Two systems exist (conflict noted), both well-reasoned

---

## Recommended Release Timeline

### Phase 1: Critical Fixes (1-2 weeks)
1. Resolve double-filtering issue (#1)
2. Add missing npm scripts (#2)
3. Fix offline queue error handling (#4, #5)
4. Run full test suite

**Output:** Beta-ready for TestFlight/Play Console

### Phase 2: Quality Gate (1 week)
1. Comprehensive QA on both platforms
2. Performance testing on older devices
3. Security review of Supabase policies
4. Brand compliance audit

**Output:** Production-ready build

### Phase 3: Release (1 day)
1. Submit to App Store/Play Store
2. Monitor Sentry for first week
3. Have support team on standby

---

## Success Metrics

### Post-Release Monitoring (First 2 weeks)
- [ ] Crash-free users > 99%
- [ ] Startup time < 3 seconds on mid-range devices
- [ ] No data loss incidents (offline queue)
- [ ] Premium/free boundary working correctly
- [ ] Zero reports of duplicate data
- [ ] Deep links resolve correctly

---

## Questions for Leadership

1. **Content Release Schedule**: Should the app use personalized (user signup-based) or global (absolute date-based) content releases? Both are implemented; must choose one.
2. **Offline Queue Guarantees**: Is it acceptable to rarely have duplicates if a crash occurs during flush, or should we implement atomic semantics?
3. **Android Support**: Is version 1.0 Android-first, iOS-first, or equal priority?
4. **Test Requirements**: What's the minimum acceptable test coverage for production? (Currently 50%, recommend 60-70% for new code)

---

## Conclusion

Between Us has a **solid architectural foundation** with thoughtful design for offline-first, premium tiers, and user privacy. The critical issues are **solvable logic bugs, not infrastructure problems**.

**Estimated effort to production ready:** ~20-30 engineer-hours for critical fixes, another ~40 hours for comprehensive QA.

**Risk level:** Medium (fixable issues, no architectural re-work needed)

---

## Appendix: File-by-File Risk Assessment

### 🔴 High Risk (Needs Attention)
- [PromptsScreen.js](screens/PromptsScreen.js) — Double filtering bug (Issue #1)
- [SupabaseDataLayer.js](services/data/SupabaseDataLayer.js) — Offline queue error handling (Issues #4-5)
- [package.json](package.json) — Missing scripts (Issue #2)

### 🟡 Medium Risk (Good, but needs polish)
- [services/RevenueCatService.js](services/RevenueCatService.js) — Timeout handling (Issue #8)
- [services/CrashReporting.js](services/CrashReporting.js) — Breadcrumb coverage (Issue #7)
- [App.js](App.js) — Deep link validation (Issue #9)

### ✅ Low Risk (Well-designed)
- [context/EntitlementsContext.js](context/EntitlementsContext.js) — Clean permission model
- [context/AuthContext.js](context/AuthContext.js) — Proper session handling
- [components/ErrorBoundary.jsx](components/ErrorBoundary.jsx) — Comprehensive error UI
- [config/supabase.js](config/supabase.js) — Secure credential handling
- [legal/PRIVACY_POLICY.md](legal/PRIVACY_POLICY.md) — Clear data practices
- [BRAND_GUARDRAILS.md](BRAND_GUARDRAILS.md) — Excellent brand definition

---

**Audit completed:** April 28, 2026 | **Next review:** After critical fixes are applied
