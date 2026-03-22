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

/**
 * playRhythm — Fire haptic impacts at the exact timing offsets recorded
 * by SecretKnock, so the partner's phone feels the same rhythm.
 *
 * @param {number[]} offsets  Array of ms offsets from time 0, e.g. [0, 420, 840]
 * @param {string}   style    ImpactFeedbackStyle — defaults to Heavy for "knock" feel
 * @returns {() => void}      Call the returned function to cancel mid-playback
 *
 * Example:
 *   const cancel = playRhythm([0, 400, 800, 1600]);
 *   // If user navigates away: cancel();
 */
export const playRhythm = (
  offsets,
  style = Haptics.ImpactFeedbackStyle.Heavy,
) => {
  if (!Array.isArray(offsets) || offsets.length === 0) return () => {};
  const timers = offsets.map((offset) =>
    setTimeout(() => Haptics.impactAsync(style).catch(() => {}), offset),
  );
  return () => timers.forEach(clearTimeout);
};
