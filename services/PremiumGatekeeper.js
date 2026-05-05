import UsageEventsService from './UsageEventsService';
import StorageRouter from './storage/StorageRouter';
import CrashReporting from './CrashReporting';
import { FREE_LIMITS, getAccessibleHeatLevels } from '../utils/featureFlags';

class PremiumGatekeeper {
  constructor() {
    this.DAILY_LIMITS = {
      FREE_PROMPTS: FREE_LIMITS.PROMPTS_PER_DAY, // No daily prompt lock; weekly library access drives free.
      FREE_DATES: FREE_LIMITS.DATE_IDEAS_PER_DAY, // No daily date lock; weekly library access drives free.
      FREE_HEAT_LEVELS: FREE_LIMITS.FREE_HEAT_LEVELS,
      PREMIUM_HEAT_LEVELS: [1, 2, 3, 4, 5]
    };
    this.WEEKLY_LIMITS = {
      FREE_FULL_DATE_FLOWS: FREE_LIMITS.FULL_DATE_FLOWS_PER_WEEK
    };
  }

  hasFiniteLimit(limit) {
    return Number.isFinite(limit);
  }

  // Check if user has premium access
  isPremiumUser(isPremiumFlag) {
    return !!isPremiumFlag;
  }

  // Check if user can access a prompt
  async canAccessPrompt(userId, promptHeatLevel, isPremiumFlag = false) {
    try {
      const isPremium = this.isPremiumUser(isPremiumFlag);
      
      // Premium users are not daily-limited here.
      if (isPremium) {
        return {
          canAccess: true,
          reason: 'premium_access'
        };
      }

      if (!this.hasFiniteLimit(this.DAILY_LIMITS.FREE_PROMPTS)) {
        return {
          canAccess: true,
          reason: 'within_free_limits'
        };
      }
      
      // Check daily usage limit
      const usage = await UsageEventsService.getDailyUsage(userId);
      if (usage.prompts >= this.DAILY_LIMITS.FREE_PROMPTS) {
        return {
          canAccess: false,
          reason: 'daily_limit_reached',
          message: `Free includes the core experience with a smaller growing prompt library. Premium starts bigger and keeps growing faster.`
        };
      }
      
      return {
        canAccess: true,
        reason: 'within_free_limits'
      };
    } catch (error) {
      CrashReporting.captureException(error, { source: 'PremiumGatekeeper.canAccessPrompt' });
      return {
        canAccess: false,
        reason: 'error',
        message: 'Unable to verify access. Please try again.'
      };
    }
  }

  // Check if user can access a date idea
  async canAccessDate(userId, isPremiumFlag = false) {
    try {
      const isPremium = this.isPremiumUser(isPremiumFlag);
      
      // Premium users have unlimited access
      if (isPremium) {
        return {
          canAccess: true,
          reason: 'premium_access'
        };
      }

      if (!this.hasFiniteLimit(this.DAILY_LIMITS.FREE_DATES)) {
        return {
          canAccess: true,
          reason: 'within_free_limits'
        };
      }
      
      // Check daily usage limit for free users
      const usage = await UsageEventsService.getDailyUsage(userId);
      if (usage.dates >= this.DAILY_LIMITS.FREE_DATES) {
        return {
          canAccess: false,
          reason: 'daily_limit_reached',
          message: `Free includes a smaller growing date library. Premium starts bigger and keeps growing faster for both of you.`
        };
      }
      
      return {
        canAccess: true,
        reason: 'within_free_limits'
      };
    } catch (error) {
      CrashReporting.captureException(error, { source: 'PremiumGatekeeper.canAccessDate' });
      return {
        canAccess: false,
        reason: 'error',
        message: 'Unable to verify access. Please try again.'
      };
    }
  }

  // Get filtered prompts based on user's access level
  async getAccessiblePrompts(userId, filters = {}, isPremiumFlag = false) {
    try {
      const isPremium = this.isPremiumUser(isPremiumFlag);
      const clonedFilters = { ...filters };
      
      const prompts = await StorageRouter.getPrompts(clonedFilters);
      
      return {
        prompts,
        isPremium,
        accessInfo: {
          availableHeatLevels: isPremium ? 
            this.DAILY_LIMITS.PREMIUM_HEAT_LEVELS : 
            this.DAILY_LIMITS.FREE_HEAT_LEVELS,
          dailyLimit: isPremium ? 'unlimited' : this.DAILY_LIMITS.FREE_PROMPTS
        }
      };
    } catch (error) {
      throw new Error(`Failed to get accessible prompts: ${error.message}`);
    }
  }

  // Track usage and check limits
  async trackPromptUsage(userId, promptId, isPremiumFlag = false, promptHeatLevel = 1) {
    try {
      const accessCheck = await this.canAccessPrompt(userId, promptHeatLevel, isPremiumFlag);
      
      if (!accessCheck.canAccess) {
        return accessCheck;
      }
      
      if (!this.isPremiumUser(isPremiumFlag)) {
        await UsageEventsService.incrementDailyUsage(userId, 'prompts');
      }
      
      return {
        success: true,
        message: 'Usage tracked successfully'
      };
    } catch (error) {
      throw new Error(`Failed to track prompt usage: ${error.message}`);
    }
  }

