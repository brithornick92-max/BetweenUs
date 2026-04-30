import { CONTENT_TYPES } from '../../services/WeeklyContentSetService';
import {
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
  it('limits free prompt decks to 5 cards in signup week', () => {
    const prompts = Array.from({ length: 8 }, (_, index) => makePrompt(`prompt-${index + 1}`));
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

  it('limits free prompt decks to 3 cards after signup week', () => {
    const prompts = Array.from({ length: 8 }, (_, index) => makePrompt(`prompt-${index + 1}`));
    const deck = getFreeWeeklyDeck(prompts, {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'user-1',
      userProfile: { created_at: '2026-04-01T12:00:00.000Z' },
      userSettings: { maxHeat: 5 },
      date: new Date('2026-04-30T12:00:00.000Z'),
    });

    expect(deck).toHaveLength(3);
  });

  it('uses the same 5 then 3 deck shape for free dates', () => {
    const dates = Array.from({ length: 8 }, (_, index) => makeDate(`date-${index + 1}`));

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
    expect(ongoingDeck).toHaveLength(3);
  });

  it('identifies whether an item belongs to the current free weekly deck', () => {
    const prompts = Array.from({ length: 8 }, (_, index) => makePrompt(`prompt-${index + 1}`));
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
});
