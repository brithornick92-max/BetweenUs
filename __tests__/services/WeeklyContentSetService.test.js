import {
  CONTENT_TYPES,
  PREMIUM_LIBRARY_TOTALS,
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

const makeDate = (id, heat, load, style, title = id) => ({
  id,
  heat,
  load,
  style,
  title,
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
    makeDate('d1', 2, 1, 'mixed', 'Low effort mixed date'),
    makeDate('d2', 3, 2, 'talking', 'Talking date'),
    makeDate('d3', 2, 2, 'doing', 'Doing date'),
    makeDate('d4', 1, 3, 'doing', 'Higher load soft date'),
    makeDate('d5', 3, 3, 'mixed', 'Bold mixed date'),
    makeDate('d6', 1, 1, 'talking', 'Soft talking date'),
  ];

  const positions = [
    makePosition('i1', 1, 'deep-connection', 'low-mobility', 'Soft connected hold'),
    makePosition('i2', 2, 'playful-energy', 'low-mobility', 'Playful low mobility'),
    makePosition('i3', 3, 'exploratory', 'standard', 'Exploratory position'),
    makePosition('i4', 3, 'trust-vulnerability', 'standard', 'Trust position'),
    makePosition('i5', 3, 'sensual-rhythm', 'active', 'Rhythm position'),
    makePosition('i6', 2, 'deep-connection', 'standard', 'Connected standard'),
  ];

  it('builds premium prompt weekly sets with all 7 picks unlocked', () => {
    const result = buildWeeklySet(prompts, {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'user-1',
      isPremium: true,
      userSettings: { maxHeat: 5 },
      date: TEST_DATE,
    });

    expect(result.premiumLibraryTotal).toBe(PREMIUM_LIBRARY_TOTALS.prompts);
    expect(result.unlocked).toHaveLength(7);
    expect(result.lockedPreviews).toHaveLength(0);
    expect(result.items).toHaveLength(7);
    expect(result.items.every((item) => item.isLockedPreview === false)).toBe(true);
  });

  it('builds free prompt weekly previews with 2 unlocked and 5 locked previews', () => {
    const result = buildWeeklySet(prompts, {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'user-1',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      date: TEST_DATE,
    });

    expect(result.unlocked).toHaveLength(2);
    expect(result.lockedPreviews).toHaveLength(5);
    expect(result.items).toHaveLength(7);
    expect(result.lockedPreviews.every((item) => item.isLockedPreview === true)).toBe(true);
    expect(result.lockedPreviews.every((item) => item.requiresPremium === true)).toBe(true);
  });

  it('builds free date weekly previews with 1 unlocked and prioritizes lower-load picks first', () => {
    const result = buildWeeklySet(dates, {
      contentType: CONTENT_TYPES.DATES,
      userId: 'user-1',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      date: TEST_DATE,
    });

    expect(result.unlocked).toHaveLength(1);
    expect(result.lockedPreviews).toHaveLength(4);
    expect(result.items).toHaveLength(5);
    expect(result.unlocked[0].load).toBe(1);
  });

  it('builds free position weekly previews with 1 unlocked and prioritizes soft accessible picks first', () => {
    const result = buildWeeklySet(positions, {
      contentType: CONTENT_TYPES.POSITIONS,
      userId: 'user-1',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      date: TEST_DATE,
    });

    expect(result.unlocked).toHaveLength(1);
    expect(result.lockedPreviews).toHaveLength(4);
    expect(result.items).toHaveLength(5);
    expect(result.unlocked[0].heat).toBe(1);
    expect(result.unlocked[0].accessibility).toBe('low-mobility');
  });


  it('free locked previews expose preview metadata without marking them unlocked', () => {
    const result = buildWeeklySet(prompts, {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'user-1',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      date: TEST_DATE,
    });

    expect(result.lockedPreviews.length).toBeGreaterThan(0);

    result.lockedPreviews.forEach((item) => {
      expect(item.isLockedPreview).toBe(true);
      expect(item.requiresPremium).toBe(true);
      expect(item.previewText).toBeTruthy();
      expect(item.weeklySetMeta.isLockedPreview).toBe(true);
    });
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
