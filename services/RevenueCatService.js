import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import CrashReporting from './CrashReporting';

// ✅ Matches RevenueCat dashboard entitlement identifier exactly
const ENTITLEMENT_ID = 'Between Us Pro';

class RevenueCatService {
  constructor() {
    this.currentUserId = null;
    this._configured = false;
    this._initPromise = null;
    this._offeringsUnavailable = false;
    this._offeringsUnavailableWarned = false;
    this._configIssue = null;
  }

  /**
   * Initialize RevenueCat SDK
   * MUST be called once at app startup before any other RevenueCat operations
   */
  async init() {
    if (this._configured) return;
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._doInit();
    return this._initPromise;
  }

  ensureConfigured() {
    if (!this._configured) {
      throw new Error('RevenueCat not configured');
    }
  }

  getApiKey() {
    const key = Platform.OS === 'android'
      ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
    return key || null;
  }

  getMissingKeyName() {
    return Platform.OS === 'android'
      ? 'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY'
      : 'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY';
  }

  getDiagnostics() {
    return {
      configured: this._configured,
      offeringsUnavailable: this._offeringsUnavailable,
      configIssue: this._configIssue,
      missingKeyName: this.getMissingKeyName(),
      hasApiKey: !!this.getApiKey(),
    };
  }

  async _doInit() {
    try {
      // Keep SDK logs quiet to avoid noisy non-fatal offerings spam
      Purchases.setLogLevel(LOG_LEVEL.WARN);

      const apiKey = this.getApiKey();
      const missingKeyName = this.getMissingKeyName();

      if (!apiKey) {
        this._configIssue = {
          reason: 'missing_api_key',
          missingKeyName,
        };
        if (__DEV__) console.warn(`⚠️ RevenueCat API key missing. Set ${missingKeyName}.`);
        return;
      }

      Purchases.configure({ apiKey });

      this._configured = true;
      this._configIssue = null;
      if (__DEV__) console.log('✅ RevenueCat configured');
    
      // Debug: Log available entitlements to help identify the correct ENTITLEMENT_ID
      if (__DEV__) {
        try {
          const customerInfo = await Purchases.getCustomerInfo();
          console.log('📋 Available entitlement keys:', Object.keys(customerInfo?.entitlements?.active ?? {}));
        } catch (error) {
          if (__DEV__) console.log('Could not fetch initial customer info:', error?.message);
        }
      }
    } catch (error) {
      this._initPromise = null; // Allow retry on failure
      throw error;
    }
  }

  /**
   * Identify user for subscription tracking.
   * Each partner must have their own RC identity (use user.uid, NOT coupleId).
   * Premium sharing is handled server-side via the set_couple_premium Supabase RPC.
   * @param {string} userId - The individual user's auth UID
   */
  async identifyUser(userId) {
    try {
      // Ensure SDK is initialized before logging in
      await this.init();
      this.ensureConfigured();

      if (!userId) {
        throw new Error('RevenueCat identifyUser requires a userId');
      }

      if (this.currentUserId === userId) {
        if (__DEV__) console.log('RevenueCat identify skipped; user already active');
        return { skipped: true, userId };
      }

      const cachedAppUserId = typeof Purchases.getAppUserID === 'function'
        ? await Purchases.getAppUserID().catch(() => null)
        : null;

      if (cachedAppUserId === userId) {
        this.currentUserId = userId;
        if (__DEV__) console.log('RevenueCat identify skipped; SDK already has user');
        return { skipped: true, userId };
      }

      await Purchases.logIn(userId);
      this.currentUserId = userId;
      // Reset per-user offerings cache flag
      this._offeringsUnavailable = false;
      this._offeringsUnavailableWarned = false;
      if (__DEV__) console.log('RevenueCat identify ok');
      return { skipped: false, userId };
    } catch (error) {
      CrashReporting.captureException(error, { source: 'RevenueCatService.identifyUser' });
      throw error;
    }
  }

