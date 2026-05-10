/**
 * WeeklyContentSetService.js — Personalized content release calendar
 * 
 * MODEL: Each user gets their own content schedule starting from signup date
 * 
 * FREE USERS (CUMULATIVE):
 * - Week 0: 20 prompts, 20 date ideas, 5 positions
 * - Each week after: +5 prompts, +5 dates, +1 position
 * - The library grows over time instead of rotating away old cards
 * 
 * PREMIUM USERS (CUMULATIVE):
 * - Week 0 (premium start): 100 prompts balanced across heat levels, 100 date ideas, 10 sex positions
 * - Week 1: 115 prompts, 115 date ideas, 13 sex positions
 * - Week 10: 250 prompts, 250 date ideas, 40 sex positions
 * - Eventually: all eligible prompts, date ideas, and sex positions in the live catalog.
 * - Library GROWS each week - they get cumulative access
 * 
 * NOTE: buildWeeklySet returns the current visible library for the user's tier.
 */

import {
  FREE_LIMITS,
  PREMIUM_LIMITS,
} from '../utils/featureFlags.js';
import { profileAllowsHeatLevel } from '../utils/heatLevelRanges.js';

const CONTENT_TYPES = {
  PROMPTS: 'prompts',
  DATES: 'dates',
  POSITIONS: 'positions',
};

const WEEKLY_LIMITS = {
  [CONTENT_TYPES.PROMPTS]: {
    premium: PREMIUM_LIMITS.WEEKLY_PROMPTS,
    premiumStart: PREMIUM_LIMITS.WEEK_0_PROMPTS,
    freeWelcomePack: FREE_LIMITS.WEEK_0_PROMPTS,
    freeOngoing: FREE_LIMITS.WEEKLY_PROMPTS,
    freeLockedPreview: 0,
  },
  [CONTENT_TYPES.DATES]: {
    premium: PREMIUM_LIMITS.WEEKLY_DATES,
    premiumStart: PREMIUM_LIMITS.WEEK_0_DATES,
    freeWelcomePack: FREE_LIMITS.WEEK_0_DATES,
    freeOngoing: FREE_LIMITS.WEEKLY_DATES,
    freeLockedPreview: 0,
  },
  [CONTENT_TYPES.POSITIONS]: {
    premium: PREMIUM_LIMITS.WEEKLY_POSITIONS,
    premiumStart: PREMIUM_LIMITS.WEEK_0_POSITIONS,
    freeWelcomePack: FREE_LIMITS.WEEK_0_POSITIONS,
    freeOngoing: FREE_LIMITS.WEEKLY_POSITIONS,
    freeLockedPreview: 0,
  },
};

const PREMIUM_PROMPT_HEAT_LEVELS = [1, 2, 3, 4, 5];
const FREE_MAX_HEAT_BY_TYPE = {
  [CONTENT_TYPES.PROMPTS]: 2,
  [CONTENT_TYPES.DATES]: 2,
  [CONTENT_TYPES.POSITIONS]: 2,
};

const normalizeUnlockCount = (value, fallback = 0) => {
  const numeric = Number(value);
  if (numeric === Infinity) return Infinity;
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
};

const getCumulativeUnlockLimit = ({ start = 0, weekly = 0, weekNumber = 0 } = {}) => {
  const startCount = normalizeUnlockCount(start);
  const weeklyCount = normalizeUnlockCount(weekly);
  const safeWeekNumber = normalizeUnlockCount(weekNumber);

  if (startCount === Infinity || weeklyCount === Infinity) return Infinity;
  return startCount + (safeWeekNumber * weeklyCount);
};

const capSelection = (items, limit) => {
  const list = Array.isArray(items) ? items : [];
  const safeLimit = normalizeUnlockCount(limit, list.length);
  return safeLimit === Infinity ? list : list.slice(0, safeLimit);
};

