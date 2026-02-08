// utils/analytics.js
import AsyncStorage from '@react-native-async-storage/async-storage';

class AnalyticsService {
  constructor() {
    this.events = [];
    this.STORAGE_KEY = 'analytics_events';
    this.MAX_STORED_EVENTS = 500;
    this.sessionId = this.generateSessionId();
    this.sessionStart = Date.now();
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // Track relationship duration feature events
  async trackRelationshipDurationEvent(eventName, properties = {}) {
    const event = {
      name: `relationship_duration_${eventName}`,
      properties: {
        ...properties,
        sessionId: this.sessionId,
        timestamp: Date.now(),
        category: 'relationship_duration'
      }
    };

    await this.trackEvent(event);
  }

  // Track user behavior events
  async trackUserBehavior(action, context = {}) {
    const event = {
      name: `user_${action}`,
      properties: {
        ...context,
        sessionId: this.sessionId,
        timestamp: Date.now(),
        category: 'user_behavior'
      }
    };

    await this.trackEvent(event);
  }

  // Track performance events
  async trackPerformance(metric, value, context = {}) {
    const event = {
      name: `performance_${metric}`,
      properties: {
        value,
        ...context,
        sessionId: this.sessionId,
        timestamp: Date.now(),
        category: 'performance'
      }
    };

    await this.trackEvent(event);
  }

  // Track feature usage
  async trackFeatureUsage(feature, action, properties = {}) {
    const event = {
      name: `feature_${feature}_${action}`,
      properties: {
        ...properties,
        sessionId: this.sessionId,
        timestamp: Date.now(),
        category: 'feature_usage'
      }
    };

    await this.trackEvent(event);
  }

  // Generic event tracking
  async trackEvent(event) {
    try {
      this.events.push(event);
      
      // Store events periodically
      if (this.events.length >= 10) {
        await this.flushEvents();
      }
      
      // Log important events for debugging
      if (event.properties.category === 'relationship_duration') {
        console.log('📊 Analytics:', event.name, event.properties);
      }
    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
  }

  // Flush events to storage
  async flushEvents() {
    if (this.events.length === 0) return;

    try {
      const flushedCount = this.events.length;
      const existingEvents = await this.getStoredEvents();
      const allEvents = [...this.events, ...existingEvents].slice(0, this.MAX_STORED_EVENTS);
      
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(allEvents));
      this.events = [];
      
      console.log(`📊 Flushed ${flushedCount} analytics events`);
    } catch (error) {
      console.error('Failed to flush analytics events:', error);
    }
  }

  // Get stored events
  async getStoredEvents() {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to retrieve analytics events:', error);
      return [];
    }
  }

  // Get analytics summary
  async getAnalyticsSummary(hours = 24) {
    try {
      const events = await this.getStoredEvents();
      const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
      const recentEvents = events.filter(e => e.properties.timestamp > cutoffTime);

      const summary = {
        totalEvents: recentEvents.length,
        uniqueSessions: new Set(recentEvents.map(e => e.properties.sessionId)).size,
        eventsByCategory: {},
        relationshipDurationMetrics: {},
        userBehaviorMetrics: {},
        performanceMetrics: {}
      };

      // Categorize events
      recentEvents.forEach(event => {
        const category = event.properties.category;
        summary.eventsByCategory[category] = (summary.eventsByCategory[category] || 0) + 1;

        // Relationship duration specific metrics
        if (category === 'relationship_duration') {
          const metric = event.name.replace('relationship_duration_', '');
          summary.relationshipDurationMetrics[metric] = 
            (summary.relationshipDurationMetrics[metric] || 0) + 1;
        }

        // User behavior metrics
        if (category === 'user_behavior') {
          const action = event.name.replace('user_', '');
          summary.userBehaviorMetrics[action] = 
            (summary.userBehaviorMetrics[action] || 0) + 1;
        }

        // Performance metrics
        if (category === 'performance') {
          const metric = event.name.replace('performance_', '');
          if (!summary.performanceMetrics[metric]) {
            summary.performanceMetrics[metric] = [];
          }
          summary.performanceMetrics[metric].push(event.properties.value);
        }
      });

      // Calculate performance averages
      Object.keys(summary.performanceMetrics).forEach(metric => {
        const values = summary.performanceMetrics[metric];
        summary.performanceMetrics[metric] = {
          count: values.length,
          average: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values)
        };
      });

      return summary;
    } catch (error) {
      console.error('Failed to generate analytics summary:', error);
      return null;
    }
  }

  // Track specific relationship duration events
  async trackAnniversaryDateSet(durationDays, source) {
    await this.trackRelationshipDurationEvent('anniversary_date_set', {
      duration_days: durationDays,
      source, // 'onboarding', 'settings'
      duration_category: this.getDurationCategory(durationDays)
    });
  }

  async trackPromptPersonalization(heatLevel, relationshipDuration, promptCount) {
    await this.trackRelationshipDurationEvent('prompt_personalized', {
      heat_level: heatLevel,
      relationship_duration: relationshipDuration,
      prompt_count: promptCount
    });
  }

  async trackPremiumPersonalization(relationshipDuration, premiumFeature) {
    await this.trackRelationshipDurationEvent('premium_personalized', {
      relationship_duration: relationshipDuration,
      premium_feature: premiumFeature
    });
  }

  async trackOnboardingCompletion(hasAnniversaryDate, relationshipDuration) {
    await this.trackRelationshipDurationEvent('onboarding_completed', {
      has_anniversary_date: hasAnniversaryDate,
      relationship_duration: relationshipDuration
    });
  }

  // Helper method to categorize duration
  getDurationCategory(days) {
    if (days < 30) return 'new';
    if (days < 365) return 'developing';
    if (days < 1095) return 'established';
    if (days < 1825) return 'mature';
    return 'long_term';
  }

  // Clear old events
  async clearOldEvents(days = 30) {
    try {
      const events = await this.getStoredEvents();
      const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
      const recentEvents = events.filter(e => e.properties.timestamp > cutoffTime);
      
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(recentEvents));
      
      console.log(`📊 Cleared ${events.length - recentEvents.length} old analytics events`);
    } catch (error) {
      console.error('Failed to clear old events:', error);
    }
  }

  // Export events for analysis
  async exportEvents() {
    try {
      const events = await this.getStoredEvents();
      return {
        events,
        summary: await this.getAnalyticsSummary(),
        exportedAt: Date.now(),
        sessionId: this.sessionId
      };
    } catch (error) {
      console.error('Failed to export events:', error);
      return null;
    }
  }
}

export default new AnalyticsService();