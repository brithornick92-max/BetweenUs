const todayPromptsCatalog = require('../../content/today-between-us-prompts.json');

describe('Today Between Us prompt catalog', () => {
  const items = todayPromptsCatalog.items || [];
  const minimumSixMonthPoolSize = 183;

  it('matches the declared total', () => {
    expect(items).toHaveLength(todayPromptsCatalog.meta.totalPrompts);
  });

  it('contains only unique daily prompts at heat levels 1-3', () => {
    const ids = new Set();
    const texts = new Set();

    items.forEach((item) => {
      expect(item.id).toMatch(/^tbu_l[123]_\d{3}$/);
      expect(ids.has(item.id)).toBe(false);
      expect(texts.has(item.text)).toBe(false);
      ids.add(item.id);
      texts.add(item.text);

      expect(typeof item.text).toBe('string');
      expect(item.text.trim()).toBe(item.text);
      expect(item.text.trim().length).toBeGreaterThan(10);
      expect(item.heat).toBeGreaterThanOrEqual(1);
      expect(item.heat).toBeLessThanOrEqual(3);
      expect(item.dailyOnly).toBe(true);
    });
  });

  it('has enough morning-safe questions for a six-month no-repeat rotation', () => {
    expect(items).toHaveLength(minimumSixMonthPoolSize);
    expect(items.every((item) => item.heat >= 1 && item.heat <= 3)).toBe(true);
    expect(items.map((item) => item.id).filter(Boolean)).toHaveLength(minimumSixMonthPoolSize);
  });

  it('keeps Today Between Us wording nonsexual for morning prompts', () => {
    const riskyTerms = /\b(sex|sexual|naked|orgasm|kink|kinky|erotic|explicit|turn[- ]?on|make out)\b/i;
    expect(items.filter((item) => riskyTerms.test(item.text))).toEqual([]);
  });

  it('has the expected level counts', () => {
    const counts = items.reduce((acc, item) => {
      acc[item.heat] = (acc[item.heat] || 0) + 1;
      return acc;
    }, {});

    expect(counts).toEqual({ 1: 61, 2: 61, 3: 61 });
  });
});
