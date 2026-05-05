import UsageEventsService from '../../services/UsageEventsService';
import {
  canOpenFreeDateDetail,
  canSaveFreePromptAnswer,
  canUseFreeWeeklyItem,
  getFreePromptAnswerQuota,
  trackFreeDateDetailUsage,
  trackFreePromptAnswerUsage,
  trackFreeWeeklyItemUsage,
} from '../../utils/freePromptAnswerQuota';

jest.mock('../../services/UsageEventsService', () => ({
  getPeriodUsage: jest.fn(),
  incrementPeriodUsage: jest.fn(),
}));

describe('freePromptAnswerQuota', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps free prompt answer access unlimited in signup week', () => {
    const quota = getFreePromptAnswerQuota({
      userProfile: { created_at: '2026-04-30T12:00:00.000Z' },
      date: new Date('2026-05-03T12:00:00.000Z'),
    });

    expect(quota.weekNumber).toBe(0);
    expect(quota.limit).toBe(Infinity);
  });

  it('keeps free prompt answer access unlimited after signup week', () => {
    const quota = getFreePromptAnswerQuota({
      userProfile: { created_at: '2026-04-01T12:00:00.000Z' },
      date: new Date('2026-04-30T12:00:00.000Z'),
    });

    expect(quota.weekNumber).toBeGreaterThan(0);
    expect(quota.limit).toBe(Infinity);
  });

  it('does not block free prompt saves when usage is high', async () => {
    UsageEventsService.getPeriodUsage.mockResolvedValue({ prompts: 99 });

    const result = await canSaveFreePromptAnswer({
      userId: 'user-1',
      userProfile: { created_at: '2026-04-01T12:00:00.000Z' },
      promptId: 'prompt-1',
      date: new Date('2026-04-30T12:00:00.000Z'),
    });

    expect(result.canSave).toBe(true);
    expect(result.limit).toBe(Infinity);
  });

  it('tracks saved prompt answers as weekly prompt usage', async () => {
    UsageEventsService.getPeriodUsage.mockResolvedValue({ prompts: 0 });
    UsageEventsService.incrementPeriodUsage.mockResolvedValue({ prompts: 1 });

    await trackFreePromptAnswerUsage({
      userId: 'user-1',
      userProfile: { created_at: '2026-04-01T12:00:00.000Z' },
      promptId: 'prompt-1',
      date: new Date('2026-04-30T12:00:00.000Z'),
    });

    expect(UsageEventsService.incrementPeriodUsage).toHaveBeenCalledWith(
      'user-1',
      'promptAnswers:2026-04-01:week:4',
      'prompts',
      { itemId: 'prompt-1', promptId: 'prompt-1' }
    );
  });

  it('allows reopening a prompt already answered in the same weekly period', async () => {
    UsageEventsService.getPeriodUsage.mockResolvedValue({
      prompts: 3,
      usedItemIds: { prompts: ['prompt-1'] },
    });

    const result = await canSaveFreePromptAnswer({
      userId: 'user-1',
      userProfile: { created_at: '2026-04-30T12:00:00.000Z' },
      promptId: 'prompt-1',
      date: new Date('2026-05-03T12:00:00.000Z'),
    });

    expect(result.canSave).toBe(true);
    expect(result.alreadyUsed).toBe(true);
  });

  it('does not increment usage when a weekly item was already used', async () => {
    UsageEventsService.getPeriodUsage.mockResolvedValue({
      prompts: 99,
      usedItemIds: { prompts: ['prompt-1'] },
    });

    const result = await trackFreeWeeklyItemUsage({
      type: 'prompts',
      itemId: 'prompt-1',
      userId: 'user-1',
      userProfile: { created_at: '2026-04-30T12:00:00.000Z' },
      date: new Date('2026-05-03T12:00:00.000Z'),
    });

    expect(result.tracked).toBe(false);
    expect(UsageEventsService.incrementPeriodUsage).not.toHaveBeenCalled();
  });

  it('does not block free date details when usage is high', async () => {
    UsageEventsService.getPeriodUsage.mockResolvedValue({ dates: 99 });

    const result = await canOpenFreeDateDetail({
      userId: 'user-1',
      userProfile: { created_at: '2026-04-01T12:00:00.000Z' },
      dateId: 'date-2',
      date: new Date('2026-04-30T12:00:00.000Z'),
    });

    expect(result.canUse).toBe(true);
    expect(result.limit).toBe(Infinity);
  });

  it('tracks date detail opens against the weekly date period', async () => {
    UsageEventsService.getPeriodUsage.mockResolvedValue({ dates: 0 });
    UsageEventsService.incrementPeriodUsage.mockResolvedValue({ dates: 1 });

    await trackFreeDateDetailUsage({
      userId: 'user-1',
      userProfile: { created_at: '2026-04-30T12:00:00.000Z' },
      dateId: 'date-1',
      date: new Date('2026-05-03T12:00:00.000Z'),
    });

    expect(UsageEventsService.incrementPeriodUsage).toHaveBeenCalledWith(
      'user-1',
      'dateDetails:2026-04-30:week:0',
      'dates',
      { itemId: 'date-1', dateId: 'date-1' }
    );
  });

  it('uses the same unlimited weekly quota shape for prompts and date details', async () => {
    UsageEventsService.getPeriodUsage.mockResolvedValue({ dates: 500 });
    const welcomeWeekDate = await canUseFreeWeeklyItem({
      type: 'dates',
      itemId: 'date-4',
      userId: 'user-1',
      userProfile: { created_at: '2026-04-30T12:00:00.000Z' },
      date: new Date('2026-05-03T12:00:00.000Z'),
    });

    UsageEventsService.getPeriodUsage.mockResolvedValue({ dates: 500 });
    const ongoingDate = await canUseFreeWeeklyItem({
      type: 'dates',
      itemId: 'date-2',
      userId: 'user-1',
      userProfile: { created_at: '2026-04-01T12:00:00.000Z' },
      date: new Date('2026-04-30T12:00:00.000Z'),
    });

    expect(welcomeWeekDate.canUse).toBe(true);
    expect(welcomeWeekDate.limit).toBe(Infinity);
    expect(ongoingDate.canUse).toBe(true);
    expect(ongoingDate.limit).toBe(Infinity);
  });
});
