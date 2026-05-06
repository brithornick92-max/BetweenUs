/**
 * ContentAccessService
 *
 * Centralizes content gating for prompts, date ideas, and sex positions.
 * Access is evaluated in this order:
 * 1. User content boundaries and paused/hidden content.
 * 2. Tier heat access.
 * 3. Usage counters for non-content features.
 *
 * Personal weekly content allocations are handled by WeeklyContentSetService
 * through the stable weekly deck helpers at the screen/detail boundaries.
 */

import UsageEventsService from './UsageEventsService';
import CrashReporting from './CrashReporting';
import {
  FREE_LIMITS as FEATURE_FREE_LIMITS,
  PREMIUM_LIMITS as FEATURE_PREMIUM_LIMITS,
  getAccessibleHeatLevels,
  getTimedUnlockLimits,
} from '../utils/featureFlags';
import {
  getPreferredHeatLevels,
  normalizeHeatLevels,
  profileAllowsHeatLevel,
} from '../utils/heatLevelRanges';
import { getUserWeekNumber } from './WeeklyContentSetService';

const UNLIMITED = 'unlimited';

const CONTENT_TYPES = Object.freeze({
  PROMPTS: 'prompts',
  DATES: 'dates',
  POSITIONS: 'positions',
});

const EMPTY_DAILY_USAGE = Object.freeze({ prompts: 0, dates: 0, challenges: 0 });
const EMPTY_WEEKLY_USAGE = Object.freeze({
  prompts: 0,
  dates: 0,
  dateFlows: 0,
  unlockedDateId: null,
});

