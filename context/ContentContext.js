// File: context/ContentContext.js

import React, { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from 'react';
import StorageRouter from '../services/storage/StorageRouter';
import PremiumGatekeeper from '../services/PremiumGatekeeper';
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
  loadPromptResponses,
  savePromptResponse,
} from '../services/content/ContentCoupleService';
import { FALLBACK_PROMPT, getPromptById, getTodayBetweenUsPrompts } from '../utils/contentLoader';
import {
  getDailyContentDateKey,
  getMsUntilNextDailyContentRollover,
} from '../utils/dailyContentDate';
import {
  TODAY_BETWEEN_US_GLOBAL_SCOPE,
  TODAY_BETWEEN_US_HEAT_LEVELS,
  selectTodayBetweenUsPrompt,
} from '../utils/todayBetweenUsRotation';
import { CONTENT_CATALOG_VERSION, TODAY_BETWEEN_US_SCHEDULER_VERSION } from '../utils/contentVersions';
import { storage } from '../utils/storage';
import { dateOnlyToLocalDate, isFutureLocalDate, normalizeDateOnlyKey } from '../utils/dateOnly';

const ContentContext = createContext({});
const DAILY_PROMPT_CACHE_KEY = '@betweenus:cache:dailyPromptSelection';
const DAILY_PROMPT_ASSIGNMENT_VERSION = 1;

function getDailyPromptAssignmentValue(selection) {
  return selection?.value && typeof selection.value === 'object' ? selection.value : selection;
}

function getCachedDailyPrompt(selection, dateKey, scope) {
  const assignment = getDailyPromptAssignmentValue(selection);
  if (
    assignment?.dateKey !== dateKey
    || assignment?.scope !== scope
    || assignment?.schedulerVersion !== TODAY_BETWEEN_US_SCHEDULER_VERSION
    || !assignment?.promptId
  ) {
    return null;
  }

  const prompt = getPromptById(assignment.promptId);
  return prompt?.text ? prompt : null;
}

function getDailyPromptHeatFilters() {
  return {
    minHeatLevel: 1,
    maxHeatLevel: 3,
    heatLevels: TODAY_BETWEEN_US_HEAT_LEVELS,
  };
}

