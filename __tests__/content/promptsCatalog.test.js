const promptsCatalog = require('../../content/prompts.json');

const LEGACY_HEAT_PREFIX_MISMATCH_IDS = [
  'h1_001',
  'h1_002',
  'h1_003',
  'h1_005',
  'h1_009',
  'h1_010',
  'h1_013',
  'h1_016',
  'h1_018',
  'h1_019',
  'h1_021',
  'h1_022',
  'h1_029',
  'h1_031',
  'h1_045',
  'h1_051',
  'h1_053',
  'h1_054',
  'h1_055',
  'h1_063',
  'h1_064',
  'h1_076',
  'h1_088',
  'h1_096',
  'h1_103',
  'h1_104',
  'h1_107',
  'h1_108',
  'h1_109',
  'h1_110',
  'h1_112',
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
  'h1_175',
  'h1_179',
  'h1_181',
  'h1_182',
  'h1_183',
  'h1_185',
  'h1_196',
  'h1_197',
  'h2_056',
  'h3_008',
  'h3_014',
  'h3_019',
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
  'h3_085',
  'h3_095',
  'h3_096',
  'h3_099',
  'h3_208',
  'h4_012',
  'h4_032',
  'h4_038',
  'h4_054',
  'h4_058',
  'h4_059',
  'h4_060',
  'h4_061',
  'h4_065',
  'h4_068',
  'h4_086',
  'h4_088',
  'h4_090',
  'h4_091',
  'h4_093',
  'h4_095',
  'h4_097',
  'h4_101',
  'h4_103',
  'h4_122',
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
  'h5_001',
  'h5_002',
  'h5_006',
  'h5_007',
  'h5_008',
  'h5_022',
  'h5_024',
  'h5_034',
  'h5_040',
  'h5_048',
  'h5_052',
  'h5_054',
  'h5_055',
  'h5_060',
  'h5_071',
  'h5_074',
  'h5_086',
  'h5_121',
  'h5_140',
  'h5_142',
  'h5_143',
  'h5_145',
  'h5_148',
  'h5_150',
  'h5_151',
  'h5_155',
  'h5_157',
  'h5_158',
  'h5_159',
  'h5_160',
  'h5_161',
  'h5_162',
  'h5_163',
  'h5_164',
  'h5_165',
  'h5_166',
  'h5_167',
  'h5_168',
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
});
