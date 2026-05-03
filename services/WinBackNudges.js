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
 *   • scheduleStreakBreakAlert — soft rhythm invitation when connected days >= 3
 *   • scheduleWeeklyRecap — Sunday evening relationship recap notification
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ensureDefaultNotificationChannel,
  isNotificationTypeEnabled,
  NOTIFICATION_TYPES,
} from '../utils/notifications';

const NUDGE_IDS_KEY = '@betweenus:cache:winbackNudgeIds';
const STREAK_ALERT_ID_KEY = '@betweenus:cache:streakAlertId';
const WEEKLY_RECAP_KEY = '@betweenus:cache:weeklyRecapScheduledWeek';
const WEEKLY_RECAP_ID_KEY = '@betweenus:cache:weeklyRecapNotificationId';

let Notifications = null;
try {
  Notifications = require('expo-notifications');
} catch {
  Notifications = null;
}

function dateTrigger(date) {
  return {
    type: Notifications?.SchedulableTriggerInputTypes?.DATE || 'date',
    date,
    channelId: 'default',
  };
}

const NUDGES = [
  {
    delayDays: 3,
    title: 'A small moment with your person',
    body: 'A prompt is waiting whenever you want to feel close.',
    route: 'home',
  },
  {
    delayDays: 7,
    title: 'Something for the two of you',
    body: 'Leave one answer, reveal together, and keep it in your story.',
    route: 'home',
  },
  {
    delayDays: 14,
    title: 'New ideas for your next night together',
    body: 'Fresh date ideas and sex positions are waiting for you. Come see what is new.',
    route: 'date-ideas',
  },
];

const WinBackNudges = {
  /**
   * Schedule win-back nudges for a non-premium user.
   * Call this on app foreground when user is NOT premium.
   */
  async scheduleNudges() {
    if (!Notifications) return;
    if (!(await isNotificationTypeEnabled(NOTIFICATION_TYPES.WINBACK))) {
      await this.cancelNudges();
      return;
    }

    // Check if we have permission (don't request it)
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    // Cancel any previously scheduled nudges
    await this.cancelNudges();
    await ensureDefaultNotificationChannel();

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
          trigger: dateTrigger(triggerDate),
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
   * Schedule a soft rhythm invitation.
   * Fires tomorrow evening if the user does not open the app today.
   * Only schedules when connected days >= 3.
   * Call this when the user's rhythm is loaded and they are leaving the home screen.
   *
   * @param {number} currentStreak
   * @param {string} [partnerName]
   */
  async scheduleStreakBreakAlert(currentStreak, partnerName, isPremium) {
    if (!Notifications) return;
    if (currentStreak < 3) {
      await this.cancelStreakBreakAlert();
      return;
    }
    // Premium users don't need loss-aversion nudges
    if (isPremium) {
      await this.cancelStreakBreakAlert();
      return;
    }
    if (!(await isNotificationTypeEnabled(NOTIFICATION_TYPES.RITUAL_REMINDERS))) {
      await this.cancelStreakBreakAlert();
      return;
    }

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await ensureDefaultNotificationChannel();

    // Cancel any previously scheduled rhythm invitation
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

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `${currentStreak} connected days between you`,
          body: partnerName
            ? `You and ${partnerName} have a nice rhythm. Today can be another small moment, if it feels good.`
            : 'You two have a nice rhythm. Today can be another small moment, if it feels good.',
          data: { route: 'home', type: 'streak_break_warning', streak: currentStreak },
        },
        trigger: dateTrigger(tomorrow),
      });

      await AsyncStorage.setItem(STREAK_ALERT_ID_KEY, id);
    } catch {
      // Non-critical
    }
  },

  async cancelStreakBreakAlert() {
    if (!Notifications) return;

    try {
      const existingId = await AsyncStorage.getItem(STREAK_ALERT_ID_KEY);
      if (existingId) {
        await Notifications.cancelScheduledNotificationAsync(existingId).catch(() => {});
      }
      await AsyncStorage.removeItem(STREAK_ALERT_ID_KEY);
    } catch {
      // Non-critical
    }
  },

  /**
   * Schedule a weekly relationship recap notification every Sunday at 7pm.
   * Safe to call on every app open — reschedules if not already set for this week.
   *
   * @param {{ prompts: number, partnerName: string }} summary
   */
  async scheduleWeeklyRecap(summary) {
    if (!Notifications) return;
    if (!(await isNotificationTypeEnabled(NOTIFICATION_TYPES.MEMORY_RECAPS))) {
      await this.cancelWeeklyRecap();
      return;
    }

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await ensureDefaultNotificationChannel();

    const now = new Date();
    // ISO 8601 week number: week containing the first Thursday of the year
    const jan4 = new Date(now.getFullYear(), 0, 4);
    const startOfWeek1 = new Date(jan4);
    startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
    const diffDays = Math.floor((now - startOfWeek1) / (24 * 60 * 60 * 1000));
    const isoWeek = Math.floor(diffDays / 7) + 1;
    const yearWeek = `${now.getFullYear()}-W${String(isoWeek).padStart(2, '0')}`;

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

      const previousId = await AsyncStorage.getItem(WEEKLY_RECAP_ID_KEY);
      if (previousId) {
        await Notifications.cancelScheduledNotificationAsync(previousId).catch(() => {});
        await AsyncStorage.removeItem(WEEKLY_RECAP_ID_KEY);
      }

      const { prompts = 0, partnerName = 'your partner' } = summary || {};
      const partnerLine = partnerName && partnerName !== 'your partner' ? ` with ${partnerName}` : '';
      const promptLine = prompts > 0
        ? `${prompts} moment${prompts !== 1 ? 's' : ''}${partnerLine} this week`
        : `Your week${partnerLine} is ready`;

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Your week together',
          body: `${promptLine}. Open Between Us when you want to revisit it together.`,
          data: { route: 'home', type: 'weekly_recap' },
        },
        trigger: dateTrigger(next),
      });

      await AsyncStorage.setItem(WEEKLY_RECAP_ID_KEY, id);
      await AsyncStorage.setItem(WEEKLY_RECAP_KEY, yearWeek);
    } catch {
      // Non-critical
    }
  },

  async cancelWeeklyRecap() {
    if (!Notifications) return;

    try {
      const existingId = await AsyncStorage.getItem(WEEKLY_RECAP_ID_KEY);
      if (existingId) {
        await Notifications.cancelScheduledNotificationAsync(existingId).catch(() => {});
      }
      await AsyncStorage.removeItem(WEEKLY_RECAP_ID_KEY);
      await AsyncStorage.removeItem(WEEKLY_RECAP_KEY);
    } catch {
      // Non-critical
    }
  },
};

export default WinBackNudges;
