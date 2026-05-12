const todayPromptsCatalog = require('../../content/today-between-us-prompts.json');
const { MINIMUM_QUESTION_REPEAT_DAYS } = require('../../utils/noRepeatContentRotation');
const {
  TODAY_BETWEEN_US_HEAT_LEVELS,
  TODAY_BETWEEN_US_ROTATION_CYCLE_DAYS,
  getTodayBetweenUsRotationPool,
  selectTodayBetweenUsPrompt,
} = require('../../utils/todayBetweenUsRotation');

const dateKeyForOffset = (offset) =>
  new Date(Date.UTC(2026, 0, 1 + offset)).toISOString().slice(0, 10);

describe('Today Between Us rotation', () => {
  const items = todayPromptsCatalog.items || [];

  it('uses only the dedicated heat 1-3 Today Between Us pool', () => {
    const rotationPool = getTodayBetweenUsRotationPool(items);

    expect(rotationPool).toHaveLength(items.length);
    expect(rotationPool.every((prompt) => TODAY_BETWEEN_US_HEAT_LEVELS.includes(prompt.heat))).toBe(true);
    expect(rotationPool.every((prompt) => prompt.dailyOnly === true)).toBe(true);
  });

  it('does not repeat within the annual Today Between Us cycle', () => {
    const seenIds = new Set();

    for (let offset = 0; offset < TODAY_BETWEEN_US_ROTATION_CYCLE_DAYS; offset += 1) {
      const prompt = selectTodayBetweenUsPrompt(items, dateKeyForOffset(offset), 'couple:one');
      seenIds.add(prompt.id);
    }

    expect(seenIds.size).toBe(TODAY_BETWEEN_US_ROTATION_CYCLE_DAYS);
    expect(seenIds.size).toBeGreaterThanOrEqual(MINIMUM_QUESTION_REPEAT_DAYS);
  });

  it('returns the same prompt for every scope on the same date', () => {
    const dateKey = '2026-05-12';

    expect(selectTodayBetweenUsPrompt(items, dateKey, 'couple:one').id).toBe(
      selectTodayBetweenUsPrompt(items, dateKey, 'couple:two').id
    );
    expect(selectTodayBetweenUsPrompt(items, dateKey, 'user:solo').id).toBe(
      selectTodayBetweenUsPrompt(items, dateKey).id
    );
  });

  it('keeps the active annual cycle stable when future OTA prompts are appended', () => {
    const extraItems = [
      { id: 'tbu_l1_999', text: 'What tiny future ritual would make tomorrow feel softer?', heat: 1, dailyOnly: true },
      { id: 'tbu_l2_999', text: 'What flirty signal should we use when we want more closeness?', heat: 2, dailyOnly: true },
      { id: 'tbu_l3_999', text: 'What helps desire feel playful and pressure-free between us?', heat: 3, dailyOnly: true },
    ];
    const expandedItems = [...items, ...extraItems];

    expect(TODAY_BETWEEN_US_ROTATION_CYCLE_DAYS).toBe(365);
    expect(TODAY_BETWEEN_US_ROTATION_CYCLE_DAYS).toBeGreaterThanOrEqual(MINIMUM_QUESTION_REPEAT_DAYS);

    for (let offset = 0; offset < TODAY_BETWEEN_US_ROTATION_CYCLE_DAYS; offset += 1) {
      const dateKey = dateKeyForOffset(offset);
      const original = selectTodayBetweenUsPrompt(items, dateKey, 'couple:stable');
      const expanded = selectTodayBetweenUsPrompt(expandedItems, dateKey, 'couple:stable');

      expect(expanded.id).toBe(original.id);
    }
  });

  it('interleaves heat levels instead of clumping by intensity', () => {
    const firstNineHeats = getTodayBetweenUsRotationPool(items)
      .slice(0, 9)
      .map((prompt) => prompt.heat);

    expect(firstNineHeats).toEqual([1, 2, 3, 1, 2, 3, 1, 2, 3]);
  });
});
