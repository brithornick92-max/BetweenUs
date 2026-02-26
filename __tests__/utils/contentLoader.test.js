/**
 * contentLoader.test.js — Tests for content loading and filtering
 */

// Mock the JSON imports before requiring the module
jest.mock('../../content/prompts.json', () => ({
  meta: {
    version: '3.3.0',
    totalPrompts: 5,
    categories: {
      emotional: 'Deep emotional intimacy',
      romance: 'Sweet romantic connection',
      physical: 'Touch and physical connection',
      fantasy: 'Desires and imagination',
      playful: 'Light-hearted and fun',
    },
    heatLevels: {
      1: { name: 'Emotional Connection', description: 'Emotional intimacy, non-sexual' },
      2: { name: 'Flirty & Romantic', description: 'Flirty attraction, romantic tension' },
      3: { name: 'Sensual', description: 'Sensual, relationship-focused intimacy' },
      4: { name: 'Steamy', description: 'Suggestive, adventurous, and heated' },
      5: { name: 'Explicit', description: 'Intensely passionate, graphic, explicit' },
    },
  },
  items: [
    { id: 'p1', text: 'Test prompt 1', category: 'emotional', heat: 1 },
    { id: 'p2', text: 'Test prompt 2', category: 'romance', heat: 2 },
    { id: 'p3', text: 'Test prompt 3', category: 'physical', heat: 3 },
    { id: 'p4', text: 'Test prompt 4', category: 'fantasy', heat: 4 },
    { id: 'p5', text: 'Test prompt 5', category: 'playful', heat: 5 },
  ],
}), { virtual: true });

jest.mock('../../content/dates.json', () => ({
  meta: { version: '5.0.0', totalDates: 5 },
  items: [
    { id: 'd1', title: 'Cozy movie night', heat: 1, location: 'home', load: 1, style: 'mixed', minutes: 90, steps: ['Pick a film', 'Make popcorn'] },
    { id: 'd2', title: 'Starlight walk', heat: 2, location: 'out', load: 1, style: 'talking', minutes: 60, steps: ['Walk outside'] },
    { id: 'd3', title: 'Cook together', heat: 3, location: 'home', load: 2, style: 'doing', minutes: 120, steps: ['Choose recipe'] },
    { id: 'd4', title: 'Dance class', heat: 4, location: 'out', load: 3, style: 'doing', minutes: 90, steps: ['Book class'] },
    { id: 'd5', title: 'Spa night', heat: 5, location: 'home', load: 1, style: 'mixed', minutes: 120, steps: ['Light candles'] },
  ],
}), { virtual: true });

const {
  getAllPrompts,
  getPromptsByHeatLevel,
  getPromptsByCategory,
  getFilteredPrompts,
  getAllDates,
  filterDates,
  getContentStats,
  getAvailableCategories,
  getHeatLevels,
} = require('../../utils/contentLoader');

// ─── Prompt Loading ──────────────────────────────────────────────────────────

describe('getAllPrompts', () => {
  it('returns all prompts', () => {
    const prompts = getAllPrompts();
    expect(Array.isArray(prompts)).toBe(true);
    expect(prompts.length).toBeGreaterThan(0);
  });

  it('each prompt has required fields', () => {
    getAllPrompts().forEach(p => {
      expect(p.id).toBeDefined();
      expect(p.text).toBeDefined();
      expect(typeof p.heat).toBe('number');
    });
  });
});

describe('getPromptsByHeatLevel', () => {
  it('filters by heat level 1', () => {
    const heat1 = getPromptsByHeatLevel(1);
    heat1.forEach(p => expect(p.heat).toBe(1));
  });

  it('returns empty for heat level 0', () => {
    const heat0 = getPromptsByHeatLevel(0);
    expect(heat0).toEqual([]);
  });

  it('returns prompts for each valid heat level', () => {
    for (let h = 1; h <= 5; h++) {
      const prompts = getPromptsByHeatLevel(h);
      expect(prompts.length).toBeGreaterThanOrEqual(0);
      prompts.forEach(p => expect(p.heat).toBe(h));
    }
  });
});

