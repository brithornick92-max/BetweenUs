import contentAccessService from '../../services/ContentAccessService';
import UsageEventsService from '../../services/UsageEventsService';

jest.mock('../../services/UsageEventsService', () => ({
  __esModule: true,
  default: {
    getDailyUsage: jest.fn().mockResolvedValue({ prompts: 0, dates: 0 }),
    getWeeklyUsage: jest.fn().mockResolvedValue({ prompts: 0, dates: 0, dateFlows: 0, unlockedDateId: null }),
    incrementDailyUsage: jest.fn().mockResolvedValue({ prompts: 1, dates: 0 }),
    incrementWeeklyUsage: jest.fn().mockResolvedValue({ prompts: 1, dates: 0, dateFlows: 1 }),
  },
}));

jest.mock('../../services/CrashReporting', () => ({
  __esModule: true,
  default: {
    captureException: jest.fn(),
  },
}));

describe('ContentAccessService', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-26T12:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    UsageEventsService.getDailyUsage.mockResolvedValue({ prompts: 0, dates: 0 });
    UsageEventsService.getWeeklyUsage.mockResolvedValue({
      prompts: 0,
      dates: 0,
      dateFlows: 0,
      unlockedDateId: null,
    });
  });

  it('defaults to all heat levels when no boundaries are set', () => {
    expect(contentAccessService.getAllowedHeatLevels(false, {})).toEqual([1, 2, 3, 4, 5]);
  });

  it('does not treat personalization heat hints as hard boundaries', () => {
    const settings = {
      maxHeat: 2,
      energy: { maxHeat: 2 },
      boundaries: {},
    };

    expect(contentAccessService.getAllowedHeatLevels(false, settings)).toEqual([1, 2, 3, 4, 5]);
  });

  it('respects explicit heat preferences and soft boundary caps', () => {
    expect(
      contentAccessService.getAllowedHeatLevels(false, { heatLevelPreference: 3 })
    ).toEqual([1, 2, 3]);

    expect(
      contentAccessService.getAllowedHeatLevels(false, { boundaries: { hideSpicy: true } })
    ).toEqual([1, 2, 3]);
  });

  it('does not hide prompts by release week and user boundaries while allowing all free heat levels', async () => {
    const result = await contentAccessService.getAccessiblePrompts(
      [
        { id: 'released-safe', heat: 1, category: 'emotional', releaseWeek: 0 },
        { id: 'higher-heat-preview', heat: 4, category: 'physical', releaseWeek: 0 },
        { id: 'future', heat: 1, category: 'emotional', releaseWeek: 2 },
        { id: 'hidden-category', heat: 1, category: 'blocked', releaseWeek: 0 },
      ],
      {
        userId: 'user-1',
        isPremium: false,
        userSettings: { boundaries: { hiddenCategories: ['blocked'] } },
      }
    );

    expect(result.prompts.map((prompt) => prompt.id)).toEqual(['released-safe', 'higher-heat-preview', 'future']);
    expect(result.access.accessibleHeatLevels).toEqual([1, 2, 3, 4, 5]);
  });

  it('blocks premium users when a prompt exceeds their own heat boundary', async () => {
    const result = await contentAccessService.canAccessPrompt('hot', {
      userId: 'user-1',
      isPremium: true,
      userSettings: { maxHeatLevel: 3 },
      allPrompts: [{ id: 'hot', heat: 5, releaseWeek: 0 }],
    });

    expect(result.canAccess).toBe(false);
    expect(result.reason).toBe('exceeds_heat_boundary');
  });

  it('allows free users to preview heat levels 4 and 5', async () => {
    const result = await contentAccessService.canAccessPrompt('hot', {
      userId: 'user-1',
      isPremium: false,
      userSettings: { maxHeatLevel: 5 },
      allPrompts: [{ id: 'hot', heat: 4, releaseWeek: 0 }],
    });

    expect(result.canAccess).toBe(true);
    expect(result.reason).toBe('within_free_limits');
  });

  it('returns all prompt cards that pass boundaries and tier checks', async () => {
    const prompts = [1, 2, 3, 4, 5].flatMap((heat) =>
      [0, 1, 2, 3, 4].map((index) => ({
        id: `h${heat}_${index}`,
        heat,
        releaseWeek: 0,
      }))
    );

    const result = await contentAccessService.getAccessiblePrompts(prompts, {
      userId: 'user-1',
      isPremium: false,
      userSettings: { maxHeatLevel: 5 },
    });

    expect(result.prompts).toHaveLength(25);
    expect(result.access.isPreviewLimited).toBe(false);
    expect(result.access.lockedCount).toBe(0);
  });

  it('does not apply a legacy visible-card lock in direct prompt access checks', async () => {
    const prompts = [1, 2, 3, 4, 5].flatMap((heat) =>
      [0, 1, 2, 3, 4].map((index) => ({
        id: `h${heat}_${index}`,
        heat,
        releaseWeek: 0,
      }))
    );

    const result = await contentAccessService.canAccessPrompt(prompts[0].id, {
      userId: 'user-1',
      isPremium: false,
      userSettings: { maxHeatLevel: 5 },
      allPrompts: prompts,
    });

    expect(result.canAccess).toBe(true);
    expect(result.reason).toBe('within_free_limits');
  });

  it('returns all date cards that pass boundaries and tier checks', async () => {
    const dates = [1, 2, 3].flatMap((heat) =>
      Array.from({ length: 12 }, (_, index) => ({
        id: `date${heat}_${index}`,
        heat,
        releaseWeek: 0,
      }))
    );

    const result = await contentAccessService.getAccessibleDates(dates, {
      userId: 'user-1',
      isPremium: false,
      userSettings: { maxHeatLevel: 2 },
    });

    expect(result.dates).toHaveLength(24);
    expect(result.dates.every((date) => date.heat <= 2)).toBe(true);
    expect(result.access.accessibleHeatLevels).toEqual([1, 2]);
    expect(result.access.isPreviewLimited).toBe(false);
  });

  it('does not block free prompt access based on daily usage anymore', async () => {
    UsageEventsService.getDailyUsage.mockResolvedValue({ prompts: 100, dates: 0 });

    const result = await contentAccessService.canAccessPrompt('prompt-1', {
      userId: 'user-1',
      isPremium: false,
      userSettings: { maxHeatLevel: 5 },
      allPrompts: [{ id: 'prompt-1', heat: 1, releaseWeek: 0 }],
    });

    expect(result.canAccess).toBe(true);
    expect(result.reason).toBe('within_free_limits');
    expect(result.dailyLimit).toBe(Infinity);
  });

  it('tracks free usage but skips premium users', async () => {
    await contentAccessService.trackPromptUsage('prompt-1', {
      userId: 'user-1',
      isPremium: false,
    });

    expect(UsageEventsService.incrementDailyUsage).toHaveBeenCalledWith('user-1', 'prompts');
    expect(UsageEventsService.incrementWeeklyUsage).toHaveBeenCalledWith('user-1', 'prompts');

    jest.clearAllMocks();

    const premiumResult = await contentAccessService.trackPromptUsage('prompt-1', {
      userId: 'user-1',
      isPremium: true,
    });

    expect(premiumResult.tracked).toBe(false);
    expect(UsageEventsService.incrementDailyUsage).not.toHaveBeenCalled();
  });

  it('returns all sex positions that pass boundaries and tier checks', async () => {
    const positions = [1, 2, 3].flatMap((heat) =>
      [0, 1].map((index) => ({
        id: `ip${heat}_${index}`,
        heat,
        releaseWeek: 0,
      }))
    );

    const result = await contentAccessService.getAccessiblePositions(positions, {
      isPremium: false,
      userSettings: { maxHeatLevel: 3 },
    });

    expect(result.positions).toHaveLength(6);
    expect(result.access.requiresPremium).toBe(false);
    expect(result.access.isPreviewLimited).toBe(false);
  });
});
