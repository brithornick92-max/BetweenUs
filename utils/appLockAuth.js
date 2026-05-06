export const APP_LOCK_MODES = {
  DEVICE: 'device',
  BIOMETRIC: 'biometric',
};

export function normalizeAppLockMode(mode) {
  return mode === APP_LOCK_MODES.BIOMETRIC ? APP_LOCK_MODES.BIOMETRIC : APP_LOCK_MODES.DEVICE;
}

export function getBiometricLabel(authenticationTypes = [], LocalAuthentication) {
  if (!LocalAuthentication) return 'Biometrics';

  if (authenticationTypes.includes(LocalAuthentication.AuthenticationType?.FACIAL_RECOGNITION)) {
    return 'Face ID';
  }

  if (authenticationTypes.includes(LocalAuthentication.AuthenticationType?.FINGERPRINT)) {
    return 'Touch ID';
  }

  if (authenticationTypes.includes(LocalAuthentication.AuthenticationType?.IRIS)) {
    return 'Iris unlock';
  }

  return 'Biometrics';
}

export function isDeviceAuthAvailable(enrolledLevel, LocalAuthentication, biometricsAvailable = false) {
  const secretLevel = LocalAuthentication?.SecurityLevel?.SECRET ?? 1;
  return biometricsAvailable || Number(enrolledLevel || 0) >= secretLevel;
}

export function buildAppLockAuthOptions({
  mode = APP_LOCK_MODES.DEVICE,
  promptMessage = 'Unlock Between Us',
} = {}) {
  const normalizedMode = normalizeAppLockMode(mode);
  const biometricOnly = normalizedMode === APP_LOCK_MODES.BIOMETRIC;

  return {
    promptMessage,
    fallbackLabel: biometricOnly ? '' : 'Use Passcode',
    disableDeviceFallback: biometricOnly,
    biometricsSecurityLevel: 'strong',
  };
}
