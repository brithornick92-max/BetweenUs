const {
  MINIMUM_QUESTION_REPEAT_DAYS,
  getNoRepeatRotationItem,
  getNoRepeatWindowStatus,
} = require('../../utils/noRepeatContentRotation');

const makeItems = (count) =>
  Array.from({ length: count }, (_, index) => ({
    id: `item-${String(index + 1).padStart(3, '0')}`,
  }));

const dateKeyForOffset = (offset) =>
  new Date(Date.UTC(2026, 0, 1 + offset)).toISOString().slice(0, 10);

describe('no-repeat content rotation', () => {
  it('does not repeat a question inside the six-month minimum window', () => {
    const items = makeItems(MINIMUM_QUESTION_REPEAT_DAYS);
    const seenIds = new Set();

    for (let offset = 0; offset < MINIMUM_QUESTION_REPEAT_DAYS; offset += 1) {
      const item = getNoRepeatRotationItem(items, dateKeyForOffset(offset), {
        seed: 'couple:one',
      });
      seenIds.add(item.id);
    }

    expect(seenIds.size).toBe(MINIMUM_QUESTION_REPEAT_DAYS);
  });

  it('supports scoped rotations without creating early repeats', () => {
    const items = makeItems(220);
    const firstScopeIds = [];
    const secondScopeIds = [];

    for (let offset = 0; offset < MINIMUM_QUESTION_REPEAT_DAYS; offset += 1) {
      firstScopeIds.push(getNoRepeatRotationItem(items, dateKeyForOffset(offset), {
        seed: 'couple:first',
      }).id);
      secondScopeIds.push(getNoRepeatRotationItem(items, dateKeyForOffset(offset), {
        seed: 'couple:second',
      }).id);
    }

    expect(new Set(firstScopeIds).size).toBe(MINIMUM_QUESTION_REPEAT_DAYS);
    expect(new Set(secondScopeIds).size).toBe(MINIMUM_QUESTION_REPEAT_DAYS);
    expect(firstScopeIds[0]).not.toBe(secondScopeIds[0]);
  });

  it('can pin the active cycle so appended OTA content does not reshuffle existing days', () => {
    const originalItems = makeItems(MINIMUM_QUESTION_REPEAT_DAYS);
    const expandedItems = makeItems(MINIMUM_QUESTION_REPEAT_DAYS + 12);

    for (let offset = 0; offset < MINIMUM_QUESTION_REPEAT_DAYS; offset += 1) {
      const dateKey = dateKeyForOffset(offset);
      const original = getNoRepeatRotationItem(originalItems, dateKey, {
        seed: 'couple:stable',
        stableCycleSize: MINIMUM_QUESTION_REPEAT_DAYS,
      });
      const expanded = getNoRepeatRotationItem(expandedItems, dateKey, {
        seed: 'couple:stable',
        stableCycleSize: MINIMUM_QUESTION_REPEAT_DAYS,
      });

      expect(expanded.id).toBe(original.id);
    }
  });

  it('reports when a pool is too small to guarantee the window', () => {
    expect(getNoRepeatWindowStatus(makeItems(150))).toMatchObject({
      canGuarantee: false,
      minRepeatDays: MINIMUM_QUESTION_REPEAT_DAYS,
      uniqueCount: 150,
    });
    expect(getNoRepeatWindowStatus(makeItems(MINIMUM_QUESTION_REPEAT_DAYS))).toMatchObject({
      canGuarantee: true,
      uniqueCount: MINIMUM_QUESTION_REPEAT_DAYS,
    });
  });
});
