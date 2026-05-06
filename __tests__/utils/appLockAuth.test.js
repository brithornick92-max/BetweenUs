import {
  APP_LOCK_MODES,
  buildAppLockAuthOptions,
  getBiometricLabel,
  isDeviceAuthAvailable,
  normalizeAppLockMode,
} from '../../utils/appLockAuth';

const LocalAuthentication = {
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
  SecurityLevel: {
    NONE: 0,
    SECRET: 1,
    BIOMETRIC_WEAK: 2,
    BIOMETRIC_STRONG: 3,
  },
};

describe('appLockAuth', () => {
  it('normalizes unknown lock modes to device auth', () => {
    expect(normalizeAppLockMode('unknown')).toBe(APP_LOCK_MODES.DEVICE);
    expect(normalizeAppLockMode(APP_LOCK_MODES.BIOMETRIC)).toBe(APP_LOCK_MODES.BIOMETRIC);
  });

  it('labels the strongest familiar biometric type', () => {
    expect(getBiometricLabel([2], LocalAuthentication)).toBe('Face ID');
    expect(getBiometricLabel([1], LocalAuthentication)).toBe('Touch ID');
    expect(getBiometricLabel([3], LocalAuthentication)).toBe('Iris unlock');
  });

  it('treats device passcode as app-lock capable', () => {
    expect(isDeviceAuthAvailable(LocalAuthentication.SecurityLevel.SECRET, LocalAuthentication)).toBe(true);
    expect(isDeviceAuthAvailable(LocalAuthentication.SecurityLevel.NONE, LocalAuthentication)).toBe(false);
    expect(isDeviceAuthAvailable(LocalAuthentication.SecurityLevel.NONE, LocalAuthentication, true)).toBe(true);
  });

  it('allows device passcode fallback for device mode', () => {
    expect(buildAppLockAuthOptions({ mode: APP_LOCK_MODES.DEVICE })).toEqual(expect.objectContaining({
      fallbackLabel: 'Use Passcode',
      disableDeviceFallback: false,
    }));
  });

  it('disables device fallback for biometric-only mode', () => {
    expect(buildAppLockAuthOptions({ mode: APP_LOCK_MODES.BIOMETRIC })).toEqual(expect.objectContaining({
      fallbackLabel: '',
      disableDeviceFallback: true,
    }));
  });
});
