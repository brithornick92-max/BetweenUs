import {
  CONTENT_TYPES,
  UPGRADE_COPY,
  WEEKLY_LIMITS,
  buildPremiumPromptLibrary,
  buildWeeklySet,
  getUserWeekNumber,
} from '../../services/WeeklyContentSetService';
import { FREE_LIMITS, PREMIUM_LIMITS } from '../../utils/featureFlags';

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

const makePositionCatalog = (count = 120) =>
  Array.from({ length: count }, (_, index) =>
    makePosition(
      `position-${index + 1}`,
      (index % 5) + 1,
      ['deep-connection', 'playful-energy', 'exploratory', 'trust-vulnerability', 'sensual-rhythm'][index % 5],
      ['low-mobility', 'standard', 'active'][index % 3],
      `Position ${index + 1}`
    )
  );

const cumulativeLimit = ({ start, weekly, weekNumber }) => start + (weekly * weekNumber);

const countNewIds = (previousItems, currentItems) => {
  const previousIds = new Set(previousItems.map((item) => item.id));
  return currentItems.filter((item) => !previousIds.has(item.id)).length;
};

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
    makePosition('i3', 2, 'exploratory', 'standard', 'Exploratory position'),
    makePosition('i4', 2, 'trust-vulnerability', 'standard', 'Trust position'),
    makePosition('i5', 2, 'sensual-rhythm', 'active', 'Rhythm position'),
    makePosition('i6', 2, 'deep-connection', 'standard', 'Connected standard'),
  ];

  it('keeps weekly release counts aligned with canonical feature limits', () => {
    expect(WEEKLY_LIMITS[CONTENT_TYPES.PROMPTS]).toMatchObject({
      freeWelcomePack: FREE_LIMITS.WEEK_0_PROMPTS,
      freeOngoing: FREE_LIMITS.WEEKLY_PROMPTS,
      premiumStart: PREMIUM_LIMITS.WEEK_0_PROMPTS,
      premium: PREMIUM_LIMITS.WEEKLY_PROMPTS,
    });
    expect(WEEKLY_LIMITS[CONTENT_TYPES.DATES]).toMatchObject({
      freeWelcomePack: FREE_LIMITS.WEEK_0_DATES,
      freeOngoing: FREE_LIMITS.WEEKLY_DATES,
      premiumStart: PREMIUM_LIMITS.WEEK_0_DATES,
      premium: PREMIUM_LIMITS.WEEKLY_DATES,
    });
    expect(WEEKLY_LIMITS[CONTENT_TYPES.POSITIONS]).toMatchObject({
      freeWelcomePack: FREE_LIMITS.WEEK_0_POSITIONS,
      freeOngoing: FREE_LIMITS.WEEKLY_POSITIONS,
      premiumStart: PREMIUM_LIMITS.WEEK_0_POSITIONS,
      premium: PREMIUM_LIMITS.WEEKLY_POSITIONS,
    });
  });

  it('never exceeds cumulative free or premium entitlement caps', () => {
    const date = new Date('2026-05-25T12:00:00.000Z');
    const weekNumber = getUserWeekNumber(TEST_DATE, date);
    const scenarios = [
      {
        contentType: CONTENT_TYPES.PROMPTS,
        items: makePromptCatalog(120),
        freeStart: FREE_LIMITS.WEEK_0_PROMPTS,
        freeWeekly: FREE_LIMITS.WEEKLY_PROMPTS,
        premiumStart: PREMIUM_LIMITS.WEEK_0_PROMPTS,
        premiumWeekly: PREMIUM_LIMITS.WEEKLY_PROMPTS,
      },
      {
        contentType: CONTENT_TYPES.DATES,
        items: makeDateCatalog(300),
        freeStart: FREE_LIMITS.WEEK_0_DATES,
        freeWeekly: FREE_LIMITS.WEEKLY_DATES,
        premiumStart: PREMIUM_LIMITS.WEEK_0_DATES,
        premiumWeekly: PREMIUM_LIMITS.WEEKLY_DATES,
      },
      {
        contentType: CONTENT_TYPES.POSITIONS,
        items: makePositionCatalog(120),
        freeStart: FREE_LIMITS.WEEK_0_POSITIONS,
        freeWeekly: FREE_LIMITS.WEEKLY_POSITIONS,
        premiumStart: PREMIUM_LIMITS.WEEK_0_POSITIONS,
        premiumWeekly: PREMIUM_LIMITS.WEEKLY_POSITIONS,
      },
    ];

    scenarios.forEach((scenario) => {
      const freeCap = cumulativeLimit({
        start: scenario.freeStart,
        weekly: scenario.freeWeekly,
        weekNumber,
      });
      const premiumCap = cumulativeLimit({
        start: scenario.premiumStart,
        weekly: scenario.premiumWeekly,
        weekNumber,
      });

      const freeSet = buildWeeklySet(scenario.items, {
        contentType: scenario.contentType,
        userId: `free-${scenario.contentType}`,
        isPremium: false,
        userSettings: { maxHeat: 5 },
        userCreatedAt: TEST_DATE,
        date,
      });
      const premiumSet = buildWeeklySet(scenario.items, {
        contentType: scenario.contentType,
        userId: `premium-${scenario.contentType}`,
        isPremium: true,
        userSettings: { maxHeat: 5 },
        userCreatedAt: TEST_DATE,
        date,
      });

      expect(freeSet.items.length).toBeLessThanOrEqual(freeCap);
      expect(freeSet.unlocked.length).toBeLessThanOrEqual(freeCap);
      expect(freeSet.lockedPreviews).toHaveLength(0);
      expect(premiumSet.items.length).toBeLessThanOrEqual(premiumCap);
      expect(premiumSet.unlocked.length).toBeLessThanOrEqual(premiumCap);
      expect(premiumSet.lockedPreviews).toHaveLength(0);
    });
  });

  it('does not add more than the weekly drop between adjacent weeks', () => {
    const previousDate = new Date('2026-05-03T12:00:00.000Z');
    const currentDate = new Date('2026-05-04T12:00:00.000Z');
    const scenarios = [
      {
        contentType: CONTENT_TYPES.PROMPTS,
        items: makePromptCatalog(120),
        freeWeekly: FREE_LIMITS.WEEKLY_PROMPTS,
        premiumWeekly: PREMIUM_LIMITS.WEEKLY_PROMPTS,
      },
      {
        contentType: CONTENT_TYPES.DATES,
        items: makeDateCatalog(300),
        freeWeekly: FREE_LIMITS.WEEKLY_DATES,
        premiumWeekly: PREMIUM_LIMITS.WEEKLY_DATES,
      },
      {
        contentType: CONTENT_TYPES.POSITIONS,
        items: makePositionCatalog(120),
        freeWeekly: FREE_LIMITS.WEEKLY_POSITIONS,
        premiumWeekly: PREMIUM_LIMITS.WEEKLY_POSITIONS,
      },
    ];

    scenarios.forEach((scenario) => {
      const common = {
        contentType: scenario.contentType,
        userSettings: { maxHeat: 5 },
        userCreatedAt: TEST_DATE,
      };
      const previousFree = buildWeeklySet(scenario.items, {
        ...common,
        userId: `free-${scenario.contentType}`,
        isPremium: false,
        date: previousDate,
      });
      const currentFree = buildWeeklySet(scenario.items, {
        ...common,
        userId: `free-${scenario.contentType}`,
        isPremium: false,
        date: currentDate,
      });
      const previousPremium = buildWeeklySet(scenario.items, {
        ...common,
        userId: `premium-${scenario.contentType}`,
        isPremium: true,
        date: previousDate,
      });
      const currentPremium = buildWeeklySet(scenario.items, {
        ...common,
        userId: `premium-${scenario.contentType}`,
        isPremium: true,
        date: currentDate,
      });

      expect(countNewIds(previousFree.items, currentFree.items)).toBeLessThanOrEqual(scenario.freeWeekly);
      expect(countNewIds(previousPremium.items, currentPremium.items)).toBeLessThanOrEqual(scenario.premiumWeekly);
    });
  });

  it('builds premium prompt libraries inside weekly sets', () => {
    const result = buildWeeklySet(prompts, {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'user-1',
      isPremium: true,
      userSettings: { maxHeat: 5 },
      date: TEST_DATE,
    });

    expect(result.premiumLibraryTotal).toBe(prompts.length);
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

  it('builds free prompt welcome-week libraries with 20 usable cards and no locked previews', () => {
    const result = buildWeeklySet(makePromptCatalog(12), {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'free-user',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      date: TEST_DATE,
    });

    expect(result.freeUnlockedLimit).toBe(20);
    expect(result.freeLockedPreviewLimit).toBe(0);
    expect(result.unlocked).toHaveLength(20);
    expect(result.lockedPreviews).toHaveLength(0);
    expect(result.items).toHaveLength(20);
    expect(result.items.every((item) => item.requiresPremium === false)).toBe(true);
  });

  it('grows the free prompt library by 5 cards each week', () => {
    const result = buildWeeklySet(makePromptCatalog(30), {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'free-user',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      userCreatedAt: '2026-04-01T12:00:00.000Z',
      date: new Date('2026-04-30T12:00:00.000Z'),
    });

    expect(result.weekNumber).toBeGreaterThan(0);
    expect(result.freeUnlockedLimit).toBe(40);
    expect(result.unlocked).toHaveLength(40);
  });

  it('builds free date welcome-week libraries with 20 usable cards and no locked previews', () => {
    const result = buildWeeklySet(makeDateCatalog(40), {
      contentType: CONTENT_TYPES.DATES,
      userId: 'free-user',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      date: TEST_DATE,
    });

    expect(result.freeUnlockedLimit).toBe(20);
    expect(result.freeLockedPreviewLimit).toBe(0);
    expect(result.unlocked).toHaveLength(20);
    expect(result.lockedPreviews).toHaveLength(0);
    expect(result.items).toHaveLength(20);
  });

  it('grows the free date library by 5 cards each week', () => {
    const result = buildWeeklySet(makeDateCatalog(80), {
      contentType: CONTENT_TYPES.DATES,
      userId: 'free-user',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      userCreatedAt: '2026-04-01T12:00:00.000Z',
      date: new Date('2026-04-30T12:00:00.000Z'),
    });

    expect(result.weekNumber).toBeGreaterThan(0);
    expect(result.freeUnlockedLimit).toBe(40);
    expect(result.unlocked).toHaveLength(40);
  });

  it('builds free position welcome-week libraries and prioritizes soft accessible picks first', () => {
    const result = buildWeeklySet(positions, {
      contentType: CONTENT_TYPES.POSITIONS,
      userId: 'free-user',
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

  it('hides position weekly sets when spicy content is hidden', () => {
    const result = buildWeeklySet(positions, {
      contentType: CONTENT_TYPES.POSITIONS,
      userId: 'free-user',
      isPremium: false,
      userSettings: {
        boundaries: { hideSpicy: true },
        heatLevelRangeId: 'gentle',
        allowedHeatLevels: [1, 2, 3],
      },
      date: TEST_DATE,
    });

    expect(result.premiumLibraryTotal).toBe(0);
    expect(result.totalWeeklyPicks).toBe(0);
    expect(result.unlocked).toHaveLength(0);
    expect(result.lockedPreviews).toHaveLength(0);
    expect(result.items).toHaveLength(0);
  });

  it('grows the free position library by 1 card each week', () => {
    const positionCatalog = Array.from({ length: 12 }, (_, index) =>
      makePosition(
        `free-ip${index + 1}`,
        (index % 2) + 1,
        ['deep-connection', 'playful-energy', 'exploratory', 'trust-vulnerability', 'sensual-rhythm'][index % 5],
        ['low-mobility', 'standard', 'active'][index % 3],
        `Free position ${index + 1}`
      )
    );

    const result = buildWeeklySet(positionCatalog, {
      contentType: CONTENT_TYPES.POSITIONS,
      userId: 'free-user',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      userCreatedAt: '2026-04-01T12:00:00.000Z',
      date: new Date('2026-04-30T12:00:00.000Z'),
    });

    expect(result.weekNumber).toBeGreaterThan(0);
    expect(result.freeUnlockedLimit).toBe(9);
    expect(result.unlocked).toHaveLength(9);
  });

  it('puts the newest free weekly position unlock first', () => {
    const positionCatalog = Array.from({ length: 12 }, (_, index) =>
      makePosition(
        `free-ip${index + 1}`,
        (index % 2) + 1,
        ['deep-connection', 'playful-energy', 'exploratory', 'trust-vulnerability', 'sensual-rhythm'][index % 5],
        ['low-mobility', 'standard', 'active'][index % 3],
        `Free position ${index + 1}`
      )
    );
    const commonOptions = {
      contentType: CONTENT_TYPES.POSITIONS,
      userId: 'free-user',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      userCreatedAt: '2026-04-01T12:00:00.000Z',
    };

    const previous = buildWeeklySet(positionCatalog, {
      ...commonOptions,
      date: new Date('2026-04-23T12:00:00.000Z'),
    });
    const current = buildWeeklySet(positionCatalog, {
      ...commonOptions,
      date: new Date('2026-04-30T12:00:00.000Z'),
    });
    const previousIds = new Set(previous.items.map((item) => item.id));
    const newest = current.items.filter((item) => !previousIds.has(item.id));

    expect(newest).toHaveLength(1);
    expect(current.items[0].id).toBe(newest[0].id);
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

  it('puts the newest 3 premium weekly position unlocks first', () => {
    const positionCatalog = Array.from({ length: 20 }, (_, index) =>
      makePosition(
        `premium-ip${index + 1}`,
        (index % 3) + 1,
        ['deep-connection', 'playful-energy', 'exploratory', 'trust-vulnerability', 'sensual-rhythm'][index % 5],
        ['low-mobility', 'standard', 'active'][index % 3],
        `Premium position ${index + 1}`
      )
    );
    const commonOptions = {
      contentType: CONTENT_TYPES.POSITIONS,
      userId: 'premium-positions',
      isPremium: true,
      userSettings: { maxHeat: 5 },
      userCreatedAt: TEST_DATE,
    };

    const previous = buildWeeklySet(positionCatalog, {
      ...commonOptions,
      date: new Date('2026-05-03T12:00:00.000Z'),
    });
    const current = buildWeeklySet(positionCatalog, {
      ...commonOptions,
      date: new Date('2026-05-04T12:00:00.000Z'),
    });
    const previousIds = new Set(previous.items.map((item) => item.id));
    const newest = current.items.filter((item) => !previousIds.has(item.id));

    expect(newest).toHaveLength(3);
    expect(current.items.slice(0, 3).map((item) => item.id).sort()).toEqual(
      newest.map((item) => item.id).sort()
    );
  });

  it('keeps upgrade copy aligned with the new growth model', () => {
    expect(UPGRADE_COPY.prompts.body).toContain('add 5 more each week');
    expect(UPGRADE_COPY.dates.body).toContain('add 5 more each week');
    expect(UPGRADE_COPY.prompts.body).toContain('20 lower-intensity prompts');
    expect(UPGRADE_COPY.dates.body).toContain('20 lower-intensity date ideas');
    expect(UPGRADE_COPY.positions.body).toContain('Free users start with 5 lower-intensity sex positions');
    expect(UPGRADE_COPY.positions.body).toContain('Premium users start with 10 positions');
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

  it('keeps free weekly libraries in the lower-intensity range', () => {
    const freePrompts = buildWeeklySet(makePromptCatalog(20), {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'free-prompt-safety',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      date: TEST_DATE,
    });
    const freeDates = buildWeeklySet(makeDateCatalog(80), {
      contentType: CONTENT_TYPES.DATES,
      userId: 'free-date-safety',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      date: TEST_DATE,
    });
    const freePositions = buildWeeklySet(makePositionCatalog(80), {
      contentType: CONTENT_TYPES.POSITIONS,
      userId: 'free-position-safety',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      date: TEST_DATE,
    });

    expect(freePrompts.items.every((item) => item.heat <= 2)).toBe(true);
    expect(freeDates.items.every((item) => item.heat <= 2)).toBe(true);
    expect(freePositions.items.every((item) => item.heat <= 2)).toBe(true);
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

  it('keeps earlier free cards when the cumulative prompt library grows', () => {
    const catalog = makePromptCatalog(20);
    const baseOptions = {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'growing-free-user',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      userCreatedAt: '2026-04-30T12:00:00.000Z',
    };
    const signupWeek = buildWeeklySet(catalog, {
      ...baseOptions,
      date: new Date('2026-05-03T12:00:00.000Z'),
    });
    const nextWeek = buildWeeklySet(catalog, {
      ...baseOptions,
      date: new Date('2026-05-07T12:00:00.000Z'),
    });
    const nextWeekIds = new Set(nextWeek.items.map((item) => item.id));

    expect(signupWeek.items).toHaveLength(20);
    expect(nextWeek.items).toHaveLength(25);
    expect(signupWeek.items.every((item) => nextWeekIds.has(item.id))).toBe(true);
  });

  it('uses local calendar days for personalized weekly rollovers', () => {
    expect(
      getUserWeekNumber(new Date(2026, 4, 5, 23, 45), new Date(2026, 4, 12, 0, 1))
    ).toBe(1);
    expect(
      getUserWeekNumber(new Date(2026, 4, 5, 23, 45), new Date(2026, 4, 11, 23, 59))
    ).toBe(0);
  });

  it('uses the explicit date component from server timestamp strings', () => {
    expect(
      getUserWeekNumber('2026-05-05T23:45:00.000Z', '2026-05-12T00:01:00.000Z')
    ).toBe(1);
    expect(
      getUserWeekNumber('2026-05-05T23:45:00.000Z', '2026-05-11T23:59:00.000Z')
    ).toBe(0);
  });
});
