// utils/challengeSystem.js
import ConnectionMemory from './connectionMemory';

// ─── Challenge Templates ────────────────────────────────────
// Each has a `condition(counts, prefs)` that returns true when the
// challenge is relevant, and an `expiresIn` (ms) that controls display.

const ONE_DAY = 24 * 60 * 60 * 1000;
const ONE_WEEK = 7 * ONE_DAY;
const ONE_MONTH = 30 * ONE_DAY;

const CHALLENGE_TEMPLATES = [
  // ── Daily ──
  {
    id: 'daily_checkin',
    name: 'Daily Check-in',
    description: 'Take a moment to check in with each other today.',
    type: 'daily',
    difficulty: 'easy',
    expiresIn: ONE_DAY,
    condition: (c) => c.checkInToday === 0,
  },
  {
    id: 'daily_prompt',
    name: 'Answer a Prompt',
    description: 'Pick a prompt and share your answer with your partner.',
    type: 'daily',
    difficulty: 'easy',
    expiresIn: ONE_DAY,
    condition: (c) => c.promptToday === 0,
  },
  {
    id: 'daily_lovenote',
    name: 'Send a Love Note',
    description: 'Surprise your partner with a short love note today.',
    type: 'daily',
    difficulty: 'easy',
    expiresIn: ONE_DAY,
    condition: () => true,
  },
  // ── Weekly ──
  {
    id: 'weekly_journal',
    name: 'Reflect Together',
    description: 'Write a journal entry about your week together.',
    type: 'weekly',
    difficulty: 'medium',
    expiresIn: ONE_WEEK,
    condition: (c) => c.journalThisWeek < 2,
  },
  {
    id: 'weekly_memory',
    name: 'Memory Moment',
    description: 'Save a favorite memory from this week.',
    type: 'weekly',
    difficulty: 'easy',
    expiresIn: ONE_WEEK,
    condition: () => true,
  },
  {
    id: 'weekly_ritual_streak',
    name: 'Ritual Week',
    description: 'Complete your bedtime ritual every night for 7 days.',
    type: 'weekly',
    difficulty: 'hard',
    expiresIn: ONE_WEEK,
    condition: (c) => c.ritualStreak < 7,
  },
  // ── Exploration ──
  {
    id: 'try_new_heat',
    name: 'Explore New Territory',
    description: 'Try a prompt at a heat level you haven\'t explored yet.',
    type: 'exploration',
    difficulty: 'medium',
    expiresIn: ONE_WEEK,
    condition: (c) => c.distinctHeatLevels < 5,
  },
  {
    id: 'vibe_check',
    name: 'Share Your Vibe',
    description: 'Let your partner know how you\'re feeling right now.',
    type: 'daily',
    difficulty: 'easy',
    expiresIn: ONE_DAY,
    condition: (c) => c.vibeToday === 0,
  },
  // ── Monthly / Special ──
  {
    id: 'monthly_deep_dive',
    name: 'Deep Dive',
    description: 'Answer 5 prompts at heat level 4 or 5 this month.',
    type: 'monthly',
    difficulty: 'hard',
    expiresIn: ONE_MONTH,
    condition: (c) => c.deepPromptsThisMonth < 5,
  },
  {
    id: 'checkin_streak_7',
    name: '7-Day Connection Streak',
    description: 'Check in with each other every day for a week.',
    type: 'special',
    difficulty: 'hard',
    expiresIn: ONE_WEEK,
    condition: (c) => c.checkInStreak < 7,
  },
];

// ─── Helpers ────────────────────────────────────────────────

function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

function isThisWeek(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - ONE_WEEK);
  return d >= weekAgo && d <= now;
}

