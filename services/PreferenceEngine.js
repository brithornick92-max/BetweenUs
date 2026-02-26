// services/PreferenceEngine.js — Unified Preference Engine for Between Us
//
// The single source of truth for all user preferences that shape content.
// Combines: heat level, relationship season, nervous system load, soft boundaries,
// tone, climate, interaction style, and relationship duration into one coherent
// filtering pipeline.
//
// Every screen that shows content calls PreferenceEngine.getContentProfile()
// to get a snapshot of all active preferences, then uses the filtering helpers.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { RelationshipSeasons, SoftBoundaries, NicknameEngine } from './PolishEngine';
import {
  ContentIntensityMatcher,
  ClimateInfluenceRouter,
  RelationshipClimateState,
} from './ConnectionEngine';

// ═══════════════════════════════════════════════════════
// ContentProfile — snapshot of all active preferences
// ═══════════════════════════════════════════════════════

/**
 * Gathers all user preferences into a single profile object.
 * Call this before filtering any content.
 *
 * Returns:
 * {
 *   heatLevel: number (1-5),
 *   maxHeat: number (capped by boundaries + energy),
 *   season: { id, preferShort, promptTones, preferLoad, preferStyle, maxDuration },
 *   energy: { level, maxHeat, preferShort, tones },
 *   climate: { id, preferredCategories, preferLoad, preferStyle },
 *   boundaries: { hideSpicy, hiddenCategories, pausedEntries, pausedDates, maxHeatOverride },
 *   tone: string (warm|playful|intimate|minimal),
 *   relationshipDuration: string (new|developing|established|mature|long_term),
 * }
 */
export async function getContentProfile(userProfile = {}) {
  // 1. Heat Level Preference (saved in user profile via HeatLevelSettingsScreen)
  const heatLevelPref = userProfile?.heatLevelPreference || 5;

  // 2. Relationship Season
  const seasonData = await RelationshipSeasons.get();
  const seasonId = seasonData?.id || 'cozy';
  const seasonInfluence = RelationshipSeasons.getContentInfluence(seasonId);

  // 3. Energy Level
  const energyLevel = await ContentIntensityMatcher.getEnergyLevel();
  const energyParams = ContentIntensityMatcher.getContentParams(energyLevel);

  // 4. Relationship Climate
  const climateData = await RelationshipClimateState.get();
  const climateId = climateData?.id || null;
  const climateCategories = climateId
    ? ClimateInfluenceRouter.getPreferredCategories(climateId)
    : [];
  const climateDateDims = climateId
    ? ClimateInfluenceRouter.getPreferredDateDimensions(climateId)
    : { preferLoad: 2, preferStyle: 'mixed' };

  // 5. Soft Boundaries
  const boundaries = await SoftBoundaries.getAll();

  // 6. Tone (from NicknameEngine)
  const nicknameConfig = await NicknameEngine.getConfig();
  const tone = nicknameConfig?.tone || 'warm';

  // 7. Relationship duration category
  const durationCategory = getDurationCategory(userProfile);

  // Calculate effective max heat: the lowest ceiling from user pref, energy, and boundaries
  const caps = [heatLevelPref, energyParams.maxHeat];
  if (boundaries?.maxHeatOverride != null) caps.push(boundaries.maxHeatOverride);
  if (boundaries?.hideSpicy) caps.push(3);
  const effectiveMaxHeat = Math.min(...caps);

  // Determine preferShort from season or energy
  const preferShort = seasonInfluence.preferShort || energyParams.preferShort || false;

  return {
    heatLevel: heatLevelPref,
    maxHeat: effectiveMaxHeat,
    season: {
      id: seasonId,
      preferShort: seasonInfluence.preferShort || false,
      promptTones: seasonInfluence.promptTones || [],
      preferLoad: seasonInfluence.preferLoad ?? 2,
      preferStyle: seasonInfluence.preferStyle || 'mixed',
      maxDuration: seasonInfluence.maxDuration || null,
    },
    energy: {
      level: energyLevel,
      maxHeat: energyParams.maxHeat,
      preferShort: energyParams.preferShort || false,
      tones: energyParams.tones || [],
    },
    climate: {
      id: climateId,
      preferredCategories: climateCategories,
      preferLoad: climateDateDims.preferLoad,
      preferStyle: climateDateDims.preferStyle,
    },
    boundaries: boundaries || {},
    tone,
    relationshipDuration: durationCategory,
    preferShort,
  };
}

