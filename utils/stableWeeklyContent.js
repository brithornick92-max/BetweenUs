import { buildWeeklySet } from '../services/WeeklyContentSetService';
import { storage, STORAGE_KEYS } from './storage';
import { CONTENT_CATALOG_VERSION, WEEKLY_CONTENT_SCHEDULER_VERSION } from './contentVersions';

const ALLOCATION_VERSION = 2;
const MAX_CACHED_ALLOCATIONS = 80;

const getItemId = (item) =>
  item?.id ?? item?.promptId ?? item?.dateId ?? item?.positionId ?? item?.title ?? item?.text ?? null;

const normalizeDateStamp = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'unknown';
  return date.toISOString().slice(0, 10);
};

const normalizePart = (value) =>
  String(value ?? 'unknown')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .slice(0, 80);

const getAllocationOwnerId = ({ coupleId = null, userId = 'anonymous' } = {}) =>
  coupleId ? `couple:${coupleId}` : userId || 'anonymous';

const resolveAllocationAnchorDate = ({
  coupleId = null,
  coupleCreatedAt = null,
  coupleAnchorDate = null,
  userCreatedAt = null,
} = {}) => (
  coupleId
    ? (coupleCreatedAt || coupleAnchorDate || null)
    : (userCreatedAt || null)
);

const getTargetCount = (weeklySet) => {
  if (weeklySet?.isPremium) {
    return weeklySet.premiumUnlockedLimit ?? weeklySet.items?.length ?? 0;
  }

  return (weeklySet?.freeUnlockedLimit ?? 0) + (weeklySet?.freeLockedPreviewLimit ?? 0);
};

export function getWeeklyContentAllocationKey({
  contentType = 'prompts',
  userId = 'anonymous',
  coupleId = null,
  isPremium = false,
  userCreatedAt = null,
  weekNumber = 0,
  contentVersion = CONTENT_CATALOG_VERSION,
  schedulerVersion = WEEKLY_CONTENT_SCHEDULER_VERSION,
} = {}) {
  const allocationOwnerId = getAllocationOwnerId({ coupleId, userId });

  return [
    normalizePart(contentType),
    normalizePart(isPremium ? 'premium' : 'free'),
    normalizePart(allocationOwnerId),
    normalizePart(normalizeDateStamp(userCreatedAt)),
    `week_${Number.isFinite(Number(weekNumber)) ? Number(weekNumber) : 0}`,
    normalizePart(contentVersion),
    normalizePart(schedulerVersion),
  ].join(':');
}

const normalizeAllocationStore = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};

const normalizeCachedEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  if (entry.version !== ALLOCATION_VERSION) return null;
  if (!Array.isArray(entry.itemIds)) return null;

  return {
    ...entry,
    itemIds: entry.itemIds.map(String).filter(Boolean),
  };
};

const compactAllocationStore = (store, activeKey) => {
  const entries = Object.entries(store)
    .filter(([key, value]) => key === activeKey || normalizeCachedEntry(value))
    .sort((a, b) => {
      if (a[0] === activeKey) return -1;
      if (b[0] === activeKey) return 1;
      return Number(b[1]?.updatedAt || 0) - Number(a[1]?.updatedAt || 0);
    });

  return Object.fromEntries(entries.slice(0, MAX_CACHED_ALLOCATIONS));
};

export async function buildStableWeeklySet(items, options = {}) {
  const sourceItems = Array.isArray(items) ? items : [];
  const userId = options.userId || 'anonymous';
  const coupleId = options.coupleId || null;
  const allocationOwnerId = getAllocationOwnerId({ coupleId, userId });
  const allocationAnchorDate = resolveAllocationAnchorDate({
    coupleId,
    coupleCreatedAt: options.coupleCreatedAt,
    coupleAnchorDate: options.coupleAnchorDate,
    userCreatedAt: options.userCreatedAt,
  });
  const allocationOptions = {
    ...options,
    userId: allocationOwnerId,
    userCreatedAt: allocationAnchorDate,
  };
  const candidateSet = buildWeeklySet(sourceItems, allocationOptions);
  const targetCount = getTargetCount(candidateSet);
  const contentVersion = options.contentVersion || CONTENT_CATALOG_VERSION;
  const schedulerVersion = options.schedulerVersion || WEEKLY_CONTENT_SCHEDULER_VERSION;
  const allocationKey = getWeeklyContentAllocationKey({
    contentType: candidateSet.contentType,
    userId,
    coupleId,
    isPremium: candidateSet.isPremium,
    userCreatedAt: allocationAnchorDate,
    weekNumber: candidateSet.weekNumber,
    contentVersion,
    schedulerVersion,
  });

  const store = normalizeAllocationStore(
    await storage.get(STORAGE_KEYS.WEEKLY_CONTENT_ALLOCATIONS, {})
  );
  const cachedEntry = normalizeCachedEntry(store[allocationKey]);
  const currentItemsById = new Map(
    sourceItems
      .map((item) => [getItemId(item), item])
      .filter(([itemId]) => itemId != null)
      .map(([itemId, item]) => [String(itemId), item])
  );

  if (cachedEntry && cachedEntry.targetCount === targetCount) {
    const stableItems = cachedEntry.itemIds
      .map((itemId) => currentItemsById.get(String(itemId)))
      .filter(Boolean);
    const stableSet = buildWeeklySet(stableItems, allocationOptions);

    return {
      ...stableSet,
      allocationMeta: {
        key: allocationKey,
        fromCache: true,
        allocatedCount: cachedEntry.itemIds.length,
        visibleCount: stableSet.items.length,
      },
    };
  }

  const nextItemIds = (candidateSet.items || [])
    .map((item) => getItemId(item))
    .filter((itemId) => itemId != null)
    .map(String);

  const nextStore = compactAllocationStore({
    ...store,
    [allocationKey]: {
      version: ALLOCATION_VERSION,
      contentType: candidateSet.contentType,
      contentVersion,
      schedulerVersion,
      isPremium: candidateSet.isPremium,
      userId,
      coupleId,
      allocationOwnerId,
      anchorDate: normalizeDateStamp(allocationAnchorDate),
      weekNumber: candidateSet.weekNumber,
      targetCount,
      itemIds: nextItemIds,
      updatedAt: Date.now(),
    },
  }, allocationKey);

  await storage.set(STORAGE_KEYS.WEEKLY_CONTENT_ALLOCATIONS, nextStore);

  return {
    ...candidateSet,
    allocationMeta: {
      key: allocationKey,
      fromCache: false,
      allocatedCount: nextItemIds.length,
      visibleCount: candidateSet.items.length,
    },
  };
}

export async function getStableWeeklyItemIds(items, options = {}) {
  const weeklySet = await buildStableWeeklySet(items, options);
  return new Set(
    (weeklySet.items || [])
      .map((item) => getItemId(item))
      .filter((itemId) => itemId != null)
      .map(String)
  );
}
