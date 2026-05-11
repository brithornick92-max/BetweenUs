import { CONTENT_TYPES } from '../../services/WeeklyContentSetService';
import {
  getStableFreeWeeklyDeck,
  getStableFreeWeeklyDeckItemIds,
  isItemInStableFreeWeeklyDeck,
} from '../../utils/freeWeeklyDeckAccess';
import { storage } from '../../utils/storage';

jest.mock('../../utils/storage', () => ({
  STORAGE_KEYS: {
    WEEKLY_CONTENT_ALLOCATIONS: 'weeklyContentAllocations',
  },
  storage: {
    get: jest.fn(async () => ({})),
    set: jest.fn(async () => {}),
  },
}));

const makePrompt = (id, heat = 1) => ({
  id,
  heat,
  category: `category-${id}`,
  text: `Prompt ${id}`,
});

const makeDate = (id, heat = 1) => ({
  id,
  heat,
  load: 1,
  style: 'mixed',
  category: `category-${id}`,
  title: `Date ${id}`,
});

describe('freeWeeklyDeckAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const store = {};
    storage.get.mockImplementation(async (key, fallback) => store[key] ?? fallback);
    storage.set.mockImplementation(async (key, value) => {
      store[key] = value;
    });
  });

  it('builds a 20-card free prompt library in signup week', async () => {
    const prompts = Array.from({ length: 24 }, (_, index) => makePrompt(`prompt-${index + 1}`));
    const deck = await getStableFreeWeeklyDeck(prompts, {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'user-1',
      userProfile: { created_at: '2026-04-30T12:00:00.000Z' },
      userSettings: { maxHeat: 5 },
      date: new Date('2026-05-03T12:00:00.000Z'),
    });

    expect(deck).toHaveLength(20);
    expect(deck.every((item) => item.requiresPremium === false)).toBe(true);
    expect(deck.every((item) => item.isLockedPreview === false)).toBe(true);
  });

  it('grows the free prompt library to 40 cards after four weeks', async () => {
    const prompts = Array.from({ length: 50 }, (_, index) => makePrompt(`prompt-${index + 1}`));
    const deck = await getStableFreeWeeklyDeck(prompts, {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'user-1',
      userProfile: { created_at: '2026-04-01T12:00:00.000Z' },
      userSettings: { maxHeat: 5 },
      date: new Date('2026-04-30T12:00:00.000Z'),
    });

    expect(deck).toHaveLength(40);
  });

  it('uses the couple anchor for partnered free deck access checks', async () => {
    const prompts = Array.from({ length: 50 }, (_, index) => makePrompt(`prompt-${index + 1}`));
    const options = {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'user-1',
      coupleId: 'couple-1',
      coupleCreatedAt: '2026-04-01T12:00:00.000Z',
      userProfile: { created_at: '2026-04-30T12:00:00.000Z' },
      userSettings: { maxHeat: 5 },
      date: new Date('2026-04-30T12:00:00.000Z'),
    };

    const deck = await getStableFreeWeeklyDeck(prompts, options);
    const deckId = deck[deck.length - 1].id;

    expect(deck).toHaveLength(40);
    expect(await isItemInStableFreeWeeklyDeck(deckId, prompts, options)).toBe(true);
  });

  it('uses a cumulative 20-card-to-growing-library shape for free dates', async () => {
    const dates = Array.from({ length: 50 }, (_, index) => makeDate(`date-${index + 1}`));

    const welcomeDeck = await getStableFreeWeeklyDeck(dates, {
      contentType: CONTENT_TYPES.DATES,
      userId: 'user-1',
      userProfile: { created_at: '2026-04-30T12:00:00.000Z' },
      userSettings: { maxHeat: 5 },
      date: new Date('2026-05-03T12:00:00.000Z'),
    });
    const ongoingDeck = await getStableFreeWeeklyDeck(dates, {
      contentType: CONTENT_TYPES.DATES,
      userId: 'user-1',
      userProfile: { created_at: '2026-04-01T12:00:00.000Z' },
      userSettings: { maxHeat: 5 },
      date: new Date('2026-04-30T12:00:00.000Z'),
    });

    expect(welcomeDeck).toHaveLength(20);
    expect(ongoingDeck).toHaveLength(40);
  });

  it('grows the free sex-position library to 9 items after four weeks', async () => {
    const positions = Array.from({ length: 12 }, (_, index) => ({
      id: `position-${index + 1}`,
      heat: 1,
      category: `category-${index + 1}`,
      title: `Position ${index + 1}`,
      shortSummary: `Summary ${index + 1}`,
    }));

    const deck = await getStableFreeWeeklyDeck(positions, {
      contentType: CONTENT_TYPES.POSITIONS,
      userId: 'user-1',
      userProfile: { created_at: '2026-04-01T12:00:00.000Z' },
      userSettings: { maxHeat: 5 },
      date: new Date('2026-04-30T12:00:00.000Z'),
    });

    expect(deck).toHaveLength(9);
  });

  it('identifies whether an item belongs to the current free prompt library', async () => {
    const prompts = Array.from({ length: 50 }, (_, index) => makePrompt(`prompt-${index + 1}`));
    const options = {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'user-1',
      userProfile: { created_at: '2026-04-01T12:00:00.000Z' },
      userSettings: { maxHeat: 5 },
      date: new Date('2026-04-30T12:00:00.000Z'),
    };
    const deck = await getStableFreeWeeklyDeck(prompts, options);
    const deckId = deck[0].id;
    const outsideId = prompts.find((prompt) => !deck.some((item) => item.id === prompt.id)).id;

    expect(await isItemInStableFreeWeeklyDeck(deckId, prompts, options)).toBe(true);
    expect(await isItemInStableFreeWeeklyDeck(outsideId, prompts, options)).toBe(false);
  });

  it('returns stable item ids for the current free prompt library', async () => {
    const prompts = Array.from({ length: 40 }, (_, index) => makePrompt(`prompt-${index + 1}`));
    const options = {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'user-1',
      userProfile: { created_at: '2026-04-01T12:00:00.000Z' },
      userSettings: { maxHeat: 5 },
      date: new Date('2026-04-30T12:00:00.000Z'),
    };

    const deck = await getStableFreeWeeklyDeck(prompts, options);
    const itemIds = await getStableFreeWeeklyDeckItemIds(prompts, options);

    expect(itemIds.size).toBe(deck.length);
    expect([...itemIds].sort()).toEqual(deck.map((item) => item.id).sort());
  });
});
