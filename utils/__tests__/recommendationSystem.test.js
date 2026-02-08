// utils/__tests__/recommendationSystem.test.js
import recommendationSystem from '../recommendationSystem';
import personalizationEngine from '../personalizationEngine';
import mlModelManager from '../mlModelManager';
import privacyEngine from '../privacyEngine';

// Mock dependencies
jest.mock('../personalizationEngine');
jest.mock('../mlModelManager');
jest.mock('../privacyEngine');
jest.mock('../contentPerformanceAnalyzer');
jest.mock('../analytics');

const originalFindSimilarUsers = recommendationSystem.findSimilarUsers.bind(recommendationSystem);

describe('RecommendationSystem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset system state
    recommendationSystem.isInitialized = false;
    recommendationSystem.contentFeatures.clear();
    recommendationSystem.userSimilarities.clear();
    recommendationSystem.findSimilarUsers = originalFindSimilarUsers;
    
    // Mock successful initialization
    mlModelManager.initialize.mockResolvedValue(true);
    
    // Mock user profile
    personalizationEngine.getUserProfile.mockResolvedValue({
      userId: 'test-user-123',
      preferences: {
        contentCategories: ['connection', 'fun'],
        heatLevels: [1, 2, 3],
        moods: ['romantic', 'playful']
      },
      behaviorMetrics: {
        sessionCount: 25,
        totalEngagementTime: 7200,
        contentInteractions: {
          'content_1': { rating: 4, category: 'connection' },
          'content_2': { rating: 5, category: 'fun' }
        }
      },
      relationshipData: { stage: 'established' }
    });

    // Mock privacy processing
    privacyEngine.processUserData.mockResolvedValue({
      localInsights: { type: 'recommendation' },
      encryptedData: { encrypted: 'data' },
      anonymizedMetrics: { featureCount: 5 }
    });

    // Mock ML predictions
    mlModelManager.predict.mockResolvedValue({
      prediction: 0.8,
      confidence: 0.7,
      modelVersion: '1.0.0'
    });
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const result = await recommendationSystem.initialize();

      expect(result).toBe(true);
      expect(recommendationSystem.isInitialized).toBe(true);
      expect(mlModelManager.initialize).toHaveBeenCalled();
    });

    test('should not reinitialize if already initialized', async () => {
      recommendationSystem.isInitialized = true;
      
      const result = await recommendationSystem.initialize();
      
      expect(result).toBe(true);
      expect(mlModelManager.initialize).not.toHaveBeenCalled();
    });

    test('should handle initialization errors', async () => {
      mlModelManager.initialize.mockRejectedValue(new Error('Init failed'));
      
      const result = await recommendationSystem.initialize();
      
      expect(result).toBe(false);
      expect(recommendationSystem.isInitialized).toBe(false);
    });
  });

  describe('Recommendation Generation', () => {
    beforeEach(async () => {
      await recommendationSystem.initialize();
    });

    test('should generate recommendations successfully', async () => {
      const userId = 'test-user-123';
      const context = { timeOfDay: 'evening', mood: 'romantic' };

      const result = await recommendationSystem.generateRecommendations(userId, context);

      expect(result).toMatchObject({
        recommendations: expect.any(Array),
        metadata: {
          generationTime: expect.any(Number),
          algorithmsUsed: expect.any(Array),
          totalCandidates: expect.any(Number),
          privacyPreserved: true
        }
      });

      expect(personalizationEngine.getUserProfile).toHaveBeenCalledWith(userId);
      expect(privacyEngine.processUserData).toHaveBeenCalled();
    });

    test('should return fallback recommendations for new users', async () => {
      personalizationEngine.getUserProfile.mockResolvedValue(null);
      
      const result = await recommendationSystem.generateRecommendations('new-user', {});

      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations[0]).toMatchObject({
        id: expect.any(String),
        title: expect.any(String),
        fallback: true
      });
    });

    test('should handle recommendation generation errors', async () => {
      personalizationEngine.getUserProfile.mockRejectedValue(new Error('Profile error'));
      
      const result = await recommendationSystem.generateRecommendations('test-user', {});

      expect(result.metadata.error).toBeDefined();
      expect(result.metadata.fallback).toBe(true);
      expect(result.recommendations).toBeDefined();
    });
  });

  describe('Content-Based Filtering', () => {
    beforeEach(async () => {
      await recommendationSystem.initialize();
    });

    test('should generate content-based recommendations', async () => {
      const userProfile = {
        preferences: { contentCategories: ['connection'], heatLevels: [1, 2] },
        behaviorMetrics: { contentInteractions: {} },
        relationshipData: { stage: 'established' }
      };

      const context = {};
      const options = { minRelevanceScore: 0.3 };

      const recommendations = await recommendationSystem.generateContentBasedRecommendations(
        userProfile, 
        context, 
        options
      );

      expect(recommendations).toBeInstanceOf(Array);
      recommendations.forEach(rec => {
        expect(rec).toMatchObject({
          id: expect.any(String),
          recommendationScore: expect.any(Number),
          algorithm: 'content_based',
          reasoning: expect.any(String)
        });
        expect(rec.recommendationScore).toBeGreaterThanOrEqual(options.minRelevanceScore);
      });
    });

    test('should extract user preferences correctly', () => {
      const userProfile = {
        preferences: {
          contentCategories: ['connection', 'fun'],
          heatLevels: [1, 2, 3]
        },
        behaviorMetrics: {
          contentInteractions: {
            'content_1': { rating: 4, category: 'connection' },
            'content_2': { rating: 5, category: 'intimacy' }
          }
        },
        relationshipData: { stage: 'established' }
      };

      const preferences = recommendationSystem.extractUserPreferences(userProfile);

      expect(preferences).toMatchObject({
        categories: {
          connection: expect.any(Number),
          fun: expect.any(Number)
        },
        heatLevels: {
          1: 1.0,
          2: 1.0,
          3: 1.0
        },
        relationshipStage: 'established'
      });
    });

    test('should calculate content similarity correctly', () => {
      const userPreferences = {
        categories: { connection: 1.0, fun: 0.5 },
        heatLevels: { 1: 1.0, 2: 1.0 },
        relationshipStage: 'established'
      };

      const contentFeatures = {
        category: 'connection',
        heatLevel: 2,
        relationshipStages: ['established', 'mature'],
        popularity: 0.8,
        successRate: 0.9
      };

      const similarity = recommendationSystem.calculateContentSimilarity(
        userPreferences, 
        contentFeatures
      );

      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
      expect(similarity).toBeGreaterThan(0.5); // Should be high due to good matches
    });
  });

  describe('Collaborative Filtering', () => {
    beforeEach(async () => {
      await recommendationSystem.initialize();
    });

    test('should generate collaborative recommendations', async () => {
      const userId = 'test-user-123';
      const userProfile = {
        preferences: { contentCategories: ['connection'] },
        relationshipData: { stage: 'established' }
      };

      // Mock similar users
      recommendationSystem.findSimilarUsers = jest.fn().mockResolvedValue([
        {
          similarity: 0.8,
          preferences: { 'content_1': 0.9, 'content_2': 0.7 },
          anonymizedId: 'pattern_1'
        }
      ]);

      const recommendations = await recommendationSystem.generateCollaborativeRecommendations(
        userId, 
        userProfile, 
        {}, 
        { minRelevanceScore: 0.3 }
      );

      expect(recommendations).toBeInstanceOf(Array);
      recommendations.forEach(rec => {
        expect(rec).toMatchObject({
          algorithm: 'collaborative',
          recommendationScore: expect.any(Number),
          similarUserCount: expect.any(Number)
        });
      });
    });

    test('should return empty array when no similar users found', async () => {
      recommendationSystem.findSimilarUsers = jest.fn().mockResolvedValue([]);

      const recommendations = await recommendationSystem.generateCollaborativeRecommendations(
        'test-user', 
        {}, 
        {}, 
        {}
      );

      expect(recommendations).toEqual([]);
    });
  });
  describe('Hybrid Recommendations', () => {
    beforeEach(async () => {
      await recommendationSystem.initialize();
    });

    test('should generate hybrid ML-powered recommendations', async () => {
      const userId = 'test-user-123';
      const userProfile = {
        behaviorMetrics: { sessionCount: 20, totalEngagementTime: 3600 },
        preferences: { contentCategories: ['connection'] },
        relationshipData: { stage: 'established' }
      };

      const recommendations = await recommendationSystem.generateHybridRecommendations(
        userId, 
        userProfile, 
        { timeOfDay: 'evening' }, 
        { minRelevanceScore: 0.3 }
      );

      expect(recommendations).toBeInstanceOf(Array);
      recommendations.forEach(rec => {
        expect(rec).toMatchObject({
          algorithm: 'hybrid_ml',
          recommendationScore: expect.any(Number),
          confidence: expect.any(Number),
          modelVersion: expect.any(String)
        });
      });

      expect(mlModelManager.predict).toHaveBeenCalled();
    });

    test('should return empty array when ML model fails', async () => {
      mlModelManager.predict.mockResolvedValue({ error: 'Model failed' });

      const recommendations = await recommendationSystem.generateHybridRecommendations(
        'test-user', 
        {}, 
        {}, 
        {}
      );

      expect(recommendations).toEqual([]);
    });
  });

  describe('Recommendation Combination and Filtering', () => {
    test('should combine recommendations from multiple algorithms', () => {
      const algorithmResults = [
        {
          recommendations: [
            { id: 'content_1', recommendationScore: 0.8, algorithm: 'content_based' },
            { id: 'content_2', recommendationScore: 0.6, algorithm: 'content_based' }
          ],
          weight: 0.4
        },
        {
          recommendations: [
            { id: 'content_1', recommendationScore: 0.7, algorithm: 'collaborative' },
            { id: 'content_3', recommendationScore: 0.9, algorithm: 'collaborative' }
          ],
          weight: 0.3
        }
      ];

      const combined = recommendationSystem.combineRecommendations(algorithmResults);

      expect(combined).toBeInstanceOf(Array);
      expect(combined.length).toBe(3); // content_1, content_2, content_3

      // content_1 should have combined score from both algorithms
      const content1 = combined.find(rec => rec.id === 'content_1');
      expect(content1.algorithmCount).toBe(2);
      expect(content1.algorithms).toContain('content_based');
      expect(content1.algorithms).toContain('collaborative');
    });

    test('should apply contextual adjustments', () => {
      const recommendations = [
        {
          id: 'content_1',
          recommendationScore: 0.6,
          metadata: { timeOfDay: ['evening'], moods: ['romantic'] }
        },
        {
          id: 'content_2',
          recommendationScore: 0.5,
          metadata: { weekendFriendly: true }
        }
      ];

      const context = {
        timeOfDay: 'evening',
        mood: 'romantic',
        isWeekend: true
      };

      const adjusted = recommendationSystem.applyContextualAdjustments(
        recommendations, 
        context, 
        0.2
      );

      expect(adjusted[0].recommendationScore).toBeGreaterThan(0.6); // Should get boosts
      expect(adjusted[1].recommendationScore).toBeGreaterThan(0.5); // Should get weekend boost
      expect(adjusted[0].contextualBoost).toBeGreaterThan(0);
    });

    test('should apply diversity filtering', () => {
      const recommendations = [
        { id: 'content_1', category: 'connection', heatLevel: 1, recommendationScore: 0.9 },
        { id: 'content_2', category: 'connection', heatLevel: 1, recommendationScore: 0.8 },
        { id: 'content_3', category: 'fun', heatLevel: 2, recommendationScore: 0.7 },
        { id: 'content_4', category: 'intimacy', heatLevel: 3, recommendationScore: 0.6 }
      ];

      const diverse = recommendationSystem.applyDiversityFiltering(recommendations, 0.7);

      expect(diverse).toBeInstanceOf(Array);
      
      // Should maintain diversity across categories and heat levels
      const categories = new Set(diverse.map(rec => rec.category));
      const heatLevels = new Set(diverse.map(rec => rec.heatLevel));
      
      expect(categories.size).toBeGreaterThan(1);
      expect(heatLevels.size).toBeGreaterThan(1);
    });
  });

  describe('Scoring Utilities', () => {
    test('should calculate behavior score correctly', () => {
      const userProfile = {
        behaviorMetrics: {
          sessionCount: 50,
          totalEngagementTime: 10000,
          contentInteractions: {
            'content_1': {},
            'content_2': {},
            'content_3': {}
          }
        }
      };

      const score = recommendationSystem.calculateBehaviorScore(userProfile);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    test('should calculate content affinity correctly', () => {
      const userProfile = {
        preferences: {
          contentCategories: ['connection', 'fun', 'intimacy'],
          heatLevels: [1, 2, 3, 4]
        }
      };

      const score = recommendationSystem.calculateContentAffinity(userProfile);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    test('should calculate contextual factors correctly', () => {
      const context = {
        timeOfDay: 'evening',
        mood: 'romantic',
        isWeekend: true,
        season: 'spring',
        recentActivity: 'prompt_completion'
      };

      const score = recommendationSystem.calculateContextualFactors(context);

      expect(score).toBeGreaterThan(0.5); // Should be boosted by multiple factors
      expect(score).toBeLessThanOrEqual(1);
    });

    test('should calculate relationship stage score correctly', () => {
      const stages = ['new', 'developing', 'established', 'mature', 'long_term'];
      
      stages.forEach(stage => {
        const userProfile = { relationshipData: { stage } };
        const score = recommendationSystem.calculateRelationshipStage(userProfile);
        
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });

      // Later stages should have higher scores
      const newStageScore = recommendationSystem.calculateRelationshipStage(
        { relationshipData: { stage: 'new' } }
      );
      const matureStageScore = recommendationSystem.calculateRelationshipStage(
        { relationshipData: { stage: 'mature' } }
      );
      
      expect(matureStageScore).toBeGreaterThan(newStageScore);
    });
  });

  describe('Content Feature Extraction', () => {
    test('should extract content features correctly', async () => {
      const content = {
        id: 'test_content',
        category: 'connection',
        heatLevel: 2,
        estimatedDuration: 20,
        complexity: 'medium',
        relationshipDuration: ['established', 'mature'],
        tags: ['communication', 'sharing'],
        createdAt: Date.now() - (10 * 24 * 60 * 60 * 1000) // 10 days ago
      };

      // Mock content metrics
      recommendationSystem.getContentPopularity = jest.fn().mockResolvedValue(0.7);
      recommendationSystem.getContentSuccessRate = jest.fn().mockResolvedValue(0.8);

      const features = await recommendationSystem.extractContentFeatures(content);

      expect(features).toMatchObject({
        category: 'connection',
        heatLevel: 2,
        duration: 20,
        complexity: 'medium',
        relationshipStages: ['established', 'mature'],
        tags: ['communication', 'sharing'],
        popularity: 0.7,
        freshness: expect.any(Number),
        successRate: 0.8
      });

      expect(features.freshness).toBeGreaterThanOrEqual(0);
      expect(features.freshness).toBeLessThanOrEqual(1);
    });

    test('should cache content features', async () => {
      const content = { id: 'test_content', category: 'connection' };
      
      recommendationSystem.getContentPopularity = jest.fn().mockResolvedValue(0.5);
      recommendationSystem.getContentSuccessRate = jest.fn().mockResolvedValue(0.6);

      // First call should extract features
      const features1 = await recommendationSystem.extractContentFeatures(content);
      
      // Second call should use cache
      const features2 = await recommendationSystem.extractContentFeatures(content);

      expect(features1).toEqual(features2);
      expect(recommendationSystem.getContentPopularity).toHaveBeenCalledTimes(1);
      expect(recommendationSystem.getContentSuccessRate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Privacy-Preserving Similarity', () => {
    test('should find similar users with privacy preservation', async () => {
      const userId = 'test-user-123';
      const userProfile = {
        behaviorMetrics: { sessionCount: 25 },
        preferences: { contentCategories: ['connection'] },
        relationshipData: { stage: 'established' }
      };

      // Mock similarity patterns
      recommendationSystem.getSimilarityPatterns = jest.fn().mockResolvedValue([
        {
          patternId: 'pattern_1',
          similarity: 0.8,
          aggregatedPreferences: { 'content_1': 0.9 }
        },
        {
          patternId: 'pattern_2',
          similarity: 0.5, // Below threshold
          aggregatedPreferences: { 'content_2': 0.7 }
        }
      ]);

      const similarUsers = await recommendationSystem.findSimilarUsers(userId, userProfile);

      expect(similarUsers).toBeInstanceOf(Array);
      expect(similarUsers.length).toBe(1); // Only pattern_1 meets threshold
      expect(similarUsers[0]).toMatchObject({
        similarity: 0.8,
        preferences: { 'content_1': 0.9 },
        anonymizedId: 'pattern_1'
      });
    });

    test('should extract anonymized user features', () => {
      const userProfile = {
        relationshipData: { stage: 'established' },
        behaviorMetrics: { sessionCount: 30, totalEngagementTime: 5000 },
        preferences: { contentCategories: ['connection', 'fun', 'intimacy'] }
      };

      const features = recommendationSystem.extractAnonymizedUserFeatures(userProfile);

      expect(features).toMatchObject({
        relationshipStage: 'established',
        engagementLevel: expect.any(String),
        contentPreferences: expect.any(String),
        usagePattern: expect.any(String)
      });

      // Should not contain any personally identifiable information
      expect(features).not.toHaveProperty('userId');
      expect(features).not.toHaveProperty('sessionCount');
      expect(features).not.toHaveProperty('totalEngagementTime');
    });
  });

  describe('Caching', () => {
    test('should cache recommendations correctly', async () => {
      const userId = 'test-user-123';
      const context = { timeOfDay: 'evening' };
      const recommendations = [{ id: 'content_1', score: 0.8 }];

      const result = await recommendationSystem.cacheRecommendations(
        userId, 
        context, 
        recommendations
      );

      expect(result).toBe(true);
      
      // Check that cache was set
      const cacheKey = `${recommendationSystem.RECOMMENDATION_CACHE_KEY}_${userId}_${recommendationSystem.hashContext(context)}`;
      expect(recommendationSystem.recommendationCache.has(cacheKey)).toBe(true);
    });

    test('should generate consistent context hashes', () => {
      const context1 = { timeOfDay: 'evening', mood: 'romantic' };
      const context2 = { timeOfDay: 'evening', mood: 'romantic' };
      const context3 = { timeOfDay: 'morning', mood: 'romantic' };

      const hash1 = recommendationSystem.hashContext(context1);
      const hash2 = recommendationSystem.hashContext(context2);
      const hash3 = recommendationSystem.hashContext(context3);

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
    });
  });

  describe('Fallback Mechanisms', () => {
    test('should provide fallback recommendations', () => {
      const context = { timeOfDay: 'evening' };
      const fallbacks = recommendationSystem.getFallbackRecommendations(context);

      expect(fallbacks).toBeInstanceOf(Array);
      expect(fallbacks.length).toBeGreaterThan(0);
      
      fallbacks.forEach(rec => {
        expect(rec).toMatchObject({
          id: expect.any(String),
          title: expect.any(String),
          algorithm: 'fallback',
          fallback: true
        });
      });
    });

    test('should categorize user attributes correctly', () => {
      expect(recommendationSystem.categorizeEngagementLevel({ sessionCount: 60 })).toBe('high');
      expect(recommendationSystem.categorizeEngagementLevel({ sessionCount: 30 })).toBe('medium');
      expect(recommendationSystem.categorizeEngagementLevel({ sessionCount: 10 })).toBe('low');

      expect(recommendationSystem.categorizeContentPreferences({ contentCategories: ['a', 'b', 'c', 'd', 'e', 'f'] })).toBe('diverse');
      expect(recommendationSystem.categorizeContentPreferences({ contentCategories: ['a', 'b', 'c'] })).toBe('moderate');
      expect(recommendationSystem.categorizeContentPreferences({ contentCategories: ['a'] })).toBe('focused');

      expect(recommendationSystem.categorizeUsagePattern({ totalEngagementTime: 6000, sessionCount: 10 })).toBe('deep');
      expect(recommendationSystem.categorizeUsagePattern({ totalEngagementTime: 2000, sessionCount: 10 })).toBe('moderate');
      expect(recommendationSystem.categorizeUsagePattern({ totalEngagementTime: 1000, sessionCount: 10 })).toBe('quick');
    });
  });

  describe('Error Handling', () => {
    test('should handle content feature extraction errors', async () => {
      const content = { id: 'test_content' };
      
      recommendationSystem.getContentPopularity = jest.fn().mockRejectedValue(new Error('Popularity error'));
      recommendationSystem.getContentSuccessRate = jest.fn().mockRejectedValue(new Error('Success rate error'));

      const features = await recommendationSystem.extractContentFeatures(content);

      // Should still return features with defaults
      expect(features).toBeDefined();
      expect(features.id).toBe('test_content');
    });

    test('should handle similarity finding errors', async () => {
      recommendationSystem.getSimilarityPatterns = jest.fn().mockRejectedValue(new Error('Similarity error'));

      const similarUsers = await recommendationSystem.findSimilarUsers('test-user', {});

      expect(similarUsers).toEqual([]);
    });
  });
});
