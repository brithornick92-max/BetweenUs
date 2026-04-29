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
  PROMPTS_PER_DAY: 1,           // One daily prompt response to prove the shared reveal loop
  PREVIEW_PROMPTS_TOTAL: 12,    // A fixed welcome pack of preview prompts
  VISIBLE_PROMPTS_PER_WEEK: 3,  // Weekly free preview of new & premium prompts (tightened from 5)
  VISIBLE_DATE_IDEAS_PER_WEEK: 3, // Weekly free preview of date ideas (tightened from 5)
  VISIBLE_POSITIONS_PER_WEEK: 1, // A smaller weekly preview for intimacy positions (tightened from 2)
  FULL_DATE_FLOWS_PER_WEEK: 1,  // One fully planned date flow per week (tightened from 2)
  JOURNAL_ENTRIES_VISIBLE: 0,   // No journal access
  FREE_HEAT_LEVELS: [1, 2, 3, 4, 5],
  SURPRISE_ME_ENABLED: false,
  CALENDAR_ENABLED: false,
  PARTNER_LINKING_ENABLED: true,
  PROMPT_RESPONSES_ENABLED: true,
  CLOUD_SYNC_ENABLED: false,
  // Week 0 starting library for free users
  WEEK_0_PROMPTS: 30,
  WEEK_0_DATES: 25,
  WEEK_0_POSITIONS: 5,
  // Weekly content drops for free users
  WEEKLY_PROMPTS: 5,
  WEEKLY_DATES: 3,
  WEEKLY_POSITIONS: 1,
});

// ─── Premium Limits (effectively unlimited) ─────────────────────────────────────
export const PREMIUM_LIMITS = Object.freeze({
  // Premium is no longer "all access" but a weekly drip model.
  // The actual number of items will be determined by the user's
  // subscription duration (e.g., `weeksSubscribed`).
  PROMPTS_PER_DAY: 10, // A high but not infinite number for daily interaction
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
  WEEK_0_PROMPTS: 200,
  WEEK_0_DATES: 200,
  WEEK_0_POSITIONS: 10,
  // Weekly content drops for premium users
  WEEKLY_PROMPTS: 10,
  WEEKLY_DATES: 8,
  WEEKLY_POSITIONS: 2,
});

