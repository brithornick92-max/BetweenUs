/**
 * DateNightLiveActivity.js
 *
 * Two-layer approach to "Date Night Live Activities":
 *
 *   Layer 1 — JS (works today):
 *     Schedules a cascade of rich, time-gated push notifications that build
 *     anticipation throughout the day — morning tease, midday countdown,
 *     pre-date reminder, and the "it's time" moment. Uses expo-notifications
 *     with custom category actions so the partner can send a flirty reply
 *     directly from the lock screen.
 *
 *   Layer 2 — Native (see plugins/withDateNightLiveActivity.cjs):
 *     A WidgetKit LiveActivity extension that puts a living, breathing
 *     countdown widget in the Dynamic Island and on the Lock Screen.
 *     Requires the Expo config plugin to add the Swift target to Xcode.
 *     When the native side is present, this service also calls
 *     startLiveActivity() via a NativeModule bridge.
 *
 * Public API:
 *   DateNightLiveActivity.schedule(event)   → schedules the cascade
 *   DateNightLiveActivity.cancel(eventId)   → cancels all notifications for it
 *   DateNightLiveActivity.cancelAll()       → wipes all date-night notifications
 */

import * as Notifications from 'expo-notifications';
import { Platform, NativeModules } from 'react-native';

// ─── Category IDs ─────────────────────────────────────────────────────────────

const CATEGORY_DATE_NIGHT = 'DATE_NIGHT_COUNTDOWN';

// ─── Notification tag prefix (lets us cancel by event) ────────────────────────

const TAG = (eventId) => `date_night_${eventId}`;

// ─── Flirty copy — randomised at schedule time ────────────────────────────────

const MORNING_LINES = [
  "Tonight is ours. ✨",
  "Counting down to you.",
  "Don't forget — tonight we have a date.",
  "Something special is waiting for you tonight.",
  "Mark your calendar. Tonight is everything.",
];

const MIDDAY_LINES = [
  "Still thinking about tonight.",
  "A few more hours until we're together.",
  "Your person is already excited for tonight.",
  "Can you feel the anticipation building?",
  "Halfway there. Worth the wait.",
];

const HOUR_LINES = [
  "One hour. Get ready, love.",
  "The countdown is almost over.",
  "One more hour and it's just us.",
  "Almost time. I can't wait.",
];

const GO_TIME_LINES = [
  "It's time. Tonight is yours.",
  "The moment is here.",
  "Let's go. Tonight belongs to us.",
  "Your date night starts now. 🌙",
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ─── Notification category registration ───────────────────────────────────────

let _categoryRegistered = false;
async function ensureCategory() {
  if (_categoryRegistered) return;
  await Notifications.setNotificationCategoryAsync(CATEGORY_DATE_NIGHT, [
    {
      identifier: 'SEND_HEART',
      buttonTitle: '❤️  Send a heart',
      options: { isDestructive: false, isAuthenticationRequired: false },
    },
    {
      identifier: 'IM_READY',
      buttonTitle: "I'm ready 🥂",
      options: { isDestructive: false, isAuthenticationRequired: false },
    },
  ]);
  _categoryRegistered = true;
}

// ─── Core scheduler ───────────────────────────────────────────────────────────

/**
 * @param {object} event
 * @param {string}  event.id          Unique event ID (used for cancellation)
 * @param {Date}    event.dateTime     When the date starts
 * @param {string}  [event.teaserNote] Optional custom flirt line for the morning notification
 * @param {string}  [event.title]      Optional date title ("Candle-lit dinner")
 * @returns {Promise<string[]>}  Array of scheduled notification identifiers
 */
async function schedule({ id, dateTime, teaserNote, title = 'Date Night' }) {
  if (!id || !(dateTime instanceof Date) || isNaN(dateTime.getTime())) {
    throw new Error('DateNightLiveActivity.schedule: id and a valid dateTime are required.');
  }

  await ensureCategory();

  const dateMs = dateTime.getTime();
  const now = Date.now();

  if (dateMs <= now) return []; // Date is in the past — nothing to schedule

  const milestones = [
    // 9 AM on the day — or "today" tease if date is later today
    {
      offsetMs: -(dateMs - new Date(dateTime).setHours(9, 0, 0, 0)),
      title: title,
      body: teaserNote ?? pick(MORNING_LINES),
      badge: '🌙',
    },
    // 3 hours before
    {
      offsetMs: -3 * 60 * 60 * 1000,
      title: `${title} — 3 hours away`,
      body: pick(MIDDAY_LINES),
      badge: '⏳',
    },
    // 1 hour before
    {
      offsetMs: -1 * 60 * 60 * 1000,
      title: `${title} — 1 hour to go`,
      body: pick(HOUR_LINES),
      badge: '🕐',
    },
    // 10 minutes before
    {
      offsetMs: -10 * 60 * 1000,
      title: `${title} — 10 minutes`,
      body: "Almost there. Get ready.",
      badge: '✨',
    },
    // Go time
    {
      offsetMs: 0,
      title: `${title} starts now`,
      body: pick(GO_TIME_LINES),
      badge: '🌹',
    },
  ];

  const scheduled = [];

  for (const milestone of milestones) {
    const fireMs = dateMs + milestone.offsetMs;
    if (fireMs <= now) continue; // Already past

    const fireDate = new Date(fireMs);

    const notifId = await Notifications.scheduleNotificationAsync({
      identifier: `${TAG(id)}_${milestone.offsetMs}`,
      content: {
        title: milestone.badge + '  ' + milestone.title,
        body: milestone.body,
        categoryIdentifier: CATEGORY_DATE_NIGHT,
        // Rich attachment key — can be swapped for a local image URI
        data: { eventId: id, type: 'date_night_countdown', offsetMs: milestone.offsetMs },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireDate,
      },
    }).catch(() => null);

    if (notifId) scheduled.push(notifId);
  }

  // ── Layer 2: Kick off native Live Activity if the bridge is available ──────
  if (Platform.OS === 'ios' && NativeModules.DateNightLiveActivity) {
    NativeModules.DateNightLiveActivity.startActivity({
      eventId: id,
      title,
      teaserNote: teaserNote ?? pick(MORNING_LINES),
      dateTimestamp: dateMs,
    });
  }

  return scheduled;
}

/**
 * Cancel all notifications for a specific event and end its Live Activity.
 * @param {string} eventId
 */
async function cancel(eventId) {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const prefix = TAG(eventId);
  const toCancel = all
    .filter((n) => n.identifier.startsWith(prefix))
    .map((n) => n.identifier);

  await Promise.all(toCancel.map((id) => Notifications.cancelScheduledNotificationAsync(id)));

  if (Platform.OS === 'ios' && NativeModules.DateNightLiveActivity) {
    NativeModules.DateNightLiveActivity.endActivity({ eventId });
  }
}

/**
 * Cancel ALL date night notifications across all events.
 */
async function cancelAll() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = all
    .filter((n) => n.identifier.startsWith('date_night_'))
    .map((n) => n.identifier);

  await Promise.all(toCancel.map((id) => Notifications.cancelScheduledNotificationAsync(id)));

  if (Platform.OS === 'ios' && NativeModules.DateNightLiveActivity) {
    NativeModules.DateNightLiveActivity.endAllActivities();
  }
}

const DateNightLiveActivity = { schedule, cancel, cancelAll };
export default DateNightLiveActivity;
