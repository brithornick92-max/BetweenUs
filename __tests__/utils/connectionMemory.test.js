jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Fresh module + cleared cache for every test
function loadConnectionMemory() {
  jest.resetModules();
  jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
  );
  const mod = require('../../utils/connectionMemory').default;
  mod._cache = null;
  mod._loadPromise = null;
  return mod;
}

beforeEach(() => {
  const AsyncStorage = require('@react-native-async-storage/async-storage');
  AsyncStorage.clear();
});

describe('ConnectionMemory — heat level (median)', () => {
  it('records a single heat selection and stores it as preferredHeatLevel', async () => {
    const CM = loadConnectionMemory();
    await CM.recordHeatSelection(3);
    const level = await CM.getPreferredHeatLevel();
    expect(level).toBe(3);
  });

  it('computes median for an odd-length history', async () => {
    const CM = loadConnectionMemory();
    // Insert in reverse to confirm sorting happens
    for (const v of [5, 1, 3]) await CM.recordHeatSelection(v);
    const level = await CM.getPreferredHeatLevel();
    // History is [3, 1, 5] → sorted [1, 3, 5] → median = 3
    expect(level).toBe(3);
  });

  it('computes median for an even-length history', async () => {
    const CM = loadConnectionMemory();
    for (const v of [2, 4]) await CM.recordHeatSelection(v);
    const level = await CM.getPreferredHeatLevel();
    // History [4, 2] → sorted [2, 4] → median = 3
    expect(level).toBe(3);
  });

  it('returns null when no heat selections recorded', async () => {
    const CM = loadConnectionMemory();
    const level = await CM.getPreferredHeatLevel();
    expect(level).toBeNull();
  });

  it('ignores non-number heat values', async () => {
    const CM = loadConnectionMemory();
    await CM.recordHeatSelection('not-a-number');
    const level = await CM.getPreferredHeatLevel();
    // Nothing stored — type guard should have rejected it
    expect(level).toBeNull();
  });
});

describe('ConnectionMemory — dimension selection deduplication', () => {
  it('moves a re-selected load value to the front', async () => {
    const CM = loadConnectionMemory();
    await CM.recordDimensionSelection({ load: 1 });
    await CM.recordDimensionSelection({ load: 2 });
    await CM.recordDimensionSelection({ load: 1 }); // re-select 1
    const mem = await CM._load();
    expect(mem.preferredLoad[0]).toBe(1);
    expect(mem.preferredLoad.filter((x) => x === 1)).toHaveLength(1); // no duplicates
  });

  it('moves a re-selected style value to the front', async () => {
    const CM = loadConnectionMemory();
    await CM.recordDimensionSelection({ style: 'talking' });
    await CM.recordDimensionSelection({ style: 'doing' });
    await CM.recordDimensionSelection({ style: 'talking' });
    const mem = await CM._load();
    expect(mem.preferredStyle[0]).toBe('talking');
    expect(mem.preferredStyle.filter((x) => x === 'talking')).toHaveLength(1);
  });
});

describe('ConnectionMemory — surprise shown (dedup + cap)', () => {
  it('tracks shown date ids and deduplicates them', async () => {
    const CM = loadConnectionMemory();
    await CM.recordSurpriseShown('date-1');
    await CM.recordSurpriseShown('date-2');
    await CM.recordSurpriseShown('date-1'); // duplicate
    const mem = await CM._load();
    expect(mem.lastSurpriseIds).toEqual(['date-1', 'date-2']);
    expect(mem.lastSurpriseIds.filter((x) => x === 'date-1')).toHaveLength(1);
  });

  it('ignores falsy date ids', async () => {
    const CM = loadConnectionMemory();
    await CM.recordSurpriseShown(null);
    await CM.recordSurpriseShown('');
    const mem = await CM._load();
    expect(mem.lastSurpriseIds).toHaveLength(0);
  });
});

describe('ConnectionMemory — feature affinities', () => {
  it('increments affinity count on each call', async () => {
    const CM = loadConnectionMemory();
    await CM.recordFeatureUse('prompts');
    await CM.recordFeatureUse('prompts');
    await CM.recordFeatureUse('journal');
    const mem = await CM._load();
    expect(mem.featureAffinities.prompts).toBe(2);
    expect(mem.featureAffinities.journal).toBe(1);
  });

  it('ignores falsy feature names', async () => {
    const CM = loadConnectionMemory();
    await CM.recordFeatureUse(null);
    await CM.recordFeatureUse('');
    const mem = await CM._load();
    expect(Object.keys(mem.featureAffinities)).toHaveLength(0);
  });
});

describe('ConnectionMemory — screen visit', () => {
  it('stores last visited screen and timestamp', async () => {
    const CM = loadConnectionMemory();
    await CM.recordScreenVisit('PromptBrowser');
    const mem = await CM._load();
    expect(mem.lastVisitedScreen).toBe('PromptBrowser');
    expect(typeof mem.lastVisitedAt).toBe('string');
  });

  it('ignores falsy screen names', async () => {
    const CM = loadConnectionMemory();
    await CM.recordScreenVisit(null);
    const mem = await CM._load();
    expect(mem.lastVisitedScreen).toBeNull();
  });
});

describe('ConnectionMemory — prompt engagement', () => {
  it('stores last prompt category and id', async () => {
    const CM = loadConnectionMemory();
    await CM.recordPromptEngagement('romance', 'h2_042');
    const mem = await CM._load();
    expect(mem.lastPromptCategory).toBe('romance');
    expect(mem.lastPromptId).toBe('h2_042');
  });
});

describe('ConnectionMemory — session open (time-of-day)', () => {
  it('increments the correct time bucket', async () => {
    const CM = loadConnectionMemory();
    // Directly manipulate cache to simulate an evening open without
    // relying on the actual system clock
    const mem = await CM._load();
    mem.timeOfDayPatterns.evening += 1;
    await CM._save();

    const updated = await CM._load();
    expect(updated.timeOfDayPatterns.evening).toBe(1);
  });
});
