// services/ConnectionEngine.js — Core Logic Systems for Between Us
// Named logic systems from the product spec

import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Supabase (lazy – may be null if env vars not set) ──
let _supabase = null;
let _supabaseTables = null;
const _getSupabase = () => {
  if (_supabase === undefined) return null; // Already tried and failed
  if (_supabase) return _supabase;
  try {
    const mod = require('../config/supabase');
    _supabase = mod.supabase || null;
    _supabaseTables = mod.TABLES || {};
  } catch {
    _supabase = undefined; // Don't retry
  }
  return _supabase || null;
};

// ── Shared encrypt/decrypt helpers (device-local key via EncryptionService) ──
const _encrypt = async (data) => {
  try {
    const { default: EncryptionService } = await import('./EncryptionService');
    return { __enc: true, d: await EncryptionService.encryptJson(data) };
  } catch {
    return data;
  }
};
const _decrypt = async (raw) => {
  if (!raw || typeof raw !== 'object') return raw;
  if (raw.__enc && raw.d) {
    try {
      const { default: EncryptionService } = await import('./EncryptionService');
      const data = await EncryptionService.decryptJson(raw.d);
      return data != null ? data : raw;
    } catch {
      return raw;
    }
  }
  return raw; // Legacy plaintext
};

const KEYS = {
  MOMENT_COOLDOWN: '@bu_moment_cooldown',
  MOMENT_USER_ID: '@bu_moment_user_id',
  MOMENT_COUPLE_ID: '@bu_moment_couple_id',
  CLIMATE_STATE: '@bu_climate_state',
  ENERGY_LEVEL: '@bu_energy_level',
  SURPRISE_LAST: '@bu_surprise_last',
  INSIDE_JOKES: '@bu_inside_jokes',
  PROMPT_HISTORY: '@bu_prompt_history',
  THIS_OR_THAT_HISTORY: '@bu_this_or_that',
  RITUAL_CYCLE: '@bu_ritual_cycle',
  SOFT_INTENTIONS: '@bu_soft_intentions',
};

// ═══════════════════════════════════════════════════════
// 1. MomentSignalSender — "Thinking of you" one-tap micro-connections
// ═══════════════════════════════════════════════════════

export const MOMENT_TYPES = [
  { id: 'thinking', label: 'Thinking of you', icon: 'thought-bubble-outline' },
  { id: 'grateful', label: 'Grateful for you', icon: 'hand-heart' },
  { id: 'missing', label: 'Missing you', icon: 'heart-half-full' },
  { id: 'proud', label: 'Proud of you', icon: 'star-outline' },
  { id: 'want', label: 'Want you', icon: 'fire' },
  { id: 'love', label: 'Love you', icon: 'heart' },
];

const COOLDOWN_MS = 5 * 60 * 1000; // 5 min cooldown

