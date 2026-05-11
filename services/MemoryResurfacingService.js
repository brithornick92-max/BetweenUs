/**
 * MemoryResurfacingService.js — "On this day" local notification scheduler
 *
 * Scans the couple's shared memories for entries whose MM-DD calendar date
 * matches today but from a prior year. If found, schedules a local push
 * notification on that same local calendar day.
 *
 * Safety:
 *   • Once-per-calendar-day scheduling guard (cache-only AsyncStorage key)
 *   • Previous IDs cancelled before rescheduling
 *   • Silently skips if permissions not granted (never prompts)
 *   • Reads through the Supabase-backed DataLayer
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ensureDefaultNotificationChannel,
  isNotificationTypeEnabled,
  NOTIFICATION_TYPES,
} from '../utils/notifications';
import { dateOnlyToLocalDate, formatLocalDateKey } from '../utils/dateOnly';
import DeepLinkHandler from './DeepLinkHandler';

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

const SCHEDULED_ID_KEY = '@betweenus:cache:onThisDayNotificationId';
const LAST_SCHEDULED_KEY = '@betweenus:cache:onThisDayLastScheduled';

function coerceMemoryCalendarDate(dateValue) {
  if (!dateValue) return null;

  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim())) {
    return dateOnlyToLocalDate(dateValue);
  }

  const parsed = dateValue instanceof Date ? dateValue : new Date(dateValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function yearlessKey(dateValue) {
  const d = coerceMemoryCalendarDate(dateValue);
  if (!d) return null;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

function todayYearlessKey(now = new Date()) {
  return yearlessKey(now);
}

function nextSameDayNotificationTime(now = new Date()) {
  const d = new Date(now);
  d.setHours(8, 0, 0, 0);

  if (d.getTime() <= now.getTime() + 2000) {
    d.setTime(now.getTime() + 5 * 60 * 1000);
  }

  return d;
}

function yearsAgo(isoDate) {
  if (!isoDate) return null;
  const created = coerceMemoryCalendarDate(isoDate);
  if (!created) return null;
  const diff = new Date().getFullYear() - created.getFullYear();
  return diff > 0 ? diff : null;
}

function extractMMDD(isoDate) {
  return yearlessKey(isoDate);
}

function buildNotificationContent(years) {
  const yLabel = years === 1 ? '1 year ago' : `${years} years ago`;

  return {
    title: `On this day ${yLabel}`,
    body: `You two made a memory ${yLabel}. Open Between Us when you want to revisit it.`,
    data: {
      type: 'on_this_day',
      ...DeepLinkHandler.buildNotificationData('saved-moments'),
    },
    sound: 'default',
  };
}

const MemoryResurfacingService = {
  /**
   * Call once per app open (e.g. in AppContext init or HomeScreen useFocusEffect).
   * Schedules an 8 am notification, or a same-day catch-up notification if
   * 8 am already passed, when a matching memory exists from a prior year.
   *
   * @param {DataLayer} DataLayer - injected to avoid circular dep issues
   */
  async schedule(DataLayer) {
    if (!Notifications) return;

    try {
      if (!(await isNotificationTypeEnabled(NOTIFICATION_TYPES.MEMORY_RECAPS))) {
        await this.cancel();
        return;
      }

      // Once-per-day guard
      const now = new Date();
      const todayKey = formatLocalDateKey(now); // YYYY-MM-DD
      const lastScheduled = await AsyncStorage.getItem(LAST_SCHEDULED_KEY);
      if (lastScheduled === todayKey) return;

      // Check notification permission — never request it here
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;
      await ensureDefaultNotificationChannel();

      // Load shared memories through DataLayer
      const todayMMDD = todayYearlessKey(now);
      let memories = [];
      try {
        memories = await DataLayer.getSharedMemories({ limit: 500 });
      } catch {
        memories = await DataLayer.getMemories({ limit: 500 });
      }

      // Find best candidate: same MM-DD, from a prior year
      let best = null;
      let bestYears = 0;
      for (const m of memories) {
        const memoryDate = m.occurred_at || m.date || m.created_at;
        if (extractMMDD(memoryDate) !== todayMMDD) continue;
        const y = yearsAgo(memoryDate);
        if (!y) continue;
        if (y > bestYears) {
          bestYears = y;
          best = m;
        }
      }

      // Cancel any previously scheduled notification
      const prevId = await AsyncStorage.getItem(SCHEDULED_ID_KEY);
      if (prevId) {
        await Notifications.cancelScheduledNotificationAsync(prevId).catch(() => {});
        await AsyncStorage.removeItem(SCHEDULED_ID_KEY);
      }

      if (!best) {
        // No matching memory — just mark today so we don't retry until tomorrow
        await AsyncStorage.setItem(LAST_SCHEDULED_KEY, todayKey);
        return;
      }

      // Schedule on the matching local calendar day.
      const trigger = nextSameDayNotificationTime(now);
      const id = await Notifications.scheduleNotificationAsync({
        content: buildNotificationContent(bestYears),
        trigger: dateTrigger(trigger),
      });

      await AsyncStorage.setItem(SCHEDULED_ID_KEY, id);
      await AsyncStorage.setItem(LAST_SCHEDULED_KEY, todayKey);

      if (__DEV__) {
        console.log(
          `[MemoryResurfacing] Scheduled "on this day" notification for ${trigger.toISOString()}`
        );
      }
    } catch (err) {
      // Never crash on notification scheduling
      if (__DEV__) console.warn('[MemoryResurfacing] schedule failed:', err?.message);
    }
  },

  /**
   * Cancel any pending "on this day" notification and clear stored IDs.
   * Call on sign-out / account reset.
   */
  async cancel() {
    if (!Notifications) return;
    try {
      const id = await AsyncStorage.getItem(SCHEDULED_ID_KEY);
      if (id) {
        await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
        await AsyncStorage.removeItem(SCHEDULED_ID_KEY);
      }
      await AsyncStorage.removeItem(LAST_SCHEDULED_KEY);
    } catch (err) {
      if (__DEV__) console.warn('[MemoryResurfacing] cancel failed:', err?.message);
    }
  },
};

export default MemoryResurfacingService;