// ─── Fixed Preview Prompts for Free Users ────────────────────────────────────
// Hand-picked preview prompts across all heat levels to build habit before gating.
export const FREE_PREVIEW_PROMPTS = Object.freeze([
  {
    id: 'free_preview_h1',
    text: "What's one small thing I do that makes you feel truly loved?",
    category: 'emotional',
    heat: 1,
    isPreview: true,
  },
  {
    id: 'free_preview_h2',
    text: "If we could relive one date from our relationship, which would you pick and why?",
    category: 'romance',
    heat: 2,
    isPreview: true,
  },
  {
    id: 'free_preview_h3',
    text: "What's something you've always wanted to try together but haven't brought up yet?",
    category: 'physical',
    heat: 3,
    isPreview: true,
  },
  {
    id: 'free_preview_h1b',
    text: "What's a moment from this week where you felt most connected to me?",
    category: 'emotional',
    heat: 1,
    isPreview: true,
  },
  {
    id: 'free_preview_h1c',
    text: "What's one dream you haven't told me about yet?",
    category: 'emotional',
    heat: 1,
    isPreview: true,
  },
  {
    id: 'free_preview_h2b',
    text: "What song makes you think of us — and why?",
    category: 'romance',
    heat: 2,
    isPreview: true,
  },
  {
    id: 'free_preview_h2c',
    text: "Describe your perfect lazy Sunday with me.",
    category: 'romance',
    heat: 2,
    isPreview: true,
  },
  {
    id: 'free_preview_h1d',
    text: "What's something I said once that you still think about?",
    category: 'emotional',
    heat: 1,
    isPreview: true,
  },
  {
    id: 'free_preview_h2d',
    text: "If we had no responsibilities for 48 hours, what would we do?",
    category: 'romance',
    heat: 2,
    isPreview: true,
  },
  {
    id: 'free_preview_h3b',
    text: "What's a new experience you'd love for us to share this month?",
    category: 'physical',
    heat: 3,
    isPreview: true,
  },
  {
    id: 'free_preview_h4',
    text: "What's a more daring version of closeness you'd want to explore with clear boundaries?",
    category: 'sensual',
    heat: 4,
    isPreview: true,
  },
  {
    id: 'free_preview_h5',
    text: "What's one explicit desire you'd only want us to explore if we both felt fully safe and enthusiastic?",
    category: 'intimacy',
    heat: 5,
    isPreview: true,
  },
]);

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
    description: 'Unlock our full library of 700+ prompts over time, with new additions released to you every week.',
    icon: '🔥',
    category: 'content',
    guardBehavior: GuardBehavior.LIMITED,
    emotionalValue: 'Keep leaving small pieces of your heart for each other',
  },
  [PremiumFeature.HEAT_LEVELS_4_5]: {
    name: 'Unlock All 5 Heat Levels',
    description: 'Explore our full catalog of prompts and date ideas, from soft and romantic to steamy and adventurous.',
    icon: '🔥',
    category: 'content',
    guardBehavior: GuardBehavior.LIMITED,
    emotionalValue: 'Keep desire playful, private, chosen together, and refreshed',
  },
  [PremiumFeature.UNLIMITED_DATE_IDEAS]: {
    name: 'Endless Date Inspiration',
    description: 'Get personalized date ideas from a library of 500+ experiences, with new ideas released to you weekly.',
    icon: '🌹',
    category: 'content',
    guardBehavior: GuardBehavior.LIMITED,
    emotionalValue: 'Turn what you both want into time together',
  },
  [PremiumFeature.SURPRISE_ME]: {
    name: 'Today Mode',
    description: 'A focused connection moment for cozy, playful, romantic, sensual, or after-a-long-day nights',
    icon: '🎲',
    category: 'content',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Make intimacy easier to start',
  },
  [PremiumFeature.UNLIMITED_JOURNAL_HISTORY]: {
    name: 'Private Notes',
    description: 'Write, save, and revisit notes, reflections, and open-when messages',
    icon: '📖',
    category: 'memory',
    guardBehavior: GuardBehavior.BLUR,
    emotionalValue: 'Keep the little things your partner leaves for you',
  },
  [PremiumFeature.PDF_EXPORT]: {
    name: 'Keepsake Export',
    description: 'Export your private story, favorite answers, notes, and memories as a keepsake',
    icon: '🏛️',
    category: 'memory',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Preserve the story only you two share',
  },
  [PremiumFeature.VAULT_AND_BIOMETRIC]: {
    name: 'Private Vault',
    description: 'Biometric-locked storage for intimate memories',
    icon: '🔒',
    category: 'security',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Keep your relationship memories secure and protected',
  },
  [PremiumFeature.CLOUD_SYNC]: {
    name: 'Private Archive Sync',
    description: 'Supabase sync for your shared archive, linked devices, and backup-based recovery',
    icon: '☁️',
    category: 'sync',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Keep your private world safe across both phones',
  },
  [PremiumFeature.EDITORIAL_PROMPTS]: {
    name: 'Prompt Packs',
    description: 'Curated packs for busy weeks, date nights, long-term love, reconnection, romance, and spark',
    icon: '✍️',
    category: 'content',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Keep the ritual fresh without making it feel like work',
  },
  [PremiumFeature.VIBE_SIGNAL]: {
    name: 'Love Signals',
    description: 'Send low-friction notes, photos, moods, and thinking-of-you moments',
    icon: '📡',
    category: 'connection',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Let them feel chosen in the middle of ordinary life',
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
  [PremiumFeature.CALENDAR]: {
    name: 'Shared Date Calendar',
    description: 'Plan date nights, rituals, anniversaries, and reminders in your private couple space',
    icon: '📅',
    category: 'planning',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Make time together easier to choose',
  },
  [PremiumFeature.PARTNER_LINKING]: {
    name: 'Partner Connection',
    description: 'Partner linking with a private code and shared premium access for linked accounts when one partner upgrades',
    icon: '💞',
    category: 'connection',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Build your shared love story together',
  },
  [PremiumFeature.PROMPT_RESPONSES]: {
    name: 'Shared Reveals',
    description: 'Write privately, reveal together, and save favorite answers to your story',
    icon: '✏️',
    category: 'content',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Feel known without turning connection into homework',
  },
  [PremiumFeature.INSIDE_JOKES]: {
    name: 'Inside Jokes Vault',
    description: 'A private vault for your nicknames, inside jokes, and personal references',
    icon: '🤫',
    category: 'memory',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Celebrate the language only you two share',
  },
  [PremiumFeature.YEAR_REFLECTION]: {
    name: 'Couple Recaps',
    description: 'Weekly, monthly, and annual recaps of your sweetest answers, themes, spark, and memories',
    icon: '📆',
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
  PremiumFeature.CLOUD_SYNC,
  PremiumFeature.CALENDAR,
  PremiumFeature.VAULT_AND_BIOMETRIC,
  PremiumFeature.INSIDE_JOKES,
  PremiumFeature.YEAR_REFLECTION,
  PremiumFeature.VIBE_SIGNAL,
]);

const LEGACY_PREMIUM_FEATURE_ALIASES = Object.freeze({
  GENERAL_UPGRADE: null,
  DATE_NIGHT_BROWSE: PremiumFeature.UNLIMITED_DATE_IDEAS,
  DATE_NIGHT_DETAILS: PremiumFeature.UNLIMITED_DATE_IDEAS,
  UNLIMITED_DATE_IDEAS: PremiumFeature.UNLIMITED_DATE_IDEAS,
  heatLevels4to5: PremiumFeature.HEAT_LEVELS_4_5,
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
  if (isPremiumEffective) return null; // Premium users don't need unlocks
  const dayOfWeek = new Date().getDay(); // 0=Sun, 5=Fri
  if (dayOfWeek !== 5) return null;
  return {
    isUnlockDay: true,
    unlockLabel: 'Friday Date Night',
    VISIBLE_DATE_IDEAS: 5,         // Expanded daily date preview (tightened from 10)
    DATE_IDEAS_PER_DAY: 5,         // Expanded daily date browsing (tightened from 10)
    PROMPTS_PER_DAY: 2,            // Expanded preview instead of the usual 1 (tightened from 3)
  };
}
