const {
  DATE_TIMER_SECTION,
  buildDateNightDetailParams,
  shouldFocusDateTimer,
} = require('../../utils/dateNightNavigation');

describe('dateNightNavigation', () => {
  it('adds the timer section flag when opening a date from the revealed deck card', () => {
    const date = { id: 'date-1', title: 'Kitchen Slow Dance' };

    expect(buildDateNightDetailParams(date, { startAtTimer: true })).toEqual({
      date,
      initialSection: DATE_TIMER_SECTION,
    });
  });

  it('leaves normal date detail navigation at the top of the screen', () => {
    const date = { id: 'date-2', title: 'Coffee Walk' };

    expect(buildDateNightDetailParams(date)).toEqual({ date });
  });

  it('recognizes current and legacy timer focus params', () => {
    expect(shouldFocusDateTimer({ initialSection: 'timer' })).toBe(true);
    expect(shouldFocusDateTimer({ startAtTimer: true })).toBe(true);
    expect(shouldFocusDateTimer({ focusTimer: true })).toBe(true);
    expect(shouldFocusDateTimer({ initialSection: 'details' })).toBe(false);
  });
});
