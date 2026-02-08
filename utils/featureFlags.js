/**
 * featureFlags.js — Single source of truth for premium features, limits & guard UX
 *
 * Every premium gate in the app MUST reference these enums.
 * No ad-hoc string checks, no duplicated limit numbers.
 */

// ─── Canonical Feature Enum ────────────────────────────────────────────────────
// The "paywall seven" plus additional premium features.
// Every feature guard must use one of these identifiers.
export const PremiumFeature = Object.freeze({
  UNLIMITED_PROMPTS: 'unlimitedPrompts',
  HEAT_LEVELS_4_5: 'heatLevels4to5',
  UNLIMITED_DATE_IDEAS: 'unlimitedDateIdeas',
  SURPRISE_ME: 'surpriseMe',
  UNLIMITED_JOURNAL_HISTORY: 'unlimitedJournalHistory',
  PDF_EXPORT: 'pdfExport',
  VAULT_AND_BIOMETRIC: 'vaultAndBiometric',
  CUSTOM_RITUALS: 'customRituals',
  RITUAL_REMINDERS: 'ritualReminders',
  CLOUD_SYNC: 'cloudSync',
  LUXURY_THEMES: 'luxuryThemes',
  CUSTOM_HAPTICS: 'customHaptics',
  EDITORIAL_PROMPTS: 'editorialPrompts',
  VIBE_SIGNAL: 'vibeSignal',
  NIGHT_RITUAL_MODE: 'nightRitualMode',
  PROMPT_REFRESH: 'promptRefresh',
  AD_FREE: 'adFree',
});

// ─── Guard Behavior Enum ────────────────────────────────────────────────────────
// Standardized UX when a free user hits a premium gate.
export const GuardBehavior = Object.freeze({
  BLOCK: 'BLOCK',       // Full redirect to paywall screen
  BLUR: 'BLUR',         // Show blurred preview + tap to upgrade
  LOCK: 'LOCK',         // Lock icon overlay + tap shows paywall
  LIMITED: 'LIMITED',    // Show remaining counter + upsell nudge
  HIDE: 'HIDE',         // Section hidden entirely (return null)
});

// ─── Free-Tier Limits ───────────────────────────────────────────────────────────
export const FREE_LIMITS = Object.freeze({
  PROMPTS_PER_DAY: 1,
  DATE_IDEAS_PER_DAY: 1,
  VISIBLE_DATE_IDEAS: 10,
  JOURNAL_ENTRIES_VISIBLE: 7,
  FREE_HEAT_LEVELS: [1, 2, 3],
  SURPRISE_ME_ENABLED: false,
});

// ─── Premium Limits (effectively unlimited) ─────────────────────────────────────
export const PREMIUM_LIMITS = Object.freeze({
  PROMPTS_PER_DAY: Infinity,
  DATE_IDEAS_PER_DAY: Infinity,
  VISIBLE_DATE_IDEAS: Infinity,
  JOURNAL_ENTRIES_VISIBLE: Infinity,
  ALL_HEAT_LEVELS: [1, 2, 3, 4, 5],
  SURPRISE_ME_ENABLED: true,
});

// ─── Usage Event Types ──────────────────────────────────────────────────────────
// Canonical event types written to both local cache and Supabase.
export const UsageEventType = Object.freeze({
  PROMPT_VIEWED: 'prompt_viewed',
  DATE_IDEA_VIEWED: 'date_idea_viewed',
  PROMPT_REFRESHED: 'prompt_refreshed',
  SURPRISE_ME_USED: 'surprise_me_used',
});

// ─── Premium Source Enum ────────────────────────────────────────────────────────
export const PremiumSource = Object.freeze({
  SELF: 'self',       // This device/user has RevenueCat entitlement
  PARTNER: 'partner', // Partner paid → couple space is premium-enabled
  NONE: 'none',       // Neither user nor partner has premium
});

