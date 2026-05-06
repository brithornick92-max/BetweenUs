// components/LockScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from './Icon';
import { impact, ImpactFeedbackStyle } from '../utils/haptics';
import * as LocalAuthentication from "expo-local-authentication";
import { useTheme } from "../context/ThemeContext";
import { SPACING, TYPOGRAPHY } from "../utils/theme";
import {
  APP_LOCK_MODES,
  buildAppLockAuthOptions,
  getBiometricLabel,
  isDeviceAuthAvailable,
  normalizeAppLockMode,
} from "../utils/appLockAuth";

export default function LockScreen({ onUnlock, lockMode = APP_LOCK_MODES.DEVICE }) {
  const { colors, gradients, isDark } = useTheme();
  const [authenticating, setAuthenticating] = useState(false);
  const [authAvailable, setAuthAvailable] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometrics');
  const [errorMessage, setErrorMessage] = useState('');
  const autoPromptedRef = useRef(false);

  const requestedMode = normalizeAppLockMode(lockMode);
  const effectiveMode = requestedMode === APP_LOCK_MODES.BIOMETRIC && !biometricsAvailable
    ? APP_LOCK_MODES.DEVICE
    : requestedMode;
  const biometricOnly = effectiveMode === APP_LOCK_MODES.BIOMETRIC;

  const unlockLabel = useMemo(() => {
    if (biometricOnly) return `Unlock with ${biometricType}`;
    return biometricsAvailable ? `Unlock with ${biometricType} or Passcode` : 'Unlock with Device Passcode';
  }, [biometricOnly, biometricType, biometricsAvailable]);

  const unlockIcon = biometricOnly && biometricType === 'Face ID'
    ? 'face-recognition'
    : biometricOnly
      ? 'fingerprint'
      : 'lock-open-outline';

  const authenticate = useCallback(async () => {
    if (Platform.OS === "web" || authenticating) return;

    try {
      setAuthenticating(true);
      setErrorMessage('');

      const result = await LocalAuthentication.authenticateAsync(buildAppLockAuthOptions({
        mode: effectiveMode,
        promptMessage: 'Unlock Between Us',
      }));

      if (result.success) {
        impact(ImpactFeedbackStyle.Light);
        onUnlock?.();
        return;
      }

      if (result.error && !['user_cancel', 'app_cancel', 'system_cancel'].includes(result.error)) {
        setErrorMessage(
          result.error === 'lockout'
            ? 'Too many attempts. Try again after your device allows authentication.'
            : 'Authentication did not complete. Please try again.'
        );
      }
    } catch (err) {
      if (__DEV__) console.warn("[LockScreen] Authentication error:", err);
      setErrorMessage('Authentication is unavailable right now.');
    } finally {
      setAuthenticating(false);
    }
  }, [authenticating, effectiveMode, onUnlock]);

  const initializeLock = useCallback(async () => {
    try {
      if (Platform.OS === "web") return;

      const [hasHardware, isEnrolled, enrolledLevel] = await Promise.all([
        LocalAuthentication.hasHardwareAsync().catch(() => false),
        LocalAuthentication.isEnrolledAsync().catch(() => false),
        LocalAuthentication.getEnrolledLevelAsync().catch(() => LocalAuthentication.SecurityLevel.NONE),
      ]);
      const biometricReady = hasHardware && isEnrolled;

      setBiometricsAvailable(biometricReady);
      setAuthAvailable(isDeviceAuthAvailable(enrolledLevel, LocalAuthentication, biometricReady));

      if (biometricReady) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync().catch(() => []);
        setBiometricType(getBiometricLabel(types, LocalAuthentication));
      }
    } catch (err) {
      if (__DEV__) console.warn("[LockScreen] Initialization error:", err);
      setAuthAvailable(false);
    }
  }, []);

  useEffect(() => {
    initializeLock();
  }, [initializeLock]);

  useEffect(() => {
    if (authAvailable && !autoPromptedRef.current) {
      autoPromptedRef.current = true;
      authenticate();
    }
  }, [authAvailable, authenticate]);

  return (
    <LinearGradient
      colors={gradients.screenBackground || [colors.background, colors.background]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}>
              <Icon name="lock-closed-outline" size={48} color={colors.primary} />
            </View>
            <Text style={[TYPOGRAPHY.h1, styles.title, { color: colors.text }]}>
              Between Us
            </Text>
            <Text style={[TYPOGRAPHY.body, styles.subtitle, { color: colors.textMuted }]}>
              {authAvailable ? unlockLabel : 'Set a device passcode or biometric unlock to use Vault Lock.'}
            </Text>
            {!!errorMessage && (
              <Text style={[styles.errorText, { color: colors.danger || colors.primary }]}>
                {errorMessage}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.unlockButton, { backgroundColor: colors.primary }, (!authAvailable || authenticating) && styles.disabledButton]}
            onPress={authenticate}
            disabled={!authAvailable || authenticating}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={unlockLabel}
            accessibilityState={{ disabled: !authAvailable || authenticating, busy: authenticating }}
          >
            {authenticating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Icon name={unlockIcon} size={22} color="#FFFFFF" />
                <Text style={styles.unlockButtonText}>{unlockLabel}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.xxxl,
    paddingHorizontal: SPACING.xl,
  },
  header: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  iconWrap: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    marginTop: SPACING.sm,
    textAlign: "center",
  },
  subtitle: {
    marginTop: SPACING.sm,
    textAlign: "center",
    maxWidth: 320,
  },
  errorText: {
    marginTop: SPACING.md,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    maxWidth: 320,
  },
  unlockButton: {
    width: "100%",
    maxWidth: 340,
    minHeight: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  disabledButton: {
    opacity: 0.45,
  },
  unlockButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
});
