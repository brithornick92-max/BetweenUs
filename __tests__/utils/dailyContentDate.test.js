const {
  DAILY_CONTENT_ROLLOVER_HOUR,
  getDailyContentDateKey,
  getMsUntilNextDailyContentRollover,
  getNextDailyContentRollover,
} = require('../../utils/dailyContentDate');

describe('daily content date boundary', () => {
  it('uses a 4am local rollover for daily content', () => {
    expect(DAILY_CONTENT_ROLLOVER_HOUR).toBe(4);
    expect(getDailyContentDateKey(new Date(2026, 4, 5, 3, 59, 59))).toBe('2026-05-04');
    expect(getDailyContentDateKey(new Date(2026, 4, 5, 4, 0, 0))).toBe('2026-05-05');
    expect(getDailyContentDateKey(new Date(2026, 4, 5, 23, 0, 0))).toBe('2026-05-05');
  });

  it('calculates the next local 4am rollover', () => {
    expect(getNextDailyContentRollover(new Date(2026, 4, 5, 3, 30)).getTime())
      .toBe(new Date(2026, 4, 5, 4, 0, 0, 0).getTime());
    expect(getNextDailyContentRollover(new Date(2026, 4, 5, 4, 0)).getTime())
      .toBe(new Date(2026, 4, 6, 4, 0, 0, 0).getTime());
    expect(getMsUntilNextDailyContentRollover(new Date(2026, 4, 5, 3, 30)))
      .toBe(30 * 60 * 1000);
  });
});
