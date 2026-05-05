/**
 * WeeklyContentSetService.js — Personalized content release calendar
 * 
 * MODEL: Each user gets their own content schedule starting from signup date
 * 
 * FREE USERS (CUMULATIVE):
 * - Week 0: 20 prompts, 20 dates, 5 positions
 * - Each week after: +5 prompts, +5 dates, +1 position
 * - The library grows over time instead of rotating away old cards
 * 
 * PREMIUM USERS (CUMULATIVE):
 * - Week 0 (premium start): 100 prompts balanced across heat levels, 100 date ideas, 10 sex positions
 * - Week 1: 115 prompts, 115 date ideas, 13 sex positions
 * - Week 10: 250 prompts, 250 date ideas, 40 sex positions
 * - Eventually: 1042 prompts, 675 date ideas, 200 sex positions (full library)
 * - Library GROWS each week - they get cumulative access
 * 
 * NOTE: buildWeeklySet returns the current visible library for the user's tier.
 */

const CONTENT_TYPES = {
  PROMPTS: 'prompts',
  DATES: 'dates',
  POSITIONS: 'positions',
};

const WEEKLY_LIMITS = {
  [CONTENT_TYPES.PROMPTS]: {
    premium: 15,         // Premium gets 15 new prompts/week
    premiumStart: 100,   // Premium starts with ~20 prompts per heat level
    freeWelcomePack: 20, // Free starts with 20 prompts
    freeOngoing: 5,      // Free gets 5 more prompts each week
    freeLockedPreview: 0,
  },
  [CONTENT_TYPES.DATES]: {
    premium: 15,         // Premium gets 15 new dates/week
    premiumStart: 100,   // Premium starts with a larger date library
    freeWelcomePack: 20, // Free starts with 20 dates
    freeOngoing: 5,      // Free gets 5 more dates each week
    freeLockedPreview: 0,
  },
  [CONTENT_TYPES.POSITIONS]: {
    premium: 3,          // Premium gets 3 new positions/week
    premiumStart: 10,    // Premium starts with 10 sex positions
    freeWelcomePack: 5,  // Free starts with 5 positions
    freeOngoing: 1,      // Free gets 1 more position each week
    freeLockedPreview: 0,
  },
};

const PREMIUM_PROMPT_HEAT_LEVELS = [1, 2, 3, 4, 5];
const PREMIUM_PROMPT_START_PER_HEAT = 20;
const PREMIUM_PROMPT_WEEKLY_PER_HEAT = 3;

const PREMIUM_LIBRARY_TOTALS = {
  [CONTENT_TYPES.PROMPTS]: 1042,
  [CONTENT_TYPES.DATES]: 675,
  [CONTENT_TYPES.POSITIONS]: 200,
};

const UPGRADE_COPY = {
  [CONTENT_TYPES.PROMPTS]: {
    headline: 'Keep more of the conversation open',
    body: 'Free starts with 20 prompts and adds 5 more each week. Premium starts with 100 prompts across every heat level and adds 15 more each week.',
    cta: 'Unlock All Prompts',
  },
  [CONTENT_TYPES.DATES]: {
    headline: 'Ready for more date inspiration?',
    body: 'Free starts with 20 date ideas and adds 5 more each week. Premium starts with 100 date ideas and adds 15 more each week.',
    cta: 'Unlock All Dates',
  },
  [CONTENT_TYPES.POSITIONS]: {
    headline: 'Explore the full sex position library',
    body: 'Free starts with 5 sex positions and adds 1 more each week. Premium starts with 10 sex positions and adds 3 more each week.',
    cta: 'Unlock All Sex Positions',
  },
};

const getHeat = (item) => Number(item?.heat ?? item?.heatLevel ?? item?.level ?? 1);

const getCategory = (item) =>
  item?.category ?? item?.type ?? item?.vibe ?? item?.theme ?? 'uncategorized';

const getDateLoad = (item) => Number(item?.load ?? item?.energy ?? item?.effort ?? 2);

const getTitle = (item) => item?.title ?? item?.text ?? item?.prompt ?? 'Untitled';

const DATE_CATEGORY_TARGETS = [
  'romantic',
  'adventure',
  'after-dark',
  'health',
  'food',
  'creative',
  'cozy',
  'culture',
];