// ─── Feature Metadata ───────────────────────────────────────────────────────────
// Rich metadata for paywall display & analytics. Keyed by PremiumFeature value.
export const FEATURE_META = Object.freeze({
  [PremiumFeature.UNLIMITED_PROMPTS]: {
    name: 'Unlimited Prompts',
    description: 'No daily prompt cap — explore as many as you want',
    icon: '💬',
    category: 'content',
    guardBehavior: GuardBehavior.LIMITED,
    emotionalValue: 'Never run out of things to talk about',
  },
  [PremiumFeature.HEAT_LEVELS_4_5]: {
    name: 'All Heat Levels',
    description: 'Unlock levels 4 (Adventurous) & 5 (Unrestrained Passion)',
    icon: '🔥',
    category: 'content',
    guardBehavior: GuardBehavior.LOCK,
    emotionalValue: 'Take your intimacy to the next level',
  },
  [PremiumFeature.UNLIMITED_DATE_IDEAS]: {
    name: 'Unlimited Date Ideas',
    description: 'Full catalog with diverse date grouping',
    icon: '🌹',
    category: 'content',
    guardBehavior: GuardBehavior.LIMITED,
    emotionalValue: 'Never have a boring date night again',
  },
  [PremiumFeature.SURPRISE_ME]: {
    name: 'Surprise Me',
    description: 'Random date picker for spontaneous moments',
    icon: '🎲',
    category: 'content',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Add spontaneity to your relationship',
  },
  [PremiumFeature.UNLIMITED_JOURNAL_HISTORY]: {
    name: 'Full Journal History',
    description: 'See all your journal entries, not just the last 7',
    icon: '📖',
    category: 'memory',
    guardBehavior: GuardBehavior.BLUR,
    emotionalValue: 'Relive every precious memory',
  },
  [PremiumFeature.PDF_EXPORT]: {
    name: 'Memory Export',
    description: 'Export your relationship timeline as PDF',
    icon: '🏛️',
    category: 'memory',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Preserve your love story forever',
  },
  [PremiumFeature.VAULT_AND_BIOMETRIC]: {
    name: 'Private Vault',
    description: 'Biometric-locked storage for intimate memories',
    icon: '🔒',
    category: 'security',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Keep your private moments truly private',
  },
  [PremiumFeature.CUSTOM_RITUALS]: {
    name: 'Custom Rituals',
    description: 'Create personalized bedtime ritual flows',
    icon: '🌙',
    category: 'ritual',
    guardBehavior: GuardBehavior.HIDE,
    emotionalValue: 'Design intimate moments uniquely yours',
  },
  [PremiumFeature.RITUAL_REMINDERS]: {
    name: 'Ritual Reminders',
    description: 'Scheduled reminders for your rituals',
    icon: '⏰',
    category: 'ritual',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Build consistent connection habits',
  },
  [PremiumFeature.CLOUD_SYNC]: {
    name: 'Cloud Backup',
    description: 'Cloud backup & partner data sync',
    icon: '☁️',
    category: 'sync',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Never lose your precious memories',
  },
  [PremiumFeature.LUXURY_THEMES]: {
    name: 'Luxury Themes',
    description: 'Exclusive color palettes & anniversary themes',
    icon: '✨',
    category: 'customization',
    guardBehavior: GuardBehavior.LOCK,
    emotionalValue: 'Make every moment feel special',
  },
  [PremiumFeature.CUSTOM_HAPTICS]: {
    name: 'Custom Haptics',
    description: 'Personalized touch feedback',
    icon: '💫',
    category: 'customization',
    guardBehavior: GuardBehavior.LOCK,
    emotionalValue: 'Feel the connection in every touch',
  },
  [PremiumFeature.EDITORIAL_PROMPTS]: {
    name: 'Editorial Prompts',
    description: 'Curated editorial prompt experience',
    icon: '✍️',
    category: 'content',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Deeper conversations that matter',
  },
  [PremiumFeature.VIBE_SIGNAL]: {
    name: 'Vibe Signal',
    description: 'Send and receive vibe signals',
    icon: '📡',
    category: 'connection',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Stay in tune with your partner',
  },
  [PremiumFeature.NIGHT_RITUAL_MODE]: {
    name: 'Night Ritual Mode',
    description: 'Custom night ritual section',
    icon: '🌜',
    category: 'ritual',
    guardBehavior: GuardBehavior.HIDE,
    emotionalValue: 'End every day connected',
  },
  [PremiumFeature.PROMPT_REFRESH]: {
    name: 'Prompt Refresh',
    description: 'Swap for a different prompt on demand',
    icon: '🔄',
    category: 'content',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Always find the right conversation starter',
  },
  [PremiumFeature.AD_FREE]: {
    name: 'Ad-Free',
    description: 'No ads ever',
    icon: '🚫',
    category: 'quality',
    guardBehavior: GuardBehavior.HIDE,
    emotionalValue: 'Uninterrupted connection',
  },
});

/**
 * Helper: get the limit object for a given premium state
 */
export function getLimitsForTier(isPremiumEffective) {
  return isPremiumEffective ? PREMIUM_LIMITS : FREE_LIMITS;
}

/**
 * Helper: get the guard behavior for a feature
 */
export function getGuardBehavior(featureId) {
  return FEATURE_META[featureId]?.guardBehavior ?? GuardBehavior.BLOCK;
}

/**
 * Helper: get features by category
 */
export function getFeaturesByCategory(category) {
  return Object.entries(FEATURE_META)
    .filter(([, meta]) => meta.category === category)
    .map(([id, meta]) => ({ id, ...meta }));
}

/**
 * Helper: get all premium features as array
 */
export function getAllPremiumFeatures() {
  return Object.entries(FEATURE_META).map(([id, meta]) => ({ id, ...meta }));
}

/**
 * Helper: accessible heat levels for a tier
 */
export function getAccessibleHeatLevels(isPremiumEffective) {
  return isPremiumEffective ? PREMIUM_LIMITS.ALL_HEAT_LEVELS : FREE_LIMITS.FREE_HEAT_LEVELS;
}
