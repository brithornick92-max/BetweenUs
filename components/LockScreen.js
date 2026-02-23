// components/LockScreen.js
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { useTheme } from "../context/ThemeContext";
import { SPACING, TYPOGRAPHY } from "../utils/theme";
import { storage, STORAGE_KEYS } from "../utils/storage";
import { Platform } from "react-native";

const PIN_LENGTH = 4;
const PIN_KEY = "betweenus_app_lock_pin_v1";
const PIN_SERVICE = "betweenus_app_lock";
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30000; // 30 seconds

export default function LockScreen({ onUnlock }) {
  const { colors, gradients } = useTheme();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [storedPinHash, setStoredPinHash] = useState(null);
  const [biometricType, setBiometricType] = useState(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const isLockedOut = Date.now() < lockedUntil;

  useEffect(() => {
    initializeLock();
  }, []);

  const initializeLock = async () => {
    try {
      // 1. Get stored PIN hash
      let savedHash = await SecureStore.getItemAsync(PIN_KEY, {
        keychainService: PIN_SERVICE,
      });

      // Migration logic from old storage if needed
      if (!savedHash) {
        const legacyPin = await storage.get(STORAGE_KEYS.APP_LOCK_PIN, null);
        if (legacyPin && typeof legacyPin === "string") {
          savedHash = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            legacyPin
          );
          await SecureStore.setItemAsync(PIN_KEY, savedHash, {
            keychainService: PIN_SERVICE,
          });
          await storage.remove(STORAGE_KEYS.APP_LOCK_PIN);
        }
      }
      setStoredPinHash(savedHash);

      // 2. Check Biometrics
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
      console.warn("[LockScreen] Initialization error:", err);
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
      console.warn("[LockScreen] Biometric auth error:", err);
    }
  };

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handlePressDigit = async (digit) => {
    if (isLockedOut || pin.length >= PIN_LENGTH) return;

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const newPin = pin + digit;
    setPin(newPin);

    if (newPin.length === PIN_LENGTH) {
      // If no PIN set, allow (or developer should handle setup flow elsewhere)
      if (!storedPinHash) {
        onUnlock?.();
        return;
      }

      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        newPin
      );

      if (hash === storedPinHash) {
        onUnlock?.();
      } else {
        setError(true);
        shake();
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        if (newAttempts >= MAX_ATTEMPTS) {
          setLockedUntil(Date.now() + LOCKOUT_DURATION);
        }

        setTimeout(() => {
          setPin("");
          setError(false);
        }, 500);
      }
    }
  };

  const handleDelete = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
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
            <MaterialCommunityIcons name="heart-lock" size={60} color={colors.primary} />
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
                  />
                ))}
              </View>
            ))}
            <View style={styles.row}>
              <TouchableOpacity
                style={styles.key}
                onPress={authenticateBiometrically}
                disabled={!biometricType || isLockedOut}
                accessibilityRole="button"
                accessibilityLabel={biometricType === 'face-recognition' ? 'Unlock with Face ID' : 'Unlock with fingerprint'}
                accessibilityState={{ disabled: !biometricType || isLockedOut }}
              >
                {biometricType && (
                  <MaterialCommunityIcons
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
              />
              <TouchableOpacity
                style={styles.key}
                onPress={handleDelete}
                disabled={isLockedOut}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Delete last digit"
                accessibilityState={{ disabled: isLockedOut }}
              >
                <MaterialCommunityIcons
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

const Key = ({ label, onPress, disabled, textColor }) => (
  <TouchableOpacity
    style={[styles.key, disabled && { opacity: 0.3 }]}
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
