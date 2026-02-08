// utils/personalizationEngine.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import userBehaviorAnalyzer from './userBehaviorAnalyzer';
import analytics from './analytics';

/**
 * Core Personalization Engine
 * 
 * Provides intelligent, privacy-first personalization for the Between Us app.
 * Combines behavioral analysis, content matching, and contextual awareness
 * to deliver personalized experiences while keeping all sensitive data local.
 */
class PersonalizationEngine {
  constructor() {
    this.USER_PROFILE_KEY = 'personalization_profile';
    this.BEHAVIOR_CACHE_KEY = 'behavior_patterns';
    this.RECOMMENDATIONS_CACHE_KEY = 'cached_recommendations';
    
    // Cache configuration
    this.cacheConfig = {
      userProfile: { ttl: 86400000, maxSize: 1 }, // 24 hours
      behaviorPatterns: { ttl: 3600000, maxSize: 10 }, // 1 hour
      recommendations: { ttl: 1800000, maxSize: 50 } // 30 minutes
    };
    
    // In-memory cache for performance
    this.memoryCache = new Map();
    
    // Personalization weights for recommendation scoring
    this.weights = {
      behaviorScore: 0.35,
      contentAffinity: 0.25,
      contextualFactors: 0.20,
      relationshipStage: 0.15,
      temporalPatterns: 0.05
    };

    this.lastProfileError = false;
  }

  /**
   * Initialize personalization for a user
   * Sets up user profile and begins behavior tracking
   */
  async initializeUser(userId, initialData = {}) {
    try {
      const userProfile = {
        userId,
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        preferences: {
          contentCategories: initialData.goals || [],
          heatLevels: [1, 2, 3], // Start with lower heat levels
          moods: [],
          timePreferences: {}
        },
        behaviorMetrics: {
          sessionCount: 0,
          totalEngagementTime: 0,
          contentInteractions: {},
          featureUsage: {},
          lastActiveDate: Date.now()
        },
        relationshipData: {
          startDate: initialData.anniversaryDate || null,
          stage: this.calculateRelationshipStage(initialData.anniversaryDate),
          milestones: []
        },
        personalizationSettings: {
          enabled: true,
          adaptiveUI: true,
          smartNotifications: true,
          privacyLevel: 'high'
        }
      };

      await this.saveUserProfile(userId, userProfile);
      
      // Track initialization
      await analytics.trackFeatureUsage('personalization', 'user_initialized', {
        user_id: userId,
        initial_preferences: Object.keys(userProfile.preferences).length
      });

      return userProfile;
    } catch (error) {
      console.error('Failed to initialize personalization for user:', error);
      throw error;
    }
  }

  /**
   * Generate personalized experience for user
   * Main entry point for personalization requests
   */
  async generatePersonalizedExperience(userId, context = {}) {
    try {
      const startTime = Date.now();
      
      // Get user profile and behavior data
      const [userProfile, behaviorPatterns] = await Promise.all([
        this.getUserProfile(userId),
        this.getBehaviorPatterns(userId)
      ]);

      if (this.lastProfileError) {
        return this.getFallbackExperience(userId, context);
      }

      if (!userProfile) {
        // Return default experience for new users
        return this.getDefaultExperience(context);
      }

      // Analyze current context
      const contextualFactors = this.analyzeContext(context, userProfile);
      
      // Generate personalized components
      const [recommendations, layout, notifications, insights] = await Promise.all([
        this.generateRecommendations(userProfile, behaviorPatterns, contextualFactors),
        this.generateAdaptiveLayout(userProfile, behaviorPatterns, contextualFactors),
        this.generateSmartNotifications(userProfile, contextualFactors),
        this.generatePersonalizedInsights(userProfile, behaviorPatterns)
      ]);

      const experience = {
        userId,
        timestamp: Date.now(),
        context: contextualFactors,
        recommendations,
        layout,
        notifications,
        insights,
        metadata: {
          generationTime: Date.now() - startTime,
          cacheHits: this.getCacheHitStats(),
          personalizationScore: this.calculatePersonalizationScore(userProfile, behaviorPatterns)
        }
      };

      // Cache the experience
      await this.cacheExperience(userId, context, experience);
      
      // Track personalization generation
      await analytics.trackFeatureUsage('personalization', 'experience_generated', {
        user_id: userId,
        generation_time: experience.metadata.generationTime,
        recommendation_count: recommendations.length,
        personalization_score: experience.metadata.personalizationScore
      });

      return experience;
    } catch (error) {
      console.error('Failed to generate personalized experience:', error);
      // Return fallback experience
      return this.getFallbackExperience(userId, context);
    }
  }

