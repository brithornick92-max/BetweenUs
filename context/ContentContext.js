// File: context/ContentContext.js

import React, { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from 'react';
import StorageRouter from '../services/storage/StorageRouter';
import PremiumGatekeeper from '../services/PremiumGatekeeper';
import { updateWidgetPrompt } from '../services/widgetData';
import E2EEncryption from '../services/e2ee/E2EEncryption';
import SupabaseAuthService from '../services/supabase/SupabaseAuthService';
import { useAuth } from './AuthContext';
import { useEntitlements } from './EntitlementsContext';
import PreferenceEngine from '../services/PreferenceEngine';
import { NicknameEngine, SoftBoundaries } from '../services/PolishEngine';
import PromptAllocator from '../services/PromptAllocator';
import { FALLBACK_PROMPT, getPromptById } from '../utils/contentLoader';
import { STORAGE_KEYS, storage } from '../utils/storage';

const ContentContext = createContext({});
const SHARED_ANNIVERSARY_KEY = 'relationship_start_date';
const PENDING_SHARED_ANNIVERSARY_KEY = 'pending_shared_anniversary_date';
const DAILY_PROMPT_CACHE_KEY = '@betweenus:dailyPromptSelection';
const SHARED_DAILY_PROMPT_KEY_PREFIX = 'daily_prompt';

function getTodayDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getDailyPromptScope(userId, coupleId) {
  return coupleId ? `couple:${coupleId}` : `user:${userId}`;
}

function getSharedDailyPromptKey(dateKey) {
  return `${SHARED_DAILY_PROMPT_KEY_PREFIX}_${dateKey}`;
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
  const { isPremiumEffective: isPremium } = useEntitlements();
  const [prompts, setPrompts] = useState([]);
  const [dates, setDates] = useState([]);
  const [todayPrompt, setTodayPrompt] = useState(null);
  const [userResponses, setUserResponses] = useState([]);
  const [loading, setLoading] = useState(false);
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

      if (!session) {
        try {
          session = await SupabaseAuthService.signInWithStoredCredentials();
        } catch (_) {
          session = null;
        }
      }

      if (session) {
        await StorageRouter.setSupabaseSession(session);
        return session;
      }

      await StorageRouter.setSupabaseSession(null);
      return null;
    } catch (_) {
      return null;
    }
  }, []);

  const syncSharedAnniversary = useCallback(async (startDate) => {
    if (!user?.uid) return false;

    const coupleId = await storage.get(STORAGE_KEYS.COUPLE_ID, null);
    if (!coupleId) return false;

    await ensureSupabaseSession();

    return StorageRouter.upsertCoupleData(
      coupleId,
      SHARED_ANNIVERSARY_KEY,
      { startDate },
      user.uid,
      false,
      'couple_state'
    );
  }, [ensureSupabaseSession, user]);

  const applyRelationshipStartDate = useCallback(async (startDate) => {
    const normalizedDate = normalizeRelationshipStartDate(startDate);
    if (!normalizedDate || !user) return false;

    await updateProfile({ relationshipStartDate: normalizedDate });
    return true;
  }, [updateProfile, user]);

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
      if (__DEV__) console.error('Error loading content profile:', error);
      return null;
    }
  };

  // Load today's prompt — one fixed prompt per scope/day.
  // Caller-specific heat selection must not regenerate a second "today" prompt.
  // We keep the legacy parameter for compatibility with existing callers, but
  // the selection itself is based on the persisted content profile only.
  const loadTodayPrompt = async (heatLevel = null) => {
      if (loadingPromptRef.current) return todayPrompt;

      try {
        if (!user) {
          throw new Error('User not authenticated');
        }

        loadingPromptRef.current = true;

      const today = getTodayDateKey();
      const coupleId = (await storage.get(STORAGE_KEYS.COUPLE_ID, null)) || userProfile?.coupleId || null;
      const scope = getDailyPromptScope(user.uid, coupleId);

      if (todayPrompt?.dateKey === today && todayPrompt?._dailyPromptScope === scope) {
        return todayPrompt;
      }

      const cachedPromptSelection = await storage.get(DAILY_PROMPT_CACHE_KEY, null);
      if (
        cachedPromptSelection?.dateKey === today
        && cachedPromptSelection?.scope === scope
        && cachedPromptSelection?.promptId
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
        await ensureSupabaseSession();
        const sharedPromptSelection = await StorageRouter.getCoupleData(coupleId, getSharedDailyPromptKey(today)).catch(() => null);
        const sharedPromptId = sharedPromptSelection?.value?.promptId;
        if (sharedPromptId) {
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

      // Load (or refresh) the content profile
      const profile = await loadContentProfile();

      // Determine the daily pool from the persisted profile only so the day's
      // moment stays fixed regardless of which screen opens it first.
      const effectiveHeat = profile?.maxHeat || (userProfile?.heatLevelPreference) || 5;

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
        const boundaryChecks = await Promise.all(
          promptsData.map(async (p) => ({ prompt: p, allowed: await SoftBoundaries.shouldShowPrompt(p) }))
        );
        const safePool = boundaryChecks.filter(b => b.allowed).map(b => b.prompt);
        const fallback = (safePool.length > 0 ? safePool : promptsData)
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
        await StorageRouter.upsertCoupleData(
          coupleId,
          getSharedDailyPromptKey(today),
          { promptId: selectedPrompt.id, dateKey: today },
          user.uid,
          false,
          'daily_prompt'
        ).catch((error) => {
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
          errorString.includes('Free users can answer 1 guided prompt') ||
          errorString.includes('Free users can preview 3') ||
          errorString.includes('Heat levels 4 and 5 require premium access')
        ) {
          if (__DEV__) console.log("[ContentContext] Setting fallback daily prompt for free user.");
        } else {
          if (__DEV__) console.error("Error loading today's prompt:", error);
        }

        const fallbackPrompt = FALLBACK_PROMPT;

        const personalizedFallback = await personalizePrompt(fallbackPrompt);
        const fallbackResolved = { ...personalizedFallback, dateKey: getTodayDateKey() };
        setTodayPrompt(fallbackResolved);
        return fallbackResolved;
      } finally {
        loadingPromptRef.current = false;
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

      // Profile unavailable — still respect boundaries
      const checks = await Promise.all(
        rawPrompts.map(async (p) => ({ prompt: p, ok: await SoftBoundaries.shouldShowPrompt(p) }))
      );
      return checks.filter(c => c.ok).map(c => c.prompt);
    } catch (error) {
      if (__DEV__) console.error('Error getting filtered prompts:', error);
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

      const normalizedDate = normalizeRelationshipStartDate(startDate);
      if (!normalizedDate) throw new Error('Invalid anniversary date');

      await applyRelationshipStartDate(normalizedDate);
      const synced = await syncSharedAnniversary(normalizedDate);

      if (!synced) {
        await storage.set(PENDING_SHARED_ANNIVERSARY_KEY, normalizedDate);
      } else {
        await storage.remove(PENDING_SHARED_ANNIVERSARY_KEY);
      }

      return true;
    } catch (error) {
      if (__DEV__) console.error('Error updating relationship start date:', error);
      throw error;
    }
  };

  useEffect(() => {
    let active = true;

    const reconcileSharedAnniversary = async () => {
      if (!user?.uid) return;

      const coupleId = await storage.get(STORAGE_KEYS.COUPLE_ID, null);
      if (!coupleId) return;

      await ensureSupabaseSession();

      const shared = await StorageRouter.getCoupleData(coupleId, SHARED_ANNIVERSARY_KEY).catch((err) => {
        if (__DEV__) console.warn('[ContentContext] Shared anniversary fetch failed:', err?.message);
        return null;
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
  }, [applyRelationshipStartDate, ensureSupabaseSession, syncSharedAnniversary, user?.uid, userProfile?.relationshipStartDate]);

  useEffect(() => {
    let active = true;

    const flushPendingSharedAnniversary = async () => {
      if (!user?.uid) return;

      const pendingDate = await storage.get(PENDING_SHARED_ANNIVERSARY_KEY, null);
      if (!pendingDate || !active) return;

      const synced = await syncSharedAnniversary(pendingDate);
      if (synced && active) {
        await storage.remove(PENDING_SHARED_ANNIVERSARY_KEY);
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

    const subscribeToSharedAnniversary = async () => {
      if (!user?.uid) return;

      const coupleId = await storage.get(STORAGE_KEYS.COUPLE_ID, null);
      if (!coupleId) return;

      try {
        const session = await ensureSupabaseSession();
        if (!session || !active) return;

        const { supabase, TABLES } = await import('../config/supabase');
        if (!supabase || !active) return;

        const channel = supabase
          .channel(`shared_anniversary_${coupleId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: TABLES.COUPLE_DATA,
              filter: `couple_id=eq.${coupleId}`,
            },
            async (payload) => {
              if (!active) return;

              const row = payload?.new;
              if (!row || row.key !== SHARED_ANNIVERSARY_KEY || row.created_by === user.uid) {
                return;
              }

              const nextDate = normalizeRelationshipStartDate(row?.value?.startDate || row?.value?.relationshipStartDate || row?.value);
              const currentDate = normalizeRelationshipStartDate(userProfile?.relationshipStartDate);

              if (!nextDate || nextDate === currentDate) return;

              await applyRelationshipStartDate(nextDate);
            }
          )
          .subscribe();

        unsubscribe = () => supabase.removeChannel(channel);
      } catch (err) {
        if (__DEV__) console.warn('[ContentContext] Shared anniversary realtime unavailable:', err?.message);
      }
    };

    subscribeToSharedAnniversary();

    return () => {
      active = false;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [applyRelationshipStartDate, ensureSupabaseSession, user?.uid, userProfile?.relationshipStartDate]);

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

      // Profile unavailable — still respect boundaries (remove paused dates)
      const checks = await Promise.all(
        dates.map(async (d) => ({ date: d, ok: await SoftBoundaries.shouldShowDate(d.id) }))
      );
      return checks.filter(c => c.ok).map(c => c.date);
    } catch (error) {
      if (__DEV__) console.error('Error getting date ideas:', error);
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
      if (__DEV__) console.error('Error saving response:', error);
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
              if (__DEV__) console.error('Error decrypting response:', error);
              return response;
            }
          }
          return response;
        })
      );

      setUserResponses(decryptedResponses);
      return decryptedResponses;
    } catch (error) {
      if (__DEV__) console.error('Error loading user responses:', error);
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
      if (__DEV__) console.error('Error loading usage status:', error);
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
      if (__DEV__) console.error('Error tracking date usage:', error);
      throw error;
    }
  };

  // Get content (prompts or dates) — delegates to the real filtered fetches
  const getPersonalizedContent = async (contentType = 'prompt', options = {}) => {
    try {
      if (!user) return [];
      if (contentType === 'date') return getDateIdeas(options);
      return getFilteredPrompts(options);
    } catch (error) {
      if (__DEV__) console.error('Error getting content:', error);
      return [];
    }
  };

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
  }, [user, userProfile]);

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
