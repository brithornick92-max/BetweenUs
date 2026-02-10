// utils/recommendationSystem.js
import personalizationEngine from './personalizationEngine';
import mlModelManager from './mlModelManager';
import privacyEngine from './privacyEngine';
import analytics from './analytics';

/**
 * Basic Recommendation System
 * 
 * Implements content-based and collaborative filtering algorithms
 * with privacy preservation for personalized content recommendations.
 */
class RecommendationSystem {
  constructor() {
    this.RECOMMENDATION_CACHE_KEY = 'recommendation_cache';
    this.USER_SIMILARITY_KEY = 'user_similarity';
    this.CONTENT_FEATURES_KEY = 'content_features';
    
    // Algorithm weights
    this.algorithmWeights = {
      contentBased: 0.4,
      collaborative: 0.3,
      hybrid: 0.2,
      contextual: 0.1
    };
    
    // Recommendation parameters
    this.params = {
      maxRecommendations: 20,
      minRelevanceScore: 0.3,
      diversityThreshold: 0.7,
      freshnessFactor: 0.1,
      popularityBoost: 0.05
    };
    
    // Content feature cache
    this.contentFeatures = new Map();
    this.userSimilarities = new Map();
    
    this.isInitialized = false;
  }

  /**
   * Initialize recommendation system
   */
  async initialize() {
    try {
      if (this.isInitialized) {
        return true;
      }

      // Load cached content features
      await this.loadContentFeatures();
      
      // Initialize ML models
      await mlModelManager.initialize();
      
      this.isInitialized = true;
      console.log('🎯 Recommendation System initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize recommendation system:', error);
      return false;
    }
  }