describe('getPromptsByCategory', () => {
  it('returns prompts matching a category', () => {
    const emotional = getPromptsByCategory('emotional');
    emotional.forEach(p => expect(p.category).toBe('emotional'));
  });

  it('returns empty for nonexistent category', () => {
    expect(getPromptsByCategory('nonexistent')).toEqual([]);
  });
});

describe('getFilteredPrompts', () => {
  it('filters by maxHeatLevel', () => {
    const filtered = getFilteredPrompts({ maxHeatLevel: 2 });
    filtered.forEach(p => expect(p.heat).toBeLessThanOrEqual(2));
  });

  it('filters by categories array', () => {
    const filtered = getFilteredPrompts({ categories: ['romance'] });
    filtered.forEach(p => expect(p.category).toBe('romance'));
  });

  it('filters by both heat range and category', () => {
    const filtered = getFilteredPrompts({ maxHeatLevel: 1, categories: ['emotional'] });
    filtered.forEach(p => {
      expect(p.heat).toBeLessThanOrEqual(1);
      expect(p.category).toBe('emotional');
    });
  });

  it('returns all prompts with empty filter', () => {
    const all = getFilteredPrompts({});
    expect(all.length).toBe(getAllPrompts().length);
  });
});

// ─── Date Loading ────────────────────────────────────────────────────────────

describe('getAllDates', () => {
  it('returns all dates', () => {
    const dates = getAllDates();
    expect(Array.isArray(dates)).toBe(true);
    expect(dates.length).toBeGreaterThan(0);
  });

  it('each date has required fields', () => {
    getAllDates().forEach(d => {
      expect(d.id).toBeDefined();
      expect(d.title).toBeDefined();
      expect(typeof d.heat).toBe('number');
    });
  });
});

describe('filterDates', () => {
  it('filters by heat level', () => {
    const all = getAllDates();
    const filtered = filterDates(all, { heat: 1 });
    filtered.forEach(d => expect(d.heat).toBe(1));
  });

  it('filters by location', () => {
    const all = getAllDates();
    const homeDates = filterDates(all, { location: 'home' });
    homeDates.forEach(d => {
      expect(['home', 'either']).toContain(d.location);
    });
  });

  it('filters by load', () => {
    const all = getAllDates();
    const chill = filterDates(all, { load: 1 });
    chill.forEach(d => expect(d.load).toBeLessThanOrEqual(1));
  });

  it('returns all with empty filter', () => {
    const all = getAllDates();
    const filtered = filterDates(all, {});
    expect(filtered.length).toBe(all.length);
  });
});

// ─── Metadata ────────────────────────────────────────────────────────────────

describe('getContentStats', () => {
  it('returns stats object with prompts and dates counts', () => {
    const stats = getContentStats();
    expect(stats).toBeDefined();
    expect(typeof stats.totalPrompts).toBe('number');
    expect(typeof stats.totalDates).toBe('number');
    expect(stats.totalPrompts).toBeGreaterThan(0);
    expect(stats.totalDates).toBeGreaterThan(0);
  });
});

describe('getAvailableCategories', () => {
  it('returns a category map object', () => {
    const cats = getAvailableCategories();
    expect(typeof cats).toBe('object');
    expect(cats).not.toBeNull();
    expect(Object.keys(cats).length).toBeGreaterThan(0);
    Object.entries(cats).forEach(([key, val]) => {
      expect(typeof key).toBe('string');
      expect(typeof val).toBe('string');
    });
  });
});

describe('getHeatLevels', () => {
  it('returns a heat level map object', () => {
    const levels = getHeatLevels();
    expect(typeof levels).toBe('object');
    expect(levels).not.toBeNull();
    expect(Object.keys(levels).length).toBeGreaterThan(0);
  });
});
