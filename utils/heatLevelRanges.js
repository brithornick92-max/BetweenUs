export const ALL_HEAT_LEVELS = Object.freeze([1, 2, 3, 4, 5]);

export const HEAT_LEVEL_RANGE_IDS = Object.freeze({
  GENTLE: 'gentle',
  BALANCED: 'balanced',
  HIGH_HEAT: 'high_heat',
  EVERYTHING: 'everything',
});

export const HEAT_LEVEL_RANGE_PRESETS = Object.freeze([
  Object.freeze({
    id: HEAT_LEVEL_RANGE_IDS.GENTLE,
    title: 'Gentle',
    label: 'Gentle',
    description: 'Levels 1-3: emotional, romantic, and sensual.',
    levels: Object.freeze([1, 2, 3]),
    icon: 'leaf-outline',
    accentLevel: 1,
  }),
  Object.freeze({
    id: HEAT_LEVEL_RANGE_IDS.BALANCED,
    title: 'Balanced',
    label: 'Balanced',
    description: 'Levels 2-4: romantic through steamy.',
    levels: Object.freeze([2, 3, 4]),
    icon: 'sparkles-outline',
    accentLevel: 3,
  }),
  Object.freeze({
    id: HEAT_LEVEL_RANGE_IDS.HIGH_HEAT,
    title: 'High Heat',
    label: 'High Heat',
    description: 'Levels 3-5: sensual, steamy, and explicit.',
    levels: Object.freeze([3, 4, 5]),
    icon: 'flame-outline',
    accentLevel: 5,
  }),
  Object.freeze({
    id: HEAT_LEVEL_RANGE_IDS.EVERYTHING,
    title: 'Everything',
    label: 'Everything',
    description: 'Levels 1-5: the full range of prompts.',
    levels: Object.freeze([1, 2, 3, 4, 5]),
    icon: 'infinite-outline',
    accentLevel: 4,
  }),
]);

const DEFAULT_RANGE_ID = HEAT_LEVEL_RANGE_IDS.EVERYTHING;

export function normalizeHeatLevel(value) {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.min(5, Math.max(1, Math.floor(numeric)));
}

export function normalizeHeatLevels(value) {
  return [...new Set(
    (Array.isArray(value) ? value : [])
      .map(normalizeHeatLevel)
      .filter((level) => typeof level === 'number')
  )].sort((left, right) => left - right);
}

export function getHeatLevelRangePreset(rangeId) {
  if (typeof rangeId !== 'string' || !rangeId.trim()) return null;
  return HEAT_LEVEL_RANGE_PRESETS.find((preset) => preset.id === rangeId.trim()) || null;
}

export function getDefaultHeatLevelRangePreset() {
  return getHeatLevelRangePreset(DEFAULT_RANGE_ID);
}

export function getHeatLevelRangePresetByLevels(levels) {
  const normalized = normalizeHeatLevels(levels);
  if (!normalized.length) return null;
  return HEAT_LEVEL_RANGE_PRESETS.find((preset) => {
    if (preset.levels.length !== normalized.length) return false;
    return preset.levels.every((level, index) => level === normalized[index]);
  }) || null;
}

export function getHeatLevelRangePresetForProfile(profile = {}) {
  const preferences = profile?.preferences && typeof profile.preferences === 'object'
    ? profile.preferences
    : {};
  const directPreset = getHeatLevelRangePreset(
    profile?.heatLevelRangeId || preferences?.heatLevelRangeId
  );

  if (directPreset) return directPreset;

  const explicitLevels = normalizeHeatLevels(
    profile?.allowedHeatLevels || preferences?.allowedHeatLevels || profile?.heatLevels || preferences?.heatLevels
  );
  const matchingPreset = getHeatLevelRangePresetByLevels(explicitLevels);

  if (matchingPreset) return matchingPreset;

  const legacyMax = normalizeHeatLevel(
    profile?.heatLevelPreference
      ?? preferences?.heatLevelPreference
      ?? profile?.heatLevel
      ?? profile?.maxHeatLevel
  );

  if (typeof legacyMax === 'number') {
    if (legacyMax <= 3) return getHeatLevelRangePreset(HEAT_LEVEL_RANGE_IDS.GENTLE);
    if (legacyMax === 4) return getHeatLevelRangePreset(HEAT_LEVEL_RANGE_IDS.BALANCED);
    return getDefaultHeatLevelRangePreset();
  }

  return getDefaultHeatLevelRangePreset();
}

export function getPreferredHeatLevels(profile = {}) {
  const preferences = profile?.preferences && typeof profile.preferences === 'object'
    ? profile.preferences
    : {};
  const explicitLevels = normalizeHeatLevels(
    profile?.allowedHeatLevels || preferences?.allowedHeatLevels || profile?.heatLevels || preferences?.heatLevels
  );

  if (explicitLevels.length > 0) return explicitLevels;

  const preset = getHeatLevelRangePresetForProfile(profile);
  return [...(preset?.levels || ALL_HEAT_LEVELS)];
}

export function buildHeatLevelRangePreference(rangeId) {
  const preset = getHeatLevelRangePreset(rangeId) || getDefaultHeatLevelRangePreset();
  const levels = [...preset.levels];

  return {
    heatLevelRangeId: preset.id,
    allowedHeatLevels: levels,
    heatLevelPreference: Math.max(...levels),
  };
}

export function hasExplicitHeatLevelFilter(profile = {}) {
  const preferences = profile?.preferences && typeof profile.preferences === 'object'
    ? profile.preferences
    : {};

  return (
    Array.isArray(profile?.allowedHeatLevels)
    || Array.isArray(preferences?.allowedHeatLevels)
    || Array.isArray(profile?.heatLevels)
    || Array.isArray(preferences?.heatLevels)
    || !!getHeatLevelRangePreset(profile?.heatLevelRangeId || preferences?.heatLevelRangeId)
  );
}

export function getExplicitHeatLevels(profile = {}) {
  const preferences = profile?.preferences && typeof profile.preferences === 'object'
    ? profile.preferences
    : {};

  if (Array.isArray(profile?.allowedHeatLevels)) return normalizeHeatLevels(profile.allowedHeatLevels);
  if (Array.isArray(preferences?.allowedHeatLevels)) return normalizeHeatLevels(preferences.allowedHeatLevels);
  if (Array.isArray(profile?.heatLevels)) return normalizeHeatLevels(profile.heatLevels);
  if (Array.isArray(preferences?.heatLevels)) return normalizeHeatLevels(preferences.heatLevels);
  return null;
}

export function profileAllowsHeatLevel(profile = {}, heatLevel) {
  const explicitLevels = getExplicitHeatLevels(profile);
  const heat = normalizeHeatLevel(heatLevel) || 1;
  if (explicitLevels) return explicitLevels.includes(heat);

  const preferences = profile?.preferences && typeof profile.preferences === 'object'
    ? profile.preferences
    : {};
  const preset = getHeatLevelRangePreset(profile?.heatLevelRangeId || preferences?.heatLevelRangeId);
  if (preset) return preset.levels.includes(heat);

  const legacyMax = normalizeHeatLevel(
    profile?.heatLevelPreference
      ?? preferences?.heatLevelPreference
      ?? profile?.heatLevel
      ?? profile?.maxHeatLevel
  );
  if (typeof legacyMax === 'number') return getPreferredHeatLevels(profile).includes(heat);

  return true;
}

export function formatHeatLevelList(levels) {
  return normalizeHeatLevels(levels).join(', ');
}
