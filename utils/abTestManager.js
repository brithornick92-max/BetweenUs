// utils/abTestManager.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import abTestingFramework from './abTestingFramework';
import analytics from './analytics';

class ABTestManager {
  constructor() {
    this.ACTIVE_EXPERIMENTS_KEY = 'active_experiments';
    this.EXPERIMENT_RESULTS_KEY = 'experiment_results';
    this.USER_EXPERIMENTS_KEY = 'user_experiments';
  }

  // Initialize A/B testing for user
  async initializeUserExperiments(userId) {
    try {
      // Get or assign user to active experiments
      const activeExperiments = await this.getActiveExperiments();
      const userExperiments = {};

      for (const experimentId of Object.keys(activeExperiments)) {
        const assignment = await abTestingFramework.assignUserToTest(userId, experimentId);
        if (assignment) {
          userExperiments[experimentId] = assignment;
        }
      }

      // Store user experiment assignments
      await AsyncStorage.setItem(
        `${this.USER_EXPERIMENTS_KEY}_${userId}`, 
        JSON.stringify(userExperiments)
      );

      // Track experiment initialization
      await analytics.trackFeatureUsage('ab_test', 'experiments_initialized', {
        user_id: userId,
        experiment_count: Object.keys(userExperiments).length,
        experiments: Object.keys(userExperiments)
      });

      return userExperiments;
    } catch (error) {
      console.error('Failed to initialize user experiments:', error);
      return {};
    }
  }

  // Get active experiments
  async getActiveExperiments() {
    const activeTests = abTestingFramework.getActiveTests();
    return Object.keys(activeTests).reduce((active, testId) => {
      if (activeTests[testId].active) {
        active[testId] = activeTests[testId];
      }
      return active;
    }, {});
  }

  // Get user's experiment variant
  async getUserVariant(userId, experimentId) {
    try {
      const userExperiments = await this.getUserExperiments(userId);
      return userExperiments[experimentId]?.variantId || null;
    } catch (error) {
      console.error('Failed to get user variant:', error);
      return null;
    }
  }

  // Get user experiments
  async getUserExperiments(userId) {
    try {
      const stored = await AsyncStorage.getItem(`${this.USER_EXPERIMENTS_KEY}_${userId}`);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to get user experiments:', error);
      return {};
    }
  }

  // Track experiment event
  async trackExperimentEvent(userId, experimentId, eventType, eventData = {}) {
    try {
      await abTestingFramework.trackTestEvent(userId, experimentId, eventType, eventData);
      
      // Also track in main analytics
      await analytics.trackFeatureUsage('ab_test', 'experiment_event', {
        user_id: userId,
        experiment_id: experimentId,
        event_type: eventType,
        ...eventData
      });
    } catch (error) {
      console.error('Failed to track experiment event:', error);
    }
  }

  // Deploy onboarding anniversary date placement experiment
  async deployAnniversaryPlacementExperiment(userId) {
    const experimentId = 'onboarding_anniversary_placement';
    const variant = await this.getUserVariant(userId, experimentId);
    
    if (!variant) return 'control'; // Default to control if not in experiment
    
    // Track experiment exposure
    await this.trackExperimentEvent(userId, experimentId, 'exposed', {
      variant: variant,
      step: 'onboarding_start'
    });
    
    return variant;
  }

  // Deploy anniversary value proposition experiment
  async deployValuePropositionExperiment(userId) {
    const experimentId = 'anniversary_value_proposition';
    const variant = await this.getUserVariant(userId, experimentId);
    
    if (!variant) return 'control'; // Default to control if not in experiment
    
    // Track experiment exposure
    await this.trackExperimentEvent(userId, experimentId, 'exposed', {
      variant: variant,
      step: 'anniversary_date_step'
    });
    
    return variant;
  }

  // Deploy prompt explanation default experiment
  async deployPromptExplanationExperiment(userId) {
    const experimentId = 'prompt_explanation_default';
    const variant = await this.getUserVariant(userId, experimentId);
    
    if (!variant) return 'collapsed'; // Default to collapsed if not in experiment
    
    // Track experiment exposure
    await this.trackExperimentEvent(userId, experimentId, 'exposed', {
      variant: variant,
      step: 'prompt_view'
    });
    
    return variant;
  }

