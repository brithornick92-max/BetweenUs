/**
 * featureFlags.test.js — Tests for the single source of truth for premium features
 */

import {
  PremiumFeature,
  GuardBehavior,
  FREE_LIMITS,
  PREMIUM_LIMITS,
  FEATURE_META,
  PAYWALL_FEATURE_IDS,
  getLimitsForTier,
  getGuardBehavior,
  getFeaturesByCategory,
  getAllPremiumFeatures,
  getPaywallFeatures,
  getAccessibleHeatLevels,
  getTimedUnlockLimits,
} from '../../utils/featureFlags';

// ─── Enums ───────────────────────────────────────────────────────────────────

describe('PremiumFeature enum', () => {
  it('contains all 16 active features', () => {
    const features = Object.keys(PremiumFeature);
    expect(features.length).toBe(16);
  });

  it('is frozen (immutable)', () => {
    expect(Object.isFrozen(PremiumFeature)).toBe(true);
  });

  it('has no duplicate values', () => {
    const values = Object.values(PremiumFeature);
    expect(new Set(values).size).toBe(values.length);
  });

  it('includes critical features', () => {
    expect(PremiumFeature.UNLIMITED_PROMPTS).toBe('unlimitedPrompts');
    expect(PremiumFeature.CLOUD_SYNC).toBe('cloudSync');
    expect(PremiumFeature.PARTNER_LINKING).toBe('partnerLinking');
  });
});

describe('GuardBehavior enum', () => {
  it('has exactly 5 behaviors', () => {
    expect(Object.keys(GuardBehavior).length).toBe(5);
  });

  it('contains BLOCK, BLUR, LOCK, LIMITED, HIDE', () => {
    expect(GuardBehavior.BLOCK).toBe('BLOCK');
    expect(GuardBehavior.BLUR).toBe('BLUR');
    expect(GuardBehavior.LOCK).toBe('LOCK');
    expect(GuardBehavior.LIMITED).toBe('LIMITED');
    expect(GuardBehavior.HIDE).toBe('HIDE');
  });
});

// ─── Limits ──────────────────────────────────────────────────────────────────

describe('FREE_LIMITS', () => {
  it('does not use daily prompt locks on the free tier', () => {
    expect(FREE_LIMITS.PROMPTS_PER_DAY).toBe(Infinity);
  });

  it('does not use daily date locks on the free tier', () => {
    expect(FREE_LIMITS.DATE_IDEAS_PER_DAY).toBe(Infinity);
  });

  it('keeps date planning available on the free tier', () => {
    expect(FREE_LIMITS.FULL_DATE_FLOWS_PER_WEEK).toBe(Infinity);
  });

  it('does not use the old fixed preview prompt pack', () => {
    expect(FREE_LIMITS.PREVIEW_PROMPTS_TOTAL).toBe(0);
  });

  it('allows free previews across all heat levels', () => {
    expect(FREE_LIMITS.FREE_HEAT_LEVELS).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps free weekly libraries lower-intensity than general previews', () => {
    expect(FREE_LIMITS.FREE_LIBRARY_HEAT_LEVELS).toEqual([1, 2]);
    expect(FREE_LIMITS.FREE_DAILY_HEAT_LEVELS).toEqual([1, 2, 3]);
  });

  it('uses the new cumulative free content growth sizes', () => {
    expect(FREE_LIMITS.VISIBLE_PROMPTS_PER_WEEK).toBe(5);
    expect(FREE_LIMITS.VISIBLE_DATE_IDEAS_PER_WEEK).toBe(5);
    expect(FREE_LIMITS.VISIBLE_POSITIONS_PER_WEEK).toBe(1);
    expect(FREE_LIMITS.WEEK_0_PROMPTS).toBe(20);
    expect(FREE_LIMITS.WEEK_0_DATES).toBe(20);
    expect(FREE_LIMITS.WEEK_0_POSITIONS).toBe(5);
  });

  it('keeps the core app experience available on free', () => {
    expect(FREE_LIMITS.SURPRISE_ME_ENABLED).toBe(true);
    expect(FREE_LIMITS.CALENDAR_ENABLED).toBe(true);
    expect(FREE_LIMITS.PARTNER_LINKING_ENABLED).toBe(true);
    expect(FREE_LIMITS.CLOUD_SYNC_ENABLED).toBe(true);
  });

  it('keeps prompt responses available on the free tier', () => {
    expect(FREE_LIMITS.PROMPT_RESPONSES_ENABLED).toBe(true);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(FREE_LIMITS)).toBe(true);
  });
});

