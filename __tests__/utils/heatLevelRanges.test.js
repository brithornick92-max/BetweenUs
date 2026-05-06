import {
  buildHeatLevelRangePreference,
  getHeatLevelRangePresetForProfile,
  getPreferredHeatLevels,
  profileAllowsHeatLevel,
} from '../../utils/heatLevelRanges';

describe('heatLevelRanges', () => {
  it('builds the high heat range preference payload', () => {
    expect(buildHeatLevelRangePreference('high_heat')).toEqual({
      heatLevelRangeId: 'high_heat',
      allowedHeatLevels: [3, 4, 5],
      heatLevelPreference: 5,
    });
  });

  it('maps legacy heat preferences to supported presets', () => {
    expect(getHeatLevelRangePresetForProfile({ heatLevelPreference: 3 }).id).toBe('gentle');
    expect(getHeatLevelRangePresetForProfile({ heatLevelPreference: 4 }).id).toBe('balanced');
    expect(getHeatLevelRangePresetForProfile({ heatLevelPreference: 5 }).id).toBe('everything');
  });

  it('resolves preferred heat levels from explicit profile fields', () => {
    expect(getPreferredHeatLevels({
      heatLevelRangeId: 'balanced',
      allowedHeatLevels: [2, 3, 4],
      heatLevelPreference: 4,
    })).toEqual([2, 3, 4]);
  });

  it('checks whether a profile allows a heat level', () => {
    const profile = {
      heatLevelRangeId: 'high_heat',
      allowedHeatLevels: [3, 4, 5],
      heatLevelPreference: 5,
    };

    expect(profileAllowsHeatLevel(profile, 2)).toBe(false);
    expect(profileAllowsHeatLevel(profile, 4)).toBe(true);
  });
});
