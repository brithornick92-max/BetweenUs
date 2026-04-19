/**
 * EntitlementsContext — THE single source of truth for "what can the user do?"
 *
 * Merges three inputs:
 *   1. RevenueCat  → isPremiumSelf  (this device/user paid)
 *   2. Supabase    → isPremiumCouple (couple space is premium-enabled)
 *   3. Feature map → per-feature flags derived from isPremiumEffective
 *
 * Exposes:
 *   • isPremiumEffective (boolean)
 *   • premiumSource ('self' | 'partner' | 'none')
 *   • features.<featureName> (boolean)
 *   • limits.promptsPerDay, limits.dateIdeasPerDay, etc.
 *   • usage helpers (canConsumePrompt, recordPromptUsage, …)
 *   • showPaywall(featureId) — centralized paywall trigger
 *
 * Every screen/component should import `useEntitlements()` instead of
 * reaching for SubscriptionContext or PremiumGatekeeper directly.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSubscription } from './SubscriptionContext';
import { useAuth } from './AuthContext';
import { supabase } from '../config/supabase';
import UsageLimitsService from '../services/UsageLimitsService';
import AnalyticsService from '../services/AnalyticsService';
import { STORAGE_KEYS, storage } from '../utils/storage';
import {
  PremiumFeature,
  PremiumSource,
  FREE_LIMITS,
  PREMIUM_LIMITS,
  UsageEventType,
  FEATURE_META,
  GuardBehavior,
  getLimitsForTier,
  getAccessibleHeatLevels,
  normalizePremiumFeatureId,
} from '../utils/featureFlags';
import WinBackNudges from '../services/WinBackNudges';

// ─── Local cache keys for couple premium ─────────────────────────────────────
const COUPLE_PREMIUM_CACHE_KEY = '@betweenus:couplePremiumCache';
const GRACE_WINDOW_MS = 72 * 60 * 60 * 1000; // 72 hours offline grace
const COUPLE_PREMIUM_RPC_TIMEOUT_MS = 10_000;

const EntitlementsContext = createContext(null);

export const useEntitlements = () => {
  const ctx = useContext(EntitlementsContext);
  if (!ctx) {
    throw new Error('useEntitlements must be used within an EntitlementsProvider');
  }
  return ctx;
};

export const EntitlementsProvider = ({ children }) => {
  const { isPremium: isPremiumSelf, isLoading: subscriptionLoading } = useSubscription();
  const { user, coupleId } = useAuth();

  const [isPremiumCouple, setIsPremiumCouple] = useState(false);
  const [premiumSource, setPremiumSource] = useState(PremiumSource.NONE);
  const [coupleLoading, setCoupleLoading] = useState(true);
  const [paywallState, setPaywallState] = useState({ visible: false, feature: null });
  const [resolvedCoupleId, setResolvedCoupleId] = useState(coupleId || null);

  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    let active = true;

    const resolveCoupleId = async () => {
      const storedCoupleId = await storage.get(STORAGE_KEYS.COUPLE_ID, null);
      const localCoupleId = coupleId || storedCoupleId || null;

      if (!user || !supabase) {
        if (active) setResolvedCoupleId(localCoupleId);
        return;
      }

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;

        const supabaseUserId = authData?.user?.id;
        if (!supabaseUserId) {
          if (active) setResolvedCoupleId(null);
          return;
        }

        const { data: membership, error: membershipError } = await supabase
          .from('couple_members')
          .select('couple_id')
          .eq('user_id', supabaseUserId)
          .maybeSingle();
        if (membershipError) throw membershipError;

        const remoteCoupleId = membership?.couple_id || null;
        if (remoteCoupleId) {
          await storage.set(STORAGE_KEYS.COUPLE_ID, remoteCoupleId);
        } else if (localCoupleId) {
          await storage.remove(STORAGE_KEYS.COUPLE_ID);
        }
        if (active) setResolvedCoupleId(remoteCoupleId);
      } catch (err) {
        if (__DEV__) console.warn('[Entitlements] Failed to resolve couple ID:', err?.message);
        if (active) setResolvedCoupleId(localCoupleId);
      }
    };

    resolveCoupleId();
    return () => {
      active = false;
    };
  }, [coupleId, user]);

  // ─── Fetch couple premium status from Supabase ──────────────────────────────

  const fetchCouplePremium = useCallback(async () => {
    if (!resolvedCoupleId || !supabase) {
      // No couple link or no Supabase → fall back to cached value
      const cached = await _loadCachedCouplePremium();
      if (cached !== null) {
        setIsPremiumCouple(cached);
      } else {
        setIsPremiumCouple(false);
      }
      setCoupleLoading(false);
      return;
    }

    let timeoutId;
    try {
      const { data, error } = await Promise.race([
        supabase.rpc('get_couple_premium_status', {
          input_couple_id: resolvedCoupleId,
        }),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Couple premium check timed out')), COUPLE_PREMIUM_RPC_TIMEOUT_MS);
        }),
      ]);

      if (error) {
        if (__DEV__) console.warn('[Entitlements] Failed to fetch couple premium:', error.message);
        // Fallback to cache with grace window
        const cached = await _loadCachedCouplePremium();
        if (cached !== null) {
          setIsPremiumCouple(cached);
        }
        setCoupleLoading(false);
        return;
      }

      const couplePremium = data?.is_premium ?? false;
      setIsPremiumCouple(couplePremium);

      // Cache for offline grace window
      await _cacheCouplePremium(couplePremium);
    } catch (err) {
      if (__DEV__) console.warn('[Entitlements] Couple premium exception:', err.message);
      const cached = await _loadCachedCouplePremium();
      if (cached !== null) {
        setIsPremiumCouple(cached);
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setCoupleLoading(false);
    }
  }, [resolvedCoupleId, supabase]);

  // ─── Request server-side premium recomputation ──────────────────────────────

  const syncSelfPremiumToCouple = useCallback(async () => {
    if (!resolvedCoupleId || !supabase || !user) return;

    try {
      await supabase.rpc('set_couple_premium', {
        input_couple_id: resolvedCoupleId,
        input_is_premium: !!isPremiumSelf,
        input_source: isPremiumSelf ? user.uid : 'none',
      });
      if (__DEV__) console.log('[Entitlements] Requested premium recompute for couple:', resolvedCoupleId);
    } catch (err) {
      if (__DEV__) console.warn('[Entitlements] Failed to sync premium to couple:', err.message);
    }
  }, [resolvedCoupleId, isPremiumSelf, user]);

  // ─── Effects ────────────────────────────────────────────────────────────────

  // Fetch couple premium on mount & when coupleId changes
  useEffect(() => {
    fetchCouplePremium();
  }, [fetchCouplePremium]);

  // When this user's RevenueCat status changes, propagate to couple space
  useEffect(() => {
    if (!subscriptionLoading) {
      syncSelfPremiumToCouple();
    }
  }, [isPremiumSelf, subscriptionLoading, syncSelfPremiumToCouple]);

  // Re-check couple premium when app comes to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        fetchCouplePremium();
        // Also sync usage limits with remote (only with a real Supabase UUID)
        if (user?.uid && resolvedCoupleId && !user.uid.startsWith('user_')) {
          UsageLimitsService.syncWithRemote(user.uid, resolvedCoupleId);
        }
      }
      appStateRef.current = nextState;
    });
    return () => sub?.remove();
  }, [fetchCouplePremium, user, resolvedCoupleId]);

  // Listen for real-time couple premium changes via Supabase
  useEffect(() => {
    if (!supabase || !resolvedCoupleId) return;

    const channel = supabase
      .channel(`couple-premium-${resolvedCoupleId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'couples',
          filter: `id=eq.${resolvedCoupleId}`,
        },
        (payload) => {
          const newPremium = payload.new?.is_premium ?? false;
          setIsPremiumCouple(newPremium);
          _cacheCouplePremium(newPremium);
          if (__DEV__) console.log('[Entitlements] Real-time couple premium update:', newPremium);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [resolvedCoupleId, supabase]);

  // ─── Derived State ──────────────────────────────────────────────────────────

  const isPremiumEffective = !!(isPremiumSelf || isPremiumCouple);

  // Schedule or cancel win-back nudges based on premium status
  useEffect(() => {
    if (subscriptionLoading || coupleLoading) return;
    if (isPremiumEffective) {
      WinBackNudges.cancelNudges();
    } else {
      WinBackNudges.scheduleNudges();
    }
  }, [isPremiumEffective, subscriptionLoading, coupleLoading]);

  // Determine source
  useEffect(() => {
    if (isPremiumSelf) {
      setPremiumSource(PremiumSource.SELF);
    } else if (isPremiumCouple) {
      setPremiumSource(PremiumSource.PARTNER);
    } else {
      setPremiumSource(PremiumSource.NONE);
    }
  }, [isPremiumSelf, isPremiumCouple]);

  // ─── Feature Flags ──────────────────────────────────────────────────────────

  const features = useMemo(() => {
    const flags = {};
    for (const key of Object.values(PremiumFeature)) {
      flags[key] = isPremiumEffective;
    }
    return flags;
  }, [isPremiumEffective]);

  // ─── Limits ─────────────────────────────────────────────────────────────────

  const limits = useMemo(() => getLimitsForTier(isPremiumEffective), [isPremiumEffective]);

  const heatLevels = useMemo(
    () => getAccessibleHeatLevels(isPremiumEffective),
    [isPremiumEffective]
  );

  // ─── Usage Helpers ──────────────────────────────────────────────────────────

  const canConsumePrompt = useCallback(async () => {
    if (isPremiumEffective) return { allowed: true, used: 0, remaining: Infinity };
    return UsageLimitsService.canConsume(
      user?.uid,
      resolvedCoupleId,
      UsageEventType.PROMPT_VIEWED,
      FREE_LIMITS.PROMPTS_PER_DAY
    );
  }, [isPremiumEffective, user, resolvedCoupleId]);

  const canConsumeDateIdea = useCallback(async () => {
    if (isPremiumEffective) return { allowed: true, used: 0, remaining: Infinity };
    return UsageLimitsService.canConsume(
      user?.uid,
      resolvedCoupleId,
      UsageEventType.DATE_IDEA_VIEWED,
      FREE_LIMITS.DATE_IDEAS_PER_DAY
    );
  }, [isPremiumEffective, user, resolvedCoupleId]);

  const recordPromptUsage = useCallback(
    async (metadata = {}) => {
      return UsageLimitsService.recordConsumption(
        user?.uid,
        resolvedCoupleId,
        UsageEventType.PROMPT_VIEWED,
        metadata
      );
    },
    [user, resolvedCoupleId]
  );

  const recordDateIdeaUsage = useCallback(
    async (metadata = {}) => {
      return UsageLimitsService.recordConsumption(
        user?.uid,
        resolvedCoupleId,
        UsageEventType.DATE_IDEA_VIEWED,
        metadata
      );
    },
    [user, resolvedCoupleId]
  );

  const getDailyUsage = useCallback(async () => {
    return UsageLimitsService.getDailyUsageSummary(user?.uid, resolvedCoupleId, isPremiumEffective);
  }, [user, resolvedCoupleId, isPremiumEffective]);

  // ─── Paywall Control ────────────────────────────────────────────────────────

  const paywallFeatureRef = useRef(null);

  const showPaywall = useCallback((featureId = null) => {
    const normalizedFeatureId = normalizePremiumFeatureId(featureId);

    if (normalizedFeatureId === undefined) {
      if (__DEV__) console.warn('[Entitlements] Ignoring unknown premium feature:', featureId);
      return false;
    }

    AnalyticsService.trackPaywall(normalizedFeatureId, 'shown');
    paywallFeatureRef.current = normalizedFeatureId;
    setPaywallState({ visible: true, feature: normalizedFeatureId });
    return true;
  }, []);

  const hidePaywall = useCallback(() => {
    if (paywallFeatureRef.current) {
      AnalyticsService.trackPaywall(paywallFeatureRef.current, 'dismissed');
    }
    paywallFeatureRef.current = null;
    setPaywallState({ visible: false, feature: null });
  }, []);

  /**
   * Gate a feature: returns true if allowed, false if blocked.
   * When blocked and `autoPaywall` is true, shows the paywall automatically.
   */
  const requireFeature = useCallback(
    (featureId, autoPaywall = true) => {
      const normalizedFeatureId = normalizePremiumFeatureId(featureId);

      if (normalizedFeatureId === undefined) {
        if (__DEV__) console.warn('[Entitlements] Cannot require unknown premium feature:', featureId);
        return false;
      }

      if (isPremiumEffective) {
        AnalyticsService.trackPremiumFeature(normalizedFeatureId, true);
        return true;
      }
      AnalyticsService.trackPremiumFeature(normalizedFeatureId, false);
      if (autoPaywall) {
        showPaywall(normalizedFeatureId);
      }
      return false;
    },
    [isPremiumEffective, showPaywall]
  );

  /**
   * Silent check: does the user have access to a feature? No paywall shown.
   */
  const hasFeature = useCallback(
    (featureId) => normalizePremiumFeatureId(featureId) !== undefined && isPremiumEffective,
    [isPremiumEffective]
  );

  // ─── Context Value ──────────────────────────────────────────────────────────

  const value = useMemo(
    () => ({
      // Core premium state
      isPremiumEffective,
      isPremiumSelf: !!isPremiumSelf,
      isPremiumCouple,
      premiumSource,
      isLoading: subscriptionLoading || coupleLoading,

      // Feature flags
      features,

      // Limits
      limits,
      heatLevels,

      // Usage
      canConsumePrompt,
      canConsumeDateIdea,
      recordPromptUsage,
      recordDateIdeaUsage,
      getDailyUsage,

      // Feature gating
      requireFeature,
      hasFeature,

      // Paywall
      paywallVisible: paywallState.visible,
      paywallFeature: paywallState.feature,
      showPaywall,
      hidePaywall,

      // Refresh
      refreshCouplePremium: fetchCouplePremium,

      // Constants re-exported for convenience
      PremiumFeature,
      GuardBehavior,
      FEATURE_META,
    }),
    [
      isPremiumEffective,
      isPremiumSelf,
      isPremiumCouple,
      premiumSource,
      subscriptionLoading,
      coupleLoading,
      features,
      limits,
      heatLevels,
      canConsumePrompt,
      canConsumeDateIdea,
      recordPromptUsage,
      recordDateIdeaUsage,
      getDailyUsage,
      requireFeature,
      hasFeature,
      paywallState,
      showPaywall,
      hidePaywall,
      fetchCouplePremium,
    ]
  );

  return (
    <EntitlementsContext.Provider value={value}>
      {children}
    </EntitlementsContext.Provider>
  );
};

