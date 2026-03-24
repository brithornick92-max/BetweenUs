jest.mock('../../services/PolishEngine', () => ({
  RelationshipSeasons: {
    get: jest.fn(),
    getContentInfluence: jest.fn(),
  },
  SoftBoundaries: {
    getAll: jest.fn(),
  },
  NicknameEngine: {
    getConfig: jest.fn(),
    getTonePhrase: jest.fn(),
  },
}));

jest.mock('../../services/ConnectionEngine', () => ({
  ContentIntensityMatcher: {
    getEnergyLevel: jest.fn(),
    getContentParams: jest.fn(),
  },
  ClimateInfluenceRouter: {
    getPreferredCategories: jest.fn(),
    getPreferredDateDimensions: jest.fn(),
  },
  RelationshipClimateState: {
    get: jest.fn(),
  },
}));

import PreferenceEngine from '../../services/PreferenceEngine';
import {
  RelationshipSeasons,
  SoftBoundaries,
  NicknameEngine,
} from '../../services/PolishEngine';
import {
  ContentIntensityMatcher,
  ClimateInfluenceRouter,
  RelationshipClimateState,
} from '../../services/ConnectionEngine';

const ENERGY_PARAMS = {
  low: { maxHeat: 2, preferShort: true, tones: ['soft', 'cozy', 'gentle'] },
  medium: { maxHeat: 3, preferShort: false, tones: ['warm', 'playful', 'reflective'] },
  open: { maxHeat: 5, preferShort: false, tones: ['sensual', 'deep', 'playful'] },
};

