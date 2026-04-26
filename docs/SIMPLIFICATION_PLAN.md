# App Simplification Plan

## Goal
Create a single "Our Story" screen that shows everything chronologically, and remove the following features:
1. ✅ Annual Recap / Year Reflection
2. ✅ "Send a Moment" / Thinking of You photo feature
3. ✅ "In the Mood For" / Relationship Climate picker
4. ✅ Monthly moment count in StreakBanner

## What to Remove

### 1. Year Reflection / Annual Recap
**Files to remove:**
- `screens/YearReflectionScreen.jsx` (or .js)
- `components/YearReflectionCard.jsx`
- `components/SnapshotView.jsx`
- `scripts/write_year_reflection.py`

**Code to remove from HomeScreen.js:**
- Import of `YearReflectionCard`
- `disclosure.yearReflection` section (lines ~800-810)
- Progressive disclosure threshold for yearReflection

**Code to remove from services/PolishEngine.js:**
- `YearReflection` export and all related code

**Code to remove from hooks/useProgressiveDisclosure.js:**
- `yearReflection: { days: 14, answers: 10 }` threshold

### 2. Thinking of You / Send Photo
**Files to remove:**
- `screens/ThinkingOfYouScreen.js`

**Code to remove from HomeScreen.js:**
- Camera button in header (lines ~480-489)
- Import of ThinkingOfYouScreen (navigation reference)

**Code to remove from PartnerNotifications.js:**
- `thinkingOfYouPhoto()` method

**Code to remove from MemoryWallScreen.js:**
- Camera FAB and references to ThinkingOfYou navigation

### 3. Relationship Climate / "In the Mood For"
**Files to remove:**
- `components/RelationshipClimate.jsx`

**Code to remove from HomeScreen.js:**
- Import of `RelationshipClimate`
- `disclosure.relationshipClimate` section (line ~756)

**Code to remove from hooks/useProgressiveDisclosure.js:**
- `relationshipClimate: { days: 3, answers: 3 }` threshold

**Code to remove from services/ConnectionEngine.js:**
- `RelationshipClimateState` section

### 4. Streak Banner / Monthly Moment Count
**Code to update in components/StreakBanner.jsx:**
- Change text from "X private moments this month" to something simpler
- OR remove the component entirely if it's only used for that

**Code to remove from HomeScreen.js:**
- The StreakBanner component and its onPress handler (line ~745)

---

## What to Keep & Enhance

### "Our Story" Screen (formerly SavedMomentsScreen)
**Rename:** `SavedMomentsScreen.js` → `OurStoryScreen.js`

**Purpose:** Single chronological view of EVERYTHING:
- ✅ Memories
- ✅ Journal entries
- ✅ Prompt answers (revealed)
- ✅ Date nights completed
- ✅ Positions tried
- ✅ Check-ins
- ✅ Photos/videos

**UI improvements:**
- Better filters (All, Moments, Reflections, Conversations, Dates)
- Clearer visual hierarchy
- Search functionality
- Media thumbnails inline

---

## Implementation Steps

### Phase 1: Remove Features (Low Risk)
1. ✅ Remove YearReflection imports from HomeScreen
2. ✅ Remove RelationshipClimate imports from HomeScreen
3. ✅ Remove ThinkingOfYou camera button from HomeScreen
4. ✅ Update StreakBanner or remove it
5. ✅ Remove progressive disclosure thresholds
6. ✅ Test that app still runs

### Phase 2: Rename & Refactor (Medium Risk)
1. ✅ Rename SavedMomentsScreen to OurStoryScreen
2. ✅ Update all navigation references
3. ✅ Update tab bar labels
4. ✅ Test navigation flows

### Phase 3: Delete Files (Low Risk - after testing)
1. ✅ Delete YearReflectionScreen.jsx
2. ✅ Delete YearReflectionCard.jsx
3. ✅ Delete SnapshotView.jsx
4. ✅ Delete ThinkingOfYouScreen.js
5. ✅ Delete RelationshipClimate.jsx
6. ✅ Clean up imports in other files

### Phase 4: Clean up Services (Low Risk)
1. ✅ Remove unused methods from PartnerNotifications
2. ✅ Remove YearReflection from PolishEngine
3. ✅ Remove RelationshipClimateState from ConnectionEngine
4. ✅ Update documentation

---

## Navigation Changes

### Before:
```
Home Tab
├── View prompt
├── Send vibe signal
├── Send photo (Thinking of You) ❌ REMOVE
├── Year Reflection card ❌ REMOVE
└── Relationship Climate ❌ REMOVE

Archive action → SavedMoments
```

### After:
```
Home Tab
├── View prompt
├── Send vibe signal
└── Quick actions (Journal, Quiz, Archive, Spark)

Archive action → Our Story ✅ RENAMED
```

---

## Testing Checklist

- [ ] App builds successfully
- [ ] HomeScreen renders without errors
- [ ] "Our Story" screen accessible from home
- [ ] All content types show in "Our Story"
- [ ] No broken navigation links
- [ ] No import errors
- [ ] Progressive disclosure still works for remaining features
- [ ] Tab bar navigation works

---

## Files Modified Summary

### Modified:
- ✅ `screens/HomeScreen.js` - Remove 3 features
- ✅ `screens/SavedMomentsScreen.js` → `screens/OurStoryScreen.js` - Rename
- ✅ `components/StreakBanner.jsx` - Update text or remove
- ✅ `hooks/useProgressiveDisclosure.js` - Remove thresholds
- ✅ Navigation configuration (wherever tab bar is defined)

### Deleted:
- ✅ `screens/YearReflectionScreen.jsx`
- ✅ `screens/ThinkingOfYouScreen.js`
- ✅ `components/YearReflectionCard.jsx`
- ✅ `components/RelationshipClimate.jsx`
- ✅ `components/SnapshotView.jsx`
- ✅ `scripts/write_year_reflection.py`

---

## Estimated Impact

### Lines of Code Removed: ~3,000
### Files Deleted: 6
### Complexity Reduction: High
### User Clarity: Much Better
### Maintenance Burden: Much Lower

This simplification makes the app's core value proposition much clearer: **a single chronological story of your relationship**.
