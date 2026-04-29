const positionsCatalog = require('../../content/intimacy-positions.json');

const VALID_CATEGORIES = [
  'deep-connection',
  'exploratory',
  'sensual-rhythm',
  'playful-energy',
  'trust-vulnerability',
];

const VALID_ACCESSIBILITY = ['standard', 'active', 'low-mobility'];

const REPEATED_TEMPLATE_PHRASES = [
  'This position adds variety',
  'guided intimacy position',
  'People may like this because',
  'generic position card',
  'comfort, connection, and shared rhythm',
];

describe('intimacy positions catalog integrity', () => {
  const items = Array.isArray(positionsCatalog?.items) ? positionsCatalog.items : [];

  it('matches the declared total position count', () => {
    expect(items).toHaveLength(positionsCatalog.meta.totalPositions);
    expect(items).toHaveLength(200);
  });

  it('uses unique ids for every position', () => {
    const ids = items.map((position) => position.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses unique titles for every position', () => {
    const titles = items.map((position) => position.title.trim().toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('uses valid heat, category, accessibility, and releaseWeek values', () => {
    items.forEach((position) => {
      expect([1, 2, 3]).toContain(position.heat);
      expect(VALID_CATEGORIES).toContain(position.category);
      expect(VALID_ACCESSIBILITY).toContain(position.accessibility);
      expect(typeof position.releaseWeek).toBe('number');
      expect(Number.isInteger(position.releaseWeek)).toBe(true);
      expect(position.releaseWeek).toBeGreaterThanOrEqual(0);
    });
  });

  it('has required premium copy fields on every position', () => {
    const requiredFields = [
      'title',
      'focus',
      'howTo',
      'benefits',
      'shortSummary',
      'whyPeopleLikeIt',
    ];

    items.forEach((position) => {
      requiredFields.forEach((field) => {
        expect(typeof position[field]).toBe('string');
        expect(position[field].trim().length).toBeGreaterThan(0);
      });
    });
  });

  it('does not contain old generated template phrases', () => {
    items.forEach((position) => {
      const searchableCopy = [
        position.focus,
        position.howTo,
        position.benefits,
        position.makeItHotter,
        position.comfort,
        position.whyPeopleLikeIt,
        position.shortSummary,
      ]
        .filter(Boolean)
        .join(' ');

      REPEATED_TEMPLATE_PHRASES.forEach((phrase) => {
        expect(searchableCopy).not.toContain(phrase);
      });
    });
  });

  it('has valid release week metadata', () => {
    items.forEach((item) => {
      expect(Number.isInteger(item.releaseWeek)).toBe(true);
      expect(item.releaseWeek).toBeGreaterThanOrEqual(0);
    });
  });
});
