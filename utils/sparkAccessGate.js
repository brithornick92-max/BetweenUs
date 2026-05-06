import { ALL_HEAT_LEVELS, getPreferredHeatLevels, normalizeHeatLevel } from './heatLevelRanges';

const asObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

const normalizeCap = (value) => {
  const normalized = normalizeHeatLevel(value);
  return typeof normalized === 'number' ? normalized : null;
};

export const SPARK_ACCESS_GATE_TYPES = Object.freeze({
  SPICY_HIDDEN: 'spicy_hidden',
  HEAT_TOO_LOW: 'heat_too_low',
  SPICY_HIDDEN_AND_HEAT_TOO_LOW: 'spicy_hidden_and_heat_too_low',
});

export function getSparkAccessGate(profile = {}) {
  const preferences = asObject(profile?.preferences);
  const boundaries = {
    ...asObject(preferences?.softBoundaries),
    ...asObject(profile?.softBoundaries),
    ...asObject(profile?.boundaries),
  };
  const spicyHidden = !!(profile?.hideSpicy || preferences?.hideSpicy || boundaries?.hideSpicy);
  const heatCaps = [
    profile?.maxHeat,
    preferences?.maxHeat,
    profile?.heatLevelPreference,
    preferences?.heatLevelPreference,
    profile?.heatLevel,
    preferences?.heatLevel,
    profile?.maxHeatLevel,
    preferences?.maxHeatLevel,
    boundaries?.maxHeatOverride,
  ]
    .map(normalizeCap)
    .filter((value) => typeof value === 'number');
  const maxHeat = heatCaps.length ? Math.min(...heatCaps) : Math.max(...ALL_HEAT_LEVELS);
  const availableHeatLevels = getPreferredHeatLevels(profile)
    .filter((level) => level <= maxHeat);
  const hasSparkHeat = availableHeatLevels.some((level) => level >= 2);

  if (spicyHidden && !hasSparkHeat) {
    return {
      type: SPARK_ACCESS_GATE_TYPES.SPICY_HIDDEN_AND_HEAT_TOO_LOW,
      title: 'Spark Unavailable',
      message: 'You have spicy content disabled and your current heat setting is too low for Spark. Update your content settings to access Spark.',
      canContinue: false,
    };
  }

  if (!hasSparkHeat) {
    return {
      type: SPARK_ACCESS_GATE_TYPES.HEAT_TOO_LOW,
      title: 'Increase Heat Level',
      message: 'Your current heat setting is too low for Spark. Increase your heat level to access Spark.',
      canContinue: false,
    };
  }

  if (spicyHidden) {
    return {
      type: SPARK_ACCESS_GATE_TYPES.SPICY_HIDDEN,
      title: 'Spicy Content Disabled',
      message: 'You have spicy content disabled. Continue to Spark anyway?',
      canContinue: true,
    };
  }

  return null;
}