  /**
   * Lightweight recommendation helper for a known content set.
   * This keeps UI flows stable even if advanced models are unavailable.
   */
  async getRecommendations(userId, availableContent = [], options = {}) {
    try {
      const items = Array.isArray(availableContent) ? availableContent : [];
      if (items.length === 0) return [];

      // Filter out items missing required .text property
      const validItems = items.filter(item => item && typeof item.text === 'string' && item.text.trim());
      if (validItems.length === 0) return [];

      const limit = Math.max(1, options.limit || 5);
      const seed = `${userId || 'anon'}_${new Date().toISOString().slice(0, 10)}`;

      const scored = validItems.map((item, index) => ({
        ...item,
        recommendationScore: this._stableScore(seed, item?.id ?? index),
      }));

      return scored
        .sort((a, b) => b.recommendationScore - a.recommendationScore)
        .slice(0, limit);
    } catch (error) {
      console.error('Failed to get lightweight recommendations:', error);
      const fallback = Array.isArray(availableContent) ? availableContent : [];
      return fallback.filter(item => item && typeof item.text === 'string').slice(0, options.limit || 5);
    }
  }
  /**
   * Generate recommendations for a user
   */
  async generateRecommendations(userId, context = {}, options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const startTime = Date.now();
      const mergedOptions = { ...this.params, ...options };
      
      // Get user profile and behavior data
      const userProfile = await personalizationEngine.getUserProfile(userId);
      if (!userProfile) {
        return {
          recommendations: this.getFallbackRecommendations(context),
          metadata: { fallback: true, reason: 'no_profile' }
        };
      }

      // Process user data with privacy preservation
      const privacyProcessedData = await privacyEngine.processUserData(
        userId, 
        { profile: userProfile, context }, 
        'recommendation'
      );

      // Generate recommendations using different algorithms
      const [contentBasedRecs, collaborativeRecs, hybridRecs] = await Promise.all([
        this.generateContentBasedRecommendations(userProfile, context, mergedOptions),
        this.generateCollaborativeRecommendations(userId, userProfile, context, mergedOptions),
        this.generateHybridRecommendations(userId, userProfile, context, mergedOptions)
      ]);

      // Combine and score recommendations
      const combinedRecommendations = this.combineRecommendations([
        { recommendations: contentBasedRecs, weight: this.algorithmWeights.contentBased },
        { recommendations: collaborativeRecs, weight: this.algorithmWeights.collaborative },
        { recommendations: hybridRecs, weight: this.algorithmWeights.hybrid }
      ]);

      // Prefer user-selected categories when available
      const preferredCategories = userProfile?.preferences?.contentCategories || [];
      const categoryFiltered =
        preferredCategories.length > 0
          ? combinedRecommendations.filter(rec => preferredCategories.includes(rec.category))
          : combinedRecommendations;

      const baseRecommendations = categoryFiltered.length > 0 ? categoryFiltered : combinedRecommendations;

      // Apply contextual adjustments
      const contextualRecommendations = this.applyContextualAdjustments(
        baseRecommendations, 
        context, 
        this.algorithmWeights.contextual
      );

      // Apply diversity filtering
      const diverseRecommendations = this.applyDiversityFiltering(
        contextualRecommendations,
        mergedOptions.diversityThreshold
      );

      // Limit to requested number
      const finalRecommendations = diverseRecommendations
        .slice(0, mergedOptions.maxRecommendations)
        .map(rec => ({
          ...rec,
          recommendationScore: Math.min(
            1,
            Math.max(mergedOptions.minRelevanceScore, rec.recommendationScore || 0)
          ),
          generatedAt: Date.now(),
          algorithm: 'hybrid',
          privacyPreserved: true
        }));

      // Cache recommendations
      await this.cacheRecommendations(userId, context, finalRecommendations);

      // Track recommendation generation
      await analytics.trackFeatureUsage('recommendations', 'generated', {
        user_id: userId,
        recommendation_count: finalRecommendations.length,
        generation_time: Date.now() - startTime,
        algorithms_used: ['content_based', 'collaborative', 'hybrid'],
        privacy_preserved: true
      });

      return {
        recommendations: finalRecommendations,
        metadata: {
          generationTime: Date.now() - startTime,
          algorithmsUsed: ['content_based', 'collaborative', 'hybrid'],
          totalCandidates: combinedRecommendations.length,
          privacyPreserved: true
        }
      };
    } catch (error) {
      console.error('Failed to generate recommendations:', error);
      return {
        recommendations: this.getFallbackRecommendations(context),
        metadata: { error: error.message, fallback: true }
      };
    }
  }

  _stableScore(seed, id) {
    const str = `${seed}:${String(id)}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash % 1000) / 1000;
  }
  /**
   * Content-Based Filtering Algorithm
   */
  async generateContentBasedRecommendations(userProfile, context, options) {
    try {
      // Get available content
      const availableContent = await this.getAvailableContent(userProfile);
      
      // Extract user preferences from profile
      const userPreferences = this.extractUserPreferences(userProfile);
      
      // Calculate content features for each item
      const scoredContent = [];
      
      for (const content of availableContent) {
        const contentFeatures = await this.extractContentFeatures(content);
        const similarityScore = this.calculateContentSimilarity(userPreferences, contentFeatures);
        
        if (similarityScore >= options.minRelevanceScore) {
          scoredContent.push({
            ...content,
            recommendationScore: similarityScore,
            algorithm: 'content_based',
            reasoning: this.generateContentBasedReasoning(userPreferences, contentFeatures),
            features: contentFeatures
          });
        }
      }
      
      // Sort by similarity score
      return scoredContent.sort((a, b) => b.recommendationScore - a.recommendationScore);
    } catch (error) {
      console.error('Content-based filtering failed:', error);
      return [];
    }
  }

  /**
   * Collaborative Filtering Algorithm (Privacy-Preserving)
   */
  async generateCollaborativeRecommendations(userId, userProfile, context, options) {
    try {
      // Find similar users (using privacy-preserved features)
      const similarUsers = await this.findSimilarUsers(userId, userProfile);
      
      if (similarUsers.length === 0) {
        return []; // No similar users found
      }
      
      // Get content preferences from similar users
      const collaborativeScores = new Map();
      
      for (const similarUser of similarUsers) {
        const userWeight = similarUser.similarity;
        const userPreferences = similarUser.preferences;
        
        Object.keys(userPreferences).forEach(contentId => {
          const preference = userPreferences[contentId];
          const currentScore = collaborativeScores.get(contentId) || 0;
          collaborativeScores.set(contentId, currentScore + (preference * userWeight));
        });
      }
      
      // Convert to recommendations
      const recommendations = [];
      const availableContent = await this.getAvailableContent(userProfile);
      
      for (const content of availableContent) {
        const score = collaborativeScores.get(content.id) || 0;
        
        if (score >= options.minRelevanceScore) {
          recommendations.push({
            ...content,
            recommendationScore: Math.min(1.0, score),
            algorithm: 'collaborative',
            reasoning: `Recommended by ${similarUsers.length} similar users`,
            similarUserCount: similarUsers.length
          });
        }
      }
      
      return recommendations.sort((a, b) => b.recommendationScore - a.recommendationScore);
    } catch (error) {
      console.error('Collaborative filtering failed:', error);
      return [];
    }
  }

  /**
   * Hybrid Recommendation Algorithm
   */
  async generateHybridRecommendations(userId, userProfile, context, options) {
    try {
      // Use ML model for hybrid recommendations
      const userPreferences = this.extractUserPreferences(userProfile);
      const features = {
        behaviorScore: this.calculateBehaviorScore(userProfile),
        contentAffinity: this.calculateContentAffinity(userProfile),
        contextualFactors: this.calculateContextualFactors(context),
        relationshipStage: this.calculateRelationshipStage(userProfile),
        temporalPatterns: this.calculateTemporalPatterns(userProfile, context)
      };
      
      const mlPrediction = await mlModelManager.predict('recommendation', features);
      
      if (!mlPrediction || mlPrediction.error) {
        return []; // ML model not available
      }
      
      // Get content and score using ML model
      const availableContent = await this.getAvailableContent(userProfile);
      const recommendations = [];
      
      for (const content of availableContent) {
        const contentFeatures = await this.extractContentFeatures(content);
        const hybridFeatures = { ...features, ...contentFeatures };
        
        const prediction = await mlModelManager.predict('recommendation', hybridFeatures);
        const similarity = this.calculateContentSimilarity(userPreferences, contentFeatures);
        const mlScore = prediction.prediction || 0.5;
        const score = Math.min(1, Math.max(0, (mlScore * 0.2) + (similarity * 0.8)));
        
        if (score >= options.minRelevanceScore) {
          recommendations.push({
            ...content,
            recommendationScore: score,
            algorithm: 'hybrid_ml',
            reasoning: 'ML-powered personalized recommendation',
            confidence: prediction.confidence || 0.5,
            modelVersion: prediction.modelVersion
          });
        }
      }
      
      return recommendations.sort((a, b) => b.recommendationScore - a.recommendationScore);
    } catch (error) {
      console.error('Hybrid recommendations failed:', error);
      return [];
    }
  }
  /**
   * Extract user preferences from profile
   */
  extractUserPreferences(userProfile) {
    const preferences = {
      categories: {},
      heatLevels: {},
      moods: {},
      timePreferences: {},
      relationshipStage: userProfile.relationshipData?.stage || 'unknown'
    };
    
    // Extract category preferences
    if (userProfile.preferences?.contentCategories) {
      userProfile.preferences.contentCategories.forEach(category => {
        preferences.categories[category] = 1.0;
      });
    }
    
    // Extract heat level preferences
    if (userProfile.preferences?.heatLevels) {
      userProfile.preferences.heatLevels.forEach(level => {
        preferences.heatLevels[level] = 1.0;
      });
    }
    
    // Extract behavioral preferences from interactions
    if (userProfile.behaviorMetrics?.contentInteractions) {
      Object.keys(userProfile.behaviorMetrics.contentInteractions).forEach(contentId => {
        const interaction = userProfile.behaviorMetrics.contentInteractions[contentId];
        // Use interaction data to infer preferences
        if (interaction.rating > 3) {
          preferences.categories[interaction.category] = 
            (preferences.categories[interaction.category] || 0) + 0.1;
        }
      });
    }
    
    return preferences;
  }

  /**
   * Extract content features
   */
  async extractContentFeatures(content) {
    try {
      const contentId = content?.id || 'unknown';
      // Check cache first
      const cacheKey = `content_${contentId}`;
      if (this.contentFeatures.has(cacheKey)) {
        return this.contentFeatures.get(cacheKey);
      }
      
      let popularity = 0.5;
      let successRate = 0.5;
      try {
        popularity = await this.getContentPopularity(contentId);
      } catch {
        popularity = 0.5;
      }
      try {
        successRate = await this.getContentSuccessRate(contentId);
      } catch {
        successRate = 0.5;
      }

      const features = {
        id: contentId,
        category: content?.category || 'general',
        heatLevel: content?.heatLevel || 1,
        duration: content?.estimatedDuration || 30,
        complexity: content?.complexity || 'medium',
        relationshipStages: content?.relationshipDuration || ['universal'],
        tags: content?.tags || [],
        popularity,
        freshness: this.calculateContentFreshness(content || {}),
        successRate
      };
      
      // Cache features
      this.contentFeatures.set(cacheKey, features);
      
      return features;
    } catch (error) {
      return {
        id: content?.id || 'unknown',
        category: content?.category || 'general',
        heatLevel: content?.heatLevel || 1,
        duration: content?.estimatedDuration || 30,
        complexity: content?.complexity || 'medium',
        relationshipStages: content?.relationshipDuration || ['universal'],
        tags: content?.tags || [],
        popularity: 0.5,
        freshness: 0.5,
        successRate: 0.5
      };
    }
  }

  /**
   * Calculate content similarity
   */
  calculateContentSimilarity(userPreferences, contentFeatures) {
    const safeNumber = (value, fallback = 0) =>
      Number.isFinite(value) ? value : fallback;

    let similarity = 0;
    let totalWeight = 0;
    
    // Category similarity
    const categoryWeight = 0.3;
    const categoryScore = safeNumber(userPreferences.categories[contentFeatures.category], 0);
    similarity += categoryScore * categoryWeight;
    totalWeight += categoryWeight;
    
    // Heat level similarity
    const heatLevelWeight = 0.25;
    const heatLevelScore = safeNumber(userPreferences.heatLevels[contentFeatures.heatLevel], 0);
    similarity += heatLevelScore * heatLevelWeight;
    totalWeight += heatLevelWeight;
    
    // Relationship stage compatibility
    const stageWeight = 0.2;
    const stageScore = contentFeatures.relationshipStages.includes(userPreferences.relationshipStage) ? 1.0 : 0.3;
    similarity += stageScore * stageWeight;
    totalWeight += stageWeight;
    
    // Popularity boost
    const popularityWeight = 0.1;
    similarity += safeNumber(contentFeatures.popularity, 0.5) * popularityWeight;
    totalWeight += popularityWeight;
    
    // Success rate boost
    const successWeight = 0.15;
    similarity += safeNumber(contentFeatures.successRate, 0.5) * successWeight;
    totalWeight += successWeight;
    
    return totalWeight > 0 ? similarity / totalWeight : 0;
  }

  /**
   * Find similar users (privacy-preserving)
   */
  async findSimilarUsers(userId, userProfile) {
    const fallback = [
      {
        similarity: 0.8,
        preferences: { content_1: 0.9 },
        anonymizedId: 'pattern_1'
      }
    ];

    let userFeatures = {};
    try {
      userFeatures = this.extractAnonymizedUserFeatures(userProfile);
    } catch {
      userFeatures = {};
    }

    let similarityPatterns = [];
    try {
      similarityPatterns = await this.getSimilarityPatterns(userFeatures);
    } catch (error) {
      console.error('Failed to find similar users:', error);
      return [];
    }

    if (similarityPatterns && !Array.isArray(similarityPatterns)) {
      similarityPatterns = [similarityPatterns];
    }
    if (!Array.isArray(similarityPatterns) || similarityPatterns.length === 0) {
      similarityPatterns = fallback.map((item) => ({
        patternId: item.anonymizedId,
        similarity: item.similarity,
        aggregatedPreferences: item.preferences,
      }));
    }

    const similarUsers = similarityPatterns
      .map((pattern) => ({
        similarity: Number(pattern.similarity),
        preferences: pattern.aggregatedPreferences,
        anonymizedId: pattern.patternId,
      }))
      .filter((item) => Number.isFinite(item.similarity) && item.similarity >= 0.6);

    return (similarUsers.length ? similarUsers : fallback).slice(0, 10);
  }

  /**
   * Extract anonymized user features for similarity matching
   */
  extractAnonymizedUserFeatures(userProfile) {
    return {
      relationshipStage: userProfile.relationshipData?.stage || 'unknown',
      engagementLevel: this.categorizeEngagementLevel(userProfile.behaviorMetrics),
      contentPreferences: this.categorizeContentPreferences(userProfile.preferences),
      usagePattern: this.categorizeUsagePattern(userProfile.behaviorMetrics),
      // No personally identifiable information included
    };
  }
  /**
   * Combine recommendations from different algorithms
   */
  combineRecommendations(algorithmResults) {
    const combinedScores = new Map();
    
    algorithmResults.forEach(({ recommendations, weight }) => {
      recommendations.forEach(rec => {
        const currentScore = combinedScores.get(rec.id) || { score: 0, count: 0, algorithms: [] };
        currentScore.score += rec.recommendationScore * weight;
        currentScore.count += 1;
        currentScore.algorithms.push(rec.algorithm);
        combinedScores.set(rec.id, currentScore);
      });
    });
    
    // Convert back to recommendation objects
    const combined = [];
    const allRecommendations = algorithmResults.flatMap(result => result.recommendations);
    
    combinedScores.forEach((scoreData, contentId) => {
      const recommendation = allRecommendations.find(rec => rec.id === contentId);
      if (recommendation) {
        combined.push({
          ...recommendation,
          recommendationScore: scoreData.score / scoreData.count,
          algorithmCount: scoreData.count,
          algorithms: scoreData.algorithms,
          reasoning: `Recommended by ${scoreData.algorithms.join(', ')} algorithms`
        });
      }
    });
    
    return combined.sort((a, b) => b.recommendationScore - a.recommendationScore);
  }

  /**
   * Apply contextual adjustments
   */
  applyContextualAdjustments(recommendations, context, contextWeight) {
    return recommendations.map(rec => {
      let contextualBoost = 0;
      const baseScore = Number.isFinite(rec.recommendationScore) ? rec.recommendationScore : 0;
      if (!Number.isFinite(rec.recommendationScore)) {
        rec.recommendationScore = baseScore;
      }
      
      // Time-based adjustments
      if (context.timeOfDay && rec.metadata?.timeOfDay) {
        if (rec.metadata.timeOfDay.includes(context.timeOfDay)) {
          contextualBoost += 0.1;
        }
      }
      
      // Mood-based adjustments
      if (context.mood && rec.metadata?.moods) {
        if (rec.metadata.moods.includes(context.mood)) {
          contextualBoost += 0.15;
        }
      }
      
      // Seasonal adjustments
      if (context.season && rec.metadata?.seasonal) {
        contextualBoost += 0.05;
      }
      
      // Weekend vs weekday adjustments
      if (context.isWeekend && rec.metadata?.weekendFriendly) {
        contextualBoost += 0.08;
      }
      
      const adjustedScore = Math.min(1.0, baseScore + (contextualBoost * contextWeight));
      
      return {
        ...rec,
        recommendationScore: adjustedScore,
        contextualBoost: contextualBoost,
        contextualFactors: Object.keys(context)
      };
    });
  }

  /**
   * Apply diversity filtering
   */
  applyDiversityFiltering(recommendations, diversityThreshold) {
    const diverse = [];
    const categoryCounts = new Map();
    const heatCounts = new Map();
    const normalized = recommendations.map(rec => {
      const score = Number.isFinite(rec.recommendationScore) ? rec.recommendationScore : 0;
      if (!Number.isFinite(rec.recommendationScore)) {
        rec.recommendationScore = score;
      }
      return rec;
    });
    const sorted = [...normalized].sort(
      (a, b) => (b.recommendationScore || 0) - (a.recommendationScore || 0)
    );

    const maxPerCategory = 2;
    const maxPerHeat = 2;

    sorted.forEach(rec => {
      const categoryCount = categoryCounts.get(rec.category) || 0;
      const heatLevelCount = heatCounts.get(rec.heatLevel) || 0;

      const rawScore = 1 - (categoryCount * 0.35 + heatLevelCount * 0.25);
      const diversityScore = Math.min(1, Math.max(0, rawScore));
      const allow =
        diverse.length < 3 ||
        diversityScore >= diversityThreshold ||
        categoryCount === 0 ||
        heatLevelCount === 0;

      if (!allow) return;

      if (categoryCount >= maxPerCategory && heatLevelCount >= maxPerHeat) return;

      diverse.push({ ...rec, diversityScore });
      categoryCounts.set(rec.category, categoryCount + 1);
      heatCounts.set(rec.heatLevel, heatLevelCount + 1);
    });

    if (diverse.length >= 4) {
      const categories = new Set(diverse.map(rec => rec.category));
      const heatLevels = new Set(diverse.map(rec => rec.heatLevel));
      if (categories.size === 1 || heatLevels.size === 1) {
        return diverse.slice(0, 3);
      }
    }

    return diverse.slice(0, this.params.maxRecommendations);
  }

  /**
   * Generate recommendation explanations
   */
  generateContentBasedReasoning(userPreferences, contentFeatures) {
    const reasons = [];
    
    if (userPreferences.categories[contentFeatures.category]) {
      reasons.push(`matches your interest in ${contentFeatures.category}`);
    }
    
    if (userPreferences.heatLevels[contentFeatures.heatLevel]) {
      reasons.push(`fits your preferred intensity level`);
    }
    
    if (contentFeatures.successRate > 0.8) {
      reasons.push(`highly rated by other couples`);
    }
    
    if (contentFeatures.freshness > 0.7) {
      reasons.push(`recently added content`);
    }
    
    return reasons.length > 0 ? 
      `Recommended because it ${reasons.join(' and ')}` : 
      'Recommended based on your preferences';
  }
  /**
   * Utility methods for scoring
   */
  calculateBehaviorScore(userProfile) {
    const metrics = userProfile.behaviorMetrics || {};
    const sessionCount = metrics.sessionCount || 0;
    const engagementTime = metrics.totalEngagementTime || 0;
    const interactions = Object.keys(metrics.contentInteractions || {}).length;
    
    return Math.min(1.0, (sessionCount * 0.3 + engagementTime * 0.4 + interactions * 0.3) / 100);
  }

  calculateContentAffinity(userProfile) {
    const preferences = userProfile.preferences || {};
    const categoryCount = preferences.contentCategories?.length || 0;
    const heatLevelCount = preferences.heatLevels?.length || 0;
    
    return Math.min(1.0, (categoryCount + heatLevelCount) / 10);
  }

  calculateContextualFactors(context) {
    let score = 0.5; // Base score
    
    if (context.timeOfDay) score += 0.1;
    if (context.mood) score += 0.15;
    if (context.isWeekend !== undefined) score += 0.05;
    if (context.season) score += 0.05;
    if (context.recentActivity) score += 0.1;
    
    return Math.min(1.0, score);
  }

  calculateRelationshipStage(userProfile) {
    const stages = { new: 0.2, developing: 0.4, established: 0.6, mature: 0.8, long_term: 1.0 };
    return stages[userProfile.relationshipData?.stage] || 0.5;
  }

  calculateTemporalPatterns(userProfile, context) {
    // Simple temporal pattern scoring
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    
    // Score based on typical usage patterns
    let score = 0.5;
    
    if (hour >= 19 && hour <= 22) score += 0.2; // Evening boost
    if (dayOfWeek === 0 || dayOfWeek === 6) score += 0.1; // Weekend boost
    
    return Math.min(1.0, score);
  }

  /**
   * Content utility methods
   */
  async getAvailableContent(userProfile) {
    // This would typically fetch from your content service
    // For now, return a mock structure
    return [
      {
        id: 'prompt_0',
        category: 'connection',
        heatLevel: 1,
        title: 'Share a small win today',
        estimatedDuration: 8,
        relationshipDuration: ['new', 'developing'],
        tags: ['connection', 'gratitude'],
        metadata: { timeOfDay: ['morning', 'evening'], moods: ['light'] }
      },
      {
        id: 'prompt_1',
        category: 'connection',
        heatLevel: 2,
        title: 'Share a childhood memory',
        estimatedDuration: 15,
        relationshipDuration: ['developing', 'established'],
        tags: ['memories', 'sharing'],
        metadata: {
          timeOfDay: ['evening'],
          moods: ['reflective', 'intimate'],
          weekendFriendly: true
        }
      },
      {
        id: 'prompt_2',
        category: 'fun',
        heatLevel: 1,
        title: 'Tell a silly story',
        estimatedDuration: 10,
        relationshipDuration: ['new', 'developing'],
        tags: ['fun'],
        metadata: { timeOfDay: ['afternoon'], moods: ['playful'] }
      },
      {
        id: 'prompt_2b',
        category: 'fun',
        heatLevel: 2,
        title: 'Plan a quick mini-game together',
        estimatedDuration: 12,
        relationshipDuration: ['new', 'developing', 'established'],
        tags: ['fun', 'playful']
      },
      {
        id: 'prompt_3',
        category: 'intimacy',
        heatLevel: 4,
        title: 'Share a secret desire',
        estimatedDuration: 20,
        relationshipDuration: ['established', 'mature'],
        tags: ['intimacy'],
        metadata: { timeOfDay: ['night'], moods: ['romantic'] }
      },
      {
        id: 'prompt_3b',
        category: 'intimacy',
        heatLevel: 5,
        title: 'Talk about an intimate fantasy',
        estimatedDuration: 25,
        relationshipDuration: ['mature', 'long_term'],
        tags: ['intimacy'],
        metadata: { timeOfDay: ['night'], moods: ['romantic', 'deep'] }
      },
      {
        id: 'prompt_4',
        category: 'adventure',
        heatLevel: 3,
        title: 'Plan a spontaneous date',
        estimatedDuration: 15,
        relationshipDuration: ['developing', 'established'],
        tags: ['adventure'],
        metadata: { weekendFriendly: true }
      },
      {
        id: 'prompt_4b',
        category: 'adventure',
        heatLevel: 2,
        title: 'Pick a new neighborhood to explore',
        estimatedDuration: 20,
        relationshipDuration: ['new', 'developing', 'established'],
        tags: ['adventure', 'outdoor'],
        metadata: { weekendFriendly: true }
      },
      {
        id: 'prompt_5',
        category: 'reflection',
        heatLevel: 2,
        title: 'Reflect on a shared win',
        estimatedDuration: 12,
        relationshipDuration: ['established', 'mature', 'long_term'],
        tags: ['reflection']
      },
      {
        id: 'prompt_5b',
        category: 'reflection',
        heatLevel: 3,
        title: 'Discuss a turning point in your relationship',
        estimatedDuration: 18,
        relationshipDuration: ['mature', 'long_term'],
        tags: ['reflection', 'deep'],
        metadata: { timeOfDay: ['evening'], moods: ['deep'] }
      },
      {
        id: 'prompt_6',
        category: 'creativity',
        heatLevel: 1,
        title: 'Create a couple playlist theme',
        estimatedDuration: 8,
        relationshipDuration: ['new', 'developing'],
        tags: ['creativity']
      },
      {
        id: 'prompt_6b',
        category: 'creativity',
        heatLevel: 2,
        title: 'Invent a nickname with a backstory',
        estimatedDuration: 10,
        relationshipDuration: ['new', 'developing', 'established'],
        tags: ['creativity', 'connection']
      }
    ];
  }

  async getContentPopularity(contentId) {
    // Would fetch from analytics
    return Math.random() * 0.3 + 0.4; // Mock: 0.4-0.7 range
  }

  calculateContentFreshness(content) {
    const createdAt = content.createdAt || Date.now() - (30 * 24 * 60 * 60 * 1000);
    const daysSinceCreated = (Date.now() - createdAt) / (24 * 60 * 60 * 1000);
    return Math.max(0, 1 - (daysSinceCreated / 90)); // Fresh for 90 days
  }

  async getContentSuccessRate(contentId) {
    // Would fetch from performance analyzer
    return Math.random() * 0.4 + 0.6; // Mock: 0.6-1.0 range
  }

  /**
   * Caching methods
   */
  async cacheRecommendations(userId, context, recommendations) {
    try {
      const cacheKey = `${this.RECOMMENDATION_CACHE_KEY}_${userId}_${this.hashContext(context)}`;
      const cacheData = {
        recommendations,
        context,
        timestamp: Date.now(),
        expiresAt: Date.now() + (30 * 60 * 1000) // 30 minutes
      };
      
      // In a real implementation, you'd use AsyncStorage or similar
      // For now, use in-memory cache
      this.recommendationCache = this.recommendationCache || new Map();
      this.recommendationCache.set(cacheKey, cacheData);
      
      return true;
    } catch (error) {
      console.error('Failed to cache recommendations:', error);
      return false;
    }
  }

  hashContext(context) {
    return JSON.stringify(context).split('').reduce((hash, char) => {
      hash = ((hash << 5) - hash) + char.charCodeAt(0);
      return hash & hash;
    }, 0).toString(36);
  }

  /**
   * Fallback methods
   */
  getFallbackRecommendations(context) {
    return [
      {
        id: 'fallback_1',
        category: 'connection',
        heatLevel: 1,
        title: 'Tell each other about your day',
        recommendationScore: 0.7,
        algorithm: 'fallback',
        reasoning: 'A safe, universal conversation starter',
        fallback: true
      },
      {
        id: 'fallback_2',
        category: 'fun',
        heatLevel: 1,
        title: 'Share your favorite song right now',
        recommendationScore: 0.6,
        algorithm: 'fallback',
        reasoning: 'Music brings people together',
        fallback: true
      }
    ];
  }

  /**
   * Privacy-preserving similarity patterns
   */
  async getSimilarityPatterns(userFeatures) {
    // Mock similarity patterns - in production, these would be
    // aggregated, anonymized patterns from user behavior
    return [
      {
        patternId: 'pattern_1',
        similarity: 0.8,
        aggregatedPreferences: {
          'prompt_connection_1': 0.9,
          'prompt_fun_2': 0.7,
          'date_romantic_1': 0.8
        }
      },
      {
        patternId: 'pattern_2',
        similarity: 0.7,
        aggregatedPreferences: {
          'prompt_deep_1': 0.8,
          'prompt_reflection_1': 0.9,
          'date_adventure_1': 0.6
        }
      }
    ];
  }

  categorizeEngagementLevel(behaviorMetrics) {
    const sessionCount = behaviorMetrics?.sessionCount || 0;
    if (sessionCount > 50) return 'high';
    if (sessionCount > 20) return 'medium';
    return 'low';
  }

  categorizeContentPreferences(preferences) {
    const categoryCount = preferences?.contentCategories?.length || 0;
    if (categoryCount > 5) return 'diverse';
    if (categoryCount > 2) return 'moderate';
    return 'focused';
  }

  categorizeUsagePattern(behaviorMetrics) {
    const avgSessionDuration = behaviorMetrics?.totalEngagementTime / (behaviorMetrics?.sessionCount || 1);
    if (avgSessionDuration >= 600) return 'deep'; // 10+ minutes
    if (avgSessionDuration >= 180) return 'moderate'; // 3+ minutes
    return 'quick';
  }

  async loadContentFeatures() {
    // Load cached content features
    this.contentFeatures = new Map();
    // In production, load from persistent storage
  }
}

export default new RecommendationSystem();
