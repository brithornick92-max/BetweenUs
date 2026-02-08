// utils/feedbackCollector.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import analytics from './analytics';

class FeedbackCollector {
  constructor() {
    this.FEEDBACK_KEY = 'user_feedback';
    this.FEEDBACK_PROMPTS_KEY = 'feedback_prompts_shown';
    this.MAX_STORED_FEEDBACK = 100;
  }

  // Collect relationship duration feature feedback
  async collectRelationshipDurationFeedback(userId, feedback) {
    const feedbackData = {
      id: `rd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      userId,
      type: 'relationship_duration',
      timestamp: Date.now(),
      ...feedback
    };

    await this.storeFeedback(feedbackData);
    
    // Track feedback in analytics
    await analytics.trackUserBehavior('feedback_submitted', {
      feedback_type: 'relationship_duration',
      rating: feedback.rating,
      category: feedback.category
    });

    return feedbackData;
  }

  // Collect prompt personalization feedback
  async collectPromptPersonalizationFeedback(userId, promptId, feedback) {
    const feedbackData = {
      id: `pp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      userId,
      promptId,
      type: 'prompt_personalization',
      timestamp: Date.now(),
      ...feedback
    };

    await this.storeFeedback(feedbackData);
    
    // Track feedback in analytics
    await analytics.trackUserBehavior('prompt_feedback_submitted', {
      prompt_id: promptId,
      relevance_rating: feedback.relevanceRating,
      personalization_helpful: feedback.personalizationHelpful
    });

    return feedbackData;
  }

  // Collect premium experience feedback
  async collectPremiumFeedback(userId, feedback) {
    const feedbackData = {
      id: `prem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      userId,
      type: 'premium_experience',
      timestamp: Date.now(),
      ...feedback
    };

    await this.storeFeedback(feedbackData);
    
    // Track feedback in analytics
    await analytics.trackUserBehavior('premium_feedback_submitted', {
      satisfaction_rating: feedback.satisfactionRating,
      value_rating: feedback.valueRating,
      feature_most_valuable: feedback.mostValuableFeature
    });

    return feedbackData;
  }

  // Collect onboarding feedback
  async collectOnboardingFeedback(userId, feedback) {
    const feedbackData = {
      id: `onb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      userId,
      type: 'onboarding',
      timestamp: Date.now(),
      ...feedback
    };

    await this.storeFeedback(feedbackData);
    
    // Track feedback in analytics
    await analytics.trackUserBehavior('onboarding_feedback_submitted', {
      clarity_rating: feedback.clarityRating,
      anniversary_date_helpful: feedback.anniversaryDateHelpful,
      completion_difficulty: feedback.completionDifficulty
    });

    return feedbackData;
  }

  // Store feedback to local storage
  async storeFeedback(feedback) {
    try {
      const existingFeedback = await this.getStoredFeedback();
      const updatedFeedback = [feedback, ...existingFeedback].slice(0, this.MAX_STORED_FEEDBACK);
      
      await AsyncStorage.setItem(this.FEEDBACK_KEY, JSON.stringify(updatedFeedback));
      
      console.log('📝 Feedback stored:', feedback.type, feedback.id);
    } catch (error) {
      console.error('Failed to store feedback:', error);
    }
  }