// Score and filter prompts based on user profile and ratings
function filterPrompts(allPrompts, profile, options = {}) {
  if (!Array.isArray(allPrompts) || !profile) return allPrompts || [];

  const {
    maxHeat,
    boundaries,
    season,
    climate,
    preferShort,
    energy,
    relationshipDuration,
  } = profile;

  // Phase 1: Eligibility filtering
  const eligible = allPrompts.filter((prompt) => {
    const heat = prompt.heat || 1;

    // Heat cap
    if (heat > maxHeat) return false;

    // Hidden categories
    if (boundaries?.hiddenCategories?.includes(prompt.category)) return false;

    // Paused entries
    if (boundaries?.pausedEntries?.includes(prompt.id)) return false;

    // Relationship duration filtering — skip entirely when user has no start date ('universal')
    if (
      relationshipDuration &&
      relationshipDuration !== 'universal' &&
      Array.isArray(prompt.relationshipDuration) &&
      prompt.relationshipDuration.length > 0
    ) {
      if (
        !prompt.relationshipDuration.includes('universal') &&
        !prompt.relationshipDuration.includes(relationshipDuration)
      ) {
        return false;
      }
    }

    return true;
  });

  // Phase 2: Soft scoring (boost/demote by relevance)
  // Personalization: boost/suppress by user ratings (sync for now)
  let ratings = {};
  if (typeof AsyncStorage.getItemSync === 'function') {
    try {
      const allKeys = AsyncStorage.getAllKeysSync();
      const ratingKeys = allKeys.filter((k) => k.startsWith('prompt_rating_'));
      ratingKeys.forEach((k) => {
        ratings[k.replace('prompt_rating_', '')] = AsyncStorage.getItemSync(k);
      });
    } catch (e) { /* fallback to no ratings */ }
  }

  const scored = eligible.map((prompt) => {
    let score = 0;
    const cat = prompt.category || '';

    // +2 if category matches climate preference
    if (climate?.preferredCategories?.includes(cat)) {
      score += 2;
    }

    // +1 if prompt tone tags overlap with season prompt tones
    // (We match category names to season promptTones loosely)
    const seasonTones = season?.promptTones || [];
    const categoryToneMap = {
      romance: ['warm', 'soft', 'reflective'],
      emotional: ['deep', 'honest', 'reflective', 'gentle'],
      playful: ['playful', 'light', 'spontaneous', 'bold'],
      physical: ['sensual', 'bold'],
      fantasy: ['bold', 'sensual', 'playful'],
      memory: ['warm', 'reflective', 'appreciative'],
      future: ['deep', 'future', 'honest'],
      sensory: ['soft', 'gentle', 'cozy', 'sensual'],
      visual: ['playful', 'bold'],
      kinky: ['bold', 'sensual'],
      location: ['spontaneous', 'bold', 'playful'],
      seasonal: ['warm', 'soft', 'reflective'],
    };
    const catTones = categoryToneMap[cat] || [];
    const toneOverlap = catTones.filter((t) => seasonTones.includes(t)).length;
    score += toneOverlap * 0.5;

    // +1 for energy-appropriate tones
    const energyTones = energy?.tones || [];
    const energyOverlap = catTones.filter((t) => energyTones.includes(t)).length;
    score += energyOverlap * 0.3;

    // -0.5 if preferShort and prompt text is long (>120 chars)
    if (preferShort && prompt.text.length > 120) {
      score -= 0.5;
    }

    // Personalization: boost/suppress by rating
    const rating = ratings[prompt.id];
    if (rating === 'love') score += 2;
    if (rating === 'neutral') score += 0;
    if (rating === 'hate') score -= 2;

    // Small random jitter so same-score prompts shuffle
    score += Math.random() * 0.2;

    return { prompt, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.prompt);
}



// ═══════════════════════════════════════════════════════
// Date Filtering — Uses the full content profile
// ═══════════════════════════════════════════════════════

/**
 * Score and filter dates based on the user's full content profile.
 * Uses the emotional dimension system: mood (1-3), load (1-3), style (talking/doing/mixed).
 *
 * Smart matching score:
 *   (3 - |date.heat - user.heat|) +
 *   (3 - |date.load - user.load|) +
 *   (style match: exact=2, mixed=1, mismatch=0)
 *
 * Result labels:
 *   ≥ 7  — 🌟 Perfect fit
 *   ≥ 5  — 👍 Good match
 *   < 5  — 🔄 Try something gentler
 *
 * @param {object} selectedDimensions - Optional active UI selections
 *   e.g. { heat: 3, load: 1, style: 'talking' }
 */
export function filterDatesWithProfile(allDates, profile, selectedDimensions = null) {
  if (!Array.isArray(allDates) || !profile) return allDates || [];

  const { maxHeat, boundaries, season, climate, preferShort } = profile;

  // Phase 1: Hard filters
  const eligible = allDates.filter((date) => {
    if (!date || typeof date !== 'object') return false;

    // Paused dates
    if (boundaries?.pausedDates?.includes(date.id)) return false;

    // Season max duration
    if (season?.maxDuration && date.minutes > season.maxDuration) return false;

    // Heat cap
    if (typeof date.heat === 'number' && date.heat > maxHeat) return false;

    // If user selected specific heat, require it
    if (selectedDimensions?.heat != null && date.heat !== selectedDimensions.heat) return false;

    // If user selected specific load, require it
    if (selectedDimensions?.load != null && date.load !== selectedDimensions.load) return false;

    // If user selected specific style, require it
    if (selectedDimensions?.style && date.style !== selectedDimensions.style) return false;

    return true;
  });

  // Phase 2: Smart matching score
  const userHeat = selectedDimensions?.heat || profile.heatLevel || 3;
  const userLoad = selectedDimensions?.load || (season?.preferLoad ?? 2);
  const userStyle = selectedDimensions?.style || climate?.preferStyle || 'mixed';

  const scored = eligible.map((date) => {
    let score = 0;

    // Core smart matching: mood proximity (0-3)
    score += 3 - Math.abs((date.heat || 1) - userHeat);

    // Core smart matching: load proximity (0-3)
    score += 3 - Math.abs((date.load || 2) - userLoad);

    // Core smart matching: style (0, 1, or 2)
    if (date.style === userStyle) {
      score += 2;
    } else if (date.style === 'mixed' || userStyle === 'mixed') {
      score += 1;
    }

    // +1 for matching season-preferred load
    if (season?.preferLoad != null && date.load === season.preferLoad) {
      score += 1;
    }

    // +0.5 for matching season-preferred style
    if (season?.preferStyle && date.style === season.preferStyle) {
      score += 0.5;
    }

    // +1 for matching climate-preferred load
    if (climate?.preferLoad != null && date.load === climate.preferLoad) {
      score += 1;
    }

    // +1 for home dates when preferShort (cozy mode)
    if (preferShort && date.location === 'home') {
      score += 1;
    }

    // -0.5 for long dates when preferShort
    if (preferShort && date.minutes > 60) {
      score -= 0.5;
    }

    // Deterministic tie-breaker based on date id (no random jitter —
    // random made the deck order change on every recomputation)
    const idHash = (date.id || '').split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
    score += (Math.abs(idHash) % 100) * 0.003;  // 0 – 0.3 range, stable per date

    // Match label
    const baseScore = score - ((Math.abs(idHash) % 100) * 0.003); // strip tie-breaker for label
    let matchLabel = '🔄';
    if (baseScore >= 7) matchLabel = '🌟';
    else if (baseScore >= 5) matchLabel = '👍';

    return { date: { ...date, _matchLabel: matchLabel, _matchScore: Math.round(baseScore) }, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.date);
}

// ═══════════════════════════════════════════════════════
// Tone-Aware Copy Generation
// ═══════════════════════════════════════════════════════

/**
 * Get the tone-appropriate sub-greeting for the home screen
 * based on the full preference profile.
 */
export async function getSmartGreeting(profile) {
  const tone = profile?.tone || 'warm';
  const seasonId = profile?.season?.id || 'cozy';
  const energyLevel = profile?.energy?.level || 'medium';

  // Base greeting from NicknameEngine tone
  const tonePhrase = await NicknameEngine.getTonePhrase('home_sub');

  // Season-aware embellishment
  const seasonPhrases = {
    busy: [
      'Something quick and meaningful tonight.',
      'A small moment, just for you two.',
      'Even busy seasons deserve a pause.',
    ],
    cozy: [
      'Settle in together tonight.',
      'Warmth is waiting for you.',
      'A cozy evening, just the two of you.',
    ],
    growth: [
      'Ready to go a little deeper tonight?',
      'Growing closer, one question at a time.',
      'Tonight is for honest conversations.',
    ],
    adventure: [
      'Something new is waiting.',
      'Let\'s try something different tonight.',
      'Adventure starts with a question.',
    ],
    rest: [
      'Take it slow tonight.',
      'No pressure — just presence.',
      'Gentle moments are enough.',
    ],
  };

  // Energy-aware fallback
  const energyPhrases = {
    low: 'Something gentle for tonight.',
    medium: tonePhrase,
    open: 'The night is yours.',
  };

  const seasonOptions = seasonPhrases[seasonId] || seasonPhrases.cozy;

  // Pick a greeting: prefer season-aware, with energy fallback
  if (energyLevel === 'low') {
    // Low energy overrides to gentle
    return energyPhrases.low;
  }

  // Use hour-based rotation for variety
  const hourIndex = new Date().getHours() % seasonOptions.length;
  return seasonOptions[hourIndex] || tonePhrase;
}

// ═══════════════════════════════════════════════════════
// Smart Prompt of the Day — preference-aware
// ═══════════════════════════════════════════════════════

/**
 * Select the best daily prompt using the full preference profile.
 * Deterministic per day but influenced by all user preferences.
 *
 * @param {Array}  allPrompts  – full prompt catalog (pre-filtered by heat / duration)
 * @param {Object} profile     – user content-preference profile
 * @param {string} dateKey     – "YYYY-MM-DD"
 * @param {Set|Array} [excludeIds] – prompt IDs already shown this month (no repeats)
 */
export function selectDailyPrompt(allPrompts, profile, dateKey, excludeIds) {
  // First filter by preferences
  const ranked = filterPrompts(allPrompts, profile);

  if (ranked.length === 0) return null;

  // Build the exclusion set (supports Set or Array)
  const seen = excludeIds instanceof Set
    ? excludeIds
    : new Set(Array.isArray(excludeIds) ? excludeIds : []);

  // Pick from top 30% of ranked prompts for quality
  const topPool = ranked.slice(0, Math.max(5, Math.floor(ranked.length * 0.3)));

  // Remove prompts already shown this month
  const fresh = topPool.filter(p => !seen.has(p.id));

  // If every top-pool prompt was already used this month, fall back to the
  // full ranked list minus seen, then ultimately allow repeats.
  const pool = fresh.length > 0
    ? fresh
    : ranked.filter(p => !seen.has(p.id)).length > 0
      ? ranked.filter(p => !seen.has(p.id))
      : topPool; // all exhausted — allow repeats

  // Deterministic daily selection based on date
  const [y, m, d] = (dateKey || new Date().toISOString().split('T')[0])
    .split('-')
    .map(Number);
  const dateHash = ((y * 31 + m) * 31 + d) ^ (y * 7 + m * 13 + d * 37);
  const index = Math.abs(dateHash) % pool.length;

  return pool[index];
}

// ═══════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════

function getDurationCategory(userProfile) {
  if (!userProfile?.relationshipStartDate) return 'universal';

  const startDate = new Date(userProfile.relationshipStartDate);
  const now = new Date();
  const days = Math.ceil(Math.abs(now - startDate) / (1000 * 60 * 60 * 24));

  if (days < 30) return 'new';
  if (days < 365) return 'developing';
  if (days < 1095) return 'established';
  if (days < 1825) return 'mature';
  return 'long_term';
}

/**
 * Quick check: should this prompt be shown given current boundaries?
 * (Synchronous, uses cached boundary data from profile)
 */
export function shouldShowPrompt(prompt, profile) {
  if (!prompt || !profile) return true;
  const heat = typeof prompt.heat === 'number' ? prompt.heat : 1;
  if (heat > profile.maxHeat) return false;
  if (profile.boundaries?.hiddenCategories?.includes(prompt.category)) return false;
  if (profile.boundaries?.pausedEntries?.includes(prompt.id)) return false;
  return true;
}

/**
 * Quick check: should this date be shown given current boundaries?
 */
export function shouldShowDate(date, profile) {
  if (!date || !profile) return true;
  if (profile.boundaries?.pausedDates?.includes(date.id)) return false;
  if (profile.season?.maxDuration && date.minutes > profile.season.maxDuration) return false;
  if (typeof date.heat === 'number' && date.heat > profile.maxHeat) return false;
  return true;
}

module.exports = {
  getContentProfile,
  filterPrompts,
  filterDatesWithProfile,
  getSmartGreeting,
  selectDailyPrompt,
  shouldShowPrompt,
  shouldShowDate,
  getDurationCategory,
};
