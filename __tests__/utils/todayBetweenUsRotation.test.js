const todayPromptsCatalog = require('../../content/today-between-us-prompts.json');
const { MINIMUM_QUESTION_REPEAT_DAYS } = require('../../utils/noRepeatContentRotation');
const {
  TODAY_BETWEEN_US_HEAT_LEVELS,
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

  it('does not repeat within the six-month minimum window', () => {
    const seenIds = new Set();

    for (let offset = 0; offset < MINIMUM_QUESTION_REPEAT_DAYS; offset += 1) {
      const prompt = selectTodayBetweenUsPrompt(items, dateKeyForOffset(offset), 'couple:one');
      seenIds.add(prompt.id);
    }

    expect(seenIds.size).toBe(MINIMUM_QUESTION_REPEAT_DAYS);
  });

  it('interleaves heat levels instead of clumping by intensity', () => {
    const firstNineHeats = getTodayBetweenUsRotationPool(items)
      .slice(0, 9)
      .map((prompt) => prompt.heat);

    expect(firstNineHeats).toEqual([1, 2, 3, 1, 2, 3, 1, 2, 3]);
  });
});
