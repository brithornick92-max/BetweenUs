import { resolveWeeklyDeckItems } from '../../utils/weeklyDeckVisibility';

describe('weeklyDeckVisibility', () => {
  it('keeps empty weekly sets empty instead of falling back to broader catalog data', () => {
    expect(resolveWeeklyDeckItems(null)).toEqual([]);
    expect(resolveWeeklyDeckItems({ items: [] })).toEqual([]);
  });

  it('returns the weekly items when they exist', () => {
    const items = [{ id: 'one' }, { id: 'two' }];

    expect(resolveWeeklyDeckItems({ items })).toBe(items);
  });
});
