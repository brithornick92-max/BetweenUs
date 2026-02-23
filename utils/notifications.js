// utils/notifications.js
// Optional notifications. Safe fallback if expo-notifications isn't installed.
// Enhanced with deep link routing support.

let Notifications = null;

try {
  // eslint-disable-next-line global-require
  Notifications = require("expo-notifications");
} catch (e) {
  Notifications = null;
}

export async function ensureNotificationPermissions() {
  if (!Notifications) return { ok: false, reason: "expo-notifications not installed" };

  const current = await Notifications.getPermissionsAsync();
  if (current.status === "granted") return { ok: true };

  const req = await Notifications.requestPermissionsAsync();
  return { ok: req.status === "granted", status: req.status };
}

export async function scheduleEventNotification({ title, body, when, data }) {
  if (!Notifications) return null;

  // Cancel safety: if when is in the past, do nothing
  const ts = typeof when === "number" ? when : new Date(when).getTime();
  if (!ts || ts <= Date.now() + 2000) return null;

  return Notifications.scheduleNotificationAsync({
    content: { title, body, data: data || {} },
    trigger: { date: new Date(ts) },
  });
}

/**
 * Schedule a notification with deep link routing.
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.body
 * @param {number|string} options.when - Timestamp or date string
 * @param {string} options.route - Deep link route (e.g., 'love-note', 'ritual')
 * @param {Object} [options.routeParams] - Route params (e.g., { id: 'abc' })
 */
export async function scheduleActionableNotification({ title, body, when, route, routeParams = {} }) {
  if (!Notifications) return null;

  const ts = typeof when === "number" ? when : new Date(when).getTime();
  if (!ts || ts <= Date.now() + 2000) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: {
        route,
        ...routeParams,
        url: `betweenus://${route}${routeParams.id ? '/' + routeParams.id : ''}`,
      },
    },
    trigger: { date: new Date(ts) },
  });
}

/**
 * Register a notification response listener (for handling taps on notifications).
 * @param {Function} handler - Receives the notification response
 * @returns {Object|null} subscription to remove
 */
export function addNotificationResponseListener(handler) {
  if (!Notifications) return null;
  return Notifications.addNotificationResponseReceivedListener(handler);
}

export async function cancelNotification(notificationId) {
  if (!Notifications || !notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (e) { /* notification cancel non-critical */ }
}