  // Get experiment configuration for onboarding
  getOnboardingExperimentConfig(variant) {
    const configs = {
      control: {
        anniversaryStep: 3,
        title: 'When did you start dating?',
        description: 'This helps us personalize prompts for your relationship stage',
        showBenefits: true,
        benefitsStyle: 'basic'
      },
      early: {
        anniversaryStep: 1,
        title: 'Let\'s personalize your experience',
        description: 'When did you start dating? This helps us create perfect prompts for your relationship stage',
        showBenefits: true,
        benefitsStyle: 'prominent'
      },
      optional: {
        anniversaryStep: null, // Show as modal after completion
        title: 'Enhance your experience',
        description: 'Add your anniversary date to unlock personalized prompts for your relationship stage',
        showBenefits: true,
        benefitsStyle: 'modal'
      }
    };
    
    return configs[variant] || configs.control;
  }

  // Get value proposition experiment config
  getValuePropositionConfig(variant) {
    const configs = {
      control: {
        title: 'When did you start dating?',
        subtitle: 'This helps us personalize prompts for your relationship stage',
        benefits: [
          'Stage-appropriate conversation starters',
          'Relationship milestone celebrations',
          'Growth-focused prompts that evolve with you'
        ],
        style: 'basic'
      },
      detailed: {
        title: 'Unlock Personalized Prompts',
        subtitle: 'Your anniversary date helps us create the perfect experience for your relationship stage',
        benefits: [
          'Get prompts tailored to new love, growing partnerships, or long-term relationships',
          'Celebrate relationship milestones automatically with special prompts',
          'Access conversation starters that evolve as your relationship deepens',
          'Receive seasonal content that matches your relationship journey'
        ],
        style: 'detailed',
        showExamples: true
      },
      emotional: {
        title: 'Celebrate Your Love Story',
        subtitle: 'Every relationship is unique. Help us honor your journey with personalized prompts',
        benefits: [
          'Prompts that understand where you are in your love story',
          'Celebrate the milestones that matter most to you both',
          'Conversations that grow deeper as your relationship flourishes'
        ],
        style: 'emotional',
        showHeartAnimation: true
      }
    };
    
    return configs[variant] || configs.control;
  }

  // Get prompt explanation experiment config
  getPromptExplanationConfig(variant) {
    const configs = {
      collapsed: {
        defaultExpanded: false,
        showHint: true,
        hintText: 'Tap to see why this prompt is perfect for you'
      },
      expanded: {
        defaultExpanded: true,
        showHint: false,
        autoCollapseAfter: 3 // Auto-collapse after 3 prompts
      }
    };
    
    return configs[variant] || configs.collapsed;
  }

  // Track onboarding experiment events
  async trackOnboardingExperimentEvents(userId, eventType, data = {}) {
    const experiments = await this.getUserExperiments(userId);
    
    // Track for anniversary placement experiment
    if (experiments.onboarding_anniversary_placement) {
      await this.trackExperimentEvent(
        userId, 
        'onboarding_anniversary_placement', 
        eventType, 
        {
          ...data,
          variant: experiments.onboarding_anniversary_placement.variantId
        }
      );
    }
    
    // Track for value proposition experiment
    if (experiments.anniversary_value_proposition) {
      await this.trackExperimentEvent(
        userId, 
        'anniversary_value_proposition', 
        eventType, 
        {
          ...data,
          variant: experiments.anniversary_value_proposition.variantId
        }
      );
    }
  }

  // Track prompt explanation experiment events
  async trackPromptExplanationEvents(userId, eventType, data = {}) {
    const experiments = await this.getUserExperiments(userId);
    
    if (experiments.prompt_explanation_default) {
      await this.trackExperimentEvent(
        userId, 
        'prompt_explanation_default', 
        eventType, 
        {
          ...data,
          variant: experiments.prompt_explanation_default.variantId
        }
      );
    }
  }

  // Analyze experiment results
  async analyzeExperimentResults(experimentId, days = 14) {
    try {
      const analysis = await abTestingFramework.analyzeTestResults(experimentId, days);
      
      if (!analysis) {
        return null;
      }

      // Enhanced analysis with business metrics
      const enhancedAnalysis = {
        ...analysis,
        businessMetrics: await this.calculateBusinessMetrics(experimentId, days),
        recommendations: this.generateExperimentRecommendations(analysis),
        readyForDecision: this.isReadyForDecision(analysis)
      };

      // Track analysis generation
      await analytics.trackFeatureUsage('ab_test', 'results_analyzed', {
        experiment_id: experimentId,
        days_analyzed: days,
        confidence: analysis.confidence,
        winner: analysis.winner
      });

      return enhancedAnalysis;
    } catch (error) {
      console.error('Failed to analyze experiment results:', error);
      return null;
    }
  }

