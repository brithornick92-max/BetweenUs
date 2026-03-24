import * as Haptics from 'expo-haptics';

// Safe wrappers — silently swallow errors on devices without Taptic Engine (older iPads)
// Try/catch guards against synchronous JSI throws in the new architecture in addition
// to the .catch() which guards against async (Promise) rejections.
export const impact = (style = Haptics.ImpactFeedbackStyle.Light) => {
  try {
    return Haptics.impactAsync(style).catch(() => {});
  } catch {
    return Promise.resolve();
  }
};

export const notification = (type = Haptics.NotificationFeedbackType.Success) => {
  try {
    return Haptics.notificationAsync(type).catch(() => {});
  } catch {
    return Promise.resolve();
  }
};

export const selection = () => {
  try {
    const result = Haptics.selectionAsync();
    return result && typeof result.catch === 'function'
      ? result.catch(() => {})
      : Promise.resolve();
  } catch {
    // selectionAsync unavailable — fall back to a light impact so the call site
    // still gets tactile feedback without crashing.
    try {
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {
      return Promise.resolve();
    }
  }
};

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