  /**
   * Log out current user
   */
  async logoutUser() {
    try {
      this.ensureConfigured();
      await Purchases.logOut();
      this.currentUserId = null;
      if (__DEV__) console.log('User logged out');
    } catch (error) {
      CrashReporting.captureException(error, { source: 'RevenueCatService.logoutUser' });
      throw error;
    }
  }

  /**
   * Get available subscription offerings
   * Returns packages configured in RevenueCat dashboard
   */
  async getOfferings() {
    try {
      if (!this._configured) {
        const diagnostics = this.getDiagnostics();
        return {
          current: null,
          packages: [],
          nonFatal: true,
          reason: diagnostics.configIssue?.reason || 'not_configured',
          missingKeyName: diagnostics.configIssue?.missingKeyName,
        };
      }

      // Quiet fallback after first known "not configured" offerings failure
      if (this._offeringsUnavailable) {
        return {
          current: null,
          packages: [],
          nonFatal: true,
          reason: 'offerings_unavailable',
        };
      }

      const offerings = await Purchases.getOfferings();
      
      if (offerings.current !== null && offerings.current.availablePackages.length > 0) {
        return {
          current: offerings.current,
          packages: offerings.current.availablePackages || [],
          nonFatal: false,
        };
      }
      
      return { current: null, packages: [], nonFatal: true, reason: 'no_offerings' };
    } catch (error) {
      const msg = String(error?.message || error || '').toLowerCase();
      const nonFatalMissingOfferings =
        msg.includes('no offerings') ||
        msg.includes('offeringsmanager.error') ||
        msg.includes('why-are-offerings-empty') ||
        msg.includes('product catalog') ||
        msg.includes('no app store products');

      if (nonFatalMissingOfferings) {
        this._offeringsUnavailable = true;
        if (!this._offeringsUnavailableWarned) {
          this._offeringsUnavailableWarned = true;
          if (__DEV__) console.warn('[RevenueCat] Offerings unavailable; falling back to free mode.');
        }
        return {
          current: null,
          packages: [],
          nonFatal: true,
          reason: 'offerings_unavailable',
        };
      }

      if (msg.includes('not configured')) {
        const diagnostics = this.getDiagnostics();
        return {
          current: null,
          packages: [],
          nonFatal: true,
          reason: diagnostics.configIssue?.reason || 'not_configured',
          missingKeyName: diagnostics.configIssue?.missingKeyName,
        };
      }

      CrashReporting.captureException(error, { source: 'RevenueCatService.getOfferings' });
      throw error;
    }
  }

  /**
   * Purchase a subscription package
   */
  async purchasePackage(packageToPurchase) {
    try {
      this.ensureConfigured();
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      
      // Check if user now has premium access
      const isPremium = this.checkPremiumStatus(customerInfo);
      
      return {
        success: true,
        isPremium,
        customerInfo,
      };
    } catch (error) {
      if (error.userCancelled) {
        return {
          success: false,
          cancelled: true,
          error: 'User cancelled purchase',
        };
      }
      
      CrashReporting.captureException(error, { source: 'RevenueCatService.purchasePackage' });
      return {
        success: false,
        cancelled: false,
        error: error.message,
      };
    }
  }