const UPGRADE_COPY = {
  [CONTENT_TYPES.PROMPTS]: {
    headline: 'Keep more of the conversation open',
    body: 'Free users start with 20 lower-intensity prompts and add 5 more each week. Premium users start with 100 prompts across every heat level and add 15 more each week.',
    cta: 'Expand Prompt Library',
  },
  [CONTENT_TYPES.DATES]: {
    headline: 'Ready for more date inspiration?',
    body: 'Free users start with 20 lower-intensity date ideas and add 5 more each week. Premium users start with 100 date ideas across the full date library and add 15 more each week.',
    cta: 'Expand Date Library',
  },
  [CONTENT_TYPES.POSITIONS]: {
    headline: 'Explore the full sex position library',
    body: 'Free users start with 5 lower-intensity sex positions and add 1 more each week. Premium users start with 10 positions across the full library and add 3 more each week.',
    cta: 'Expand Position Library',
  },
};

const getHeat = (item) => Number(item?.heat ?? item?.heatLevel ?? item?.level ?? 1);

const getCategory = (item) =>
  item?.category ?? item?.type ?? item?.vibe ?? item?.theme ?? 'uncategorized';

const getDateLoad = (item) => Number(item?.load ?? item?.energy ?? item?.effort ?? 2);

const getTitle = (item) => item?.title ?? item?.text ?? item?.prompt ?? 'Untitled';

const getItemIdentity = (item) => item?.id ?? item?.title ?? item?.text ?? item?.prompt ?? null;

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

const normalizeUserSettings = (userSettings = {}) => {
  const boundaries = userSettings?.boundaries || {};
  const hideSpicy = !!(userSettings?.hideSpicy || boundaries?.hideSpicy);
  const maxHeat = Number(
    userSettings.maxHeat ??
      userSettings.heat ??
      userSettings.heatLevel ??
      userSettings.heatLevelPreference ??
      userSettings.maxHeatLevel ??
      userSettings.userMaxHeat ??
      boundaries.maxHeatOverride ??
      (hideSpicy ? 3 : null) ??
      5
  );
  const normalizedMaxHeat = Number.isFinite(maxHeat) ? maxHeat : 5;

  return {
    ...userSettings,
    hideSpicy,
    maxHeat: hideSpicy ? Math.min(normalizedMaxHeat, 3) : normalizedMaxHeat,
  };
};

