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
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const NUDGE_IDS_KEY = '@betweenus:winback_nudge_ids';

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
};

export default WinBackNudges;
