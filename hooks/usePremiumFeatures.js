/**
 * usePremiumFeatures — Thin wrapper around EntitlementsContext
 *
 * Backward-compatible API surface. New code should prefer
 * `useEntitlements()` directly. All premium state flows from
 * EntitlementsContext (RevenueCat + Supabase couple premium).
 */
import { useCallback } from 'react';
import { useEntitlements } from '../context/EntitlementsContext';
import {
  PremiumFeature,
  FEATURE_META,
  getFeaturesByCategory as getFeaturesByCategoryUtil,
  getAllPremiumFeatures as getAllPremiumFeaturesUtil,
} from '../utils/featureFlags';

export const usePremiumFeatures = () => {
  const entitlements = useEntitlements();

  const {
    isPremiumEffective,
    isPremiumCouple,
    premiumSource,
    isLoading,
    features,
    limits,
    heatLevels,
    requireFeature,
    hasFeature,
    showPaywall,
    hidePaywall,
    paywallVisible,
    paywallFeature,
  } = entitlements;

  // Backward-compatible aliases
  const isPremium = isPremiumEffective;
  const isCouplePremium = isPremiumCouple;

  // Feature access checks (no paywall)
  const canExportMemories = useCallback(
    async () => hasFeature(PremiumFeature.PDF_EXPORT),
    [hasFeature]
  );
  const canCreateCustomRituals = useCallback(
    async () => hasFeature(PremiumFeature.CUSTOM_RITUALS),
    [hasFeature]
  );
  const canScheduleReminders = useCallback(
    async () => hasFeature(PremiumFeature.RITUAL_REMINDERS),
    [hasFeature]
  );
  const canAccessBiometricVault = useCallback(
    async () => hasFeature(PremiumFeature.VAULT_AND_BIOMETRIC),
    [hasFeature]
  );
  const canSyncToCloud = useCallback(
    async () => hasFeature(PremiumFeature.CLOUD_SYNC),
    [hasFeature]
  );
  const canUseLuxuryThemes = useCallback(
    async () => hasFeature(PremiumFeature.LUXURY_THEMES),
    [hasFeature]
  );
  const canUseCustomHaptics = useCallback(
    async () => hasFeature(PremiumFeature.CUSTOM_HAPTICS),
    [hasFeature]
  );

  // Feature requirements (with automatic paywall)
  const requireMemoryExport = useCallback(
    async () => requireFeature(PremiumFeature.PDF_EXPORT),
    [requireFeature]
  );
  const requireCustomRituals = useCallback(
    async () => requireFeature(PremiumFeature.CUSTOM_RITUALS),
    [requireFeature]
  );
  const requireScheduledReminders = useCallback(
    async () => requireFeature(PremiumFeature.RITUAL_REMINDERS),
    [requireFeature]
  );
  const requireBiometricVault = useCallback(
    async () => requireFeature(PremiumFeature.VAULT_AND_BIOMETRIC),
    [requireFeature]
  );
  const requireCloudSync = useCallback(
    async () => requireFeature(PremiumFeature.CLOUD_SYNC),
    [requireFeature]
  );
  const requireLuxuryThemes = useCallback(
    async () => requireFeature(PremiumFeature.LUXURY_THEMES),
    [requireFeature]
  );
  const requireCustomHaptics = useCallback(
    async () => requireFeature(PremiumFeature.CUSTOM_HAPTICS),
    [requireFeature]
  );

  // Generic access
  const hasFeatureAccess = useCallback(
    async (featureId) => hasFeature(featureId),
    [hasFeature]
  );
  const requireFeatureAccess = useCallback(
    async (featureId) => requireFeature(featureId),
    [requireFeature]
  );

  // Feature information
  const getFeatureInfo = useCallback((featureId) => {
    return FEATURE_META[featureId] || null;
  }, []);
  const getAllFeatures = useCallback(() => getAllPremiumFeaturesUtil(), []);
  const getFeaturesByCategory = useCallback(
    (category) => getFeaturesByCategoryUtil(category),
    []
  );

  const handleSubscribe = useCallback(async () => {
    // Show the paywall modal so the user can purchase
    showPaywall('GENERAL_UPGRADE');
  }, [showPaywall]);

  return {
    // Premium status
    isPremium,
    isCouplePremium,
    premiumSource,
    isLoading,

    // Feature access checks (no paywall)
    canExportMemories,
    canCreateCustomRituals,
    canScheduleReminders,
    canAccessBiometricVault,
    canSyncToCloud,
    canUseLuxuryThemes,
    canUseCustomHaptics,

    // Feature requirements (with paywall)
    requireMemoryExport,
    requireCustomRituals,
    requireScheduledReminders,
    requireBiometricVault,
    requireCloudSync,
    requireLuxuryThemes,
    requireCustomHaptics,

    // Generic access
    hasFeatureAccess,
    requireFeatureAccess,

    // Paywall control
    paywallVisible,
    currentFeature: paywallFeature,
    showPaywall,
    hidePaywall,
    handleSubscribe,

    // Feature information
    getFeatureInfo,
    getAllFeatures,
    getFeaturesByCategory,

    // Direct access to entitlements context
    entitlements,
  };
};

export default usePremiumFeatures;
