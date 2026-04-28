/**
 * User Boundaries Integration Tests
 * 
 * Tests the complete flow of hiding/unhiding content and verifying
 * that boundaries are respected across the app:
 * 1. User hides a prompt/category/date
 * 2. Hidden item disappears from deck immediately
 * 3. Hidden item appears in Settings > Soft Boundaries
 * 4. User can unhide from Settings
 * 5. Unhidden item reappears in deck
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SoftBoundaries } from '../../services/PolishEngine';
import contentAccessService from '../../services/ContentAccessService';

// Mock data
const MOCK_PROMPTS = [
  { id: 'p1', text: 'Romantic prompt', category: 'romance', heat: 1, releaseWeek: 0 },
  { id: 'p2', text: 'Playful prompt', category: 'playful', heat: 2, releaseWeek: 0 },
  { id: 'p3', text: 'Sensual prompt', category: 'sensual', heat: 3, releaseWeek: 0 },
  { id: 'p4', text: 'Steamy prompt', category: 'physical', heat: 4, releaseWeek: 0 },
  { id: 'p5', text: 'Explicit prompt', category: 'fantasy', heat: 5, releaseWeek: 0 },
  { id: 'p6', text: 'Another romance', category: 'romance', heat: 1, releaseWeek: 0 },
];

const MOCK_DATES = [
  { id: 'd1', title: 'Cozy movie night', heat: 1, releaseWeek: 0 },
  { id: 'd2', title: 'Adventure date', heat: 2, releaseWeek: 0 },
  { id: 'd3', title: 'Romantic dinner', heat: 3, releaseWeek: 0 },
];

beforeEach(() => {
  jest.clearAllMocks();
  AsyncStorage.getItem.mockResolvedValue(null);
  AsyncStorage.setItem.mockResolvedValue(undefined);
});

describe('User Boundaries Integration', () => {
  describe('Hide Individual Prompt Flow', () => {
    it('should hide a prompt and remove it from accessible prompts', async () => {
      // Step 1: Get initial accessible prompts
      const initialResult = await contentAccessService.getAccessiblePrompts(MOCK_PROMPTS, {
        userId: 'user1',
        isPremium: true,
        userSettings: {},
        includeAll: true,
      });
      
      expect(initialResult.prompts).toHaveLength(6);
      expect(initialResult.prompts.find(p => p.id === 'p1')).toBeDefined();

      // Step 2: User hides prompt p1
      await SoftBoundaries.pauseEntry('p1');

      // Step 3: Verify it's in the boundaries
      const boundaries = await SoftBoundaries.getAll();
      expect(boundaries.pausedEntries).toContain('p1');

      // Step 4: Get accessible prompts again - p1 should be filtered out
      const afterHideResult = await contentAccessService.getAccessiblePrompts(MOCK_PROMPTS, {
        userId: 'user1',
        isPremium: true,
        userSettings: { boundaries },
        includeAll: true,
      });

      expect(afterHideResult.prompts).toHaveLength(5);
      expect(afterHideResult.prompts.find(p => p.id === 'p1')).toBeUndefined();
    });

    it('should unhide a prompt and make it accessible again', async () => {
      // Step 1: Hide prompt p1
      await SoftBoundaries.pauseEntry('p1');
      let boundaries = await SoftBoundaries.getAll();
      expect(boundaries.pausedEntries).toContain('p1');

      // Step 2: Verify it's hidden
      const hiddenResult = await contentAccessService.getAccessiblePrompts(MOCK_PROMPTS, {
        userId: 'user1',
        isPremium: true,
        userSettings: { boundaries },
        includeAll: true,
      });
      expect(hiddenResult.prompts.find(p => p.id === 'p1')).toBeUndefined();

      // Step 3: Unhide prompt p1
      await SoftBoundaries.unpauseEntry('p1');
      boundaries = await SoftBoundaries.getAll();
      expect(boundaries.pausedEntries).not.toContain('p1');

      // Step 4: Verify it's accessible again
      const unhiddenResult = await contentAccessService.getAccessiblePrompts(MOCK_PROMPTS, {
        userId: 'user1',
        isPremium: true,
        userSettings: { boundaries },
        includeAll: true,
      });
      expect(unhiddenResult.prompts).toHaveLength(6);
      expect(unhiddenResult.prompts.find(p => p.id === 'p1')).toBeDefined();
    });
  });

  describe('Hide Category Flow', () => {
    it('should hide all prompts in a category', async () => {
      // Step 1: Hide 'romance' category
      await SoftBoundaries.hideCategory('romance');
      const boundaries = await SoftBoundaries.getAll();
      expect(boundaries.hiddenCategories).toContain('romance');

      // Step 2: Get accessible prompts - both romance prompts should be filtered
      const result = await contentAccessService.getAccessiblePrompts(MOCK_PROMPTS, {
        userId: 'user1',
        isPremium: true,
        userSettings: { boundaries },
        includeAll: true,
      });

      expect(result.prompts).toHaveLength(4); // 6 total - 2 romance = 4
      expect(result.prompts.find(p => p.category === 'romance')).toBeUndefined();
      expect(result.prompts.find(p => p.id === 'p1')).toBeUndefined();
      expect(result.prompts.find(p => p.id === 'p6')).toBeUndefined();
    });

    it('should unhide a category and restore all prompts', async () => {
      // Step 1: Hide category
      await SoftBoundaries.hideCategory('romance');
      let boundaries = await SoftBoundaries.getAll();

      // Step 2: Verify hidden
      const hiddenResult = await contentAccessService.getAccessiblePrompts(MOCK_PROMPTS, {
        userId: 'user1',
        isPremium: true,
        userSettings: { boundaries },
        includeAll: true,
      });
      expect(hiddenResult.prompts).toHaveLength(4);

      // Step 3: Unhide category
      await SoftBoundaries.unhideCategory('romance');
      boundaries = await SoftBoundaries.getAll();
      expect(boundaries.hiddenCategories).not.toContain('romance');

      // Step 4: Verify restored
      const restoredResult = await contentAccessService.getAccessiblePrompts(MOCK_PROMPTS, {
        userId: 'user1',
        isPremium: true,
        userSettings: { boundaries },
        includeAll: true,
      });
      expect(restoredResult.prompts).toHaveLength(6);
      expect(restoredResult.prompts.filter(p => p.category === 'romance')).toHaveLength(2);
    });
  });

  describe('Hide Spicy Content Flow', () => {
    it('should hide all heat 4+ prompts when hideSpicy is enabled', async () => {
      // Step 1: Enable hideSpicy
      await SoftBoundaries.setHideSpicy(true);
      const boundaries = await SoftBoundaries.getAll();
      expect(boundaries.hideSpicy).toBe(true);
      expect(boundaries.maxHeatOverride).toBe(3);

      // Step 2: Get accessible prompts - heat 4 and 5 should be filtered
      const result = await contentAccessService.getAccessiblePrompts(MOCK_PROMPTS, {
        userId: 'user1',
        isPremium: true,
        userSettings: { boundaries },
        includeAll: true,
      });

      expect(result.prompts).toHaveLength(4); // Only heat 1-3
      expect(result.prompts.find(p => p.heat >= 4)).toBeUndefined();
      expect(result.prompts.every(p => p.heat <= 3)).toBe(true);
    });

    it('should restore spicy content when hideSpicy is disabled', async () => {
      // Step 1: Enable then disable hideSpicy
      await SoftBoundaries.setHideSpicy(true);
      await SoftBoundaries.setHideSpicy(false);
      const boundaries = await SoftBoundaries.getAll();
      expect(boundaries.hideSpicy).toBe(false);
      expect(boundaries.maxHeatOverride).toBeNull();

      // Step 2: Verify all heat levels accessible
      const result = await contentAccessService.getAccessiblePrompts(MOCK_PROMPTS, {
        userId: 'user1',
        isPremium: true,
        userSettings: { boundaries },
        includeAll: true,
      });

      expect(result.prompts).toHaveLength(6);
      expect(result.prompts.find(p => p.heat === 4)).toBeDefined();
      expect(result.prompts.find(p => p.heat === 5)).toBeDefined();
    });
  });

  describe('Hide Date Flow', () => {
    it('should hide a date and filter it from accessible dates', async () => {
      // Step 1: Hide date d1
      await SoftBoundaries.pauseDate('d1');
      const boundaries = await SoftBoundaries.getAll();
      expect(boundaries.pausedDates).toContain('d1');

      // Step 2: Verify it's filtered
      const result = await contentAccessService.getAccessibleDates(MOCK_DATES, {
        userId: 'user1',
        isPremium: true,
        userSettings: { boundaries },
      });

      expect(result.dates).toHaveLength(2);
      expect(result.dates.find(d => d.id === 'd1')).toBeUndefined();
    });

    it('should unhide a date and restore it', async () => {
      // Step 1: Hide then unhide
      await SoftBoundaries.pauseDate('d1');
      await SoftBoundaries.unpauseDate('d1');
      const boundaries = await SoftBoundaries.getAll();
      expect(boundaries.pausedDates).not.toContain('d1');

      // Step 2: Verify restored
      const result = await contentAccessService.getAccessibleDates(MOCK_DATES, {
        userId: 'user1',
        isPremium: true,
        userSettings: { boundaries },
      });

      expect(result.dates).toHaveLength(3);
      expect(result.dates.find(d => d.id === 'd1')).toBeDefined();
    });
  });

  describe('Multiple Boundaries Combined', () => {
    it('should respect multiple boundary types simultaneously', async () => {
      // Step 1: Set multiple boundaries
      await SoftBoundaries.setHideSpicy(true); // Hides heat 4+
      await SoftBoundaries.hideCategory('playful'); // Hides playful category
      await SoftBoundaries.pauseEntry('p1'); // Hides specific prompt
      
      const boundaries = await SoftBoundaries.getAll();

      // Step 2: Get accessible prompts
      const result = await contentAccessService.getAccessiblePrompts(MOCK_PROMPTS, {
        userId: 'user1',
        isPremium: true,
        userSettings: { boundaries },
        includeAll: true,
      });

      // Expected: 6 total - 2 spicy (p4, p5) - 1 playful (p2) - 1 paused (p1) = 2
      expect(result.prompts).toHaveLength(2);
      expect(result.prompts.find(p => p.id === 'p1')).toBeUndefined(); // Paused
      expect(result.prompts.find(p => p.id === 'p2')).toBeUndefined(); // Hidden category
      expect(result.prompts.find(p => p.id === 'p4')).toBeUndefined(); // Spicy
      expect(result.prompts.find(p => p.id === 'p5')).toBeUndefined(); // Spicy
      expect(result.prompts.find(p => p.id === 'p3')).toBeDefined(); // Should show
      expect(result.prompts.find(p => p.id === 'p6')).toBeDefined(); // Should show
    });

    it('should handle clearing all boundaries', async () => {
      // Step 1: Set multiple boundaries
      await SoftBoundaries.setHideSpicy(true);
      await SoftBoundaries.hideCategory('playful');
      await SoftBoundaries.pauseEntry('p1');

      // Step 2: Clear all boundaries
      await SoftBoundaries.setHideSpicy(false);
      await SoftBoundaries.unhideCategory('playful');
      await SoftBoundaries.unpauseEntry('p1');

      const boundaries = await SoftBoundaries.getAll();

      // Step 3: Verify all prompts accessible
      const result = await contentAccessService.getAccessiblePrompts(MOCK_PROMPTS, {
        userId: 'user1',
        isPremium: true,
        userSettings: { boundaries },
        includeAll: true,
      });

      expect(result.prompts).toHaveLength(6);
    });
  });

  describe('Boundary Persistence', () => {
    it('should persist boundaries across app sessions', async () => {
      // Step 1: Set boundaries
      await SoftBoundaries.pauseEntry('p1');
      await SoftBoundaries.hideCategory('romance');
      
      // Simulate app restart by clearing mocks but keeping AsyncStorage state
      const savedData = AsyncStorage.setItem.mock.calls[AsyncStorage.setItem.mock.calls.length - 1][1];
      AsyncStorage.getItem.mockResolvedValue(savedData);

      // Step 2: Retrieve boundaries after "restart"
      const boundaries = await SoftBoundaries.getAll();
      
      expect(boundaries.pausedEntries).toContain('p1');
      expect(boundaries.hiddenCategories).toContain('romance');
    });
  });

  describe('Edge Cases', () => {
    it('should handle hiding the same item multiple times', async () => {
      await SoftBoundaries.pauseEntry('p1');
      await SoftBoundaries.pauseEntry('p1');
      await SoftBoundaries.pauseEntry('p1');

      const boundaries = await SoftBoundaries.getAll();
      // Should only appear once in the array
      expect(boundaries.pausedEntries.filter(id => id === 'p1')).toHaveLength(1);
    });

    it('should handle unhiding an item that was never hidden', async () => {
      await SoftBoundaries.unpauseEntry('p999');
      const boundaries = await SoftBoundaries.getAll();
      expect(boundaries.pausedEntries).toHaveLength(0);
    });

    it('should handle hiding a category with no prompts', async () => {
      await SoftBoundaries.hideCategory('nonexistent');
      const boundaries = await SoftBoundaries.getAll();
      expect(boundaries.hiddenCategories).toContain('nonexistent');

      const result = await contentAccessService.getAccessiblePrompts(MOCK_PROMPTS, {
        userId: 'user1',
        isPremium: true,
        userSettings: { boundaries },
        includeAll: true,
      });

      // Should still return all prompts since none match the hidden category
      expect(result.prompts).toHaveLength(6);
    });

    it('should handle storage errors gracefully', async () => {
      AsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));
      
      // Should return default empty boundaries
      const boundaries = await SoftBoundaries.getAll();
      expect(boundaries).toEqual({
        hideSpicy: false,
        pausedDates: [],
        pausedEntries: [],
        hiddenCategories: [],
        maxHeatOverride: null,
      });
    });
  });
});
