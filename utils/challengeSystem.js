// utils/challengeSystem.js
const DEFAULT_CHALLENGES = [
  { id: 'daily_checkin', title: 'Daily Check-in', difficulty: 'easy' },
  { id: 'weekly_prompt', title: 'Weekly Prompt', difficulty: 'medium' },
  { id: 'memory_moment', title: 'Memory Moment', difficulty: 'easy' },
  { id: 'deep_dive', title: 'Deep Dive', difficulty: 'hard' },
];

export function getActiveChallenges() {
  return DEFAULT_CHALLENGES;
}

export async function generateChallenges(_userId, opts = {}) {
  const count = Math.max(1, Math.min(opts.count || 3, DEFAULT_CHALLENGES.length));
  const difficulty = opts.difficulty;
  const pool = difficulty
    ? DEFAULT_CHALLENGES.filter((c) => c.difficulty === difficulty)
    : DEFAULT_CHALLENGES;
  const list = (pool.length ? pool : DEFAULT_CHALLENGES).slice(0, count);
  return list;
}

export default { getActiveChallenges, generateChallenges };