  // Track date usage
  async trackDateUsage(userId, dateId, isPremiumFlag = false) {
    try {
      const accessCheck = await this.canAccessDate(userId, isPremiumFlag);
      
      if (!accessCheck.canAccess) {
        return accessCheck;
      }
      
      if (!this.isPremiumUser(isPremiumFlag)) {
        await UsageEventsService.incrementDailyUsage(userId, 'dates');
      }
      
      return {
        success: true,
        message: 'Usage tracked successfully'
      };
    } catch (error) {
      throw new Error(`Failed to track date usage: ${error.message}`);
    }
  }

  async canAccessDateFlow(userId, dateId, isPremiumFlag = false) {
    try {
      const isPremium = this.isPremiumUser(isPremiumFlag);

      if (isPremium) {
        return {
          canAccess: true,
          reason: 'premium_access'
        };
      }

      if (!this.hasFiniteLimit(this.WEEKLY_LIMITS.FREE_FULL_DATE_FLOWS)) {
        return {
          canAccess: true,
          reason: 'within_free_limits'
        };
      }

      const weeklyUsage = await UsageEventsService.getWeeklyUsage(userId);
      const unlockedDateId = weeklyUsage.unlockedDateId || null;
      const usedFlows = weeklyUsage.dateFlows || 0;

      if (usedFlows < this.WEEKLY_LIMITS.FREE_FULL_DATE_FLOWS || unlockedDateId === dateId) {
        return {
          canAccess: true,
          reason: unlockedDateId === dateId ? 'existing_weekly_unlock' : 'within_free_limits'
        };
      }

      return {
        canAccess: false,
        reason: 'weekly_limit_reached',
        message: `Free already includes planning. Premium starts with a much larger date library and the full Keepsake archive.`
      };
    } catch (error) {
      CrashReporting.captureException(error, { source: 'PremiumGatekeeper.canAccessDateFlow' });
      return {
        canAccess: false,
        reason: 'error',
        message: 'Unable to verify access. Please try again.'
      };
    }
  }

  async trackDateFlowUsage(userId, dateId, isPremiumFlag = false) {
    try {
      const accessCheck = await this.canAccessDateFlow(userId, dateId, isPremiumFlag);

      if (!accessCheck.canAccess) {
        return accessCheck;
      }

      if (!this.isPremiumUser(isPremiumFlag)) {
        const weeklyUsage = await UsageEventsService.getWeeklyUsage(userId);
        if (weeklyUsage.unlockedDateId !== dateId) {
          await UsageEventsService.incrementWeeklyUsage(userId, 'dateFlows', { unlockedDateId: dateId });
        }
      }

      return {
        success: true,
        message: 'Weekly date flow tracked successfully'
      };
    } catch (error) {
      throw new Error(`Failed to track date flow usage: ${error.message}`);
    }
  }

  // Get user's current usage status
  async getUserUsageStatus(userId, isPremiumFlag = false) {
    try {
      const isPremium = this.isPremiumUser(isPremiumFlag);
      const usage = await UsageEventsService.getDailyUsage(userId);
      const weeklyUsage = await UsageEventsService.getWeeklyUsage(userId);
      
      return {
        isPremium,
        dailyUsage: {
          prompts: usage.prompts || 0,
          dates: usage.dates || 0
        },
        weeklyUsage: {
          dateFlows: weeklyUsage.dateFlows || 0,
          unlockedDateId: weeklyUsage.unlockedDateId || null
        },
        limits: {
          prompts: isPremium || !this.hasFiniteLimit(this.DAILY_LIMITS.FREE_PROMPTS)
            ? 'unlimited'
            : this.DAILY_LIMITS.FREE_PROMPTS,
          dates: isPremium || !this.hasFiniteLimit(this.DAILY_LIMITS.FREE_DATES)
            ? 'unlimited'
            : this.DAILY_LIMITS.FREE_DATES,
          dateFlowsPerWeek: isPremium || !this.hasFiniteLimit(this.WEEKLY_LIMITS.FREE_FULL_DATE_FLOWS)
            ? 'unlimited'
            : this.WEEKLY_LIMITS.FREE_FULL_DATE_FLOWS
        },
        remaining: {
          prompts: isPremium || !this.hasFiniteLimit(this.DAILY_LIMITS.FREE_PROMPTS)
            ? 'unlimited'
            : Math.max(0, this.DAILY_LIMITS.FREE_PROMPTS - (usage.prompts || 0)),
          dates: isPremium || !this.hasFiniteLimit(this.DAILY_LIMITS.FREE_DATES)
            ? 'unlimited'
            : Math.max(0, this.DAILY_LIMITS.FREE_DATES - (usage.dates || 0)),
          dateFlowsPerWeek: isPremium || !this.hasFiniteLimit(this.WEEKLY_LIMITS.FREE_FULL_DATE_FLOWS)
            ? 'unlimited'
            : Math.max(0, this.WEEKLY_LIMITS.FREE_FULL_DATE_FLOWS - (weeklyUsage.dateFlows || 0))
        },
        accessibleHeatLevels: getAccessibleHeatLevels(isPremium)
      };
    } catch (error) {
      throw new Error(`Failed to get usage status: ${error.message}`);
    }
  }
}

export default new PremiumGatekeeper();
