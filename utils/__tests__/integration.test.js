/**
 * Integration Tests for Smart Personalization System
 * 
 * These tests verify that all personalization components work together correctly.
 */

import personalizationEngine from '../personalizationEngine';
import mlModelManager from '../mlModelManager';
import recommendationSystem from '../recommendationSystem';
import contentCurator from '../contentCurator';
import achievementEngine from '../achievementEngine';
import challengeSystem from '../challengeSystem';

describe('Smart Personalization Integration', () => {
  const mockUserId = 'test-user-123';
  const mockUserProfile = {
    preferences: {
      partnerNames: {
        myName: 'Partner',
        partnerName: 'Partner'
      },
      relationshipDuration: 'established',
    },
    relationshipStartDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
  };

  beforeEach(async () => {
    // Clear any cached data
    await personalizationEngine.clearUserData(mockUserId);
  });

  describe('System Initialization', () => {
    it('should initialize personalization engine with user profile', async () => {
      await personalizationEngine.initializeUser(mockUserId, mockUserProfile);
      
      const profile = await personalizationEngine.getUserProfile(mockUserId);
      expect(profile).toBeDefined();
      expect(profile.userId).toBe(mockUserId);
    });

    it('should initialize ML models without errors', async () => {
      await expect(mlModelManager.initializeModels()).resolves.not.toThrow();
      
      const status = mlModelManager.getModelStatus();
      expect(status).toBeDefined();
      expect(Object.keys(status).length).toBeGreaterThan(0);
    });
  });

  describe('Recommendation System Integration', () => {
    const mockContent = [
      { id: '1', text: 'Prompt 1', category: 'emotional', heat: 1 },
      { id: '2', text: 'Prompt 2', category: 'physical', heat: 2 },
      { id: '3', text: 'Prompt 3', category: 'intellectual', heat: 1 },
    ];

    beforeEach(async () => {
      await personalizationEngine.initializeUser(mockUserId, mockUserProfile);
    });

    it('should generate recommendations for content', async () => {
      const recommendations = await recommendationSystem.getRecommendations(
        mockUserId,
        mockContent,
        { type: 'prompt', limit: 2 }
      );

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeLessThanOrEqual(2);
    });

    it('should provide fallback recommendations for new users', async () => {
      const newUserId = 'new-user-456';
      const recommendations = await recommendationSystem.getRecommendations(
        newUserId,
        mockContent,
        { type: 'prompt', limit: 2 }
      );

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Content Curation Integration', () => {
    const mockContent = Array.from({ length: 10 }, (_, i) => ({
      id: `prompt-${i}`,
      text: `Prompt ${i}`,
      category: ['emotional', 'physical', 'intellectual'][i % 3],
      heat: (i % 5) + 1,
    }));

    beforeEach(async () => {
      await personalizationEngine.initializeUser(mockUserId, mockUserProfile);
    });

    it('should generate curated content sequence', async () => {
      const sequence = await contentCurator.generateContentSequence(
        mockUserId,
        mockContent,
        { strategy: 'balanced', length: 7 }
      );

      expect(sequence).toBeDefined();
      expect(Array.isArray(sequence)).toBe(true);
      expect(sequence.length).toBeLessThanOrEqual(7);
    });

    it('should balance content diversity in sequence', async () => {
      const sequence = await contentCurator.generateContentSequence(
        mockUserId,
        mockContent,
        { strategy: 'balanced', length: 6 }
      );

      // Check that we have some variety in categories
      const categories = sequence.map(item => item.category);
      const uniqueCategories = new Set(categories);
      
      // Should have at least 2 different categories in a balanced sequence
      expect(uniqueCategories.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Gamification Integration', () => {
    beforeEach(async () => {
      await personalizationEngine.initializeUser(mockUserId, mockUserProfile);
    });

    it('should track and unlock achievements', async () => {
      // Simulate user activity
      await achievementEngine.trackActivity(mockUserId, 'prompt_answered', {
        promptId: 'test-prompt',
        category: 'emotional',
      });

      const achievements = await achievementEngine.getUserAchievements(mockUserId);
      expect(achievements).toBeDefined();
      expect(Array.isArray(achievements)).toBe(true);
    });

    it('should generate personalized challenges', async () => {
      const challenges = await challengeSystem.generateChallenges(mockUserId, {
        count: 3,
        difficulty: 'medium',
      });

      expect(challenges).toBeDefined();
      expect(Array.isArray(challenges)).toBe(true);
      expect(challenges.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Privacy and Performance', () => {
    it('should not expose sensitive user data in recommendations', async () => {
      await personalizationEngine.initializeUser(mockUserId, mockUserProfile);
      
      const mockContent = [
        { id: '1', text: 'Test prompt', category: 'emotional', heat: 1 },
      ];

      const recommendations = await recommendationSystem.getRecommendations(
        mockUserId,
        mockContent,
        { type: 'prompt', limit: 1 }
      );

      // Recommendations should not contain raw user profile data
      recommendations.forEach(rec => {
        expect(rec).not.toHaveProperty('userProfile');
        expect(rec).not.toHaveProperty('rawBehaviorData');
      });
    });

    it('should complete recommendation generation within performance budget', async () => {
      await personalizationEngine.initializeUser(mockUserId, mockUserProfile);
      
      const mockContent = Array.from({ length: 50 }, (_, i) => ({
        id: `prompt-${i}`,
        text: `Prompt ${i}`,
        category: 'emotional',
        heat: 1,
      }));

      const startTime = Date.now();
      await recommendationSystem.getRecommendations(
        mockUserId,
        mockContent,
        { type: 'prompt', limit: 5 }
      );
      const duration = Date.now() - startTime;

      // Should complete within 2 seconds
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle missing user profile gracefully', async () => {
      const mockContent = [
        { id: '1', text: 'Test prompt', category: 'emotional', heat: 1 },
      ];

      // Should not throw, should provide fallback recommendations
      await expect(
        recommendationSystem.getRecommendations(
          'non-existent-user',
          mockContent,
          { type: 'prompt', limit: 1 }
        )
      ).resolves.not.toThrow();
    });

    it('should handle empty content arrays gracefully', async () => {
      await personalizationEngine.initializeUser(mockUserId, mockUserProfile);

      const recommendations = await recommendationSystem.getRecommendations(
        mockUserId,
        [],
        { type: 'prompt', limit: 5 }
      );

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBe(0);
    });

    it('should handle invalid content gracefully', async () => {
      await personalizationEngine.initializeUser(mockUserId, mockUserProfile);

      const invalidContent = [
        { id: '1' }, // Missing required fields
        null,
        undefined,
        { id: '2', text: 'Valid prompt', category: 'emotional', heat: 1 },
      ];

      // Should filter out invalid content and process valid items
      await expect(
        recommendationSystem.getRecommendations(
          mockUserId,
          invalidContent,
          { type: 'prompt', limit: 5 }
        )
      ).resolves.not.toThrow();
    });
  });
});
