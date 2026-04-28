# Critical Logic Issues Found

## Problem 1: Double Filtering & System Conflict

The app is using **TWO incompatible systems** simultaneously:

### System A: ContentAccessService (OLD - Global Monday Schedule)
- Uses `WeeklyContentScheduler.filterAvailable()` 
- Still based on global week numbers from "2026-01-05"
- Returns prompts that match the old Monday release schedule

### System B: WeeklyContentSetService (NEW - Personalized Schedule)
- Uses `getUserWeekNumber()` based on user signup date
- Creates personalized weekly sets
- But receives ALREADY FILTERED data from System A!

### The Bug:
```javascript
// Step 1: ContentAccessService filters by OLD global schedule
const access = await contentAccessService.getAccessiblePrompts(allPrompts, {
  // This applies WeeklyContentScheduler.filterAvailable()
  // which uses GLOBAL week numbers!
});

// Step 2: buildWeeklySet tries to use NEW personalized schedule
// But it's working with already-filtered prompts!
const weeklySet = buildWeeklySet(access.prompts, {
  userCreatedAt: userProfile?.created_at, // Personalized!
});
```

**Result**: Free/Premium users might see wrong numbers because the two systems conflict.

---

## Problem 2: WeeklyContentScheduler Still Uses Global Calendar

File: `services/WeeklyContentScheduler.js` (needs to be checked)

This service likely still has:
- Global `DEFAULT_WEEK_START = '2026-01-05'`
- `filterAvailable()` that uses global week calculation
- `isAvailable()` that doesn't know about personalized schedules

---

## Problem 3: Free vs Premium Logic Confusion

### Current Logic (WRONG):
```javascript
// PromptsScreen line 293-303
const loadPrompts = useCallback(async () => {
  // Get accessible prompts (respects release schedule)
  const access = await contentAccessService.getAccessiblePrompts(allPrompts, {
    userId: user?.uid,
    isPremium,
    userSettings: contentProfile || userProfile || {},
    // Missing: includeAll flag
  });
  
  // Then build weekly set from accessible prompts
  const weeklySet = buildWeeklySet(access.prompts, {
    // ...
  });
});
```

###What Actually Happens:

**For FREE users:**
1. `ContentAccessService` applies weekly limit → returns X prompts
2. `buildWeeklySet` takes those X prompts → selects 10 for welcome pack
3. `freeWeeklyPromptDeck` shows 10 unlocked + 5 locked = 15 total in deck
4. Count shows "15 cards ready" ❌ (Should show "10 cards ready")

**For PREMIUM users:**
1. `ContentAccessService` returns ALL released prompts (could be 300-400)
2. `buildWeeklySet` is ignored (not used for premium)
3. Premium deck shows all prompts from `access.prompts`
4. Count shows "~400 cards ready" ✅ (Correct IF ContentAccessService filters correctly)

---

## Problem 4: ContentAccessService RELEASE_SCHEDULE Mismatch

```javascript
// ContentAccessService.js
this.RELEASE_SCHEDULE = {
  prompts: {
    week0: { free: 10, premium: 300 },  // Correct
    perWeek: { free: 5, premium: 10 },  // Correct
  },
};
```

BUT this isn't being USED properly because:
- `filterByWeeklySchedule()` calls `WeeklyContentScheduler.filterAvailable()`
- Which doesn't know about these numbers
- It just filters by releaseWeek metadata on items

---

## The Correct Architecture Should Be:

### Option A: Use ONLY WeeklyContentSetService
```javascript
// Remove ContentAccessService weekly filtering
// Let buildWeeklySet handle everything

const allPrompts = ALL_BUNDLED.map(normalizePrompt);

// Apply boundaries only
const boundaryFiltered = applyUserBoundaries(allPrompts, userSettings);

// Let buildWeeklySet handle the weekly logic
const weeklySet = buildWeeklySet(boundaryFiltered, {
  userCreatedAt,
  isPremium,
  userId,
});

// For premium: weeklySet.unlocked has all their content
// For free: weeklySet.unlocked has 10 (week 0) or 5 (week 1+)
const deckPrompts = weeklySet.unlocked;
```

### Option B: Fix ContentAccessService to Use Personalized Schedule
```javascript
// Update ContentAccessService to accept userCreatedAt
// Update WeeklyContentScheduler to use personalized weeks
// Make both systems consistent
```

---

## Recommended Fix: **Option A**

**Why**: Simpler, cleaner, one source of truth

**Steps**:
1. Remove `Content AccessService.getAccessiblePrompts()` call from screens
2. Use `buildWeeklySet()` directly with user boundaries
3. Remove or deprecate `WeeklyContentScheduler` (conflicts with new model)
4. Simplify the logic to one personalized system

---

## What Needs to Change:

### 1. PromptsScreen.js
```javascript
const loadPrompts = useCallback(async () => {
  const allPrompts = ALL_BUNDLED.map(normalizePrompt);
  
  // Apply user boundaries first
  const filtered = await applyUserBoundariesAsync(allPrompts, {
    userSettings: contentProfile || userProfile,
    isPremium,
  });
  
  // Build personalized weekly set (handles both free and premium)
  const weeklySet = buildWeeklySet(filtered, {
    contentType: CONTENT_TYPES.PROMPTS,
    userId: user?.uid,
    isPremium,
    userSettings: contentProfile || userProfile || {},
    userCreatedAt: userProfile?.created_at || user?.metadata?.creationTime,
  });
  
  // For both free and premium, use unlocked items
  setDeckPrompts(weeklySet.unlocked);
}, [...]);
```

### 2. WeeklyContentSetService.js
Update to handle ALL content release logic internally:
- For free users: return 10 (week 0) or 5 (week 1+)
- For premium: return 300 (week 0), 310 (week 1), 320 (week 2), etc.
- No need for external filtering

### 3. Remove WeeklyContentScheduler.js
Or update it to work with personalized schedules, but simpler to remove it.

---

## Card Count Should Show:

**Free Users:**
- Week 0: "10 cards ready" (welcome pack)
- Week 1+: "10 cards ready" (5 new + 5 from welcome still accessible? Or just 5?)
  - **QUESTION**: Do free users get CUMULATIVE access or ROTATING access?

**Premium Users:**
- Week 0: "300 cards ready"
- Week 1: "310 cards ready"
- Week 10: "400 cards ready"
- Eventually: "792 cards ready"

---

## Action Items:

1. ✅ Clarify: Does free user's 10-card welcome pack stay accessible forever? Or rotates?
2. ⚠️ Fix double-filtering in PromptsScreen
3. ⚠️ Fix double-filtering in DateNightScreen
4. ⚠️ Remove or update WeeklyContentScheduler to use personalized weeks
5. ⚠️ Simplify to one content release system
6. ⚠️ Test free user experience: Week 0 vs Week 1+
7. ⚠️ Test premium user experience: Growing count over time