const stableStringHash = (value) => {
  const input = String(value ?? '');
  let hash = 2166136261;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const seededScore = (item, seed) => {
  const id = item?.id ?? item?.title ?? item?.text ?? JSON.stringify(item);
  return stableStringHash(`${seed}:${id}`);
};

/**
 * Calculate week number based on user's signup date (personalized calendar)
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
  if (!userCreatedAt) return 0; // Fallback for users without creation date
  
  const signupDate = toLocalDayStart(userCreatedAt);
  const current = toLocalDayStart(currentDate);
  if (!signupDate || !current) {
    return 0;
  }
  const diffMs = current.getTime() - signupDate.getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return 0;
  }

  return Math.floor(diffMs / weekMs);
};

/**
 * DEPRECATED: Global week calculation (kept for backwards compatibility)
 * Use getUserWeekNumber instead for personalized content release
 */
const getWeekNumberFromStart = (date = new Date(), startDate = '2026-01-05T00:00:00.000Z') => {
  console.warn('[WeeklyContentSetService] getWeekNumberFromStart is deprecated. Use getUserWeekNumber instead.');
  const current = date instanceof Date ? date : new Date(date);
  const start = new Date(startDate);
  const diffMs = current.getTime() - start.getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  if (!Number.isFinite(diffMs)) {
    return 0;
  }

  return Math.max(0, Math.floor(diffMs / weekMs));
};

const normalizeUserSettings = (userSettings = {}) => {
  const maxHeat = Number(
    userSettings.maxHeat ??
      userSettings.heat ??
      userSettings.heatLevel ??
      userSettings.userMaxHeat ??
      5
  );

  return {
    ...userSettings,
    maxHeat: Number.isFinite(maxHeat) ? maxHeat : 5,
  };
};

const isAllowedByHeat = (item, userSettings = {}) => {
  const settings = normalizeUserSettings(userSettings);
  return getHeat(item) <= settings.maxHeat;
};

const sortSeeded = (items, seed) =>
  [...items].sort((a, b) => {
    const scoreA = seededScore(a, seed);
    const scoreB = seededScore(b, seed);

    if (scoreA !== scoreB) {
      return scoreA - scoreB;
    }

    return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
  });

const pushUnique = (target, item, limit) => {
  if (!item || target.length >= limit) return false;

  const id = item.id ?? item.title ?? item.text ?? item.prompt;
  if (target.some((existing) => (existing.id ?? existing.title ?? existing.text ?? existing.prompt) === id)) {
    return false;
  }

  target.push(item);
  return true;
};

const byCategoryCount = (items, category) =>
  items.filter((item) => getCategory(item) === category).length;

const pickBalancedPrompts = (items, limit, seed) => {
  const selected = [];
  const shuffled = sortSeeded(items, seed);

  const categoryTargets = [
    'emotional',
    'playful',
    'romance',
    'future',
    'memory',
    'sensory',
    'physical',
    'fantasy',
    'location',
    'visual',
    'seasonal',
    'kinky',
    'roleplay',
  ];

  for (const category of categoryTargets) {
    const pick = shuffled.find(
      (item) => getCategory(item) === category && byCategoryCount(selected, category) < 2
    );
    pushUnique(selected, pick, limit);
    if (selected.length >= limit) return selected;
  }

  for (const item of shuffled) {
    const category = getCategory(item);
    if (byCategoryCount(selected, category) < 2) {
      pushUnique(selected, item, limit);
    }
    if (selected.length >= limit) return selected;
  }

  for (const item of shuffled) {
    pushUnique(selected, item, limit);
    if (selected.length >= limit) return selected;
  }

  return selected;
};

const buildPremiumPromptLibrary = (
  items,
  {
    userId = 'anonymous',
    userSettings = {},
    userCreatedAt = null,
    date = new Date(),
  } = {}
) => {
  const weekNumber = getUserWeekNumber(userCreatedAt, date);
  const settings = normalizeUserSettings(userSettings);
  const eligible = (Array.isArray(items) ? items : []).filter((item) =>
    isAllowedByHeat(item, settings)
  );

  const perHeatTarget =
    PREMIUM_PROMPT_START_PER_HEAT + (weekNumber * PREMIUM_PROMPT_WEEKLY_PER_HEAT);
  const totalTarget = perHeatTarget * PREMIUM_PROMPT_HEAT_LEVELS.length;
  const seed = `${CONTENT_TYPES.PROMPTS}:${userId || 'anonymous'}:premium-library`;

  const selected = [];
  const selectedIds = new Set();

  for (const heatLevel of PREMIUM_PROMPT_HEAT_LEVELS) {
    const heatItems = sortSeeded(
      eligible.filter((item) => getHeat(item) === heatLevel),
      `${seed}:heat:${heatLevel}`
    );

    for (const item of heatItems.slice(0, perHeatTarget)) {
      const id = String(item?.id ?? item?.text ?? item?.prompt ?? selected.length);
      if (selectedIds.has(id)) continue;
      selected.push(item);
      selectedIds.add(id);
    }
  }

  if (selected.length < totalTarget) {
    const remaining = sortSeeded(
      eligible.filter((item) => {
        const id = String(item?.id ?? item?.text ?? item?.prompt ?? '');
        return !selectedIds.has(id);
      }),
      `${seed}:fill:${weekNumber}`
    );

    for (const item of remaining) {
      if (selected.length >= totalTarget) break;
      const id = String(item?.id ?? item?.text ?? item?.prompt ?? selected.length);
      if (selectedIds.has(id)) continue;
      selected.push(item);
      selectedIds.add(id);
    }
  }

  return selected;
};

const pickBalancedDates = (items, limit, seed) => {
  const selected = [];
  const shuffled = sortSeeded(items, seed);

  for (const category of DATE_CATEGORY_TARGETS) {
    const pick = shuffled.find(
      (item) => getCategory(item) === category && byCategoryCount(selected, category) < 1
    );
    pushUnique(selected, pick, limit);
    if (selected.length >= limit) return selected;
  }

  for (const item of shuffled) {
    const category = getCategory(item);
    const sameLaneCount = byCategoryCount(selected, category);

    if (sameLaneCount < 2) {
      pushUnique(selected, item, limit);
    }

    if (selected.length >= limit) return selected;
  }

  for (const item of shuffled) {
    pushUnique(selected, item, limit);
    if (selected.length >= limit) return selected;
  }

  return selected;
};

const pickBalancedPositions = (items, limit, seed) => {
  const selected = [];
  const shuffled = sortSeeded(items, seed);

  const desiredSlots = [
    (item) => getHeat(item) <= 1 || item.accessibility === 'low-mobility',
    (item) => getCategory(item) === 'deep-connection',
    (item) => getCategory(item) === 'playful-energy' || getCategory(item) === 'exploratory',
    (item) => getHeat(item) >= 3,
    (item) => getCategory(item) === 'trust-vulnerability' || getCategory(item) === 'sensual-rhythm',
  ];

  for (const matchesSlot of desiredSlots) {
    const pick = shuffled.find(matchesSlot);
    pushUnique(selected, pick, limit);
    if (selected.length >= limit) return selected;
  }

  for (const item of shuffled) {
    const category = getCategory(item);
    if (byCategoryCount(selected, category) < 2) {
      pushUnique(selected, item, limit);
    }
    if (selected.length >= limit) return selected;
  }

  for (const item of shuffled) {
    pushUnique(selected, item, limit);
    if (selected.length >= limit) return selected;
  }

  return selected;
};

const getPreviewText = (item, contentType) => {
  if (contentType === CONTENT_TYPES.PROMPTS) {
    const text = item?.text ?? item?.prompt ?? item?.title ?? '';
    return String(text).length > 90 ? `${String(text).slice(0, 90).trim()}…` : text;
  }

  if (contentType === CONTENT_TYPES.DATES) {
    return item?.title ?? '';
  }

  return item?.shortSummary ?? item?.title ?? '';
};

const toLockedPreview = (item, contentType, weeklyIndex, weekNumber) => ({
  id: item?.id,
  title: getTitle(item),
  heat: getHeat(item),
  category: getCategory(item),
  load: item?.load,
  style: item?.style,
  accessibility: item?.accessibility,
  previewText: getPreviewText(item, contentType),
  isLockedPreview: true,
  requiresPremium: true,
  weeklySetMeta: {
    contentType,
    weekNumber,
    isWeeklyPick: true,
    isLockedPreview: true,
    weeklyIndex,
  },
});

const withUnlockedWeeklyMeta = (item, contentType, weeklyIndex, weekNumber) => ({
  ...item,
  isLockedPreview: false,
  requiresPremium: false,
  deckInstanceId: item?.deckInstanceId ?? `${contentType}:${weekNumber}:${weeklyIndex}:${item?.id ?? item?.title ?? item?.text ?? 'item'}`,
  weeklySetMeta: {
    contentType,
    weekNumber,
    isWeeklyPick: true,
    isLockedPreview: false,
    weeklyIndex,
  },
});

const buildWeeklySet = (
  items,
  {
    contentType,
    userId = 'anonymous',
    isPremium = false,
    userSettings = {},
    userCreatedAt = null,
    date = new Date(),
  } = {}
) => {
  const type = contentType || CONTENT_TYPES.PROMPTS;
  const limits = WEEKLY_LIMITS[type] || WEEKLY_LIMITS[CONTENT_TYPES.PROMPTS];
  const premiumLimit = limits.premium;
  const weekNumber = getUserWeekNumber(userCreatedAt, date);
  const freeUnlockedLimit = limits.freeWelcomePack + (weekNumber * limits.freeOngoing);
  const premiumUnlockedLimit =
    (limits.premiumStart ?? premiumLimit) + (weekNumber * premiumLimit);
  const freeLockedPreviewLimit = limits.freeLockedPreview;

  const settings = normalizeUserSettings(userSettings);
  const seed = `${type}:${userId || 'anonymous'}:library`;

  const eligible = (Array.isArray(items) ? items : []).filter((item) =>
    isAllowedByHeat(item, settings)
  );

  const visibleTargetCount = isPremium
    ? premiumUnlockedLimit
    : freeUnlockedLimit + freeLockedPreviewLimit;

  let selected;

  if (type === CONTENT_TYPES.PROMPTS && isPremium) {
    selected = buildPremiumPromptLibrary(eligible, {
      userId,
      userSettings,
      userCreatedAt,
      date,
    });
  } else if (type === CONTENT_TYPES.DATES) {
    selected = pickBalancedDates(eligible, visibleTargetCount, seed);
  } else if (type === CONTENT_TYPES.POSITIONS) {
    selected = pickBalancedPositions(eligible, visibleTargetCount, seed);
  } else {
    selected = pickBalancedPrompts(eligible, visibleTargetCount, seed);
  }

  const weeklySelection = isPremium
    ? selected
    : [...selected].sort((a, b) => {
        if (type === CONTENT_TYPES.DATES) {
          const loadDiff = getDateLoad(a) - getDateLoad(b);

          if (loadDiff !== 0) {
            return loadDiff;
          }
        }

        const heatDiff = getHeat(a) - getHeat(b);

        if (heatDiff !== 0) {
          return heatDiff;
        }

        if (type === CONTENT_TYPES.POSITIONS) {
          const accessibilityRank = {
            'low-mobility': 0,
            standard: 1,
            active: 2,
          };

          const accessibilityDiff =
            (accessibilityRank[a?.accessibility] ?? 1) -
            (accessibilityRank[b?.accessibility] ?? 1);

          if (accessibilityDiff !== 0) {
            return accessibilityDiff;
          }
        }

        return seededScore(a, `${seed}:free-sort`) - seededScore(b, `${seed}:free-sort`);
      });

  const unlockedCount = isPremium
    ? weeklySelection.length
    : Math.min(freeUnlockedLimit, weeklySelection.length);

  const unlocked = weeklySelection
    .slice(0, unlockedCount)
    .map((item, index) => withUnlockedWeeklyMeta(item, type, index, weekNumber));

  const lockedPreviews = isPremium
    ? []
    : weeklySelection
        .slice(freeUnlockedLimit, freeUnlockedLimit + freeLockedPreviewLimit)
        .map((item, index) => toLockedPreview(item, type, index + freeUnlockedLimit, weekNumber));

  return {
    contentType: type,
    weekNumber,
    isPremium,
    premiumLibraryTotal: PREMIUM_LIBRARY_TOTALS[type] ?? eligible.length,
    premiumUnlockedLimit,
    freeUnlockedLimit,
    freeLockedPreviewLimit,
    totalWeeklyPicks: weeklySelection.length,
    upgradeCopy: UPGRADE_COPY[type],
    unlocked,
    lockedPreviews,
    items: [...unlocked, ...lockedPreviews],
  };
};

export {
  CONTENT_TYPES,
  WEEKLY_LIMITS,
  PREMIUM_LIBRARY_TOTALS,
  UPGRADE_COPY,
  buildWeeklySet,
  buildPremiumPromptLibrary,
  getUserWeekNumber,
  getWeekNumberFromStart, // Deprecated, use getUserWeekNumber
};
