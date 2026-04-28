# Quiz Integration Plan: Making "What Feels Like Us" Actually Shape Content

## Current State ❌

The onboarding "What Feels Like Us" quiz collects:
- **Love Language** (Words, Touch, Time, Gifts, Service)
- **Relationship Goal** (Keep choosing each other, Feel close on busy days, Have more fun together, Keep intimacy alive, Build private story)
- **Date Style** (Home, Adventure, Mixed)
- **Communication Style** (Direct, Gentle, Playful)
- **Has Kids** (Yes/No)

**Problem**: This data is saved to `userProfile.quiz` but is **NOT used** by the PreferenceEngine to filter or rank prompts and dates. The UI promise says "These shape the prompts, date ideas, and little moments" but currently they don't.

---

## What Actually Shapes Content Now ✅

The PreferenceEngine currently uses:
1. **Heat Level** - User's spice preference (1-5)
2. **Season** - Relationship season (cozy, busy, growth, adventure, rest)
3. **Energy** - Current nervous system state (low, medium, open)
4. **Climate** - Relationship climate (connected, distant, tense, etc.)
5. **Boundaries** - Soft boundaries (hidden categories, paused prompts/dates)
6. **Tone** - App tone (warm, playful, intimate, minimal)
7. **Relationship Duration** - How long they've been together

---

## Integration Strategy 🎯

### Phase 1: Map Quiz Data to Existing Filters

We'll map quiz responses to existing PreferenceEngine filters so they **immediately** influence content:

#### Love Language → Prompt Categories

```javascript
const LOVE_LANGUAGE_CATEGORIES = {
  words: ['emotional', 'romance', 'memory', 'future'],  // Words of Affirmation
  touch: ['physical', 'sensory', 'romance'],            // Physical Touch
  time: ['emotional', 'memory', 'playful'],             // Quality Time
  gifts: ['playful', 'seasonal', 'romance'],            // Receiving Gifts
  service: ['playful', 'future'],                       // Acts of Service
};
```

#### Relationship Goal → Content Preferences

```javascript
const GOAL_PREFERENCES = {
  deeper: {               // Keep choosing each other
    categories: ['emotional', 'future', 'romance'],
    tones: ['deep', 'honest', 'reflective'],
    preferLoad: 2,        // Medium emotional load
  },
  communicate: {          // Feel close on busy days
    categories: ['memory', 'emotional', 'playful'],
    tones: ['warm', 'gentle', 'soft'],
    preferShort: true,    // Quick check-ins
    preferLoad: 1,        // Low effort
  },
  fun: {                  // Have more fun together
    categories: ['playful', 'fantasy', 'visual'],
    tones: ['playful', 'light', 'spontaneous'],
    preferLoad: 2,
  },
  intimacy: {             // Keep intimacy alive
    categories: ['physical', 'sensory', 'romance', 'kinky'],
    tones: ['sensual', 'bold', 'deep'],
    preferLoad: 2,
  },
  grow: {                 // Build private story
    categories: ['memory', 'future', 'seasonal'],
    tones: ['reflective', 'appreciative', 'warm'],
    preferLoad: 2,
  },
};
```

#### Date Style → Date Filtering

```javascript
const DATE_STYLE_PREFERENCES = {
  home: {
    location: 'home',
    preferLoad: 1,        // Cozy, low-effort
    boost: 1.5,           // 1.5x boost for home dates
  },
  adventure: {
    location: 'out',
    preferLoad: 3,        // Active, high-energy
    boost: 1.5,           // 1.5x boost for out dates
  },
  mixed: {
    location: null,       // No preference
    preferLoad: 2,
    boost: 1.0,           // No boost
  },
};
```

#### Communication Style → Prompt Tone

```javascript
const COMMUNICATION_STYLE_TONES = {
  direct: ['honest', 'deep', 'bold'],
  gentle: ['soft', 'gentle', 'warm'],
  playful: ['playful', 'light', 'spontaneous'],
};
```

---

### Phase 2: Modify PreferenceEngine

