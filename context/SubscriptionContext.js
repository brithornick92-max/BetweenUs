import React, { createContext, useContext, useEffect, useCallback, useMemo, useRef, useState } from "react";
import Purchases from "react-native-purchases";
import RevenueCatService from "../services/RevenueCatService";
import { storage, STORAGE_KEYS, cloudSyncStorage } from "../utils/storage";
import { useAuth } from "./AuthContext";
import StorageRouter from "../services/storage/StorageRouter";
import SupabaseAuthService from "../services/supabase/SupabaseAuthService";

const SubscriptionContext = createContext(null);
const DEV_FORCE_PREMIUM = __DEV__ && false;

// Debounce/throttle constants to prevent cascading re-renders
const STORAGE_SYNC_DEBOUNCE_MS = 5000;

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) throw new Error("useSubscription must be used within SubscriptionProvider");
  return context;
};

export const SubscriptionProvider = ({ children }) => {
  const { user, coupleId } = useAuth();

  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [offerings, setOfferings] = useState(null);
  const [subscriptionDetails, setSubscriptionDetails] = useState(null);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [storedCoupleId, setStoredCoupleId] = useState(null);

  const listenerRef = useRef(null);
  const initPromiseRef = useRef(null);
  const identifiedRcUserRef = useRef(null);
  const premiumListenersRef = useRef(new Set());
  const storageSyncTimerRef = useRef(null);
  const lastStorageSyncRef = useRef({ timestamp: 0, config: null });
  const effectiveIsPremium = DEV_FORCE_PREMIUM || isPremium;

  useEffect(() => {
    let active = true;

    const loadCoupleId = async () => {
      if (!user) {
        setStoredCoupleId(null);
        return;
      }

      const id = await storage.get(STORAGE_KEYS.COUPLE_ID, null);
      if (active) setStoredCoupleId(id || null);
    };

    loadCoupleId();

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    let active = true;

    const sync = async () => {
      try {
        if (!user) {
          const config = {
            isPremium: effectiveIsPremium,
            syncEnabled: false,
            supabaseSessionPresent: false,
          };

          // Skip if same config was synced recently
          const lastSync = lastStorageSyncRef.current;
          if (
            JSON.stringify(lastSync.config) === JSON.stringify(config) &&
            Date.now() - lastSync.timestamp < STORAGE_SYNC_DEBOUNCE_MS
          ) {
            return;
          }

          await StorageRouter.configureSync(config);
          lastStorageSyncRef.current = { timestamp: Date.now(), config };
          return;
        }

        const status = await cloudSyncStorage.getSyncStatus();
        const syncEnabled = !!status?.enabled;
        let sessionPresent = false;
        try {
          const session = await SupabaseAuthService.getSession();
          sessionPresent = !!session;
        } catch (e) {
          if (__DEV__) console.warn('[SubscriptionContext] getSession failed (non-fatal):', e?.message);
          sessionPresent = false;
        }

        if (active) {
          const config = {
            isPremium: effectiveIsPremium,
            syncEnabled,
            supabaseSessionPresent: sessionPresent,
          };

          // Skip if same config was synced recently
          const lastSync = lastStorageSyncRef.current;
          if (
            JSON.stringify(lastSync.config) === JSON.stringify(config) &&
            Date.now() - lastSync.timestamp < STORAGE_SYNC_DEBOUNCE_MS
          ) {
            return;
          }

          await StorageRouter.configureSync(config);
          lastStorageSyncRef.current = { timestamp: Date.now(), config };
        }
      } catch (error) {
        console.error("Failed to configure storage sync:", error);
      }
    };

    // Debounce the sync call
    if (storageSyncTimerRef.current) {
      clearTimeout(storageSyncTimerRef.current);
    }
    storageSyncTimerRef.current = setTimeout(sync, 500);

    return () => {
      active = false;
      if (storageSyncTimerRef.current) {
        clearTimeout(storageSyncTimerRef.current);
      }
    };
  }, [user, effectiveIsPremium]);

  const updateSubscriptionDetails = useCallback((info) => {
    try {
      // OK: Use the same entitlement lookup logic your service uses
      // (and stop hard-coding "Between Us Pro")
      const entitlement = RevenueCatService.getActiveEntitlement?.(info) ?? null;

      if (!entitlement) {
        setSubscriptionDetails(null);
        return;
      }

      setSubscriptionDetails({
        productIdentifier: entitlement.productIdentifier,
        expirationDate: entitlement.expirationDate,
        willRenew: entitlement.willRenew,
        periodType: entitlement.periodType,
        store: entitlement.store,
        isSandbox: entitlement.isSandbox,
        originalPurchaseDate: entitlement.originalPurchaseDate,
        latestPurchaseDate: entitlement.latestPurchaseDate,
      });
    } catch (error) {
      console.error("Failed to update subscription details:", error);
    }
  }, []);

  const notifyPremiumListeners = useCallback((value) => {
    premiumListenersRef.current.forEach((cb) => {
      try {
        cb(value);
      } catch (e) { /* listener error non-critical */ }
    });
  }, []);

  const checkSubscriptionStatus = useCallback(async () => {
    try {
      const { isPremium: premium, customerInfo: info } = await RevenueCatService.getCustomerInfo();
      const resolvedPremium = DEV_FORCE_PREMIUM || premium;
      setIsPremium(premium);
      notifyPremiumListeners(resolvedPremium);
      setCustomerInfo(info);
      if (resolvedPremium) updateSubscriptionDetails(info);
      else setSubscriptionDetails(null);

      if (__DEV__) console.log("OK: Subscription status checked:", resolvedPremium ? "Premium" : "Free");
    } catch (error) {
      console.error("Error: Failed to check subscription status:", error);
      setIsPremium(false);
      notifyPremiumListeners(effectiveIsPremium);
      if (!DEV_FORCE_PREMIUM) {
        setSubscriptionDetails(null);
      }
    }
  }, [effectiveIsPremium, notifyPremiumListeners, updateSubscriptionDetails]);

  const loadOfferings = useCallback(async () => {
    try {
      const offeringsData = await RevenueCatService.getOfferings();
      setOfferings(offeringsData);
      if (offeringsData?.nonFatal) {
        if (__DEV__) console.log("ℹ️ RevenueCat offerings unavailable; using free mode fallback.");
      } else {
        if (__DEV__) console.log("OK: Offerings loaded:", offeringsData.packages?.length || 0, "packages");
      }
    } catch (error) {
      console.error("Error: Failed to load offerings:", error);
      // Keep app in free mode without crashing paywall consumers
      setOfferings({ current: null, packages: [], nonFatal: true, reason: 'load_failed' });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      const activeCoupleId = coupleId || storedCoupleId;

      if (!user) {
        identifiedRcUserRef.current = null;
        setIsPremium(false);
        setOfferings(null);
        setSubscriptionDetails(null);
        setCustomerInfo(null);
        setIsLoading(false);
        return;
      }

      // prevent double-runs — await any in-flight init instead of skipping
      if (initPromiseRef.current) {
        await initPromiseRef.current;
        if (!cancelled) setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        // OK: MUST configure before logIn / getOfferings
        await RevenueCatService.init?.();

        // OK: Identify user with their Supabase UUID (not a legacy cached user_* ID).
        // Premium sharing between partners is handled server-side via
        // the set_couple_premium Supabase RPC, not by sharing RC identities.
        let rcUserId = user.uid;
        try {
          const supabaseUser = await SupabaseAuthService.getUser();
          if (supabaseUser?.id) rcUserId = supabaseUser.id;
        } catch (_) { /* fall back to local uid */ }

        if (identifiedRcUserRef.current !== rcUserId) {
          await RevenueCatService.identifyUser(rcUserId);
          identifiedRcUserRef.current = rcUserId;
        }

        if (cancelled) return;

        await checkSubscriptionStatus();
        await loadOfferings();

        if (cancelled) return;

        // OK: clean previous listener if any
        if (listenerRef.current) {
          try {
            listenerRef.current();
          } catch (e) { /* cleanup non-critical */ }
          listenerRef.current = null;
        }

        // OK: listener: keep state in sync
        const remove = Purchases.addCustomerInfoUpdateListener((info) => {
          const premium = RevenueCatService.checkPremiumStatus(info);
          const resolvedPremium = DEV_FORCE_PREMIUM || premium;
          setIsPremium(premium);
          notifyPremiumListeners(resolvedPremium);
          setCustomerInfo(info);
          if (resolvedPremium) updateSubscriptionDetails(info);
          else setSubscriptionDetails(null);
        });

        listenerRef.current = typeof remove === 'function' ? remove : null;
      } catch (error) {
        console.error("Error: Failed to initialize subscription:", error);
        setIsPremium(false);
        notifyPremiumListeners(effectiveIsPremium);
        if (!DEV_FORCE_PREMIUM) {
          setSubscriptionDetails(null);
        }
      } finally {
        initPromiseRef.current = null;
        // Always reset loading — SubscriptionProvider is never unmounted,
        // so state updates here are always safe regardless of cancellation.
        setIsLoading(false);
      }
    };

    initPromiseRef.current = initialize();
    initPromiseRef.current.finally(() => { initPromiseRef.current = null; });

    return () => {
      cancelled = true;
      if (listenerRef.current) {
        try {
          listenerRef.current();
        } catch (e) { /* cleanup non-critical */ }
        listenerRef.current = null;
      } else if (typeof Purchases.removeCustomerInfoUpdateListener === 'function') {
        try {
          Purchases.removeCustomerInfoUpdateListener();
        } catch (e) { /* cleanup non-critical */ }
      }
      initPromiseRef.current = null;
    };
  }, [user, coupleId, storedCoupleId, checkSubscriptionStatus, effectiveIsPremium, loadOfferings, updateSubscriptionDetails]);

  const purchasePackage = async (packageToPurchase) => {
    try {
      const result = await RevenueCatService.purchasePackage(packageToPurchase);
      if (result.success) {
        setIsPremium(result.isPremium);
        await checkSubscriptionStatus();
      }
      return result;
    } catch (error) {
      console.error("Error: Purchase failed:", error);
      return { success: false, error: error.message };
    }
  };

  const restorePurchases = async () => {
    try {
      const result = await RevenueCatService.restorePurchases();
      if (result.success) {
        setIsPremium(result.isPremium);
        await checkSubscriptionStatus();
      }
      return result;
    } catch (error) {
      console.error("Error: Restore failed:", error);
      return { success: false, error: error.message };
    }
  };

  const value = useMemo(() => ({
    isPremium: effectiveIsPremium,
    isLoading,
    offerings,
    subscriptionDetails,
    customerInfo,
    purchasePackage,
    restorePurchases,
    checkSubscriptionStatus,
    onPremiumChange: (cb) => {
      premiumListenersRef.current.add(cb);
      return () => premiumListenersRef.current.delete(cb);
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [effectiveIsPremium, isLoading, offerings, subscriptionDetails, customerInfo]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
};
