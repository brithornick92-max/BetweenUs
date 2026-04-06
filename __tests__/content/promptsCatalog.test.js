const promptsCatalog = require('../../content/prompts.json');

const LEGACY_HEAT_PREFIX_MISMATCH_IDS = [
  'h1_029',
  'h3_016',
  'h3_019',
  'h3_059',
  'h4_038',
  'h4_054',
  'h4_056',
  'h4_058',
  'h4_061',
  'h4_068',
  'h4_090',
  'h4_091',
  'h4_093',
  'h5_024',
  'h5_034',
  'h5_048',
  'h5_052',
  'h4_095',
  'h4_097',
  'h5_071',
  'h5_074',
  'h4_103',
  'h5_086',
  'h5_121',
  'h4_113',
  'h4_120',
  'h4_122',
  'h4_125',
  'h4_126',
  'h4_128',
  'h4_130',
  'h4_131',
  'h4_133',
  'h4_134',
  'h4_135',
  'h4_136',
  'h4_137',
  'h4_138',
  'h4_141',
  'h5_138',
  'h5_139',
  'h5_140',
  'h5_141',
  'h5_142',
  'h5_143',
  'h5_144',
  'h5_145',
  'h5_146',
  'h5_147',
  'h5_148',
  'h5_149',
  'h5_150',
  'h5_151',
  'h5_153',
  'h5_155',
  'h5_156',
  'h3_091',
  'h3_095',
  'h3_096',
  'h3_099',
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
].sort();

describe('prompts catalog integrity', () => {
  const items = Array.isArray(promptsCatalog?.items) ? promptsCatalog.items : [];
  const categories = promptsCatalog?.meta?.categories || {};
  const durations = promptsCatalog?.meta?.relationshipDurations || {};

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
});