  // Calculate business metrics for experiment
  async calculateBusinessMetrics(experimentId, days) {
    try {
      const analysis = await abTestingFramework.analyzeTestResults(experimentId, days);
      if (!analysis) return {};

      const businessMetrics = {
        conversionRates: {},
        engagementImpact: {},
        retentionImpact: {},
        userSatisfaction: {}
      };

      // Calculate conversion rates for each variant
      Object.keys(analysis.variants).forEach(variantId => {
        const variant = analysis.variants[variantId];
        businessMetrics.conversionRates[variantId] = {
          rate: variant.conversionRate,
          users: variant.uniqueUsers,
          events: variant.totalEvents
        };
      });

      // Calculate engagement impact
      const engagementScores = Object.values(analysis.variants).map(v => v.engagementScore);
      const avgEngagement = engagementScores.reduce((sum, score) => sum + score, 0) / engagementScores.length;
      
      Object.keys(analysis.variants).forEach(variantId => {
        const variant = analysis.variants[variantId];
        businessMetrics.engagementImpact[variantId] = {
          score: variant.engagementScore,
          improvement: ((variant.engagementScore - avgEngagement) / avgEngagement * 100).toFixed(1)
        };
      });

      // Estimate retention impact based on engagement
      Object.keys(analysis.variants).forEach(variantId => {
        const variant = analysis.variants[variantId];
        const retentionEstimate = Math.min(95, 60 + (variant.engagementScore * 10));
        businessMetrics.retentionImpact[variantId] = {
          estimatedRetention: retentionEstimate.toFixed(1),
          confidenceLevel: analysis.confidence > 85 ? 'high' : analysis.confidence > 70 ? 'medium' : 'low'
        };
      });

      // Calculate user satisfaction proxy
      Object.keys(analysis.variants).forEach(variantId => {
        const variant = analysis.variants[variantId];
        const completionRate = (variant.eventTypes.completed || 0) / variant.totalEvents;
        const satisfactionScore = Math.min(100, (completionRate * 80) + (variant.engagementScore * 20));
        
        businessMetrics.userSatisfaction[variantId] = {
          score: satisfactionScore.toFixed(1),
          completionRate: (completionRate * 100).toFixed(1)
        };
      });

      return businessMetrics;
    } catch (error) {
      console.error('Failed to calculate business metrics:', error);
      return {};
    }
  }

  // Generate experiment recommendations
  generateExperimentRecommendations(analysis) {
    const recommendations = [];
    
    if (analysis.confidence >= 95 && analysis.winner) {
      recommendations.push({
        type: 'decision',
        title: 'Ready to Ship Winner',
        description: `Variant "${analysis.winner}" shows statistically significant improvement`,
        action: 'implement_winner',
        priority: 'high'
      });
    } else if (analysis.confidence >= 85 && analysis.winner) {
      recommendations.push({
        type: 'monitor',
        title: 'Continue Monitoring',
        description: `Variant "${analysis.winner}" is leading but needs more data for significance`,
        action: 'continue_test',
        priority: 'medium'
      });
    } else if (analysis.totalResults < 100) {
      recommendations.push({
        type: 'patience',
        title: 'Insufficient Data',
        description: 'Continue test to gather more statistically significant data',
        action: 'wait_for_data',
        priority: 'low'
      });
    } else {
      recommendations.push({
        type: 'inconclusive',
        title: 'No Clear Winner',
        description: 'Consider testing different variants or ending experiment',
        action: 'redesign_test',
        priority: 'medium'
      });
    }
    
    return recommendations;
  }

  // Check if experiment is ready for decision
  isReadyForDecision(analysis) {
    return analysis.confidence >= 95 && 
           analysis.totalResults >= 100 && 
           analysis.winner !== null;
  }

