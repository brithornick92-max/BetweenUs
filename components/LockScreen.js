// components/LockScreen.js
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Animated,
 Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from './Icon';
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import * as LocalAuthentication from "expo-local-authentication";
import { useTheme } from "../context/ThemeContext";
import { SPACING, TYPOGRAPHY } from "../utils/theme";

const PIN_LENGTH = 4;
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30000; // 30 seconds

export default function LockScreen({ onUnlock }) {
  const { colors, gradients, isDark } = useTheme();
  const keyBgStyle = { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' };
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [biometricType, setBiometricType] = useState(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const isLockedOut = Date.now() < lockedUntil;

  useEffect(() => {
    initializeLock();
  }, []);

  const initializeLock = async () => {
    try {
      if (Platform.OS !== "web") {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (hasHardware && isEnrolled) {
          const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
          if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
            setBiometricType("face-recognition");
          } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
            setBiometricType("fingerprint");
          } else {
            setBiometricType("generic");
          }

          // Auto-prompt biometrics on load
          authenticateBiometrically();
        }
      }
    } catch (err) {
      if (__DEV__) console.warn("[LockScreen] Initialization error:", err);
    }
  };

  const authenticateBiometrically = async () => {
    try {
      if (Platform.OS === "web") return;
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Between Us",
        fallbackLabel: "Use PIN",
      });
      if (result.success) {
        onUnlock?.();
      }
    } catch (err) {
      if (__DEV__) console.warn("[LockScreen] Biometric auth error:", err);
    }
  };

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 70, useNativeDriver: true }),
    ]).start();
          notification(NotificationFeedbackType.Error);
  };

  const handlePressDigit = async (digit) => {
    if (isLockedOut || pin.length >= PIN_LENGTH) return;

          impact(ImpactFeedbackStyle.Light);
    const newPin = pin + digit;
    setPin(newPin);

    if (newPin.length === PIN_LENGTH) {
      onUnlock?.();
      if (attempts >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_DURATION);
      }
    }
  };

  const handleDelete = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
              impact(ImpactFeedbackStyle.Light);
    }
  };

  const keypadRows = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
  ];

  return (
    <LinearGradient
      colors={gradients.screenBackground || [colors.background, colors.background]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <View style={styles.header}>
            <Icon name="lock-closed-outline" size={60} color={colors.primary} />
            <Text style={[TYPOGRAPHY.h1, { color: colors.text, marginTop: SPACING.lg, textAlign: "center" }]}>
              Between Us
            </Text>
            <Text style={[TYPOGRAPHY.body, { color: colors.textMuted, marginTop: SPACING.xs, textAlign: "center" }]}>
              {isLockedOut ? "Too many attempts. Try again later." : "Enter PIN to unlock"}
            </Text>
          </View>

          <Animated.View
            style={[
              styles.dotsContainer,
              { transform: [{ translateX: shakeAnim }] },
            ]}
            accessibilityLabel={`PIN entry: ${pin.length} of ${PIN_LENGTH} digits entered`}
            accessibilityRole="text"
          >
            {Array(PIN_LENGTH).fill(0).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { borderColor: colors.primary },
                  (i < pin.length && !error) && { backgroundColor: colors.primary },
                  error && { backgroundColor: colors.danger, borderColor: colors.danger },
                ]}
              />
            ))}
          </Animated.View>

          <View style={styles.keypad}>
            {keypadRows.map((row, i) => (
              <View key={i} style={styles.row}>
                {row.map((digit) => (
                  <Key
                    key={digit}
                    label={digit}
                    onPress={() => handlePressDigit(digit)}
                    disabled={isLockedOut}
                    textColor={colors.text}
                    keyBgStyle={keyBgStyle}
                  />
                ))}
              </View>
            ))}
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.key, keyBgStyle]}
                onPress={authenticateBiometrically}
                disabled={!biometricType || isLockedOut}
                accessibilityRole="button"
                accessibilityLabel={biometricType === 'face-recognition' ? 'Unlock with Face ID' : 'Unlock with fingerprint'}
                accessibilityState={{ disabled: !biometricType || isLockedOut }}
              >
                {biometricType && (
                  <Icon
                    name={biometricType === "face-recognition" ? "face-recognition" : "fingerprint"}
                    size={32}
                    color={colors.primary}
                    style={{ opacity: isLockedOut ? 0.3 : 1 }}
                  />
                )}
              </TouchableOpacity>
              <Key
                label="0"
                onPress={() => handlePressDigit("0")}
                disabled={isLockedOut}
                textColor={colors.text}
                keyBgStyle={keyBgStyle}
              />
              <TouchableOpacity
                style={[styles.key, keyBgStyle]}
                onPress={handleDelete}
                disabled={isLockedOut}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Delete last digit"
                accessibilityState={{ disabled: isLockedOut }}
              >
                <Icon
                  name="backspace-outline"
                  size={28}
                  color={colors.textMuted}
                  style={{ opacity: isLockedOut ? 0.3 : 1 }}
                />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const Key = ({ label, onPress, disabled, textColor, keyBgStyle }) => (
  <TouchableOpacity
    style={[styles.key, keyBgStyle, disabled && { opacity: 0.3 }]}
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityLabel={`Digit ${label}`}
    accessibilityState={{ disabled }}
  >
    <Text style={[styles.keyText, { color: textColor }]}>{label}</Text>
  </TouchableOpacity>
);

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
    alignItems: "center",
    marginTop: SPACING.xl,
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: SPACING.xxl,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    marginHorizontal: SPACING.sm,
    backgroundColor: "transparent",
  },
  keypad: {
    width: "100%",
    maxWidth: 320,
    marginBottom: SPACING.xl,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.lg,
  },
  key: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  keyText: {
    fontSize: 32,
    fontWeight: "400",
  },
});
