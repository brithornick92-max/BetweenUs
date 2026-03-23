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
} from '../utils/featureFlags';

// ─── Local cache keys for couple premium ─────────────────────────────────────
const COUPLE_PREMIUM_CACHE_KEY = '@betweenus:couplePremiumCache';
const GRACE_WINDOW_MS = 72 * 60 * 60 * 1000; // 72 hours offline grace

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

  const appStateRef = useRef(AppState.currentState);

  // ─── Fetch couple premium status from Supabase ──────────────────────────────

  const fetchCouplePremium = useCallback(async () => {
    if (!coupleId || !supabase) {
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

    try {
      const { data, error } = await supabase.rpc('get_couple_premium_status', {
        input_couple_id: coupleId,
      });

      if (error) {
        console.warn('[Entitlements] Failed to fetch couple premium:', error.message);
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
      console.warn('[Entitlements] Couple premium exception:', err.message);
      const cached = await _loadCachedCouplePremium();
      if (cached !== null) {
        setIsPremiumCouple(cached);
      }
    } finally {
      setCoupleLoading(false);
    }
  }, [coupleId]);

  // ─── Write couple premium to Supabase on purchase ───────────────────────────

  const syncSelfPremiumToCouple = useCallback(async () => {
    if (!coupleId || !supabase || !user) return;

    try {
      await supabase.rpc('set_couple_premium', {
        input_couple_id: coupleId,
        input_is_premium: !!isPremiumSelf,
        input_source: isPremiumSelf ? user.uid : 'none',
      });
      if (__DEV__) console.log('[Entitlements] Synced self premium to couple:', isPremiumSelf);
    } catch (err) {
      console.warn('[Entitlements] Failed to sync premium to couple:', err.message);
    }
  }, [coupleId, isPremiumSelf, user]);

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
        // Also sync usage limits with remote
        if (user?.uid && coupleId) {
          UsageLimitsService.syncWithRemote(user.uid, coupleId);
        }
      }
      appStateRef.current = nextState;
    });
    return () => sub?.remove();
  }, [fetchCouplePremium, user, coupleId]);

  // Listen for real-time couple premium changes via Supabase
  useEffect(() => {
    if (!supabase || !coupleId) return;

    const channel = supabase
      .channel(`couple-premium-${coupleId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'couples',
          filter: `id=eq.${coupleId}`,
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
  }, [coupleId]);

  // ─── Derived State ──────────────────────────────────────────────────────────

  // 🔧 DEV ONLY: Temporary premium override — set to true to force premium in dev
  const DEV_FORCE_PREMIUM = false;

  const isPremiumEffective = DEV_FORCE_PREMIUM || !!(isPremiumSelf || isPremiumCouple);

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
      coupleId,
      UsageEventType.PROMPT_VIEWED,
      FREE_LIMITS.PROMPTS_PER_DAY
    );
  }, [isPremiumEffective, user, coupleId]);

  const canConsumeDateIdea = useCallback(async () => {
    if (isPremiumEffective) return { allowed: true, used: 0, remaining: Infinity };
    return UsageLimitsService.canConsume(
      user?.uid,
      coupleId,
      UsageEventType.DATE_IDEA_VIEWED,
      FREE_LIMITS.DATE_IDEAS_PER_DAY
    );
  }, [isPremiumEffective, user, coupleId]);

  const recordPromptUsage = useCallback(
    async (metadata = {}) => {
      return UsageLimitsService.recordConsumption(
        user?.uid,
        coupleId,
        UsageEventType.PROMPT_VIEWED,
        metadata
      );
    },
    [user, coupleId]
  );

  const recordDateIdeaUsage = useCallback(
    async (metadata = {}) => {
      return UsageLimitsService.recordConsumption(
        user?.uid,
        coupleId,
        UsageEventType.DATE_IDEA_VIEWED,
        metadata
      );
    },
    [user, coupleId]
  );

  const getDailyUsage = useCallback(async () => {
    return UsageLimitsService.getDailyUsageSummary(user?.uid, coupleId, isPremiumEffective);
  }, [user, coupleId, isPremiumEffective]);

  // ─── Paywall Control ────────────────────────────────────────────────────────

  const showPaywall = useCallback((featureId = null) => {
    setPaywallState({ visible: true, feature: featureId });
  }, []);

  const hidePaywall = useCallback(() => {
    setPaywallState({ visible: false, feature: null });
  }, []);

  /**
   * Gate a feature: returns true if allowed, false if blocked.
   * When blocked and `autoPaywall` is true, shows the paywall automatically.
   */
  const requireFeature = useCallback(
    (featureId, autoPaywall = true) => {
      if (isPremiumEffective) return true;
      if (autoPaywall) {
        showPaywall(featureId);
      }
      return false;
    },
    [isPremiumEffective, showPaywall]
  );

  /**
   * Silent check: does the user have access to a feature? No paywall shown.
   */
  const hasFeature = useCallback(
    (featureId) => isPremiumEffective,
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
  } catch {
    // Ignore
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
  } catch {
    return null;
  }
}
