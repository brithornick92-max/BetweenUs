import { CONTENT_TYPES } from '../../services/WeeklyContentSetService';
import {
  filterItemsToFreeWeeklyDeck,
  getFreeWeeklyDeck,
  isItemInFreeWeeklyDeck,
} from '../../utils/freeWeeklyDeckAccess';

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
  it('builds a 5-card free prompt library in signup week', () => {
    const prompts = Array.from({ length: 24 }, (_, index) => makePrompt(`prompt-${index + 1}`));
    const deck = getFreeWeeklyDeck(prompts, {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'user-1',
      userProfile: { created_at: '2026-04-30T12:00:00.000Z' },
      userSettings: { maxHeat: 5 },
      date: new Date('2026-05-03T12:00:00.000Z'),
    });

    expect(deck).toHaveLength(5);
    expect(deck.every((item) => item.requiresPremium === false)).toBe(true);
    expect(deck.every((item) => item.isLockedPreview === false)).toBe(true);
  });

  it('grows the free prompt library to 25 cards after four weeks', () => {
    const prompts = Array.from({ length: 40 }, (_, index) => makePrompt(`prompt-${index + 1}`));
    const deck = getFreeWeeklyDeck(prompts, {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'user-1',
      userProfile: { created_at: '2026-04-01T12:00:00.000Z' },
      userSettings: { maxHeat: 5 },
      date: new Date('2026-04-30T12:00:00.000Z'),
    });

    expect(deck).toHaveLength(25);
  });

  it('uses a cumulative 5-card-to-growing-library shape for free dates', () => {
    const dates = Array.from({ length: 24 }, (_, index) => makeDate(`date-${index + 1}`));

    const welcomeDeck = getFreeWeeklyDeck(dates, {
      contentType: CONTENT_TYPES.DATES,
      userId: 'user-1',
      userProfile: { created_at: '2026-04-30T12:00:00.000Z' },
      userSettings: { maxHeat: 5 },
      date: new Date('2026-05-03T12:00:00.000Z'),
    });
    const ongoingDeck = getFreeWeeklyDeck(dates, {
      contentType: CONTENT_TYPES.DATES,
      userId: 'user-1',
      userProfile: { created_at: '2026-04-01T12:00:00.000Z' },
      userSettings: { maxHeat: 5 },
      date: new Date('2026-04-30T12:00:00.000Z'),
    });

    expect(welcomeDeck).toHaveLength(5);
    expect(ongoingDeck).toHaveLength(24);
  });

  it('grows the free sex-position library to 5 items after four weeks', () => {
    const positions = Array.from({ length: 12 }, (_, index) => ({
      id: `position-${index + 1}`,
      heat: 1,
      category: `category-${index + 1}`,
      title: `Position ${index + 1}`,
      shortSummary: `Summary ${index + 1}`,
    }));

    const deck = getFreeWeeklyDeck(positions, {
      contentType: CONTENT_TYPES.POSITIONS,
      userId: 'user-1',
      userProfile: { created_at: '2026-04-01T12:00:00.000Z' },
      userSettings: { maxHeat: 5 },
      date: new Date('2026-04-30T12:00:00.000Z'),
    });

    expect(deck).toHaveLength(5);
  });

  it('identifies whether an item belongs to the current free prompt library', () => {
    const prompts = Array.from({ length: 40 }, (_, index) => makePrompt(`prompt-${index + 1}`));
    const options = {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'user-1',
      userProfile: { created_at: '2026-04-01T12:00:00.000Z' },
      userSettings: { maxHeat: 5 },
      date: new Date('2026-04-30T12:00:00.000Z'),
    };
    const deck = getFreeWeeklyDeck(prompts, options);
    const deckId = deck[0].id;
    const outsideId = prompts.find((prompt) => !deck.some((item) => item.id === prompt.id)).id;

    expect(isItemInFreeWeeklyDeck(deckId, prompts, options)).toBe(true);
    expect(isItemInFreeWeeklyDeck(outsideId, prompts, options)).toBe(false);
  });

  it('filters a prompt pool down to the current free prompt library', () => {
    const prompts = Array.from({ length: 40 }, (_, index) => makePrompt(`prompt-${index + 1}`));
    const options = {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'user-1',
      userProfile: { created_at: '2026-04-01T12:00:00.000Z' },
      userSettings: { maxHeat: 5 },
      date: new Date('2026-04-30T12:00:00.000Z'),
    };

    const deck = getFreeWeeklyDeck(prompts, options);
    const filtered = filterItemsToFreeWeeklyDeck(prompts, options);

    expect(filtered).toHaveLength(deck.length);
    expect(filtered.map((item) => item.id).sort()).toEqual(deck.map((item) => item.id).sort());
  });
});
