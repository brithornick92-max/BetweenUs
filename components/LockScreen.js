import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { COLORS, SPACING, TYPOGRAPHY } from "../utils/theme";

import { storage, STORAGE_KEYS } from "../utils/storage";

const PIN_LEN = 4;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;
const PIN_KEY = "betweenus_app_lock_pin_v1";
const PIN_SERVICE = "betweenus_app_lock";

export default function LockScreen({ onUnlock, pinCode }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const [storedPinHash, setStoredPinHash] = useState(null); // string | null
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioTypeIcon, setBioTypeIcon] = useState("face-recognition");

  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const isLockedOut = Date.now() < lockedUntil;

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Prevent immediate re-prompt loop if user cancels biometrics
  const bioCanceledRef = useRef(false);
  const authInFlightRef = useRef(false);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    (async () => {
      // Load stored PIN hash (if any)
      let savedHash = await SecureStore.getItemAsync(PIN_KEY, {
        keychainService: PIN_SERVICE,
      });
      if (!savedHash) {
        // Migrate legacy AsyncStorage PIN if present
        const legacyPin = await storage.get(STORAGE_KEYS.APP_LOCK_PIN);
        if (typeof legacyPin === "string" && legacyPin.length > 0) {
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
      setStoredPinHash(typeof savedHash === "string" ? savedHash : null);

      // Determine biometrics availability
      if (Platform.OS === "web") return;

      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        const canBio = !!hasHardware && !!isEnrolled;
        setBioAvailable(canBio);

        if (canBio) {
          const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
          // 1 = fingerprint, 2 = facial (per expo docs)
          const hasFace = types?.includes(2);
          setBioTypeIcon(hasFace ? "face-recognition" : "fingerprint");

          // Auto-trigger once (only if enrolled and not previously cancelled in this session)
          triggerBiometrics({ allowAuto: true });
        }
      } catch {
        setBioAvailable(false);
      }
    })();
  }, []);

  const safeHaptic = async (type = "light") => {
    if (Platform.OS === "web") return;
    try {
      if (type === "error") await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      else if (type === "medium") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const shake = async () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
    await safeHaptic("error");
  };

  const lockout = () => {
    const until = Date.now() + LOCKOUT_MS;
    setLockedUntil(until);
    // reset attempts after lockout ends (optional)
    setTimeout(() => setAttempts(0), LOCKOUT_MS);
  };

  const succeed = () => {
    setPin("");
    setError(false);
    setAttempts(0);
    onUnlock?.();
  };

  const fail = async () => {
    setError(true);
    await shake();

    const next = attempts + 1;
    setAttempts(next);

    setTimeout(() => {
      setPin("");
      setError(false);
    }, 600);

    if (next >= MAX_ATTEMPTS) lockout();
  };

const triggerBiometrics = async () => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) return;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock Between Us",
      fallbackLabel: "Use PIN",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });

    if (result?.success) {
      onUnlock?.();
    }
  } catch (e) {
    // Fail silently -> user can use PIN
    console.warn("[LockScreen] Biometrics failed:", e?.message || e);
  }
};

  const validatePin = async (candidate) => {
    // If no PIN is set, allow access (since PIN lock is optional)
    if (!storedPinHash) return true;
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      candidate
    );
    return hash === storedPinHash;
  };

  const handlePressDigit = async (digit) => {
    if (isLockedOut) return;
    if (pin.length >= PIN_LEN) return;

    await safeHaptic("light");

    const next = pin + digit;
    setPin(next);

    if (next.length === PIN_LEN) {
      if (await validatePin(next)) {
        succeed();
      } else {
        fail();
      }
    }
  };

  const handleDelete = async () => {
    if (isLockedOut) return;
    if (pin.length === 0) return;
    await safeHaptic("medium");
    setPin((p) => p.slice(0, -1));
  };

  const lockoutSeconds = useMemo(() => {
    if (!isLockedOut) return 0;
    return Math.ceil((lockedUntil - Date.now()) / 1000);
  }, [lockedUntil, isLockedOut]);

  return (
    <LinearGradient colors={[COLORS.deepPlum, COLORS.warmCharcoal]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <View style={styles.header}>
            <MaterialCommunityIcons name="heart-lock" size={48} color={COLORS.blushRose} />
            <Text style={[TYPOGRAPHY.display, styles.title]}>Between Us</Text>
            <Text style={[TYPOGRAPHY.body, styles.subtitle]}>
              {isLockedOut ? `Try again in ${lockoutSeconds}s` : "Your space is locked"}
            </Text>
            {!storedPinHash && (
              <Text style={[TYPOGRAPHY.caption, { color: COLORS.creamSubtle, opacity: 0.7, marginTop: 6 }]}>
                PIN lock is optional — toggle in Settings
              </Text>
            )}
          </View>

          {/* PIN Dots */}
          <Animated.View style={[styles.dotsContainer, { transform: [{ translateX: shakeAnim }] }]}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i < pin.length && styles.dotFilled,
                  error && styles.dotError,
                  isLockedOut && { opacity: 0.4 },
                ]}
              />
            ))}
          </Animated.View>

          {/* Keypad */}
          <View style={styles.keypad}>
            {[
              ["1", "2", "3"],
              ["4", "5", "6"],
              ["7", "8", "9"],
            ].map((row, idx) => (
              <View key={idx} style={styles.row}>
                {row.map((digit) => (
                  <TouchableOpacity
                    key={digit}
                    style={[styles.key, isLockedOut && styles.keyDisabled]}
                    onPress={() => handlePressDigit(digit)}
                    activeOpacity={0.6}
                    disabled={isLockedOut}
                  >
                    <Text style={styles.keyText}>{digit}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.key, (!bioAvailable || isLockedOut) && styles.keyDisabled]}
                onPress={() => triggerBiometrics({ allowAuto: false })}
                activeOpacity={0.6}
                disabled={!bioAvailable || isLockedOut}
              >
                <MaterialCommunityIcons name={bioTypeIcon} size={28} color={COLORS.blushRose} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.key, isLockedOut && styles.keyDisabled]}
                onPress={() => handlePressDigit("0")}
                activeOpacity={0.6}
                disabled={isLockedOut}
              >
                <Text style={styles.keyText}>0</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.key, isLockedOut && styles.keyDisabled]}
                onPress={handleDelete}
                activeOpacity={0.6}
                disabled={isLockedOut}
              >
                <MaterialCommunityIcons name="backspace-outline" size={24} color={COLORS.creamSubtle} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Optional: Forgot PIN */}
          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={() => {
              // Up to you: route to “Reset Lock” flow
              // Usually requires device auth + clears pin.
            }}
            disabled
          >
            <Text style={styles.forgotText}>Forgot PIN?</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: { flex: 1, alignItems: "center", justifyContent: "space-between", paddingVertical: SPACING.xxl },
  header: { alignItems: "center", marginTop: SPACING.xl },
  title: { color: COLORS.softCream, marginTop: SPACING.md },
  subtitle: { color: COLORS.creamSubtle, opacity: 0.7 },

  dotsContainer: { flexDirection: "row", gap: 20, marginVertical: 40 },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: "rgba(184, 115, 144, 0.4)",
    backgroundColor: "transparent",
  },
  dotFilled: { backgroundColor: COLORS.blushRose, borderColor: COLORS.blushRose, transform: [{ scale: 1.2 }] },
  dotError: { backgroundColor: "#FF5252", borderColor: "#FF5252" },

  keypad: { width: "100%", paddingHorizontal: 40 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  key: {
    width: 75,
    height: 75,
    borderRadius: 38,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  keyDisabled: {
    opacity: 0.35,
  },
  keyText: { fontSize: 28, color: COLORS.softCream, fontWeight: "400" },

  forgotBtn: { marginBottom: 20, opacity: 0.6 },
  forgotText: { ...TYPOGRAPHY.caption, color: COLORS.blushRose, fontWeight: "700" },
});