describe('PreferenceEngine', () => {
  let currentEnergyLevel;

  beforeEach(() => {
    jest.clearAllMocks();
    currentEnergyLevel = 'medium';

    RelationshipSeasons.get.mockResolvedValue({ id: 'cozy' });
    RelationshipSeasons.getContentInfluence.mockReturnValue({
      preferShort: false,
      promptTones: [],
      preferLoad: 2,
      preferStyle: 'mixed',
      maxDuration: null,
    });
    SoftBoundaries.getAll.mockResolvedValue({});
    NicknameEngine.getConfig.mockResolvedValue({ tone: 'warm' });
    NicknameEngine.getTonePhrase.mockResolvedValue('Warm phrase');
    RelationshipClimateState.get.mockResolvedValue(null);
    ClimateInfluenceRouter.getPreferredCategories.mockReturnValue([]);
    ClimateInfluenceRouter.getPreferredDateDimensions.mockReturnValue({
      preferLoad: 2,
      preferStyle: 'mixed',
    });
    ContentIntensityMatcher.getEnergyLevel.mockImplementation(async () => currentEnergyLevel);
    ContentIntensityMatcher.getContentParams.mockImplementation((level) => ENERGY_PARAMS[level] || ENERGY_PARAMS.medium);
  });

  describe('getContentProfile', () => {
    it('maps low energy into a chill preferred load and tighter caps', async () => {
      currentEnergyLevel = 'low';

      const profile = await PreferenceEngine.getContentProfile({ heatLevelPreference: 5 });

      expect(profile.energy.level).toBe('low');
      expect(profile.energy.preferLoad).toBe(1);
      expect(profile.maxHeat).toBe(2);
      expect(profile.preferShort).toBe(true);
    });

    it('maps open energy into an active preferred load', async () => {
      currentEnergyLevel = 'open';

      const profile = await PreferenceEngine.getContentProfile({ heatLevelPreference: 5 });

      expect(profile.energy.level).toBe('open');
      expect(profile.energy.preferLoad).toBe(3);
      expect(profile.maxHeat).toBe(5);
    });

    it('caps max heat when spicy content is hidden', async () => {
      SoftBoundaries.getAll.mockResolvedValue({ hideSpicy: true, maxHeatOverride: 3 });

      const profile = await PreferenceEngine.getContentProfile({ heatLevelPreference: 5 });

      expect(profile.maxHeat).toBe(3);
      expect(profile.boundaries.hideSpicy).toBe(true);
    });
  });

  describe('filterPrompts', () => {
    const prompts = [
      { id: 'prompt-romance', text: 'Romance prompt', category: 'romance', heat: 2 },
      { id: 'prompt-kinky', text: 'Kinky prompt', category: 'kinky', heat: 3 },
      { id: 'prompt-paused', text: 'Paused prompt', category: 'memory', heat: 2 },
      { id: 'prompt-hot', text: 'Too hot prompt', category: 'playful', heat: 5 },
    ];

    it('removes prompts that violate current boundaries', async () => {
      SoftBoundaries.getAll.mockResolvedValue({
        hideSpicy: true,
        hiddenCategories: ['kinky'],
        pausedEntries: ['prompt-paused'],
        pausedDates: [],
        maxHeatOverride: 3,
      });

      const profile = await PreferenceEngine.getContentProfile({ heatLevelPreference: 5 });
      const filtered = PreferenceEngine.filterPrompts(prompts, profile);

      expect(filtered.map((prompt) => prompt.id)).toEqual(['prompt-romance']);
    });

    it('shouldShowPrompt returns false for blocked prompts', async () => {
      SoftBoundaries.getAll.mockResolvedValue({
        hideSpicy: true,
        hiddenCategories: ['kinky'],
        pausedEntries: ['prompt-paused'],
        pausedDates: [],
        maxHeatOverride: 3,
      });

      const profile = await PreferenceEngine.getContentProfile({ heatLevelPreference: 5 });

      expect(PreferenceEngine.shouldShowPrompt({ id: 'prompt-paused', category: 'romance', heat: 2 }, profile)).toBe(false);
      expect(PreferenceEngine.shouldShowPrompt({ id: 'prompt-kinky', category: 'kinky', heat: 2 }, profile)).toBe(false);
      expect(PreferenceEngine.shouldShowPrompt({ id: 'prompt-hot', category: 'playful', heat: 5 }, profile)).toBe(false);
      expect(PreferenceEngine.shouldShowPrompt({ id: 'prompt-ok', category: 'romance', heat: 2 }, profile)).toBe(true);
    });

    it('reports a non-boundary reason when heat is capped by energy instead', async () => {
      currentEnergyLevel = 'low';

      const profile = await PreferenceEngine.getContentProfile({ heatLevelPreference: 5 });
      const visibility = PreferenceEngine.getPromptVisibilityState(
        { id: 'prompt-hot', category: 'playful', heat: 5 },
        profile,
      );

      expect(visibility.visible).toBe(false);
      expect(visibility.reason).toBe('energy-heat');
      expect(visibility.title).toBe('Outside your current settings');
    });
  });

  describe('filterDatesWithProfile', () => {
    const dates = [
      {
        id: 'date-low-energy',
        heat: 2,
        load: 1,
        style: 'mixed',
        location: 'home',
        minutes: 30,
      },
      {
        id: 'date-high-energy',
        heat: 2,
        load: 3,
        style: 'mixed',
        location: 'out',
        minutes: 30,
      },
    ];

    it('uses saved low energy to favor chill dates when no load filter is selected', async () => {
      currentEnergyLevel = 'low';
      const profile = await PreferenceEngine.getContentProfile({ heatLevelPreference: 5 });

      const ranked = PreferenceEngine.filterDatesWithProfile(dates, profile);

      expect(ranked[0].id).toBe('date-low-energy');
    });

    it('uses saved open energy to favor active dates when no load filter is selected', async () => {
      currentEnergyLevel = 'open';
      const profile = await PreferenceEngine.getContentProfile({ heatLevelPreference: 5 });

      const ranked = PreferenceEngine.filterDatesWithProfile(dates, profile);

      expect(ranked[0].id).toBe('date-high-energy');
    });

    it('still lets an explicit load filter override the saved energy preference', async () => {
      currentEnergyLevel = 'low';
      const profile = await PreferenceEngine.getContentProfile({ heatLevelPreference: 5 });

      const ranked = PreferenceEngine.filterDatesWithProfile(dates, profile, { load: 3 });

      expect(ranked).toHaveLength(1);
      expect(ranked[0].id).toBe('date-high-energy');
    });

    it('removes paused dates and dates above the boundary heat cap', async () => {
      SoftBoundaries.getAll.mockResolvedValue({
        hideSpicy: true,
        hiddenCategories: [],
        pausedEntries: [],
        pausedDates: ['date-paused'],
        maxHeatOverride: 2,
      });
      const profile = await PreferenceEngine.getContentProfile({ heatLevelPreference: 5 });
      const boundaryDates = [
        {
          id: 'date-paused',
          heat: 2,
          load: 1,
          style: 'mixed',
          location: 'home',
          minutes: 30,
        },
        {
          id: 'date-over-cap',
          heat: 3,
          load: 1,
          style: 'mixed',
          location: 'home',
          minutes: 30,
        },
        {
          id: 'date-allowed',
          heat: 2,
          load: 1,
          style: 'mixed',
          location: 'home',
          minutes: 30,
        },
      ];

      const ranked = PreferenceEngine.filterDatesWithProfile(boundaryDates, profile);

      expect(ranked.map((date) => date.id)).toEqual(['date-allowed']);
    });

    it('shouldShowDate returns false for paused or capped dates', async () => {
      SoftBoundaries.getAll.mockResolvedValue({
        hideSpicy: true,
        hiddenCategories: [],
        pausedEntries: [],
        pausedDates: ['date-paused'],
        maxHeatOverride: 2,
      });

      const profile = await PreferenceEngine.getContentProfile({ heatLevelPreference: 5 });

      expect(PreferenceEngine.shouldShowDate({ id: 'date-paused', heat: 2, minutes: 30 }, profile)).toBe(false);
      expect(PreferenceEngine.shouldShowDate({ id: 'date-over-cap', heat: 3, minutes: 30 }, profile)).toBe(false);
      expect(PreferenceEngine.shouldShowDate({ id: 'date-ok', heat: 2, minutes: 30 }, profile)).toBe(true);
    });

    it('reports a season reason when a date exceeds the current max duration', async () => {
      RelationshipSeasons.getContentInfluence.mockReturnValue({
        preferShort: false,
        promptTones: [],
        preferLoad: 2,
        preferStyle: 'mixed',
        maxDuration: 45,
      });

      const profile = await PreferenceEngine.getContentProfile({ heatLevelPreference: 5 });
      const visibility = PreferenceEngine.getDateVisibilityState(
        { id: 'date-long', heat: 2, minutes: 60 },
        profile,
      );

      expect(visibility.visible).toBe(false);
      expect(visibility.reason).toBe('season-duration');
      expect(visibility.title).toBe('Outside your current settings');
    });
  });
});