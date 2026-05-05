// File: context/ContentContext.js

import React, { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from 'react';
import StorageRouter from '../services/storage/StorageRouter';
import PremiumGatekeeper from '../services/PremiumGatekeeper';
import contentAccessService from '../services/ContentAccessService';
import { updateWidgetPrompt } from '../services/widgetData';
import { SupabaseAuthService } from '../services/supabase/SupabaseAuthService';
import { useAuth } from './AuthContext';
import { useEntitlements } from './EntitlementsContext';
import * as PreferenceEngine from '../services/PreferenceEngine';
import { NicknameEngine, SoftBoundaries } from '../services/PolishEngine';
import PromptAllocator from '../services/PromptAllocator';
import {
  clearPendingSharedAnniversary,
  getActiveCoupleId,
  getPendingSharedAnniversary,
  getSharedAnniversary,
  setPendingSharedAnniversary,
  subscribeToSharedAnniversary,
  syncSharedAnniversary as syncSharedAnniversaryRecord,
} from '../services/couple/CoupleStateService';
import {
  getSharedDailyPromptSelection,
  loadPromptResponses,
  savePromptResponse,
  saveSharedDailyPromptSelection,
} from '../services/content/ContentCoupleService';
import { DataLayer } from '../services/localfirst';
import { CONTENT_TYPES } from '../services/WeeklyContentSetService';
import { resolveWeeklyContentAnchorDate } from '../utils/contentSchedule';
import { FALLBACK_PROMPT, getPromptById } from '../utils/contentLoader';
import { getRestoredDeckItemIds } from '../utils/contentDeckRestores';
import { getRecentlyCompletedPromptIds } from '../utils/promptHistory';
import { buildStableWeeklySet } from '../utils/stableWeeklyContent';
import {
  getDailyContentDateKey,
  getMsUntilNextDailyContentRollover,
} from '../utils/dailyContentDate';
import { storage } from '../utils/storage';

const ContentContext = createContext({});
const DAILY_PROMPT_CACHE_KEY = '@betweenus:cache:dailyPromptSelection';

function getDailyPromptScope(userId, coupleId) {
  return coupleId ? `couple:${coupleId}` : `user:${userId}`;
}

function getStableHash(value) {
  const input = String(value || '');
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function normalizeRelationshipStartDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export const useContent = () => {
  const context = useContext(ContentContext);
  if (!context) {
    throw new Error('useContent must be used within a ContentProvider');
  }
  return context;
};

export const ContentProvider = ({ children }) => {
  const { user, userProfile, updateProfile } = useAuth();
  const { isPremiumEffective: isPremium, premiumStartedAt } = useEntitlements();
  const [prompts] = useState([]);
  const [dates] = useState([]);
  const [todayPrompt, setTodayPrompt] = useState(null);
  const [userResponses, setUserResponses] = useState([]);
  const [loading] = useState(false);
  const loadingPromptRef = useRef(false);
  const [usageStatus, setUsageStatus] = useState(null);
  const [contentProfile, setContentProfile] = useState(null);

  const ensureSupabaseSession = useCallback(async () => {
    try {
      let session = null;

      try {
        session = await SupabaseAuthService.getSession();
      } catch (_) {
        session = null;
      }

      if (session) {
        await StorageRouter.setSupabaseSession(session);
        return session;
      }

      return null;
    } catch (_) {
      return null;
    }
  }, []);

  const syncSharedAnniversary = useCallback(async (startDate) => {
    return syncSharedAnniversaryRecord(startDate, user?.uid, {
      fallbackCoupleId: userProfile?.coupleId || null,
      ensureSession: ensureSupabaseSession,
    });
  }, [ensureSupabaseSession, user?.uid, userProfile?.coupleId]);

  const applyRelationshipStartDate = useCallback(async (startDate) => {
    const normalizedDate = normalizeRelationshipStartDate(startDate);
    if (!normalizedDate || !user) return false;

    await updateProfile({ relationshipStartDate: normalizedDate });
    return true;
  }, [updateProfile, user]);

  // Personalize prompt text with partner/user nicknames
  const personalizePrompt = useCallback(async (prompt) => {
    if (!prompt || typeof prompt.text !== 'string') return prompt;
    try {
      const personalized = await NicknameEngine.personalize(prompt.text);
      return { ...prompt, text: personalized, rawText: prompt.text };
    } catch {
      return prompt;
    }
  }, []);

  // Load the unified content profile (all user preferences)
  const loadContentProfile = useCallback(async (profileSource = userProfile || {}) => {
    try {
      const profile = await PreferenceEngine.getContentProfile(profileSource || {});
      setContentProfile(profile);
      return profile;
    } catch (error) {
      if (__DEV__) console.error('Error loading content profile:', error);
      return null;
    }
  }, [userProfile]);

  const filterVisiblePromptsForProfile = useCallback(async (promptPool, profile) => {
    const normalizedPool = Array.isArray(promptPool) ? promptPool.filter(Boolean) : [];
    if (!normalizedPool.length) return [];

    if (profile) {
      return PreferenceEngine.filterPrompts(normalizedPool, profile);
    }

    const checks = await Promise.all(
      normalizedPool.map(async (prompt) => ({
        prompt,
        ok: await SoftBoundaries.shouldShowPrompt(prompt),
      }))
    );

    return checks.filter((entry) => entry.ok).map((entry) => entry.prompt);
  }, []);

  // Calculate relationship duration in days
  const getRelationshipDuration = useCallback(() => {
    if (!userProfile?.relationshipStartDate) return 0;

    const startDate = new Date(userProfile.relationshipStartDate);
    const today = new Date();
    const diffTime = Math.abs(today - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }, [userProfile?.relationshipStartDate]);

  // Categorize relationship duration for prompt filtering
  const getDurationCategory = useCallback((days) => {
    if (days < 30) return 'new'; // Less than 1 month
    if (days < 365) return 'developing'; // 1 month to 1 year
    if (days < 1095) return 'established'; // 1-3 years
    if (days < 1825) return 'mature'; // 3-5 years
    return 'long_term'; // 5+ years
  }, []);

  // Get relationship duration display text
  const getRelationshipDurationText = useCallback(() => {
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
  }, [getRelationshipDuration]);

  const contentAnchorDate = useMemo(() => resolveWeeklyContentAnchorDate({
    isPremium,
    premiumStartedAt,
    user,
    userProfile,
  }), [isPremium, premiumStartedAt, user, userProfile]);

  // Load today's prompt — one fixed prompt per scope/day.
  // Caller-specific heat selection must not regenerate a second "today" prompt.
  // We keep the legacy parameter for compatibility with existing callers, but
  // the selection itself is based on the persisted content profile only.
  const loadTodayPrompt = useCallback(async (_heatLevel = null, options = {}) => {
      if (loadingPromptRef.current) return todayPrompt;

      try {
        if (!user) {
          throw new Error('User not authenticated');
        }

        loadingPromptRef.current = true;

      const today = getDailyContentDateKey();
      const coupleId = await getActiveCoupleId({
        fallbackCoupleId: userProfile?.coupleId || null,
      });
      const scope = getDailyPromptScope(user.uid, coupleId);

      // Load (or refresh) the content profile
      const profile = await loadContentProfile(options?.profileOverride || userProfile || {});

      // Determine the daily pool from the persisted profile only so the day's
      // moment stays fixed regardless of which screen opens it first.
      const effectiveHeat = contentAccessService.getUserMaxHeatLevel(
        profile || options?.profileOverride || userProfile || {}
      );

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
      };

      let promptsData = await StorageRouter.getPrompts(filters);

      if (promptsData.length === 0) {
        // Fallback: try without duration filter
        promptsData = await StorageRouter.getPrompts({ maxHeatLevel: effectiveHeat });
      }

      if (promptsData.length === 0) {
        throw new Error('No prompts available for your preferences');
      }

      const [promptAnswers, restoredPromptIds] = await Promise.all([
        DataLayer.getPromptAnswers?.({ limit: 1000 }).catch(() => []),
        getRestoredDeckItemIds('prompts'),
      ]);
      const recentlyCompletedPromptIds = getRecentlyCompletedPromptIds(promptAnswers);
      promptsData = promptsData.filter((prompt) => {
        const promptId = String(prompt?.id || '');
        return restoredPromptIds.has(promptId) || !recentlyCompletedPromptIds.has(prompt?.id);
      });

      promptsData = await filterVisiblePromptsForProfile(promptsData, profile);

      const weeklySet = await buildStableWeeklySet(promptsData, {
        contentType: CONTENT_TYPES.PROMPTS,
        userId: user.uid,
        isPremium,
        userSettings: {
          ...(profile || options?.profileOverride || userProfile || {}),
          maxHeat: effectiveHeat,
        },
        userCreatedAt: contentAnchorDate,
        date: new Date(),
      });
      promptsData = weeklySet.items || [];

      if (promptsData.length === 0) {
        throw new Error('No prompts available for your preferences');
      }

      const availablePromptIds = new Set(
        promptsData
          .map((prompt) => String(prompt?.id || ''))
          .filter(Boolean)
      );

      if (
        todayPrompt?.dateKey === today
        && todayPrompt?._dailyPromptScope === scope
        && todayPrompt?.id
        && availablePromptIds.has(String(todayPrompt.id))
      ) {
        PromptAllocator.setDailyPromptId(todayPrompt.id);
        return todayPrompt;
      }

      const cachedPromptSelection = await storage.get(DAILY_PROMPT_CACHE_KEY, null);
      if (
        cachedPromptSelection?.dateKey === today
        && cachedPromptSelection?.scope === scope
        && cachedPromptSelection?.promptId
        && availablePromptIds.has(String(cachedPromptSelection.promptId))
      ) {
        const cachedPrompt = getPromptById(cachedPromptSelection.promptId);
        if (cachedPrompt?.text) {
          const personalizedCachedPrompt = await personalizePrompt({ ...cachedPrompt, dateKey: today });
          const resolvedCachedPrompt = { ...personalizedCachedPrompt, _dailyPromptScope: scope };
          setTodayPrompt(resolvedCachedPrompt);
          PromptAllocator.setDailyPromptId(cachedPrompt.id);
          return resolvedCachedPrompt;
        }
      }

      if (coupleId) {
        const sharedPromptSelection = await getSharedDailyPromptSelection(today, {
          fallbackCoupleId: coupleId,
          ensureSession: ensureSupabaseSession,
        });
        const sharedPromptId = sharedPromptSelection?.value?.promptId;
        if (sharedPromptId && availablePromptIds.has(String(sharedPromptId))) {
          const sharedPrompt = getPromptById(sharedPromptId);
          if (sharedPrompt?.text) {
            await storage.set(DAILY_PROMPT_CACHE_KEY, {
              dateKey: today,
              scope,
              promptId: sharedPromptId,
            });
            const personalizedSharedPrompt = await personalizePrompt({ ...sharedPrompt, dateKey: today });
            const resolvedSharedPrompt = { ...personalizedSharedPrompt, _dailyPromptScope: scope };
            setTodayPrompt(resolvedSharedPrompt);
            PromptAllocator.setDailyPromptId(sharedPrompt.id);
            return resolvedSharedPrompt;
          }
        }
      }

      let selectedPrompt;
      const deterministicPool = [...promptsData]
        .filter((prompt) => prompt?.id && typeof prompt.text === 'string' && prompt.text.trim())
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));

      if (deterministicPool.length > 0) {
        const promptIndex = getStableHash(`${today}:${scope}:daily_prompt`) % deterministicPool.length;
        selectedPrompt = deterministicPool[promptIndex];
      }

      // Guard against prompt missing .text — still respect boundaries
      if (!selectedPrompt || typeof selectedPrompt.text !== 'string' || !selectedPrompt.text.trim()) {
        const fallback = promptsData
          .find((p) => p && typeof p.text === 'string' && p.text.trim());
        selectedPrompt = fallback || FALLBACK_PROMPT;
      }

      // Reserve this prompt so browse screens won't show it
      PromptAllocator.setDailyPromptId(selectedPrompt.id);

      await storage.set(DAILY_PROMPT_CACHE_KEY, {
        dateKey: today,
        scope,
        promptId: selectedPrompt.id,
      });

      if (coupleId) {
        await saveSharedDailyPromptSelection(today, selectedPrompt.id, user.uid, {
          fallbackCoupleId: coupleId,
          ensureSession: ensureSupabaseSession,
        }).catch((error) => {
          if (__DEV__) console.warn('[ContentContext] Shared daily prompt sync failed:', error?.message);
        });
      }

      const personalizedPrompt = await personalizePrompt({ ...selectedPrompt, dateKey: today });
      const resolvedPrompt = { ...personalizedPrompt, _dailyPromptScope: scope };
      setTodayPrompt(resolvedPrompt);
      updateWidgetPrompt(resolvedPrompt.text || selectedPrompt.text).catch(() => {});

      return resolvedPrompt;
    } catch (error) {
        // Don't log as an error if it's just the expected free user limit
        const errorString = String(error?.message || error);
        if (
          errorString.includes('free moment is used')
        ) {
          if (__DEV__) console.log("[ContentContext] Setting fallback daily prompt for free user.");
        } else if (errorString.includes('No prompts available for your preferences')) {
          setTodayPrompt(null);
          updateWidgetPrompt('').catch(() => {});
          return null;
        } else {
          if (__DEV__) console.error("Error loading today's prompt:", error);
        }

        const fallbackPrompt = FALLBACK_PROMPT;

        const personalizedFallback = await personalizePrompt(fallbackPrompt);
        const fallbackResolved = { ...personalizedFallback, dateKey: getDailyContentDateKey() };
        setTodayPrompt(fallbackResolved);
        return fallbackResolved;
      } finally {
        loadingPromptRef.current = false;
      }
  }, [
    contentAnchorDate,
    ensureSupabaseSession,
    filterVisiblePromptsForProfile,
    getDurationCategory,
    getRelationshipDuration,
    isPremium,
    loadContentProfile,
    personalizePrompt,
    todayPrompt,
    user,
    userProfile,
  ]);

  useEffect(() => {
    let timeoutId = null;
    let active = true;

    const scheduleNextPromptRollover = () => {
      if (!active) return;

      const delay = getMsUntilNextDailyContentRollover() + 1000;
      timeoutId = setTimeout(() => {
        if (!active) return;

        const activeDateKey = getDailyContentDateKey();
        setTodayPrompt((currentPrompt) => {
          if (!currentPrompt || currentPrompt.dateKey === activeDateKey) {
            return currentPrompt;
          }

          PromptAllocator.setDailyPromptId(null);
          return null;
        });
        scheduleNextPromptRollover();
      }, delay);
    };

    scheduleNextPromptRollover();

    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Get filtered prompts based on user preferences and premium status
  // Uses PreferenceEngine to rank by season, climate, energy, boundaries
  const getFilteredPrompts = useCallback(async (filters = {}) => {
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

      // Profile unavailable — still respect boundaries
      const checks = await Promise.all(
        rawPrompts.map(async (p) => ({ prompt: p, ok: await SoftBoundaries.shouldShowPrompt(p) }))
      );
      return checks.filter(c => c.ok).map(c => c.prompt);
    } catch (error) {
      if (__DEV__) console.error('Error getting filtered prompts:', error);
      return [];
    }
  }, [contentProfile, getDurationCategory, getRelationshipDuration, isPremium, loadContentProfile, user]);

  // Update relationship start date
  const updateRelationshipStartDate = useCallback(async (startDate) => {
    try {
      if (!user) throw new Error('User not authenticated');

      const normalizedDate = normalizeRelationshipStartDate(startDate);
      if (!normalizedDate) throw new Error('Invalid anniversary date');

      await applyRelationshipStartDate(normalizedDate);
      const synced = await syncSharedAnniversary(normalizedDate);

      if (!synced) {
        await setPendingSharedAnniversary(normalizedDate);
      } else {
        await clearPendingSharedAnniversary();
      }

      return true;
    } catch (error) {
      if (__DEV__) console.error('Error updating relationship start date:', error);
      throw error;
    }
  }, [applyRelationshipStartDate, syncSharedAnniversary, user]);

  useEffect(() => {
    let active = true;

    const reconcileSharedAnniversary = async () => {
      if (!user?.uid) return;

      const coupleId = await getActiveCoupleId({
        fallbackCoupleId: userProfile?.coupleId || null,
      });
      if (!coupleId) return;

      const shared = await getSharedAnniversary({
        fallbackCoupleId: coupleId,
        ensureSession: ensureSupabaseSession,
      });

      if (!active) return;

      const sharedDate = normalizeRelationshipStartDate(shared?.value?.startDate || shared?.value?.relationshipStartDate || shared?.value);
      const localDate = normalizeRelationshipStartDate(userProfile?.relationshipStartDate);

      if (sharedDate) {
        if (sharedDate !== localDate) {
          await applyRelationshipStartDate(sharedDate);
        }
        return;
      }

      if (localDate) {
        await syncSharedAnniversary(localDate);
      }
    };

    reconcileSharedAnniversary();

    return () => {
      active = false;
    };
  }, [applyRelationshipStartDate, ensureSupabaseSession, syncSharedAnniversary, user?.uid, userProfile?.coupleId, userProfile?.relationshipStartDate]);

  useEffect(() => {
    let active = true;

    const flushPendingSharedAnniversary = async () => {
      if (!user?.uid) return;

      const pendingDate = await getPendingSharedAnniversary();
      if (!pendingDate || !active) return;

      const synced = await syncSharedAnniversary(pendingDate);
      if (synced && active) {
        await clearPendingSharedAnniversary();
      }
    };

    flushPendingSharedAnniversary();

    return () => {
      active = false;
    };
  }, [syncSharedAnniversary, user?.uid]);

  useEffect(() => {
    let active = true;
    let unsubscribe = null;

    const startSharedAnniversarySubscription = async () => {
      if (!user?.uid) return;

      try {
        unsubscribe = await subscribeToSharedAnniversary({
          userId: user.uid,
          currentRelationshipStartDate: userProfile?.relationshipStartDate,
          ensureSession: ensureSupabaseSession,
          normalizeRelationshipStartDate,
          onRemoteUpdate: async (nextDate) => {
            if (!active) return;
            await applyRelationshipStartDate(nextDate);
          },
        });
      } catch (err) {
        if (__DEV__) console.warn('[ContentContext] Shared anniversary realtime unavailable:', err?.message);
      }
    };

    startSharedAnniversarySubscription();

    return () => {
      active = false;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [applyRelationshipStartDate, ensureSupabaseSession, user?.uid, userProfile?.relationshipStartDate]);

  // Get date ideas with premium filtering + preference-based ranking
  const getDateIdeas = useCallback(async (filters = {}) => {
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

      // Profile unavailable — still respect boundaries (remove paused dates)
      const checks = await Promise.all(
        dates.map(async (d) => ({ date: d, ok: await SoftBoundaries.shouldShowDate(d.id) }))
      );
      return checks.filter(c => c.ok).map(c => c.date);
    } catch (error) {
      if (__DEV__) console.error('Error getting date ideas:', error);
      throw error;
    }
  }, [contentProfile, isPremium, loadContentProfile, user]);

  // Save user response to Supabase
  const loadUsageStatus = useCallback(async () => {
    try {
      if (!user) return;

      const status = await PremiumGatekeeper.getUserUsageStatus(user.uid, isPremium);
      setUsageStatus(status);
      return status;
    } catch (error) {
      if (__DEV__) console.error('Error loading usage status:', error);
      return null;
    }
  }, [isPremium, user]);

  const saveResponse = useCallback(async (promptId, response, isPrivate = false) => {
    try {
      if (!user || !promptId || !response) return;
      await savePromptResponse(user.uid, promptId, response, {
        isPrivate,
        fallbackCoupleId: userProfile?.coupleId || null,
      });

      // Keep the allocator cache in sync
      PromptAllocator.recordAnswer(promptId);

      // Track usage for freemium limits
      await PremiumGatekeeper.trackPromptUsage(user.uid, promptId, isPremium);

      // Reload usage status
      await loadUsageStatus();

      return true;
    } catch (error) {
      if (__DEV__) console.error('Error saving response:', error);
      throw error;
    }
  }, [isPremium, loadUsageStatus, user, userProfile?.coupleId]);

  // Load user's responses
  const loadUserResponses = useCallback(async () => {
    try {
      if (!user) return;
      const responses = await loadPromptResponses(user.uid, {
        fallbackCoupleId: userProfile?.coupleId || null,
      });

      setUserResponses(responses);
      return responses;
    } catch (error) {
      if (__DEV__) console.error('Error loading user responses:', error);
      return [];
    }
  }, [user, userProfile?.coupleId]);

  // Track date usage
  const trackDateUsage = useCallback(async (dateId) => {
    try {
      if (!user) return;

      await PremiumGatekeeper.trackDateUsage(user.uid, dateId, isPremium);
      await loadUsageStatus(); // Reload usage status
    } catch (error) {
      if (__DEV__) console.error('Error tracking date usage:', error);
      throw error;
    }
  }, [isPremium, loadUsageStatus, user]);

  // Get content (prompts or dates) — delegates to the real filtered fetches
  const getPersonalizedContent = useCallback(async (contentType = 'prompt', options = {}) => {
    try {
      if (!user) return [];
      if (contentType === 'date') return getDateIdeas(options);
      return getFilteredPrompts(options);
    } catch (error) {
      if (__DEV__) console.error('Error getting content:', error);
      return [];
    }
  }, [getDateIdeas, getFilteredPrompts, user]);

  // Load usage status, content profile, and allocator when user changes
  useEffect(() => {
    if (user) {
      PromptAllocator.load(user.uid);
      PreferenceEngine.warmRatingsCache();
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
  }, [loadContentProfile, loadUsageStatus, loadUserResponses, user]);

  const value = useMemo(() => ({
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
  }), [
    prompts, dates, todayPrompt, userResponses, loading, usageStatus,
    contentProfile,
    loadTodayPrompt, getFilteredPrompts, getDateIdeas, saveResponse,
    loadUserResponses, loadUsageStatus, trackDateUsage,
    getRelationshipDuration, getDurationCategory, getRelationshipDurationText,
    updateRelationshipStartDate, getPersonalizedContent, loadContentProfile,
  ]);

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
};
