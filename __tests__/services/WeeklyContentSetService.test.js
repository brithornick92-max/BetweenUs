import {
  CONTENT_TYPES,
  PREMIUM_LIBRARY_TOTALS,
  UPGRADE_COPY,
  buildPremiumPromptLibrary,
  buildWeeklySet,
  getUserWeekNumber,
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

const makeDateCatalog = (count = 24) =>
  Array.from({ length: count }, (_, index) =>
    makeDate(
      `d${index + 1}`,
      (index % 3) + 1,
      (index % 3) + 1,
      index % 2 === 0 ? 'mixed' : 'talking',
      `Date ${index + 1}`,
      ['romantic', 'after-dark', 'creative', 'adventure', 'health', 'cozy'][index % 6]
    )
  );

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

  it('builds premium prompt libraries inside weekly sets', () => {
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

  it('builds premium prompt libraries with 100 balanced starter cards', () => {
    const result = buildPremiumPromptLibrary(makePromptCatalog(50), {
      userId: 'premium-starter',
      userSettings: { maxHeat: 5 },
      userCreatedAt: TEST_DATE,
      date: TEST_DATE,
    });

    expect(result).toHaveLength(100);
    [1, 2, 3, 4, 5].forEach((heat) => {
      expect(result.filter((prompt) => prompt.heat === heat)).toHaveLength(20);
    });
  });

  it('adds 15 premium prompt cards each week across heat levels', () => {
    const result = buildPremiumPromptLibrary(makePromptCatalog(50), {
      userId: 'premium-week-one',
      userSettings: { maxHeat: 5 },
      userCreatedAt: TEST_DATE,
      date: new Date('2026-05-04T12:00:00.000Z'),
    });

    expect(result).toHaveLength(115);
    [1, 2, 3, 4, 5].forEach((heat) => {
      expect(result.filter((prompt) => prompt.heat === heat)).toHaveLength(23);
    });
  });

  it('builds free prompt welcome-week libraries with 5 usable cards and no locked previews', () => {
    const result = buildWeeklySet(makePromptCatalog(6), {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'free-user',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      date: TEST_DATE,
    });

    expect(result.freeUnlockedLimit).toBe(5);
    expect(result.freeLockedPreviewLimit).toBe(0);
    expect(result.unlocked).toHaveLength(5);
    expect(result.lockedPreviews).toHaveLength(0);
    expect(result.items).toHaveLength(5);
    expect(result.items.every((item) => item.requiresPremium === false)).toBe(true);
  });

  it('grows the free prompt library by 5 cards each week', () => {
    const result = buildWeeklySet(makePromptCatalog(8), {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'free-user',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      userCreatedAt: '2026-04-01T12:00:00.000Z',
      date: new Date('2026-04-30T12:00:00.000Z'),
    });

    expect(result.weekNumber).toBeGreaterThan(0);
    expect(result.freeUnlockedLimit).toBe(25);
    expect(result.unlocked).toHaveLength(25);
  });

  it('builds free date welcome-week libraries with 5 usable cards and no locked previews', () => {
    const result = buildWeeklySet(makeDateCatalog(), {
      contentType: CONTENT_TYPES.DATES,
      userId: 'free-user',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      date: TEST_DATE,
    });

    expect(result.freeUnlockedLimit).toBe(5);
    expect(result.freeLockedPreviewLimit).toBe(0);
    expect(result.unlocked).toHaveLength(5);
    expect(result.lockedPreviews).toHaveLength(0);
    expect(result.items).toHaveLength(5);
  });

  it('grows the free date library by 5 cards each week', () => {
    const result = buildWeeklySet(makeDateCatalog(24), {
      contentType: CONTENT_TYPES.DATES,
      userId: 'free-user',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      userCreatedAt: '2026-04-01T12:00:00.000Z',
      date: new Date('2026-04-30T12:00:00.000Z'),
    });

    expect(result.weekNumber).toBeGreaterThan(0);
    expect(result.freeUnlockedLimit).toBe(25);
    expect(result.unlocked).toHaveLength(24);
  });

  it('builds free position welcome-week libraries and prioritizes soft accessible picks first', () => {
    const result = buildWeeklySet(positions, {
      contentType: CONTENT_TYPES.POSITIONS,
      userId: 'free-user',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      date: TEST_DATE,
    });

    expect(result.unlocked).toHaveLength(1);
    expect(result.lockedPreviews).toHaveLength(0);
    expect(result.items).toHaveLength(1);
    expect(result.unlocked[0].heat).toBe(1);
    expect(result.unlocked[0].accessibility).toBe('low-mobility');
  });

  it('grows the free position library by 1 card each week', () => {
    const result = buildWeeklySet(positions, {
      contentType: CONTENT_TYPES.POSITIONS,
      userId: 'free-user',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      userCreatedAt: '2026-04-01T12:00:00.000Z',
      date: new Date('2026-04-30T12:00:00.000Z'),
    });

    expect(result.weekNumber).toBeGreaterThan(0);
    expect(result.freeUnlockedLimit).toBe(5);
    expect(result.unlocked).toHaveLength(5);
  });

  it('builds premium date libraries that start large and keep growing weekly', () => {
    const result = buildWeeklySet(makeDateCatalog(260), {
      contentType: CONTENT_TYPES.DATES,
      userId: 'premium-dates',
      isPremium: true,
      userSettings: { maxHeat: 5 },
      userCreatedAt: TEST_DATE,
      date: new Date('2026-05-04T12:00:00.000Z'),
    });

    expect(result.unlocked).toHaveLength(115);
    expect(result.lockedPreviews).toHaveLength(0);
    expect(result.items).toHaveLength(115);
  });

  it('builds premium position libraries that start large and keep growing weekly', () => {
    const positionCatalog = Array.from({ length: 20 }, (_, index) =>
      makePosition(
        `ip${index + 1}`,
        (index % 5) + 1,
        ['deep-connection', 'playful-energy', 'exploratory', 'trust-vulnerability', 'sensual-rhythm'][index % 5],
        ['low-mobility', 'standard', 'active'][index % 3],
        `Position ${index + 1}`
      )
    );

    const result = buildWeeklySet(positionCatalog, {
      contentType: CONTENT_TYPES.POSITIONS,
      userId: 'premium-positions',
      isPremium: true,
      userSettings: { maxHeat: 5 },
      userCreatedAt: TEST_DATE,
      date: new Date('2026-05-04T12:00:00.000Z'),
    });

    expect(result.unlocked).toHaveLength(13);
    expect(result.lockedPreviews).toHaveLength(0);
    expect(result.items).toHaveLength(13);
  });

  it('keeps upgrade copy aligned with the new growth model', () => {
    expect(UPGRADE_COPY.prompts.body).toContain('5 prompts');
    expect(UPGRADE_COPY.dates.body).toContain('5 date ideas');
    expect(UPGRADE_COPY.positions.body).toContain('1 sex position');
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

  it('uses local calendar days for personalized weekly rollovers', () => {
    expect(
      getUserWeekNumber(new Date(2026, 4, 5, 23, 45), new Date(2026, 4, 12, 0, 1))
    ).toBe(1);
    expect(
      getUserWeekNumber(new Date(2026, 4, 5, 23, 45), new Date(2026, 4, 11, 23, 59))
    ).toBe(0);
  });
});
