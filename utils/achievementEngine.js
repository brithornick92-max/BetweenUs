// utils/achievementEngine.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACHIEVEMENTS_KEY = '@betweenus:achievements';

// ─── Achievement Definitions ────────────────────────────────
// Each definition has: id, name, description, icon, category,
// and a `check(counts)` function that returns { unlocked, progress }

const ACHIEVEMENT_DEFS = [
  // ── Journal Milestones ──
  {
    id: 'first_journal',
    name: 'First Words',
    description: 'Wrote your first journal entry',
    icon: '📝',
    category: 'journal',
    check: (c) => ({ unlocked: c.journals >= 1, progress: Math.min(c.journals, 1) }),
  },
  {
    id: 'journal_10',
    name: 'Reflective Soul',
    description: 'Wrote 10 journal entries',
    icon: '📖',
    category: 'journal',
    check: (c) => ({ unlocked: c.journals >= 10, progress: Math.min(c.journals / 10, 1) }),
  },
  {
    id: 'journal_50',
    name: 'Dear Diary',
    description: 'Wrote 50 journal entries',
    icon: '🏛️',
    category: 'journal',
    check: (c) => ({ unlocked: c.journals >= 50, progress: Math.min(c.journals / 50, 1) }),
  },
  // ── Prompt Milestones ──
  {
    id: 'first_prompt',
    name: 'Conversation Starter',
    description: 'Answered your first prompt',
    icon: '💬',
    category: 'prompt',
    check: (c) => ({ unlocked: c.prompts >= 1, progress: Math.min(c.prompts, 1) }),
  },
  {
    id: 'prompt_25',
    name: 'Deep Listener',
    description: 'Answered 25 prompts together',
    icon: '🎧',
    category: 'prompt',
    check: (c) => ({ unlocked: c.prompts >= 25, progress: Math.min(c.prompts / 25, 1) }),
  },
  {
    id: 'prompt_100',
    name: 'Open Book',
    description: 'Answered 100 prompts together',
    icon: '📚',
    category: 'prompt',
    check: (c) => ({ unlocked: c.prompts >= 100, progress: Math.min(c.prompts / 100, 1) }),
  },
  // ── Check-in Milestones ──
  {
    id: 'first_checkin',
    name: 'Temperature Check',
    description: 'Completed your first check-in',
    icon: '🌡️',
    category: 'checkin',
    check: (c) => ({ unlocked: c.checkIns >= 1, progress: Math.min(c.checkIns, 1) }),
  },
  {
    id: 'checkin_7_streak',
    name: 'Week of Connection',
    description: 'Checked in 7 days in a row',
    icon: '🔥',
    category: 'checkin',
    check: (c) => ({ unlocked: c.checkInStreak >= 7, progress: Math.min(c.checkInStreak / 7, 1) }),
  },
  {
    id: 'checkin_30_streak',
    name: 'Steady Pulse',
    description: 'Checked in 30 days in a row',
    icon: '💗',
    category: 'checkin',
    check: (c) => ({ unlocked: c.checkInStreak >= 30, progress: Math.min(c.checkInStreak / 30, 1) }),
  },
  // ── Love Note Milestones ──
  {
    id: 'first_lovenote',
    name: 'Love Letter',
    description: 'Sent your first love note',
    icon: '💌',
    category: 'lovenote',
    check: (c) => ({ unlocked: c.loveNotes >= 1, progress: Math.min(c.loveNotes, 1) }),
  },
  {
    id: 'lovenote_10',
    name: 'Poet at Heart',
    description: 'Sent 10 love notes',
    icon: '🌹',
    category: 'lovenote',
    check: (c) => ({ unlocked: c.loveNotes >= 10, progress: Math.min(c.loveNotes / 10, 1) }),
  },
  // ── Memory Milestones ──
  {
    id: 'first_memory',
    name: 'Memory Keeper',
    description: 'Saved your first memory',
    icon: '📸',
    category: 'memory',
    check: (c) => ({ unlocked: c.memories >= 1, progress: Math.min(c.memories, 1) }),
  },
  {
    id: 'memory_25',
    name: 'Treasure Chest',
    description: 'Saved 25 memories together',
    icon: '🗝️',
    category: 'memory',
    check: (c) => ({ unlocked: c.memories >= 25, progress: Math.min(c.memories / 25, 1) }),
  },
  // ── Ritual Milestones ──
  {
    id: 'first_ritual',
    name: 'First Ritual',
    description: 'Completed your first bedtime ritual',
    icon: '🌙',
    category: 'ritual',
    check: (c) => ({ unlocked: c.rituals >= 1, progress: Math.min(c.rituals, 1) }),
  },
  {
    id: 'ritual_7_streak',
    name: 'Nightly Devotion',
    description: '7-night ritual streak',
    icon: '🕯️',
    category: 'ritual',
    check: (c) => ({ unlocked: c.ritualMaxStreak >= 7, progress: Math.min(c.ritualMaxStreak / 7, 1) }),
  },
  // ── Vibe Milestones ──
  {
    id: 'first_vibe',
    name: 'Vibe Check',
    description: 'Shared your first vibe',
    icon: '✨',
    category: 'vibe',
    check: (c) => ({ unlocked: c.vibes >= 1, progress: Math.min(c.vibes, 1) }),
  },
  // ── Heat Exploration ──
  {
    id: 'heat_explorer',
    name: 'Comfort Zone Explorer',
    description: 'Answered prompts at 3+ different heat levels',
    icon: '🔥',
    category: 'exploration',
    check: (c) => ({ unlocked: c.distinctHeatLevels >= 3, progress: Math.min(c.distinctHeatLevels / 3, 1) }),
  },
];

