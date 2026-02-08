// utils/__tests__/personalizationEngine.test.js
import personalizationEngine from '../personalizationEngine';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('../userBehaviorAnalyzer');
jest.mock('../contentPerformanceAnalyzer');
jest.mock('../analytics');

describe('PersonalizationEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue(true);
    
    // Reset engine state
    personalizationEngine.isInitialized = false;
    personalizationEngine.memoryCache.clear();
  });

  describe('User Profile Management', () => {
    test('should initialize user profile with correct structure', async () => {
      const userId = 'test-user-123';
      const initialData = {
        goals: ['connection', 'intimacy'],
        anniversaryDate: '2023-01-01'
      };

      const profile = await personalizationEngine.initializeUser(userId, initialData);

      expect(profile).toMatchObject({
        userId,
        preferences: {
          contentCategories: ['connection', 'intimacy'],
          heatLevels: [1, 2, 3]
        },
        relationshipData: {
          startDate: '2023-01-01',
          stage: expect.any(String)
        },
        personalizationSettings: {
          enabled: true,
          adaptiveUI: true,
          smartNotifications: true,
          privacyLevel: 'high'
        }
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining(userId),
        expect.any(String)
      );
    });

    test('should calculate relationship stage correctly', () => {
      const now = Date.now();
      const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
      const oneYearAgo = new Date(now - 365 * 24 * 60 * 60 * 1000);
      const threeYearsAgo = new Date(now - 3 * 365 * 24 * 60 * 60 * 1000);

      expect(personalizationEngine.calculateRelationshipStage(thirtyDaysAgo)).toBe('new');
      expect(personalizationEngine.calculateRelationshipStage(oneYearAgo)).toBe('established');
      expect(personalizationEngine.calculateRelationshipStage(threeYearsAgo)).toBe('mature');
    });

    test('should update user profile correctly', async () => {
      const userId = 'test-user-123';
      const existingProfile = {
        userId,
        preferences: { contentCategories: ['connection'] },
        lastUpdated: Date.now() - 1000
      };

      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(existingProfile));

      const updates = {
        preferences: { contentCategories: ['connection', 'fun'] }
      };

      const updatedProfile = await personalizationEngine.updateUserProfile(userId, updates);

      expect(updatedProfile.preferences.contentCategories).toEqual(['connection', 'fun']);
      expect(updatedProfile.lastUpdated).toBeGreaterThan(existingProfile.lastUpdated);
    });
  });

  describe('Context Analysis', () => {
    test('should analyze context correctly', () => {
      const context = {
        recentActivity: 'prompt_completion',
        mood: 'romantic',
        isFirstSessionToday: true
      };

      const userProfile = {
        relationshipData: { stage: 'established' }
      };

      const analyzedContext = personalizationEngine.analyzeContext(context, userProfile);

      expect(analyzedContext).toMatchObject({
        timeOfDay: expect.any(String),
        dayOfWeek: expect.any(String),
        season: expect.any(String),
        isWeekend: expect.any(Boolean),
        recentActivity: 'prompt_completion',
        mood: 'romantic',
        userSegment: expect.any(String),
        sessionContext: {
          isFirstSessionToday: true,
          timeSinceLastSession: 0,
          sessionNumber: 1
        }
      });
    });

    test('should determine time of day correctly', () => {
      expect(personalizationEngine.getTimeOfDay(new Date('2023-01-01T08:00:00'))).toBe('morning');
      expect(personalizationEngine.getTimeOfDay(new Date('2023-01-01T14:00:00'))).toBe('afternoon');
      expect(personalizationEngine.getTimeOfDay(new Date('2023-01-01T19:00:00'))).toBe('evening');
      expect(personalizationEngine.getTimeOfDay(new Date('2023-01-01T23:00:00'))).toBe('night');
    });

    test('should determine weekend correctly', () => {
      expect(personalizationEngine.isWeekend(new Date('2023-01-07T12:00:00'))).toBe(true); // Saturday
      expect(personalizationEngine.isWeekend(new Date('2023-01-08T12:00:00'))).toBe(true); // Sunday
      expect(personalizationEngine.isWeekend(new Date('2023-01-09T12:00:00'))).toBe(false); // Monday
    });
  });
  describe('Recommendation Generation', () => {
    test('should generate personalized experience', async () => {
      const userId = 'test-user-123';
      const userProfile = {
        userId,
        preferences: { contentCategories: ['connection'], heatLevels: [1, 2] },
        behaviorMetrics: { sessionCount: 10, totalEngagementTime: 3600 },
        relationshipData: { stage: 'established' }
      };

      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(userProfile));

      const context = { timeOfDay: 'evening', mood: 'romantic' };
      const experience = await personalizationEngine.generatePersonalizedExperience(userId, context);

      expect(experience).toMatchObject({
        userId,
        timestamp: expect.any(Number),
        context: expect.any(Object),
        recommendations: expect.any(Array),
        layout: expect.any(Object),
        notifications: expect.any(Array),
        insights: expect.any(Array),
        metadata: {
          generationTime: expect.any(Number),
          cacheHits: expect.any(Object),
          personalizationScore: expect.any(Number)
        }
      });
    });

    test('should return default experience for new users', async () => {
      const userId = 'new-user-123';
      AsyncStorage.getItem.mockResolvedValue(null);

      const context = { timeOfDay: 'morning' };
      const experience = await personalizationEngine.generatePersonalizedExperience(userId, context);

      expect(experience).toMatchObject({
        userId: null,
        recommendations: expect.any(Array),
        layout: expect.any(Object),
        metadata: {
          personalizationScore: 0
        }
      });
    });

    test('should calculate recommendation score correctly', () => {
      const content = {
        category: 'connection',
        heatLevel: 2,
        metadata: { timeOfDay: ['evening'] }
      };

      const userProfile = {
        preferences: { contentCategories: ['connection'], heatLevels: [1, 2, 3] },
        behaviorMetrics: { contentInteractions: {} },
        relationshipData: { stage: 'established' }
      };

      const behaviorPatterns = {
        sessions: { totalSessions: 10 },
        engagement: { engagementScore: 75 }
      };

      const contextualFactors = { timeOfDay: 'evening' };

      const score = personalizationEngine.calculateRecommendationScore(
        content,
        userProfile,
        behaviorPatterns,
        contextualFactors
      );

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('Cache Management', () => {
    test('should generate consistent cache keys', () => {
      const key1 = personalizationEngine.generateCacheKey('test', 'user1', { mood: 'happy' });
      const key2 = personalizationEngine.generateCacheKey('test', 'user1', { mood: 'happy' });
      const key3 = personalizationEngine.generateCacheKey('test', 'user1', { mood: 'sad' });

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    });

    test('should cache and retrieve data correctly', () => {
      const key = 'test-key';
      const data = { test: 'data' };
      const ttl = 1000;

      personalizationEngine.setCache(key, data, ttl);
      const retrieved = personalizationEngine.getFromCache(key);

      expect(retrieved).toEqual(data);
    });

    test('should expire cached data', (done) => {
      const key = 'test-key';
      const data = { test: 'data' };
      const ttl = 10; // 10ms

      personalizationEngine.setCache(key, data, ttl);

      setTimeout(() => {
        const retrieved = personalizationEngine.getFromCache(key);
        expect(retrieved).toBeNull();
        done();
      }, 20);
    });

    test('should clear expired cache entries', async () => {
      const key1 = 'expired-key';
      const key2 = 'valid-key';
      
      personalizationEngine.setCache(key1, { data: 'expired' }, 1); // 1ms TTL
      personalizationEngine.setCache(key2, { data: 'valid' }, 10000); // 10s TTL

      // Wait for first cache to expire
      await new Promise(resolve => setTimeout(resolve, 5));
      
      await personalizationEngine.clearExpiredCache();

      expect(personalizationEngine.getFromCache(key1)).toBeNull();
      expect(personalizationEngine.getFromCache(key2)).toEqual({ data: 'valid' });
    });
  });

  describe('Utility Functions', () => {
    test('should normalize values correctly', () => {
      expect(personalizationEngine.normalizeValue(5, 0, 10)).toBe(0.5);
      expect(personalizationEngine.normalizeValue(0, 0, 10)).toBe(0);
      expect(personalizationEngine.normalizeValue(10, 0, 10)).toBe(1);
      expect(personalizationEngine.normalizeValue(-5, 0, 10)).toBe(0);
      expect(personalizationEngine.normalizeValue(15, 0, 10)).toBe(1);
    });

    test('should hash objects consistently', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 2 };
      const obj3 = { a: 1, b: 3 };

      const hash1 = personalizationEngine.hashObject(obj1);
      const hash2 = personalizationEngine.hashObject(obj2);
      const hash3 = personalizationEngine.hashObject(obj3);

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
    });

    test('should get season correctly', () => {
      expect(personalizationEngine.getSeason(new Date('2023-03-15'))).toBe('spring');
      expect(personalizationEngine.getSeason(new Date('2023-06-15'))).toBe('summer');
      expect(personalizationEngine.getSeason(new Date('2023-09-15'))).toBe('fall');
      expect(personalizationEngine.getSeason(new Date('2023-12-15'))).toBe('winter');
    });
  });

  describe('Error Handling', () => {
    test('should handle AsyncStorage errors gracefully', async () => {
      const userId = 'test-user-123';
      AsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      const profile = await personalizationEngine.getUserProfile(userId);
      expect(profile).toBeNull();
    });

    test('should return fallback experience on error', async () => {
      const userId = 'test-user-123';
      AsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      const context = { timeOfDay: 'morning' };
      const experience = await personalizationEngine.generatePersonalizedExperience(userId, context);

      expect(experience.metadata.fallback).toBe(true);
      expect(experience.recommendations).toBeDefined();
    });
  });

  describe('Data Cleanup', () => {
    test('should clear user data completely', async () => {
      const userId = 'test-user-123';
      
      // Set up some cached data
      personalizationEngine.memoryCache.set(`profile_${userId}`, { data: 'test' });
      personalizationEngine.memoryCache.set(`behavior_${userId}`, { data: 'test' });
      
      AsyncStorage.getAllKeys.mockResolvedValue([
        `personalization_profile_${userId}`,
        `behavior_patterns_${userId}`,
        'other_key'
      ]);

      const result = await personalizationEngine.clearUserData(userId);

      expect(result).toBe(true);
      expect(personalizationEngine.memoryCache.has(`profile_${userId}`)).toBe(false);
      expect(personalizationEngine.memoryCache.has(`behavior_${userId}`)).toBe(false);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`personalization_profile_${userId}`);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`behavior_patterns_${userId}`);
    });
  });
});
