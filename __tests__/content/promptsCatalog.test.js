const promptsCatalog = require('../../content/prompts.json');

const LEGACY_HEAT_PREFIX_MISMATCH_IDS = [
  'h1_001',
  'h1_003',
  'h1_010',
  'h1_016',
  'h1_019',
  'h1_021',
  'h1_031',
  'h1_053',
  'h1_054',
  'h1_055',
  'h1_063',
  'h1_064',
  'h1_076',
  'h1_088',
  'h1_103',
  'h1_107',
  'h1_110',
  'h1_113',
  'h1_116',
  'h1_124',
  'h1_125',
  'h1_126',
  'h1_127',
  'h1_128',
  'h1_129',
  'h1_130',
  'h1_131',
  'h1_133',
  'h1_134',
  'h1_135',
  'h1_146',
  'h1_148',
  'h1_153',
  'h1_164',
  'h1_185',
  'h1_196',
  'h2_056',
  'h3_054',
  'h3_056',
  'h3_057',
  'h3_059',
  'h3_060',
  'h3_061',
  'h3_062',
  'h3_066',
  'h3_067',
  'h3_070',
  'h3_071',
  'h3_072',
  'h3_073',
  'h3_096',
  'h3_099',
  'h3_208',
  'h4_038',
  'h4_054',
  'h4_058',
  'h4_061',
  'h4_065',
  'h4_068',
  'h4_091',
  'h4_103',
  'h4_125',
  'h4_126',
  'h4_128',
  'h4_131',
  'h4_133',
  'h4_134',
  'h4_135',
  'h4_136',
  'h4_138',
  'h4_141',
  'h5_008',
  'h5_052',
  'h5_074',
  'h5_140',
  'h5_142',
  'h5_143',
  'h5_148',
  'h5_150',
  'h5_155',
  'h5_159',
  'h5_160',
  'h5_161',
  'h5_163',
  'h5_166',
  'h5_167',
  'h5_200',
];

const items = promptsCatalog.items || [];
const categories = promptsCatalog?.meta?.categories || {};
const durations = promptsCatalog?.meta?.relationshipDurations || {};

describe('prompts catalog integrity', () => {

  it('matches the declared total prompt count', () => {
    expect(items).toHaveLength(promptsCatalog.meta.totalPrompts);
  });

  it('uses unique ids for every prompt', () => {
    const ids = items.map((prompt) => prompt.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses unique text for every prompt', () => {
    const texts = items.map((prompt) => prompt.text.trim().toLowerCase());
    expect(new Set(texts).size).toBe(texts.length);
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

  it('matches the audited legacy heat-prefix mismatch set', () => {
    const mismatches = items
      .filter((prompt) => {
        const match = /^h(\d+)_/.exec(prompt.id || '');
        return match && Number(match[1]) !== prompt.heat;
      })
      .map((prompt) => prompt.id)
      .sort();

    expect(mismatches).toEqual(LEGACY_HEAT_PREFIX_MISMATCH_IDS);
  });

  it('has at least 10 prompts per declared category', () => {
    const counts = {};
    Object.keys(categories).forEach((c) => (counts[c] = 0));
    items.forEach((prompt) => {
      if (counts[prompt.category] !== undefined) counts[prompt.category]++;
    });
    Object.entries(counts).forEach(([category, count]) => {
      expect(count).toBeGreaterThanOrEqual(10);
    });
  });

  it('does not frame fantasy prompts as non-consensual cheating or secrecy from a partner', () => {
    const bannedPatterns = [
      /\bcheat(?:ing)?\b/i,
      /\baffair\b/i,
      /\badultery\b/i,
      /\bbehind (?:your|my|their) back\b/i,
      /\bwithout (?:you|me|them|my partner|your partner) knowing\b/i,
      /\bdon'?t tell\b/i,
      /\bkeep it from\b/i,
      /\bmy partner is waiting\b/i,
      /\byour partner is waiting\b/i,
    ];

    const violatingIds = items
      .filter((prompt) => bannedPatterns.some((pattern) => pattern.test(prompt.text || '')))
      .map((prompt) => prompt.id);

    expect(violatingIds).toEqual([]);
  });

  it('uses sex instead of intimacy when a prompt asks how to start sex', () => {
    const bannedPatterns = [
      /\bstart intimacy\b/i,
      /\bstart morning intimacy\b/i,
      /\bstart the morning with intimacy\b/i,
      /\bmake intimacy easier to start\b/i,
    ];

    const violatingIds = items
      .filter((prompt) => bannedPatterns.some((pattern) => pattern.test(prompt.text || '')))
      .map((prompt) => prompt.id);

    expect(violatingIds).toEqual([]);
  });
});