function getCanonicalDailyPromptPool(heatFilters = {}) {
  return getTodayBetweenUsPrompts({
    minHeatLevel: heatFilters.minHeatLevel ?? 1,
    maxHeatLevel: heatFilters.maxHeatLevel ?? 3,
    heatLevels: heatFilters.heatLevels || [],
  })
    .filter((prompt) => prompt?.id && typeof prompt.text === 'string' && prompt.text.trim())
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function selectCanonicalDailyPrompt(dateKey, heatFilters = {}) {
  const promptPool = getCanonicalDailyPromptPool(heatFilters);

  if (!promptPool.length) return FALLBACK_PROMPT;

  return selectTodayBetweenUsPrompt(promptPool, dateKey) || promptPool[0];
}

function buildDailyPromptAssignment({
  dateKey,
  scope,
  promptId,
  source,
  heatFilters = {},
  poolSize = null,
  selectionPoolSize = null,
  excludedPromptIds = [],
  isPremium = false,
} = {}) {
  return {
    assignmentType: 'daily_prompt',
    assignmentVersion: DAILY_PROMPT_ASSIGNMENT_VERSION,
    promptId,
    dateKey,
    scope,
    source: source || 'unknown',
    algorithm: 'today-between-us-global-no-repeat-v3',
    seed: TODAY_BETWEEN_US_GLOBAL_SCOPE,
    contentCatalogVersion: CONTENT_CATALOG_VERSION,
    schedulerVersion: TODAY_BETWEEN_US_SCHEDULER_VERSION,
    heatLevels: heatFilters.heatLevels || TODAY_BETWEEN_US_HEAT_LEVELS,
    minHeatLevel: heatFilters.minHeatLevel ?? 1,
    maxHeatLevel: heatFilters.maxHeatLevel ?? 3,
    poolSize,
    selectionPoolSize,
    excludedPromptIds,
    entitlementTier: isPremium ? 'premium' : 'free',
    assignedAt: new Date().toISOString(),
  };
}

function getEmergencyDailyPrompt(dateKey, _scope, heatFilters = {}) {
  try {
    if (dateKey) {
      const prompt = selectCanonicalDailyPrompt(dateKey, heatFilters);
      if (prompt?.text) return prompt;
    }
  } catch (_) {
    // Keep the emergency path non-throwing so loadTodayPrompt can recover cleanly.
  }

  return FALLBACK_PROMPT;
}

function normalizeRelationshipStartDate(value) {
  return normalizeDateOnlyKey(value);
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
  const { isPremiumEffective: isPremium } = useEntitlements();
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
      fallbackCoupleId: userProfile?.coupleId || userProfile?.couple_id || null,
      allowStoredFallback: false,
      ensureSession: ensureSupabaseSession,
    });
  }, [ensureSupabaseSession, user?.uid, userProfile?.coupleId, userProfile?.couple_id]);

  const applyRelationshipStartDate = useCallback(async (startDate) => {
    const normalizedDate = normalizeRelationshipStartDate(startDate);
    if (!normalizedDate || !user) return false;
    if (isFutureLocalDate(normalizedDate)) return false;

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

  // Calculate relationship duration in days
  const getRelationshipDuration = useCallback(() => {
    if (!userProfile?.relationshipStartDate) return 0;

    const startDate = dateOnlyToLocalDate(userProfile.relationshipStartDate) || new Date(userProfile.relationshipStartDate);
    if (Number.isNaN(startDate.getTime())) return 0;
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

  // Load today's prompt — one fixed global prompt per app day.
  // Caller-specific heat selection must not regenerate a second "today" prompt.
  // We keep the legacy parameter for compatibility with existing callers, but
  // Today Between Us itself is the same morning-safe level 1-3 prompt for everyone.
  const loadTodayPrompt = useCallback(async (_heatLevel = null, _options = {}) => {
      if (loadingPromptRef.current) return todayPrompt;

      let fallbackDateKey = null;
      let fallbackScope = null;
      let fallbackHeatFilters = null;

      try {
        if (!user) {
          throw new Error('User not authenticated');
        }

        loadingPromptRef.current = true;

      const today = getDailyContentDateKey();
      fallbackDateKey = today;
      const activeUserId = user.uid || user.id;
      if (!activeUserId) {
        throw new Error('User id unavailable');
      }
      const scope = TODAY_BETWEEN_US_GLOBAL_SCOPE;
      fallbackScope = scope;

      if (
        todayPrompt?.dateKey === today
        && todayPrompt?._dailyPromptScope === scope
        && todayPrompt?.id
        && typeof todayPrompt?.text === 'string'
        && todayPrompt.text.trim()
      ) {
        PromptAllocator.setDailyPromptId(todayPrompt.id);
        return todayPrompt;
      }

      const cachedPromptSelection = await storage.get(DAILY_PROMPT_CACHE_KEY, null);
      const cachedPrompt = getCachedDailyPrompt(cachedPromptSelection, today, scope);

      if (
        cachedPrompt?.text
      ) {
        const personalizedCachedPrompt = await personalizePrompt({ ...cachedPrompt, dateKey: today });
        const resolvedCachedPrompt = { ...personalizedCachedPrompt, _dailyPromptScope: scope };
        setTodayPrompt(resolvedCachedPrompt);
        PromptAllocator.setDailyPromptId(cachedPrompt.id);
        return resolvedCachedPrompt;
      }

      // Today Between Us is a global morning-safe rotation, not personalized
      // by user/couple scope. That keeps partners and offline devices aligned.
      const dailyHeatFilters = getDailyPromptHeatFilters();
      fallbackHeatFilters = dailyHeatFilters;

      if (dailyHeatFilters.heatLevels.length === 0) {
        throw new Error('No prompts available for your preferences');
      }

      let promptsData = getTodayBetweenUsPrompts(dailyHeatFilters);

      if (promptsData.length === 0) {
        throw new Error('No prompts available for your preferences');
      }

      let selectedPrompt;
      const deterministicPool = [...promptsData]
        .filter((prompt) => prompt?.id && typeof prompt.text === 'string' && prompt.text.trim())
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));

      if (deterministicPool.length > 0) {
        selectedPrompt = selectTodayBetweenUsPrompt(deterministicPool, today);
      }

      // Guard against prompt missing .text so the daily card always has copy.
      if (!selectedPrompt || typeof selectedPrompt.text !== 'string' || !selectedPrompt.text.trim()) {
        const fallback = promptsData
          .find((p) => p && typeof p.text === 'string' && p.text.trim());
        selectedPrompt = fallback || FALLBACK_PROMPT;
      }

      // Reserve this prompt so browse screens won't show it
      PromptAllocator.setDailyPromptId(selectedPrompt.id);

      const assignment = buildDailyPromptAssignment({
        dateKey: today,
        scope,
        promptId: selectedPrompt.id,
        source: 'deterministic_global',
        heatFilters: dailyHeatFilters,
        poolSize: promptsData.length,
        selectionPoolSize: deterministicPool.length,
        excludedPromptIds: [],
        isPremium,
      });

      await storage.set(DAILY_PROMPT_CACHE_KEY, assignment);

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

        const fallbackPrompt = getEmergencyDailyPrompt(
          fallbackDateKey || getDailyContentDateKey(),
          fallbackScope || null,
          fallbackHeatFilters || getDailyPromptHeatFilters()
        );

        const fallbackResolvedDateKey = fallbackDateKey || getDailyContentDateKey();
        const personalizedFallback = await personalizePrompt({ ...fallbackPrompt, dateKey: fallbackResolvedDateKey });
        const fallbackResolved = {
          ...personalizedFallback,
          dateKey: fallbackResolvedDateKey,
          ...(fallbackScope ? { _dailyPromptScope: fallbackScope } : {}),
        };
        setTodayPrompt(fallbackResolved);
        if (fallbackPrompt?.id) {
          PromptAllocator.setDailyPromptId(fallbackPrompt.id);
        }
        return fallbackResolved;
      } finally {
        loadingPromptRef.current = false;
      }
  }, [
    isPremium,
    personalizePrompt,
    todayPrompt,
    user,
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
      if (isFutureLocalDate(normalizedDate)) throw new Error('Anniversary date cannot be in the future');

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
        fallbackCoupleId: userProfile?.coupleId || userProfile?.couple_id || null,
        allowStoredFallback: false,
      });
      if (!coupleId) return;

      const shared = await getSharedAnniversary({
        fallbackCoupleId: coupleId,
        allowStoredFallback: false,
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
  }, [applyRelationshipStartDate, ensureSupabaseSession, syncSharedAnniversary, user?.uid, userProfile?.coupleId, userProfile?.couple_id, userProfile?.relationshipStartDate]);

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
          fallbackCoupleId: userProfile?.coupleId || userProfile?.couple_id || null,
          allowStoredFallback: false,
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
  }, [applyRelationshipStartDate, ensureSupabaseSession, user?.uid, userProfile?.coupleId, userProfile?.couple_id, userProfile?.relationshipStartDate]);

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
        fallbackCoupleId: userProfile?.coupleId || userProfile?.couple_id || null,
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
  }, [isPremium, loadUsageStatus, user, userProfile?.coupleId, userProfile?.couple_id]);

  // Load user's responses
  const loadUserResponses = useCallback(async () => {
    try {
      if (!user) return;
      const responses = await loadPromptResponses(user.uid, {
        fallbackCoupleId: userProfile?.coupleId || userProfile?.couple_id || null,
      });

      setUserResponses(responses);
      return responses;
    } catch (error) {
      if (__DEV__) console.error('Error loading user responses:', error);
      return [];
    }
  }, [user, userProfile?.coupleId, userProfile?.couple_id]);

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
