import { buildWeeklySet } from '../services/WeeklyContentSetService';
import {
  resolvePromptUsageUserId,
  resolveUserCreatedAt,
} from './freePromptAnswerQuota';

const getItemId = (item) => item?.id ?? item?.promptId ?? item?.dateId ?? null;

export function getFreeWeeklyDeck(items, {
  contentType,
  userId,
  user,
  userProfile,
  userSettings = {},
  date = new Date(),
} = {}) {
  const weeklySet = buildWeeklySet(Array.isArray(items) ? items : [], {
    contentType,
    userId: userId || resolvePromptUsageUserId(user, userProfile),
    isPremium: false,
    userSettings,
    userCreatedAt: resolveUserCreatedAt(user, userProfile),
    date,
  });

  return weeklySet.items || [];
}

export function getFreeWeeklyDeckItemIds(items, options = {}) {
  return new Set(
    getFreeWeeklyDeck(items, options)
      .map((item) => getItemId(item))
      .filter(Boolean)
      .map((itemId) => String(itemId))
  );
}

export function filterItemsToFreeWeeklyDeck(items, options = {}) {
  const weeklyDeckItemIds = getFreeWeeklyDeckItemIds(items, options);
  return (Array.isArray(items) ? items : []).filter((item) => {
    const itemId = getItemId(item);
    return itemId != null && weeklyDeckItemIds.has(String(itemId));
  });
}

export function isItemInFreeWeeklyDeck(itemId, items, options = {}) {
  if (!itemId) return false;
  return getFreeWeeklyDeckItemIds(items, options).has(String(itemId));
}
