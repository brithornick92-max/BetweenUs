/**
 * WinBackNudges.js — Schedule local re-engagement notifications for free users
 *
 * Nudges are scheduled when the user opens the app and is NOT premium.
 * They fire at staggered intervals if the user goes inactive.
 * Each app open reschedules them (cancels previous + sets new).
 *
 * Nudge rules:
 *   • Only for non-premium users
 *   • Max 3 nudges per inactivity window
 *   • Respects notification permissions (never prompts for them)
 *   • All nudges cancelled when user goes premium
 *
 * Also includes:
 *   • scheduleStreakBreakAlert — loss-aversion alert when streak >= 3
 *   • scheduleWeeklyRecap — Sunday evening relationship recap notification
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const NUDGE_IDS_KEY = '@betweenus:winback_nudge_ids';
const STREAK_ALERT_ID_KEY = '@betweenus:streakAlertId';
const WEEKLY_RECAP_KEY = '@betweenus:weeklyRecapScheduledWeek';

let Notifications = null;
try {
  Notifications = require('expo-notifications');
} catch {
  Notifications = null;
}

const NUDGES = [
  {
    delayDays: 3,
    title: 'Your partner misses you 💌',
    body: "It's been a few days — a quick prompt could make their night.",
    route: 'Home',
  },
  {
    delayDays: 7,
    title: 'Your streak is waiting ✨',
    body: "One reflection a day keeps the spark alive. Come back and answer today's prompt.",
    route: 'Home',
  },
  {
    delayDays: 14,
    title: 'Friday Date Night is here 🌹',
    body: 'We unlocked bonus date ideas just for you — browse them before they go.',
    route: 'DateNight',
  },
];

const WinBackNudges = {
  /**
   * Schedule win-back nudges for a non-premium user.
   * Call this on app foreground when user is NOT premium.
   */
  async scheduleNudges() {
    if (!Notifications) return;

    // Check if we have permission (don't request it)
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    // Cancel any previously scheduled nudges
    await this.cancelNudges();

    const ids = [];
    const now = Date.now();

    for (const nudge of NUDGES) {
      try {
        const triggerDate = new Date(now + nudge.delayDays * 24 * 60 * 60 * 1000);
        // Schedule at 8pm local time for intimacy context
        triggerDate.setHours(20, 0, 0, 0);
        // If that time already passed today, it's fine — the delay handles it
        if (triggerDate.getTime() <= now + 2000) continue;

        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: nudge.title,
            body: nudge.body,
            data: {
              route: nudge.route,
              url: `betweenus://${nudge.route.toLowerCase()}`,
              type: 'winback',
            },
          },
          trigger: { date: triggerDate },
        });

        if (id) ids.push(id);
      } catch {
        // Non-critical — skip this nudge
      }
    }

    if (ids.length > 0) {
      await AsyncStorage.setItem(NUDGE_IDS_KEY, JSON.stringify(ids));
    }
  },

  /**
   * Cancel all previously scheduled win-back nudges.
   * Call this when user becomes premium.
   */
  async cancelNudges() {
    if (!Notifications) return;

    try {
      const raw = await AsyncStorage.getItem(NUDGE_IDS_KEY);
      if (!raw) return;

      const ids = JSON.parse(raw);
      for (const id of ids) {
        await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      }
      await AsyncStorage.removeItem(NUDGE_IDS_KEY);
    } catch {
      // Non-critical
    }
  },

  /**
   * Schedule a streak-break loss-aversion alert.
   * Fires tomorrow evening if the user doesn't open the app today.
   * Only schedules when streak >= 3.
   * Call this when user's streak is loaded and they're leaving the home screen.
   *
   * @param {number} currentStreak
   * @param {string} [partnerName]
   */
  async scheduleStreakBreakAlert(currentStreak, partnerName) {
    if (!Notifications || currentStreak < 3) return;

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    // Cancel any previously scheduled streak alert
    try {
      const existingId = await AsyncStorage.getItem(STREAK_ALERT_ID_KEY);
      if (existingId) {
        await Notifications.cancelScheduledNotificationAsync(existingId).catch(() => {});
      }
    } catch {}

    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(20, 0, 0, 0); // 8pm tomorrow

      if (tomorrow.getTime() <= Date.now() + 2000) return;

      const partnerRef = partnerName ? `you and ${partnerName}` : 'your streak';
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Don't let your ${currentStreak}-day streak end tonight 🔥`,
          body: `${currentStreak} days of ${partnerRef} — keep it going with one quick prompt.`,
          data: { route: 'Home', type: 'streak_break_warning', streak: currentStreak },
        },
        trigger: { date: tomorrow },
      });

      await AsyncStorage.setItem(STREAK_ALERT_ID_KEY, id);
    } catch {
      // Non-critical
    }
  },

  /**
   * Schedule a weekly relationship recap notification every Sunday at 7pm.
   * Safe to call on every app open — reschedules if not already set for this week.
   *
   * @param {{ prompts: number, streak: number, partnerName: string }} summary
   */
  async scheduleWeeklyRecap(summary) {
    if (!Notifications) return;

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const now = new Date();
    // ISO week identifier: year + week number
    const yearWeek = `${now.getFullYear()}-W${Math.ceil((now.getDate() - now.getDay() + 10) / 7)}`;

    try {
      const lastScheduled = await AsyncStorage.getItem(WEEKLY_RECAP_KEY);
      if (lastScheduled === yearWeek) return; // Already scheduled this week
    } catch {}

    try {
      // Find next Sunday 7pm
      const next = new Date();
      const daysUntilSunday = (7 - next.getDay()) % 7 || 7;
      next.setDate(next.getDate() + daysUntilSunday);
      next.setHours(19, 0, 0, 0);

      if (next.getTime() <= Date.now() + 2000) return;

      const { prompts = 0, streak = 0, partnerName = 'your partner' } = summary || {};
      const promptLine = prompts > 0 ? `${prompts} prompt${prompts !== 1 ? 's' : ''} answered together` : 'a week of connection';
      const streakLine = streak > 0 ? ` · ${streak}-day streak` : '';

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Your week with ' + partnerName,
          body: `${promptLine}${streakLine}. Open Between Us to reflect on your week together.`,
          data: { route: 'Home', type: 'weekly_recap' },
        },
        trigger: { date: next },
      });

      await AsyncStorage.setItem(WEEKLY_RECAP_KEY, yearWeek);
    } catch {
      // Non-critical
    }
  },
};

export default WinBackNudges;
