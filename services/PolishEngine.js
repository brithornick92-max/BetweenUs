// services/PolishEngine.js — Polish-Level Systems for Between Us
//
// Seven subtle systems that deepen trust, personalization,
// and emotional resonance without adding noise.
//
// 1. RelationshipMilestones — Automatic, rare, reflective
// 2. GentleReEntry — Welcome back without guilt
// 3. NicknameEngine — Partner name & tone personalization
// 4. RelationshipSeasons — Light context that shapes content
// 5. SoftBoundaries — Elegant consent controls
// 6. OfflineGrace — Queue & degrade gracefully
// 7. YearReflection — End-of-year narrative (Premium)

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  MILESTONES_SHOWN: '@bu_milestones_shown',
  LAST_APP_OPEN: '@bu_last_app_open',
  APP_FIRST_OPEN: '@bu_app_first_open',
  NICKNAME_CONFIG: '@bu_nickname_config',
  RELATIONSHIP_SEASON: '@bu_relationship_season',
  SOFT_BOUNDARIES: '@bu_soft_boundaries',
  OFFLINE_QUEUE: '@bu_offline_queue',
  YEAR_REFLECTION: '@bu_year_reflection',
  LIFETIME_STATS: '@bu_lifetime_stats',
};

// ── Shared encrypt/decrypt helpers (device-local key via EncryptionService) ──
// Lazy-imported to avoid circular deps and keep cold-start fast.
const _encrypt = async (data) => {
  try {
    const { default: EncryptionService } = await import('./EncryptionService');
    return { __enc: true, d: await EncryptionService.encryptJson(data) };
  } catch {
    return data; // Fall back to plaintext if encryption unavailable
  }
};
const _decrypt = async (raw) => {
  if (!raw || typeof raw !== 'object') return raw;
  if (raw.__enc && raw.d) {
    try {
      const { default: EncryptionService } = await import('./EncryptionService');
      const data = await EncryptionService.decryptJson(raw.d);
      return data != null ? data : raw; // Return raw on failure so caller can still function
    } catch {
      return raw;
    }
  }
  return raw; // Legacy plaintext — return as-is
};


// ═══════════════════════════════════════════════════════
// 1. RelationshipMilestones — Automatic, not manual
//    "6 months since you joined"
//    "1 year since your first saved date"
//    "50 shared moments"
//    Appears as a Home card, very rarely, one sentence.
// ═══════════════════════════════════════════════════════

