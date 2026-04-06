const datesCatalog = require('../../content/dates.json');

describe('dates catalog integrity', () => {
  const items = Array.isArray(datesCatalog?.items) ? datesCatalog.items : [];
  const minMinutes = datesCatalog?.meta?.minMinutes || 45;
  const validLocations = ['home', 'out', 'either'];
  const validStyles = ['talking', 'doing', 'mixed'];

  it('uses unique ids for every date', () => {
    const ids = items.map((date) => date.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses unique titles for every date', () => {
    const titles = items.map((date) => date.title.trim().toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('uses unique step sequences for every date', () => {
    const stepSets = items.map((date) => JSON.stringify(date.steps.map((step) => step.trim().toLowerCase())));
    expect(new Set(stepSets).size).toBe(stepSets.length);
  });

  it('uses valid heat, load, style, and location values', () => {
    items.forEach((date) => {
      expect([1, 2, 3]).toContain(date.heat);
      expect([1, 2, 3]).toContain(date.load);
      expect(validStyles).toContain(date.style);
      expect(validLocations).toContain(date.location);
    });
  });

  it('uses valid minutes and exactly four non-empty steps', () => {
    items.forEach((date) => {
      expect(typeof date.minutes).toBe('number');
      expect(date.minutes).toBeGreaterThanOrEqual(minMinutes);
      expect(Array.isArray(date.steps)).toBe(true);
      expect(date.steps).toHaveLength(4);
      date.steps.forEach((step) => {
        expect(typeof step).toBe('string');
        expect(step.trim().length).toBeGreaterThan(0);
      });
    });
  });
});