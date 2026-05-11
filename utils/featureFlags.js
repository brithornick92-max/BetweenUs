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
  UNLIMITED_DATE_IDEAS: 'unlimitedDateIdeas',
  SURPRISE_ME: 'surpriseMe',
  UNLIMITED_JOURNAL_HISTORY: 'unlimitedJournalHistory',
  PDF_EXPORT: 'pdfExport',
  VAULT_AND_BIOMETRIC: 'vaultAndBiometric',
  CLOUD_SYNC: 'cloudSync',
  EDITORIAL_PROMPTS: 'editorialPrompts',
  VIBE_SIGNAL: 'vibeSignal',
  PROMPT_REFRESH: 'promptRefresh',
  AD_FREE: 'adFree',
  CALENDAR: 'calendar',
  PARTNER_LINKING: 'partnerLinking',
  PROMPT_RESPONSES: 'promptResponses',
  INSIDE_JOKES: 'insideJokes',
  YEAR_REFLECTION: 'yearReflection',
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
  PROMPTS_PER_DAY: Infinity,    // Weekly deck + weekly answer quota drive free access, not daily locks
  DATE_IDEAS_PER_DAY: Infinity, // Weekly deck + weekly detail quota drive free access, not daily locks
  PREVIEW_PROMPTS_TOTAL: 0,     // Legacy preview packs are disabled; weekly decks drive free access
  VISIBLE_PROMPTS_PER_WEEK: 5, // Free users add 5 prompts per week after a 20-prompt starter library
  VISIBLE_DATE_IDEAS_PER_WEEK: 5, // Free users add 5 dates per week after a 20-date starter library
  VISIBLE_POSITIONS_PER_WEEK: 1, // Free users add 1 sex position per week to a growing library
  FULL_DATE_FLOWS_PER_WEEK: Infinity, // Planning stays usable on the free tier
  JOURNAL_ENTRIES_VISIBLE: Infinity, // Notes stay usable on the free tier
  FREE_HEAT_LEVELS: [1, 2, 3, 4, 5],
  FREE_LIBRARY_HEAT_LEVELS: [1, 2],
  FREE_DAILY_HEAT_LEVELS: [1, 2, 3],
  SURPRISE_ME_ENABLED: true,
  CALENDAR_ENABLED: true,
  PARTNER_LINKING_ENABLED: true,
  PROMPT_RESPONSES_ENABLED: true,
  CLOUD_SYNC_ENABLED: true,
  // Weekly access for free users
  WEEK_0_PROMPTS: 20,
  WEEK_0_DATES: 20,
  WEEK_0_POSITIONS: 5,
  WEEKLY_PROMPTS: 5,
  WEEKLY_DATES: 5,
  WEEKLY_POSITIONS: 1,
});

