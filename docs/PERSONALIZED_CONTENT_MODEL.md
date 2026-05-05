# Personalized Content Release Model

## Overview
Between Us uses a **personalized content release calendar** where each user gets content on their own schedule starting from their signup date, rather than a global Monday release schedule.

## Model Details

### Free Users

#### **Week 0 (Signup Day) - Welcome Pack**
- **20 prompts** (starter conversation library)
- **20 dates** (starter date idea library)
- **5 positions** (introductory set)

**Messaging:** "Welcome! Here's your starter pack to explore"

#### **Week 1+ (Every 7 Days After Signup) - Ongoing Weekly Drops**
- **5 new prompts** every week
- **5 new dates** every week  
- **1 new position** every week

**Messaging:** "Fresh content unlocked! New prompts and dates just for you"

### Premium Users

#### **Week 0 (Premium Start Day) - Premium Launch Pack**
- **100 prompts** (20 in each heat level)
- **100 date ideas** (full variety)
- **10 sex positions**

#### **Week 1+ (Every 7 Days After Premium Start) - Premium Weekly Drops**
- **15 new prompts** every week
- **15 new dates** every week
- **3 new positions** every week

#### **Eventually**
- **749 total prompts** in the current live catalog
- **707 total dates** in the current live catalog
- **200 total sex positions** in the current live catalog

Premium reaches the full current prompt catalog after about 44 premium weeks, the full date catalog after about 41 premium weeks, and the full sex position catalog after about 64 premium weeks.

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
const toLocalDayStart = (value) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const getUserWeekNumber = (userCreatedAt, currentDate = new Date()) => {
  const signupDate = toLocalDayStart(userCreatedAt);
  const current = toLocalDayStart(currentDate);
  if (!signupDate || !current) return 0;

  const diffMs = current.getTime() - signupDate.getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  if (!Number.isFinite(diffMs) || diffMs < 0) return 0;
  return Math.floor(diffMs / weekMs); // 0, 1, 2, 3...
};
```

### Weekly Set Logic

```javascript
const weekNumber = getUserWeekNumber(userCreatedAt, date);
const freeUnlockedLimit = limits.freeWelcomePack + (weekNumber * limits.freeOngoing);
const premiumUnlockedLimit = limits.premiumStart + (weekNumber * limits.premium);
```

### Required Data

Each call to `buildWeeklySet()` needs:
- `userCreatedAt` - User's signup timestamp (from `userProfile.created_at`)
- Premium users should pass their premium start timestamp as the anchor date.
- `date` - Current date (defaults to `new Date()`)
- Other existing params (userId, isPremium, userSettings, etc.)

---

## User Experience

### Week 0 (Signup Day)
```
📦 Welcome!
Here's your starter pack:
• 20 conversation prompts
• 20 date ideas
• 5 sex positions

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
Premium starts with 100 prompts
+ 15 new ones every week
```

---

## Conversion Strategy

### The "Nostalgia Hook"
- Week 0: User gets 20 prompts, 20 dates, and 5 sex positions - enough to build habit
- Week 1+: User gets 5 more prompts, 5 more dates, and 1 more sex position
- Week 2: Premium becomes a larger-library upgrade, not a core-access rescue

### Value Proposition Clarity
- Free = Starter library + smaller weekly drops
- Premium = 100 prompts and dates right away + larger weekly drops

**The gap is clear:** Premium starts with a much larger library and keeps growing faster, while free grows little by little.

---

## Analytics to Track

### Key Metrics:
1. **Welcome Pack Utilization**
   - Do users explore the week 0 starter library?
   - Which categories get most engagement?

2. **Week 1 Drop-off**
   - Do users return after the first weekly drop?
   - Retention: Week 0 → Week 1 → Week 2

3. **Conversion Timing**
   - When do free users convert? (Week 1? 2? 3?)
   - Does the larger premium library drive upgrades after habit forms?

4. **Premium Engagement**
   - How many cards do premium users actually use per week?
   - Does the 100-card premium starter library feel useful without feeling overwhelming?

### SQL Queries:
See `docs/ANALYTICS_QUERIES.md` for tracking queries

---

## Migration Notes

### For Existing Users (if needed)
If you have existing users with the old Monday model:
1. Set their `userCreatedAt` to earliest Monday before their actual signup
2. Calculate their current week based on that anchor
3. They continue on personalized schedule going forward

### Removed Old Release Logic
The previous global Monday release helper has been removed from the live service. New code should use `getUserWeekNumber()` with the user-specific signup or premium-start anchor.

---

## Configuration

All settings in `services/WeeklyContentSetService.js`:

```javascript
const WEEKLY_LIMITS = {
  [CONTENT_TYPES.PROMPTS]: {
    premium: 15,          // Premium weekly drops
    premiumStart: 100,    // Premium week 0
    freeWelcomePack: 20,  // Free week 0
    freeOngoing: 5,       // Free week 1+
    freeLockedPreview: 0, // No locked prompt teasers shown
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
✅ Free users get a **generous welcome pack** (20/20/5)
✅ Ongoing drops are **balanced** (5/5/1 weekly)
✅ Premium value prop is **crystal clear** (larger starter library and larger weekly drops)
✅ User experience is **fair** (everyone gets same schedule)
✅ Conversion funnel is **optimized** around user value first

**Result:** Better onboarding, clearer value, higher conversion potential.
