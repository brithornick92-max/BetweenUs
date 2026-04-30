import UsageEventsService from '../services/UsageEventsService';
import { getUserWeekNumber } from '../services/WeeklyContentSetService';

export const FREE_PROMPT_ANSWER_QUOTAS = {
  welcomeWeek: 3,
  ongoingWeek: 1,
};

export const resolvePromptUsageUserId = (user, userProfile) =>
  user?.uid || user?.id || userProfile?.id || 'anonymous';

export const resolveUserCreatedAt = (user, userProfile) =>
  userProfile?.created_at ||
  userProfile?.createdAt ||
  user?.metadata?.creationTime ||
  user?.created_at ||
  user?.createdAt ||
  null;

const toDateStamp = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'unknown';
  return date.toISOString().slice(0, 10);
};

export const getFreePromptAnswerQuota = ({ user, userProfile, date = new Date() } = {}) => {
  const weekNumber = getUserWeekNumber(resolveUserCreatedAt(user, userProfile), date);
  return {
    weekNumber,
    limit: weekNumber === 0
      ? FREE_PROMPT_ANSWER_QUOTAS.welcomeWeek
      : FREE_PROMPT_ANSWER_QUOTAS.ongoingWeek,
  };
};

export const getFreePromptAnswerPeriodKey = ({ user, userProfile, date = new Date() } = {}) => {
  const createdAt = resolveUserCreatedAt(user, userProfile);
  const weekNumber = getUserWeekNumber(createdAt, date);
  return `promptAnswers:${toDateStamp(createdAt)}:week:${weekNumber}`;
};

export async function canSaveFreePromptAnswer({ userId, user, userProfile, isPremium = false, date = new Date() } = {}) {
  if (isPremium) {
    return { canSave: true, reason: 'premium_access', used: 0, limit: 'unlimited' };
  }

  const usageKey = userId || resolvePromptUsageUserId(user, userProfile);
  const { limit, weekNumber } = getFreePromptAnswerQuota({ user, userProfile, date });
  const periodKey = getFreePromptAnswerPeriodKey({ user, userProfile, date });
  const weeklyUsage = await UsageEventsService.getPeriodUsage(usageKey, periodKey, ['prompts']);
  const used = weeklyUsage.prompts || 0;

  if (used >= limit) {
    return {
      canSave: false,
      reason: 'weekly_prompt_answer_limit_reached',
      used,
      limit,
      weekNumber,
      periodKey,
    };
  }

  return {
    canSave: true,
    reason: 'within_free_limits',
    used,
    limit,
    weekNumber,
    periodKey,
  };
}

export async function trackFreePromptAnswerUsage({ userId, user, userProfile, isPremium = false, promptId, date = new Date() } = {}) {
  if (isPremium) {
    return { success: true, reason: 'premium_access' };
  }

  const usageKey = userId || resolvePromptUsageUserId(user, userProfile);
  const periodKey = getFreePromptAnswerPeriodKey({ user, userProfile, date });
  return UsageEventsService.incrementPeriodUsage(usageKey, periodKey, 'prompts', { promptId });
}