describe('PREMIUM_LIMITS', () => {
  it('allows unlimited daily prompt interaction', () => {
    expect(PREMIUM_LIMITS.PROMPTS_PER_DAY).toBe(Infinity);
  });

  it('unlocks all 5 heat levels', () => {
    expect(PREMIUM_LIMITS.ALL_HEAT_LEVELS).toEqual([1, 2, 3, 4, 5]);
  });

  it('enables all premium features', () => {
    expect(PREMIUM_LIMITS.SURPRISE_ME_ENABLED).toBe(true);
    expect(PREMIUM_LIMITS.CALENDAR_ENABLED).toBe(true);
    expect(PREMIUM_LIMITS.PARTNER_LINKING_ENABLED).toBe(true);
    expect(PREMIUM_LIMITS.CLOUD_SYNC_ENABLED).toBe(true);
  });

  it('uses the premium cumulative content growth sizes', () => {
    expect(PREMIUM_LIMITS.WEEK_0_PROMPTS).toBe(100);
    expect(PREMIUM_LIMITS.WEEK_0_DATES).toBe(100);
    expect(PREMIUM_LIMITS.WEEK_0_POSITIONS).toBe(10);
    expect(PREMIUM_LIMITS.WEEKLY_PROMPTS).toBe(15);
    expect(PREMIUM_LIMITS.WEEKLY_DATES).toBe(15);
    expect(PREMIUM_LIMITS.WEEKLY_POSITIONS).toBe(3);
  });
});

// ─── Feature Metadata ─────────────────────────────────────────────────────────

describe('FEATURE_META', () => {
  it('has metadata for every PremiumFeature', () => {
    Object.values(PremiumFeature).forEach(featureId => {
      expect(FEATURE_META[featureId]).toBeDefined();
      expect(FEATURE_META[featureId].name).toBeDefined();
      expect(FEATURE_META[featureId].description).toBeDefined();
      expect(FEATURE_META[featureId].icon).toBeDefined();
      expect(FEATURE_META[featureId].category).toBeDefined();
      expect(FEATURE_META[featureId].guardBehavior).toBeDefined();
      expect(FEATURE_META[featureId].emotionalValue).toBeDefined();
    });
  });

  it('only uses valid GuardBehavior values', () => {
    const validBehaviors = new Set(Object.values(GuardBehavior));
    Object.values(FEATURE_META).forEach(meta => {
      expect(validBehaviors.has(meta.guardBehavior)).toBe(true);
    });
  });
});

// ─── Paywall Features ─────────────────────────────────────────────────────────

describe('PAYWALL_FEATURE_IDS', () => {
  it('only references valid PremiumFeature values', () => {
    const validFeatures = new Set(Object.values(PremiumFeature));
    PAYWALL_FEATURE_IDS.forEach(id => {
      expect(validFeatures.has(id)).toBe(true);
    });
  });

  it('has no duplicates', () => {
    expect(new Set(PAYWALL_FEATURE_IDS).size).toBe(PAYWALL_FEATURE_IDS.length);
  });
});

// ─── Helper Functions ─────────────────────────────────────────────────────────

describe('getLimitsForTier', () => {
  it('returns FREE_LIMITS for non-premium users', () => {
    expect(getLimitsForTier(false)).toBe(FREE_LIMITS);
  });

  it('returns PREMIUM_LIMITS for premium users', () => {
    expect(getLimitsForTier(true)).toBe(PREMIUM_LIMITS);
  });
});

describe('getGuardBehavior', () => {
  it('returns correct behavior for known features', () => {
    expect(getGuardBehavior(PremiumFeature.UNLIMITED_PROMPTS)).toBe(GuardBehavior.LIMITED);
    expect(getGuardBehavior(PremiumFeature.SURPRISE_ME)).toBe(GuardBehavior.BLOCK);
    expect(getGuardBehavior(PremiumFeature.UNLIMITED_JOURNAL_HISTORY)).toBe(GuardBehavior.BLUR);
  });

  it('returns BLOCK for unknown features', () => {
    expect(getGuardBehavior('nonexistent_feature')).toBe(GuardBehavior.BLOCK);
  });
});

describe('getFeaturesByCategory', () => {
  it('returns content features', () => {
    const content = getFeaturesByCategory('content');
    expect(content.length).toBeGreaterThan(0);
    content.forEach(f => expect(f.category).toBe('content'));
  });

  it('returns connection features', () => {
    const connection = getFeaturesByCategory('connection');
    expect(connection.length).toBeGreaterThan(0);
  });

  it('returns empty for unknown category', () => {
    expect(getFeaturesByCategory('nonexistent')).toEqual([]);
  });
});

describe('getAllPremiumFeatures', () => {
  it('returns all features', () => {
    const all = getAllPremiumFeatures();
    expect(all.length).toBe(Object.keys(FEATURE_META).length);
  });

  it('each feature has id and name', () => {
    getAllPremiumFeatures().forEach(f => {
      expect(f.id).toBeDefined();
      expect(f.name).toBeDefined();
    });
  });
});

describe('getPaywallFeatures', () => {
  it('returns only features with name and description', () => {
    const features = getPaywallFeatures();
    features.forEach(f => {
      expect(f.name).toBeDefined();
      expect(f.description).toBeDefined();
    });
  });

  it('length matches PAYWALL_FEATURE_IDS', () => {
    expect(getPaywallFeatures().length).toBe(PAYWALL_FEATURE_IDS.length);
  });
});

describe('getAccessibleHeatLevels', () => {
  it('returns [1,2,3,4,5] for free users', () => {
    expect(getAccessibleHeatLevels(false)).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns [1,2,3,4,5] for premium users', () => {
    expect(getAccessibleHeatLevels(true)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('getTimedUnlockLimits', () => {
  it('returns null for both free and premium users', () => {
    expect(getTimedUnlockLimits(true)).toBeNull();
    expect(getTimedUnlockLimits(false)).toBeNull();
  });
});
