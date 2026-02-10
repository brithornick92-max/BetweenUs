import React, { createContext, useContext, useEffect, useState } from 'react';
import StorageRouter from '../services/storage/StorageRouter';
import PremiumGatekeeper from '../services/PremiumGatekeeper';
import E2EEncryption from '../services/e2ee/E2EEncryption';
import promptCache from '../utils/promptCache';
import performanceMonitor from '../utils/performanceMonitor';
import analytics from '../utils/analytics';
import recommendationSystem from '../utils/recommendationSystem';
import { useAuth } from './AuthContext';
import { useEntitlements } from './EntitlementsContext';

const ContentContext = createContext({});

export const useContent = () => {
  const context = useContext(ContentContext);
  if (!context) {
    throw new Error('useContent must be used within a ContentProvider');
  }
  return context;
};

export const ContentProvider = ({ children }) => {
  const { user, userProfile } = useAuth();
  const { isPremiumEffective: isPremium } = useEntitlements();
  const [prompts, setPrompts] = useState([]);
  const [dates, setDates] = useState([]);
  const [todayPrompt, setTodayPrompt] = useState(null);
  const [userResponses, setUserResponses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usageStatus, setUsageStatus] = useState(null);
  const [personalizedContent, setPersonalizedContent] = useState([]);
  const [contentSequence, setContentSequence] = useState([]);

  // Load today's prompt with ML-powered personalization
  const loadTodayPrompt = async (heatLevel = 1) => {
    const operationName = 'load_today_prompt';
    performanceMonitor.startTimer(operationName);
    
    try {
      if (!user) {
        throw new Error('User not authenticated');
      }

      setLoading(true);
      
      // Track analytics
      await analytics.trackFeatureUsage('prompt', 'load_today', { heat_level: heatLevel });
      
      // Check if user can access this heat level
      const accessCheck = await PremiumGatekeeper.canAccessPrompt(user.uid, heatLevel, isPremium);
      if (!accessCheck.canAccess) {
        await analytics.trackUserBehavior('premium_gate_hit', { 
          feature: 'prompt', 
          heat_level: heatLevel 
        });
        throw new Error(accessCheck.message);
      }

      // Get relationship duration for filtering
      const relationshipDuration = getRelationshipDuration();
      const durationCategory = getDurationCategory(relationshipDuration);
      
      const filters = {
        heatLevel,
        relationshipDuration: durationCategory,
        limit: 50
      };

      // Monitor cache performance
      const promptsData = await performanceMonitor.monitorCacheOperation(
        'today_prompt',
        () => promptCache.getCachedPrompts(filters),
        () => StorageRouter.getPrompts(filters)
      );

      if (promptsData.length === 0) {
        throw new Error('No prompts available for your preferences');
      }

      // Cache the results if they came from storage
      const cachedResult = await promptCache.getCachedPrompts(filters);
      if (!cachedResult && promptsData.length > 0) {
        await promptCache.cachePrompts(filters, promptsData);
      }

      // Use ML recommendation system to select best prompt
      const recommendations = await recommendationSystem.getRecommendations(
        user.uid,
        promptsData,
        { type: 'prompt', heatLevel, limit: 5 }
      );

      // Select top recommendation or fallback to deterministic selection
      let selectedPrompt;
      if (recommendations.length > 0) {
        // Find first recommendation with a valid .text property
        selectedPrompt = recommendations.find(r => r && typeof r.text === 'string' && r.text.trim())
          || recommendations[0];
      } else {
        const today = new Date().toISOString().split('T')[0];
        const promptIndex = today.split('-').reduce((acc, val) => acc + parseInt(val), 0) % promptsData.length;
        selectedPrompt = promptsData[promptIndex];
      }

      // Guard against prompt missing .text (corrupted data, bad recommendation, etc.)
      if (!selectedPrompt || typeof selectedPrompt.text !== 'string' || !selectedPrompt.text.trim()) {
        const fallback = promptsData.find(p => p && typeof p.text === 'string' && p.text.trim());
        selectedPrompt = fallback || {
          id: 'fallback_1',
          text: 'What\'s one thing you love about our relationship?',
          category: 'emotional',
          heat: 1,
          relationshipDuration: ['universal']
        };
      }

      // Track successful personalization
      await analytics.trackPromptPersonalization(heatLevel, durationCategory, promptsData.length);

      setTodayPrompt(selectedPrompt);
      
      // Record performance metric
      await performanceMonitor.endTimer(operationName, {
        heat_level: heatLevel,
        prompt_count: promptsData.length,
        relationship_duration: durationCategory,
        cached: !!cachedResult,
        ml_recommended: recommendations.length > 0
      });
      
      return selectedPrompt;
    } catch (error) {
      console.error('Error loading today\'s prompt:', error);
      
      // Track error
      await analytics.trackUserBehavior('prompt_load_error', { 
        error: error.message,
        heat_level: heatLevel 
      });
      
      // Record failed performance metric
      await performanceMonitor.endTimer(operationName, {
        error: error.message,
        heat_level: heatLevel
      });
      
      // Provide fallback prompt if storage fails
      const fallbackPrompt = {
        id: 'fallback_1',
        text: 'What\'s one thing you love about our relationship?',
        category: 'emotional',
        heat: 1,
        relationshipDuration: ['universal']
      };
      
      setTodayPrompt(fallbackPrompt);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Get filtered prompts based on user preferences and premium status (with caching)
  const getFilteredPrompts = async (filters = {}) => {
    try {
      if (!user) return [];

      // Add relationship duration filtering
      const relationshipDuration = getRelationshipDuration();
      const durationCategory = getDurationCategory(relationshipDuration);
      
      const enhancedFilters = {
        ...filters,
        relationshipDuration: durationCategory
      };

      // Try cache first
      let cachedPrompts = await promptCache.getCachedPrompts(enhancedFilters);
      
      if (cachedPrompts) {
        // Apply premium filtering to cached results
        const accessiblePrompts = await PremiumGatekeeper.getAccessiblePrompts(user.uid, enhancedFilters);
        return accessiblePrompts.prompts.filter(prompt => 
          cachedPrompts.some(cached => cached.id === prompt.id)
        );
      }

      // Fallback to full fetch
      const accessiblePrompts = await PremiumGatekeeper.getAccessiblePrompts(
        user.uid,
        enhancedFilters,
        isPremium
      );
      
      // Cache the results
      if (accessiblePrompts.prompts.length > 0) {
        await promptCache.cachePrompts(enhancedFilters, accessiblePrompts.prompts);
      }
      
      return accessiblePrompts.prompts;
    } catch (error) {
      console.error('Error getting filtered prompts:', error);
      return [];
    }
  };

  // Calculate relationship duration in days
  const getRelationshipDuration = () => {
    if (!userProfile?.relationshipStartDate) return 0;
    
    const startDate = new Date(userProfile.relationshipStartDate);
    const today = new Date();
    const diffTime = Math.abs(today - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Categorize relationship duration for prompt filtering
  const getDurationCategory = (days) => {
    if (days < 30) return 'new'; // Less than 1 month
    if (days < 365) return 'developing'; // 1 month to 1 year
    if (days < 1095) return 'established'; // 1-3 years
    if (days < 1825) return 'mature'; // 3-5 years
    return 'long_term'; // 5+ years
  };

  // Get relationship duration display text
  const getRelationshipDurationText = () => {
    const days = getRelationshipDuration();
    if (days === 0) return 'Set your anniversary date';
    
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    const remainingDays = days % 30;
    
    if (years > 0) {
      if (months > 0) {
        return `${years} year${years > 1 ? 's' : ''}, ${months} month${months > 1 ? 's' : ''}`;
      }
      return `${years} year${years > 1 ? 's' : ''}`;
    } else if (months > 0) {
      return `${months} month${months > 1 ? 's' : ''}`;
    } else {
      return `${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
    }
  };

  // Update relationship start date with analytics tracking
  const updateRelationshipStartDate = async (startDate) => {
    try {
      if (!user) throw new Error('User not authenticated');
      
      const relationshipDuration = getRelationshipDuration();
      
      await StorageRouter.updateUserDocument(user.uid, { relationshipStartDate: startDate });
      
      // Track anniversary date setting
      await analytics.trackAnniversaryDateSet(relationshipDuration, 'manual_update');
      
      // Reload user profile to get updated data
      // This would typically be handled by the AuthContext
      return true;
    } catch (error) {
      console.error('Error updating relationship start date:', error);
      throw error;
    }
  };

  // Get date ideas with premium filtering
  const getDateIdeas = async (filters = {}) => {
    try {
      if (!user) return [];

      // Check if user can access dates
      const accessCheck = await PremiumGatekeeper.canAccessDate(user.uid, isPremium);
      if (!accessCheck.canAccess) {
        throw new Error(accessCheck.message);
      }

      const dates = await StorageRouter.getDates(filters);
      return dates;
    } catch (error) {
      console.error('Error getting date ideas:', error);
      throw error;
    }
  };

  // Save user response with encryption
  const saveResponse = async (promptId, response, isPrivate = true) => {
    try {
      if (!user || !promptId || !response) return;

      let responseData = {
        content: response,
        timestamp: Date.now(),
        promptId
      };

      // Encrypt private responses
      if (isPrivate) {
        const coupleId = userProfile?.coupleId || null;
        const keyTier = coupleId ? 'couple' : 'device';
        const encryptedPayload = await E2EEncryption.encryptJson(
          responseData, keyTier, coupleId, `prompt_response:${promptId}`
        );
        responseData = {
          encryptedData: encryptedPayload,
          isEncrypted: true,
          encryptedAt: Date.now(),
          promptId,
        };
      }

      await StorageRouter.saveMemory(user.uid, responseData, userProfile?.coupleId || null);
      
      // Track usage for freemium limits
      await PremiumGatekeeper.trackPromptUsage(user.uid, promptId);
      
      // Reload usage status
      await loadUsageStatus();
      
      return true;
    } catch (error) {
      console.error('Error saving response:', error);
      throw error;
    }
  };

  // Load user's responses
  const loadUserResponses = async () => {
    try {
      if (!user) return;

      const responses = await StorageRouter.getUserMemories(user.uid);
      
      // Decrypt encrypted responses
      const decryptedResponses = await Promise.all(
        responses.map(async (response) => {
          if (response.isEncrypted) {
            try {
              const coupleId = userProfile?.coupleId || null;
              const keyTier = coupleId ? 'couple' : 'device';
              const decrypted = await E2EEncryption.decryptJson(
                response.encryptedData, keyTier, coupleId
              );
              return decrypted ? { ...response, decryptedContent: decrypted } : response;
            } catch (error) {
              console.error('Error decrypting response:', error);
              return response;
            }
          }
          return response;
        })
      );

      setUserResponses(decryptedResponses);
      return decryptedResponses;
    } catch (error) {
      console.error('Error loading user responses:', error);
      return [];
    }
  };

  // Load usage status for freemium limits
  const loadUsageStatus = async () => {
    try {
      if (!user) return;

      const status = await PremiumGatekeeper.getUserUsageStatus(user.uid);
      setUsageStatus(status);
      return status;
    } catch (error) {
      console.error('Error loading usage status:', error);
      return null;
    }
  };

  // Track date usage
  const trackDateUsage = async (dateId) => {
    try {
      if (!user) return;

      await PremiumGatekeeper.trackDateUsage(user.uid, dateId);
      await loadUsageStatus(); // Reload usage status
    } catch (error) {
      console.error('Error tracking date usage:', error);
      throw error;
    }
  };

  // Get personalized content recommendations
  const getPersonalizedContent = async (contentType = 'prompt', options = {}) => {
    try {
      if (!user) return [];

      const content = contentType === 'prompt' ? prompts : dates;
      const recommendations = await recommendationSystem.getRecommendations(
        user.uid,
        content,
        { type: contentType, ...options }
      );

      setPersonalizedContent(recommendations);
      return recommendations;
    } catch (error) {
      console.error('Error getting personalized content:', error);
      return [];
    }
  };

  // Load usage status when user changes
  useEffect(() => {
    if (user) {
      loadUsageStatus();
      loadUserResponses();
      
      // Preload common prompts for better performance
      if (userProfile) {
        const relationshipDuration = getRelationshipDuration();
        const durationCategory = getDurationCategory(relationshipDuration);
        
        promptCache.preloadCommonPrompts({
          relationshipDuration: durationCategory
        });
      }
    } else {
      setUsageStatus(null);
      setUserResponses([]);
      setTodayPrompt(null);
    }
  }, [user, userProfile]);

  // Cleanup expired cache periodically
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      promptCache.clearExpiredCache();
    }, 60 * 60 * 1000); // Every hour

    return () => clearInterval(cleanupInterval);
  }, []);

  const value = {
    prompts,
    dates,
    todayPrompt,
    userResponses,
    loading,
    usageStatus,
    personalizedContent,
    contentSequence,
    loadTodayPrompt,
    getFilteredPrompts,
    getDateIdeas,
    saveResponse,
    loadUserResponses,
    loadUsageStatus,
    trackDateUsage,
    getRelationshipDuration,
    getDurationCategory,
    getRelationshipDurationText,
    updateRelationshipStartDate,
    getPersonalizedContent,
  };

  return (
    <ContentContext.Provider value={value}>
      {children}
    </ContentContext.Provider>
  );
};
