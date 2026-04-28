const DEFAULT_WEEK_START = '2026-01-05T00:00:00.000Z';

const CONTENT_TYPES = {
  PROMPTS: 'prompts',
  DATES: 'dates',
  POSITIONS: 'positions',
};

const WEEKLY_LIMITS = {
  [CONTENT_TYPES.PROMPTS]: {
    premium: 10,         // Premium gets 10 new prompts/week
    freeUnlocked: 3,     // Free gets 3 visible previews/week (tightened from 5)
    freeLockedPreview: 5,
  },
  [CONTENT_TYPES.DATES]: {
    premium: 8,          // Premium gets 8 new dates/week
    freeUnlocked: 3,     // Free gets 3 visible/week (tightened from 5)
    freeLockedPreview: 4,
  },
  [CONTENT_TYPES.POSITIONS]: {
    premium: 2,          // Premium gets 2 new positions/week
    freeUnlocked: 1,     // Free gets 1 visible/week
    freeLockedPreview: 1,
  },
};

const PREMIUM_LIBRARY_TOTALS = {
  [CONTENT_TYPES.PROMPTS]: 792,
  [CONTENT_TYPES.DATES]: 823,   // Updated to match dates.json
  [CONTENT_TYPES.POSITIONS]: 200,
};

const UPGRADE_COPY = {
  [CONTENT_TYPES.PROMPTS]: {
    headline: 'Unlock the full weekly conversation path',
    body: '+5 new prompts/week for free. Premium starts with 300 and unlocks +10/week.',
    cta: 'Unlock Premium Prompts',
  },
  [CONTENT_TYPES.DATES]: {
    headline: 'Unlock more date inspiration',
    body: '+3 new dates/week for free. Premium starts with 200 and unlocks +8/week.',
    cta: 'Unlock Premium Dates',
  },
  [CONTENT_TYPES.POSITIONS]: {
    headline: 'Unlock the full intimacy set',
    body: '+1 new position/week for free. Premium starts with 10 and unlocks +2/week.',
    cta: 'Unlock Premium Intimacy',
  },
};

const getHeat = (item) => Number(item?.heat ?? item?.heatLevel ?? item?.level ?? 1);

const getCategory = (item) =>
  item?.category ?? item?.type ?? item?.vibe ?? item?.theme ?? 'uncategorized';

const getDateLoad = (item) => Number(item?.load ?? item?.energy ?? item?.effort ?? 2);

const getDateStyle = (item) => item?.style ?? 'mixed';

const getTitle = (item) => item?.title ?? item?.text ?? item?.prompt ?? 'Untitled';

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

const getWeekNumberFromStart = (date = new Date(), startDate = DEFAULT_WEEK_START) => {
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

const pickBalancedDates = (items, limit, seed) => {
  const selected = [];
  const shuffled = sortSeeded(items, seed);

  const desiredSlots = [
    (item) => getDateLoad(item) === 1,
    (item) => getDateStyle(item) === 'talking',
    (item) => getHeat(item) === 2,
    (item) => getHeat(item) === 1,
    (item) => getHeat(item) >= 3,
  ];

  for (const matchesSlot of desiredSlots) {
    const pick = shuffled.find(matchesSlot);
    pushUnique(selected, pick, limit);
    if (selected.length >= limit) return selected;
  }

  for (const item of shuffled) {
    const sameLaneCount = selected.filter(
      (selectedItem) =>
        getHeat(selectedItem) === getHeat(item) &&
        getDateLoad(selectedItem) === getDateLoad(item) &&
        getDateStyle(selectedItem) === getDateStyle(item)
    ).length;

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
    date = new Date(),
    weekStart = DEFAULT_WEEK_START,
  } = {}
) => {
  const type = contentType || CONTENT_TYPES.PROMPTS;
  const limits = WEEKLY_LIMITS[type] || WEEKLY_LIMITS[CONTENT_TYPES.PROMPTS];
  const premiumLimit = limits.premium;
  const freeUnlockedLimit = limits.freeUnlocked;
  const freeLockedPreviewLimit = limits.freeLockedPreview;

  const settings = normalizeUserSettings(userSettings);
  const weekNumber = getWeekNumberFromStart(date, weekStart);
  const seed = `${type}:${userId || 'anonymous'}:${weekNumber}`;

  const eligible = (Array.isArray(items) ? items : []).filter((item) =>
    isAllowedByHeat(item, settings)
  );

  let selected;

  if (type === CONTENT_TYPES.DATES) {
    selected = pickBalancedDates(eligible, premiumLimit, seed);
  } else if (type === CONTENT_TYPES.POSITIONS) {
    selected = pickBalancedPositions(eligible, premiumLimit, seed);
  } else {
    selected = pickBalancedPrompts(eligible, premiumLimit, seed);
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

  const unlockedCount = isPremium ? weeklySelection.length : freeUnlockedLimit;

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
    freeUnlockedLimit,
    freeLockedPreviewLimit,
    totalWeeklyPicks: selected.length,
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
  getWeekNumberFromStart,
};
