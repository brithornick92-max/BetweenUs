import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONTENT_TYPES } from '../../services/WeeklyContentSetService';
import { buildStableWeeklySet } from '../../utils/stableWeeklyContent';

const makePrompt = (id, heat = 1) => ({
  id,
  heat,
  category: `category-${heat}`,
  text: `Prompt ${id}`,
});

describe('stableWeeklyContent', () => {
  let mockStore;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStore = {};
    AsyncStorage.getItem.mockImplementation(async (key) => mockStore[key] ?? null);
    AsyncStorage.setItem.mockImplementation(async (key, value) => {
      mockStore[key] = value;
    });
  });

  it('does not backfill additional prompts when boundaries loosen inside the same user week', async () => {
    const tightPool = Array.from({ length: 20 }, (_, index) => makePrompt(`low-${index + 1}`, 1));
    const loosePool = [
      ...tightPool,
      ...Array.from({ length: 20 }, (_, index) => makePrompt(`high-${index + 1}`, 5)),
    ];
    const options = {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'user-1',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      userCreatedAt: '2026-04-30T12:00:00.000Z',
      date: new Date('2026-05-03T12:00:00.000Z'),
    };

    const firstSet = await buildStableWeeklySet(tightPool, options);
    const secondSet = await buildStableWeeklySet(loosePool, options);

    expect(firstSet.items).toHaveLength(20);
    expect(secondSet.items).toHaveLength(20);
    expect(secondSet.items.map((item) => item.id).sort()).toEqual(
      firstSet.items.map((item) => item.id).sort()
    );
    expect(secondSet.allocationMeta.fromCache).toBe(true);
  });

  it('hides now-disallowed cached cards without replacing them until the next week', async () => {
    const originalPool = [
      ...Array.from({ length: 10 }, (_, index) => makePrompt(`low-${index + 1}`, 1)),
      ...Array.from({ length: 10 }, (_, index) => makePrompt(`high-${index + 1}`, 5)),
    ];
    const tightenedPool = [
      ...Array.from({ length: 10 }, (_, index) => makePrompt(`low-${index + 1}`, 1)),
      ...Array.from({ length: 20 }, (_, index) => makePrompt(`extra-low-${index + 1}`, 1)),
    ];
    const options = {
      contentType: CONTENT_TYPES.PROMPTS,
      userId: 'user-1',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      userCreatedAt: '2026-04-30T12:00:00.000Z',
      date: new Date('2026-05-03T12:00:00.000Z'),
    };

    await buildStableWeeklySet(originalPool, options);
    const sameWeekAfterTightening = await buildStableWeeklySet(tightenedPool, options);
    const followingWeek = await buildStableWeeklySet(tightenedPool, {
      ...options,
      date: new Date('2026-05-07T12:00:00.000Z'),
    });

    expect(sameWeekAfterTightening.items).toHaveLength(10);
    expect(sameWeekAfterTightening.items.every((item) => item.id.startsWith('low-'))).toBe(true);
    expect(followingWeek.items).toHaveLength(25);
    expect(followingWeek.allocationMeta.fromCache).toBe(false);
  });

  it('uses the couple as the weekly allocation owner when partnered', async () => {
    const pool = Array.from({ length: 30 }, (_, index) => makePrompt(`prompt-${index + 1}`, 1));
    const baseOptions = {
      contentType: CONTENT_TYPES.PROMPTS,
      coupleId: 'couple-1',
      isPremium: false,
      userSettings: { maxHeat: 5 },
      userCreatedAt: '2026-04-30T12:00:00.000Z',
      date: new Date('2026-05-03T12:00:00.000Z'),
    };

    const firstPartnerSet = await buildStableWeeklySet(pool, {
      ...baseOptions,
      userId: 'user-1',
    });
    const secondPartnerSet = await buildStableWeeklySet(pool, {
      ...baseOptions,
      userId: 'user-2',
    });

    expect(secondPartnerSet.allocationMeta.fromCache).toBe(true);
    expect(secondPartnerSet.allocationMeta.key).toBe(firstPartnerSet.allocationMeta.key);
    expect(secondPartnerSet.items.map((item) => item.id).sort()).toEqual(
      firstPartnerSet.items.map((item) => item.id).sort()
    );
  });
});
