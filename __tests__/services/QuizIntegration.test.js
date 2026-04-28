import * as PreferenceEngine from '../../services/PreferenceEngine';
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

const ENERGY_PARAMS = {
  low: { maxHeat: 2, preferShort: true, tones: ['soft', 'cozy', 'gentle'] },
  medium: { maxHeat: 3, preferShort: false, tones: ['warm', 'playful', 'reflective'] },
  open: { maxHeat: 5, preferShort: false, tones: ['sensual', 'deep', 'playful'] },
};

describe('Quiz Integration: "What Feels Like Us" Actually Shapes Content', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
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
    ContentIntensityMatcher.getEnergyLevel.mockResolvedValue('medium');
    ContentIntensityMatcher.getContentParams.mockImplementation((level) => ENERGY_PARAMS[level] || ENERGY_PARAMS.medium);
  });

  describe('Love Language Integration', () => {
    const prompts = [
      { id: 'p1', text: 'Emotional prompt', category: 'emotional', heat: 2 },
      { id: 'p2', text: 'Physical prompt', category: 'physical', heat: 2 },
      { id: 'p3', text: 'Memory prompt', category: 'memory', heat: 2 },
      { id: 'p4', text: 'Playful prompt', category: 'playful', heat: 2 },
    ];

    it('boosts emotional/romance/memory prompts for "Words of Affirmation"', async () => {
      const profile = await PreferenceEngine.getContentProfile({
        heatLevelPreference: 5,
        quiz: { loveLanguage: 'words' },
      });

      const ranked = PreferenceEngine.filterPrompts(prompts, profile);

      // Emotional and memory should rank higher than physical/playful
      expect(ranked[0].category).toMatch(/emotional|memory/);
    });

    it('boosts physical/sensory prompts for "Physical Touch"', async () => {
      const profile = await PreferenceEngine.getContentProfile({
        heatLevelPreference: 5,
        quiz: { loveLanguage: 'touch' },
      });

      const ranked = PreferenceEngine.filterPrompts(prompts, profile);

      // Physical should rank at/near the top (within top 3)
      expect(ranked.findIndex(p => p.category === 'physical')).toBeLessThan(3);
    });
  });

  describe('Relationship Goal Integration', () => {
    const prompts = [
      { id: 'p1', text: 'What do you hope for our future together?', category: 'future', heat: 2 },
      { id: 'p2', text: 'Share a quick memory from today.', category: 'memory', heat: 2 },
      { id: 'p3', text: 'What is a playful dare for tonight?', category: 'playful', heat: 2 },
      { id: 'p4', text: 'How do you want to be touched right now?', category: 'physical', heat: 3 },
    ];

    it('prioritizes short, gentle prompts for "Feel close on busy days"', async () => {
      const profile = await PreferenceEngine.getContentProfile({
        heatLevelPreference: 5,
        quiz: { relationshipGoal: 'communicate' },
      });

      const ranked = PreferenceEngine.filterPrompts(prompts, profile);

      // Memory prompt (short, gentle) should rank high
      expect(ranked[0].category).toBe('memory');
    });

    it('prioritizes emotional/future prompts for "Keep choosing each other"', async () => {
      const profile = await PreferenceEngine.getContentProfile({
        heatLevelPreference: 5,
        quiz: { relationshipGoal: 'deeper' },
      });

      const ranked = PreferenceEngine.filterPrompts(prompts, profile);

      // Future prompt should rank highly (within top 2)
      expect(ranked.findIndex(p => p.category === 'future')).toBeLessThan(2);
    });

    it('prioritizes physical/sensory prompts for "Keep intimacy alive"', async () => {
      const profile = await PreferenceEngine.getContentProfile({
        heatLevelPreference: 5,
        quiz: { relationshipGoal: 'intimacy' },
      });

      const ranked = PreferenceEngine.filterPrompts(prompts, profile);

      // Physical prompt should rank high
      expect(ranked.findIndex(p => p.category === 'physical')).toBeLessThan(2);
    });
  });

  describe('Date Style Integration', () => {
    const dates = [
      { id: 'd1', title: 'Cozy movie night', location: 'home', heat: 2, load: 1, style: 'mixed', minutes: 90 },
      { id: 'd2', title: 'Downtown adventure', location: 'out', heat: 2, load: 3, style: 'doing', minutes: 120 },
      { id: 'd3', title: 'Coffee and a walk', location: 'out', heat: 1, load: 2, style: 'talking', minutes: 60 },
    ];

    it('boosts home dates by 1.5x for "Cozy nights in"', async () => {
      const profile = await PreferenceEngine.getContentProfile({
        heatLevelPreference: 5,
        quiz: { idealDateStyle: 'home' },
      });

      const ranked = PreferenceEngine.filterDatesWithProfile(dates, profile);

      // Home date should be first
      expect(ranked[0].location).toBe('home');
    });

    it('boosts out dates by 1.5x for "Adventures out"', async () => {
      const profile = await PreferenceEngine.getContentProfile({
        heatLevelPreference: 5,
        quiz: { idealDateStyle: 'adventure' },
      });

      const ranked = PreferenceEngine.filterDatesWithProfile(dates, profile);

      // Out dates should rank higher
      expect(ranked[0].location).toBe('out');
    });

    it('applies no location boost for "A mix of both"', async () => {
      const profile = await PreferenceEngine.getContentProfile({
        heatLevelPreference: 5,
        quiz: { idealDateStyle: 'mixed' },
      });

      expect(profile.quiz.dateLocationBoost).toBe(1.0);
    });
  });

  describe('Communication Style Integration', () => {
    const prompts = [
      { id: 'p1', text: 'What is one honest thing you need to say?', category: 'emotional', heat: 2 },
      { id: 'p2', text: 'Tell me something sweet about today.', category: 'memory', heat: 1 },
      { id: 'p3', text: 'What is a silly dare for tonight?', category: 'playful', heat: 2 },
    ];

    it('boosts direct/honest prompts for "Direct & honest"', async () => {
      const profile = await PreferenceEngine.getContentProfile({
        heatLevelPreference: 5,
        quiz: { communicationStyle: 'direct' },
      });

      const ranked = PreferenceEngine.filterPrompts(prompts, profile);

      // Emotional (honest tone) should rank high
      expect(ranked[0].category).toBe('emotional');
    });

    it('boosts gentle/soft prompts for "Gentle & careful"', async () => {
      const profile = await PreferenceEngine.getContentProfile({
        heatLevelPreference: 5,
        quiz: { communicationStyle: 'gentle' },
      });

      const ranked = PreferenceEngine.filterPrompts(prompts, profile);

      // Memory (gentle tone) should rank high
      expect(ranked[0].category).toBe('memory');
    });

    it('boosts playful/light prompts for "Playful & light"', async () => {
      const profile = await PreferenceEngine.getContentProfile({
        heatLevelPreference: 5,
        quiz: { communicationStyle: 'playful' },
      });

      const ranked = PreferenceEngine.filterPrompts(prompts, profile);

      // Playful should rank high
      expect(ranked[0].category).toBe('playful');
    });
  });

  describe('Has Kids Integration', () => {
    const dates = [
      { id: 'd1', title: 'Short home date', location: 'home', heat: 2, load: 1, style: 'talking', minutes: 30 },
      { id: 'd2', title: 'Medium home date', location: 'home', heat: 2, load: 2, style: 'mixed', minutes: 60 },
      { id: 'd3', title: 'Long adventure', location: 'out', heat: 2, load: 3, style: 'doing', minutes: 150 },
    ];

    it('boosts short, home dates when hasKids = true', async () => {
      const profile = await PreferenceEngine.getContentProfile({
        heatLevelPreference: 5,
        quiz: { hasKids: true },
      });

      const ranked = PreferenceEngine.filterDatesWithProfile(dates, profile);

      // Short/medium home dates should rank higher than long adventure
      expect(ranked[0].location).toBe('home');
      expect(ranked[0].minutes).toBeLessThanOrEqual(60);
    });

    it('demotes very long dates when hasKids = true', async () => {
      const profile = await PreferenceEngine.getContentProfile({
        heatLevelPreference: 5,
        quiz: { hasKids: true },
      });

      const ranked = PreferenceEngine.filterDatesWithProfile(dates, profile);

      // Long adventure should be last
      expect(ranked[ranked.length - 1].minutes).toBeGreaterThan(120);
    });
  });

  describe('Content Profile includes quiz data', () => {
    it('includes quiz preferences in the profile object', async () => {
      const profile = await PreferenceEngine.getContentProfile({
        heatLevelPreference: 3,
        quiz: {
          loveLanguage: 'words',
          relationshipGoal: 'communicate',
          idealDateStyle: 'home',
          communicationStyle: 'gentle',
          hasKids: true,
        },
      });

      expect(profile.quiz).toBeDefined();
      expect(profile.quiz.loveLanguage).toBe('words');
      expect(profile.quiz.relationshipGoal).toBe('communicate');
      expect(profile.quiz.idealDateStyle).toBe('home');
      expect(profile.quiz.communicationStyle).toBe('gentle');
      expect(profile.quiz.hasKids).toBe(true);
      expect(profile.quiz.preferredCategories).toContain('emotional');
      expect(profile.quiz.preferredTones).toContain('gentle');
      expect(profile.quiz.dateLocation).toBe('home');
      expect(profile.quiz.dateLocationBoost).toBe(1.5);
    });

    it('uses quiz preferShort when relationshipGoal = "communicate"', async () => {
      const profile = await PreferenceEngine.getContentProfile({
        heatLevelPreference: 5,
        quiz: { relationshipGoal: 'communicate' },
      });

      expect(profile.preferShort).toBe(true);
    });
  });
});
