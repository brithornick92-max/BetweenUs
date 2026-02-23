/**
 * RevenueCatService.test.js — Tests for subscription management
 */

// ── Mocks ──────────────────────────────────────────────────────────

const mockConfigure = jest.fn();
const mockLogIn = jest.fn().mockResolvedValue({ customerInfo: {} });
const mockLogOut = jest.fn().mockResolvedValue(undefined);
const mockGetOfferings = jest.fn().mockResolvedValue({
  current: {
    availablePackages: [
      {
        identifier: '$rc_monthly',
        packageType: 'MONTHLY',
        product: {
          title: 'Premium Monthly',
          priceString: '$4.99',
          introPrice: null,
        },
      },
      {
        identifier: '$rc_annual',
        packageType: 'ANNUAL',
        product: {
          title: 'Premium Annual',
          priceString: '$29.99',
          introPrice: { priceString: 'Free', period: '7 days' },
        },
      },
    ],
  },
});
const mockPurchasePackage = jest.fn().mockResolvedValue({
  customerInfo: {
    entitlements: {
      active: { 'Between Us Pro': { isActive: true } },
    },
  },
});
const mockRestorePurchases = jest.fn().mockResolvedValue({
  entitlements: {
    active: { 'Between Us Pro': { isActive: true } },
  },
});
const mockGetCustomerInfo = jest.fn().mockResolvedValue({
  entitlements: {
    active: { 'Between Us Pro': { isActive: true, productIdentifier: 'com.betweenus.pro.monthly' } },
  },
  activeSubscriptions: ['com.betweenus.pro.monthly'],
});
const mockSetLogLevel = jest.fn();
const mockAddListener = jest.fn().mockReturnValue(jest.fn());
const mockCheckTrialOrIntroPriceEligibility = jest.fn().mockResolvedValue({});

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: mockConfigure,
    logIn: mockLogIn,
    logOut: mockLogOut,
    getOfferings: mockGetOfferings,
    purchasePackage: mockPurchasePackage,
    restorePurchases: mockRestorePurchases,
    getCustomerInfo: mockGetCustomerInfo,
    setLogLevel: mockSetLogLevel,
    addCustomerInfoUpdateListener: mockAddListener,
    checkTrialOrIntroPriceEligibility: mockCheckTrialOrIntroPriceEligibility,
  },
  LOG_LEVEL: { WARN: 2, DEBUG: 4, VERBOSE: 5 },
}));

// Set env vars for API keys
process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = 'test_ios_key';
process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY = 'test_android_key';

// Re-require after mocks
const RevenueCatService = require('../../services/RevenueCatService').default;