const isAllowedByHeat = (item, userSettings = {}) => {
  const settings = normalizeUserSettings(userSettings);
  const heat = getHeat(item);
  return heat <= settings.maxHeat && profileAllowsHeatLevel(settings, heat);
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

  const totalTarget = getCumulativeUnlockLimit({
    start: PREMIUM_LIMITS.WEEK_0_PROMPTS,
    weekly: PREMIUM_LIMITS.WEEKLY_PROMPTS,
    weekNumber,
  });
  const perHeatBaseTarget = totalTarget === Infinity
    ? Infinity
    : Math.floor(totalTarget / PREMIUM_PROMPT_HEAT_LEVELS.length);
  const extraHeatSlots = totalTarget === Infinity
    ? 0
    : totalTarget % PREMIUM_PROMPT_HEAT_LEVELS.length;
  const seed = `${CONTENT_TYPES.PROMPTS}:${userId || 'anonymous'}:premium-library`;

  const selected = [];
  const selectedIds = new Set();

  PREMIUM_PROMPT_HEAT_LEVELS.forEach((heatLevel, heatIndex) => {
    const heatTarget = perHeatBaseTarget === Infinity
      ? Infinity
      : perHeatBaseTarget + (heatIndex < extraHeatSlots ? 1 : 0);
    const heatItems = sortSeeded(
      eligible.filter((item) => getHeat(item) === heatLevel),
      `${seed}:heat:${heatLevel}`
    );

    for (const item of capSelection(heatItems, heatTarget)) {
      if (selected.length >= totalTarget) break;
      const id = String(item?.id ?? item?.text ?? item?.prompt ?? selected.length);
      if (selectedIds.has(id)) continue;
      selected.push(item);
      selectedIds.add(id);
    }
  });

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

  return capSelection(selected, totalTarget);
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

const getPreviousUnlockedLimit = ({ limits, isPremium, weekNumber }) => {
  if (!Number.isFinite(weekNumber) || weekNumber <= 0) return 0;

  if (isPremium) {
    return (limits.premiumStart ?? limits.premium) + ((weekNumber - 1) * limits.premium);
  }

  return limits.freeWelcomePack + ((weekNumber - 1) * limits.freeOngoing);
};

const prioritizeNewestPositionUnlocks = (orderedItems, selectedItems, {
  type,
  limits,
  isPremium,
  weekNumber,
}) => {
  if (type !== CONTENT_TYPES.POSITIONS || weekNumber <= 0) return orderedItems;

  const previousLimit = Math.max(0, getPreviousUnlockedLimit({ limits, isPremium, weekNumber }));
  if (previousLimit <= 0) return orderedItems;

  const previousIds = new Set(
    selectedItems
      .slice(0, previousLimit)
      .map((item) => getItemIdentity(item))
      .filter((id) => id != null)
      .map(String)
  );

  if (!previousIds.size) return orderedItems;

  const newest = [];
  const existing = [];

  orderedItems.forEach((item) => {
    const id = getItemIdentity(item);
    if (id != null && previousIds.has(String(id))) {
      existing.push(item);
    } else {
      newest.push(item);
    }
  });

  return newest.length ? [...newest, ...existing] : orderedItems;
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
  const weekNumber = getUserWeekNumber(userCreatedAt, date);
  const freeUnlockedLimit = getCumulativeUnlockLimit({
    start: limits.freeWelcomePack,
    weekly: limits.freeOngoing,
    weekNumber,
  });
  const premiumUnlockedLimit = getCumulativeUnlockLimit({
    start: limits.premiumStart ?? limits.premium,
    weekly: limits.premium,
    weekNumber,
  });
  const freeLockedPreviewLimit = normalizeUnlockCount(limits.freeLockedPreview);

  const settings = normalizeUserSettings(userSettings);
  const seed = `${type}:${userId || 'anonymous'}:library`;

  const freeMaxHeat = isPremium ? Infinity : (FREE_MAX_HEAT_BY_TYPE[type] ?? 3);
  const tierAllowedByHeat = (item) => getHeat(item) <= freeMaxHeat;

  const eligible = settings.hideSpicy && type === CONTENT_TYPES.POSITIONS
    ? []
    : (Array.isArray(items) ? items : []).filter((item) =>
        isAllowedByHeat(item, settings) && tierAllowedByHeat(item)
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
  selected = capSelection(selected, visibleTargetCount);

  const orderedSelection = isPremium
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

  const weeklySelection = prioritizeNewestPositionUnlocks(orderedSelection, selected, {
    type,
    limits,
    isPremium,
    weekNumber,
  });
  const cappedWeeklySelection = capSelection(weeklySelection, visibleTargetCount);

  const unlockedCount = isPremium
    ? Math.min(premiumUnlockedLimit, cappedWeeklySelection.length)
    : Math.min(freeUnlockedLimit, cappedWeeklySelection.length);

  const unlocked = cappedWeeklySelection
    .slice(0, unlockedCount)
    .map((item, index) => withUnlockedWeeklyMeta(item, type, index, weekNumber));

  const lockedPreviews = isPremium
    ? []
    : cappedWeeklySelection
        .slice(freeUnlockedLimit, freeUnlockedLimit + freeLockedPreviewLimit)
        .map((item, index) => toLockedPreview(item, type, index + freeUnlockedLimit, weekNumber));

  return {
    contentType: type,
    weekNumber,
    isPremium,
    premiumLibraryTotal: eligible.length,
    premiumUnlockedLimit,
    freeUnlockedLimit,
    freeLockedPreviewLimit,
    totalWeeklyPicks: cappedWeeklySelection.length,
    upgradeCopy: UPGRADE_COPY[type],
    unlocked,
    lockedPreviews,
    items: [...unlocked, ...lockedPreviews],
  };
};

export {
  CONTENT_TYPES,
  WEEKLY_LIMITS,
  UPGRADE_COPY,
  buildWeeklySet,
  buildPremiumPromptLibrary,
  getUserWeekNumber,
};