#### Update `getContentProfile()` to include quiz data:

```javascript
async function getContentProfile(userProfile = {}) {
  // ... existing code ...
  
  // 8. Quiz preferences from onboarding
  const quiz = userProfile?.quiz || {};
  const quizInfluence = getQuizInfluence(quiz);
  
  return {
    // ... existing fields ...
    quiz: {
      loveLanguage: quiz.loveLanguage,
      relationshipGoal: quiz.relationshipGoal,
      idealDateStyle: quiz.idealDateStyle,
      communicationStyle: quiz.communicationStyle,
      hasKids: quiz.hasKids,
      // Mapped influences
      preferredCategories: quizInfluence.categories,
      preferredTones: quizInfluence.tones,
      preferLoad: quizInfluence.preferLoad,
      preferShort: quizInfluence.preferShort,
      dateLocationPref: quizInfluence.dateLocation,
      dateLocationBoost: quizInfluence.dateLocationBoost,
    },
  };
}
```

#### Update `filterPrompts()` scoring:

```javascript
function filterPrompts(allPrompts, profile, options = {}) {
  // ... existing eligibility filtering ...
  
  const scored = eligible.map((prompt) => {
    let score = 0;
    
    // ... existing scoring ...
    
    // NEW: Quiz-based category boosting
    if (profile.quiz?.preferredCategories?.includes(prompt.category)) {
      score += 1.5;  // Strong boost for quiz-aligned categories
    }
    
    // NEW: Quiz-based tone matching
    const categoryTones = CATEGORY_TONE_MAP[prompt.category] || [];
    const quizToneOverlap = categoryTones.filter(t => 
      profile.quiz?.preferredTones?.includes(t)
    ).length;
    score += quizToneOverlap * 0.7;
    
    // NEW: Communication style tone matching
    const commStyleTones = COMMUNICATION_STYLE_TONES[profile.quiz?.communicationStyle] || [];
    const commOverlap = categoryTones.filter(t => 
      commStyleTones.includes(t)
    ).length;
    score += commOverlap * 0.5;
    
    // ... existing personalization ...
    
    return { prompt, score };
  });
  
  // ... existing sorting ...
}
```

#### Update `filterDatesWithProfile()` scoring:

```javascript
function filterDatesWithProfile(allDates, profile, selectedDimensions = null) {
  // ... existing eligibility filtering ...
  
  const scored = eligible.map((date) => {
    let score = 0;
    
    // ... existing smart matching ...
    
    // NEW: Date style preference boost
    if (profile.quiz?.dateLocationPref) {
      if (date.location === profile.quiz.dateLocationPref) {
        score *= profile.quiz.dateLocationBoost || 1.0;
      }
    }
    
    // NEW: Relationship goal alignment
    if (profile.quiz?.relationshipGoal) {
      const goalPrefs = GOAL_PREFERENCES[profile.quiz.relationshipGoal];
      if (goalPrefs) {
        // Boost dates that match goal's preferred load
        if (date.load === goalPrefs.preferLoad) {
          score += 1.0;
        }
        // Boost dates that match goal's short/long preference
        if (goalPrefs.preferShort && date.minutes <= 45) {
          score += 0.8;
        }
      }
    }
    
    // NEW: Kids consideration
    if (profile.quiz?.hasKids === true) {
      // Boost short, home dates for parents
      if (date.location === 'home' && date.minutes <= 60) {
        score += 1.2;
      }
      // Slightly demote very long dates
      if (date.minutes > 120) {
        score -= 0.5;
      }
    }
    
    return { date, score };
  });
  
  // ... existing sorting ...
}
```

---

### Phase 3: Add Helper Function

