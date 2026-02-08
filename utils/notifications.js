// utils/notifications.js
// Optional notifications. Safe fallback if expo-notifications isn't installed.

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

export async function scheduleEventNotification({ title, body, when }) {
  if (!Notifications) return null;

  // Cancel safety: if when is in the past, do nothing
  const ts = typeof when === "number" ? when : new Date(when).getTime();
  if (!ts || ts <= Date.now() + 2000) return null;

  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: new Date(ts),
  });
}

export async function cancelNotification(notificationId) {
  if (!Notifications || !notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {}
}