// ─── Premium Limits ─────────────────────────────────────────────────────────
export const PREMIUM_LIMITS = Object.freeze({
  // Premium is no longer "all access" but a weekly drip model.
  // The actual number of items will be determined by the user's
  // subscription duration (e.g., `weeksSubscribed`).
  PROMPTS_PER_DAY: Infinity,
  PREVIEW_PROMPTS_TOTAL: 0, // No concept of "previews" for premium
  FULL_DATE_FLOWS_PER_WEEK: Infinity,
  JOURNAL_ENTRIES_VISIBLE: Infinity,
  ALL_HEAT_LEVELS: [1, 2, 3, 4, 5],
  SURPRISE_ME_ENABLED: true,
  CALENDAR_ENABLED: true,
  PARTNER_LINKING_ENABLED: true,
  PROMPT_RESPONSES_ENABLED: true,
  CLOUD_SYNC_ENABLED: true,
  // Week 0 starting library for premium users
  WEEK_0_PROMPTS: 100,
  WEEK_0_DATES: 100,
  WEEK_0_POSITIONS: 10,
  // Weekly content drops for premium users
  WEEKLY_PROMPTS: 15,
  WEEKLY_DATES: 15,
  WEEKLY_POSITIONS: 3,
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
    name: 'Growing Prompt Library',
    description: 'Free users start with 20 prompts and add 5 more each week. Premium users start with 100 prompts and add 15 more each week.',
    icon: 'flame-outline',
    category: 'content',
    guardBehavior: GuardBehavior.LIMITED,
    emotionalValue: 'Keep leaving small pieces of your heart for each other',
  },
  [PremiumFeature.UNLIMITED_DATE_IDEAS]: {
    name: 'Endless Date Inspiration',
    description: 'Free users start with 20 date ideas and add 5 more each week. Premium users start with 100 date ideas and add 15 more each week.',
    icon: 'flower-outline',
    category: 'content',
    guardBehavior: GuardBehavior.LIMITED,
    emotionalValue: 'Turn what you both want into time together',
  },
  [PremiumFeature.SURPRISE_ME]: {
    name: 'Today Mode',
    description: 'A focused connection moment for cozy, playful, romantic, sensual, or after-a-long-day nights',
    icon: 'dice-outline',
    category: 'content',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Make sex easier to start',
  },
  [PremiumFeature.UNLIMITED_JOURNAL_HISTORY]: {
    name: 'Full Keepsake Archive',
    description: 'Free Keepsake shows the last 30 days. Premium unlocks your full archive of photos, notes, prompt answers, dates, and sex positions.',
    icon: 'book-outline',
    category: 'memory',
    guardBehavior: GuardBehavior.BLUR,
    emotionalValue: 'Keep the little things your partner leaves for you',
  },
  [PremiumFeature.PDF_EXPORT]: {
    name: 'Keepsake Export',
    description: 'Export your private story, favorite answers, notes, and memories as a keepsake',
    icon: 'library-outline',
    category: 'memory',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Preserve the story only you two share',
  },
  [PremiumFeature.VAULT_AND_BIOMETRIC]: {
    name: 'Private Vault',
    description: 'Biometric-locked storage for intimate memories',
    icon: 'lock-closed-outline',
    category: 'security',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Keep your relationship memories secure and protected',
  },
  [PremiumFeature.CLOUD_SYNC]: {
    name: 'Private Archive Sync',
    description: 'Supabase sync for your shared archive, linked devices, and backup-based recovery',
    icon: 'cloud-outline',
    category: 'sync',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Keep your private world safe across both phones',
  },
  [PremiumFeature.EDITORIAL_PROMPTS]: {
    name: 'Prompt Packs',
    description: 'Curated packs for busy weeks, date nights, long-term love, reconnection, romance, and spark',
    icon: 'create-outline',
    category: 'content',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Keep the ritual fresh without making it feel like work',
  },
  [PremiumFeature.VIBE_SIGNAL]: {
    name: 'Vibe Signal Screen',
    description: 'Premium access to real-time mood and heartbeat-style signals for linked partners.',
    icon: 'radio-outline',
    category: 'connection',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Let them feel chosen in the middle of ordinary life',
  },
  [PremiumFeature.PROMPT_REFRESH]: {
    name: 'Prompt Refresh',
    description: 'Swap for a different prompt on demand',
    icon: 'refresh-outline',
    category: 'content',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Always find the right conversation starter',
  },
  [PremiumFeature.AD_FREE]: {
    name: 'Ad-Free',
    description: 'No ads ever',
    icon: 'ban-outline',
    category: 'quality',
    guardBehavior: GuardBehavior.HIDE,
    emotionalValue: 'Uninterrupted connection',
  },
  [PremiumFeature.CALENDAR]: {
    name: 'Shared Date Calendar',
    description: 'Plan date nights, rituals, anniversaries, and reminders in your private couple space',
    icon: 'calendar-outline',
    category: 'planning',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Make time together easier to choose',
  },
  [PremiumFeature.PARTNER_LINKING]: {
    name: 'Partner Connection',
    description: 'Partner linking with a private code and shared premium access for linked accounts when one partner upgrades',
    icon: 'heart-outline',
    category: 'connection',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Build your shared love story together',
  },
  [PremiumFeature.PROMPT_RESPONSES]: {
    name: 'Shared Reveals',
    description: 'Write privately, reveal together, and save favorite answers to your story',
    icon: 'pencil-outline',
    category: 'content',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Feel known without turning connection into homework',
  },
  [PremiumFeature.INSIDE_JOKES]: {
    name: 'Inside Jokes Vault',
    description: 'A private vault for your nicknames, inside jokes, and personal references',
    icon: 'lock-closed-outline',
    category: 'memory',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Celebrate the language only you two share',
  },
  [PremiumFeature.YEAR_REFLECTION]: {
    name: 'Couple Recaps',
    description: 'Weekly, monthly, and annual recaps of your sweetest answers, themes, spark, and memories',
    icon: 'calendar-number-outline',
    category: 'memory',
    guardBehavior: GuardBehavior.HIDE,
    emotionalValue: 'See the love you are still building',
  },
});

