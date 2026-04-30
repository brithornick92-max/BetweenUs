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

  const dates = [
    makeDate('d1', 2, 1, 'mixed', 'Low effort mixed date', 'romantic'),
    makeDate('d2', 3, 2, 'talking', 'Talking date', 'after-dark'),
    makeDate('d3', 2, 2, 'doing', 'Doing date', 'creative'),
    makeDate('d4', 1, 3, 'doing', 'Higher load soft date', 'adventure'),
    makeDate('d5', 3, 3, 'mixed', 'Bold mixed date', 'health'),
    makeDate('d6', 1, 1, 'talking', 'Soft talking date', 'cozy'),
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

  it('builds free prompt welcome-week decks with 5 usable cards and no locked previews', () => {
    const promptCatalog = [
      ...prompts,
      makePrompt('p10', 4, 'visual'),
      makePrompt('p11', 5, 'kinky'),
      makePrompt('p12', 5, 'roleplay'),
    ];
    const result = buildWeeklySet(promptCatalog, {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'user-1',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      date: TEST_DATE,
    });

    expect(result.freeUnlockedLimit).toBe(5);
    expect(result.freeLockedPreviewLimit).toBe(0);
    expect(result.unlocked).toHaveLength(5);
    expect(result.lockedPreviews).toHaveLength(0);
    expect(result.items).toHaveLength(5);
    expect(result.items.every((item) => item.isLockedPreview === false)).toBe(true);
    expect(result.items.every((item) => item.requiresPremium === false)).toBe(true);
  });

  it('builds free date welcome-week decks with 5 usable cards and no locked previews', () => {
    const result = buildWeeklySet(dates, {
      contentType: CONTENT_TYPES.DATES,
      userId: 'user-1',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      date: TEST_DATE,
    });

    expect(result.freeUnlockedLimit).toBe(5);
    expect(result.freeLockedPreviewLimit).toBe(0);
    expect(result.unlocked).toHaveLength(5);
    expect(result.lockedPreviews).toHaveLength(0);
    expect(result.items).toHaveLength(5);
    expect(new Set(result.unlocked.map((item) => item.category)).size).toBeGreaterThanOrEqual(3);
    expect(result.items.every((item) => item.isLockedPreview === false)).toBe(true);
    expect(result.items.every((item) => item.requiresPremium === false)).toBe(true);
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
    expect(result.lockedPreviews).toHaveLength(1);
    expect(result.items).toHaveLength(6);
    expect(result.unlocked[0].heat).toBe(1);
    expect(result.unlocked[0].accessibility).toBe('low-mobility');
  });


  it('caps free prompt sets at 3 cards after welcome week', () => {
    const result = buildWeeklySet(prompts, {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'user-1',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      userCreatedAt: '2026-04-01T12:00:00.000Z',
      date: TEST_DATE,
    });

    expect(result.weekNumber).toBeGreaterThan(0);
    expect(result.freeUnlockedLimit).toBe(3);
    expect(result.freeLockedPreviewLimit).toBe(0);
    expect(result.unlocked).toHaveLength(3);
    expect(result.lockedPreviews).toHaveLength(0);
    expect(result.items).toHaveLength(3);
  });

  it('caps free date sets at 3 cards after welcome week', () => {
    const result = buildWeeklySet(dates, {
      contentType: CONTENT_TYPES.DATES,
      userId: 'user-1',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      userCreatedAt: '2026-04-01T12:00:00.000Z',
      date: TEST_DATE,
    });

    expect(result.weekNumber).toBeGreaterThan(0);
    expect(result.freeUnlockedLimit).toBe(3);
    expect(result.freeLockedPreviewLimit).toBe(0);
    expect(result.unlocked).toHaveLength(3);
    expect(result.lockedPreviews).toHaveLength(0);
    expect(result.items).toHaveLength(3);
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
