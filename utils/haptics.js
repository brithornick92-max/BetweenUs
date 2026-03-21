import * as Haptics from 'expo-haptics';

// Safe wrappers — silently swallow errors on devices without Taptic Engine (older iPads)
export const impact = (style = Haptics.ImpactFeedbackStyle.Light) =>
  Haptics.impactAsync(style).catch(() => {});

export const notification = (type = Haptics.NotificationFeedbackType.Success) =>
  Haptics.notificationAsync(type).catch(() => {});

export const selection = () =>
  Haptics.selectionAsync().catch(() => {});

// Re-export the enums for convenience
export const ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = Haptics.NotificationFeedbackType;