  /**
   * Restore previous purchases
   * Important for users who reinstall the app or switch devices
   */
  async restorePurchases() {
    try {
      this.ensureConfigured();
      const customerInfo = await Purchases.restorePurchases();
      const isPremium = this.checkPremiumStatus(customerInfo);
      
      return {
        success: true,
        isPremium,
        customerInfo,
      };
    } catch (error) {
      CrashReporting.captureException(error, { source: 'RevenueCatService.restorePurchases' });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get current customer info and subscription status
   */
  async getCustomerInfo() {
    try {
      this.ensureConfigured();
      const customerInfo = await Purchases.getCustomerInfo();
      const isPremium = this.checkPremiumStatus(customerInfo);

      return {
        customerInfo,
        isPremium,
        activeSubscriptions: customerInfo?.activeSubscriptions ?? [],
        entitlements: customerInfo?.entitlements?.active ?? {},
      };
    } catch (error) {
      CrashReporting.captureException(error, { source: 'RevenueCatService.getCustomerInfo' });
      throw error;
    }
  }

  /**
   * Check if user has premium access
   * Checks for the entitlement configured in RevenueCat dashboard
   */
  checkPremiumStatus(customerInfo) {
    if (!customerInfo) return false;

    // Safe-check nested structure for entitlement
    const premiumEntitlement = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID] ?? null;
    return premiumEntitlement !== undefined && premiumEntitlement !== null;
  }

  /**
   * Get the active entitlement object (if any)
   * Used by SubscriptionContext to extract subscription details
   */
  getActiveEntitlement(customerInfo) {
    const active = customerInfo?.entitlements?.active ?? {};
    return active?.[ENTITLEMENT_ID] ?? null;
  }

  /**
   * Get subscription details for display
   */
  async getSubscriptionDetails() {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const isPremium = this.checkPremiumStatus(customerInfo);
      
      if (!isPremium) {
        return {
          isPremium: false,
          details: null,
        };
      }

      const premiumEntitlement = this.getActiveEntitlement(customerInfo);
      
      if (!premiumEntitlement) {
        return {
          isPremium: false,
          details: null,
        };
      }
      
      return {
        isPremium: true,
        details: {
          productIdentifier: premiumEntitlement.productIdentifier,
          expirationDate: premiumEntitlement.expirationDate,
          willRenew: premiumEntitlement.willRenew,
          periodType: premiumEntitlement.periodType,
          store: premiumEntitlement.store,
          isSandbox: premiumEntitlement.isSandbox,
        },
      };
    } catch (error) {
      CrashReporting.captureException(error, { source: 'RevenueCatService.getSubscriptionDetails' });
      throw error;
    }
  }

  /**
   * Check if user is eligible for intro pricing
   */
  async checkIntroEligibility(productIdentifiers) {
    try {
      const eligibility = await Purchases.checkTrialOrIntroductoryPriceEligibility(
        productIdentifiers
      );
      return eligibility;
    } catch (error) {
      CrashReporting.captureException(error, { source: 'RevenueCatService.checkIntroEligibility' });
      return {};
    }
  }

  /**
   * Set up listener for customer info updates
   * Useful for real-time subscription status changes
   */
  addCustomerInfoUpdateListener(callback) {
    return Purchases.addCustomerInfoUpdateListener((customerInfo) => {
      const isPremium = this.checkPremiumStatus(customerInfo);
      callback({ customerInfo, isPremium });
    });
  }

  /**
   * Format price for display
   */
  formatPrice(packageItem) {
    if (!packageItem || !packageItem.product) return '';
    
    const { priceString, introPrice } = packageItem.product;
    
    if (introPrice && introPrice.priceString) {
      return `${introPrice.priceString} then ${priceString}`;
    }
    
    return priceString;
  }

  /**
   * Get package duration text
   */
  getPackageDuration(packageItem) {
    if (!packageItem) return '';
    
    const { identifier } = packageItem;
    
    if (identifier.includes('monthly')) return 'per month';
    if (identifier.includes('annual') || identifier.includes('yearly')) return 'per year';
    if (identifier.includes('lifetime')) return 'one-time';
    
    return '';
  }

  /**
   * Check if package is yearly/annual (the recommended plan)
   */
  isYearlyPackage(packageItem) {
    if (!packageItem) return false;
    const id = (packageItem.identifier || '').toLowerCase();
    return id.includes('annual') || id.includes('yearly');
  }

  /**
   * Sort packages: yearly first, then monthly, then lifetime
   */
  sortPackages(packages) {
    if (!packages?.length) return [];
    return [...packages].sort((a, b) => {
      const order = (pkg) => {
        const id = (pkg.identifier || '').toLowerCase();
        if (id.includes('annual') || id.includes('yearly')) return 0;
        if (id.includes('monthly')) return 1;
        if (id.includes('lifetime')) return 2;
        return 3;
      };
      return order(a) - order(b);
    });
  }
}

// Export singleton instance
export default new RevenueCatService();
