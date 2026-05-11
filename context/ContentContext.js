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
  getSharedDailyPromptSelection,
  loadPromptResponses,
  savePromptResponse,
  saveSharedDailyPromptSelection,
} from '../services/content/ContentCoupleService';
import { DataLayer } from '../services/localfirst';
import { FALLBACK_PROMPT, getPromptById, getTodayBetweenUsPrompts } from '../utils/contentLoader';
import { getRecentlyCompletedPromptIds } from '../utils/promptHistory';
import {
  getDailyContentDateKey,
  getMsUntilNextDailyContentRollover,
} from '../utils/dailyContentDate';
import { TODAY_BETWEEN_US_HEAT_LEVELS, selectTodayBetweenUsPrompt } from '../utils/todayBetweenUsRotation';
import { CONTENT_CATALOG_VERSION, TODAY_BETWEEN_US_SCHEDULER_VERSION } from '../utils/contentVersions';
import { storage } from '../utils/storage';
import { dateOnlyToLocalDate, isFutureLocalDate, normalizeDateOnlyKey } from '../utils/dateOnly';

const ContentContext = createContext({});
const DAILY_PROMPT_CACHE_KEY = '@betweenus:cache:dailyPromptSelection';
const DAILY_PROMPT_ASSIGNMENT_VERSION = 1;

function getDailyPromptScope(userId, coupleId) {
  return coupleId ? `couple:${coupleId}` : `user:${userId}`;
}

function getSharedPromptId(selection) {
  return selection?.value?.promptId || selection?.promptId || null;
}

