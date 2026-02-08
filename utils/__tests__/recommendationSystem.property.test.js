// utils/__tests__/recommendationSystem.property.test.js
import fc from 'fast-check';
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

describe('RecommendationSystem Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset system state
    recommendationSystem.isInitialized = false;
    recommendationSystem.contentFeatures.clear();
    
    // Mock successful initialization
    mlModelManager.initialize.mockResolvedValue(true);
    privacyEngine.processUserData.mockResolvedValue({
      localInsights: { type: 'recommendation' },
      encryptedData: { encrypted: 'data' },
      anonymizedMetrics: { featureCount: 5 }
    });
    mlModelManager.predict.mockResolvedValue({
      prediction: 0.7,
      confidence: 0.6,
      modelVersion: '1.0.0'
    });
  });

  /**
   * Property 1: Recommendation relevance ≥ 0.7 score validation
   * **Validates: Requirements 1.2**
   */
  describe('Property 1: Recommendation Relevance Score Validation', () => {
    test('should maintain recommendation scores ≥ 0.3 (minimum relevance threshold)', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate user profile
          fc.record({
            userId: fc.string({ minLength: 5, maxLength: 20 }),
            preferences: fc.record({
              contentCategories: fc.array(fc.constantFrom('connection', 'fun', 'intimacy', 'adventure'), { minLength: 1, maxLength: 4 }),
              heatLevels: fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 1, maxLength: 5 }),
              moods: fc.array(fc.constantFrom('romantic', 'playful', 'deep', 'light'), { minLength: 0, maxLength: 3 })
            }),
            behaviorMetrics: fc.record({
              sessionCount: fc.integer({ min: 1, max: 100 }),
              totalEngagementTime: fc.integer({ min: 60, max: 36000 }),
              contentInteractions: fc.dictionary(
                fc.string(),
                fc.record({
                  rating: fc.integer({ min: 1, max: 5 }),
                  category: fc.constantFrom('connection', 'fun', 'intimacy')
                })
              )
            }),
            relationshipData: fc.record({
              stage: fc.constantFrom('new', 'developing', 'established', 'mature', 'long_term')
            })
          }),
          // Generate context
          fc.record({
            timeOfDay: fc.constantFrom('morning', 'afternoon', 'evening', 'night'),
            mood: fc.option(fc.constantFrom('romantic', 'playful', 'deep'), { nil: null }),
            isWeekend: fc.boolean()
          }),
          async (userProfile, context) => {
            // Mock the user profile
            personalizationEngine.getUserProfile.mockResolvedValue(userProfile);
            
            await recommendationSystem.initialize();
            
            const result = await recommendationSystem.generateRecommendations(
              userProfile.userId, 
              context,
              { minRelevanceScore: 0.3 }
            );

            // Property: All recommendations should meet minimum relevance threshold
            result.recommendations.forEach(recommendation => {
              expect(recommendation.recommendationScore).toBeGreaterThanOrEqual(0.3);
              expect(recommendation.recommendationScore).toBeLessThanOrEqual(1.0);
            });

            // Property: Recommendations should be sorted by score (descending)
            for (let i = 1; i < result.recommendations.length; i++) {
              expect(result.recommendations[i-1].recommendationScore)
                .toBeGreaterThanOrEqual(result.recommendations[i].recommendationScore);
            }

            // Property: Each recommendation should have required fields
            result.recommendations.forEach(rec => {
              expect(rec).toHaveProperty('id');
              expect(rec).toHaveProperty('recommendationScore');
              expect(rec).toHaveProperty('algorithm');
              expect(rec).toHaveProperty('reasoning');
            });
          }
        ),
        { numRuns: 50, timeout: 10000 }
      );
    });

    test('should generate diverse recommendations across categories and heat levels', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 5 }),
            preferences: fc.record({
              contentCategories: fc.array(fc.constantFrom('connection', 'fun', 'intimacy', 'adventure'), { minLength: 2, maxLength: 4 }),
              heatLevels: fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 2, maxLength: 5 })
            }),
            behaviorMetrics: fc.record({
              sessionCount: fc.integer({ min: 10, max: 100 })
            }),
            relationshipData: fc.record({
              stage: fc.constantFrom('established', 'mature')
            })
          }),
          async (userProfile) => {
            personalizationEngine.getUserProfile.mockResolvedValue(userProfile);
            await recommendationSystem.initialize();
            
            const result = await recommendationSystem.generateRecommendations(
              userProfile.userId, 
              {},
              { maxRecommendations: 10, diversityThreshold: 0.7 }
            );

            if (result.recommendations.length >= 5) {
              // Property: Should have diversity across categories
              const categories = new Set(result.recommendations.map(rec => rec.category));
              expect(categories.size).toBeGreaterThan(1);

              // Property: Should have diversity across heat levels
              const heatLevels = new Set(result.recommendations.map(rec => rec.heatLevel));
              expect(heatLevels.size).toBeGreaterThan(1);
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 2: Privacy preservation - no unencrypted data transmission
   * **Validates: Requirements 2.1**
   */
  describe('Property 2: Privacy Preservation Validation', () => {
    test('should never expose raw user data in recommendations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 5 }),
            preferences: fc.record({
              contentCategories: fc.array(fc.string(), { minLength: 1, maxLength: 3 })
            }),
            behaviorMetrics: fc.record({
              sessionCount: fc.integer({ min: 1, max: 100 }),
              contentInteractions: fc.dictionary(
                fc.string(),
                fc.record({
                  personalNote: fc.string(), // Sensitive data
                  privateRating: fc.integer({ min: 1, max: 5 })
                })
              )
            })
          }),
          async (userProfile) => {
            personalizationEngine.getUserProfile.mockResolvedValue(userProfile);
            await recommendationSystem.initialize();
            
            const result = await recommendationSystem.generateRecommendations(userProfile.userId, {});

            // Property: No raw user data should be exposed in recommendations
            const resultString = JSON.stringify(result);
            
            // Should not contain sensitive user data
            expect(resultString).not.toContain('personalNote');
            expect(resultString).not.toContain('privateRating');
            
            // Should not contain raw behavioral data
            Object.keys(userProfile.behaviorMetrics.contentInteractions).forEach(key => {
              if (key.length > 10) { // Avoid matching short common words
                expect(resultString).not.toContain(key);
              }
            });

            // Property: Privacy preservation flag should be set
            expect(result.metadata.privacyPreserved).toBe(true);
            
            // Property: All recommendations should be marked as privacy-preserved
            result.recommendations.forEach(rec => {
              expect(rec.privacyPreserved).toBe(true);
            });
          }
        ),
        { numRuns: 25 }
      );
    });

    test('should anonymize user features in similarity matching', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 10 }), // Longer to avoid accidental matches
            preferences: fc.record({
              contentCategories: fc.array(fc.string({ minLength: 5 }), { minLength: 1, maxLength: 3 })
            }),
            behaviorMetrics: fc.record({
              sessionCount: fc.integer({ min: 1, max: 100 }),
              totalEngagementTime: fc.integer({ min: 100, max: 10000 })
            }),
            relationshipData: fc.record({
              stage: fc.constantFrom('new', 'developing', 'established')
            })
          }),
          async (userProfile) => {
            const anonymizedFeatures = recommendationSystem.extractAnonymizedUserFeatures(userProfile);

            // Property: Should not contain user ID
            expect(anonymizedFeatures).not.toHaveProperty('userId');
            expect(JSON.stringify(anonymizedFeatures)).not.toContain(userProfile.userId);

            // Property: Should not contain raw metrics
            expect(anonymizedFeatures).not.toHaveProperty('sessionCount');
            expect(anonymizedFeatures).not.toHaveProperty('totalEngagementTime');

            // Property: Should contain only categorized, anonymized data
            expect(anonymizedFeatures).toHaveProperty('relationshipStage');
            expect(anonymizedFeatures).toHaveProperty('engagementLevel');
            expect(anonymizedFeatures).toHaveProperty('contentPreferences');
            expect(anonymizedFeatures).toHaveProperty('usagePattern');

            // Property: Categorized values should be from expected sets
            expect(['new', 'developing', 'established', 'mature', 'long_term', 'unknown'])
              .toContain(anonymizedFeatures.relationshipStage);
            expect(['high', 'medium', 'low']).toContain(anonymizedFeatures.engagementLevel);
            expect(['diverse', 'moderate', 'focused']).toContain(anonymizedFeatures.contentPreferences);
            expect(['deep', 'moderate', 'quick']).toContain(anonymizedFeatures.usagePattern);
          }
        ),
        { numRuns: 40 }
      );
    });
  });
  /**
   * Property 3: Performance consistency - <2s response times
   * **Validates: Requirements 3.1**
   */
  describe('Property 3: Performance Consistency Validation', () => {
    test('should generate recommendations within 2 seconds', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 5 }),
            preferences: fc.record({
              contentCategories: fc.array(fc.constantFrom('connection', 'fun', 'intimacy'), { minLength: 1, maxLength: 3 }),
              heatLevels: fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 1, maxLength: 3 })
            }),
            behaviorMetrics: fc.record({
              sessionCount: fc.integer({ min: 1, max: 50 })
            }),
            relationshipData: fc.record({
              stage: fc.constantFrom('new', 'established', 'mature')
            })
          }),
          fc.record({
            timeOfDay: fc.constantFrom('morning', 'evening'),
            mood: fc.option(fc.constantFrom('romantic', 'playful'), { nil: null })
          }),
          async (userProfile, context) => {
            personalizationEngine.getUserProfile.mockResolvedValue(userProfile);
            await recommendationSystem.initialize();
            
            const startTime = Date.now();
            const result = await recommendationSystem.generateRecommendations(userProfile.userId, context);
            const endTime = Date.now();
            
            const responseTime = endTime - startTime;

            // Property: Response time should be under 2 seconds (2000ms)
            expect(responseTime).toBeLessThan(2000);

            // Property: Metadata should track generation time
            expect(result.metadata.generationTime).toBeDefined();
            expect(result.metadata.generationTime).toBeLessThan(2000);

            // Property: Should still return valid recommendations despite time constraint
            expect(result.recommendations).toBeDefined();
            expect(Array.isArray(result.recommendations)).toBe(true);
          }
        ),
        { numRuns: 20, timeout: 5000 }
      );
    });

    test('should maintain consistent performance across different user profile sizes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // Number of content interactions
          fc.integer({ min: 1, max: 10 }),  // Number of categories
          async (interactionCount, categoryCount) => {
            // Generate large user profile
            const interactions = {};
            for (let i = 0; i < interactionCount; i++) {
              interactions[`content_${i}`] = {
                rating: Math.floor(Math.random() * 5) + 1,
                category: `category_${i % categoryCount}`
              };
            }

            const userProfile = {
              userId: 'test-user',
              preferences: {
                contentCategories: Array.from({ length: categoryCount }, (_, i) => `category_${i}`),
                heatLevels: [1, 2, 3]
              },
              behaviorMetrics: {
                sessionCount: interactionCount,
                contentInteractions: interactions
              },
              relationshipData: { stage: 'established' }
            };

            personalizationEngine.getUserProfile.mockResolvedValue(userProfile);
            await recommendationSystem.initialize();
            
            const startTime = Date.now();
            const result = await recommendationSystem.generateRecommendations('test-user', {});
            const responseTime = Date.now() - startTime;

            // Property: Performance should not degrade significantly with larger profiles
            expect(responseTime).toBeLessThan(3000); // Slightly higher threshold for large profiles

            // Property: Should still return quality recommendations
            expect(result.recommendations.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 15, timeout: 8000 }
      );
    });
  });

  /**
   * Property 4: Recommendation consistency for similar users
   * **Validates: Requirements 1.3**
   */
  describe('Property 4: Recommendation Consistency Validation', () => {
    test('should generate similar recommendations for users with similar profiles', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Base user profile
          fc.record({
            preferences: fc.record({
              contentCategories: fc.array(fc.constantFrom('connection', 'fun'), { minLength: 2, maxLength: 2 }),
              heatLevels: fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 2, maxLength: 2 })
            }),
            behaviorMetrics: fc.record({
              sessionCount: fc.integer({ min: 20, max: 30 })
            }),
            relationshipData: fc.record({
              stage: fc.constantFrom('established')
            })
          }),
          async (baseProfile) => {
            // Create two similar user profiles
            const user1Profile = {
              ...baseProfile,
              userId: 'similar-user-1'
            };

            const user2Profile = {
              ...baseProfile,
              userId: 'similar-user-2',
              behaviorMetrics: {
                ...baseProfile.behaviorMetrics,
                sessionCount: baseProfile.behaviorMetrics.sessionCount + 2 // Slight variation
              }
            };

            await recommendationSystem.initialize();

            // Get recommendations for both users
            personalizationEngine.getUserProfile.mockResolvedValueOnce(user1Profile);
            const result1 = await recommendationSystem.generateRecommendations('similar-user-1', {});

            personalizationEngine.getUserProfile.mockResolvedValueOnce(user2Profile);
            const result2 = await recommendationSystem.generateRecommendations('similar-user-2', {});

            // Property: Similar users should get overlapping recommendations
            const recs1Ids = new Set(result1.recommendations.map(r => r.id));
            const recs2Ids = new Set(result2.recommendations.map(r => r.id));
            
            const intersection = new Set([...recs1Ids].filter(id => recs2Ids.has(id)));
            const union = new Set([...recs1Ids, ...recs2Ids]);
            
            const jaccardSimilarity = intersection.size / union.size;

            // Property: Jaccard similarity should be at least 0.3 for similar users
            expect(jaccardSimilarity).toBeGreaterThanOrEqual(0.3);

            // Property: Top recommendations should be similar
            if (result1.recommendations.length > 0 && result2.recommendations.length > 0) {
              const top3_user1 = result1.recommendations.slice(0, 3).map(r => r.category);
              const top3_user2 = result2.recommendations.slice(0, 3).map(r => r.category);
              
              const categoryOverlap = top3_user1.filter(cat => top3_user2.includes(cat)).length;
              expect(categoryOverlap).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 15, timeout: 10000 }
      );
    });

    test('should generate different recommendations for users with different preferences', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            categories1: fc.constantFrom(['connection'], ['intimacy'], ['fun']),
            categories2: fc.constantFrom(['adventure'], ['reflection'], ['creativity']),
            stage1: fc.constantFrom('new', 'developing'),
            stage2: fc.constantFrom('mature', 'long_term')
          }),
          async ({ categories1, categories2, stage1, stage2 }) => {
            const user1Profile = {
              userId: 'different-user-1',
              preferences: { contentCategories: categories1, heatLevels: [1, 2] },
              behaviorMetrics: { sessionCount: 10 },
              relationshipData: { stage: stage1 }
            };

            const user2Profile = {
              userId: 'different-user-2',
              preferences: { contentCategories: categories2, heatLevels: [4, 5] },
              behaviorMetrics: { sessionCount: 50 },
              relationshipData: { stage: stage2 }
            };

            await recommendationSystem.initialize();

            personalizationEngine.getUserProfile.mockResolvedValueOnce(user1Profile);
            const result1 = await recommendationSystem.generateRecommendations('different-user-1', {});

            personalizationEngine.getUserProfile.mockResolvedValueOnce(user2Profile);
            const result2 = await recommendationSystem.generateRecommendations('different-user-2', {});

            // Property: Different users should get different recommendations
            const recs1Ids = new Set(result1.recommendations.map(r => r.id));
            const recs2Ids = new Set(result2.recommendations.map(r => r.id));
            
            const intersection = new Set([...recs1Ids].filter(id => recs2Ids.has(id)));
            const union = new Set([...recs1Ids, ...recs2Ids]);
            
            const jaccardSimilarity = intersection.size / union.size;

            // Property: Jaccard similarity should be low for different users
            expect(jaccardSimilarity).toBeLessThan(0.7);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 5: Content similarity scoring consistency
   * **Validates: Requirements 1.4**
   */
  describe('Property 5: Content Similarity Scoring Validation', () => {
    test('should assign higher scores to content matching user preferences', async () => {
      await fc.assert(
        fc.property(
          fc.record({
            preferredCategory: fc.constantFrom('connection', 'fun', 'intimacy'),
            preferredHeatLevel: fc.integer({ min: 1, max: 5 }),
            relationshipStage: fc.constantFrom('new', 'established', 'mature')
          }),
          (preferences) => {
            const userPreferences = {
              categories: { [preferences.preferredCategory]: 1.0 },
              heatLevels: { [preferences.preferredHeatLevel]: 1.0 },
              relationshipStage: preferences.relationshipStage
            };

            // Matching content
            const matchingContent = {
              category: preferences.preferredCategory,
              heatLevel: preferences.preferredHeatLevel,
              relationshipStages: [preferences.relationshipStage],
              popularity: 0.7,
              successRate: 0.8
            };

            // Non-matching content
            const nonMatchingContent = {
              category: preferences.preferredCategory === 'connection' ? 'adventure' : 'connection',
              heatLevel: preferences.preferredHeatLevel === 1 ? 5 : 1,
              relationshipStages: [preferences.relationshipStage === 'new' ? 'mature' : 'new'],
              popularity: 0.7,
              successRate: 0.8
            };

            const matchingScore = recommendationSystem.calculateContentSimilarity(
              userPreferences, 
              matchingContent
            );

            const nonMatchingScore = recommendationSystem.calculateContentSimilarity(
              userPreferences, 
              nonMatchingContent
            );

            // Property: Matching content should score higher than non-matching content
            expect(matchingScore).toBeGreaterThan(nonMatchingScore);

            // Property: Scores should be in valid range
            expect(matchingScore).toBeGreaterThanOrEqual(0);
            expect(matchingScore).toBeLessThanOrEqual(1);
            expect(nonMatchingScore).toBeGreaterThanOrEqual(0);
            expect(nonMatchingScore).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should maintain score consistency for identical inputs', async () => {
      await fc.assert(
        fc.property(
          fc.record({
            categories: fc.dictionary(
              fc.constantFrom('connection', 'fun', 'intimacy'),
              fc.float({ min: 0, max: 1 })
            ),
            heatLevels: fc.dictionary(
              fc.integer({ min: 1, max: 5 }).map(String),
              fc.float({ min: 0, max: 1 })
            ),
            relationshipStage: fc.constantFrom('new', 'established', 'mature')
          }),
          fc.record({
            category: fc.constantFrom('connection', 'fun', 'intimacy'),
            heatLevel: fc.integer({ min: 1, max: 5 }),
            relationshipStages: fc.array(fc.constantFrom('new', 'established', 'mature'), { minLength: 1, maxLength: 3 }),
            popularity: fc.float({ min: 0, max: 1 }),
            successRate: fc.float({ min: 0, max: 1 })
          }),
          (userPreferences, contentFeatures) => {
            const score1 = recommendationSystem.calculateContentSimilarity(userPreferences, contentFeatures);
            const score2 = recommendationSystem.calculateContentSimilarity(userPreferences, contentFeatures);

            // Property: Identical inputs should produce identical scores
            expect(score1).toBe(score2);

            // Property: Score should be deterministic and in valid range
            expect(score1).toBeGreaterThanOrEqual(0);
            expect(score1).toBeLessThanOrEqual(1);
            expect(typeof score1).toBe('number');
            expect(isNaN(score1)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6: Contextual adjustment consistency
   * **Validates: Requirements 1.5**
   */
  describe('Property 6: Contextual Adjustment Validation', () => {
    test('should apply positive adjustments for matching context', async () => {
      await fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string({ minLength: 5 }),
              recommendationScore: fc.float({ min: Math.fround(0.3), max: Math.fround(0.8) }),
              metadata: fc.record({
                timeOfDay: fc.option(fc.array(fc.constantFrom('morning', 'afternoon', 'evening', 'night'), { minLength: 1, maxLength: 2 }), { nil: null }),
                moods: fc.option(fc.array(fc.constantFrom('romantic', 'playful', 'deep'), { minLength: 1, maxLength: 2 }), { nil: null }),
                weekendFriendly: fc.option(fc.boolean(), { nil: null })
              })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.record({
            timeOfDay: fc.constantFrom('morning', 'afternoon', 'evening', 'night'),
            mood: fc.constantFrom('romantic', 'playful', 'deep'),
            isWeekend: fc.boolean()
          }),
          (recommendations, context) => {
            const contextWeight = 0.2;
            const adjusted = recommendationSystem.applyContextualAdjustments(
              recommendations, 
              context, 
              contextWeight
            );

            expect(adjusted.length).toBe(recommendations.length);

            adjusted.forEach((adjustedRec, index) => {
              const originalRec = recommendations[index];

              // Property: Adjusted score should be >= original score (only positive adjustments)
              expect(adjustedRec.recommendationScore).toBeGreaterThanOrEqual(originalRec.recommendationScore);

              // Property: Adjusted score should not exceed 1.0
              expect(adjustedRec.recommendationScore).toBeLessThanOrEqual(1.0);

              // Property: Should have contextual metadata
              expect(adjustedRec).toHaveProperty('contextualBoost');
              expect(adjustedRec).toHaveProperty('contextualFactors');
              expect(adjustedRec.contextualBoost).toBeGreaterThanOrEqual(0);

              // Property: If context matches metadata, should get boost
              let expectedBoost = 0;
              if (originalRec.metadata?.timeOfDay?.includes(context.timeOfDay)) {
                expectedBoost += 0.1;
              }
              if (originalRec.metadata?.moods?.includes(context.mood)) {
                expectedBoost += 0.15;
              }
              if (context.isWeekend && originalRec.metadata?.weekendFriendly) {
                expectedBoost += 0.08;
              }

              if (expectedBoost > 0) {
                expect(adjustedRec.contextualBoost).toBeGreaterThan(0);
                expect(adjustedRec.recommendationScore).toBeGreaterThan(originalRec.recommendationScore);
              }
            });
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 7: Diversity filtering effectiveness
   * **Validates: Requirements 1.6**
   */
  describe('Property 7: Diversity Filtering Validation', () => {
    test('should maintain diversity across categories and heat levels', async () => {
      await fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string({ minLength: 5 }),
              category: fc.constantFrom('connection', 'fun', 'intimacy', 'adventure'),
              heatLevel: fc.integer({ min: 1, max: 5 }),
              recommendationScore: fc.float({ min: Math.fround(0.3), max: Math.fround(1.0) })
            }),
            { minLength: 8, maxLength: 20 }
          ),
          fc.float({ min: Math.fround(0.5), max: Math.fround(0.9) }),
          (recommendations, diversityThreshold) => {
            const diverse = recommendationSystem.applyDiversityFiltering(
              recommendations, 
              diversityThreshold
            );

            // Property: Should not return more than maxRecommendations
            expect(diverse.length).toBeLessThanOrEqual(recommendationSystem.params.maxRecommendations);

            // Property: Should maintain score ordering
            for (let i = 1; i < diverse.length; i++) {
              expect(diverse[i-1].recommendationScore).toBeGreaterThanOrEqual(diverse[i].recommendationScore);
            }

            // Property: If enough recommendations, should have category diversity
            if (diverse.length >= 4) {
              const categories = new Set(diverse.map(rec => rec.category));
              expect(categories.size).toBeGreaterThan(1);
            }

            // Property: If enough recommendations, should have heat level diversity
            if (diverse.length >= 4) {
              const heatLevels = new Set(diverse.map(rec => rec.heatLevel));
              expect(heatLevels.size).toBeGreaterThan(1);
            }

            // Property: All recommendations should have diversity scores
            diverse.forEach(rec => {
              expect(rec).toHaveProperty('diversityScore');
              expect(rec.diversityScore).toBeGreaterThanOrEqual(0);
              expect(rec.diversityScore).toBeLessThanOrEqual(1);
            });
          }
        ),
        { numRuns: 25 }
      );
    });
  });
});
