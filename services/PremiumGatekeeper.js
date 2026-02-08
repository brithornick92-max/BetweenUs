import LocalUsageService from './LocalUsageService';
import StorageRouter from './storage/StorageRouter';

class PremiumGatekeeper {
  constructor() {
    this.DAILY_LIMITS = {
      FREE_PROMPTS: 1,
      FREE_DATES: 1,
      FREE_HEAT_LEVELS: [1, 2, 3], // Free users only get levels 1-3
      PREMIUM_HEAT_LEVELS: [1, 2, 3, 4, 5] // Premium gets all levels
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
          message: `Free users get ${this.DAILY_LIMITS.FREE_PROMPTS} prompt per day. Upgrade to premium for unlimited access.`
        };
      }
      
      return {
        canAccess: true,
        reason: 'within_free_limits'
      };
    } catch (error) {
      console.error('Error checking prompt access:', error);
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
          message: `Free users get ${this.DAILY_LIMITS.FREE_DATES} date idea per day. Upgrade to premium for unlimited access.`
        };
      }
      
      return {
        canAccess: true,
        reason: 'within_free_limits'
      };
    } catch (error) {
      console.error('Error checking date access:', error);
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

  // Get user's current usage status
  async getUserUsageStatus(userId, isPremiumFlag = false) {
    try {
      const isPremium = this.isPremiumUser(isPremiumFlag);
      const usage = await LocalUsageService.getDailyUsage(userId);
      
      return {
        isPremium,
        dailyUsage: {
          prompts: usage.prompts || 0,
          dates: usage.dates || 0
        },
        limits: {
          prompts: isPremium ? 'unlimited' : this.DAILY_LIMITS.FREE_PROMPTS,
          dates: isPremium ? 'unlimited' : this.DAILY_LIMITS.FREE_DATES
        },
        remaining: {
          prompts: isPremium ? 'unlimited' : Math.max(0, this.DAILY_LIMITS.FREE_PROMPTS - (usage.prompts || 0)),
          dates: isPremium ? 'unlimited' : Math.max(0, this.DAILY_LIMITS.FREE_DATES - (usage.dates || 0))
        },
        accessibleHeatLevels: isPremium ? 
          this.DAILY_LIMITS.PREMIUM_HEAT_LEVELS : 
          this.DAILY_LIMITS.FREE_HEAT_LEVELS
      };
    } catch (error) {
      throw new Error(`Failed to get usage status: ${error.message}`);
    }
  }

  /**
   * @deprecated Use RevenueCatService.getOfferings() for real prices.
   * These hardcoded fallback prices will drift from App Store pricing.
   */
  getPricingInfo() {
    console.warn('[PremiumGatekeeper] getPricingInfo() is deprecated. Use RevenueCatService.getOfferings() for live pricing.');
    return {
      monthly: {
        price: 7.99,
        currency: 'USD',
        period: 'month',
        description: 'Per couple, per month'
      },
      yearly: {
        price: 49.00,
        currency: 'USD',
        period: 'year',
        description: 'Per couple, per year (save 49%)',
        savings: '49%'
      },
      lifetime: {
        price: 69.00,
        currency: 'USD',
        period: 'lifetime',
        description: 'Per couple, one-time payment',
        bestValue: true
      }
    };
  }

  // Get premium benefits list
  /** @deprecated Use FEATURE_META from utils/featureFlags.js instead. */
  getPremiumBenefits() {
    console.warn('[PremiumGatekeeper] getPremiumBenefits() is deprecated. Use FEATURE_META from utils/featureFlags.js.');
    return [
      'Unlimited prompts and date ideas',
      'Access to all heat levels (including 4 & 5)',
      'Dark mode theme',
      'Advanced personalization',
      'Partner sync and notifications',
      'Export your memories',
      'Priority customer support',
      'No ads ever'
    ];
  }
}

export default new PremiumGatekeeper();
