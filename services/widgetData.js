/**
 * widgetData.js — Write shared data to iOS App Group UserDefaults
 * so the home screen widget can read it.
 *
 * Uses expo-shared-preferences or react-native-shared-group-preferences
 * via a thin NativeModules wrapper. For simplicity, we use the
 * react-native Settings API on iOS which maps to UserDefaults.
 *
 * Keys must stay in sync with ios/BetweenUsWidget/WidgetDataKeys.swift
 */

import { Platform, NativeModules } from 'react-native';

const APP_GROUP = 'group.com.brittany.betweenus';

// SharedGroupPreferences from react-native-shared-group-preferences if installed,
// otherwise we fall back to a RCTSharedDefaults native module.
const SharedDefaults = NativeModules.SharedDefaults;

const KEYS = {
  streak: 'widget_streak',
  dailyPrompt: 'widget_dailyPrompt',
  partnerName: 'widget_partnerName',
  lastCheckIn: 'widget_lastCheckIn',
  nextMilestone: 'widget_nextMilestone',
  nextMilestoneDate: 'widget_nextMilestoneDate',
};

/**
 * Write a value to App Group UserDefaults for the widget to read.
 * No-op on Android for now.
 */
async function setWidgetValue(key, value) {
  if (Platform.OS !== 'ios') return;
  if (!SharedDefaults) {
    // Native module not yet linked — safe to skip silently during dev
    return;
  }
  try {
    await SharedDefaults.set(JSON.stringify(value), key, APP_GROUP);
  } catch {
    // Widget data is best-effort
  }
}

/**
 * Push all relevant widget data at once.
 * Call this after any state change that the widget should reflect.
 */
export async function updateWidgetData({
  streak,
  dailyPrompt,
  partnerName,
  lastCheckIn,
  nextMilestone,
  nextMilestoneDate,
} = {}) {
  if (Platform.OS !== 'ios') return;

  const writes = [];
  if (streak !== undefined) writes.push(setWidgetValue(KEYS.streak, streak));
  if (dailyPrompt !== undefined) writes.push(setWidgetValue(KEYS.dailyPrompt, dailyPrompt));
  if (partnerName !== undefined) writes.push(setWidgetValue(KEYS.partnerName, partnerName));
  if (lastCheckIn !== undefined) writes.push(setWidgetValue(KEYS.lastCheckIn, lastCheckIn));
  if (nextMilestone !== undefined) writes.push(setWidgetValue(KEYS.nextMilestone, nextMilestone));
  if (nextMilestoneDate !== undefined) writes.push(setWidgetValue(KEYS.nextMilestoneDate, nextMilestoneDate));

  await Promise.all(writes);

  // Tell WidgetKit to reload timelines
  try {
    SharedDefaults?.reloadAllTimelines?.();
  } catch {
    // Best-effort
  }
}

/**
 * Convenience: call after days-connected updates.
 */
export async function updateWidgetDaysConnected(streak) {
  await updateWidgetData({ streak });
}

/**
 * Convenience: call when daily prompt changes.
 */
export async function updateWidgetPrompt(dailyPrompt) {
  await updateWidgetData({ dailyPrompt });
}

/**
 * Convenience: call when partner name changes.
 */
export async function updateWidgetPartnerName(partnerName) {
  await updateWidgetData({ partnerName });
}

export { KEYS as WIDGET_KEYS };
