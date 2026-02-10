import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';

// ✅ MUST match RevenueCat dashboard entitlement IDENTIFIER (not display name)
// Update this to match your actual entitlement identifier from RevenueCat dashboard
// Use the RevenueCat Debug screen (Settings → RevenueCat Debug) to find the correct ID
const ENTITLEMENT_ID = 'Between Us Pro';

class RevenueCatService {
  constructor() {
    this.currentUserId = null;
    this._configured = false;
    this._initPromise = null;
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

  async _doInit() {
    try {
      // Optional: keep verbose logs in dev only
      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);

      const apiKey =
        Platform.OS === 'ios'
          ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
          : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

      if (!apiKey) {
        console.warn('⚠️ RevenueCat API key missing. Set EXPO_PUBLIC_REVENUECAT_IOS_API_KEY / ANDROID.');
        return;
      }

      Purchases.configure({ apiKey });

      this._configured = true;
      console.log('✅ RevenueCat configured');
    
      // Debug: Log available entitlements to help identify the correct ENTITLEMENT_ID
      if (__DEV__) {
        try {
          const customerInfo = await Purchases.getCustomerInfo();
          console.log('📋 Available entitlement keys:', Object.keys(customerInfo?.entitlements?.active ?? {}));
        } catch (error) {
          console.log('Could not fetch initial customer info:', error);
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
      
      await Purchases.logIn(userId);
      this.currentUserId = userId;
      console.log('✅ User identified:', userId);
    } catch (error) {
      console.error('❌ Failed to identify user:', error);
      throw error;
    }
  }

  /**
   * Log out current user
   */
  async logoutUser() {
    try {
      await Purchases.logOut();
      this.currentUserId = null;
      console.log('User logged out');
    } catch (error) {
      console.error('Failed to logout user:', error);
      throw error;
    }
  }

  /**
   * Get available subscription offerings
   * Returns packages configured in RevenueCat dashboard
   */
  async getOfferings() {
    try {
      const offerings = await Purchases.getOfferings();
      
      if (offerings.current !== null && offerings.current.availablePackages.length > 0) {
        return {
          current: offerings.current,
          packages: offerings.current.availablePackages,
        };
      }
      
      console.warn('No offerings available');
      return { current: null, packages: [] };
    } catch (error) {
      console.error('Failed to get offerings:', error);
      throw error;
    }
  }

  /**
   * Purchase a subscription package
   */
  async purchasePackage(packageToPurchase) {
    try {
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
      
      console.error('Purchase failed:', error);
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
      const customerInfo = await Purchases.restorePurchases();
      const isPremium = this.checkPremiumStatus(customerInfo);
      
      return {
        success: true,
        isPremium,
        customerInfo,
      };
    } catch (error) {
      console.error('Failed to restore purchases:', error);
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
      const customerInfo = await Purchases.getCustomerInfo();
      const isPremium = this.checkPremiumStatus(customerInfo);
      
      return {
        customerInfo,
        isPremium,
        activeSubscriptions: customerInfo.activeSubscriptions,
        entitlements: customerInfo.entitlements.active,
      };
    } catch (error) {
      console.error('Failed to get customer info:', error);
      throw error;
    }
  }

  /**
   * Check if user has premium access
   * Checks for the entitlement configured in RevenueCat dashboard
   */
  checkPremiumStatus(customerInfo) {
    if (!customerInfo) return false;
    
    // Check if user has active entitlement
    const premiumEntitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
    return premiumEntitlement !== undefined && premiumEntitlement !== null;
  }

  /**
   * Get the active entitlement object (if any)
   * Used by SubscriptionContext to extract subscription details
   */
  getActiveEntitlement(customerInfo) {
    const active = customerInfo?.entitlements?.active ?? {};
    return active[ENTITLEMENT_ID] ?? null;
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
      console.error('Failed to get subscription details:', error);
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
      console.error('Failed to check intro eligibility:', error);
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
}

// Export singleton instance
export default new RevenueCatService();
