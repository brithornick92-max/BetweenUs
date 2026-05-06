const {
  dateOnlyToLocalDate,
  formatLocalDateKey,
  isFutureLocalDate,
  normalizeDateOnlyKey,
} = require('../../utils/dateOnly');

describe('date-only helpers', () => {
  it('preserves the written calendar date from date-only and ISO strings', () => {
    expect(normalizeDateOnlyKey('2024-04-29')).toBe('2024-04-29');
    expect(normalizeDateOnlyKey('2024-04-29T23:30:00.000-05:00')).toBe('2024-04-29');

    const localDate = dateOnlyToLocalDate('2024-04-29T23:30:00.000-05:00');
    expect(formatLocalDateKey(localDate)).toBe('2024-04-29');
  });

  it('rejects invalid date-only values', () => {
    expect(normalizeDateOnlyKey('2024-02-30')).toBeNull();
    expect(normalizeDateOnlyKey('not-a-date')).toBeNull();
  });

  it('detects future local calendar dates without rejecting today', () => {
    const now = new Date(2026, 4, 6, 23, 30);

    expect(isFutureLocalDate('2026-05-07', now)).toBe(true);
    expect(isFutureLocalDate('2026-05-06', now)).toBe(false);
    expect(isFutureLocalDate('2026-05-05', now)).toBe(false);
  });
});
