import AsyncStorage from '@react-native-async-storage/async-storage';
import { REMINDER_CATEGORY_COLORS } from '../config/constants';
import { settingsStorage } from '../utils/storage';
import {
  ensureDefaultNotificationChannel,
  isNotificationTypeEnabled,
  normalizeNotificationSettings,
  NOTIFICATION_TYPES,
} from '../utils/notifications';

let Notifications = null;
try {
  Notifications = require('expo-notifications');
} catch {
  Notifications = null;
}

const SCHEDULED_IDS_KEY = '@betweenus:cache:connectionReminderIds';
const DEFAULT_REMINDER_TIME = '20:30';

export const CONNECTION_REMINDER_TYPES = {
  PROMPT: 'prompt',
  DAILY_QUIZ: 'dailyQuiz',
  DATE_IDEA: 'dateIdea',
  INTIMACY: 'intimacy',
  JOURNAL: 'journal',
  MEMORY: 'memory',
};

export const CONNECTION_REMINDER_FREQUENCIES = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'biweekly', label: 'Every 2 weeks' },
  { id: 'monthly', label: 'Monthly' },
];

export const CONNECTION_REMINDER_TIME_PRESETS = [
  { id: '08:30', label: '8:30 AM' },
  { id: '10:00', label: '10:00 AM' },
  { id: '12:30', label: '12:30 PM' },
  { id: '19:30', label: '7:30 PM' },
  { id: '20:30', label: '8:30 PM' },
  { id: '21:30', label: '9:30 PM' },
];

export const CONNECTION_REMINDER_DAY_OPTIONS = [
  { id: 0, label: 'Sun' },
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
];

export const CONNECTION_REMINDER_MONTH_DAY_OPTIONS = [
  { id: 1, label: '1st' },
  { id: 15, label: '15th' },
  { id: 28, label: '28th' },
];

export const CONNECTION_REMINDER_TEMPLATES = {
  [CONNECTION_REMINDER_TYPES.PROMPT]: {
    label: 'Prompt',
    icon: 'chatbubble-ellipses-outline',
    accentColor: REMINDER_CATEGORY_COLORS.prompt,
    notificationType: NOTIFICATION_TYPES.RITUAL_REMINDERS,
    route: 'home',
    title: 'One small question',
    body: 'A new moment for the two of you is ready.',
    defaultFrequency: 'daily',
    defaultDayOfWeek: 0,
    defaultTime: '20:30',
  },
  [CONNECTION_REMINDER_TYPES.DAILY_QUIZ]: {
    label: 'Quiz',
    icon: 'help-circle-outline',
    accentColor: REMINDER_CATEGORY_COLORS.quiz,
    notificationType: NOTIFICATION_TYPES.RITUAL_REMINDERS,
    route: 'quiz',
    title: 'Quick guess, soft reveal',
    body: "Answer privately, then compare when you're both ready.",
    defaultFrequency: 'daily',
    defaultDayOfWeek: 0,
    defaultTime: '19:30',
  },
  [CONNECTION_REMINDER_TYPES.DATE_IDEA]: {
    label: 'Date Idea',
    icon: 'wine-outline',
    accentColor: REMINDER_CATEGORY_COLORS.date,
    notificationType: NOTIFICATION_TYPES.CALENDAR_REMINDERS,
    route: 'date-ideas',
    title: 'A date idea with your names on it',
    body: 'Something cozy, playful, or a little new is waiting.',
    defaultFrequency: 'weekly',
    defaultDayOfWeek: 5,
    defaultTime: '12:30',
  },
  [CONNECTION_REMINDER_TYPES.INTIMACY]: {
    label: 'Intimacy',
    icon: 'sparkles-outline',
    accentColor: REMINDER_CATEGORY_COLORS.intimacy,
    notificationType: NOTIFICATION_TYPES.RITUAL_REMINDERS,
    route: 'intimacy',
    title: 'A private spark',
    body: 'An idea for closeness is waiting when the timing feels right.',
    defaultFrequency: 'weekly',
    defaultDayOfWeek: 5,
    defaultTime: '21:30',
  },
  [CONNECTION_REMINDER_TYPES.JOURNAL]: {
    label: 'Journal',
    icon: 'journal-outline',
    accentColor: REMINDER_CATEGORY_COLORS.journal,
    notificationType: NOTIFICATION_TYPES.RITUAL_REMINDERS,
    route: 'journal',
    title: 'Leave a few words',
    body: 'A small note today can become part of your story.',
    defaultFrequency: 'weekly',
    defaultDayOfWeek: 0,
    defaultTime: '19:30',
  },
  [CONNECTION_REMINDER_TYPES.MEMORY]: {
    label: 'Memory',
    icon: 'images-outline',
    accentColor: REMINDER_CATEGORY_COLORS.memory,
    notificationType: NOTIFICATION_TYPES.MEMORY_RECAPS,
    route: 'our-story',
    title: 'Save this one',
    body: 'Add a photo, note, or tiny moment before it fades.',
    defaultFrequency: 'monthly',
    defaultDayOfWeek: 0,
    defaultTime: '10:00',
  },
};