const clampHeatLevel = (value) => {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.min(5, Math.max(1, Math.floor(numeric)));
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const describeRelease = ({
  freeStart,
  freeWeekly,
  premiumStart,
  premiumWeekly,
  label,
}) => (
  `Free users start with ${freeStart} ${label} and add ${freeWeekly} more each week. `
  + `Premium users start with ${premiumStart} ${label} and add ${premiumWeekly} more each week.`
);

class ContentAccessService {
  constructor() {
    this.FREE_LIMITS = {
      prompts: {
        daily: FEATURE_FREE_LIMITS.PROMPTS_PER_DAY,
        weekly: UNLIMITED,
        weeklyVisible: FEATURE_FREE_LIMITS.VISIBLE_PROMPTS_PER_WEEK,
      },
      dates: {
        daily: FEATURE_FREE_LIMITS.DATE_IDEAS_PER_DAY,
        weekly: UNLIMITED,
        weeklyVisible: FEATURE_FREE_LIMITS.VISIBLE_DATE_IDEAS_PER_WEEK,
      },
      positions: {
        daily: UNLIMITED,
        weekly: UNLIMITED,
        weeklyVisible: FEATURE_FREE_LIMITS.VISIBLE_POSITIONS_PER_WEEK,
      },
      dateFlowsPerWeek: FEATURE_FREE_LIMITS.FULL_DATE_FLOWS_PER_WEEK,
    };

    this.PREMIUM_LIMITS = {
      prompts: {
        daily: UNLIMITED,
        weekly: UNLIMITED,
        weeklyVisible: UNLIMITED,
      },
      dates: {
        daily: UNLIMITED,
        weekly: UNLIMITED,
        weeklyVisible: UNLIMITED,
      },
      positions: {
        daily: UNLIMITED,
        weekly: UNLIMITED,
        weeklyVisible: UNLIMITED,
      },
      dateFlowsPerWeek: UNLIMITED,
    };

    this.RELEASE_SCHEDULE = {
      prompts: {
        week0: {
          free: FEATURE_FREE_LIMITS.WEEK_0_PROMPTS,
          premium: FEATURE_PREMIUM_LIMITS.WEEK_0_PROMPTS,
        },
        perWeek: {
          free: FEATURE_FREE_LIMITS.WEEKLY_PROMPTS,
          premium: FEATURE_PREMIUM_LIMITS.WEEKLY_PROMPTS,
        },
        description: describeRelease({
          freeStart: FEATURE_FREE_LIMITS.WEEK_0_PROMPTS,
          freeWeekly: FEATURE_FREE_LIMITS.WEEKLY_PROMPTS,
          premiumStart: FEATURE_PREMIUM_LIMITS.WEEK_0_PROMPTS,
          premiumWeekly: FEATURE_PREMIUM_LIMITS.WEEKLY_PROMPTS,
          label: 'prompts',
        }),
      },
      dates: {
        week0: {
          free: FEATURE_FREE_LIMITS.WEEK_0_DATES,
          premium: FEATURE_PREMIUM_LIMITS.WEEK_0_DATES,
        },
        perWeek: {
          free: FEATURE_FREE_LIMITS.WEEKLY_DATES,
          premium: FEATURE_PREMIUM_LIMITS.WEEKLY_DATES,
        },
        description: describeRelease({
          freeStart: FEATURE_FREE_LIMITS.WEEK_0_DATES,
          freeWeekly: FEATURE_FREE_LIMITS.WEEKLY_DATES,
          premiumStart: FEATURE_PREMIUM_LIMITS.WEEK_0_DATES,
          premiumWeekly: FEATURE_PREMIUM_LIMITS.WEEKLY_DATES,
          label: 'date ideas',
        }),
      },
      positions: {
        week0: {
          free: FEATURE_FREE_LIMITS.WEEK_0_POSITIONS,
          premium: FEATURE_PREMIUM_LIMITS.WEEK_0_POSITIONS,
        },
        perWeek: {
          free: FEATURE_FREE_LIMITS.WEEKLY_POSITIONS,
          premium: FEATURE_PREMIUM_LIMITS.WEEKLY_POSITIONS,
        },
        description: describeRelease({
          freeStart: FEATURE_FREE_LIMITS.WEEK_0_POSITIONS,
          freeWeekly: FEATURE_FREE_LIMITS.WEEKLY_POSITIONS,
          premiumStart: FEATURE_PREMIUM_LIMITS.WEEK_0_POSITIONS,
          premiumWeekly: FEATURE_PREMIUM_LIMITS.WEEKLY_POSITIONS,
          label: 'sex positions',
        }),
      },
    };
  }

  isPremiumUser(isPremiumFlag) {
    return !!isPremiumFlag;
  }

  isUnlimited(limit) {
    return limit === UNLIMITED || limit === Infinity;
  }

  getRemaining(limit, used = 0) {
    if (this.isUnlimited(limit)) return UNLIMITED;
    return Math.max(0, limit - used);
  }

  canUseMore(limit, used = 0) {
    return this.isUnlimited(limit) || used < limit;
  }

  getEffectiveLimits(isPremiumFlag = false) {
    if (this.isPremiumUser(isPremiumFlag)) {
      return {
        ...this.PREMIUM_LIMITS,
        timedUnlock: null,
      };
    }

    const timedUnlock = getTimedUnlockLimits(false);

    return {
      ...this.FREE_LIMITS,
      prompts: {
        ...this.FREE_LIMITS.prompts,
        daily: timedUnlock?.PROMPTS_PER_DAY ?? this.FREE_LIMITS.prompts.daily,
      },
      dates: {
        ...this.FREE_LIMITS.dates,
        daily: timedUnlock?.DATE_IDEAS_PER_DAY ?? this.FREE_LIMITS.dates.daily,
      },
      timedUnlock,
    };
  }

  getUserMaxHeatLevel(userSettings = {}) {
    const boundaries = userSettings?.boundaries || {};
    // profile.maxHeat and profile.energy.maxHeat are personalization hints from
    // PreferenceEngine. They should rank content, not become hard boundaries.
    const candidates = [
      userSettings?.maxHeatLevel,
      userSettings?.heatBoundary,
      userSettings?.heatLevel,
      userSettings?.heatLevelPreference,
      boundaries?.maxHeatOverride,
      boundaries?.hideSpicy ? 3 : null,
      userSettings?.hideSpicy ? 3 : null,
    ]
      .map(clampHeatLevel)
      .filter((value) => typeof value === 'number');

    return candidates.length > 0 ? Math.min(...candidates) : 5;
  }

  getTierMaxHeatLevel(isPremiumFlag = false) {
    const levels = getAccessibleHeatLevels(this.isPremiumUser(isPremiumFlag));
    return Math.max(...levels);
  }

  getEffectiveMaxHeatLevel(isPremiumFlag = false, userSettings = {}) {
    return Math.min(
      this.getUserMaxHeatLevel(userSettings),
      this.getTierMaxHeatLevel(isPremiumFlag)
    );
  }

  getAllowedHeatLevels(isPremiumFlag = false, userSettings = {}) {
    const userMaxHeat = this.getUserMaxHeatLevel(userSettings);
    const preferredHeatLevels = normalizeHeatLevels(getPreferredHeatLevels(userSettings));
    return getAccessibleHeatLevels(this.isPremiumUser(isPremiumFlag))
      .filter((level) => level <= userMaxHeat && preferredHeatLevels.includes(level));
  }

  getBoundaryState(userSettings = {}, contentType = null) {
    const boundaries = userSettings?.boundaries || {};
    const hiddenCategories = new Set([
      ...asArray(userSettings?.hiddenCategories),
      ...asArray(boundaries?.hiddenCategories),
    ]);

    const pausedByType = {
      [CONTENT_TYPES.PROMPTS]: ['pausedEntries', 'pausedPrompts'],
      [CONTENT_TYPES.DATES]: ['pausedDates'],
      [CONTENT_TYPES.POSITIONS]: ['pausedPositions'],
    };
    const keys = pausedByType[contentType] || [
      'pausedEntries',
      'pausedPrompts',
      'pausedDates',
      'pausedPositions',
    ];

    const pausedIds = new Set(
      keys
        .flatMap((key) => [
          ...asArray(userSettings?.[key]),
          ...asArray(boundaries?.[key]),
        ])
        .filter((id) => id != null)
        .map((id) => String(id))
    );

    return {
      maxHeat: this.getUserMaxHeatLevel(userSettings),
      allowedHeatLevels: new Set(this.getAllowedHeatLevels(true, userSettings)),
      hiddenCategories,
      pausedIds,
    };
  }

  getItemHeat(item) {
    return clampHeatLevel(item?.heat) || 1;
  }

  normalizeItems(items) {
    return Array.isArray(items) ? items.filter(Boolean) : [];
  }

  findById(items, id) {
    if (id == null) return null;
    const expectedId = String(id);
    return this.normalizeItems(items).find((item) => String(item?.id) === expectedId) || null;
  }

  filterByUserBoundaries(items, userSettings = {}, contentType = null) {
    const normalized = this.normalizeItems(items);
    const boundaryState = this.getBoundaryState(userSettings, contentType);

    return normalized.filter((item) => {
      if (item?.id != null && boundaryState.pausedIds.has(String(item.id))) return false;
      if (item?.category && boundaryState.hiddenCategories.has(item.category)) return false;
      const itemHeat = this.getItemHeat(item);
      return itemHeat <= boundaryState.maxHeat && boundaryState.allowedHeatLevels.has(itemHeat);
    });
  }

  filterByTier(items, isPremiumFlag = false) {
    const normalized = this.normalizeItems(items);
    const allowedHeatLevels = new Set(getAccessibleHeatLevels(this.isPremiumUser(isPremiumFlag)));
    return normalized.filter((item) => allowedHeatLevels.has(this.getItemHeat(item)));
  }

  getEligibleReleasedItems(items, contentType, { isPremium = false, userSettings = {} } = {}) {
    let eligible = this.normalizeItems(items);
    eligible = this.filterByUserBoundaries(eligible, userSettings, contentType);
    eligible = this.filterByTier(eligible, isPremium);
    return eligible;
  }

  async getDailyUsage(userId) {
    if (!userId) return EMPTY_DAILY_USAGE;
    return UsageEventsService.getDailyUsage(userId);
  }

  async getWeeklyUsage(userId) {
    if (!userId) return EMPTY_WEEKLY_USAGE;
    return UsageEventsService.getWeeklyUsage(userId);
  }

  buildLimitInfo({ used = 0, limit }) {
    return {
      used,
      limit,
      remaining: this.getRemaining(limit, used),
      canAccessMore: this.canUseMore(limit, used),
    };
  }

  buildAccessInfo({
    contentType,
    isPremium,
    userSettings,
    dailyUsage = EMPTY_DAILY_USAGE,
    weeklyUsage = EMPTY_WEEKLY_USAGE,
    totalEligible = 0,
    visibleCount = 0,
  }) {
    const limits = this.getEffectiveLimits(isPremium);
    const typeLimits = limits[contentType] || {};
    const dailyUsed = dailyUsage[contentType] || 0;
    const weeklyUsed = weeklyUsage[contentType] || 0;
    const weeklyVisibleLimit = typeLimits.weeklyVisible ?? UNLIMITED;
    const isPreviewLimited = !this.isPremiumUser(isPremium)
      && !this.isUnlimited(weeklyVisibleLimit)
      && totalEligible > visibleCount;

    return {
      isPremium: this.isPremiumUser(isPremium),
      userMaxHeat: this.getUserMaxHeatLevel(userSettings),
      effectiveMaxHeat: this.getEffectiveMaxHeatLevel(isPremium, userSettings),
      accessibleHeatLevels: this.getAllowedHeatLevels(isPremium, userSettings),
      isPreviewLimited,
      weeklyVisibleLimit,
      totalEligible,
      visibleCount,
      lockedCount: Math.max(0, totalEligible - visibleCount),
      dailyUsed,
      dailyLimit: typeLimits.daily ?? UNLIMITED,
      dailyRemaining: this.getRemaining(typeLimits.daily ?? UNLIMITED, dailyUsed),
      weeklyUsed,
      weeklyLimit: typeLimits.weekly ?? UNLIMITED,
      weeklyRemaining: this.getRemaining(typeLimits.weekly ?? UNLIMITED, weeklyUsed),
      canAccessMore: this.canUseMore(typeLimits.daily ?? UNLIMITED, dailyUsed),
      timedUnlock: limits.timedUnlock
        ? {
            isUnlockDay: true,
            label: limits.timedUnlock.unlockLabel,
          }
        : null,
    };
  }

  getNotFoundResult(label) {
    return {
      canAccess: false,
      reason: 'not_found',
      message: `${label} not found`,
    };
  }

  getStaticAccessResult(item, contentType, { isPremium = false, userSettings = {} } = {}) {
    const isPremiumUser = this.isPremiumUser(isPremium);
    const itemHeat = this.getItemHeat(item);
    const userMaxHeat = this.getUserMaxHeatLevel(userSettings);

    if (itemHeat > userMaxHeat) {
      return {
        canAccess: false,
        reason: 'exceeds_heat_boundary',
        message: `This content is heat level ${itemHeat}, but your boundary is set to ${userMaxHeat}. Adjust it in Settings > Boundaries.`,
        userMaxHeat,
        contentHeat: itemHeat,
      };
    }

    if (!profileAllowsHeatLevel(userSettings, itemHeat)) {
      return {
        canAccess: false,
        reason: 'outside_heat_range',
        message: 'This content is outside your selected heat range.',
        contentHeat: itemHeat,
        accessibleHeatLevels: this.getAllowedHeatLevels(isPremium, userSettings),
      };
    }

    const allowedHeatLevels = getAccessibleHeatLevels(isPremiumUser);
    if (!allowedHeatLevels.includes(itemHeat)) {
      return {
        canAccess: false,
        reason: 'premium_required',
        message: 'This heat level is not available for this access tier.',
        contentHeat: itemHeat,
        accessibleHeatLevels: allowedHeatLevels,
      };
    }

    const boundaryState = this.getBoundaryState(userSettings, contentType);
    if (item?.id != null && boundaryState.pausedIds.has(String(item.id))) {
      return {
        canAccess: false,
        reason: 'paused_by_boundary',
        message: 'This content is hidden by your Soft Boundaries.',
      };
    }

    if (item?.category && boundaryState.hiddenCategories.has(item.category)) {
      return {
        canAccess: false,
        reason: 'hidden_category',
        message: 'This category is hidden by your Soft Boundaries.',
      };
    }

    return {
      canAccess: true,
      reason: isPremiumUser ? 'premium_unlimited' : 'within_free_limits',
    };
  }

  async getAccessiblePrompts(allPrompts, { userId, isPremium = false, userSettings = {}, includeAll = false } = {}) {
    try {
      const eligible = includeAll
        ? this.filterByUserBoundaries(
            this.filterByTier(allPrompts, isPremium),
            userSettings,
            CONTENT_TYPES.PROMPTS
          )
        : this.getEligibleReleasedItems(allPrompts, CONTENT_TYPES.PROMPTS, {
            isPremium,
            userSettings,
          });

      const available = eligible;

      const [dailyUsage, weeklyUsage] = await Promise.all([
        this.getDailyUsage(userId),
        this.getWeeklyUsage(userId),
      ]);

      return {
        prompts: available,
        totalAvailable: available.length,
        access: this.buildAccessInfo({
          contentType: CONTENT_TYPES.PROMPTS,
          isPremium,
          userSettings,
          dailyUsage,
          weeklyUsage,
          totalEligible: eligible.length,
          visibleCount: available.length,
        }),
        newThisWeek: [],
      };
    } catch (error) {
      CrashReporting.captureException(error, { source: 'ContentAccessService.getAccessiblePrompts' });
      throw error;
    }
  }

  async canAccessPrompt(promptId, { userId, isPremium = false, userSettings = {}, allPrompts = [] } = {}) {
    try {
      const prompt = this.findById(allPrompts, promptId);
      if (!prompt) return this.getNotFoundResult('Prompt');

      const staticAccess = this.getStaticAccessResult(prompt, CONTENT_TYPES.PROMPTS, {
        isPremium,
        userSettings,
      });
      if (!staticAccess.canAccess) return staticAccess;

      if (this.isPremiumUser(isPremium)) return staticAccess;

      const limits = this.getEffectiveLimits(isPremium);
      const dailyUsage = await this.getDailyUsage(userId);
      const dailyUsed = dailyUsage.prompts || 0;
      const dailyLimit = limits.prompts.daily;

      if (!this.canUseMore(dailyLimit, dailyUsed)) {
        return {
          canAccess: false,
          reason: 'daily_limit_reached',
          message: `Today's free prompt access is used. Premium opens the larger prompt library right away.`,
          dailyUsed,
          dailyLimit,
        };
      }

      return {
        canAccess: true,
        reason: 'within_free_limits',
        dailyUsed,
        dailyLimit,
        dailyRemaining: this.getRemaining(dailyLimit, dailyUsed),
      };
    } catch (error) {
      CrashReporting.captureException(error, { source: 'ContentAccessService.canAccessPrompt' });
      return {
        canAccess: false,
        reason: 'error',
        message: 'Unable to verify access. Please try again.',
      };
    }
  }

  async getAccessibleDates(allDates, { userId, isPremium = false, userSettings = {} } = {}) {
    try {
      const eligible = this.getEligibleReleasedItems(allDates, CONTENT_TYPES.DATES, {
        isPremium,
        userSettings,
      });
      const available = eligible;

      const [dailyUsage, weeklyUsage] = await Promise.all([
        this.getDailyUsage(userId),
        this.getWeeklyUsage(userId),
      ]);

      return {
        dates: available,
        totalAvailable: available.length,
        access: this.buildAccessInfo({
          contentType: CONTENT_TYPES.DATES,
          isPremium,
          userSettings,
          dailyUsage,
          weeklyUsage,
          totalEligible: eligible.length,
          visibleCount: available.length,
        }),
        newThisWeek: [],
      };
    } catch (error) {
      CrashReporting.captureException(error, { source: 'ContentAccessService.getAccessibleDates' });
      throw error;
    }
  }

  async canAccessDate(dateId, { userId, isPremium = false, userSettings = {}, allDates = [] } = {}) {
    try {
      const date = this.findById(allDates, dateId);
      if (!date) return this.getNotFoundResult('Date');

      const staticAccess = this.getStaticAccessResult(date, CONTENT_TYPES.DATES, {
        isPremium,
        userSettings,
      });
      if (!staticAccess.canAccess) return staticAccess;

      if (this.isPremiumUser(isPremium)) return staticAccess;

      const limits = this.getEffectiveLimits(isPremium);
      const dailyUsage = await this.getDailyUsage(userId);
      const dailyUsed = dailyUsage.dates || 0;
      const dailyLimit = limits.dates.daily;

      if (!this.canUseMore(dailyLimit, dailyUsed)) {
        return {
          canAccess: false,
          reason: 'daily_limit_reached',
          message: `You've used today's free date access. Premium opens the larger date library right away.`,
          dailyUsed,
          dailyLimit,
        };
      }

      return {
        canAccess: true,
        reason: 'within_free_limits',
        dailyUsed,
        dailyLimit,
        dailyRemaining: this.getRemaining(dailyLimit, dailyUsed),
      };
    } catch (error) {
      CrashReporting.captureException(error, { source: 'ContentAccessService.canAccessDate' });
      return {
        canAccess: false,
        reason: 'error',
        message: 'Unable to verify access. Please try again.',
      };
    }
  }

  async getAccessiblePositions(allPositions, { isPremium = false, userSettings = {}, includeAll = false } = {}) {
    try {
      const eligible = includeAll
        ? this.filterByUserBoundaries(
            this.filterByTier(allPositions, isPremium),
            userSettings,
            CONTENT_TYPES.POSITIONS
          )
        : this.getEligibleReleasedItems(allPositions, CONTENT_TYPES.POSITIONS, {
            isPremium,
            userSettings,
          });

      const available = eligible;
      const limits = this.getEffectiveLimits(isPremium);
      const weeklyVisibleLimit = limits.positions.weeklyVisible;
      const isPreviewLimited = !this.isPremiumUser(isPremium)
        && !this.isUnlimited(weeklyVisibleLimit)
        && eligible.length > available.length;

      return {
        positions: available,
        totalAvailable: available.length,
        access: {
          isPremium: this.isPremiumUser(isPremium),
          requiresPremium: false,
          userMaxHeat: this.getUserMaxHeatLevel(userSettings),
          effectiveMaxHeat: this.getEffectiveMaxHeatLevel(isPremium, userSettings),
          accessibleHeatLevels: this.getAllowedHeatLevels(isPremium, userSettings),
          isPreviewLimited,
          weeklyVisibleLimit,
          totalEligible: eligible.length,
          visibleCount: available.length,
          lockedCount: Math.max(0, eligible.length - available.length),
        },
        newThisWeek: [],
      };
    } catch (error) {
      CrashReporting.captureException(error, { source: 'ContentAccessService.getAccessiblePositions' });
      throw error;
    }
  }

  async canAccessPosition(positionId, { isPremium = false, userSettings = {}, allPositions = [] } = {}) {
    try {
      const position = this.findById(allPositions, positionId);
      if (!position) return this.getNotFoundResult('Position');

      const staticAccess = this.getStaticAccessResult(position, CONTENT_TYPES.POSITIONS, {
        isPremium,
        userSettings,
      });
      if (!staticAccess.canAccess) return staticAccess;

      return staticAccess;
    } catch (error) {
      CrashReporting.captureException(error, { source: 'ContentAccessService.canAccessPosition' });
      return {
        canAccess: false,
        reason: 'error',
        message: 'Unable to verify access. Please try again.',
      };
    }
  }

  async canAccessDateFlow(dateId, { userId, isPremium = false } = {}) {
    try {
      if (this.isPremiumUser(isPremium)) {
        return {
          canAccess: true,
          reason: 'premium_unlimited',
        };
      }

      const limits = this.getEffectiveLimits(isPremium);
      const weeklyUsage = await this.getWeeklyUsage(userId);
      const usedFlows = weeklyUsage.dateFlows || 0;
      const unlockedDateId = weeklyUsage.unlockedDateId || null;
      const isExistingUnlock = dateId != null && unlockedDateId === dateId;

      if (isExistingUnlock || this.canUseMore(limits.dateFlowsPerWeek, usedFlows)) {
        return {
          canAccess: true,
          reason: isExistingUnlock ? 'existing_weekly_unlock' : 'within_free_limits',
          weeklyUsed: usedFlows,
          weeklyLimit: limits.dateFlowsPerWeek,
          weeklyRemaining: this.getRemaining(limits.dateFlowsPerWeek, usedFlows),
        };
      }

      return {
        canAccess: false,
        reason: 'weekly_limit_reached',
        message: 'Date planning is available on the free tier. Please try again.',
        weeklyUsed: usedFlows,
        weeklyLimit: limits.dateFlowsPerWeek,
      };
    } catch (error) {
      CrashReporting.captureException(error, { source: 'ContentAccessService.canAccessDateFlow' });
      return {
        canAccess: false,
        reason: 'error',
        message: 'Unable to verify access. Please try again.',
      };
    }
  }

  async trackPromptUsage(promptId, { userId, isPremium = false } = {}) {
    try {
      if (!userId || this.isPremiumUser(isPremium)) {
        return { success: true, tracked: false };
      }

      await UsageEventsService.incrementDailyUsage(userId, CONTENT_TYPES.PROMPTS);
      await UsageEventsService.incrementWeeklyUsage(userId, CONTENT_TYPES.PROMPTS);

      return { success: true, tracked: true, promptId };
    } catch (error) {
      CrashReporting.captureException(error, { source: 'ContentAccessService.trackPromptUsage' });
      throw error;
    }
  }

  async trackDateUsage(dateId, { userId, isPremium = false } = {}) {
    try {
      if (!userId || this.isPremiumUser(isPremium)) {
        return { success: true, tracked: false };
      }

      await UsageEventsService.incrementDailyUsage(userId, CONTENT_TYPES.DATES);
      await UsageEventsService.incrementWeeklyUsage(userId, CONTENT_TYPES.DATES);

      return { success: true, tracked: true, dateId };
    } catch (error) {
      CrashReporting.captureException(error, { source: 'ContentAccessService.trackDateUsage' });
      throw error;
    }
  }

  async trackDateFlowUsage(dateId, { userId, isPremium = false } = {}) {
    try {
      const accessCheck = await this.canAccessDateFlow(dateId, { userId, isPremium });
      if (!accessCheck.canAccess) return accessCheck;

      if (!userId || this.isPremiumUser(isPremium)) {
        return { success: true, tracked: false };
      }

      const weeklyUsage = await this.getWeeklyUsage(userId);
      if (weeklyUsage.unlockedDateId !== dateId) {
        await UsageEventsService.incrementWeeklyUsage(userId, 'dateFlows', {
          unlockedDateId: dateId,
        });
      }

      return { success: true, tracked: true, dateId };
    } catch (error) {
      CrashReporting.captureException(error, { source: 'ContentAccessService.trackDateFlowUsage' });
      throw error;
    }
  }

  async getUsageSummary(userId, isPremium = false, userSettings = {}) {
    try {
      const [dailyUsage, weeklyUsage] = await Promise.all([
        this.getDailyUsage(userId),
        this.getWeeklyUsage(userId),
      ]);
      const limits = this.getEffectiveLimits(isPremium);

      return {
        isPremium: this.isPremiumUser(isPremium),
        userBoundaries: {
          maxHeatLevel: this.getUserMaxHeatLevel(userSettings),
          effectiveMaxHeatLevel: this.getEffectiveMaxHeatLevel(isPremium, userSettings),
          accessibleHeatLevels: this.getAllowedHeatLevels(isPremium, userSettings),
        },
        daily: {
          prompts: this.buildLimitInfo({
            used: dailyUsage.prompts || 0,
            limit: limits.prompts.daily,
          }),
          dates: this.buildLimitInfo({
            used: dailyUsage.dates || 0,
            limit: limits.dates.daily,
          }),
        },
        weekly: {
          prompts: this.buildLimitInfo({
            used: weeklyUsage.prompts || 0,
            limit: limits.prompts.weekly,
          }),
          visiblePrompts: {
            limit: limits.prompts.weeklyVisible,
          },
          dates: this.buildLimitInfo({
            used: weeklyUsage.dates || 0,
            limit: limits.dates.weekly,
          }),
          visibleDates: {
            limit: limits.dates.weeklyVisible,
          },
          visiblePositions: {
            limit: limits.positions.weeklyVisible,
          },
          dateFlows: this.buildLimitInfo({
            used: weeklyUsage.dateFlows || 0,
            limit: limits.dateFlowsPerWeek,
          }),
          unlockedDateId: weeklyUsage.unlockedDateId || null,
        },
        timedUnlock: limits.timedUnlock
          ? {
              isUnlockDay: true,
              label: limits.timedUnlock.unlockLabel,
            }
          : null,
      };
    } catch (error) {
      CrashReporting.captureException(error, { source: 'ContentAccessService.getUsageSummary' });
      throw error;
    }
  }

  getReleaseSummary(contentType = null) {
    if (contentType) {
      return this.RELEASE_SCHEDULE[contentType] || null;
    }
    return this.RELEASE_SCHEDULE;
  }

  getCurrentReleaseWeek(anchorDate = null, date = new Date()) {
    return getUserWeekNumber(anchorDate, date);
  }
}

export { ContentAccessService, CONTENT_TYPES };
export default new ContentAccessService();
