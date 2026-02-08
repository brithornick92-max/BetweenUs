// utils/achievementEngine.js
const achievementsByUser = new Map();

export function evaluateAchievements() {
  return [];
}

export async function checkAchievements(userId) {
  if (!userId) return [];
  return achievementsByUser.get(userId) || [];
}

export async function trackActivity(userId, _event, _payload = {}) {
  if (!userId) return [];
  const existing = achievementsByUser.get(userId) || [];
  achievementsByUser.set(userId, existing);
  return existing;
}

export async function getUserAchievements(userId) {
  if (!userId) return [];
  return achievementsByUser.get(userId) || [];
}

export default {
  evaluateAchievements,
  checkAchievements,
  trackActivity,
  getUserAchievements,
};
