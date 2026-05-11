import { buildStableWeeklySet } from './stableWeeklyContent';
import {
  resolvePromptUsageUserId,
  resolveUserCreatedAt,
} from './freePromptAnswerQuota';

const getItemId = (item) => item?.id ?? item?.promptId ?? item?.dateId ?? null;

export async function getStableFreeWeeklyDeck(items, {
  contentType,
  userId,
  coupleId,
  coupleCreatedAt,
  coupleAnchorDate,
  user,
  userProfile,
  userSettings = {},
  date = new Date(),
} = {}) {
  const resolvedCoupleCreatedAt = coupleId
    ? (coupleCreatedAt || coupleAnchorDate || userProfile?.coupleCreatedAt || userProfile?.couple_created_at || null)
    : null;

  const weeklySet = await buildStableWeeklySet(Array.isArray(items) ? items : [], {
    contentType,
    userId: userId || resolvePromptUsageUserId(user, userProfile),
    coupleId,
    coupleCreatedAt: resolvedCoupleCreatedAt,
    isPremium: false,
    userSettings,
    userCreatedAt: resolveUserCreatedAt(user, userProfile),
    date,
  });

  return weeklySet.items || [];
}

export async function getStableFreeWeeklyDeckItemIds(items, options = {}) {
  return new Set(
    (await getStableFreeWeeklyDeck(items, options))
      .map((item) => getItemId(item))
      .filter(Boolean)
      .map((itemId) => String(itemId))
  );
}

export async function isItemInStableFreeWeeklyDeck(itemId, items, options = {}) {
  if (!itemId) return false;
  return (await getStableFreeWeeklyDeckItemIds(items, options)).has(String(itemId));
}
