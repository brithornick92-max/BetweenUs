/**
 * UsageEventsService.test.js — Tests for daily usage tracking
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import UsageEventsService, { FREE_TIER_LIMITS } from '../../services/UsageEventsService';

beforeEach(() => {
  jest.clearAllMocks();
  AsyncStorage.getItem.mockResolvedValue(null);
  AsyncStorage.setItem.mockResolvedValue(undefined);
});

describe('FREE_TIER_LIMITS', () => {
  it('defines correct limits matching featureFlags.FREE_LIMITS', () => {
    expect(FREE_TIER_LIMITS.promptsPerDay).toBe(1);
    expect(FREE_TIER_LIMITS.visibleDates).toBe(3);
    expect(FREE_TIER_LIMITS.fullDateFlowsPerWeek).toBe(1);
    expect(FREE_TIER_LIMITS.journalEntriesVisible).toBe(0);
    expect(FREE_TIER_LIMITS.surpriseMeEnabled).toBe(false);
  });
});

describe('UsageEventsService', () => {
  const userId = 'test-user-123';

  describe('getDailyUsage', () => {
    it('creates a fresh record when none exists', async () => {
      const usage = await UsageEventsService.getDailyUsage(userId);
      expect(usage).toBeDefined();
      expect(usage.prompts).toBe(0);
      expect(usage.dates).toBe(0);
      expect(usage.challenges).toBe(0);
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('returns existing record when it exists', async () => {
      const existing = { date: '2026-02-22', prompts: 3, dates: 1, challenges: 0 };
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(existing));

      const usage = await UsageEventsService.getDailyUsage(userId);
      expect(usage.prompts).toBe(3);
      expect(usage.dates).toBe(1);
    });

    it('handles corrupted JSON gracefully', async () => {
      AsyncStorage.getItem.mockResolvedValue('not-json-{{{');

      const usage = await UsageEventsService.getDailyUsage(userId);
      expect(usage.prompts).toBe(0);
      expect(usage.dates).toBe(0);
    });
  });

  describe('incrementDailyUsage', () => {
    it('increments prompt count', async () => {
      const result = await UsageEventsService.incrementDailyUsage(userId, 'prompts');
      expect(result.prompts).toBe(1);
    });

    it('increments from existing count', async () => {
      const existing = { date: '2026-02-22', prompts: 5, dates: 0, challenges: 0 };
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(existing));

      const result = await UsageEventsService.incrementDailyUsage(userId, 'prompts');
      expect(result.prompts).toBe(6);
    });

    it('increments date count', async () => {
      const result = await UsageEventsService.incrementDailyUsage(userId, 'dates');
      expect(result.dates).toBe(1);
    });

    it('records lastUpdated timestamp', async () => {
      const result = await UsageEventsService.incrementDailyUsage(userId, 'prompts');
      expect(result.lastUpdated).toBeDefined();
    });
  });

  describe('resetIfNewDay', () => {
    it('creates a new record if none exists for today', async () => {
      await UsageEventsService.resetIfNewDay(userId);
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('refreshes the cache when a record already exists', async () => {
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify({ date: '2026-02-22', prompts: 0 }));
      await UsageEventsService.resetIfNewDay(userId);
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('weekly usage', () => {
    it('creates a fresh weekly record when none exists', async () => {
      const usage = await UsageEventsService.getWeeklyUsage(userId);
      expect(usage).toBeDefined();
      expect(usage.dateFlows).toBe(0);
      expect(usage.unlockedDateId).toBeNull();
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('increments weekly date flow count and stores unlocked date id', async () => {
      const result = await UsageEventsService.incrementWeeklyUsage(userId, 'dateFlows', { unlockedDateId: 'date-1' });
      expect(result.dateFlows).toBe(1);
      expect(result.unlockedDateId).toBe('date-1');
    });
  });
});