// ─── Helpers ────────────────────────────────────────────────

async function loadUnlockedSet() {
  try {
    const raw = await AsyncStorage.getItem(ACHIEVEMENTS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

async function saveUnlockedSet(unlockedSet) {
  try {
    await AsyncStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify([...unlockedSet]));
  } catch {
    // Non-critical — achievement state is recalculated from real data
  }
}

function computeCheckInStreak(checkIns) {
  if (!checkIns.length) return 0;
  const daySet = new Set(
    checkIns.map((ci) => {
      const d = new Date(ci.created_at || ci.date_key);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })
  );
  const sortedDays = [...daySet].sort().reverse();
  let streak = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1]);
    const curr = new Date(sortedDays[i]);
    const diffMs = prev.getTime() - curr.getTime();
    if (diffMs <= 86400000 * 1.5) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function computeRitualMaxStreak(rituals) {
  if (!rituals.length) return 0;
  return Math.max(...rituals.map((r) => r.streak_day || 0), 0);
}

function computeDistinctHeatLevels(promptAnswers) {
  const levels = new Set(promptAnswers.map((pa) => pa.heat_level).filter(Boolean));
  return levels.size;
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Evaluate all achievements against real user data.
 * Returns { id, name, description, icon, unlocked, isNew, progress } for each.
 */
export async function evaluateAchievements(dataLayer) {
  if (!dataLayer) return [];
  const previouslyUnlocked = await loadUnlockedSet();
  const counts = await gatherCounts(dataLayer);
  const newlyUnlockedIds = [];

  const results = ACHIEVEMENT_DEFS.map((def) => {
    const { unlocked, progress } = def.check(counts);
    const isNew = unlocked && !previouslyUnlocked.has(def.id);
    if (isNew) newlyUnlockedIds.push(def.id);
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      icon: def.icon,
      category: def.category,
      unlocked,
      isNew,
      progress,
    };
  });

  // Persist newly unlocked
  if (newlyUnlockedIds.length) {
    for (const id of newlyUnlockedIds) previouslyUnlocked.add(id);
    await saveUnlockedSet(previouslyUnlocked);
  }

  return results;
}

async function gatherCounts(dataLayer) {
  const [journals, prompts, checkIns, memories, rituals, vibes, loveNotes] = await Promise.all([
    dataLayer.getJournalEntries({ limit: 9999 }).catch(() => []),
    dataLayer.getPromptAnswers({ limit: 9999 }).catch(() => []),
    dataLayer.getCheckIns({ limit: 9999 }).catch(() => []),
    dataLayer.getMemories({ limit: 9999 }).catch(() => []),
    dataLayer.getRituals({ limit: 9999 }).catch(() => []),
    dataLayer.getVibes({ limit: 9999 }).catch(() => []),
    dataLayer.getLoveNotes({ limit: 9999 }).catch(() => []),
  ]);

  return {
    journals: journals.length,
    prompts: prompts.length,
    checkIns: checkIns.length,
    checkInStreak: computeCheckInStreak(checkIns),
    memories: memories.length,
    rituals: rituals.length,
    ritualMaxStreak: computeRitualMaxStreak(rituals),
    vibes: vibes.length,
    loveNotes: loveNotes.length,
    distinctHeatLevels: computeDistinctHeatLevels(prompts),
  };
}

/**
 * Check achievements and return the shape AdaptiveHomeScreen expects:
 * { newlyUnlocked: [...], stats: { completionPercentage, unlockedCount, totalAchievements } }
 */
export async function checkAchievements(userId, dataLayer) {
  if (!userId || !dataLayer) {
    return {
      newlyUnlocked: [],
      stats: { completionPercentage: 0, unlockedCount: 0, totalAchievements: ACHIEVEMENT_DEFS.length },
    };
  }

  const all = await evaluateAchievements(dataLayer);
  const unlocked = all.filter((a) => a.unlocked);
  const newlyUnlocked = all.filter((a) => a.isNew);

  return {
    newlyUnlocked,
    all,
    stats: {
      completionPercentage: ACHIEVEMENT_DEFS.length > 0
        ? Math.round((unlocked.length / ACHIEVEMENT_DEFS.length) * 100)
        : 0,
      unlockedCount: unlocked.length,
      totalAchievements: ACHIEVEMENT_DEFS.length,
    },
  };
}

/**
 * Track an activity event and re-evaluate achievements.
 * Call after saving data to DataLayer (e.g., after saveJournalEntry, saveCheckIn, etc.)
 */
export async function trackActivity(userId, event, dataLayer) {
  if (!userId || !dataLayer) return { newlyUnlocked: [] };
  return checkAchievements(userId, dataLayer);
}

/**
 * Get all achievements with current progress (no re-evaluation of "isNew").
 */
export async function getUserAchievements(userId, dataLayer) {
  if (!userId || !dataLayer) return [];
  return evaluateAchievements(dataLayer);
}

export default {
  evaluateAchievements,
  checkAchievements,
  trackActivity,
  getUserAchievements,
};
