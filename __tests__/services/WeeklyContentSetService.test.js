import {
  CONTENT_TYPES,
  PREMIUM_LIBRARY_TOTALS,
  UPGRADE_COPY,
  buildPremiumPromptLibrary,
  buildWeeklySet,
  getWeekNumberFromStart,
} from '../../services/WeeklyContentSetService';

const TEST_DATE = new Date('2026-04-27T12:00:00.000Z');

const makePrompt = (id, heat, category) => ({
  id,
  heat,
  category,
  text: `${category} prompt ${id}`,
});

const makePromptCatalog = (perHeat = 50) =>
  [1, 2, 3, 4, 5].flatMap((heat) =>
    Array.from({ length: perHeat }, (_, index) =>
      makePrompt(`p${heat}-${index + 1}`, heat, `heat-${heat}`)
    )
  );

const makeDate = (id, heat, load, style, title = id, category = 'romantic') => ({
  id,
  heat,
  load,
  style,
  title,
  category,
});

const makePosition = (id, heat, category, accessibility, title = id) => ({
  id,
  heat,
  category,
  accessibility,
  title,
  shortSummary: `${title} summary`,
});

describe('WeeklyContentSetService', () => {
  const prompts = [
    makePrompt('p1', 1, 'emotional'),
    makePrompt('p2', 2, 'playful'),
    makePrompt('p3', 2, 'romance'),
    makePrompt('p4', 3, 'future'),
    makePrompt('p5', 3, 'memory'),
    makePrompt('p6', 4, 'sensory'),
    makePrompt('p7', 5, 'physical'),
    makePrompt('p8', 2, 'fantasy'),
    makePrompt('p9', 1, 'location'),
  ];

  const positions = [
    makePosition('i1', 1, 'deep-connection', 'low-mobility', 'Soft connected hold'),
    makePosition('i2', 2, 'playful-energy', 'low-mobility', 'Playful low mobility'),
    makePosition('i3', 3, 'exploratory', 'standard', 'Exploratory position'),
    makePosition('i4', 3, 'trust-vulnerability', 'standard', 'Trust position'),
    makePosition('i5', 3, 'sensual-rhythm', 'active', 'Rhythm position'),
    makePosition('i6', 2, 'deep-connection', 'standard', 'Connected standard'),
  ];

  it('builds premium prompt weekly sets with weekly featured picks unlocked', () => {
    const result = buildWeeklySet(prompts, {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'user-1',
      isPremium: true,
      userSettings: { maxHeat: 5 },
      date: TEST_DATE,
    });

    expect(result.premiumLibraryTotal).toBe(PREMIUM_LIBRARY_TOTALS.prompts);
    expect(result.unlocked).toHaveLength(9);
    expect(result.lockedPreviews).toHaveLength(0);
    expect(result.items).toHaveLength(9);
    expect(result.items.every((item) => item.isLockedPreview === false)).toBe(true);
  });

  it('builds premium prompt libraries with 200 balanced starter cards', () => {
    const result = buildPremiumPromptLibrary(makePromptCatalog(50), {
      userId: 'premium-starter',
      userSettings: { maxHeat: 5 },
      userCreatedAt: TEST_DATE,
      date: TEST_DATE,
    });

    expect(result).toHaveLength(200);
    [1, 2, 3, 4, 5].forEach((heat) => {
      expect(result.filter((prompt) => prompt.heat === heat)).toHaveLength(40);
    });
  });

  it('adds 10 premium prompt cards each week across heat levels', () => {
    const result = buildPremiumPromptLibrary(makePromptCatalog(50), {
      userId: 'premium-week-one',
      userSettings: { maxHeat: 5 },
      userCreatedAt: TEST_DATE,
      date: new Date('2026-05-04T12:00:00.000Z'),
    });

    expect(result).toHaveLength(210);
    [1, 2, 3, 4, 5].forEach((heat) => {
      expect(result.filter((prompt) => prompt.heat === heat)).toHaveLength(42);
    });
  });

  it('builds free prompt welcome-week decks with 20 usable cards and no locked previews', () => {
    const promptCatalog = makePromptCatalog(6);
    const result = buildWeeklySet(promptCatalog, {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'user-1',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      date: TEST_DATE,
    });

    expect(result.freeUnlockedLimit).toBe(20);
    expect(result.freeLockedPreviewLimit).toBe(0);
    expect(result.unlocked).toHaveLength(20);
    expect(result.lockedPreviews).toHaveLength(0);
    expect(result.items).toHaveLength(20);
    expect(result.items.every((item) => item.isLockedPreview === false)).toBe(true);
    expect(result.items.every((item) => item.requiresPremium === false)).toBe(true);
  });

  it('pads free prompt decks back to 20 cards when boundaries leave too few unique picks', () => {
    const promptCatalog = makePromptCatalog(6);
    const result = buildWeeklySet(promptCatalog, {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'tight-boundaries',
      isPremium: false,
      userSettings: { maxHeat: 2 },
      date: TEST_DATE,
    });

    const repeatedFill = result.unlocked.filter((item) => item.weeklySetMeta?.isRepeatedFill);
    const eligibleIds = new Set(promptCatalog.filter((item) => item.heat <= 2).map((item) => item.id));

    expect(result.unlocked).toHaveLength(20);
    expect(repeatedFill.length).toBeGreaterThan(0);
    expect(repeatedFill.every((item) => item.weeklySetMeta?.repeatedFillIndex > 0)).toBe(true);
    expect(result.unlocked.every((item) => eligibleIds.has(item.id))).toBe(true);
  });

  it('builds free date welcome-week decks with 20 usable cards and no locked previews', () => {
    const dateCatalog = Array.from({ length: 24 }, (_, index) =>
      makeDate(
        `d${index + 1}`,
        (index % 3) + 1,
        (index % 3) + 1,
        index % 2 === 0 ? 'mixed' : 'talking',
        `Date ${index + 1}`,
        ['romantic', 'after-dark', 'creative', 'adventure', 'health', 'cozy'][index % 6]
      )
    );

    const result = buildWeeklySet(dateCatalog, {
      contentType: CONTENT_TYPES.DATES,
      userId: 'user-1',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      date: TEST_DATE,
    });

    expect(result.freeUnlockedLimit).toBe(20);
    expect(result.freeLockedPreviewLimit).toBe(0);
    expect(result.unlocked).toHaveLength(20);
    expect(result.lockedPreviews).toHaveLength(0);
    expect(result.items).toHaveLength(20);
    expect(new Set(result.unlocked.map((item) => item.category)).size).toBeGreaterThanOrEqual(3);
    expect(result.items.every((item) => item.isLockedPreview === false)).toBe(true);
    expect(result.items.every((item) => item.requiresPremium === false)).toBe(true);
  });

  it('pads free date decks back to 20 cards when boundaries leave too few unique picks', () => {
    const dateCatalog = Array.from({ length: 9 }, (_, index) =>
      makeDate(
        `d${index + 1}`,
        1,
        (index % 3) + 1,
        index % 2 === 0 ? 'mixed' : 'talking',
        `Date ${index + 1}`,
        ['romantic', 'after-dark', 'creative'][index % 3]
      )
    );

    const result = buildWeeklySet(dateCatalog, {
      contentType: CONTENT_TYPES.DATES,
      userId: 'tight-boundaries',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      date: TEST_DATE,
    });

    expect(result.unlocked).toHaveLength(20);
    expect(result.unlocked.some((item) => item.weeklySetMeta?.isRepeatedFill)).toBe(true);
    expect(result.unlocked.every((item) => dateCatalog.some((candidate) => candidate.id === item.id))).toBe(true);
  });

  it('builds free position welcome-week previews and prioritizes soft accessible picks first', () => {
    const result = buildWeeklySet(positions, {
      contentType: CONTENT_TYPES.POSITIONS,
      userId: 'user-1',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      date: TEST_DATE,
    });

    expect(result.unlocked).toHaveLength(5);
    expect(result.lockedPreviews).toHaveLength(0);
    expect(result.items).toHaveLength(5);
    expect(result.unlocked[0].heat).toBe(1);
    expect(result.unlocked[0].accessibility).toBe('low-mobility');
  });

  it('does not pad sex positions with duplicate ids when the eligible pool is smaller than five', () => {
    const limitedPositions = positions.slice(0, 3);
    const result = buildWeeklySet(limitedPositions, {
      contentType: CONTENT_TYPES.POSITIONS,
      userId: 'tight-boundaries',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      date: TEST_DATE,
    });

    expect(result.unlocked).toHaveLength(3);
    expect(result.unlocked.some((item) => item.weeklySetMeta?.isRepeatedFill)).toBe(false);
  });


  it('keeps free prompt sets at 20 cards after welcome week', () => {
    const result = buildWeeklySet(makePromptCatalog(6), {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'user-1',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      userCreatedAt: '2026-04-01T12:00:00.000Z',
      date: TEST_DATE,
    });

    expect(result.weekNumber).toBeGreaterThan(0);
    expect(result.freeUnlockedLimit).toBe(20);
    expect(result.freeLockedPreviewLimit).toBe(0);
    expect(result.unlocked).toHaveLength(20);
    expect(result.lockedPreviews).toHaveLength(0);
    expect(result.items).toHaveLength(20);
  });

  it('keeps free date sets at 20 cards after welcome week', () => {
    const dateCatalog = Array.from({ length: 24 }, (_, index) =>
      makeDate(
        `d${index + 1}`,
        (index % 3) + 1,
        (index % 3) + 1,
        index % 2 === 0 ? 'mixed' : 'talking',
        `Date ${index + 1}`,
        ['romantic', 'after-dark', 'creative', 'adventure', 'health', 'cozy'][index % 6]
      )
    );

    const result = buildWeeklySet(dateCatalog, {
      contentType: CONTENT_TYPES.DATES,
      userId: 'user-1',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      userCreatedAt: '2026-04-01T12:00:00.000Z',
      date: TEST_DATE,
    });

    expect(result.weekNumber).toBeGreaterThan(0);
    expect(result.freeUnlockedLimit).toBe(20);
    expect(result.freeLockedPreviewLimit).toBe(0);
    expect(result.unlocked).toHaveLength(20);
    expect(result.lockedPreviews).toHaveLength(0);
    expect(result.items).toHaveLength(20);
  });

  it('does not keep stale numeric free-copy in prompt or date upgrade copy', () => {
    expect(UPGRADE_COPY.prompts.body).not.toMatch(/\b10\b/);
    expect(UPGRADE_COPY.dates.body).not.toMatch(/\b10\b/);
  });

  it('respects maxHeat when building weekly sets', () => {
    const result = buildWeeklySet(prompts, {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'user-1',
      isPremium: true,
      userSettings: { maxHeat: 2 },
      date: TEST_DATE,
    });

    expect(result.items.every((item) => item.heat <= 2)).toBe(true);
  });

  it('returns stable picks for the same user and week', () => {
    const first = buildWeeklySet(prompts, {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'stable-user',
      isPremium: true,
      userSettings: { maxHeat: 5 },
      date: TEST_DATE,
    });

    const second = buildWeeklySet(prompts, {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'stable-user',
      isPremium: true,
      userSettings: { maxHeat: 5 },
      date: TEST_DATE,
    });

    expect(second.items.map((item) => item.id)).toEqual(first.items.map((item) => item.id));
  });

  it('computes week numbers from the shared weekly start date', () => {
    expect(getWeekNumberFromStart(new Date('2026-01-05T12:00:00.000Z'))).toBe(0);
    expect(getWeekNumberFromStart(new Date('2026-01-12T12:00:00.000Z'))).toBe(1);
    expect(getWeekNumberFromStart(new Date('2026-01-26T12:00:00.000Z'))).toBe(3);
  });
});
