/**
 * Stub for ExponentPedometer native module.
 *
 * expo-sensors eagerly requires this native module at import time even when
 * only Accelerometer is used. If the iOS binary was not built with the
 * Pedometer native module linked (e.g. after adding expo-sensors without
 * running `pod install` + rebuild), this stub prevents the hard crash.
 *
 * To fully resolve this: run `cd ios && pod install` then rebuild the app.
 */
const ExponentPedometer = {
  isAvailableAsync: async () => false,
  getStepCountAsync: async () => ({ steps: 0 }),
  getPermissionsAsync: async () => ({
    granted: false,
    expires: 'never',
    canAskAgain: true,
    status: 'denied',
  }),
  requestPermissionsAsync: async () => ({
    granted: false,
    expires: 'never',
    canAskAgain: true,
    status: 'denied',
  }),
  addListener: () => ({ remove: () => {} }),
  removeListeners: () => {},
};

export default ExponentPedometer;
