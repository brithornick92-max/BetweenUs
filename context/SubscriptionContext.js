import React, { createContext, useContext, useEffect, useCallback, useRef, useState } from "react";
import Purchases from "react-native-purchases";
import RevenueCatService from "../services/RevenueCatService";
import { storage, STORAGE_KEYS, cloudSyncStorage } from "../utils/storage";
import { useAuth } from "./AuthContext";
import StorageRouter from "../services/storage/StorageRouter";
import SupabaseAuthService from "../services/supabase/SupabaseAuthService";

const SubscriptionContext = createContext(null);

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
  const initInFlightRef = useRef(false);
  const premiumListenersRef = useRef(new Set());

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
          await StorageRouter.configureSync({
            isPremium: false,
            syncEnabled: false,
            supabaseSessionPresent: false,
          });
          return;
        }

        const status = await cloudSyncStorage.getSyncStatus();
        const syncEnabled = !!status?.enabled;
        let sessionPresent = false;
        try {
          const session = await SupabaseAuthService.getSession();
          sessionPresent = !!session;
        } catch {
          sessionPresent = false;
        }

        if (active) {
          await StorageRouter.configureSync({
            isPremium,
            syncEnabled,
            supabaseSessionPresent: sessionPresent,
          });
        }
      } catch (error) {
        console.error("Failed to configure storage sync:", error);
      }
    };

    sync();
    return () => {
      active = false;
    };
  }, [user, isPremium]);

  const updateSubscriptionDetails = useCallback((info) => {
    try {
      // ✅ Use the same entitlement lookup logic your service uses
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
      setIsPremium(premium);
      notifyPremiumListeners(premium);
      setCustomerInfo(info);
      if (premium) updateSubscriptionDetails(info);
      else setSubscriptionDetails(null);

      if (__DEV__) console.log("✅ Subscription status checked:", premium ? "Premium" : "Free");
    } catch (error) {
      console.error("❌ Failed to check subscription status:", error);
      setIsPremium(false);
      notifyPremiumListeners(false);
      setSubscriptionDetails(null);
    }
  }, [updateSubscriptionDetails]);

  const loadOfferings = useCallback(async () => {
    try {
      const offeringsData = await RevenueCatService.getOfferings();
      setOfferings(offeringsData);
      if (offeringsData?.nonFatal) {
        if (__DEV__) console.log("ℹ️ RevenueCat offerings unavailable; using free mode fallback.");
      } else {
        if (__DEV__) console.log("✅ Offerings loaded:", offeringsData.packages?.length || 0, "packages");
      }
    } catch (error) {
      console.error("❌ Failed to load offerings:", error);
      // Keep app in free mode without crashing paywall consumers
      setOfferings({ current: null, packages: [], nonFatal: true, reason: 'load_failed' });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      const activeCoupleId = coupleId || storedCoupleId;

      if (!user) {
        setIsPremium(false);
        setOfferings(null);
        setSubscriptionDetails(null);
        setCustomerInfo(null);
        setIsLoading(false);
        return;
      }

      // prevent double-runs
      if (initInFlightRef.current) return;
      initInFlightRef.current = true;

      try {
        setIsLoading(true);

        // ✅ MUST configure before logIn / getOfferings
        await RevenueCatService.init?.();

        // ✅ Identify user with their OWN user ID (not coupleId).
        // Premium sharing between partners is handled server-side via
        // the set_couple_premium Supabase RPC, not by sharing RC identities.
        await RevenueCatService.identifyUser(user.uid);

        if (cancelled) return;

        await checkSubscriptionStatus();
        await loadOfferings();

        if (cancelled) return;

        // ✅ clean previous listener if any
        if (listenerRef.current) {
          try {
            listenerRef.current();
          } catch (e) { /* cleanup non-critical */ }
          listenerRef.current = null;
        }

        // ✅ listener: keep state in sync
        const remove = Purchases.addCustomerInfoUpdateListener((info) => {
          const premium = RevenueCatService.checkPremiumStatus(info);
          setIsPremium(premium);
          notifyPremiumListeners(premium);
          setCustomerInfo(info);
          if (premium) updateSubscriptionDetails(info);
          else setSubscriptionDetails(null);
        });

        listenerRef.current = typeof remove === 'function' ? remove : null;
      } catch (error) {
        console.error("❌ Failed to initialize subscription:", error);
        setIsPremium(false);
        notifyPremiumListeners(false);
        setSubscriptionDetails(null);
      } finally {
        initInFlightRef.current = false;
        if (!cancelled) setIsLoading(false);
      }
    };

    initialize();

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
      initInFlightRef.current = false;
    };
  }, [user, coupleId, storedCoupleId, checkSubscriptionStatus, loadOfferings, updateSubscriptionDetails]);

  const purchasePackage = async (packageToPurchase) => {
    try {
      const result = await RevenueCatService.purchasePackage(packageToPurchase);
      if (result.success) {
        setIsPremium(result.isPremium);
        await checkSubscriptionStatus();
      }
      return result;
    } catch (error) {
      console.error("❌ Purchase failed:", error);
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
      console.error("❌ Restore failed:", error);
      return { success: false, error: error.message };
    }
  };

  const value = {
    isPremium,
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
  };

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
};
