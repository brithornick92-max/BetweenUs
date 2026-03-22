/**
 * High-End Surface Component — Apple Editorial Style
 * Velvet Glass & Sexy Red updates integrated directly.
 * Variants: glass, elevated, outlined
 */

import React, { useRef, useMemo } from "react";
import { View, StyleSheet, TouchableOpacity, Animated, Platform } from "react-native";
import { impact, ImpactFeedbackStyle } from '../utils/haptics';
import { SPACING, withAlpha } from "../utils/theme";
import { useTheme } from "../context/ThemeContext";

export default function Card({
  children,
  variant = "glass",
  onPress = null,
  padding = "md",
  style,
  activeOpacity = 0.9,
  useHaptics = true,
}) {
  const { colors, isDark } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pressable = typeof onPress === "function";

  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    background: colors.background, 
    surface: isDark ? '#131016' : '#FFFFFF',
    surfaceSecondary: isDark ? '#1C1520' : '#F2F2F7',
    primary: colors.primary || '#C3113D', // Sexy Red
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const handlePressIn = () => {
    if (!pressable) return;
    Animated.spring(scaleAnim, {
      toValue: 0.96, // Tactile Apple-style compression
      useNativeDriver: true,
      friction: 9,
      tension: 80,
    }).start();
  };

  const handlePressOut = () => {
    if (!pressable) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 9,
      tension: 60,
    }).start();
  };

  const handlePress = () => {
    if (!pressable) return;
    if (useHaptics && Platform.OS !== "web") {
      try {
        impact(ImpactFeedbackStyle.Light);
      } catch (e) { /* non-critical */ }
    }
    onPress();
  };

  // Resolve Variant Styles with Sexy Red accents
  const variantStyles = useMemo(() => {
    switch (variant) {
      case "elevated":
        return {
          backgroundColor: t.surface,
          borderColor: t.border,
          borderWidth: 1,
          ...Platform.select({
            ios: { 
              shadowColor: isDark ? '#000' : t.primary, 
              shadowOffset: { width: 0, height: 12 }, 
              shadowOpacity: isDark ? 0.3 : 0.08, 
              shadowRadius: 24 
            },
            android: { elevation: 6 },
          }),
        };
      case "outlined":
        return {
          backgroundColor: "transparent",
          borderColor: isDark ? withAlpha(t.primary, 0.2) : t.border,
          borderWidth: 1.5,
        };
      case "glass":
      default:
        return {
          backgroundColor: isDark ? withAlpha(t.surfaceSecondary, 0.8) : t.surface,
          borderColor: t.border,
          borderWidth: 1,
          ...Platform.select({
            ios: { 
              shadowColor: '#000', 
              shadowOffset: { width: 0, height: 4 }, 
              shadowOpacity: isDark ? 0.2 : 0.04, 
              shadowRadius: 12 
            },
            android: { elevation: 2 },
          }),
        };
    }
  }, [variant, t, isDark]);

  const combinedStyles = [
    styles.base,
    styles[`padding_${padding}`],
    variantStyles,
    style,
  ];

  const body = <View style={combinedStyles}>{children}</View>;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      {pressable ? (
        <TouchableOpacity
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={activeOpacity}
          accessibilityRole="button"
        >
          {body}
        </TouchableOpacity>
      ) : (
        body
      )}
    </Animated.View>
  );
}

// ------------------------------------------------------------------
// STYLES - Apple Editorial Squircle
// ------------------------------------------------------------------
const styles = StyleSheet.create({
  base: {
    borderRadius: 24, // Deep Apple squircle radius
    overflow: "hidden",
  },
  padding_none: { padding: 0 },
  padding_sm: { padding: SPACING.md },
  padding_md: { padding: SPACING.lg },
  padding_lg: { padding: SPACING.xl },
  padding_xl: { padding: SPACING.xxl },
});
