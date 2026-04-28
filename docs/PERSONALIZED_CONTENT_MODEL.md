# Personalized Content Release Model

## Overview
Between Us uses a **personalized content release calendar** where each user gets content on their own schedule starting from their signup date, rather than a global Monday release schedule.

## Model Details

### Free Users

#### **Week 0 (Signup Day) - Welcome Pack**
- **10 prompts** (2 from each category - gives breadth of experience)
- **10 dates** (variety across heat/load/style dimensions)
- **5 positions** (introductory set)

**Messaging:** "Welcome! Here's your starter pack to explore"

#### **Week 1+ (Every 7 Days After Signup) - Ongoing Weekly Drops**
- **5 new prompts** every week
- **5 new dates** every week  
- **1 new position** every week

**Messaging:** "Fresh content unlocked! 5 new [prompts/dates] just for you"

### Premium Users

#### **Week 0 (Signup Day) - Premium Launch Pack**
- **300 prompts** (~60 in each category)
- **200 dates** (full variety)
- **10 positions**

#### **Week 1+ (Every 7 Days After Signup) - Premium Weekly Drops**
- **10 new prompts** every week
- **8 new dates** every week
- **2 new positions** every week

#### **Eventually (After ~49 weeks)**
- **792 total prompts** (entire library)
- **823 total dates** (entire library)
- **200 total positions** (entire library)

---

## Why This Model?

### Benefits over Global Monday Releases:

1. **Fair onboarding** - Everyone gets immediate value on signup, no waiting
2. **No dead weeks** - No user waits 1-6 days for their first refresh
3. **Consistent experience** - Every user gets the same journey regardless of signup day
4. **Better conversion timing** - Week 2-3 "upgrade nudge" hits at optimal time for every user
5. **Matches usage pattern** - Couples use the app on their schedule, not global events
6. **Personalization** - Content schedule feels tailored to them

---

## Implementation

### Core Function: `getUserWeekNumber()`

```javascript
/**
 * Calculate week number based on user's signup date
 * @param {Date|string} userCreatedAt - When the user signed up
 * @param {Date|string} currentDate - Current date (defaults to now)
 * @returns {number} Week number (0 = signup week, 1 = first week after, etc.)
 */
const getUserWeekNumber = (userCreatedAt, currentDate = new Date()) => {
  const signupDate = new Date(userCreatedAt);
  const current = currentDate instanceof Date ? currentDate : new Date(currentDate);
  const diffMs = current.getTime() - signupDate.getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  
  return Math.floor(diffMs / weekMs); // 0, 1, 2, 3...
};
```

### Weekly Set Logic

```javascript
// Week 0 detection
const weekNumber = getUserWeekNumber(userCreatedAt, date);
const isWelcomeWeek = weekNumber === 0;

// Free user gets different limits
const freeUnlockedLimit = isWelcomeWeek 
  ? limits.freeWelcomePack  // 10 for week 0
  : limits.freeOngoing;      // 5 for week 1+
```

### Required Data

Each call to `buildWeeklySet()` needs:
- `userCreatedAt` - User's signup timestamp (from `userProfile.created_at`)
- `date` - Current date (defaults to `new Date()`)
- Other existing params (userId, isPremium, userSettings, etc.)

---

## User Experience

### Week 0 (Signup Day)
```
📦 Welcome!
Here's your starter pack:
• 10 conversation prompts
• 10 date ideas
• 5 intimacy positions

Explore and see what resonates with you two.
```

### Week 1 (7 days later)
```
✨ Fresh content unlocked!
• 5 new prompts
• 5 new dates
• 1 new position

Your next refresh: 7 days
```

### Week 2+
```
🎁 Your weekly refresh
• 5 new prompts
• 5 new dates
• 1 new position
```

With upsell hint:
```
💎 Want more?
Premium unlocks 300+ prompts right now
+ 10 new ones every week
```

---

## Conversion Strategy

### The "Nostalgia Hook"
- Week 0: User gets 10 cards - experiences variety & depth
- Week 1+: User drops to 5 cards - feels the loss
- Week 2: "Remember when you had 10? Get that back forever with Premium"

### Value Proposition Clarity
- Free = Welcome pack + 5/week drip feed
- Premium = 300 right now + 10/week ongoing

**The gap is clear:** Premium isn't just "more" - it's "everything now" vs "little by little"

---

## Analytics to Track

### Key Metrics:
1. **Welcome Pack Utilization**
   - Do users explore all 10 cards in week 0?
   - Which categories get most engagement?

2. **Week 1 Drop-off**
   - Do users return after week 1 transition (10 → 5)?
   - Retention: Week 0 → Week 1 → Week 2

3. **Conversion Timing**
   - When do free users convert? (Week 1? 2? 3?)
   - Does "nostalgia" for 10 cards drive upgrades?

4. **Premium Engagement**
   - How many cards do premium users actually use per week?
   - Does 300 cards feel overwhelming or exciting?

### SQL Queries:
See `docs/ANALYTICS_QUERIES.md` for tracking queries

---

## Migration Notes

### For Existing Users (if needed)
If you have existing users with the old Monday model:
1. Set their `userCreatedAt` to earliest Monday before their actual signup
2. Calculate their current week based on that anchor
3. They continue on personalized schedule going forward

### Backwards Compatibility
Old function `getWeekNumberFromStart()` is deprecated but kept for compatibility.
New code should use `getUserWeekNumber()` instead.

---

## Configuration

All settings in `services/WeeklyContentSetService.js`:

```javascript
const WEEKLY_LIMITS = {
  [CONTENT_TYPES.PROMPTS]: {
    premium: 10,          // Premium weekly drops
    freeWelcomePack: 10,  // Free week 0
    freeOngoing: 5,       // Free week 1+
    freeLockedPreview: 5, // Locked teasers shown
  },
  // ... similar for DATES and POSITIONS
};
```

---

## Future Enhancements

### Potential additions:
1. **"Next drop" countdown** - "5 new prompts in 3 days"
2. **Custom drop day** - Let users choose their refresh day (Mon/Wed/Fri/Sun)
3. **Anniversary bonuses** - Extra content on relationship milestones
4. **Seasonal events** - Valentine's, holidays override regular schedule
5. **Streak bonuses** - "10 week streak! Here's a bonus card"

---

## Summary

✅ **Model B (Personalized)** is now implemented
✅ Free users get a **generous welcome pack** (10/10/5)
✅ Ongoing drops are **balanced** (5/5/1 weekly)
✅ Premium value prop is **crystal clear** (300 now vs 5/week)
✅ User experience is **fair** (everyone gets same schedule)
✅ Conversion funnel is **optimized** (nostalgia + scarcity)

**Result:** Better onboarding, clearer value, higher conversion potential.