export const RelationshipMilestones = {
  async _getStats() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.LIFETIME_STATS);
      return raw ? JSON.parse(raw) : {
        firstOpenDate: null,
        totalPrompts: 0,
        totalDates: 0,
        totalMoments: 0,
        totalLoveNotes: 0,
        firstDateSaved: null,
        firstPromptAnswered: null,
      };
    } catch { return {}; }
  },

  async _getShown() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.MILESTONES_SHOWN);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },

  async recordStat(key, increment = 1) {
    const stats = await this._getStats();
    if (typeof stats[key] === 'number') {
      stats[key] += increment;
    }
    // Record "first" timestamps
    if (key === 'totalDates' && !stats.firstDateSaved) {
      stats.firstDateSaved = new Date().toISOString();
    }
    if (key === 'totalPrompts' && !stats.firstPromptAnswered) {
      stats.firstPromptAnswered = new Date().toISOString();
    }
    if (!stats.firstOpenDate) {
      stats.firstOpenDate = new Date().toISOString();
    }
    await AsyncStorage.setItem(KEYS.LIFETIME_STATS, JSON.stringify(stats));
  },

  async initFirstOpen() {
    const stats = await this._getStats();
    if (!stats.firstOpenDate) {
      stats.firstOpenDate = new Date().toISOString();
      await AsyncStorage.setItem(KEYS.LIFETIME_STATS, JSON.stringify(stats));
    }
  },

  /** Check for any new milestone to surface. Returns null or { id, message, icon } */
  async checkForMilestone() {
    const stats = await this._getStats();
    const shown = await this._getShown();

    if (!stats.firstOpenDate) return null;

    const daysSinceJoin = Math.floor(
      (Date.now() - new Date(stats.firstOpenDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Candidate milestones — checked in order, first unshown wins
    const candidates = [
      {
        id: 'join_30d',
        check: daysSinceJoin >= 30,
        message: '1 month since you started this space together.',
        icon: 'calendar-heart',
      },
      {
        id: 'moments_10',
        check: stats.totalMoments >= 10,
        message: '10 moments shared between you — small things that matter.',
        icon: 'thought-bubble-outline',
      },
      {
        id: 'join_90d',
        check: daysSinceJoin >= 90,
        message: '3 months of choosing closeness.',
        icon: 'leaf',
      },
      {
        id: 'moments_50',
        check: stats.totalMoments >= 50,
        message: '50 shared moments. You keep showing up for each other.',
        icon: 'heart-multiple',
      },
      {
        id: 'join_180d',
        check: daysSinceJoin >= 180,
        message: '6 months since you joined — still here, still choosing us.',
        icon: 'star-four-points-outline',
      },
      {
        id: 'prompts_25',
        check: stats.totalPrompts >= 25,
        message: '25 conversations started. That\'s a lot of honesty.',
        icon: 'chat-outline',
      },
      {
        id: 'join_365d',
        check: daysSinceJoin >= 365,
        message: 'One year since your first day here. That means something.',
        icon: 'party-popper',
      },
      {
        id: 'moments_100',
        check: stats.totalMoments >= 100,
        message: '100 moments. Most of them probably made someone smile.',
        icon: 'heart',
      },
      {
        id: 'dates_10',
        check: stats.totalDates >= 10,
        message: '10 date nights planned together. May the next 10 be even better.',
        icon: 'heart-multiple-outline',
      },
    ];

    for (const c of candidates) {
      if (c.check && !shown.includes(c.id)) {
        // Mark as shown
        shown.push(c.id);
        await AsyncStorage.setItem(KEYS.MILESTONES_SHOWN, JSON.stringify(shown));
        return { id: c.id, message: c.message, icon: c.icon };
      }
    }

    return null;
  },
};


// ═══════════════════════════════════════════════════════
// 2. GentleReEntry — No guilt, no "you missed X days"
//    If the user hasn't opened the app in a while,
//    the home screen softly says:
//    "Welcome back. Start wherever you like."
// ═══════════════════════════════════════════════════════

export const GentleReEntry = {
  async recordOpen() {
    await AsyncStorage.setItem(KEYS.LAST_APP_OPEN, String(Date.now()));
  },

  async getReEntryState() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.LAST_APP_OPEN);
      if (!raw) {
        // First ever open
        await this.recordOpen();
        return { isReturning: false, daysSince: 0, greeting: null };
      }

      const last = parseInt(raw, 10);
      const daysSince = Math.floor((Date.now() - last) / (1000 * 60 * 60 * 24));

      // Record this open
      await this.recordOpen();

      if (daysSince < 3) {
        return { isReturning: false, daysSince, greeting: null };
      }

      // They've been away — welcome them back warmly
      if (daysSince < 7) {
        return {
          isReturning: true,
          daysSince,
          greeting: 'Welcome back. Start wherever you like.',
        };
      }

      if (daysSince < 30) {
        return {
          isReturning: true,
          daysSince,
          greeting: 'It\'s good to see you again. No rush — take your time.',
        };
      }

      return {
        isReturning: true,
        daysSince,
        greeting: 'Welcome back. Everything\'s here, just as you left it.',
      };
    } catch {
      return { isReturning: false, daysSince: 0, greeting: null };
    }
  },
};


// ═══════════════════════════════════════════════════════
// 3. NicknameEngine — Private nicknames & tone personalization
//    Partners set how they're referred to in the app.
//    Copy subtly adapts: "Something for you and Alex"
// ═══════════════════════════════════════════════════════

