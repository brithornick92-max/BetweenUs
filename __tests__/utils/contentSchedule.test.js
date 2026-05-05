import { getSignupAnchorDate, resolveWeeklyContentAnchorDate } from '../../utils/contentSchedule';

describe('contentSchedule', () => {
  it('uses signup time for free users', () => {
    expect(resolveWeeklyContentAnchorDate({
      isPremium: false,
      userProfile: { created_at: '2026-05-05T18:42:00.000Z' },
    })).toBe('2026-05-05T18:42:00.000Z');
  });

  it('uses premium start for premium users when available', () => {
    expect(resolveWeeklyContentAnchorDate({
      isPremium: true,
      premiumStartedAt: '2026-05-08T14:00:00.000Z',
      userProfile: { created_at: '2026-05-05T18:42:00.000Z' },
    })).toBe('2026-05-08T14:00:00.000Z');
  });

  it('falls back to signup time when premium start is unavailable', () => {
    expect(getSignupAnchorDate({
      userProfile: { createdAt: '2026-05-05T18:42:00.000Z' },
    })).toBe('2026-05-05T18:42:00.000Z');

    expect(resolveWeeklyContentAnchorDate({
      isPremium: true,
      premiumStartedAt: null,
      userProfile: { createdAt: '2026-05-05T18:42:00.000Z' },
    })).toBe('2026-05-05T18:42:00.000Z');
  });
});