function getCachedDailyPrompt(selection, dateKey, scope) {
  if (
    selection?.dateKey !== dateKey
    || selection?.scope !== scope
    || !selection?.promptId
  ) {
    return null;
  }

  const prompt = getPromptById(selection.promptId);
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

function selectCanonicalCoupleDailyPrompt(dateKey, scope, heatFilters = {}) {
  const promptPool = getCanonicalDailyPromptPool(heatFilters);

  if (!promptPool.length) return FALLBACK_PROMPT;

  return selectTodayBetweenUsPrompt(promptPool, dateKey, scope) || promptPool[0];
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
    algorithm: 'today-between-us-no-repeat-v1',
    seed: scope ? `${scope}:today-between-us` : 'default:today-between-us',
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

function getEmergencyDailyPrompt(dateKey, scope, heatFilters = {}) {
  try {
    if (dateKey && scope) {
      const prompt = selectCanonicalCoupleDailyPrompt(dateKey, scope, heatFilters);
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

  const filterTodayPromptsForProfile = useCallback(async (promptPool, profile = {}) => {
    const normalizedPool = Array.isArray(promptPool) ? promptPool.filter(Boolean) : [];
    if (!normalizedPool.length) return [];

    const boundaries = profile?.boundaries || {};
    const hiddenCategories = new Set([
      ...(Array.isArray(profile?.hiddenCategories) ? profile.hiddenCategories : []),
      ...(Array.isArray(boundaries?.hiddenCategories) ? boundaries.hiddenCategories : []),
    ]);
    const pausedIds = new Set([
      ...(Array.isArray(profile?.pausedEntries) ? profile.pausedEntries : []),
      ...(Array.isArray(profile?.pausedPrompts) ? profile.pausedPrompts : []),
      ...(Array.isArray(boundaries?.pausedEntries) ? boundaries.pausedEntries : []),
      ...(Array.isArray(boundaries?.pausedPrompts) ? boundaries.pausedPrompts : []),
    ].filter(Boolean).map(String));

    const boundaryFiltered = normalizedPool.filter((prompt) => {
      if (!prompt) return false;
      if (prompt?.category && hiddenCategories.has(prompt.category)) return false;
      if (prompt?.id && pausedIds.has(String(prompt.id))) return false;
      return true;
    });

    const checks = await Promise.all(
      boundaryFiltered.map(async (prompt) => ({
        prompt,
        ok: await SoftBoundaries.shouldShowPrompt(prompt),
      }))
    );

    return checks.filter((entry) => entry.ok).map((entry) => entry.prompt);
  }, []);

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

  // Load today's prompt — one fixed prompt per scope/day.
  // Caller-specific heat selection must not regenerate a second "today" prompt.
  // We keep the legacy parameter for compatibility with existing callers, but
  // the selection itself is based on the persisted content profile only.
  const loadTodayPrompt = useCallback(async (_heatLevel = null, options = {}) => {
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
      const coupleId = await getActiveCoupleId({
        fallbackCoupleId: userProfile?.coupleId || userProfile?.couple_id || null,
        allowStoredFallback: false,
      });
      const scope = getDailyPromptScope(activeUserId, coupleId);
      fallbackScope = scope;

      if (!coupleId && (
        todayPrompt?.dateKey === today
        && todayPrompt?._dailyPromptScope === scope
        && todayPrompt?.id
        && typeof todayPrompt?.text === 'string'
        && todayPrompt.text.trim()
      )) {
        PromptAllocator.setDailyPromptId(todayPrompt.id);
        return todayPrompt;
      }

      const cachedPromptSelection = await storage.get(DAILY_PROMPT_CACHE_KEY, null);
      const cachedPrompt = getCachedDailyPrompt(cachedPromptSelection, today, scope);

      if (coupleId) {
        const sharedPromptSelection = await getSharedDailyPromptSelection(today, {
          fallbackCoupleId: coupleId,
          allowStoredFallback: false,
          ensureSession: ensureSupabaseSession,
        });
        const sharedPromptId = getSharedPromptId(sharedPromptSelection);
        let sharedPrompt = sharedPromptId ? getPromptById(sharedPromptId) : null;
        let sharedPromptSource = sharedPromptId ? 'supabase' : null;
        let sharedPromptPoolSize = Number(sharedPromptSelection?.value?.poolSize ?? sharedPromptSelection?.poolSize ?? NaN);
        if (!Number.isFinite(sharedPromptPoolSize)) sharedPromptPoolSize = null;
        let sharedPromptSelectionPoolSize = Number(
          sharedPromptSelection?.value?.selectionPoolSize
          ?? sharedPromptSelection?.selectionPoolSize
          ?? NaN
        );
        if (!Number.isFinite(sharedPromptSelectionPoolSize)) {
          sharedPromptSelectionPoolSize = sharedPromptPoolSize;
        }

        if (!sharedPrompt?.text && cachedPrompt?.text) {
          sharedPrompt = cachedPrompt;
          sharedPromptSource = 'daily_cache';
        }

        if (!sharedPrompt?.text) {
          const profile = await loadContentProfile(options?.profileOverride || userProfile || {});
          const heatFilters = getDailyPromptHeatFilters(profile || options?.profileOverride || userProfile || {}, isPremium);
          fallbackHeatFilters = heatFilters;
          const canonicalPool = getCanonicalDailyPromptPool(heatFilters);
          const filteredCanonicalPool = await filterTodayPromptsForProfile(canonicalPool, profile);
          sharedPromptPoolSize = canonicalPool.length;
          sharedPromptSelectionPoolSize = filteredCanonicalPool.length;
          if (filteredCanonicalPool.length === 0) {
            throw new Error('No prompts available for your preferences');
          }
          sharedPrompt = selectTodayBetweenUsPrompt(filteredCanonicalPool, today, scope) || filteredCanonicalPool[0];
          sharedPromptSource = 'deterministic';
        }

        if (!sharedPromptId && sharedPrompt?.id) {
          const assignment = buildDailyPromptAssignment({
            dateKey: today,
            scope,
            promptId: sharedPrompt.id,
            source: sharedPromptSource,
            heatFilters: fallbackHeatFilters || getDailyPromptHeatFilters(),
            poolSize: sharedPromptPoolSize,
            selectionPoolSize: sharedPromptSelectionPoolSize ?? sharedPromptPoolSize,
            isPremium,
          });
          const saved = await saveSharedDailyPromptSelection(today, sharedPrompt.id, activeUserId, {
            fallbackCoupleId: coupleId,
            allowStoredFallback: false,
            ensureSession: ensureSupabaseSession,
            assignment,
          }).catch((error) => {
            if (__DEV__) console.warn('[ContentContext] Shared daily prompt sync failed:', error?.message);
            return false;
          });

          if (saved) {
            const confirmedSelection = await getSharedDailyPromptSelection(today, {
              fallbackCoupleId: coupleId,
              allowStoredFallback: false,
              ensureSession: ensureSupabaseSession,
            }).catch(() => null);
            const confirmedPromptId = getSharedPromptId(confirmedSelection);
            const confirmedPrompt = confirmedPromptId ? getPromptById(confirmedPromptId) : null;

            if (confirmedPrompt?.text) {
              sharedPrompt = confirmedPrompt;
              sharedPromptSource = 'supabase_confirmed';
            }
          }

          if (!saved && !cachedPrompt?.text) {
            setTodayPrompt(null);
            PromptAllocator.setDailyPromptId(null);
            updateWidgetPrompt('').catch(() => {});
            return null;
          }
        }

        if (sharedPrompt?.text) {
          await storage.set(DAILY_PROMPT_CACHE_KEY, buildDailyPromptAssignment({
            dateKey: today,
            scope,
            promptId: sharedPrompt.id,
            source: sharedPromptSource || 'supabase',
            heatFilters: fallbackHeatFilters || getDailyPromptHeatFilters(),
            poolSize: sharedPromptPoolSize,
            selectionPoolSize: sharedPromptSelectionPoolSize ?? sharedPromptPoolSize,
            isPremium,
          }));

          if (
            todayPrompt?.dateKey === today
            && todayPrompt?._dailyPromptScope === scope
            && todayPrompt?.id === sharedPrompt.id
          ) {
            PromptAllocator.setDailyPromptId(sharedPrompt.id);
            return todayPrompt;
          }

          const personalizedSharedPrompt = await personalizePrompt({ ...sharedPrompt, dateKey: today });
          const resolvedSharedPrompt = { ...personalizedSharedPrompt, _dailyPromptScope: scope };
          setTodayPrompt(resolvedSharedPrompt);
          PromptAllocator.setDailyPromptId(sharedPrompt.id);
          updateWidgetPrompt(resolvedSharedPrompt.text || sharedPrompt.text).catch(() => {});
          return resolvedSharedPrompt;
        }
      }

      if (
        cachedPrompt?.text
      ) {
        const personalizedCachedPrompt = await personalizePrompt({ ...cachedPrompt, dateKey: today });
        const resolvedCachedPrompt = { ...personalizedCachedPrompt, _dailyPromptScope: scope };
        setTodayPrompt(resolvedCachedPrompt);
        PromptAllocator.setDailyPromptId(cachedPrompt.id);
        return resolvedCachedPrompt;
      }

      // Load (or refresh) the content profile
      const profile = await loadContentProfile(options?.profileOverride || userProfile || {});

      // Determine the daily pool from the persisted profile only so the day's
      // moment stays fixed regardless of which screen opens it first.
      const dailyHeatFilters = getDailyPromptHeatFilters(
        profile || options?.profileOverride || userProfile || {},
        isPremium
      );
      fallbackHeatFilters = dailyHeatFilters;

      if (dailyHeatFilters.heatLevels.length === 0) {
        throw new Error('No prompts available for your preferences');
      }

      // Check if user can access this heat level
      const accessCheck = await PremiumGatekeeper.canAccessPrompt(activeUserId, dailyHeatFilters.maxHeatLevel, isPremium);
      if (!accessCheck.canAccess) {
        throw new Error(accessCheck.message);
      }

      let promptsData = getTodayBetweenUsPrompts(dailyHeatFilters);

      if (promptsData.length === 0) {
        throw new Error('No prompts available for your preferences');
      }

      promptsData = await filterTodayPromptsForProfile(promptsData, profile);

      if (promptsData.length === 0) {
        throw new Error('No prompts available for your preferences');
      }

      const promptAnswers = typeof DataLayer.getPromptAnswers === 'function'
        ? await DataLayer.getPromptAnswers({ limit: 1000 }).catch(() => [])
        : [];
      const recentlyCompletedPromptIds = getRecentlyCompletedPromptIds(promptAnswers);
      const excludedPromptIds = promptsData
        .filter((prompt) => recentlyCompletedPromptIds.has(prompt?.id))
        .map((prompt) => prompt.id);
      const uncompletedPrompts = promptsData.filter(
        (prompt) => !recentlyCompletedPromptIds.has(prompt?.id)
      );
      const selectionPool = uncompletedPrompts.length > 0 ? uncompletedPrompts : promptsData;

      let selectedPrompt;
      const deterministicPool = [...selectionPool]
        .filter((prompt) => prompt?.id && typeof prompt.text === 'string' && prompt.text.trim())
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));

      if (deterministicPool.length > 0) {
        selectedPrompt = selectTodayBetweenUsPrompt(deterministicPool, today, scope);
      }

      // Guard against prompt missing .text — still respect boundaries
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
        source: 'deterministic',
        heatFilters: dailyHeatFilters,
        poolSize: promptsData.length,
        selectionPoolSize: deterministicPool.length,
        excludedPromptIds,
        isPremium,
      });

      await storage.set(DAILY_PROMPT_CACHE_KEY, assignment);

      if (coupleId) {
        await saveSharedDailyPromptSelection(today, selectedPrompt.id, activeUserId, {
          fallbackCoupleId: coupleId,
          allowStoredFallback: false,
          ensureSession: ensureSupabaseSession,
          assignment,
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
    ensureSupabaseSession,
    filterTodayPromptsForProfile,
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