export const NicknameEngine = {
  async getConfig() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.NICKNAME_CONFIG);
      if (!raw) return { myNickname: '', partnerNickname: '', tone: 'warm' };
      const parsed = JSON.parse(raw);
      const decrypted = await _decrypt(parsed);
      // Ensure we always return a valid config shape
      return {
        myNickname: decrypted?.myNickname ?? '',
        partnerNickname: decrypted?.partnerNickname ?? '',
        tone: decrypted?.tone ?? 'warm',
      };
    } catch {
      return { myNickname: '', partnerNickname: '', tone: 'warm' };
    }
  },

  async setConfig(config) {
    const current = await this.getConfig();
    const updated = { ...current, ...config };
    const encrypted = await _encrypt(updated);
    await AsyncStorage.setItem(KEYS.NICKNAME_CONFIG, JSON.stringify(encrypted));
    return updated;
  },

  /** Get the partner display name, with fallback chain */
  async getPartnerName(fallback = 'your partner') {
    const config = await this.getConfig();
    return config.partnerNickname?.trim() || fallback;
  },

  /** Get the user's display name */
  async getMyName(fallback = 'you') {
    const config = await this.getConfig();
    return config.myNickname?.trim() || fallback;
  },

  /** Generate personalized copy with name substitution */
  async personalize(template, fallbackPartner = 'your partner') {
    const config = await this.getConfig();
    const partner = config.partnerNickname?.trim() || fallbackPartner;
    return template
      .replace(/\{partner\}/g, partner)
      .replace(/\{me\}/g, config.myNickname?.trim() || 'you');
  },

  /** Get tone-appropriate greeting modifier */
  async getTonePhrase(type = 'prompt_intro') {
    const config = await this.getConfig();
    const partner = config.partnerNickname?.trim();

    const phrases = {
      warm: {
        prompt_intro: partner ? `Something for you and ${partner}` : 'Something just for the two of you',
        date_intro: partner ? `A night for you and ${partner}` : 'A night for just the two of you',
        home_sub: partner ? `Your space with ${partner}` : 'Your space together',
      },
      playful: {
        prompt_intro: partner ? `What do you think, ${partner}?` : 'Ready for this one?',
        date_intro: partner ? `Adventure time with ${partner}` : 'Time for something fun',
        home_sub: partner ? `You + ${partner} tonight` : 'Just you two tonight',
      },
      intimate: {
        prompt_intro: partner ? `Between you and ${partner}` : 'Between the two of you',
        date_intro: partner ? `For ${partner} and the quiet hours` : 'For the quiet hours',
        home_sub: partner ? `This is yours and ${partner}'s` : 'This space is yours',
      },
      minimal: {
        prompt_intro: 'Tonight\'s prompt',
        date_intro: 'Date ideas',
        home_sub: 'Your space',
      },
    };

    return phrases[config.tone]?.[type] || phrases.warm[type];
  },

  TONE_OPTIONS: [
    { id: 'warm', label: 'Warm', preview: 'Something for you and {partner}', icon: 'white-balance-sunny' },
    { id: 'playful', label: 'Playful', preview: 'Ready for this one?', icon: 'emoticon-wink-outline' },
    { id: 'intimate', label: 'Intimate', preview: 'Between the two of you', icon: 'candle' },
    { id: 'minimal', label: 'Minimal', preview: 'Tonight\'s prompt', icon: 'minus' },
  ],
};


// ═══════════════════════════════════════════════════════
// 4. RelationshipSeasons — Not tracking health, tracking context
//    Slightly influences prompt ordering, date suggestions, tone
// ═══════════════════════════════════════════════════════

export const SEASONS = [
  { id: 'busy', label: 'Busy Season', icon: 'clock-fast', color: '#7B9EBC', description: 'Short & sweet' },
  { id: 'cozy', label: 'Cozy Season', icon: 'sofa-outline', color: '#C9A84C', description: 'Warmth & comfort' },
  { id: 'growth', label: 'Growth Season', icon: 'sprout', color: '#4A6B4F', description: 'Going deeper' },
  { id: 'adventure', label: 'Adventure Season', icon: 'compass-outline', color: '#D4839A', description: 'Explore' },
  { id: 'rest', label: 'Rest Season', icon: 'weather-night', color: '#6B5B8A', description: 'Slow & gentle' },
];

export const RelationshipSeasons = {
  async get() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.RELATIONSHIP_SEASON);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return _decrypt(parsed);
    } catch { return null; }
  },

  async set(seasonId) {
    const data = { id: seasonId, setAt: Date.now() };
    const encrypted = await _encrypt(data);
    await AsyncStorage.setItem(KEYS.RELATIONSHIP_SEASON, JSON.stringify(encrypted));
    return data;
  },

  /** Get content preferences influenced by season (uses heat/load/style dimensions) */
  getContentInfluence(seasonId) {
    const map = {
      busy: {
        preferShort: true,
        promptTones: ['light', 'playful', 'quick'],
        preferLoad: 1,
        preferStyle: 'doing',
        maxDuration: 30,
      },
      cozy: {
        preferShort: false,
        promptTones: ['warm', 'soft', 'reflective'],
        preferLoad: 1,
        preferStyle: 'talking',
        maxDuration: null,
      },
      growth: {
        preferShort: false,
        promptTones: ['deep', 'honest', 'future'],
        preferLoad: 2,
        preferStyle: 'talking',
        maxDuration: null,
      },
      adventure: {
        preferShort: false,
        promptTones: ['playful', 'bold', 'spontaneous'],
        preferLoad: 3,
        preferStyle: 'doing',
        maxDuration: null,
      },
      rest: {
        preferShort: true,
        promptTones: ['gentle', 'soft', 'appreciative'],
        preferLoad: 1,
        preferStyle: 'mixed',
        maxDuration: 45,
      },
    };
    return map[seasonId] || map.cozy;
  },
};


