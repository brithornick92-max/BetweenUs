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
  EDITORIAL_PROMPTS: 'editorialPrompts',
  VIBE_SIGNAL: 'vibeSignal',
  NIGHT_RITUAL_MODE: 'nightRitualMode',
  PROMPT_REFRESH: 'promptRefresh',
  AD_FREE: 'adFree',
  LOVE_NOTES: 'loveNotes',
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
  PROMPTS_PER_DAY: 1,           // One guided prompt response per day
  PREVIEW_PROMPTS_TOTAL: 10,    // 10 preview prompts to build habit before gating
  DATE_IDEAS_PER_DAY: 3,        // 3 preview date ideas per day
  FULL_DATE_FLOWS_PER_WEEK: 1,  // One fully planned date flow per week
  VISIBLE_DATE_IDEAS: 3,        // 3 preview date ideas visible for free users
  JOURNAL_ENTRIES_VISIBLE: 0,   // No journal access
  FREE_HEAT_LEVELS: [1, 2, 3],
  SURPRISE_ME_ENABLED: false,
  LOVE_NOTES_ENABLED: false,
  CALENDAR_ENABLED: false,
  PARTNER_LINKING_ENABLED: true,
  PROMPT_RESPONSES_ENABLED: true,
  CLOUD_SYNC_ENABLED: false,
});

// ─── Premium Limits (effectively unlimited) ─────────────────────────────────────
export const PREMIUM_LIMITS = Object.freeze({
  PROMPTS_PER_DAY: Infinity,
  PREVIEW_PROMPTS_TOTAL: Infinity,
  DATE_IDEAS_PER_DAY: Infinity,
  FULL_DATE_FLOWS_PER_WEEK: Infinity,
  VISIBLE_DATE_IDEAS: Infinity,
  JOURNAL_ENTRIES_VISIBLE: Infinity,
  ALL_HEAT_LEVELS: [1, 2, 3, 4, 5],
  SURPRISE_ME_ENABLED: true,
  LOVE_NOTES_ENABLED: true,
  CALENDAR_ENABLED: true,
  PARTNER_LINKING_ENABLED: true,
  PROMPT_RESPONSES_ENABLED: true,
  CLOUD_SYNC_ENABLED: true,
});

// ─── Fixed Preview Prompts for Free Users ────────────────────────────────────
// 10 hand-picked preview prompts across heat levels 1-3 to build habit before gating.
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
    name: 'Unlimited Prompts',
    description: 'Unlimited prompts with full access to Heat Levels 1–5, prompt history & favorites, and Surprise Me generator',
    icon: '🔥',
    category: 'content',
    guardBehavior: GuardBehavior.LIMITED,
    emotionalValue: 'Never run out of things to talk about',
  },
  [PremiumFeature.HEAT_LEVELS_4_5]: {
    name: 'All Heat Levels',
    description: 'Explore levels 4 (Steamy) & 5 (Explicit)',
    icon: '🔥',
    category: 'content',
    guardBehavior: GuardBehavior.LOCK,
    emotionalValue: 'Take your intimacy to the next level',
  },
  [PremiumFeature.UNLIMITED_DATE_IDEAS]: {
    name: 'Unlimited Date Ideas',
    description: 'Full catalog of date ideas with multi-dimensional filtering by mood, style, and budget',
    icon: '🌹',
    category: 'content',
    guardBehavior: GuardBehavior.LIMITED,
    emotionalValue: 'Never have a boring date night again',
  },
  [PremiumFeature.SURPRISE_ME]: {
    name: 'Surprise Me',
    description: 'Curated date picker for spontaneous moments',
    icon: '🎲',
    category: 'content',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Add spontaneity to your connection',
  },
  [PremiumFeature.UNLIMITED_JOURNAL_HISTORY]: {
    name: 'Full Journal History',
    description: 'Full journal access — write, save, and revisit all your entries',
    icon: '📖',
    category: 'memory',
    guardBehavior: GuardBehavior.BLUR,
    emotionalValue: 'Relive every precious memory',
  },
  [PremiumFeature.PDF_EXPORT]: {
    name: 'Memory Export',
    description: 'Export your shared timeline as PDF',
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
    name: 'Privacy & Cloud Sync',
    description: 'Encrypted storage for synced content, premium cloud sync for linked couples, and backup-based recovery for synced data',
    icon: '🔐',
    category: 'sync',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Your data is never sold or shared',
  },
  [PremiumFeature.EDITORIAL_PROMPTS]: {
    name: 'Editorial Prompts',
    description: 'Editorially curated deep-conversation prompts with themed seasons and partner reveal',
    icon: '✍️',
    category: 'content',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Deeper conversations that matter',
  },
  [PremiumFeature.VIBE_SIGNAL]: {
    name: 'Vibe Signal',
    description: 'Share your emotional state with your partner and stay in tune throughout the day',
    icon: '📡',
    category: 'connection',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Stay in tune with your partner',
  },
  [PremiumFeature.NIGHT_RITUAL_MODE]: {
    name: 'Night Ritual Mode',
    description: 'Guided bedtime connection rituals for winding down together',
    icon: '🌜',
    category: 'ritual',
    guardBehavior: GuardBehavior.LOCK,
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
  [PremiumFeature.LOVE_NOTES]: {
    name: 'Love Notes',
    description: 'Send and receive private love notes with encrypted sync, optional notifications, and access across linked devices',
    icon: '💌',
    category: 'connection',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Express your love in your own words',
  },
  [PremiumFeature.CALENDAR]: {
    name: 'Shared Calendar',
    description: 'Add, edit, and schedule date nights, anniversaries, and special moments with reminders and shared visibility',
    icon: '📅',
    category: 'planning',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Protect time for what matters most',
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
    name: 'Prompt Responses',
    description: 'Write, save, and share your responses with your partner',
    icon: '✏️',
    category: 'content',
    guardBehavior: GuardBehavior.BLOCK,
    emotionalValue: 'Capture your thoughts and grow together',
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
    name: 'Year in Review',
    description: 'A personalized recap of your milestones, memories, and growth together over the year',
    icon: '📆',
    category: 'memory',
    guardBehavior: GuardBehavior.HIDE,
    emotionalValue: 'See how far you\'ve come together',
  },
});

// ─── Paywall Feature List (live + premium-gated) ─────────────────────────────
// Only include features that are currently premium AND fully available in-app.
export const PAYWALL_FEATURE_IDS = Object.freeze([
  PremiumFeature.UNLIMITED_PROMPTS,
  PremiumFeature.UNLIMITED_DATE_IDEAS,
  PremiumFeature.LOVE_NOTES,
  PremiumFeature.NIGHT_RITUAL_MODE,
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
  NIGHT_RITUAL_MODE: PremiumFeature.NIGHT_RITUAL_MODE,
  heatLevels4to5: PremiumFeature.HEAT_LEVELS_4_5,
  ritualReminders: PremiumFeature.RITUAL_REMINDERS,
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
    VISIBLE_DATE_IDEAS: 10,        // 10 instead of 3
    DATE_IDEAS_PER_DAY: 10,        // 10 instead of 3
    PROMPTS_PER_DAY: 3,            // 3 instead of 1
  };
}