const REMINDER_ORDER = [
  CONNECTION_REMINDER_TYPES.PROMPT,
  CONNECTION_REMINDER_TYPES.DAILY_QUIZ,
  CONNECTION_REMINDER_TYPES.DATE_IDEA,
  CONNECTION_REMINDER_TYPES.INTIMACY,
  CONNECTION_REMINDER_TYPES.JOURNAL,
  CONNECTION_REMINDER_TYPES.MEMORY,
];

const isSupportedTime = (value) => CONNECTION_REMINDER_TIME_PRESETS.some((item) => item.id === value);
const isSupportedMonthDay = (value) => CONNECTION_REMINDER_MONTH_DAY_OPTIONS.some((item) => item.id === value);

function parseTimeParts(timeValue) {
  const [rawHour, rawMinute] = String(timeValue || DEFAULT_REMINDER_TIME).split(':');
  const hour = Number(rawHour);
  const minute = Number(rawMinute);

  return {
    hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 20,
    minute: Number.isInteger(minute) && minute >= 0 && minute <= 59 ? minute : 30,
  };
}

function cloneAtTime(date, timeValue) {
  const { hour, minute } = parseTimeParts(timeValue);
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function nextDailyOccurrences({ time, now = new Date(), count = 14 }) {
  const occurrences = [];
  let cursor = cloneAtTime(now, time);
  if (cursor.getTime() <= now.getTime() + 2000) {
    cursor.setDate(cursor.getDate() + 1);
  }

  while (occurrences.length < count) {
    occurrences.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return occurrences;
}

function nextWeeklyOccurrences({ time, dayOfWeek = 0, intervalWeeks = 1, now = new Date(), count = 4 }) {
  const occurrences = [];
  const targetDay = Number.isInteger(dayOfWeek) && dayOfWeek >= 0 && dayOfWeek <= 6 ? dayOfWeek : 0;
  let cursor = cloneAtTime(now, time);
  const daysUntilTarget = (targetDay - cursor.getDay() + 7) % 7;
  cursor.setDate(cursor.getDate() + daysUntilTarget);
  if (cursor.getTime() <= now.getTime() + 2000) {
    cursor.setDate(cursor.getDate() + intervalWeeks * 7);
  }

  while (occurrences.length < count) {
    occurrences.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + intervalWeeks * 7);
  }

  return occurrences;
}

function nextMonthlyOccurrences({ time, dayOfMonth = 1, now = new Date(), count = 4 }) {
  const occurrences = [];
  const safeDay = Math.max(1, Math.min(28, Number(dayOfMonth) || 1));
  let monthOffset = 0;

  while (occurrences.length < count && monthOffset < 18) {
    const candidate = cloneAtTime(
      new Date(now.getFullYear(), now.getMonth() + monthOffset, safeDay),
      time
    );

    if (candidate.getTime() > now.getTime() + 2000) {
      occurrences.push(candidate);
    }
    monthOffset += 1;
  }

  return occurrences;
}

export function normalizeConnectionReminderSettings(rawSettings = {}) {
  const rawReminders = rawSettings && typeof rawSettings === 'object' ? rawSettings : {};
  const normalized = {};

  for (const type of REMINDER_ORDER) {
    const template = CONNECTION_REMINDER_TEMPLATES[type];
    const raw = rawReminders[type] && typeof rawReminders[type] === 'object' ? rawReminders[type] : {};
    const frequency = CONNECTION_REMINDER_FREQUENCIES.some((item) => item.id === raw.frequency)
      ? raw.frequency
      : template.defaultFrequency;

    normalized[type] = {
      enabled: raw.enabled === true,
      frequency,
      dayOfWeek: Number.isInteger(raw.dayOfWeek) && raw.dayOfWeek >= 0 && raw.dayOfWeek <= 6
        ? raw.dayOfWeek
        : template.defaultDayOfWeek,
      dayOfMonth: Number.isInteger(raw.dayOfMonth) && isSupportedMonthDay(raw.dayOfMonth)
        ? raw.dayOfMonth
        : 1,
      time: isSupportedTime(raw.time)
        ? raw.time
        : template.defaultTime,
    };
  }

  return normalized;
}

export async function getConnectionReminderSettings() {
  const settings = await settingsStorage.getNotificationSettings();
  return normalizeConnectionReminderSettings(settings?.connectionReminders);
}

export async function saveConnectionReminderSettings(connectionReminders) {
  const current = await settingsStorage.getNotificationSettings();
  const nextSettings = {
    ...current,
    connectionReminders: normalizeConnectionReminderSettings(connectionReminders),
  };
  await settingsStorage.setNotificationSettings(nextSettings);
  return nextSettings.connectionReminders;
}

export function getReminderOccurrences(reminder, now = new Date()) {
  const safeReminder = reminder && typeof reminder === 'object' ? reminder : {};
  const time = safeReminder.time || DEFAULT_REMINDER_TIME;

  if (safeReminder.frequency === 'daily') {
    return nextDailyOccurrences({ time, now });
  }

  if (safeReminder.frequency === 'biweekly') {
    return nextWeeklyOccurrences({
      time,
      dayOfWeek: safeReminder.dayOfWeek,
      intervalWeeks: 2,
      now,
    });
  }

  if (safeReminder.frequency === 'monthly') {
    return nextMonthlyOccurrences({
      time,
      dayOfMonth: safeReminder.dayOfMonth,
      now,
    });
  }

  return nextWeeklyOccurrences({
    time,
    dayOfWeek: safeReminder.dayOfWeek,
    intervalWeeks: 1,
    now,
  });
}

function dateTrigger(date) {
  return {
    type: Notifications?.SchedulableTriggerInputTypes?.DATE || 'date',
    date,
    channelId: 'default',
  };
}

async function getScheduledIds() {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULED_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function cancelConnectionReminders() {
  if (!Notifications) return;

  try {
    const ids = await getScheduledIds();
    for (const id of ids) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    }
    await AsyncStorage.removeItem(SCHEDULED_IDS_KEY);
  } catch {
    // Non-critical
  }
}

export async function scheduleConnectionReminders() {
  if (!Notifications) return [];

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    await cancelConnectionReminders();
    return [];
  }

  const rawNotificationSettings = await settingsStorage.getNotificationSettings();
  const notificationSettings = normalizeNotificationSettings(rawNotificationSettings);
  const reminders = normalizeConnectionReminderSettings(rawNotificationSettings?.connectionReminders);

  await cancelConnectionReminders();

  if (!notificationSettings.notificationsEnabled) {
    return [];
  }

  await ensureDefaultNotificationChannel();

  const scheduledIds = [];

  for (const type of REMINDER_ORDER) {
    const reminder = reminders[type];
    const template = CONNECTION_REMINDER_TEMPLATES[type];
    if (!reminder?.enabled || !template) continue;
    if (!(await isNotificationTypeEnabled(template.notificationType))) continue;

    const occurrences = getReminderOccurrences(reminder);
    for (const when of occurrences) {
      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: template.title,
            body: template.body,
            sound: 'default',
            color: template.accentColor,
            data: {
              route: template.route,
              type: 'connection_reminder',
              reminderType: type,
              accentColor: template.accentColor,
            },
          },
          trigger: dateTrigger(when),
        });

        if (id) scheduledIds.push(id);
      } catch {
        // Skip this occurrence, keep scheduling the rest.
      }
    }
  }

  if (scheduledIds.length) {
    await AsyncStorage.setItem(SCHEDULED_IDS_KEY, JSON.stringify(scheduledIds));
  }

  return scheduledIds;
}

export default {
  CONNECTION_REMINDER_TYPES,
  CONNECTION_REMINDER_FREQUENCIES,
  CONNECTION_REMINDER_TIME_PRESETS,
  CONNECTION_REMINDER_DAY_OPTIONS,
  CONNECTION_REMINDER_MONTH_DAY_OPTIONS,
  CONNECTION_REMINDER_TEMPLATES,
  normalizeConnectionReminderSettings,
  getConnectionReminderSettings,
  saveConnectionReminderSettings,
  getReminderOccurrences,
  scheduleConnectionReminders,
  cancelConnectionReminders,
};
