// utils/premiumFeatures.js
import * as Haptics from 'expo-haptics';
import { storage } from './storage';

const FEATURE_USAGE_KEY = '@betweenus:premiumFeatureUsage';

// Premium features configuration
export const PREMIUM_FEATURES = {
  MEMORY_EXPORT: {
    id: 'memory_export',
    name: 'Memory Export',
    description: 'Export your complete relationship timeline as PDF',
    category: 'memory',
    emotionalValue: 'Preserve your love story forever',
    icon: '🏛️',
  },
  CUSTOM_RITUALS: {
    id: 'custom_rituals',
    name: 'Custom Rituals',
    description: 'Create personalized bedtime ritual flows',
    category: 'ritual',
    emotionalValue: 'Design intimate moments that are uniquely yours',
    icon: '🌙',
  },
  SCHEDULED_REMINDERS: {
    id: 'scheduled_reminders',
    name: 'Ritual Reminders',
    description: 'Never miss your special moments together',
    category: 'ritual',
    emotionalValue: 'Build consistent connection habits',
    icon: '⏰',
  },
  BIOMETRIC_VAULT: {
    id: 'biometric_vault',
    name: 'Private Vault',
    description: 'Secure storage for your most intimate memories',
    category: 'security',
    emotionalValue: 'Keep your private moments truly private',
    icon: '🔒',
  },
  CLOUD_SYNC: {
    id: 'cloud_sync',
    name: 'Cloud Backup',
    description: 'Never lose your precious memories',
    category: 'sync',
    emotionalValue: 'Peace of mind for your relationship history',
    icon: '☁️',
  },
  LUXURY_THEMES: {
    id: 'luxury_themes',
    name: 'Luxury Themes',
    description: 'Exclusive color palettes and anniversary themes',
    category: 'customization',
    emotionalValue: 'Make every moment feel special',
    icon: '✨',
  },
  CUSTOM_HAPTICS: {
    id: 'custom_haptics',
    name: 'Custom Haptics',
    description: 'Personalized touch feedback for your interactions',
    category: 'customization',
    emotionalValue: 'Feel the connection in every touch',
    icon: '💫',
  },
};

export const SUBSCRIPTION_TIERS = {
  PREMIUM: {
    id: 'premium_monthly',
    name: 'Premium Couple',
    price: '$9.99/month',
    features: Object.values(PREMIUM_FEATURES),
    emotionalBenefits: [
      'Protect your love story forever',
      'Create deeper intimacy through custom rituals',
      'Never lose precious memories',
      'Build stronger connection habits',
    ],
    memoryProtection: [
      'Unlimited memory storage',
      'PDF export of your timeline',
      'Secure cloud backup',
      'Biometric vault protection',
    ],
  },
};

/**
 * Premium Feature Gatekeeper
 * Handles validation and paywall presentation with emotional framing
 */
export class PremiumGatekeeper {
  constructor() {
    this.paywallCallbacks = new Set();
  }

  async validateFeatureAccess(featureId, isPremium, showPaywallOnDenied = true) {
    const feature = Object.values(PREMIUM_FEATURES).find(f => f.id === featureId);
    if (!feature) return true; // Free feature (unknown feature ID)

    const hasSubscription = !!isPremium;
    if (!hasSubscription && showPaywallOnDenied) {
      await this.showPremiumPaywall(feature);
      return false;
    }

    await this.trackFeatureAccess(featureId);
    return hasSubscription;
  }

  async showPremiumPaywall(feature) {
    // Haptic feedback for premium feature attempt
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Focus on emotional value and memory protection
    const paywallContent = {
      title: "Protect Your Love Story",
      subtitle: "Premium features help preserve and enhance your relationship memories",
      feature: feature,
      tier: SUBSCRIPTION_TIERS.PREMIUM,
      emotionalBenefits: SUBSCRIPTION_TIERS.PREMIUM.emotionalBenefits,
      memoryProtection: SUBSCRIPTION_TIERS.PREMIUM.memoryProtection,
    };

    // Notify all registered paywall callbacks
    this.paywallCallbacks.forEach(callback => {
      try {
        callback(paywallContent);
      } catch (error) {
        console.error('Paywall callback error:', error);
      }
    });
    
    return paywallContent;
  }

  // Register paywall callback (for navigation or modal display)
  onPaywallRequested(callback) {
    this.paywallCallbacks.add(callback);
    return () => this.paywallCallbacks.delete(callback);
  }

  // Premium feature access helpers
  async canExportMemories(isPremium) {
    return this.validateFeatureAccess('memory_export', isPremium, false);
  }

  async canCreateCustomRituals(isPremium) {
    return this.validateFeatureAccess('custom_rituals', isPremium, false);
  }

  async canScheduleReminders(isPremium) {
    return this.validateFeatureAccess('scheduled_reminders', isPremium, false);
  }

  async canAccessBiometricVault(isPremium) {
    return this.validateFeatureAccess('biometric_vault', isPremium, false);
  }

  async canSyncToCloud(isPremium) {
    return this.validateFeatureAccess('cloud_sync', isPremium, false);
  }

  async canUseLuxuryThemes(isPremium) {
    return this.validateFeatureAccess('luxury_themes', isPremium, false);
  }

  async canUseCustomHaptics(isPremium) {
    return this.validateFeatureAccess('custom_haptics', isPremium, false);
  }

  // Feature access with automatic paywall
  async requireMemoryExport(isPremium) {
    return this.validateFeatureAccess('memory_export', isPremium, true);
  }

  async requireCustomRituals(isPremium) {
    return this.validateFeatureAccess('custom_rituals', isPremium, true);
  }

  async requireScheduledReminders(isPremium) {
    return this.validateFeatureAccess('scheduled_reminders', isPremium, true);
  }

  async requireBiometricVault(isPremium) {
    return this.validateFeatureAccess('biometric_vault', isPremium, true);
  }

  async requireCloudSync(isPremium) {
    return this.validateFeatureAccess('cloud_sync', isPremium, true);
  }

  async requireLuxuryThemes(isPremium) {
    return this.validateFeatureAccess('luxury_themes', isPremium, true);
  }

  async requireCustomHaptics(isPremium) {
    return this.validateFeatureAccess('custom_haptics', isPremium, true);
  }

  getFeaturesByCategory(category) {
    return Object.values(PREMIUM_FEATURES).filter(feature => feature.category === category);
  }

  getAllPremiumFeatures() {
    return Object.values(PREMIUM_FEATURES);
  }

  getSubscriptionTier(tierId = 'PREMIUM') {
    return SUBSCRIPTION_TIERS[tierId];
  }

  // Get premium feature usage analytics
  async getFeatureUsageStats() {
    const usage = (await storage.get(FEATURE_USAGE_KEY)) || {};
    const counts = usage?.counts || {};
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    const mostUsedFeature =
      Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] || null;

    return {
      mostUsedFeature,
      totalFeatureAccess: total,
      premiumSince: usage?.firstAccessAt || null,
    };
  }

  async trackFeatureAccess(featureId) {
    if (!featureId) return;
    const usage = (await storage.get(FEATURE_USAGE_KEY)) || {};
    const counts = usage?.counts || {};
    const nextCounts = {
      ...counts,
      [featureId]: (counts[featureId] || 0) + 1,
    };
    await storage.set(FEATURE_USAGE_KEY, {
      firstAccessAt: usage?.firstAccessAt || Date.now(),
      lastAccessAt: Date.now(),
      counts: nextCounts,
    });
  }
}

// Singleton instance
export const premiumGatekeeper = new PremiumGatekeeper();