// ═══════════════════════════════════════════════════════
// 5. SoftBoundaries — Consent, but elegant
//    "Hide spicy prompts for now"
//    "Pause memories from this date"
//    "Don't resurface this entry"
// ═══════════════════════════════════════════════════════

export const SoftBoundaries = {
  async _getAll() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.SOFT_BOUNDARIES);
      if (!raw) return { hideSpicy: false, pausedDates: [], pausedEntries: [], hiddenCategories: [], maxHeatOverride: null };
      const parsed = JSON.parse(raw);
      const decrypted = await _decrypt(parsed);
      return {
        hideSpicy: decrypted?.hideSpicy ?? false,
        pausedDates: decrypted?.pausedDates ?? [],
        pausedEntries: decrypted?.pausedEntries ?? [],
        hiddenCategories: decrypted?.hiddenCategories ?? [],
        maxHeatOverride: decrypted?.maxHeatOverride ?? null,
      };
    } catch {
      return { hideSpicy: false, pausedDates: [], pausedEntries: [], hiddenCategories: [], maxHeatOverride: null };
    }
  },

  async _save(data) {
    const encrypted = await _encrypt(data);
    await AsyncStorage.setItem(KEYS.SOFT_BOUNDARIES, JSON.stringify(encrypted));
  },

  async getAll() {
    return this._getAll();
  },

  async setHideSpicy(hidden) {
    const data = await this._getAll();
    data.hideSpicy = !!hidden;
    if (hidden) {
      data.maxHeatOverride = 3; // Cap at 3 when spicy is hidden
    } else {
      data.maxHeatOverride = null;
    }
    await this._save(data);
  },

  async pauseDate(dateId) {
    const data = await this._getAll();
    if (!data.pausedDates.includes(dateId)) {
      data.pausedDates.push(dateId);
    }
    await this._save(data);
  },

  async unpauseDate(dateId) {
    const data = await this._getAll();
    data.pausedDates = data.pausedDates.filter(id => id !== dateId);
    await this._save(data);
  },

  async pauseEntry(entryId) {
    const data = await this._getAll();
    if (!data.pausedEntries.includes(entryId)) {
      data.pausedEntries.push(entryId);
    }
    await this._save(data);
  },

  async unpauseEntry(entryId) {
    const data = await this._getAll();
    data.pausedEntries = data.pausedEntries.filter(id => id !== entryId);
    await this._save(data);
  },

  async hideCategory(category) {
    const data = await this._getAll();
    if (!data.hiddenCategories.includes(category)) {
      data.hiddenCategories.push(category);
    }
    await this._save(data);
  },

  async unhideCategory(category) {
    const data = await this._getAll();
    data.hiddenCategories = data.hiddenCategories.filter(c => c !== category);
    await this._save(data);
  },

  /** Check if a prompt should be shown given current boundaries */
  async shouldShowPrompt(prompt) {
    const data = await this._getAll();
    if (data.hideSpicy && prompt.heat >= 4) return false;
    if (data.maxHeatOverride && prompt.heat > data.maxHeatOverride) return false;
    if (data.hiddenCategories.includes(prompt.category)) return false;
    if (data.pausedEntries.includes(prompt.id)) return false;
    return true;
  },

  /** Check if a date should be shown */
  async shouldShowDate(dateId) {
    const data = await this._getAll();
    return !data.pausedDates.includes(dateId);
  },
};


// ═══════════════════════════════════════════════════════
// 6. OfflineGrace — App still opens, saved content readable,
//    notes queue until connection returns
// ═══════════════════════════════════════════════════════

