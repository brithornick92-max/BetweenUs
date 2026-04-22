/**
 * MemoryResurfacingService.js — "On this day" local notification scheduler
 *
 * Scans the couple's shared memories for entries whose MM-DD calendar date
 * matches today but from a prior year. If found, schedules a local push
 * notification for 8 am tomorrow (so the user is notified on the day itself).
 *
 * Safety:
 *   • Once-per-calendar-day scheduling guard (AsyncStorage key)
 *   • Previous IDs cancelled before rescheduling
 *   • Silently skips if permissions not granted (never prompts)
 *   • No network calls — reads from local SQLite only
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

let Notifications = null;
try {
  Notifications = require('expo-notifications');
} catch {
  Notifications = null;
}

const SCHEDULED_ID_KEY = '@betweenus:onthisday:id';
const LAST_SCHEDULED_KEY = '@betweenus:onthisday:lastScheduled';

function todayYearlessKey() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

function tomorrowAt8am() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return d;
}

function yearsAgo(isoDate) {
  if (!isoDate) return null;
  const created = new Date(isoDate);
  if (Number.isNaN(created.getTime())) return null;
  const diff = new Date().getFullYear() - created.getFullYear();
  return diff > 0 ? diff : null;
}

function extractMMDD(isoDate) {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

function buildNotificationContent(memory, years) {
  const yLabel = years === 1 ? '1 year ago' : `${years} years ago`;
  const snippet = memory.content?.trim?.() || '';
  const body = snippet
    ? `${yLabel}: "${snippet.slice(0, 60)}${snippet.length > 60 ? '…' : ''}"`
    : `You two made a memory ${yLabel}. Open to relive it.`;

  return {
    title: `On this day ${yLabel} 💕`,
    body,
    data: {
      type: 'on_this_day',
      route: 'saved-moments',
      memoryId: memory.id || null,
    },
    sound: 'default',
  };
}

const MemoryResurfacingService = {
  /**
   * Call once per app open (e.g. in AppContext init or HomeScreen useFocusEffect).
   * Schedules an 8 am notification for tomorrow if a "same day" memory exists
   * from a prior year.
   *
   * @param {DataLayer} DataLayer - injected to avoid circular dep issues
   */
  async schedule(DataLayer) {
    if (!Notifications) return;

    try {
      // Once-per-day guard
      const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const lastScheduled = await AsyncStorage.getItem(LAST_SCHEDULED_KEY);
      if (lastScheduled === todayKey) return;

      // Check notification permission — never request it here
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;

      // Load all shared memories (local SQLite — no network)
      const todayMMDD = todayYearlessKey();
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
        if (extractMMDD(m.created_at) !== todayMMDD) continue;
        const y = yearsAgo(m.created_at);
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

      // Schedule for 8 am tomorrow
      const trigger = tomorrowAt8am();
      const id = await Notifications.scheduleNotificationAsync({
        content: buildNotificationContent(best, bestYears),
        trigger: {
          date: trigger,
          type: 'date',
        },
      });

      await AsyncStorage.setItem(SCHEDULED_ID_KEY, id);
      await AsyncStorage.setItem(LAST_SCHEDULED_KEY, todayKey);

      if (__DEV__) {
        console.log(
          `[MemoryResurfacing] Scheduled "on this day" notification for ${trigger.toISOString()}, memoryId=${best.id}`
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