// ─── Private Helpers: Offline Cache ───────────────────────────────────────────

async function _cacheCouplePremium(isPremium) {
  try {
    await AsyncStorage.setItem(
      COUPLE_PREMIUM_CACHE_KEY,
      JSON.stringify({ isPremium, cachedAt: Date.now() })
    );
  } catch (e) {
    if (__DEV__) console.warn('[Entitlements] Failed to cache couple premium status:', e?.message);
  }
}

async function _loadCachedCouplePremium() {
  try {
    const raw = await AsyncStorage.getItem(COUPLE_PREMIUM_CACHE_KEY);
    if (!raw) return null;
    const { isPremium, cachedAt } = JSON.parse(raw);

    // Reject tampered timestamps (future dates or non-numbers)
    if (typeof cachedAt !== 'number' || cachedAt > Date.now() + 60000) {
      // Suspicious cache — treat as expired
      return false;
    }

    // Honor the 72-hour grace window
    if (Date.now() - cachedAt > GRACE_WINDOW_MS) {
      // Cache expired — treat as unknown (not premium)
      return false;
    }

    return isPremium;
  } catch (e) {
    if (__DEV__) console.warn('[Entitlements] Failed to load cached couple premium:', e?.message);
    return null;
  }
}

/**
 * Clear the couple premium offline cache.
 * Call this whenever a user unlinks from a couple so that the 72-hour
 * grace window does not carry over stale premium entitlements.
 */
export async function clearCouplePremiumCache() {
  try {
    await AsyncStorage.removeItem(COUPLE_PREMIUM_CACHE_KEY);
  } catch (e) {
    if (__DEV__) console.warn('[Entitlements] Failed to clear couple premium cache:', e?.message);
  }
}
