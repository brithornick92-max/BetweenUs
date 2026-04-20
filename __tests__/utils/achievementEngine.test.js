jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const { evaluateAchievements } = require('../../utils/achievementEngine');

// Build a minimal dataLayer mock — returns arrays of the right shape
function makeDataLayer({
  journals = [],
  prompts = [],
  checkIns = [],
  memories = [],
  rituals = [],
  vibes = [],
  loveNotes = [],
} = {}) {
  return {
    getJournalEntries: jest.fn().mockResolvedValue(journals),
    getPromptAnswers: jest.fn().mockResolvedValue(prompts),
    getCheckIns: jest.fn().mockResolvedValue(checkIns),
    getMemories: jest.fn().mockResolvedValue(memories),
    getRituals: jest.fn().mockResolvedValue(rituals),
    getVibes: jest.fn().mockResolvedValue(vibes),
    getLoveNotes: jest.fn().mockResolvedValue(loveNotes),
  };
}

function find(results, id) {
  return results.find((r) => r.id === id);
}

beforeEach(() => {
  const AsyncStorage = require('@react-native-async-storage/async-storage');
  AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('evaluateAchievements — returns empty array with no dataLayer', () => {
  it('returns [] when dataLayer is null', async () => {
    const results = await evaluateAchievements(null);
    expect(results).toEqual([]);
  });
});

describe('evaluateAchievements — journal milestones', () => {
  it('first_journal: unlocks at 1 journal, locked at 0', async () => {
    const locked = await evaluateAchievements(makeDataLayer({ journals: [] }));
    expect(find(locked, 'first_journal').unlocked).toBe(false);

    const unlocked = await evaluateAchievements(makeDataLayer({ journals: [{}] }));
    expect(find(unlocked, 'first_journal').unlocked).toBe(true);
  });

  it('journal_10: locked at 9, unlocked at 10', async () => {
    const make = (n) => makeDataLayer({ journals: Array(n).fill({}) });

    const locked = await evaluateAchievements(make(9));
    expect(find(locked, 'journal_10').unlocked).toBe(false);
    expect(find(locked, 'journal_10').progress).toBeCloseTo(0.9);

    const unlocked = await evaluateAchievements(make(10));
    expect(find(unlocked, 'journal_10').unlocked).toBe(true);
    expect(find(unlocked, 'journal_10').progress).toBe(1);
  });
});

describe('evaluateAchievements — prompt milestones', () => {
  it('first_prompt: unlocks at 1 prompt', async () => {
    const locked = await evaluateAchievements(makeDataLayer({ prompts: [] }));
    expect(find(locked, 'first_prompt').unlocked).toBe(false);

    const unlocked = await evaluateAchievements(makeDataLayer({ prompts: [{}] }));
    expect(find(unlocked, 'first_prompt').unlocked).toBe(true);
  });

  it('prompt_25: locked at 24, unlocked at 25', async () => {
    const make = (n) => makeDataLayer({ prompts: Array(n).fill({}) });

    expect(find(await evaluateAchievements(make(24)), 'prompt_25').unlocked).toBe(false);
    expect(find(await evaluateAchievements(make(25)), 'prompt_25').unlocked).toBe(true);
  });

  it('prompt_100: locked at 99, unlocked at 100', async () => {
    const make = (n) => makeDataLayer({ prompts: Array(n).fill({}) });

    expect(find(await evaluateAchievements(make(99)), 'prompt_100').unlocked).toBe(false);
    expect(find(await evaluateAchievements(make(100)), 'prompt_100').unlocked).toBe(true);
  });
});

describe('evaluateAchievements — check-in streak', () => {
  function checkInDays(n) {
    // Build n consecutive days ending today (ISO date strings)
    const days = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(Date.now() - i * 86400000);
      days.push({ created_at: d.toISOString() });
    }
    return days;
  }

  it('couple_streak_14: locked at 13 days, unlocked at 14', async () => {
    const locked = await evaluateAchievements(makeDataLayer({ checkIns: checkInDays(13) }));
    expect(find(locked, 'couple_streak_14').unlocked).toBe(false);

    const unlocked = await evaluateAchievements(makeDataLayer({ checkIns: checkInDays(14) }));
    expect(find(unlocked, 'couple_streak_14').unlocked).toBe(true);
  });

  it('streak resets on a gap — 7 days with a 1-day break does not unlock 7-day streak', async () => {
    // Days 0–3 + skip day 4 + days 5–7 (gap breaks streak)
    const days = [];
    for (let i = 0; i <= 7; i++) {
      if (i === 4) continue; // gap
      days.push({ created_at: new Date(Date.now() - i * 86400000).toISOString() });
    }
    const results = await evaluateAchievements(makeDataLayer({ checkIns: days }));
    expect(find(results, 'couple_streak_14').unlocked).toBe(false);
  });
});

describe('evaluateAchievements — heat explorer', () => {
  it('locked when fewer than 3 distinct heat levels', async () => {
    const prompts = [{ heat_level: 1 }, { heat_level: 2 }];
    const results = await evaluateAchievements(makeDataLayer({ prompts }));
    expect(find(results, 'heat_explorer').unlocked).toBe(false);
    expect(find(results, 'heat_explorer').progress).toBeCloseTo(2 / 3);
  });

  it('unlocked at exactly 3 distinct heat levels', async () => {
    const prompts = [{ heat_level: 1 }, { heat_level: 2 }, { heat_level: 3 }];
    const results = await evaluateAchievements(makeDataLayer({ prompts }));
    expect(find(results, 'heat_explorer').unlocked).toBe(true);
    expect(find(results, 'heat_explorer').progress).toBe(1);
  });

  it('duplicate heat levels do not count as distinct', async () => {
    const prompts = [{ heat_level: 2 }, { heat_level: 2 }, { heat_level: 2 }];
    const results = await evaluateAchievements(makeDataLayer({ prompts }));
    expect(find(results, 'heat_explorer').unlocked).toBe(false);
  });
});

describe('evaluateAchievements — couple_all_features', () => {
  it('locked when any of the four features is unused', async () => {
    // Missing journals
    const results = await evaluateAchievements(
      makeDataLayer({ prompts: [{}], checkIns: [{ created_at: new Date().toISOString() }], rituals: [{}] })
    );
    expect(find(results, 'couple_all_features').unlocked).toBe(false);
    expect(find(results, 'couple_all_features').progress).toBeCloseTo(3 / 4);
  });

  it('unlocked when all four features have at least one entry', async () => {
    const results = await evaluateAchievements(
      makeDataLayer({
        prompts: [{}],
        journals: [{}],
        rituals: [{}],
        checkIns: [{ created_at: new Date().toISOString() }],
      })
    );
    expect(find(results, 'couple_all_features').unlocked).toBe(true);
    expect(find(results, 'couple_all_features').progress).toBe(1);
  });
});

describe('evaluateAchievements — isNew flag', () => {
  it('marks an achievement as isNew on first unlock, not on re-evaluation', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');

    const dl = makeDataLayer({ journals: [{}] });

    // First evaluation — should be new
    const first = await evaluateAchievements(dl);
    expect(find(first, 'first_journal').isNew).toBe(true);

    // Second evaluation — already persisted, should NOT be new
    const second = await evaluateAchievements(dl);
    expect(find(second, 'first_journal').isNew).toBe(false);
  });
});