```javascript
function getQuizInfluence(quiz = {}) {
  const influence = {
    categories: [],
    tones: [],
    preferLoad: 2,
    preferShort: false,
    dateLocation: null,
    dateLocationBoost: 1.0,
  };
  
  // Love language → categories
  if (quiz.loveLanguage && LOVE_LANGUAGE_CATEGORIES[quiz.loveLanguage]) {
    influence.categories.push(...LOVE_LANGUAGE_CATEGORIES[quiz.loveLanguage]);
  }
  
  // Relationship goal → categories + tones + preferences
  if (quiz.relationshipGoal && GOAL_PREFERENCES[quiz.relationshipGoal]) {
    const goalPref = GOAL_PREFERENCES[quiz.relationshipGoal];
    influence.categories.push(...goalPref.categories);
    influence.tones.push(...goalPref.tones);
    influence.preferLoad = goalPref.preferLoad ?? 2;
    influence.preferShort = goalPref.preferShort ?? false;
  }
  
  // Communication style → tones
  if (quiz.communicationStyle && COMMUNICATION_STYLE_TONES[quiz.communicationStyle]) {
    influence.tones.push(...COMMUNICATION_STYLE_TONES[quiz.communicationStyle]);
  }
  
  // Date style → location preference
  if (quiz.idealDateStyle && DATE_STYLE_PREFERENCES[quiz.idealDateStyle]) {
    const stylePref = DATE_STYLE_PREFERENCES[quiz.idealDateStyle];
    influence.dateLocation = stylePref.location;
    influence.dateLocationBoost = stylePref.boost;
    influence.preferLoad = stylePref.preferLoad;
  }
  
  // Deduplicate arrays
  influence.categories = [...new Set(influence.categories)];
  influence.tones = [...new Set(influence.tones)];
  
  return influence;
}
```

---

## Expected Impact 📊

### Before Integration:
- Quiz answers are saved but ignored
- All users see similar content rankings
- "What Feels Like Us" is decorative, not functional

### After Integration:
- **Love Language = "Words of Affirmation"** → Emotional and romantic prompts ranked higher
- **Goal = "Feel close on busy days"** → Short, low-effort, warm prompts/dates prioritized
- **Date Style = "Home"** → Home dates get 1.5x boost in rankings
- **Communication Style = "Playful"** → Light, spontaneous prompts ranked higher
- **Has Kids = true** → Short, home dates boosted; long dates demoted

---

## Verification Tests 🧪

### Test 1: Love Language Influence
```javascript
// User with "Words of Affirmation"
const profile = { 
  quiz: { loveLanguage: 'words' },
  // ... other fields
};
const ranked = filterPrompts(allPrompts, profile);

// Expect: Emotional/romance/memory prompts at the top
expect(ranked[0].category).toMatch(/emotional|romance|memory/);
```

### Test 2: Relationship Goal Influence
```javascript
// User wanting to "Feel close on busy days"
const profile = { 
  quiz: { relationshipGoal: 'communicate' },
  // ... other fields
};
const ranked = filterPrompts(allPrompts, profile);

// Expect: Short, gentle prompts prioritized
expect(ranked[0].text.length).toBeLessThan(120);
expect(ranked[0].category).toMatch(/memory|emotional|playful/);
```

### Test 3: Date Style Influence
```javascript
// User prefers "Cozy nights in"
const profile = { 
  quiz: { idealDateStyle: 'home' },
  // ... other fields
};
const ranked = filterDatesWithProfile(allDates, profile);

// Expect: Home dates at the top
expect(ranked[0].location).toBe('home');
```

---

## Implementation Checklist ✅

- [ ] Add mapping constants to PreferenceEngine.js
- [ ] Add `getQuizInfluence()` helper function
- [ ] Update `getContentProfile()` to include quiz data
- [ ] Update `filterPrompts()` scoring with quiz influence
- [ ] Update `filterDatesWithProfile()` scoring with quiz influence
- [ ] Write integration tests for all quiz fields
- [ ] Update OnboardingScreen.js description to reflect accurate functionality
- [ ] Test with real user data to verify ranking changes

---

## Notes

- Quiz data is **additive** — it boosts/prioritizes but doesn't hard-filter
- Existing filters (heat, boundaries, etc.) still take precedence
- Quiz influence is **persistent** — no need to re-answer unless user wants to change
- Users can update quiz answers in Settings → Preferences (future feature)
