const {
  SPARK_ACCESS_GATE_TYPES,
  getSparkAccessGate,
} = require('../../utils/sparkAccessGate');

describe('sparkAccessGate', () => {
  it('allows Spark when content settings allow heat above level 1', () => {
    expect(getSparkAccessGate({
      heatLevelRangeId: 'gentle',
      allowedHeatLevels: [1, 2, 3],
      heatLevelPreference: 3,
      boundaries: { hideSpicy: false },
    })).toBeNull();
  });

  it('asks for confirmation when spicy content is hidden', () => {
    expect(getSparkAccessGate({
      heatLevelRangeId: 'gentle',
      allowedHeatLevels: [1, 2, 3],
      heatLevelPreference: 3,
      boundaries: { hideSpicy: true, maxHeatOverride: 3 },
    })).toEqual(expect.objectContaining({
      type: SPARK_ACCESS_GATE_TYPES.SPICY_HIDDEN,
      title: 'Spicy Content Disabled',
      canContinue: true,
    }));
  });

  it('blocks Spark when heat is level 1 only', () => {
    expect(getSparkAccessGate({
      heatLevelPreference: 1,
      boundaries: { hideSpicy: false },
    })).toEqual(expect.objectContaining({
      type: SPARK_ACCESS_GATE_TYPES.HEAT_TOO_LOW,
      title: 'Increase Heat Level',
      canContinue: false,
    }));
  });

  it('prioritizes settings changes when spicy content and heat both block Spark', () => {
    expect(getSparkAccessGate({
      allowedHeatLevels: [1],
      heatLevelPreference: 1,
      boundaries: { hideSpicy: true, maxHeatOverride: 1 },
    })).toEqual(expect.objectContaining({
      type: SPARK_ACCESS_GATE_TYPES.SPICY_HIDDEN_AND_HEAT_TOO_LOW,
      title: 'Spark Unavailable',
      canContinue: false,
    }));
  });
});