export const OfflineGrace = {
  async _readQueue() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.OFFLINE_QUEUE);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const decrypted = await _decrypt(parsed);
      return Array.isArray(decrypted) ? decrypted : [];
    } catch { return []; }
  },

  async _writeQueue(queue) {
    const encrypted = await _encrypt(queue);
    await AsyncStorage.setItem(KEYS.OFFLINE_QUEUE, JSON.stringify(encrypted));
  },

  async addToQueue(action) {
    try {
      const queue = await this._readQueue();
      queue.push({
        id: Date.now().toString(),
        action, // { type: 'loveNote' | 'moment' | 'answer', payload: ... }
        createdAt: Date.now(),
        synced: false,
      });
      await this._writeQueue(queue);
    } catch (e) {
      console.warn('[PolishEngine] Queue write failed:', e?.message);
    }
  },

  async getQueue() {
    try {
      const queue = await this._readQueue();
      return queue.filter(item => !item.synced);
    } catch { return []; }
  },

  async markSynced(id) {
    try {
      const queue = await this._readQueue();
      const updated = queue.map(item =>
        item.id === id ? { ...item, synced: true } : item
      );
      // Clean out old synced items (keep last 24h)
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const cleaned = updated.filter(item => !item.synced || item.createdAt > cutoff);
      await this._writeQueue(cleaned);
    } catch (e) {
      console.warn('[PolishEngine] Queue cleanup failed:', e?.message);
    }
  },

  async clearSynced() {
    try {
      const queue = await this._readQueue();
      const pending = queue.filter(item => !item.synced);
      await this._writeQueue(pending);
    } catch (e) {
      console.warn('[PolishEngine] Clear synced failed:', e?.message);
    }
  },

  async getPendingCount() {
    const queue = await this.getQueue();
    return queue.length;
  },
};


// ═══════════════════════════════════════════════════════
// 7. YearReflection — End-of-year narrative (Premium)
//    Not stats. Not graphs. A short, warm, written reflection.
//    "This year, you leaned into…"
//    "Moments you saved most often…"
// ═══════════════════════════════════════════════════════

export const YearReflection = {
  async generate(year = new Date().getFullYear()) {
    try {
      const stats = await RelationshipMilestones._getStats();
      const seasonRaw = await AsyncStorage.getItem(KEYS.RELATIONSHIP_SEASON);
      const season = seasonRaw ? JSON.parse(seasonRaw) : null;

      // Build narrative from available data
      const sections = [];

      // Opening
      sections.push({
        type: 'opening',
        text: `${year} was a year you spent together. That alone means something.`,
      });

      // Moments
      if (stats.totalMoments > 0) {
        const qualifier = stats.totalMoments >= 50 ? 'so many' :
                          stats.totalMoments >= 20 ? 'quite a few' : 'some beautiful';
        sections.push({
          type: 'moments',
          text: `You shared ${qualifier} small moments — ${stats.totalMoments} times you paused to think of each other.`,
        });
      }

      // Prompts
      if (stats.totalPrompts > 0) {
        sections.push({
          type: 'prompts',
          text: `You answered ${stats.totalPrompts} prompts together. Every one was a conversation you chose to have.`,
        });
      }

      // Dates
      if (stats.totalDates > 0) {
        sections.push({
          type: 'dates',
          text: `You planned ${stats.totalDates} date ${stats.totalDates === 1 ? 'night' : 'nights'}. The kind of intentional time that matters.`,
        });
      }

      // Love Notes
      if (stats.totalLoveNotes > 0) {
        sections.push({
          type: 'loveNotes',
          text: `${stats.totalLoveNotes} love ${stats.totalLoveNotes === 1 ? 'note' : 'notes'} sent. Words you wanted to put somewhere permanent.`,
        });
      }

      // Season context
      if (season) {
        const seasonLabel = SEASONS.find(s => s.id === season.id)?.label || '';
        if (seasonLabel) {
          sections.push({
            type: 'season',
            text: `Right now, you're in a ${seasonLabel.toLowerCase()}. The app has been shaping itself around that.`,
          });
        }
      }

      // Closing
      sections.push({
        type: 'closing',
        text: 'Whatever this year held, you showed up for it — and for each other. Here\'s to the next one.',
      });

      return {
        year,
        generatedAt: Date.now(),
        sections,
      };
    } catch {
      return {
        year,
        generatedAt: Date.now(),
        sections: [
          { type: 'opening', text: `${year} was a year you spent together.` },
          { type: 'closing', text: 'Here\'s to everything that comes next.' },
        ],
      };
    }
  },

  async getCached(year = new Date().getFullYear()) {
    try {
      const raw = await AsyncStorage.getItem(`${KEYS.YEAR_REFLECTION}_${year}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  async cache(reflection) {
    await AsyncStorage.setItem(
      `${KEYS.YEAR_REFLECTION}_${reflection.year}`,
      JSON.stringify(reflection)
    );
  },
};


// ═══════════════════════════════════════════════════════
// Default export
// ═══════════════════════════════════════════════════════

export default {
  RelationshipMilestones,
  GentleReEntry,
  NicknameEngine,
  RelationshipSeasons,
  SoftBoundaries,
  OfflineGrace,
  YearReflection,
  SEASONS,
};