  // Get experiment dashboard data
  async getExperimentDashboard() {
    try {
      const activeExperiments = await this.getActiveExperiments();
      const dashboardData = {};

      for (const experimentId of Object.keys(activeExperiments)) {
        const analysis = await this.analyzeExperimentResults(experimentId, 14);
        dashboardData[experimentId] = {
          experiment: activeExperiments[experimentId],
          analysis,
          status: this.getExperimentStatus(analysis)
        };
      }

      return {
        experiments: dashboardData,
        summary: this.generateDashboardSummary(dashboardData),
        lastUpdated: Date.now()
      };
    } catch (error) {
      console.error('Failed to get experiment dashboard:', error);
      return null;
    }
  }

  // Get experiment status
  getExperimentStatus(analysis) {
    if (!analysis) return 'collecting_data';
    
    if (this.isReadyForDecision(analysis)) return 'ready_for_decision';
    if (analysis.confidence >= 85) return 'trending';
    if (analysis.totalResults < 50) return 'insufficient_data';
    return 'monitoring';
  }

  // Generate dashboard summary
  generateDashboardSummary(dashboardData) {
    const experiments = Object.values(dashboardData);
    
    return {
      totalExperiments: experiments.length,
      readyForDecision: experiments.filter(exp => exp.status === 'ready_for_decision').length,
      trending: experiments.filter(exp => exp.status === 'trending').length,
      needingData: experiments.filter(exp => exp.status === 'insufficient_data').length,
      recommendations: this.generateDashboardRecommendations(experiments)
    };
  }

  // Generate dashboard recommendations
  generateDashboardRecommendations(experiments) {
    const recommendations = [];
    
    const readyExperiments = experiments.filter(exp => exp.status === 'ready_for_decision');
    if (readyExperiments.length > 0) {
      recommendations.push({
        type: 'action_required',
        title: `${readyExperiments.length} Experiment${readyExperiments.length > 1 ? 's' : ''} Ready`,
        description: 'Review results and implement winning variants',
        priority: 'high'
      });
    }
    
    const trendingExperiments = experiments.filter(exp => exp.status === 'trending');
    if (trendingExperiments.length > 0) {
      recommendations.push({
        type: 'monitor',
        title: `${trendingExperiments.length} Experiment${trendingExperiments.length > 1 ? 's' : ''} Trending`,
        description: 'Continue monitoring for statistical significance',
        priority: 'medium'
      });
    }
    
    return recommendations;
  }

  // Export experiment data
  async exportExperimentData() {
    try {
      const [dashboardData, frameworkData] = await Promise.all([
        this.getExperimentDashboard(),
        abTestingFramework.exportTestData()
      ]);
      
      return {
        dashboard: dashboardData,
        framework: frameworkData,
        exportedAt: Date.now()
      };
    } catch (error) {
      console.error('Failed to export experiment data:', error);
      return null;
    }
  }

  // Clean up completed experiments
  async cleanupCompletedExperiments() {
    try {
      await abTestingFramework.cleanupExpiredTests();
      
      // Clean up user experiment assignments for expired tests
      const activeExperiments = await this.getActiveExperiments();
      const activeExperimentIds = Object.keys(activeExperiments);
      
      // Get all stored user experiment keys
      const allKeys = await AsyncStorage.getAllKeys();
      const userExperimentKeys = allKeys.filter(key => key.startsWith(this.USER_EXPERIMENTS_KEY));
      
      // Clean up expired assignments for each user
      for (const key of userExperimentKeys) {
        try {
          const userExperiments = JSON.parse(await AsyncStorage.getItem(key) || '{}');
          const cleanedExperiments = {};
          
          // Keep only active experiments
          Object.keys(userExperiments).forEach(experimentId => {
            if (activeExperimentIds.includes(experimentId)) {
              cleanedExperiments[experimentId] = userExperiments[experimentId];
            }
          });
          
          // Update storage if changes were made
          if (Object.keys(cleanedExperiments).length !== Object.keys(userExperiments).length) {
            await AsyncStorage.setItem(key, JSON.stringify(cleanedExperiments));
          }
        } catch (error) {
          console.error(`Failed to clean up user experiments for key ${key}:`, error);
        }
      }
      
      console.log('🧹 Cleaned up completed A/B test experiments and user assignments');
    } catch (error) {
      console.error('Failed to cleanup completed experiments:', error);
    }
  }
}

export default new ABTestManager();