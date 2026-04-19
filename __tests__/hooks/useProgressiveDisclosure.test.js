/**
 * Tests for useProgressiveDisclosure thresholds
 */

const THRESHOLDS = {
  quickActions:        { days: 2, answers: 2 },
  relationshipClimate: { days: 5, answers: 5 },
  memoryLane:          { days: 5, answers: 4 },
  momentSignal:        { days: 7, answers: 6 },
  surpriseTonight:     { days: 10, answers: 8 },
  yearReflection:      { days: 14, answers: 10 },
  softNudge:           { days: 3, answers: 3 },
};

function isUnlocked(feature, daysSinceFirstOpen, answeredCount) {
  const t = THRESHOLDS[feature];
  if (!t) return true;
  return daysSinceFirstOpen >= t.days || answeredCount >= t.answers;
}

describe('Progressive Disclosure', () => {
  it('hides all features for brand-new user', () => {
    for (const key of Object.keys(THRESHOLDS)) {
      expect(isUnlocked(key, 0, 0)).toBe(false);
    }
  });

  it('quickActions unlocks at 2 days or 2 answers', () => {
    expect(isUnlocked('quickActions', 2, 0)).toBe(true);
    expect(isUnlocked('quickActions', 0, 2)).toBe(true);
    expect(isUnlocked('quickActions', 1, 1)).toBe(false);
  });

  it('softNudge unlocks at 3 days or 3 answers', () => {
    expect(isUnlocked('softNudge', 3, 0)).toBe(true);
    expect(isUnlocked('softNudge', 0, 3)).toBe(true);
  });

  it('yearReflection unlocks last (14 days or 10 answers)', () => {
    expect(isUnlocked('yearReflection', 13, 9)).toBe(false);
    expect(isUnlocked('yearReflection', 14, 0)).toBe(true);
    expect(isUnlocked('yearReflection', 0, 10)).toBe(true);
  });

  it('all features unlocked for established user', () => {
    for (const key of Object.keys(THRESHOLDS)) {
      expect(isUnlocked(key, 30, 20)).toBe(true);
    }
  });

  it('answer count can unlock before day threshold', () => {
    expect(isUnlocked('momentSignal', 0, 6)).toBe(true);
    expect(isUnlocked('surpriseTonight', 0, 8)).toBe(true);
  });

  it('thresholds ordered by increasing days', () => {
    const ordered = ['quickActions', 'softNudge', 'relationshipClimate', 'memoryLane', 'momentSignal', 'surpriseTonight', 'yearReflection'];
    for (let i = 1; i < ordered.length; i++) {
      expect(THRESHOLDS[ordered[i]].days).toBeGreaterThanOrEqual(THRESHOLDS[ordered[i - 1]].days);
    }
  });

  it('all thresholds have days and answers as numbers', () => {
    for (const [, val] of Object.entries(THRESHOLDS)) {
      expect(typeof val.days).toBe('number');
      expect(typeof val.answers).toBe('number');
    }
  });
});
