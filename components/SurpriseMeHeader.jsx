import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from 'expo-haptics';
import { useTheme } from "../context/ThemeContext";
import { TYPOGRAPHY, SPACING, BORDER_RADIUS, COLORS, SHADOWS } from "../utils/theme";

export function SurpriseMeHeader({ onReveal }) {
  const { theme: activeTheme, isDark } = useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Theme normalization
  const t = {
    background: activeTheme?.colors?.background ?? activeTheme?.background ?? (isDark ? COLORS.warmCharcoal : COLORS.softCream),
    surface: activeTheme?.colors?.surface ?? activeTheme?.surface ?? (isDark ? COLORS.deepPlum : COLORS.pureWhite),
    text: activeTheme?.colors?.text ?? activeTheme?.text ?? (isDark ? COLORS.softCream : COLORS.charcoal),
    textSecondary: activeTheme?.colors?.textSecondary ?? activeTheme?.textSecondary ?? (isDark ? "rgba(246,242,238,0.70)" : "rgba(51,51,51,0.68)"),
    border: activeTheme?.colors?.border ?? activeTheme?.border ?? (isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"),
    blushRose: activeTheme?.colors?.blushRose ?? activeTheme?.colors?.accent ?? activeTheme?.blushRose ?? activeTheme?.accent ?? COLORS.blushRose,
    mutedGold: activeTheme?.colors?.mutedGold ?? activeTheme?.mutedGold ?? COLORS.mutedGold,
    deepPlum: activeTheme?.colors?.deepPlum ?? activeTheme?.deepPlum ?? COLORS.deepPlum,
  };

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const handlePress = async () => {
    await Haptics.selectionAsync();
    onReveal?.();
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: pulseAnim }] }]}>
      <BlurView
        intensity={isDark ? 35 : 60}
        tint={isDark ? "dark" : "light"}
        style={styles.card}
      >
        <LinearGradient
          colors={
            isDark
              ? ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.01)"]
              : ["rgba(255,255,255,0.85)", "rgba(255,255,255,0.6)"]
          }
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.content}>
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: t.blushRose + "20" }]}>
              <MaterialCommunityIcons name="star" size={24} color={t.blushRose} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: t.text }]}>Curated for You</Text>
              <Text style={[styles.subtitle, { color: t.textSecondary }]}>
                Discover your perfect connection moment
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handlePress}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[t.blushRose, t.deepPlum]}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <MaterialCommunityIcons name="heart-multiple" size={20} color={COLORS.pureWhite} />
              <Text style={styles.buttonText}>Discover Date</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },

  card: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
      },
      android: { elevation: 6 },
    }),
  },

  content: {
    padding: 20,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },

  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  headerText: {
    flex: 1,
  },

  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 2,
  },

  subtitle: {
    fontSize: 13,
    opacity: 0.8,
  },

  button: {
    height: 48,
    borderRadius: BORDER_RADIUS.lg,
    overflow: "hidden",
  },

  buttonGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  buttonText: {
    color: COLORS.pureWhite,
    fontSize: 15,
    fontWeight: "700",
  },
});