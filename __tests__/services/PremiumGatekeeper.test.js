/**
 * PremiumGatekeeper.test.js — Tests for premium access control
 */

jest.mock('../../services/LocalUsageService', () => ({
  __esModule: true,
  default: {
    getDailyUsage: jest.fn().mockResolvedValue({ prompts: 0, dates: 0 }),
    incrementDailyUsage: jest.fn().mockResolvedValue({ prompts: 1 }),
  },
}));

jest.mock('../../services/storage/StorageRouter', () => ({
  __esModule: true,
  default: {
    getPrompt: jest.fn(),
    getDate: jest.fn(),
  },
}));

import PremiumGatekeeper from '../../services/PremiumGatekeeper';

describe('PremiumGatekeeper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('canAccessPrompt', () => {
    it('allows premium users to access any heat level', async () => {
      const result = await PremiumGatekeeper.canAccessPrompt('user-1', 5, true);
      expect(result.canAccess).toBe(true);
    });

    it('blocks free users from heat 4-5', async () => {
      const result = await PremiumGatekeeper.canAccessPrompt('user-1', 4, false);
      expect(result.canAccess).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('blocks free users from heat 5', async () => {
      const result = await PremiumGatekeeper.canAccessPrompt('user-1', 5, false);
      expect(result.canAccess).toBe(false);
    });
  });

  describe('canAccessDate', () => {
    it('allows premium users any date', async () => {
      const result = await PremiumGatekeeper.canAccessDate('user-1', true);
      expect(result.canAccess).toBe(true);
    });
  });

  describe('getUserUsageStatus', () => {
    it('returns usage info for a user', async () => {
      const status = await PremiumGatekeeper.getUserUsageStatus('user-1', false);
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });
});