describe('RevenueCatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset service state
    RevenueCatService._configured = false;
    RevenueCatService._initPromise = null;
    RevenueCatService.currentUserId = null;
    RevenueCatService._offeringsUnavailable = false;
    RevenueCatService._offeringsUnavailableWarned = false;
  });

  describe('init', () => {
    it('configures Purchases SDK', async () => {
      await RevenueCatService.init();
      expect(mockSetLogLevel).toHaveBeenCalled();
      expect(mockConfigure).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: 'test_ios_key' })
      );
      expect(RevenueCatService._configured).toBe(true);
    });

    it('is idempotent', async () => {
      await RevenueCatService.init();
      await RevenueCatService.init();
      // configure should only be called once
      expect(mockConfigure).toHaveBeenCalledTimes(1);
    });

    it('allows retry on failure', async () => {
      mockConfigure.mockImplementationOnce(() => {
        throw new Error('Network error');
      });
      let caught = false;
      try {
        await RevenueCatService.init();
      } catch (e) {
        caught = true;
        expect(e.message).toBe('Network error');
      }
      expect(caught).toBe(true);
      expect(RevenueCatService._configured).toBe(false);
    });
  });

  describe('ensureConfigured', () => {
    it('throws if not configured', () => {
      expect(() => RevenueCatService.ensureConfigured()).toThrow('RevenueCat not configured');
    });

    it('does not throw if configured', async () => {
      await RevenueCatService.init();
      expect(() => RevenueCatService.ensureConfigured()).not.toThrow();
    });
  });

  describe('identifyUser', () => {
    it('calls Purchases.logIn with userId', async () => {
      await RevenueCatService.init();
      await RevenueCatService.identifyUser('user-abc');
      expect(mockLogIn).toHaveBeenCalledWith('user-abc');
      expect(RevenueCatService.currentUserId).toBe('user-abc');
    });

    it('initializes SDK if not yet configured', async () => {
      await RevenueCatService.identifyUser('user-abc');
      expect(mockConfigure).toHaveBeenCalled();
      expect(mockLogIn).toHaveBeenCalledWith('user-abc');
    });
  });

  describe('logoutUser', () => {
    it('calls Purchases.logOut and clears state', async () => {
      await RevenueCatService.init();
      RevenueCatService.currentUserId = 'user-abc';
      await RevenueCatService.logoutUser();
      expect(mockLogOut).toHaveBeenCalled();
      expect(RevenueCatService.currentUserId).toBeNull();
    });
  });

  describe('getOfferings', () => {
    it('returns offerings with packages', async () => {
      await RevenueCatService.init();
      const result = await RevenueCatService.getOfferings();
      expect(mockGetOfferings).toHaveBeenCalled();
      expect(result).toBeTruthy();
      expect(result.current).toBeTruthy();
    });
  });

  describe('purchasePackage', () => {
    it('returns success with premium status', async () => {
      await RevenueCatService.init();
      const pkg = { identifier: '$rc_monthly' };
      const result = await RevenueCatService.purchasePackage(pkg);
      expect(mockPurchasePackage).toHaveBeenCalledWith(pkg);
      expect(result.success).toBe(true);
      expect(result.isPremium).toBe(true);
    });
  });

  describe('restorePurchases', () => {
    it('restores and checks premium', async () => {
      await RevenueCatService.init();
      const result = await RevenueCatService.restorePurchases();
      expect(mockRestorePurchases).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('checkPremiumStatus', () => {
    it('returns true when entitlement is active', () => {
      const customerInfo = {
        entitlements: {
          active: { 'Between Us Pro': { isActive: true } },
        },
      };
      expect(RevenueCatService.checkPremiumStatus(customerInfo)).toBe(true);
    });

    it('returns false when entitlement is missing', () => {
      const customerInfo = {
        entitlements: { active: {} },
      };
      expect(RevenueCatService.checkPremiumStatus(customerInfo)).toBe(false);
    });

    it('returns false for null customerInfo', () => {
      expect(RevenueCatService.checkPremiumStatus(null)).toBe(false);
    });
  });

  describe('getActiveEntitlement', () => {
    it('returns the active entitlement object', () => {
      const entitlement = { isActive: true, productIdentifier: 'com.betweenus.pro' };
      const customerInfo = {
        entitlements: { active: { 'Between Us Pro': entitlement } },
      };
      expect(RevenueCatService.getActiveEntitlement(customerInfo)).toEqual(entitlement);
    });

    it('returns null when no active entitlement', () => {
      expect(RevenueCatService.getActiveEntitlement({ entitlements: { active: {} } })).toBeNull();
    });
  });

  describe('utility methods', () => {
    it('formatPrice returns product price string', () => {
      const pkg = { product: { priceString: '$4.99' } };
      expect(RevenueCatService.formatPrice(pkg)).toBe('$4.99');
    });

    it('isYearlyPackage identifies annual packages', () => {
      expect(RevenueCatService.isYearlyPackage({ identifier: '$rc_annual', packageType: 'ANNUAL' })).toBe(true);
      expect(RevenueCatService.isYearlyPackage({ identifier: '$rc_monthly', packageType: 'MONTHLY' })).toBe(false);
    });

    it('sortPackages orders by type preference', () => {
      const packages = [
        { packageType: 'MONTHLY', identifier: 'monthly' },
        { packageType: 'ANNUAL', identifier: 'annual' },
        { packageType: 'LIFETIME', identifier: 'lifetime' },
      ];
      const sorted = RevenueCatService.sortPackages(packages);
      expect(sorted).toBeTruthy();
      expect(Array.isArray(sorted)).toBe(true);
    });
  });
});
