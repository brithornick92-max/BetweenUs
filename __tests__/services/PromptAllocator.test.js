jest.mock('../../services/db/Database', () => ({
  getPromptAnswers: jest.fn(),
}));

const Database = require('../../services/db/Database');

// Reset module between tests to clear in-memory state
function loadAllocator() {
  jest.resetModules();
  jest.mock('../../services/db/Database', () => ({
    getPromptAnswers: jest.fn(),
  }));
  return require('../../services/PromptAllocator').default;
}

describe('PromptAllocator — load', () => {
  it('populates allAnsweredIds and todayAnsweredIds from Database', async () => {
    const PromptAllocator = loadAllocator();
    const DB = require('../../services/db/Database');

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    DB.getPromptAnswers.mockImplementation(async (userId, opts) => {
      if (opts?.dateKey === todayKey) return [{ prompt_id: 'h2_001' }];
      return [{ prompt_id: 'h2_001' }, { prompt_id: 'h3_010' }];
    });

    await PromptAllocator.load('user-1');

    expect(PromptAllocator.isLoaded).toBe(true);
    expect(PromptAllocator.isAnswered('h2_001')).toBe(true);
    expect(PromptAllocator.isAnswered('h3_010')).toBe(true);
    expect(PromptAllocator.isAnsweredToday('h2_001')).toBe(true);
    expect(PromptAllocator.isAnsweredToday('h3_010')).toBe(false);
  });

  it('degrades gracefully when Database throws', async () => {
    const PromptAllocator = loadAllocator();
    const DB = require('../../services/db/Database');
    DB.getPromptAnswers.mockRejectedValue(new Error('sqlite error'));

    await expect(PromptAllocator.load('user-1')).resolves.not.toThrow();
    expect(PromptAllocator.isLoaded).toBe(true);
  });

  it('does nothing when userId is null', async () => {
    const PromptAllocator = loadAllocator();
    const DB = require('../../services/db/Database');

    await PromptAllocator.load(null);

    expect(DB.getPromptAnswers).not.toHaveBeenCalled();
  });
});

describe('PromptAllocator — setDailyPromptId / recordAnswer', () => {
  it('reserves a daily prompt ID', () => {
    const PromptAllocator = loadAllocator();
    PromptAllocator.setDailyPromptId('h2_042');
    expect(PromptAllocator.dailyPromptId).toBe('h2_042');
  });

  it('recordAnswer adds to both answered sets immediately', () => {
    const PromptAllocator = loadAllocator();
    PromptAllocator.recordAnswer('h3_005');
    expect(PromptAllocator.isAnswered('h3_005')).toBe(true);
    expect(PromptAllocator.isAnsweredToday('h3_005')).toBe(true);
  });

  it('recordAnswer ignores falsy values', () => {
    const PromptAllocator = loadAllocator();
    PromptAllocator.recordAnswer(null);
    PromptAllocator.recordAnswer('');
    expect(PromptAllocator.allAnsweredIds.size).toBe(0);
  });
});

describe('PromptAllocator — excludeUsed', () => {
  it('removes the daily prompt from the browse list', () => {
    const PromptAllocator = loadAllocator();
    PromptAllocator.setDailyPromptId('h2_042');

    const prompts = [{ id: 'h2_042' }, { id: 'h3_001' }, { id: 'h1_010' }];
    const result = PromptAllocator.excludeUsed(prompts);

    expect(result.map((p) => p.id)).toEqual(['h3_001', 'h1_010']);
  });

  it('removes prompts answered today', () => {
    const PromptAllocator = loadAllocator();
    PromptAllocator.recordAnswer('h3_001');

    const prompts = [{ id: 'h2_042' }, { id: 'h3_001' }, { id: 'h1_010' }];
    const result = PromptAllocator.excludeUsed(prompts);

    expect(result.map((p) => p.id)).toEqual(['h2_042', 'h1_010']);
  });

  it('keeps prompts answered in the past (not today)', async () => {
    const PromptAllocator = loadAllocator();
    const DB = require('../../services/db/Database');
    // Simulate a prompt answered only in all-time history, not today
    DB.getPromptAnswers.mockImplementation(async (userId, opts) => {
      if (opts?.dateKey) return []; // nothing today
      return [{ prompt_id: 'h3_001' }]; // answered historically
    });
    await PromptAllocator.load('user-1');

    const prompts = [{ id: 'h3_001' }, { id: 'h1_010' }];
    const result = PromptAllocator.excludeUsed(prompts);

    // h3_001 answered in past — should NOT be excluded from browse
    expect(result.map((p) => p.id)).toEqual(['h3_001', 'h1_010']);
  });

  it('handles non-array input safely', () => {
    const PromptAllocator = loadAllocator();
    expect(PromptAllocator.excludeUsed(null)).toBeNull();
    expect(PromptAllocator.excludeUsed(undefined)).toBeUndefined();
  });
});

describe('PromptAllocator — tagAnswered', () => {
  it('stamps answered and answeredToday flags on each prompt', () => {
    const PromptAllocator = loadAllocator();
    PromptAllocator.setDailyPromptId('h2_042');
    PromptAllocator.recordAnswer('h3_001'); // today
    // h4_099 answered historically (simulate via internal set)
    PromptAllocator.allAnsweredIds.add('h4_099');

    const prompts = [
      { id: 'h2_042' },
      { id: 'h3_001' },
      { id: 'h4_099' },
      { id: 'h1_010' },
    ];
    const result = PromptAllocator.tagAnswered(prompts);

    expect(result[0]).toMatchObject({ id: 'h2_042', isDailyPrompt: true, answered: false, answeredToday: false });
    expect(result[1]).toMatchObject({ id: 'h3_001', answered: true, answeredToday: true });
    expect(result[2]).toMatchObject({ id: 'h4_099', answered: true, answeredToday: false });
    expect(result[3]).toMatchObject({ id: 'h1_010', answered: false, answeredToday: false });
  });
});

describe('PromptAllocator — reset', () => {
  it('clears all state', () => {
    const PromptAllocator = loadAllocator();
    PromptAllocator.setDailyPromptId('h2_042');
    PromptAllocator.recordAnswer('h3_001');

    PromptAllocator.reset();

    expect(PromptAllocator.dailyPromptId).toBeNull();
    expect(PromptAllocator.isLoaded).toBe(false);
    expect(PromptAllocator.allAnsweredIds.size).toBe(0);
  });
});