  /**
   * Generate personalized content recommendations
   */
  async generateRecommendations(userProfile, behaviorPatterns, contextualFactors) {
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey('recommendations', userProfile.userId, contextualFactors);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      // Calculate recommendation scores for available content
      const contentPool = await this.getAvailableContent(userProfile);
      const scoredContent = [];

      for (const content of contentPool) {
        const score = this.calculateRecommendationScore(
          content,
          userProfile,
          behaviorPatterns,
          contextualFactors
        );

        if (score >= 0.3) { // Minimum relevance threshold
          scoredContent.push({
            ...content,
            recommendationScore: score,
            reasoning: this.generateRecommendationReasoning(content, userProfile, contextualFactors),
            personalizedMetadata: this.generatePersonalizedMetadata(content, userProfile)
          });
        }
      }

      // Sort by score and apply diversity filtering
      const recommendations = this.applyDiversityFiltering(
        scoredContent.sort((a, b) => b.recommendationScore - a.recommendationScore)
      ).slice(0, 10); // Top 10 recommendations

      // Cache recommendations
      this.setCache(cacheKey, recommendations, this.cacheConfig.recommendations.ttl);

      return recommendations;
    } catch (error) {
      console.error('Failed to generate recommendations:', error);
      return this.getFallbackRecommendations(userProfile);
    }
  }

  /**
   * Calculate recommendation score for content
   */
  calculateRecommendationScore(content, userProfile, behaviorPatterns, contextualFactors) {
    try {
      // Behavior-based scoring
      const behaviorScore = this.calculateBehaviorScore(content, userProfile, behaviorPatterns);
      
      // Content affinity scoring
      const contentAffinity = this.calculateContentAffinity(content, userProfile);
      
      // Contextual relevance scoring
      const contextualRelevance = this.calculateContextualRelevance(content, contextualFactors);
      
      // Relationship stage appropriateness
      const stageRelevance = this.calculateStageRelevance(content, userProfile.relationshipData);
      
      // Temporal pattern matching
      const temporalMatch = this.calculateTemporalMatch(content, behaviorPatterns, contextualFactors);

      // Weighted combination
      const finalScore = (
        behaviorScore * this.weights.behaviorScore +
        contentAffinity * this.weights.contentAffinity +
        contextualRelevance * this.weights.contextualFactors +
        stageRelevance * this.weights.relationshipStage +
        temporalMatch * this.weights.temporalPatterns
      );

      return Math.min(1.0, Math.max(0.0, finalScore));
    } catch (error) {
      console.error('Error calculating recommendation score:', error);
      return 0.5; // Neutral score on error
    }
  }

  /**
   * Calculate behavior-based score for content
   */
  calculateBehaviorScore(content, userProfile, behaviorPatterns) {
    const interactions = userProfile.behaviorMetrics.contentInteractions;
    
    // Category preference score
    const categoryScore = this.getCategoryPreferenceScore(content.category, interactions);
    
    // Heat level preference score
    const heatLevelScore = this.getHeatLevelPreferenceScore(content.heatLevel, userProfile.preferences);
    
    // Completion rate for similar content
    const completionScore = this.getCompletionScore(content, interactions);
    
    // Engagement depth score
    const engagementScore = this.getEngagementScore(content, behaviorPatterns);

    return (categoryScore * 0.3 + heatLevelScore * 0.25 + completionScore * 0.25 + engagementScore * 0.2);
  }

  /**
   * Calculate content affinity score
   */
  calculateContentAffinity(content, userProfile) {
    const preferences = userProfile.preferences;
    
    // Direct category match
    const categoryMatch = preferences.contentCategories.includes(content.category) ? 1.0 : 0.3;
    
    // Heat level comfort
    const heatLevelComfort = preferences.heatLevels.includes(content.heatLevel) ? 1.0 : 0.2;
    
    // Mood alignment (if mood context available)
    const moodAlignment = this.calculateMoodAlignment(content, preferences.moods);
    
    return (categoryMatch * 0.4 + heatLevelComfort * 0.4 + moodAlignment * 0.2);
  }

  /**
   * Calculate contextual relevance score
   */
  calculateContextualRelevance(content, contextualFactors) {
    let score = 0.5; // Base score
    
    // Time of day relevance
    if (contextualFactors.timeOfDay && content.metadata?.timeOfDay) {
      score += this.getTimeRelevanceScore(contextualFactors.timeOfDay, content.metadata.timeOfDay);
    }
    
    // Day of week relevance
    if (contextualFactors.dayOfWeek && content.metadata?.dayOfWeek) {
      score += this.getDayRelevanceScore(contextualFactors.dayOfWeek, content.metadata.dayOfWeek);
    }
    
    // Seasonal relevance
    if (contextualFactors.season && content.metadata?.seasonal) {
      score += 0.1;
    }
    
    // Recent activity context
    if (contextualFactors.recentActivity && content.metadata?.followsWell) {
      const followsScore = content.metadata.followsWell.includes(contextualFactors.recentActivity) ? 0.2 : 0;
      score += followsScore;
    }

    return Math.min(1.0, score);
  }

  /**
   * Generate adaptive UI layout based on user patterns
   */
  async generateAdaptiveLayout(userProfile, behaviorPatterns, contextualFactors) {
    try {
      const layout = {
        type: 'adaptive',
        timestamp: Date.now(),
        sections: [],
        shortcuts: [],
        widgets: []
      };

      // Determine primary layout based on usage patterns
      const primaryUsage = this.getPrimaryUsagePattern(behaviorPatterns);
      
      switch (primaryUsage) {
        case 'quick_sessions':
          layout.sections = ['quick_prompts', 'recent_favorites', 'continue_where_left'];
          break;
        case 'deep_exploration':
          layout.sections = ['recommended_for_you', 'explore_categories', 'relationship_insights'];
          break;
        case 'routine_user':
          layout.sections = ['daily_prompt', 'streak_tracker', 'milestone_progress'];
          break;
        default:
          layout.sections = ['personalized_recommendations', 'trending_content', 'quick_actions'];
      }

      // Add contextual sections
      if (contextualFactors.timeOfDay === 'morning') {
        layout.sections.unshift('morning_connection');
      } else if (contextualFactors.timeOfDay === 'evening') {
        layout.sections.push('evening_reflection');
      }

      // Generate smart shortcuts based on frequent actions
      layout.shortcuts = this.generateSmartShortcuts(userProfile, behaviorPatterns);
      
      // Add personalized widgets
      layout.widgets = this.generatePersonalizedWidgets(userProfile, contextualFactors);

      return layout;
    } catch (error) {
      console.error('Failed to generate adaptive layout:', error);
      return this.getDefaultLayout();
    }
  }

  /**
   * User Profile Management
   */
  async getUserProfile(userId) {
    try {
      this.lastProfileError = false;
      // Check memory cache first
      const cacheKey = `${this.USER_PROFILE_KEY}_${userId}`;
      if (this.memoryCache.has(cacheKey)) {
        return this.memoryCache.get(cacheKey);
      }

      // Load from persistent storage
      const stored = await AsyncStorage.getItem(cacheKey);
      if (stored) {
        const profile = JSON.parse(stored);
        this.memoryCache.set(cacheKey, profile);
        return profile;
      }

      return null;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      this.lastProfileError = true;
      return null;
    }
  }

  async saveUserProfile(userId, profile) {
    try {
      const cacheKey = `${this.USER_PROFILE_KEY}_${userId}`;
      profile.lastUpdated = Date.now();
      
      // Update memory cache
      this.memoryCache.set(cacheKey, profile);
      
      // Save to persistent storage
      await AsyncStorage.setItem(cacheKey, JSON.stringify(profile));
      
      return true;
    } catch (error) {
      console.error('Failed to save user profile:', error);
      return false;
    }
  }

  async updateUserProfile(userId, updates) {
    try {
      const profile = await this.getUserProfile(userId);
      if (!profile) {
        throw new Error('User profile not found');
      }

      const updatedProfile = {
        ...profile,
        ...updates,
        lastUpdated: Date.now()
      };

      await this.saveUserProfile(userId, updatedProfile);
      
      // Track profile update
      await analytics.trackFeatureUsage('personalization', 'profile_updated', {
        user_id: userId,
        update_keys: Object.keys(updates)
      });

      return updatedProfile;
    } catch (error) {
      console.error('Failed to update user profile:', error);
      throw error;
    }
  }

  /**
   * Behavior Pattern Analysis
   */
  async getBehaviorPatterns(userId) {
    try {
      const cacheKey = `${this.BEHAVIOR_CACHE_KEY}_${userId}`;
      
      // Check cache first
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      // Generate fresh behavior analysis
      const behaviorData = await userBehaviorAnalyzer.analyzeUserBehavior(userId, 30);
      
      // Cache the results
      this.setCache(cacheKey, behaviorData, this.cacheConfig.behaviorPatterns.ttl);
      
      return behaviorData;
    } catch (error) {
      console.error('Failed to get behavior patterns:', error);
      return this.getDefaultBehaviorPatterns();
    }
  }

  /**
   * Context Analysis
   */
  analyzeContext(context, userProfile) {
    const now = new Date();
    
    return {
      timeOfDay: this.getTimeOfDay(now),
      dayOfWeek: this.getDayOfWeek(now),
      season: this.getSeason(now),
      isWeekend: this.isWeekend(now),
      recentActivity: context.recentActivity || null,
      mood: context.mood || null,
      location: context.location || 'home', // Privacy-safe location
      relationshipMilestone: this.checkUpcomingMilestones(userProfile),
      userSegment: this.getUserSegment(userProfile),
      sessionContext: {
        isFirstSessionToday: context.isFirstSessionToday || false,
        timeSinceLastSession: context.timeSinceLastSession || 0,
        sessionNumber: context.sessionNumber || 1
      }
    };
  }

  /**
   * Utility Methods
   */
  calculateRelationshipStage(anniversaryDate) {
    if (!anniversaryDate) return 'unknown';
    
    const daysTogether = Math.floor((Date.now() - new Date(anniversaryDate).getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysTogether < 90) return 'new';
    if (daysTogether < 365) return 'developing';
    if (daysTogether < 1095) return 'established'; // 3 years
    if (daysTogether < 2555) return 'mature'; // 7 years
    return 'long_term';
  }

  getTimeOfDay(date = new Date()) {
    const hour = date.getHours();
    if (hour < 6) return 'night';
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'night';
  }

  getDayOfWeek(date = new Date()) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  }

  isWeekend(date = new Date()) {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  getSeason(date = new Date()) {
    const month = date.getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }

  /**
   * Cache Management
   */
  generateCacheKey(type, userId, context = {}) {
    const contextHash = this.hashObject(context);
    return `${type}_${userId}_${contextHash}`;
  }

  getFromCache(key) {
    const cached = this.memoryCache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    if (cached) {
      this.memoryCache.delete(key);
    }
    return null;
  }

  setCache(key, data, ttl) {
    this.memoryCache.set(key, {
      data,
      expiry: Date.now() + ttl,
      createdAt: Date.now()
    });
  }

  getCacheHitStats() {
    return {
      totalEntries: this.memoryCache.size,
      hitRate: 0.85 // Placeholder - would track actual hits/misses
    };
  }

  normalizeValue(value, min, max) {
    if (typeof value !== 'number' || typeof min !== 'number' || typeof max !== 'number') {
      return 0;
    }
    if (max === min) return 0;
    const normalized = (value - min) / (max - min);
    return Math.min(1, Math.max(0, normalized));
  }

  checkUpcomingMilestones(userProfile) {
    const startDate = userProfile?.relationshipData?.startDate;
    if (!startDate) return null;

    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) return null;

    const now = new Date();
    const currentYear = now.getFullYear();
    const anniversaryThisYear = new Date(
      currentYear,
      start.getMonth(),
      start.getDate()
    );

    const nextAnniversary =
      anniversaryThisYear >= now
        ? anniversaryThisYear
        : new Date(currentYear + 1, start.getMonth(), start.getDate());

    const daysUntil = Math.ceil((nextAnniversary - now) / (24 * 60 * 60 * 1000));
    if (daysUntil < 0 || daysUntil > 30) return null;

    return {
      type: 'anniversary',
      daysUntil,
      date: nextAnniversary.toISOString()
    };
  }

  getUserSegment(userProfile) {
    const sessions = userProfile?.behaviorMetrics?.sessionCount || 0;
    const engagement = userProfile?.behaviorMetrics?.totalEngagementTime || 0;
    if (sessions >= 50 || engagement >= 20000) return 'power';
    if (sessions >= 15 || engagement >= 5000) return 'engaged';
    return 'new';
  }

  hashObject(obj) {
    return JSON.stringify(obj).split('').reduce((hash, char) => {
      hash = ((hash << 5) - hash) + char.charCodeAt(0);
      return hash & hash;
    }, 0).toString(36);
  }

  /**
   * Fallback Methods
   */
  getDefaultExperience(context) {
    return {
      userId: null,
      timestamp: Date.now(),
      context,
      recommendations: this.getDefaultRecommendations(),
      layout: this.getDefaultLayout(),
      notifications: [],
      insights: [],
      metadata: {
        generationTime: 0,
        cacheHits: { totalEntries: 0, hitRate: 0 },
        personalizationScore: 0
      }
    };
  }

  getFallbackExperience(userId, context) {
    return {
      userId,
      timestamp: Date.now(),
      context,
      recommendations: this.getFallbackRecommendations(),
      layout: this.getDefaultLayout(),
      notifications: [],
      insights: [],
      metadata: {
        generationTime: 0,
        cacheHits: { totalEntries: 0, hitRate: 0 },
        personalizationScore: 0.3,
        fallback: true
      }
    };
  }

  getDefaultRecommendations() {
    return [
      {
        id: 'default_1',
        type: 'prompt',
        title: 'Share a favorite memory',
        category: 'connection',
        heatLevel: 1,
        recommendationScore: 0.8,
        reasoning: 'Great for getting started',
        personalizedMetadata: {}
      }
    ];
  }

  getFallbackRecommendations(userProfile = null) {
    const baseRecommendations = this.getDefaultRecommendations();
    
    if (userProfile?.preferences?.contentCategories?.length > 0) {
      // Customize based on known preferences
      return baseRecommendations.map(rec => ({
        ...rec,
        reasoning: `Based on your interest in ${userProfile.preferences.contentCategories[0]}`
      }));
    }
    
    return baseRecommendations;
  }

  getDefaultLayout() {
    return {
      type: 'default',
      timestamp: Date.now(),
      sections: ['featured_content', 'categories', 'recent_activity'],
      shortcuts: ['daily_prompt', 'favorites', 'settings'],
      widgets: ['streak_counter', 'quick_stats']
    };
  }

  getDefaultBehaviorPatterns() {
    return {
      sessions: { totalSessions: 0, averageSessionDuration: 0 },
      engagement: { engagementScore: 50 },
      featureUsage: { uniqueFeaturesUsed: 0 },
      contentPreferences: { preferredCategory: null },
      behaviorPatterns: { timePatterns: {}, engagementTrends: {} }
    };
  }

  /**
   * Cleanup and maintenance
   */
  async clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.memoryCache.entries()) {
      if (value.expiry <= now) {
        this.memoryCache.delete(key);
      }
    }
  }

  async clearUserData(userId) {
    try {
      // Clear memory cache
      for (const key of this.memoryCache.keys()) {
        if (key.includes(userId)) {
          this.memoryCache.delete(key);
        }
      }

      // Clear persistent storage
      const keys = [`${this.USER_PROFILE_KEY}_${userId}`, `${this.BEHAVIOR_CACHE_KEY}_${userId}`];
      await Promise.all(keys.map(key => AsyncStorage.removeItem(key)));
      
      return true;
    } catch (error) {
      console.error('Failed to clear user data:', error);
      return false;
    }
  }
}

export default new PersonalizationEngine();
