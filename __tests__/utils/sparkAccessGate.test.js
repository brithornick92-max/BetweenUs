const {
  SPARK_ACCESS_GATE_TYPES,
  getSparkAccessGate,
} = require('../../utils/sparkAccessGate');

describe('sparkAccessGate', () => {
  it('asks for sex-position confirmation before Spark for all content settings', () => {
    expect(getSparkAccessGate({
      heatLevelRangeId: 'gentle',
      allowedHeatLevels: [1, 2, 3],
      heatLevelPreference: 3,
      boundaries: { hideSpicy: false },
    })).toEqual({
      type: SPARK_ACCESS_GATE_TYPES.SEX_POSITIONS_CONFIRMATION,
      title: 'Sex Positions',
      message: 'The next screen is for sex positions. Do you want to continue?',
      canContinue: true,
    });

    expect(getSparkAccessGate({
      heatLevelRangeId: 'gentle',
      allowedHeatLevels: [1, 2, 3],
      heatLevelPreference: 3,
      boundaries: { hideSpicy: true, maxHeatOverride: 3 },
    })).toEqual(expect.objectContaining({
      type: SPARK_ACCESS_GATE_TYPES.SEX_POSITIONS_CONFIRMATION,
      title: 'Sex Positions',
      canContinue: true,
    }));

    expect(getSparkAccessGate({
      heatLevelPreference: 1,
      boundaries: { hideSpicy: false },
    })).toEqual(expect.objectContaining({
      type: SPARK_ACCESS_GATE_TYPES.SEX_POSITIONS_CONFIRMATION,
      title: 'Sex Positions',
      canContinue: true,
    }));
  });
});
