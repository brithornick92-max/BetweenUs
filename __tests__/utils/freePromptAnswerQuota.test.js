import UsageEventsService from '../../services/UsageEventsService';
import {
  canSaveFreePromptAnswer,
  getFreePromptAnswerQuota,
  trackFreePromptAnswerUsage,
} from '../../utils/freePromptAnswerQuota';

jest.mock('../../services/UsageEventsService', () => ({
  getPeriodUsage: jest.fn(),
  incrementPeriodUsage: jest.fn(),
}));

describe('freePromptAnswerQuota', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows 3 saved prompt answers during signup week', () => {
    const quota = getFreePromptAnswerQuota({
      userProfile: { created_at: '2026-04-30T12:00:00.000Z' },
      date: new Date('2026-05-03T12:00:00.000Z'),
    });

    expect(quota.weekNumber).toBe(0);
    expect(quota.limit).toBe(3);
  });

  it('allows 1 saved prompt answer after signup week', () => {
    const quota = getFreePromptAnswerQuota({
      userProfile: { created_at: '2026-04-01T12:00:00.000Z' },
      date: new Date('2026-04-30T12:00:00.000Z'),
    });

    expect(quota.weekNumber).toBeGreaterThan(0);
    expect(quota.limit).toBe(1);
  });

  it('blocks free saves when the weekly answer quota is used', async () => {
    UsageEventsService.getPeriodUsage.mockResolvedValue({ prompts: 1 });

    const result = await canSaveFreePromptAnswer({
      userId: 'user-1',
      userProfile: { created_at: '2026-04-01T12:00:00.000Z' },
      date: new Date('2026-04-30T12:00:00.000Z'),
    });

    expect(result.canSave).toBe(false);
    expect(result.reason).toBe('weekly_prompt_answer_limit_reached');
    expect(result.periodKey).toBe('promptAnswers:2026-04-01:week:4');
  });

  it('tracks saved prompt answers as weekly prompt usage', async () => {
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
      { promptId: 'prompt-1' }
    );
  });
});
