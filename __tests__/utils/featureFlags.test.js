/**
 * featureFlags.test.js — Tests for the single source of truth for premium features
 */

import {
  PremiumFeature,
  GuardBehavior,
  FREE_LIMITS,
  PREMIUM_LIMITS,
  FREE_PREVIEW_PROMPTS,
  UsageEventType,
  PremiumSource,
  FEATURE_META,
  PAYWALL_FEATURE_IDS,
  getLimitsForTier,
  getGuardBehavior,
  getFeaturesByCategory,
  getAllPremiumFeatures,
  getPaywallFeatures,
  getAccessibleHeatLevels,
} from '../../utils/featureFlags';

// ─── Enums ───────────────────────────────────────────────────────────────────

describe('PremiumFeature enum', () => {
  it('contains all 19 features', () => {
    const features = Object.keys(PremiumFeature);
    expect(features.length).toBe(19);
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
    expect(PremiumFeature.HEAT_LEVELS_4_5).toBe('heatLevels4to5');
    expect(PremiumFeature.CLOUD_SYNC).toBe('cloudSync');
    expect(PremiumFeature.LOVE_NOTES).toBe('loveNotes');
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
  it('allows zero daily prompts', () => {
    expect(FREE_LIMITS.PROMPTS_PER_DAY).toBe(0);
  });

  it('has exactly 3 preview prompts', () => {
    expect(FREE_LIMITS.PREVIEW_PROMPTS_TOTAL).toBe(3);
  });

  it('restricts heat levels to 1-3', () => {
    expect(FREE_LIMITS.FREE_HEAT_LEVELS).toEqual([1, 2, 3]);
  });

  it('disables premium-only features', () => {
    expect(FREE_LIMITS.SURPRISE_ME_ENABLED).toBe(false);
    expect(FREE_LIMITS.LOVE_NOTES_ENABLED).toBe(false);
    expect(FREE_LIMITS.CALENDAR_ENABLED).toBe(false);
    expect(FREE_LIMITS.PARTNER_LINKING_ENABLED).toBe(false);
    expect(FREE_LIMITS.CLOUD_SYNC_ENABLED).toBe(false);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(FREE_LIMITS)).toBe(true);
  });
});

describe('PREMIUM_LIMITS', () => {
  it('allows unlimited prompts', () => {
    expect(PREMIUM_LIMITS.PROMPTS_PER_DAY).toBe(Infinity);
  });

  it('unlocks all 5 heat levels', () => {
    expect(PREMIUM_LIMITS.ALL_HEAT_LEVELS).toEqual([1, 2, 3, 4, 5]);
  });

  it('enables all premium features', () => {
    expect(PREMIUM_LIMITS.SURPRISE_ME_ENABLED).toBe(true);
    expect(PREMIUM_LIMITS.LOVE_NOTES_ENABLED).toBe(true);
    expect(PREMIUM_LIMITS.CALENDAR_ENABLED).toBe(true);
    expect(PREMIUM_LIMITS.PARTNER_LINKING_ENABLED).toBe(true);
    expect(PREMIUM_LIMITS.CLOUD_SYNC_ENABLED).toBe(true);
  });
});

// ─── Free Preview Prompts ────────────────────────────────────────────────────

describe('FREE_PREVIEW_PROMPTS', () => {
  it('contains exactly 3 prompts', () => {
    expect(FREE_PREVIEW_PROMPTS.length).toBe(3);
  });

  it('covers heat levels 1, 2, 3', () => {
    const heats = FREE_PREVIEW_PROMPTS.map(p => p.heat);
    expect(heats).toEqual([1, 2, 3]);
  });

  it('all have isPreview: true', () => {
    FREE_PREVIEW_PROMPTS.forEach(p => {
      expect(p.isPreview).toBe(true);
    });
  });

  it('all have required fields', () => {
    FREE_PREVIEW_PROMPTS.forEach(p => {
      expect(p.id).toBeDefined();
      expect(p.text).toBeDefined();
      expect(typeof p.text).toBe('string');
      expect(p.text.length).toBeGreaterThan(10);
      expect(p.category).toBeDefined();
      expect(p.heat).toBeDefined();
    });
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
    expect(getGuardBehavior(PremiumFeature.HEAT_LEVELS_4_5)).toBe(GuardBehavior.LOCK);
    expect(getGuardBehavior(PremiumFeature.SURPRISE_ME)).toBe(GuardBehavior.BLOCK);
    expect(getGuardBehavior(PremiumFeature.UNLIMITED_JOURNAL_HISTORY)).toBe(GuardBehavior.BLUR);
    expect(getGuardBehavior(PremiumFeature.CUSTOM_RITUALS)).toBe(GuardBehavior.HIDE);
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
  it('returns [1,2,3] for free users', () => {
    expect(getAccessibleHeatLevels(false)).toEqual([1, 2, 3]);
  });

  it('returns [1,2,3,4,5] for premium users', () => {
    expect(getAccessibleHeatLevels(true)).toEqual([1, 2, 3, 4, 5]);
  });
});
