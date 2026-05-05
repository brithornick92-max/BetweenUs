import UsageEventsService from '../services/UsageEventsService';
import { getUserWeekNumber } from '../services/WeeklyContentSetService';

export const FREE_PROMPT_ANSWER_QUOTAS = {
  welcomeWeek: Infinity,
  ongoingWeek: Infinity,
};

export const FREE_WEEKLY_USAGE_LIMITS = {
  prompts: FREE_PROMPT_ANSWER_QUOTAS,
  dates: {
    welcomeWeek: Infinity,
    ongoingWeek: Infinity,
  },
};

const FREE_WEEKLY_PERIOD_PREFIXES = {
  prompts: 'promptAnswers',
  dates: 'dateDetails',
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

export const getFreeWeeklyUsageQuota = ({ type = 'prompts', user, userProfile, date = new Date() } = {}) => {
  const weekNumber = getUserWeekNumber(resolveUserCreatedAt(user, userProfile), date);
  const limits = FREE_WEEKLY_USAGE_LIMITS[type] || FREE_WEEKLY_USAGE_LIMITS.prompts;
  return {
    weekNumber,
    limit: weekNumber === 0
      ? limits.welcomeWeek
      : limits.ongoingWeek,
  };
};

export const getFreePromptAnswerQuota = (options = {}) =>
  getFreeWeeklyUsageQuota({ ...options, type: 'prompts' });

export const getFreeWeeklyUsagePeriodKey = ({ type = 'prompts', user, userProfile, date = new Date() } = {}) => {
  const createdAt = resolveUserCreatedAt(user, userProfile);
  const weekNumber = getUserWeekNumber(createdAt, date);
  const prefix = FREE_WEEKLY_PERIOD_PREFIXES[type] || type;
  return `${prefix}:${toDateStamp(createdAt)}:week:${weekNumber}`;
};

export const getFreePromptAnswerPeriodKey = (options = {}) =>
  getFreeWeeklyUsagePeriodKey({ ...options, type: 'prompts' });

const getUsedItemIds = (usage, type) =>
  new Set(((usage?.usedItemIds || {})[type] || []).map((itemId) => String(itemId)));

export async function canUseFreeWeeklyItem({
  type = 'prompts',
  itemId,
  userId,
  user,
  userProfile,
  isPremium = false,
  date = new Date(),
} = {}) {
  if (isPremium) {
    return {
      canUse: true,
      canSave: true,
      reason: 'premium_access',
      used: 0,
      limit: 'unlimited',
      alreadyUsed: false,
    };
  }

  const usageKey = userId || resolvePromptUsageUserId(user, userProfile);
  const normalizedItemId = itemId ? String(itemId) : null;
  const { limit, weekNumber } = getFreeWeeklyUsageQuota({ type, user, userProfile, date });
  const periodKey = getFreeWeeklyUsagePeriodKey({ type, user, userProfile, date });
  const weeklyUsage = await UsageEventsService.getPeriodUsage(usageKey, periodKey, [type]);
  const used = weeklyUsage[type] || 0;
  const usedItemIds = getUsedItemIds(weeklyUsage, type);

  if (normalizedItemId && usedItemIds.has(normalizedItemId)) {
    return {
      canUse: true,
      canSave: true,
      reason: 'already_used_this_week',
      used,
      limit,
      weekNumber,
      periodKey,
      alreadyUsed: true,
    };
  }

  if (used >= limit) {
    return {
      canUse: false,
      canSave: false,
      reason: type === 'prompts'
        ? 'weekly_prompt_answer_limit_reached'
        : 'weekly_date_detail_limit_reached',
      used,
      limit,
      weekNumber,
      periodKey,
    };
  }

  return {
    canUse: true,
    canSave: true,
    reason: 'within_free_limits',
    used,
    limit,
    weekNumber,
    periodKey,
  };
}

export async function canSaveFreePromptAnswer(options = {}) {
  return canUseFreeWeeklyItem({ ...options, type: 'prompts', itemId: options.promptId });
}

export async function canOpenFreeDateDetail(options = {}) {
  return canUseFreeWeeklyItem({ ...options, type: 'dates', itemId: options.dateId });
}

export async function trackFreeWeeklyItemUsage({
  type = 'prompts',
  itemId,
  userId,
  user,
  userProfile,
  isPremium = false,
  date = new Date(),
} = {}) {
  if (isPremium) {
    return { success: true, reason: 'premium_access', alreadyUsed: false };
  }

  const accessCheck = await canUseFreeWeeklyItem({
    type,
    itemId,
    userId,
    user,
    userProfile,
    isPremium,
    date,
  });

  if (!accessCheck.canUse) {
    return accessCheck;
  }

  if (accessCheck.alreadyUsed) {
    return { ...accessCheck, success: true, tracked: false };
  }

  const usageKey = userId || resolvePromptUsageUserId(user, userProfile);
  const metadata = {
    itemId,
    ...(type === 'prompts' ? { promptId: itemId } : {}),
    ...(type === 'dates' ? { dateId: itemId } : {}),
  };
  return UsageEventsService.incrementPeriodUsage(usageKey, accessCheck.periodKey, type, metadata);
}

export async function trackFreePromptAnswerUsage({ userId, user, userProfile, isPremium = false, promptId, date = new Date() } = {}) {
  return trackFreeWeeklyItemUsage({
    type: 'prompts',
    itemId: promptId,
    userId,
    user,
    userProfile,
    isPremium,
    date,
  });
}

export async function trackFreeDateDetailUsage({ userId, user, userProfile, isPremium = false, dateId, date = new Date() } = {}) {
  return trackFreeWeeklyItemUsage({
    type: 'dates',
    itemId: dateId,
    userId,
    user,
    userProfile,
    isPremium,
    date,
  });
}
