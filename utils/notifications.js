// utils/notifications.js
// Optional notifications. Safe fallback if expo-notifications isn't installed.
// Enhanced with deep link routing support.

import { Platform } from "react-native";
import { settingsStorage } from "./storage";
import { REMINDER_CATEGORY_COLORS } from "../config/constants";
import DeepLinkHandler from "../services/DeepLinkHandler";

let Notifications = null;

try {
   
  Notifications = require("expo-notifications");
} catch (_e) {
  Notifications = null;
}

export const NOTIFICATION_TYPES = {
  CALENDAR_REMINDERS: "calendarReminders",
  MEMORY_RECAPS: "memoryRecaps",
  RITUAL_REMINDERS: "ritualReminders",
  WINBACK: "winback",
};

export function normalizeNotificationSettings(settings = {}) {
  const safeSettings = settings && typeof settings === "object" ? settings : {};
  return {
    notificationsEnabled: safeSettings.notificationsEnabled !== false,
    calendarReminders: safeSettings.calendarReminders !== false,
    memoryRecaps: safeSettings.memoryRecaps !== false,
    ritualReminders: safeSettings.ritualReminders !== false,
    winback: safeSettings.winback !== false,
  };
}

export async function getNotificationSettings() {
  const settings = await settingsStorage.getNotificationSettings();
  return normalizeNotificationSettings(settings);
}

export async function isNotificationTypeEnabled(type = null) {
  const settings = await getNotificationSettings();
  if (!settings.notificationsEnabled) return false;
  if (!type) return true;
  return settings[type] !== false;
}

export async function ensureDefaultNotificationChannel() {
  if (!Notifications || Platform.OS !== "android") return;
  if (!Notifications.setNotificationChannelAsync) return;

  await Notifications.setNotificationChannelAsync("default", {
    name: "Between Us",
    importance: Notifications.AndroidImportance?.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: REMINDER_CATEGORY_COLORS.intimacy,
    sound: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility?.PRIVATE,
  }).catch(() => {});
}

function dateTrigger(date) {
  if (!Notifications?.SchedulableTriggerInputTypes?.DATE) {
    return { date };
  }

  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date,
    channelId: 'default',
  };
}

export async function ensureNotificationPermissions({ type = null } = {}) {
  if (!Notifications) return { ok: false, reason: "expo-notifications not installed" };
  if (!(await isNotificationTypeEnabled(type))) {
    return { ok: false, reason: "notifications disabled" };
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.status === "granted") return { ok: true };

  const req = await Notifications.requestPermissionsAsync();
  return { ok: req.status === "granted", status: req.status };
}

export async function scheduleEventNotification({
  title,
  body,
  when,
  data,
  notificationType = NOTIFICATION_TYPES.CALENDAR_REMINDERS,
}) {
  if (!Notifications) return null;
  if (!(await isNotificationTypeEnabled(notificationType))) return null;

  const permissionState = await Notifications.getPermissionsAsync?.();
  if (permissionState?.status !== "granted") return null;

  // Cancel safety: if when is in the past, do nothing
  const ts = typeof when === "number" ? when : new Date(when).getTime();
  if (!ts || ts <= Date.now() + 2000) return null;

  await ensureDefaultNotificationChannel();

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: "default",
      color: REMINDER_CATEGORY_COLORS.date,
      data: {
        type: "calendar_event_reminder",
        ...DeepLinkHandler.buildNotificationData("calendar", data || {}),
      },
    },
    trigger: dateTrigger(new Date(ts)),
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
 * @param {string|null} [options.notificationType] - Optional app-level notification category
 */
export async function scheduleActionableNotification({
  title,
  body,
  when,
  route,
  routeParams = {},
  notificationType = null,
}) {
  if (!Notifications) return null;
  if (!(await isNotificationTypeEnabled(notificationType))) return null;

  const ts = typeof when === "number" ? when : new Date(when).getTime();
  if (!ts || ts <= Date.now() + 2000) return null;

  const permissionState = await Notifications.getPermissionsAsync?.();
  if (permissionState?.status !== "granted") return null;

  await ensureDefaultNotificationChannel();

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: "default",
      data: DeepLinkHandler.buildNotificationData(route, routeParams),
    },
    trigger: dateTrigger(new Date(ts)),
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
  } catch (_e) { /* notification cancel non-critical */ }
}