// ─── Paywall Feature List (live + premium-gated) ─────────────────────────────
// Only include features that are currently premium AND fully available in-app.
export const PAYWALL_FEATURE_IDS = Object.freeze([
  PremiumFeature.UNLIMITED_PROMPTS,
  PremiumFeature.UNLIMITED_DATE_IDEAS,
  PremiumFeature.VIBE_SIGNAL,
  PremiumFeature.UNLIMITED_JOURNAL_HISTORY,
]);

const LEGACY_PREMIUM_FEATURE_ALIASES = Object.freeze({
  GENERAL_UPGRADE: null,
  DATE_NIGHT_BROWSE: PremiumFeature.UNLIMITED_DATE_IDEAS,
  DATE_NIGHT_DETAILS: PremiumFeature.UNLIMITED_DATE_IDEAS,
  UNLIMITED_DATE_IDEAS: PremiumFeature.UNLIMITED_DATE_IDEAS,
  vaultAndBiometric: PremiumFeature.VAULT_AND_BIOMETRIC,
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
 * Helper: get paywall features (curated list of live, premium-gated items)
 */
export function getPaywallFeatures() {
  return PAYWALL_FEATURE_IDS
    .map((id) => ({ id, ...(FEATURE_META[id] || {}) }))
    .filter((item) => item?.name && item?.description);
}

/**
 * Helper: true only for live features that should actually block free users.
 * Privacy, safety, account, sync, calendar, partner-linking, and export controls
 * remain part of the core app unless they are explicitly added to this curated list.
 */
export function isPremiumGatedFeature(featureId) {
  return PAYWALL_FEATURE_IDS.includes(featureId);
}

/**
 * Helper: normalize legacy or mixed-case feature ids to canonical PremiumFeature values.
 * Returns null for generic upgrade flows and unknown values for invalid ids.
 */
export function normalizePremiumFeatureId(featureId) {
  if (featureId == null) return null;
  if (Object.values(PremiumFeature).includes(featureId)) {
    return featureId;
  }
  if (Object.prototype.hasOwnProperty.call(LEGACY_PREMIUM_FEATURE_ALIASES, featureId)) {
    return LEGACY_PREMIUM_FEATURE_ALIASES[featureId];
  }
  return undefined;
}

/**
 * Helper: validate whether a value maps to a known premium feature.
 */
export function isKnownPremiumFeatureId(featureId) {
  return normalizePremiumFeatureId(featureId) !== undefined;
}

/**
 * Helper: accessible heat levels for a tier
 */
export function getAccessibleHeatLevels(isPremiumEffective) {
  return isPremiumEffective ? PREMIUM_LIMITS.ALL_HEAT_LEVELS : FREE_LIMITS.FREE_HEAT_LEVELS;
}

// ─── Timed Content Unlocks ─────────────────────────────────────────────────────
// Every Friday, free users get expanded date browsing to build habit + FOMO.

/**
 * Check if today is a "free unlock" day (Friday).
 * Returns boosted limits for free users on unlock days.
 */
export function getTimedUnlockLimits(isPremiumEffective) {
  return null;
}
