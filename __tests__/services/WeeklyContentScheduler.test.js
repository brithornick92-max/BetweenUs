jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Load a fresh instance for each test to avoid shared state
function makeScheduler() {
  jest.resetModules();
  const mod = require('../../services/WeeklyContentScheduler');
  // The module exports a singleton — clone-like approach: instantiate from the class
  const { WeeklyContentSchedulerClass } = (() => {
    // Re-export trick: read the default and its constructor
    const instance = mod.default;
    return { WeeklyContentSchedulerClass: instance.constructor };
  })();

  const scheduler = new WeeklyContentSchedulerClass();
  return scheduler;
}

describe('WeeklyContentScheduler — week math', () => {
  it('returns week 0 before init is called', () => {
    const s = makeScheduler();
    expect(s.getCurrentWeek()).toBe(0);
    expect(s.ready).toBe(false);
  });

  it('computes week 0 when install date is today', () => {
    const s = makeScheduler();
    s._installDate = new Date();
    s._currentWeek = s._computeWeek();
    s._ready = true;

    expect(s.getCurrentWeek()).toBe(0);
  });

  it('computes week 2 when install was 14 days ago', () => {
    const s = makeScheduler();
    const past = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    s._installDate = past;
    s._currentWeek = s._computeWeek();
    s._ready = true;

    expect(s.getCurrentWeek()).toBe(2);
  });

  it('computes week 4 when install was 28 days ago', () => {
    const s = makeScheduler();
    const past = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    s._installDate = past;
    s._currentWeek = s._computeWeek();
    s._ready = true;

    expect(s.getCurrentWeek()).toBe(4);
  });
});

describe('WeeklyContentScheduler — availability and weekly newness', () => {
  let scheduler;

  beforeEach(() => {
    jest.useFakeTimers();

    const mod = require('../../services/WeeklyContentScheduler');
    const instance = mod.default || mod;
    const WeeklyContentSchedulerClass = instance.constructor;
    scheduler = new WeeklyContentSchedulerClass();
  });

  afterEach(() => {
    jest.useRealTimers();

    if (scheduler) {
      scheduler._ready = false;
      scheduler._installDate = null;
    }
  });

  const schedulerAtWeek = (week) => {
    scheduler._ready = true;

    const now = new Date('2026-04-27T12:00:00.000Z');
    const install = new Date(now);
    install.setDate(install.getDate() - week * 7);

    scheduler._installDate = install;
    jest.setSystemTime(now);

    return scheduler;
  };

  it('treats releaseWeek as metadata, not the main access gate', () => {
    const s = schedulerAtWeek(3);

    expect(s.isAvailable({ releaseWeek: 0 })).toBe(true);
    expect(s.isAvailable({ releaseWeek: 3 })).toBe(true);
    expect(s.isAvailable({ releaseWeek: 99 })).toBe(true);
    expect(s.isAvailable({ releaseWeek: null })).toBe(true);
  });

  it('filterAvailable returns the full eligible library by default', () => {
    const s = schedulerAtWeek(3);

    const items = [
      { id: 'a', releaseWeek: 0 },
      { id: 'b', releaseWeek: 3 },
      { id: 'c', releaseWeek: 99 },
      { id: 'd' },
    ];

    expect(s.filterAvailable(items).map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('legacy filterReleasedThroughCurrentWeek removes future items when explicitly requested', () => {
    const s = schedulerAtWeek(3);

    const items = [
      { id: 'a', releaseWeek: 0 },
      { id: 'b', releaseWeek: 3 },
      { id: 'c', releaseWeek: 99 },
      { id: 'd' },
    ];

    expect(s.filterReleasedThroughCurrentWeek(items).map((i) => i.id)).toEqual(['a', 'b', 'd']);
  });

  it('marks items as new only for the current week', () => {
    const s = schedulerAtWeek(3);

    expect(s.isNewThisWeek({ releaseWeek: 3 })).toBe(true);
    expect(s.isNewThisWeek({ releaseWeek: 2 })).toBe(false);
    expect(s.isNewThisWeek({ releaseWeek: 4 })).toBe(false);
    expect(s.isNewThisWeek({ releaseWeek: null })).toBe(false);
  });

  it('getNewContentCounts returns prompt, date, and position counts', () => {
    const s = schedulerAtWeek(2);

    const prompts = [{ releaseWeek: 2 }, { releaseWeek: 2 }, { releaseWeek: 1 }];
    const dates = [{ releaseWeek: 1 }, { releaseWeek: 2 }];
    const positions = [{ releaseWeek: 2 }, { releaseWeek: 4 }];

    expect(s.getNewContentCounts(prompts, dates, positions)).toEqual({
      newPrompts: 2,
      newDates: 1,
      newPositions: 1,
    });
  });
});