export const MomentSignalSender = {
  /**
   * Configure sender with current user context.
   * Call this when auth/couple state changes.
   */
  configure({ userId, coupleId }) {
    if (userId) AsyncStorage.setItem(KEYS.MOMENT_USER_ID, userId).catch(() => {});
    if (coupleId) AsyncStorage.setItem(KEYS.MOMENT_COUPLE_ID, coupleId).catch(() => {});
  },

  /** Check if cooldown has passed (prevent spam) */
  async canSend() {
    try {
      const last = await AsyncStorage.getItem(KEYS.MOMENT_COOLDOWN);
      if (!last) return true;
      const elapsed = Date.now() - parseInt(last, 10);
      return elapsed > COOLDOWN_MS;
    } catch {
      return true;
    }
  },

  /**
   * Send a moment signal to the partner via Supabase.
   * Inserts into couple_data with data_type='moment_signal'.
   * Falls back to local-only if Supabase is unavailable.
   *
   * @param {string} momentType — one of MOMENT_TYPES[].id
   * @returns {{ sent: boolean, remote: boolean, type: string, timestamp: number, error?: string }}
   */
  async send(momentType) {
    const now = Date.now();
    const timestamp = new Date(now).toISOString();

    // Enforce cooldown
    const allowed = await this.canSend();
    if (!allowed) {
      const remaining = await this.getCooldownRemaining();
      return { sent: false, remote: false, type: momentType, timestamp: now, error: `Cooldown active (${Math.ceil(remaining / 1000)}s remaining)` };
    }

    // Save cooldown immediately (optimistic)
    await AsyncStorage.setItem(KEYS.MOMENT_COOLDOWN, String(now));

    const userId = await AsyncStorage.getItem(KEYS.MOMENT_USER_ID);
    const coupleId = await AsyncStorage.getItem(KEYS.MOMENT_COUPLE_ID);
    const sb = _getSupabase();

    // ── Remote send via Supabase ──
    if (sb && coupleId && userId) {
      try {
        const tableName = (_supabaseTables && _supabaseTables.COUPLE_DATA) || 'couple_data';
        const signalKey = `moment_signal_${userId}_${now}`;

        const { error } = await sb
          .from(tableName)
          .insert({
            couple_id: coupleId,
            key: signalKey,
            data_type: 'moment_signal',
            created_by: userId,
            is_private: false,
            value: JSON.stringify({
              moment_type: momentType,
              sender_id: userId,
              sent_at: timestamp,
            }),
            created_at: timestamp,
            updated_at: timestamp,
          });

        if (error) {
          console.warn('[MomentSignal] Supabase insert failed:', error.message);
          // Still counts as "sent" locally — the user saw the confirmation
          return { sent: true, remote: false, type: momentType, timestamp: now, error: error.message };
        }

        return { sent: true, remote: true, type: momentType, timestamp: now };
      } catch (err) {
        console.warn('[MomentSignal] Send failed:', err.message);
        return { sent: true, remote: false, type: momentType, timestamp: now, error: err.message };
      }
    }

    // ── Local-only fallback (no Supabase / not linked) ──
    return { sent: true, remote: false, type: momentType, timestamp: now };
  },

  /**
   * Fetch recent signals sent TO the current user (from partner).
   * @param {{ since?: string, limit?: number }} opts
   * @returns {Array<{ moment_type: string, sender_id: string, sent_at: string }>}
   */
  async getReceivedSignals({ since, limit = 20 } = {}) {
    const sb = _getSupabase();
    const coupleId = await AsyncStorage.getItem(KEYS.MOMENT_COUPLE_ID);
    const userId = await AsyncStorage.getItem(KEYS.MOMENT_USER_ID);
    if (!sb || !coupleId || !userId) return [];

    try {
      const tableName = (_supabaseTables && _supabaseTables.COUPLE_DATA) || 'couple_data';
      let query = sb
        .from(tableName)
        .select('value, created_at')
        .eq('couple_id', coupleId)
        .eq('data_type', 'moment_signal')
        .neq('created_by', userId) // Only partner's signals
        .order('created_at', { ascending: false })
        .limit(limit);

      if (since) {
        query = query.gt('created_at', since);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('[MomentSignal] Fetch failed:', error.message);
        return [];
      }

      return (data || []).map(row => {
        try { return JSON.parse(row.value); } catch { return null; }
      }).filter(Boolean);
    } catch (err) {
      console.warn('[MomentSignal] getReceivedSignals error:', err.message);
      return [];
    }
  },

  /**
   * Subscribe to realtime moment signals from the partner.
   * @param {(signal: { moment_type: string, sender_id: string, sent_at: string }) => void} onSignal
   * @returns {() => void} unsubscribe function
   */
  subscribeToSignals(onSignal) {
    const sb = _getSupabase();
    if (!sb) return () => {};

    let coupleId = null;
    let userId = null;

    // Read IDs and subscribe
    const setup = async () => {
      coupleId = await AsyncStorage.getItem(KEYS.MOMENT_COUPLE_ID);
      userId = await AsyncStorage.getItem(KEYS.MOMENT_USER_ID);
      if (!coupleId) return null;

      const tableName = (_supabaseTables && _supabaseTables.COUPLE_DATA) || 'couple_data';
      const channel = sb
        .channel(`moment_signals_${coupleId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: tableName,
            filter: `couple_id=eq.${coupleId}`,
          },
          (payload) => {
            const row = payload.new;
            if (row?.data_type !== 'moment_signal') return;
            if (row?.created_by === userId) return; // Skip own signals
            try {
              const signal = JSON.parse(row.value);
              onSignal(signal);
            } catch { /* ignore malformed rows */ }
          }
        )
        .subscribe();

      return channel;
    };

    let channelRef = null;
    setup().then(ch => { channelRef = ch; });

    return () => {
      if (channelRef && sb) {
        sb.removeChannel(channelRef);
      }
    };
  },

  /** Get time until next send allowed */
  async getCooldownRemaining() {
    try {
      const last = await AsyncStorage.getItem(KEYS.MOMENT_COOLDOWN);
      if (!last) return 0;
      const elapsed = Date.now() - parseInt(last, 10);
      const remaining = Math.max(0, COOLDOWN_MS - elapsed);
      return remaining;
    } catch {
      return 0;
    }
  },
};

// ═══════════════════════════════════════════════════════
// 2. RelationshipClimateState — "We're in the mood for…"
// ═══════════════════════════════════════════════════════

export const CLIMATE_OPTIONS = [
  { id: 'connected', label: 'Connecting', icon: 'link-variant', color: '#D4A843', colorDark: '#F0C45A', colorLight: '#B08820' },
  { id: 'playful', label: 'Playing', icon: 'party-popper', color: '#C75050', colorDark: '#E86565', colorLight: '#A83838' },
  { id: 'calm', label: 'Quiet time', icon: 'leaf', color: '#4A6B4F', colorDark: '#6CC975', colorLight: '#3A7842' },
  { id: 'adventurous', label: 'Adventure', icon: 'compass-outline', color: '#5E7BA3', colorDark: '#7EB4E0', colorLight: '#3D6A9E' },
  { id: 'romantic', label: 'Romance', icon: 'heart-outline', color: '#B84A6E', colorDark: '#E86090', colorLight: '#9A3058' },
  { id: 'restful', label: 'Winding down', icon: 'weather-night', color: '#6B5B8A', colorDark: '#A48CD0', colorLight: '#5A4580' },
];

export const RelationshipClimateState = {
  async get() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.CLIMATE_STATE);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const decrypted = await _decrypt(parsed);
      return decrypted;
    } catch {
      return null;
    }
  },

  async set(climateId) {
    const data = { id: climateId, updatedAt: Date.now() };
    const encrypted = await _encrypt(data);
    await AsyncStorage.setItem(KEYS.CLIMATE_STATE, JSON.stringify(encrypted));
    return data;
  },
};

// ═══════════════════════════════════════════════════════
// 3. ClimateInfluenceRouter — Nudges content based on climate
// ═══════════════════════════════════════════════════════

export const ClimateInfluenceRouter = {
  /** Get prompt categories that match the current climate */
  getPreferredCategories(climateId) {
    const map = {
      connected: ['emotional', 'romance', 'memory'],
      playful: ['playful', 'fantasy', 'physical'],
      calm: ['sensory', 'emotional', 'memory'],
      adventurous: ['location', 'fantasy', 'physical'],
      romantic: ['romance', 'sensory', 'emotional'],
      restful: ['emotional', 'memory', 'sensory'],
    };
    return map[climateId] || ['romance', 'emotional'];
  },

  /** Get date dimension preferences that match the current climate */
  getPreferredDateDimensions(climateId) {
    const map = {
      connected:  { preferLoad: 1,  preferStyle: 'talking' },
      playful:    { preferLoad: 3,  preferStyle: 'doing' },
      calm:       { preferLoad: 1,  preferStyle: 'mixed' },
      adventurous:{ preferLoad: 3,  preferStyle: 'doing' },
      romantic:   { preferLoad: 2,  preferStyle: 'talking' },
      restful:    { preferLoad: 1,  preferStyle: 'mixed' },
    };
    return map[climateId] || { preferLoad: 2, preferStyle: 'mixed' };
  },

  // Legacy alias — callers that still reference getPreferredDateMoods
  getPreferredDateMoods(climateId) {
    return this.getPreferredDateDimensions(climateId);
  },
};

// ═══════════════════════════════════════════════════════
// 4. EnergyLevelContext — Content intensity matching
// ═══════════════════════════════════════════════════════

export const ENERGY_LEVELS = [
  { id: 'low', label: 'Low', description: 'Cozy, short, gentle', icon: 'candle' },
  { id: 'medium', label: 'Medium', description: 'Balanced, warm', icon: 'white-balance-sunny' },
  { id: 'open', label: 'Open', description: 'Deeper, longer, more sensual', icon: 'creation' },
];

export const ContentIntensityMatcher = {
  async getEnergyLevel() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.ENERGY_LEVEL);
      return raw || 'medium';
    } catch {
      return 'medium';
    }
  },

  async setEnergyLevel(level) {
    await AsyncStorage.setItem(KEYS.ENERGY_LEVEL, level);
  },

  /** Filter content based on energy */
  getContentParams(energyLevel) {
    switch (energyLevel) {
      case 'low':
        return { maxHeat: 2, preferShort: true, tones: ['soft', 'cozy', 'gentle'] };
      case 'open':
        return { maxHeat: 5, preferShort: false, tones: ['sensual', 'deep', 'playful'] };
      default:
        return { maxHeat: 3, preferShort: false, tones: ['warm', 'playful', 'reflective'] };
    }
  },
};

// ═══════════════════════════════════════════════════════
// 5. LowFrequencySerendipityTrigger — "Surprise Tonight"
// ═══════════════════════════════════════════════════════

export const SerendipityTrigger = {
  /** Check if a surprise should show (max 1-2x/month, evenings only) */
  async shouldShow() {
    try {
      const hour = new Date().getHours();
      if (hour < 18 || hour > 23) return false; // Evenings only

      const raw = await AsyncStorage.getItem(KEYS.SURPRISE_LAST);
      if (!raw) return true;

      const data = JSON.parse(raw);
      const daysSince = (Date.now() - data.timestamp) / (1000 * 60 * 60 * 24);
      const monthShows = data.monthCount || 0;

      // Max 2x per month, min 10 days apart
      if (monthShows >= 2) return false;
      if (daysSince < 10) return false;

      // 30% chance on eligible evenings
      return Math.random() < 0.3;
    } catch {
      return false;
    }
  },

  /** Record that a surprise was shown */
  async recordShown() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.SURPRISE_LAST);
      const prev = raw ? JSON.parse(raw) : { monthCount: 0 };
      const now = new Date();
      const prevDate = prev.timestamp ? new Date(prev.timestamp) : null;

      // Reset count if new month
      const sameMonth = prevDate && prevDate.getMonth() === now.getMonth() && prevDate.getFullYear() === now.getFullYear();
      const monthCount = sameMonth ? (prev.monthCount || 0) + 1 : 1;

      await AsyncStorage.setItem(KEYS.SURPRISE_LAST, JSON.stringify({
        timestamp: Date.now(),
        monthCount,
      }));
    } catch (e) {
      console.warn('[ConnectionEngine] Surprise save failed:', e?.message);
    }
  },

  /** Get a random surprise type */
  getRandomType() {
    const types = ['prompt', 'date', 'memory', 'loveNote'];
    return types[Math.floor(Math.random() * types.length)];
  },

  /** Get a surprise type biased by user preferences */
  getPreferenceAwareType(profile) {
    if (!profile) return this.getRandomType();

    const weights = { prompt: 1, date: 1, memory: 1, loveNote: 1 };

    // Energy: low → memory/loveNote; open → date/prompt
    if (profile.energyLevel === 'low') {
      weights.memory += 1;
      weights.loveNote += 1;
    } else if (profile.energyLevel === 'open') {
      weights.date += 1;
      weights.prompt += 0.5;
    }

    // Season: adventure → date; rest/healing → memory; growth → prompt
    const season = profile.season;
    if (season === 'adventure' || season === 'honeymoon') {
      weights.date += 1.5;
    } else if (season === 'rest' || season === 'healing') {
      weights.memory += 1;
      weights.loveNote += 1;
    } else if (season === 'growth') {
      weights.prompt += 1;
    }

    // Weighted random selection
    const entries = Object.entries(weights);
    const total = entries.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
    let rand = Math.random() * total;
    for (const [type, weight] of entries) {
      rand -= Math.max(0, weight);
      if (rand <= 0) return type;
    }
    return 'prompt';
  },
};

// ═══════════════════════════════════════════════════════
// 6. PrivateLanguageVault — Inside Jokes & Little Things
// ═══════════════════════════════════════════════════════

export const PrivateLanguageVault = {
  async getAll() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.INSIDE_JOKES);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const decrypted = await _decrypt(parsed);
      return Array.isArray(decrypted) ? decrypted : [];
    } catch {
      return [];
    }
  },

  async _saveAll(items) {
    const encrypted = await _encrypt(items);
    await AsyncStorage.setItem(KEYS.INSIDE_JOKES, JSON.stringify(encrypted));
  },

  async add(item) {
    const all = await this.getAll();
    const newItem = {
      id: Date.now().toString(),
      title: item.title || item.text || '',
      text: item.text || item.title || '',
      story: item.story || '',
      type: item.type || 'joke', // joke, nickname, ritual, phrase, reference
      createdAt: Date.now(),
    };
    all.unshift(newItem);
    await this._saveAll(all);
    return newItem;
  },

  async remove(id) {
    const all = await this.getAll();
    const filtered = all.filter(item => item.id !== id);
    await this._saveAll(filtered);
  },

  /** Get a random item for gentle resurfacing */
  async getRandomForResurface() {
    const all = await this.getAll();
    if (!all.length) return null;
    return all[Math.floor(Math.random() * all.length)];
  },
};

// ═══════════════════════════════════════════════════════
// 7. BinaryPromptEngine — "This or That"
// ═══════════════════════════════════════════════════════

export const THIS_OR_THAT_PROMPTS = [
  { id: 'tt1', optionA: 'Stay in', optionB: 'Go out' },
  { id: 'tt2', optionA: 'Morning intimacy', optionB: 'Night intimacy', heat: 4 },
  { id: 'tt3', optionA: 'Beach', optionB: 'Mountains' },
  { id: 'tt4', optionA: 'Talk all night', optionB: 'Fall asleep together' },
  { id: 'tt5', optionA: 'Cook together', optionB: 'Order in' },
  { id: 'tt6', optionA: 'Sunrise walk', optionB: 'Sunset drive' },
  { id: 'tt7', optionA: 'Slow dance', optionB: 'Fast dance' },
  { id: 'tt8', optionA: 'Write a letter', optionB: 'Leave a voicemail' },
  { id: 'tt9', optionA: 'Road trip', optionB: 'Staycation' },
  { id: 'tt10', optionA: 'Big surprise', optionB: 'Small daily gestures' },
  { id: 'tt11', optionA: 'Candles & wine', optionB: 'Blankets & cocoa' },
  { id: 'tt12', optionA: 'Plan it all', optionB: 'Be spontaneous' },
  { id: 'tt13', optionA: 'Deep conversation', optionB: 'Comfortable silence' },
  { id: 'tt14', optionA: 'Weekend away', optionB: 'Cozy night in' },
  { id: 'tt15', optionA: 'Hold hands', optionB: 'Arms around each other' },
];

export const BinaryPromptEngine = {
  /** Get a this-or-that prompt not recently shown */
  async getNext() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.THIS_OR_THAT_HISTORY);
      const history = raw ? JSON.parse(raw) : [];
      const available = THIS_OR_THAT_PROMPTS.filter(p => !history.includes(p.id));
      const pool = available.length > 0 ? available : THIS_OR_THAT_PROMPTS;
      return pool[Math.floor(Math.random() * pool.length)];
    } catch {
      return THIS_OR_THAT_PROMPTS[0];
    }
  },

  /** Record that a prompt was shown */
  async recordShown(promptId) {
    try {
      const raw = await AsyncStorage.getItem(KEYS.THIS_OR_THAT_HISTORY);
      const history = raw ? JSON.parse(raw) : [];
      history.push(promptId);
      // Keep only last 10
      const trimmed = history.slice(-10);
      await AsyncStorage.setItem(KEYS.THIS_OR_THAT_HISTORY, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('[ConnectionEngine] ThisOrThat history save failed:', e?.message);
    }
  },

  /** Record user's choice */
  async recordChoice(promptId, choice) {
    // In real app, sync to partner via Supabase
    return { promptId, choice, timestamp: Date.now() };
  },

  /** Get a prompt filtered by max heat level (respects boundaries) */
  async getNextFiltered(maxHeat = 5) {
    try {
      const raw = await AsyncStorage.getItem(KEYS.THIS_OR_THAT_HISTORY);
      const history = raw ? JSON.parse(raw) : [];
      const eligible = THIS_OR_THAT_PROMPTS.filter(p =>
        (p.heat || 1) <= maxHeat && !history.includes(p.id)
      );
      const pool = eligible.length > 0
        ? eligible
        : THIS_OR_THAT_PROMPTS.filter(p => (p.heat || 1) <= maxHeat);
      if (pool.length === 0) return THIS_OR_THAT_PROMPTS[0];
      return pool[Math.floor(Math.random() * pool.length)];
    } catch {
      return THIS_OR_THAT_PROMPTS[0];
    }
  },
};

// ═══════════════════════════════════════════════════════
// 8. SharedIdentityBuilder — "Future Us" prompts
// ═══════════════════════════════════════════════════════

export const FUTURE_US_PROMPTS = [
  { id: 'fu1', text: "Something I'm excited to experience with you" },
  { id: 'fu2', text: "A version of us I love imagining" },
  { id: 'fu3', text: "What I hope never changes about us" },
  { id: 'fu4', text: "A place I want to take you one day" },
  { id: 'fu5', text: "Something we should try this year" },
  { id: 'fu6', text: "Where I see us in five years" },
  { id: 'fu7', text: "A tradition I want us to start" },
  { id: 'fu8', text: "The kind of home I imagine for us" },
  { id: 'fu9', text: "An adventure that's waiting for us" },
  { id: 'fu10', text: "Something I want to learn together" },
];

export const FuturePromptRotation = {
  async getNext() {
    try {
      const raw = await AsyncStorage.getItem('@bu_future_history');
      const history = raw ? JSON.parse(raw) : [];
      const available = FUTURE_US_PROMPTS.filter(p => !history.includes(p.id));
      const pool = available.length > 0 ? available : FUTURE_US_PROMPTS;
      return pool[Math.floor(Math.random() * pool.length)];
    } catch {
      return FUTURE_US_PROMPTS[0];
    }
  },

  async recordShown(id) {
    try {
      const raw = await AsyncStorage.getItem('@bu_future_history');
      const history = raw ? JSON.parse(raw) : [];
      history.push(id);
      await AsyncStorage.setItem('@bu_future_history', JSON.stringify(history.slice(-8)));
    } catch (e) {
      console.warn('[ConnectionEngine] Future history save failed:', e?.message);
    }
  },
};

// ═══════════════════════════════════════════════════════
// 9. RitualCycleManager — Connection rituals
// ═══════════════════════════════════════════════════════

export const RITUAL_TYPES = [
  { id: 'weekly_appreciation', label: 'Weekly Appreciation', cadence: 'weekly', description: 'Share something you appreciate about each other' },
  { id: 'monthly_reflection', label: 'Monthly Reflection', cadence: 'monthly', description: 'Reflect on what felt alive between you this month' },
  { id: 'seasonal_intention', label: 'Seasonal Intention', cadence: 'seasonal', description: 'Set an intention for the season together' },
  { id: 'anniversary_prompt', label: 'Anniversary Reflection', cadence: 'anniversary', description: 'A private, tasteful reflection on your journey' },
];

export const RitualCycleManager = {
  async getActiveRituals() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.RITUAL_CYCLE);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async toggleRitual(ritualId, enabled) {
    const rituals = await this.getActiveRituals();
    const index = rituals.findIndex(r => r.id === ritualId);
    if (enabled && index === -1) {
      rituals.push({ id: ritualId, enabled: true, lastTriggered: null });
    } else if (!enabled && index !== -1) {
      rituals.splice(index, 1);
    }
    await AsyncStorage.setItem(KEYS.RITUAL_CYCLE, JSON.stringify(rituals));
  },

  /** Check if any ritual is due */
  async getDueRituals() {
    const active = await this.getActiveRituals();
    const now = Date.now();
    const due = [];

    for (const ritual of active) {
      if (!ritual.enabled) continue;
      const type = RITUAL_TYPES.find(t => t.id === ritual.id);
      if (!type) continue;

      const lastTriggered = ritual.lastTriggered || 0;
      const daysSince = (now - lastTriggered) / (1000 * 60 * 60 * 24);

      let isDue = false;
      if (type.cadence === 'weekly' && daysSince >= 7) isDue = true;
      if (type.cadence === 'monthly' && daysSince >= 30) isDue = true;
      if (type.cadence === 'seasonal' && daysSince >= 90) isDue = true;

      if (isDue) due.push(type);
    }

    return due;
  },
};

// ═══════════════════════════════════════════════════════
// 10. SoftIntentionsLayer — Shared soft goals
// ═══════════════════════════════════════════════════════

export const SOFT_INTENTIONS = [
  { id: 'laughter', label: 'More laughter', icon: 'emoticon-happy-outline' },
  { id: 'touch', label: 'More touch', icon: 'hand-wave' },
  { id: 'adventure', label: 'More adventure', icon: 'compass-outline' },
  { id: 'rest', label: 'More rest together', icon: 'bed-outline' },
  { id: 'conversation', label: 'Deeper conversations', icon: 'chat-outline' },
  { id: 'play', label: 'More play', icon: 'gamepad-variant-outline' },
  { id: 'romance', label: 'More romance', icon: 'candle' },
  { id: 'presence', label: 'More presence', icon: 'eye-outline' },
];

export const SoftIntentionsManager = {
  async getActive() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.SOFT_INTENTIONS);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const decrypted = await _decrypt(parsed);
      return Array.isArray(decrypted) ? decrypted : [];
    } catch {
      return [];
    }
  },

  async toggle(intentionId) {
    const active = await this.getActive();
    const index = active.indexOf(intentionId);
    if (index === -1) {
      active.push(intentionId);
    } else {
      active.splice(index, 1);
    }
    // Max 3 active intentions
    const trimmed = active.slice(-3);
    const encrypted = await _encrypt(trimmed);
    await AsyncStorage.setItem(KEYS.SOFT_INTENTIONS, JSON.stringify(encrypted));
    return trimmed;
  },
};

export default {
  MomentSignalSender,
  RelationshipClimateState,
  ClimateInfluenceRouter,
  ContentIntensityMatcher,
  SerendipityTrigger,
  PrivateLanguageVault,
  BinaryPromptEngine,
  FuturePromptRotation,
  RitualCycleManager,
  SoftIntentionsManager,
  MOMENT_TYPES,
  CLIMATE_OPTIONS,
  ENERGY_LEVELS,
  THIS_OR_THAT_PROMPTS,
  FUTURE_US_PROMPTS,
  RITUAL_TYPES,
  SOFT_INTENTIONS,
};
