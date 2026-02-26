// File: context/ContentContext.js

import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import StorageRouter from '../services/storage/StorageRouter';
import PremiumGatekeeper from '../services/PremiumGatekeeper';
import E2EEncryption from '../services/e2ee/E2EEncryption';
import { useAuth } from './AuthContext';
import { useEntitlements } from './EntitlementsContext';
import PreferenceEngine from '../services/PreferenceEngine';
import { NicknameEngine } from '../services/PolishEngine';
import PromptAllocator from '../services/PromptAllocator';

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
  const [contentProfile, setContentProfile] = useState(null);

  // Personalize prompt text with partner/user nicknames
  const personalizePrompt = async (prompt) => {
    if (!prompt || typeof prompt.text !== 'string') return prompt;
    try {
      const personalized = await NicknameEngine.personalize(prompt.text);
      return { ...prompt, text: personalized, rawText: prompt.text };
    } catch {
      return prompt;
    }
  };

  // Load the unified content profile (all user preferences)
  const loadContentProfile = async () => {
    try {
      const profile = await PreferenceEngine.getContentProfile(userProfile || {});
      setContentProfile(profile);
      return profile;
    } catch (error) {
      console.error('Error loading content profile:', error);
      return null;
    }
  };

  // Load today's prompt — preference-aware
  // If heatLevel is explicitly passed (e.g. from HeatLevelScreen), use it.
  // Otherwise, use the user's full content profile (season, energy, boundaries, etc.)
  const loadTodayPrompt = async (heatLevel = null) => {
    try {
      if (!user) {
        throw new Error('User not authenticated');
      }

      setLoading(true);

      // Load (or refresh) the content profile
      const profile = await loadContentProfile();

      // Determine effective heat level
      const effectiveHeat = heatLevel || profile?.maxHeat || (userProfile?.heatLevelPreference) || 5;

      // Check if user can access this heat level
      const accessCheck = await PremiumGatekeeper.canAccessPrompt(user.uid, effectiveHeat, isPremium);
      if (!accessCheck.canAccess) {
        throw new Error(accessCheck.message);
      }

      // Get relationship duration for filtering
      const relationshipDuration = getRelationshipDuration();
      const durationCategory = getDurationCategory(relationshipDuration);

      const filters = {
        maxHeatLevel: effectiveHeat,
        relationshipDuration: durationCategory,
        limit: 100,
      };

      let promptsData = await StorageRouter.getPrompts(filters);

      if (promptsData.length === 0) {
        // Fallback: try without duration filter
        promptsData = await StorageRouter.getPrompts({ maxHeatLevel: effectiveHeat, limit: 100 });
      }

      if (promptsData.length === 0) {
        throw new Error('No prompts available for your preferences');
      }

      // Use PreferenceEngine to rank prompts by all preferences
      const today = new Date().toISOString().split('T')[0];
      const [curYear, curMonth] = today.split('-');
      const monthKey = `${curYear}-${curMonth}`;
      let selectedPrompt;

      // ── Load this month's prompt history to prevent repeats ──
      let monthShownIds = [];
      try {
        const raw = await AsyncStorage.getItem('month_prompt_ids');
        if (raw) {
          const parsed = JSON.parse(raw);
          // Reset history when the month rolls over
          if (parsed.month === monthKey && Array.isArray(parsed.ids)) {
            monthShownIds = parsed.ids;
          }
        }
      } catch (e) { /* fallback to empty shown IDs */ }
      const excludeIds = new Set(monthShownIds);

      if (profile) {
        // Smart selection: filter + rank by season, climate, energy, tone
        const profileForHeat = { ...profile, maxHeat: effectiveHeat };
        selectedPrompt = PreferenceEngine.selectDailyPrompt(promptsData, profileForHeat, today, excludeIds);
      }

      // Fallback to hash-based selection if PreferenceEngine returns null
      if (!selectedPrompt) {
        // Remove already-shown prompts this month
        const freshPool = promptsData.filter(p => !excludeIds.has(p.id));
        const pool = freshPool.length > 0 ? freshPool : promptsData;
        const [y, m, d] = today.split('-').map(Number);
        const dateHash = ((y * 31 + m) * 31 + d) ^ (y * 7 + m * 13 + d * 37);
        let promptIndex = Math.abs(dateHash) % pool.length;
        selectedPrompt = pool[promptIndex];
      }

      // Guard against prompt missing .text
      if (!selectedPrompt || typeof selectedPrompt.text !== 'string' || !selectedPrompt.text.trim()) {
        const fallback = promptsData.find((p) => p && typeof p.text === 'string' && p.text.trim());
        selectedPrompt =
          fallback || {
            id: 'fallback_1',
            text: "What's one thing you love about our relationship?",
            category: 'emotional',
            heat: 1,
            relationshipDuration: ['universal'],
          };
      }

      // Reserve this prompt so browse screens won't show it
      PromptAllocator.setDailyPromptId(selectedPrompt.id);

      setTodayPrompt(await personalizePrompt(selectedPrompt));

      // Save selected prompt id to month history to prevent repeats this month
      try {
        if (!monthShownIds.includes(selectedPrompt.id)) {
          monthShownIds.push(selectedPrompt.id);
        }
        await AsyncStorage.setItem(
          'month_prompt_ids',
          JSON.stringify({ month: monthKey, ids: monthShownIds })
        );
        // Keep legacy key for backward compat
        await AsyncStorage.setItem('last_prompt_id', selectedPrompt.id);
      } catch (e) {
        console.warn('[ContentContext] Failed to persist prompt selection:', e?.message);
      }

      return selectedPrompt;
    } catch (error) {
      console.error("Error loading today's prompt:", error);

      const fallbackPrompt = {
        id: 'fallback_1',
        text: "What's one thing you love about our relationship?",
        category: 'emotional',
        heat: 1,
        relationshipDuration: ['universal'],
      };

      setTodayPrompt(await personalizePrompt(fallbackPrompt));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Get filtered prompts based on user preferences and premium status
  // Uses PreferenceEngine to rank by season, climate, energy, boundaries
  const getFilteredPrompts = async (filters = {}) => {
    try {
      if (!user) return [];

      // Add relationship duration filtering
      const relationshipDuration = getRelationshipDuration();
      const durationCategory = getDurationCategory(relationshipDuration);

      const enhancedFilters = {
        ...filters,
        relationshipDuration: durationCategory,
      };

      const accessiblePrompts = await PremiumGatekeeper.getAccessiblePrompts(
        user.uid,
        enhancedFilters,
        isPremium
      );

      const rawPrompts = accessiblePrompts.prompts || [];

      // Apply PreferenceEngine ranking
      const profile = contentProfile || await loadContentProfile();
      if (profile && rawPrompts.length > 0) {
        return PreferenceEngine.filterPrompts(rawPrompts, profile);
      }

      return rawPrompts;
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

  // Update relationship start date
  const updateRelationshipStartDate = async (startDate) => {
    try {
      if (!user) throw new Error('User not authenticated');

      await StorageRouter.updateUserDocument(user.uid, { relationshipStartDate: startDate });

      return true;
    } catch (error) {
      console.error('Error updating relationship start date:', error);
      throw error;
    }
  };

  // Get date ideas with premium filtering + preference-based ranking
  const getDateIdeas = async (filters = {}) => {
    try {
      if (!user) return [];

      // Check if user can access dates
      const accessCheck = await PremiumGatekeeper.canAccessDate(user.uid, isPremium);
      if (!accessCheck.canAccess) {
        throw new Error(accessCheck.message);
      }

      const dates = await StorageRouter.getDates(filters);

      // Apply preference-based ranking (season, climate, dimensions)
      const profile = contentProfile || await loadContentProfile();
      if (profile && dates.length > 0) {
        const dims = {};
        if (filters.heat) dims.heat = filters.heat;
        if (filters.load) dims.load = filters.load;
        if (filters.style) dims.style = filters.style;
        return PreferenceEngine.filterDatesWithProfile(dates, profile, Object.keys(dims).length ? dims : null);
      }

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
        promptId,
      };

      // Encrypt private responses
      if (isPrivate) {
        const coupleId = userProfile?.coupleId || null;
        const keyTier = coupleId ? 'couple' : 'device';
        const encryptedPayload = await E2EEncryption.encryptJson(
          responseData,
          keyTier,
          coupleId,
          `prompt_response:${promptId}`
        );
        responseData = {
          encryptedData: encryptedPayload,
          isEncrypted: true,
          encryptedAt: Date.now(),
          promptId,
        };
      }

      await StorageRouter.saveMemory(user.uid, responseData, userProfile?.coupleId || null);

      // Keep the allocator cache in sync
      PromptAllocator.recordAnswer(promptId);

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
        (responses || []).map(async (response) => {
          if (response.isEncrypted) {
            try {
              const coupleId = userProfile?.coupleId || null;
              const keyTier = coupleId ? 'couple' : 'device';
              const decrypted = await E2EEncryption.decryptJson(
                response.encryptedData,
                keyTier,
                coupleId
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

  // Get content (prompts or dates)
  const getPersonalizedContent = async (contentType = 'prompt', options = {}) => {
    try {
      if (!user) return [];
      return contentType === 'prompt' ? prompts : dates;
    } catch (error) {
      console.error('Error getting content:', error);
      return [];
    }
  };

  // Load usage status, content profile, and allocator when user changes
  useEffect(() => {
    if (user) {
      PromptAllocator.load(user.uid);
      loadUsageStatus();
      loadUserResponses();
      loadContentProfile();
    } else {
      PromptAllocator.reset();
      setUsageStatus(null);
      setUserResponses([]);
      setTodayPrompt(null);
      setContentProfile(null);
    }
  }, [user, userProfile]);

  const value = {
    prompts,
    dates,
    todayPrompt,
    userResponses,
    loading,
    usageStatus,
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
    contentProfile,
    loadContentProfile,
    promptAllocator: PromptAllocator,
  };

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
};
