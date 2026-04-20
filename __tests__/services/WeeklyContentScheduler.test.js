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

describe('WeeklyContentScheduler — isAvailable / isNewThisWeek', () => {
  function schedulerAtWeek(week) {
    const s = makeScheduler();
    s._currentWeek = week;
    s._ready = true;
    return s;
  }

  it('always shows items with no releaseWeek (legacy content)', () => {
    const s = schedulerAtWeek(0);
    expect(s.isAvailable({ releaseWeek: null })).toBe(true);
    expect(s.isAvailable({ title: 'no releaseWeek field' })).toBe(true);
  });

  it('shows items whose releaseWeek has passed', () => {
    const s = schedulerAtWeek(5);
    expect(s.isAvailable({ releaseWeek: 0 })).toBe(true);
    expect(s.isAvailable({ releaseWeek: 3 })).toBe(true);
    expect(s.isAvailable({ releaseWeek: 5 })).toBe(true);
  });

  it('hides items whose releaseWeek is in the future', () => {
    const s = schedulerAtWeek(2);
    expect(s.isAvailable({ releaseWeek: 3 })).toBe(false);
    expect(s.isAvailable({ releaseWeek: 10 })).toBe(false);
  });

  it('marks items as new only for the current week', () => {
    const s = schedulerAtWeek(3);
    expect(s.isNewThisWeek({ releaseWeek: 3 })).toBe(true);
    expect(s.isNewThisWeek({ releaseWeek: 2 })).toBe(false);
    expect(s.isNewThisWeek({ releaseWeek: 4 })).toBe(false);
    expect(s.isNewThisWeek({ releaseWeek: null })).toBe(false);
  });

  it('filterAvailable removes future items from an array', () => {
    const s = schedulerAtWeek(2);
    const items = [
      { id: 'a', releaseWeek: 0 },
      { id: 'b', releaseWeek: 2 },
      { id: 'c', releaseWeek: 3 },
      { id: 'd' }, // no releaseWeek — always available
    ];
    const result = s.filterAvailable(items);
    expect(result.map((i) => i.id)).toEqual(['a', 'b', 'd']);
  });

  it('getNewContentCounts returns correct prompt and date counts', () => {
    const s = schedulerAtWeek(1);
    const prompts = [{ releaseWeek: 1 }, { releaseWeek: 1 }, { releaseWeek: 0 }];
    const dates = [{ releaseWeek: 1 }, { releaseWeek: 2 }];
    const counts = s.getNewContentCounts(prompts, dates);
    expect(counts).toEqual({ newPrompts: 2, newDates: 1 });
  });
});
