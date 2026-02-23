/**
 * PromptAllocator.js — Single-source-of-truth for prompt deduplication
 *
 * Problem: The same prompt can appear on the Home card, in the Prompts
 *          browser, and in the Prompt Library at the same time.
 *
 * Solution:
 *   1. "Daily prompt" is reserved first (deterministic, date-based).
 *   2. Browse screens automatically exclude the daily prompt AND any
 *      prompt the user has already answered today.
 *   3. All answered prompt IDs (all-time) are loaded once per session
 *      and exposed so browse screens can dim / badge / hide them.
 *
 * Usage:
 *   import PromptAllocator from '../services/PromptAllocator';
 *
 *   // At app start / user login:
 *   await PromptAllocator.load(userId);
 *
 *   // When daily prompt is chosen:
 *   PromptAllocator.setDailyPromptId('h2_042');
 *
 *   // In browse screens:
 *   const clean = PromptAllocator.excludeUsed(allPrompts);   // removes daily + today's answers
 *   const withBadges = PromptAllocator.tagAnswered(allPrompts); // adds .answered flag
 */

import Database from './db/Database';

// ─── In-memory caches (reset per session / user) ────────────────

let _userId = null;
let _dailyPromptId = null;            // reserved for the home card today
let _todayAnsweredIds = new Set();     // prompt_ids answered today
let _allAnsweredIds = new Set();       // prompt_ids ever answered by this user
let _loaded = false;

const PromptAllocator = {
  // ─── Bootstrap ─────────────────────────────────────────────────

  /**
   * Load the user's answer history from SQLite.
   * Call once after login / app foreground.
   */
  async load(userId) {
    if (!userId) return;
    _userId = userId;
    _dailyPromptId = null;
    _todayAnsweredIds = new Set();
    _allAnsweredIds = new Set();

    try {
      const today = new Date().toISOString().split('T')[0];

      // All-time answered prompt IDs
      const allRows = await Database.getPromptAnswers(userId, { limit: 10000 });
      for (const row of allRows || []) {
        if (row.prompt_id) _allAnsweredIds.add(row.prompt_id);
      }

      // Today's answered prompt IDs
      const todayRows = await Database.getPromptAnswers(userId, { dateKey: today, limit: 500 });
      for (const row of todayRows || []) {
        if (row.prompt_id) _todayAnsweredIds.add(row.prompt_id);
      }

      _loaded = true;
    } catch (err) {
      console.warn('[PromptAllocator] load failed:', err.message);
      _loaded = true; // degrade gracefully — no filtering
    }
  },

  /** Whether load() has completed at least once this session. */
  get isLoaded() {
    return _loaded;
  },

  // ─── Daily prompt reservation ──────────────────────────────────

  /**
   * Mark a prompt ID as "reserved for today's daily card."
   * Call this right after selectDailyPrompt picks one.
   */
  setDailyPromptId(promptId) {
    _dailyPromptId = promptId || null;
  },

  /** The currently reserved daily prompt ID (or null). */
  get dailyPromptId() {
    return _dailyPromptId;
  },

  // ─── Record new answers (keep cache in sync) ──────────────────

  /**
   * Call after the user submits an answer so the cache stays fresh
   * without needing a full reload.
   */
  recordAnswer(promptId) {
    if (!promptId) return;
    _todayAnsweredIds.add(promptId);
    _allAnsweredIds.add(promptId);
  },

  // ─── Query helpers ─────────────────────────────────────────────

  /** Set of prompt IDs answered today (including just-recorded ones). */
  get todayAnsweredIds() {
    return _todayAnsweredIds;
  },

  /** Set of all prompt IDs ever answered by this user. */
  get allAnsweredIds() {
    return _allAnsweredIds;
  },

  /** True if this prompt has been answered (any day). */
  isAnswered(promptId) {
    return _allAnsweredIds.has(promptId);
  },

  /** True if this prompt was answered today specifically. */
  isAnsweredToday(promptId) {
    return _todayAnsweredIds.has(promptId);
  },

  // ─── Filtering for browse screens ─────────────────────────────

  /**
   * Remove the daily prompt + today's already-answered prompts
   * from a prompt array.  Use this for the browse list so
   * users never see the same prompt in two places on the same day.
   */
  excludeUsed(prompts) {
    if (!Array.isArray(prompts)) return prompts;
    return prompts.filter((p) => {
      if (!p?.id) return true;
      if (p.id === _dailyPromptId) return false;
      if (_todayAnsweredIds.has(p.id)) return false;
      return true;
    });
  },

  /**
   * Same array but with an `.answered` boolean and `.answeredToday`
   * boolean stamped on each prompt. Useful for dimming / badging
   * already-completed prompts while still showing them.
   */
  tagAnswered(prompts) {
    if (!Array.isArray(prompts)) return prompts;
    return prompts.map((p) => {
      if (!p?.id) return p;
      return {
        ...p,
        answered: _allAnsweredIds.has(p.id),
        answeredToday: _todayAnsweredIds.has(p.id),
        isDailyPrompt: p.id === _dailyPromptId,
      };
    });
  },

  // ─── Reset (logout / user switch) ─────────────────────────────

  reset() {
    _userId = null;
    _dailyPromptId = null;
    _todayAnsweredIds = new Set();
    _allAnsweredIds = new Set();
    _loaded = false;
  },
};

export default PromptAllocator;