  // Get stored feedback
  async getStoredFeedback() {
    try {
      const stored = await AsyncStorage.getItem(this.FEEDBACK_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to retrieve feedback:', error);
      return [];
    }
  }

  // Check if user should be prompted for feedback
  async shouldPromptForFeedback(userId, feedbackType, cooldownHours = 24) {
    try {
      const promptsShown = await this.getFeedbackPromptsShown(userId);
      const lastPrompt = promptsShown[feedbackType];
      
      if (!lastPrompt) return true;
      
      const timeSinceLastPrompt = Date.now() - lastPrompt;
      const cooldownMs = cooldownHours * 60 * 60 * 1000;
      
      return timeSinceLastPrompt > cooldownMs;
    } catch (error) {
      console.error('Failed to check feedback prompt eligibility:', error);
      return false;
    }
  }

  // Mark feedback prompt as shown
  async markFeedbackPromptShown(userId, feedbackType) {
    try {
      const promptsShown = await this.getFeedbackPromptsShown(userId);
      promptsShown[feedbackType] = Date.now();
      
      await AsyncStorage.setItem(
        `${this.FEEDBACK_PROMPTS_KEY}_${userId}`, 
        JSON.stringify(promptsShown)
      );
    } catch (error) {
      console.error('Failed to mark feedback prompt as shown:', error);
    }
  }

  // Get feedback prompts shown for user
  async getFeedbackPromptsShown(userId) {
    try {
      const stored = await AsyncStorage.getItem(`${this.FEEDBACK_PROMPTS_KEY}_${userId}`);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to get feedback prompts shown:', error);
      return {};
    }
  }

  // Generate feedback summary
  async getFeedbackSummary(days = 30) {
    try {
      const feedback = await this.getStoredFeedback();
      const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
      const recentFeedback = feedback.filter(f => f.timestamp > cutoffTime);

      const summary = {
        totalFeedback: recentFeedback.length,
        feedbackByType: {},
        averageRatings: {},
        commonIssues: [],
        positiveHighlights: []
      };

      // Categorize feedback by type
      recentFeedback.forEach(f => {
        summary.feedbackByType[f.type] = (summary.feedbackByType[f.type] || 0) + 1;
      });

      // Calculate average ratings by type
      const ratingFields = {
        relationship_duration: ['rating'],
        prompt_personalization: ['relevanceRating'],
        premium_experience: ['satisfactionRating', 'valueRating'],
        onboarding: ['clarityRating']
      };

      Object.keys(ratingFields).forEach(type => {
        const typeFeedback = recentFeedback.filter(f => f.type === type);
        if (typeFeedback.length === 0) return;

        summary.averageRatings[type] = {};
        
        ratingFields[type].forEach(field => {
          const ratings = typeFeedback
            .map(f => f[field])
            .filter(rating => rating !== undefined && rating !== null);
          
          if (ratings.length > 0) {
            summary.averageRatings[type][field] = 
              ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
          }
        });
      });

      // Identify common issues (ratings below 3)
      recentFeedback.forEach(f => {
        const lowRatings = [];
        
        if (f.rating && f.rating < 3) lowRatings.push('overall_rating');
        if (f.relevanceRating && f.relevanceRating < 3) lowRatings.push('prompt_relevance');
        if (f.satisfactionRating && f.satisfactionRating < 3) lowRatings.push('premium_satisfaction');
        if (f.valueRating && f.valueRating < 3) lowRatings.push('premium_value');
        if (f.clarityRating && f.clarityRating < 3) lowRatings.push('onboarding_clarity');
        
        if (lowRatings.length > 0 && f.comments) {
          summary.commonIssues.push({
            type: f.type,
            issues: lowRatings,
            comment: f.comments,
            timestamp: f.timestamp
          });
        }
      });

      // Identify positive highlights (ratings 4+)
      recentFeedback.forEach(f => {
        const highRatings = [];
        
        if (f.rating && f.rating >= 4) highRatings.push('overall_rating');
        if (f.relevanceRating && f.relevanceRating >= 4) highRatings.push('prompt_relevance');
        if (f.satisfactionRating && f.satisfactionRating >= 4) highRatings.push('premium_satisfaction');
        if (f.valueRating && f.valueRating >= 4) highRatings.push('premium_value');
        if (f.clarityRating && f.clarityRating >= 4) highRatings.push('onboarding_clarity');
        
        if (highRatings.length > 0 && f.comments) {
          summary.positiveHighlights.push({
            type: f.type,
            strengths: highRatings,
            comment: f.comments,
            timestamp: f.timestamp
          });
        }
      });

      return summary;
    } catch (error) {
      console.error('Failed to generate feedback summary:', error);
      return null;
    }
  }

  // Get feedback prompts for specific scenarios
  getFeedbackPrompts() {
    return {
      relationshipDuration: {
        trigger: 'after_setting_anniversary_date',
        title: 'How was setting your anniversary date?',
        questions: [
          {
            id: 'rating',
            type: 'rating',
            question: 'How would you rate the overall experience?',
            scale: 5
          },
          {
            id: 'clarity',
            type: 'rating',
            question: 'How clear were the instructions?',
            scale: 5
          },
          {
            id: 'value',
            type: 'rating',
            question: 'How valuable do you find the personalized prompts?',
            scale: 5
          },
          {
            id: 'comments',
            type: 'text',
            question: 'Any suggestions for improvement?',
            optional: true
          }
        ]
      },
      
      promptPersonalization: {
        trigger: 'after_viewing_personalized_prompts',
        title: 'How relevant were these prompts?',
        questions: [
          {
            id: 'relevanceRating',
            type: 'rating',
            question: 'How relevant were the prompts to your relationship stage?',
            scale: 5
          },
          {
            id: 'personalizationHelpful',
            type: 'boolean',
            question: 'Did the personalization make the prompts more engaging?'
          },
          {
            id: 'comments',
            type: 'text',
            question: 'What would make the prompts even better?',
            optional: true
          }
        ]
      },
      
      premiumExperience: {
        trigger: 'after_premium_feature_usage',
        title: 'How is your Premium experience?',
        questions: [
          {
            id: 'satisfactionRating',
            type: 'rating',
            question: 'How satisfied are you with Premium features?',
            scale: 5
          },
          {
            id: 'valueRating',
            type: 'rating',
            question: 'How would you rate the value for money?',
            scale: 5
          },
          {
            id: 'mostValuableFeature',
            type: 'choice',
            question: 'Which Premium feature do you find most valuable?',
            options: [
              'All Heat Levels',
              'Memory Vault',
              'Dark Mode',
              'Cloud Sanctuary',
              'Unlimited Prompts',
              'Advanced Privacy'
            ]
          },
          {
            id: 'comments',
            type: 'text',
            question: 'What Premium features would you like to see added?',
            optional: true
          }
        ]
      },
      
      onboarding: {
        trigger: 'after_onboarding_completion',
        title: 'How was your onboarding experience?',
        questions: [
          {
            id: 'clarityRating',
            type: 'rating',
            question: 'How clear was the onboarding process?',
            scale: 5
          },
          {
            id: 'anniversaryDateHelpful',
            type: 'boolean',
            question: 'Was setting your anniversary date helpful for personalization?'
          },
          {
            id: 'completionDifficulty',
            type: 'choice',
            question: 'How difficult was it to complete onboarding?',
            options: ['Very Easy', 'Easy', 'Moderate', 'Difficult', 'Very Difficult']
          },
          {
            id: 'comments',
            type: 'text',
            question: 'How could we improve the onboarding experience?',
            optional: true
          }
        ]
      }
    };
  }

  // Export feedback data
  async exportFeedbackData() {
    try {
      const [
        allFeedback,
        summary
      ] = await Promise.all([
        this.getStoredFeedback(),
        this.getFeedbackSummary(30)
      ]);

      return {
        feedback: allFeedback,
        summary,
        prompts: this.getFeedbackPrompts(),
        exportedAt: Date.now()
      };
    } catch (error) {
      console.error('Failed to export feedback data:', error);
      return null;
    }
  }

  // Clear old feedback
  async clearOldFeedback(days = 90) {
    try {
      const feedback = await this.getStoredFeedback();
      const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
      const recentFeedback = feedback.filter(f => f.timestamp > cutoffTime);
      
      await AsyncStorage.setItem(this.FEEDBACK_KEY, JSON.stringify(recentFeedback));
      
      console.log(`📝 Cleared ${feedback.length - recentFeedback.length} old feedback entries`);
    } catch (error) {
      console.error('Failed to clear old feedback:', error);
    }
  }
}

export default new FeedbackCollector();