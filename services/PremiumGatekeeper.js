import LocalUsageService from './LocalUsageService';
import StorageRouter from './storage/StorageRouter';
import CrashReporting from './CrashReporting';

class PremiumGatekeeper {
  constructor() {
    this.DAILY_LIMITS = {
      FREE_PROMPTS: 3, // Free users get 3 guided prompt responses per day
      FREE_DATES: 5,   // Free users can browse 5 date ideas per day
      FREE_HEAT_LEVELS: [1, 2, 3], // Free preview prompts cover levels 1-3
      PREMIUM_HEAT_LEVELS: [1, 2, 3, 4, 5] // Premium gets all levels
    };
    this.WEEKLY_LIMITS = {
      FREE_FULL_DATE_FLOWS: 2,
      FREE_LOVE_NOTES: 1,
    };
  }

  // Check if user has premium access
  isPremiumUser(isPremiumFlag) {
    return !!isPremiumFlag;
  }

  // Check if user can access a prompt
  async canAccessPrompt(userId, promptHeatLevel, isPremiumFlag = false) {
    try {
      const isPremium = this.isPremiumUser(isPremiumFlag);
      
      // Premium users can access all heat levels
      if (isPremium) {
        return {
          canAccess: true,
          reason: 'premium_access'
        };
      }
      
      // Free users can only access levels 1-3
      if (!this.DAILY_LIMITS.FREE_HEAT_LEVELS.includes(promptHeatLevel)) {
        return {
          canAccess: false,
          reason: 'premium_required',
          message: 'Heat levels 4 and 5 require premium access'
        };
      }
      
      // Check daily usage limit
      const usage = await LocalUsageService.getDailyUsage(userId);
      if (usage.prompts >= this.DAILY_LIMITS.FREE_PROMPTS) {
        return {
          canAccess: false,
          reason: 'daily_limit_reached',
          message: 'You\'ve used today\'s 3 free prompts. Discover the full experience for unlimited prompts and deeper connection.'
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
      
      // Check daily usage limit for free users
      const usage = await LocalUsageService.getDailyUsage(userId);
      if (usage.dates >= this.DAILY_LIMITS.FREE_DATES) {
        return {
          canAccess: false,
          reason: 'daily_limit_reached',
          message: 'Free users can explore 3 date ideas per day. Discover the full date night catalog for unlimited inspiration.'
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
      
      // Add heat level filter for free users
      if (!isPremium) {
        filters.heatLevels = this.DAILY_LIMITS.FREE_HEAT_LEVELS;
      }
      
      const prompts = await StorageRouter.getPrompts(filters);
      
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
      
      // Track the usage
      await LocalUsageService.incrementDailyUsage(userId, 'prompts');
      
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
      
      // Track the usage
      await LocalUsageService.incrementDailyUsage(userId, 'dates');
      
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

      const weeklyUsage = await LocalUsageService.getWeeklyUsage(userId);
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
        message: 'Free users can fully plan 1 date per week. Discover premium for unlimited date nights.'
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
        const weeklyUsage = await LocalUsageService.getWeeklyUsage(userId);
        if (weeklyUsage.unlockedDateId !== dateId) {
          await LocalUsageService.incrementWeeklyUsage(userId, 'dateFlows', { unlockedDateId: dateId });
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
      const usage = await LocalUsageService.getDailyUsage(userId);
      const weeklyUsage = await LocalUsageService.getWeeklyUsage(userId);
      
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
          prompts: isPremium ? 'unlimited' : this.DAILY_LIMITS.FREE_PROMPTS,
          dates: isPremium ? 'unlimited' : this.DAILY_LIMITS.FREE_DATES,
          dateFlowsPerWeek: isPremium ? 'unlimited' : this.WEEKLY_LIMITS.FREE_FULL_DATE_FLOWS
        },
        remaining: {
          prompts: isPremium ? 'unlimited' : Math.max(0, this.DAILY_LIMITS.FREE_PROMPTS - (usage.prompts || 0)),
          dates: isPremium ? 'unlimited' : Math.max(0, this.DAILY_LIMITS.FREE_DATES - (usage.dates || 0)),
          dateFlowsPerWeek: isPremium ? 'unlimited' : Math.max(0, this.WEEKLY_LIMITS.FREE_FULL_DATE_FLOWS - (weeklyUsage.dateFlows || 0))
        },
        accessibleHeatLevels: isPremium ? 
          this.DAILY_LIMITS.PREMIUM_HEAT_LEVELS : 
          this.DAILY_LIMITS.FREE_HEAT_LEVELS
      };
    } catch (error) {
      throw new Error(`Failed to get usage status: ${error.message}`);
    }
  }
}

export default new PremiumGatekeeper();
