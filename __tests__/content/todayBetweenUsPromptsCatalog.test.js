const todayPromptsCatalog = require('../../content/today-between-us-prompts.json');

describe('Today Between Us prompt catalog', () => {
  const items = todayPromptsCatalog.items || [];

  it('matches the declared total', () => {
    expect(items).toHaveLength(todayPromptsCatalog.meta.totalPrompts);
  });

  it('contains only unique daily prompts at heat levels 1-3', () => {
    const ids = new Set();

    items.forEach((item) => {
      expect(item.id).toMatch(/^tbu_l[123]_\d{3}$/);
      expect(ids.has(item.id)).toBe(false);
      ids.add(item.id);

      expect(typeof item.text).toBe('string');
      expect(item.text.trim()).toBe(item.text);
      expect(item.text.trim().length).toBeGreaterThan(10);
      expect(item.heat).toBeGreaterThanOrEqual(1);
      expect(item.heat).toBeLessThanOrEqual(3);
      expect(item.dailyOnly).toBe(true);
    });
  });

  it('has the expected level counts', () => {
    const counts = items.reduce((acc, item) => {
      acc[item.heat] = (acc[item.heat] || 0) + 1;
      return acc;
    }, {});

    expect(counts).toEqual({ 1: 48, 2: 54, 3: 48 });
  });
});