function isThisMonth(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

async function gatherChallengeCounts(dataLayer) {
  if (!dataLayer) return {};

  const [prompts, checkIns, journals, vibes, rituals] = await Promise.all([
    dataLayer.getPromptAnswers({ limit: 200 }).catch(() => []),
    dataLayer.getCheckIns({ limit: 200 }).catch(() => []),
    dataLayer.getJournalEntries({ limit: 200 }).catch(() => []),
    dataLayer.getVibes({ limit: 200 }).catch(() => []),
    dataLayer.getRituals({ limit: 200 }).catch(() => []),
  ]);

  const checkInDates = checkIns
    .map((ci) => ci.created_at || ci.date_key)
    .filter(Boolean)
    .sort()
    .reverse();

  let checkInStreak = 0;
  if (checkInDates.length) {
    const daySet = new Set(checkInDates.map((d) => new Date(d).toISOString().slice(0, 10)));
    const sortedDays = [...daySet].sort().reverse();
    checkInStreak = 1;
    for (let i = 1; i < sortedDays.length; i++) {
      const [py, pm, pd] = sortedDays[i - 1].split('-').map(Number);
      const [cy, cm, cd] = sortedDays[i].split('-').map(Number);
      const diffDays = (Date.UTC(py, pm - 1, pd) - Date.UTC(cy, cm - 1, cd)) / 86400000;
      if (diffDays === 1) {
        checkInStreak++;
      } else {
        break;
      }
    }
  }

  return {
    promptToday: prompts.filter((p) => isToday(p.created_at || p.date_key)).length,
    checkInToday: checkIns.filter((ci) => isToday(ci.created_at || ci.date_key)).length,
    vibeToday: vibes.filter((v) => isToday(v.created_at)).length,
    journalThisWeek: journals.filter((j) => isThisWeek(j.created_at)).length,
    deepPromptsThisMonth: prompts.filter(
      (p) => isThisMonth(p.created_at || p.date_key) && (p.heat_level || 0) >= 4
    ).length,
    checkInStreak,
    ritualStreak: Math.max(...rituals.map((r) => r.streak_day || 0), 0),
    distinctHeatLevels: new Set(prompts.map((p) => p.heat_level).filter(Boolean)).size,
  };
}

// ─── Public API ─────────────────────────────────────────────

export function getActiveChallenges() {
  return CHALLENGE_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    type: t.type,
    difficulty: t.difficulty,
    status: 'available',
    expiresAt: Date.now() + t.expiresIn,
  }));
}

/**
 * Generate personalized challenges based on actual user activity.
 * Returns { challenges: [...] } in the shape AdaptiveHomeScreen expects.
 */
export async function generateChallenges(_userId, opts = {}, dataLayer = null) {
  const count = Math.max(1, Math.min(opts.count || 3, CHALLENGE_TEMPLATES.length));

  const counts = dataLayer ? await gatherChallengeCounts(dataLayer) : {};
  const prefs = await ConnectionMemory.getPreferredDimensions(2).catch(() => ({}));

  // Filter to challenges whose conditions are met (relevant to user's current state)
  const eligible = CHALLENGE_TEMPLATES.filter((t) => {
    try {
      return t.condition(counts, prefs);
    } catch {
      return true;
    }
  });

  // Sort: daily first, then by difficulty (easy → medium → hard)
  const diffOrder = { easy: 0, medium: 1, hard: 2 };
  const typeOrder = { daily: 0, weekly: 1, exploration: 2, monthly: 3, special: 4 };
  eligible.sort((a, b) => {
    const typeDiff = (typeOrder[a.type] || 9) - (typeOrder[b.type] || 9);
    if (typeDiff !== 0) return typeDiff;
    return (diffOrder[a.difficulty] || 9) - (diffOrder[b.difficulty] || 9);
  });

  const selected = eligible.slice(0, count);

  const challenges = selected.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    type: t.type,
    difficulty: t.difficulty,
    status: 'available',
    expiresAt: Date.now() + t.expiresIn,
  }));

  return { challenges };
}

export default { getActiveChallenges, generateChallenges };
