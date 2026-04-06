const promptsCatalog = require('../../content/prompts.json');

describe('prompts catalog integrity', () => {
  const items = Array.isArray(promptsCatalog?.items) ? promptsCatalog.items : [];
  const categories = promptsCatalog?.meta?.categories || {};
  const durations = promptsCatalog?.meta?.relationshipDurations || {};

  it('matches the declared total prompt count', () => {
    expect(items).toHaveLength(promptsCatalog.meta.totalPrompts);
  });

  it('uses valid heat levels for every prompt', () => {
    items.forEach((prompt) => {
      expect(Number.isInteger(prompt.heat)).toBe(true);
      expect(prompt.heat).toBeGreaterThanOrEqual(1);
      expect(prompt.heat).toBeLessThanOrEqual(5);
    });
  });

  it('uses only declared categories', () => {
    items.forEach((prompt) => {
      expect(categories[prompt.category]).toBeTruthy();
    });
  });

  it('uses only declared relationship durations', () => {
    items.forEach((prompt) => {
      expect(Array.isArray(prompt.relationshipDuration)).toBe(true);
      prompt.relationshipDuration.forEach((duration) => {
        expect(durations[duration]).toBeTruthy();
      });
    });
  });
});