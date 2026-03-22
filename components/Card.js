import React, { useRef, useMemo } from "react";
import { View, StyleSheet, TouchableOpacity, Animated, Platform } from "react-native";
import { impact, ImpactFeedbackStyle } from '../utils/haptics';
import { SPACING } from "../utils/theme";
import { useTheme } from "../context/ThemeContext";

/**
 * High-End Surface Component — Apple Editorial Style
 * Variants: glass, elevated, outlined
 */
export default function Card({
  children,
  variant = "glass",
  onPress = null,
  padding = "md",
  style,
  activeOpacity = 0.85,
  useHaptics = true,
}) {
  const { colors, isDark } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pressable = typeof onPress === "function";

  // STRICT Apple Editorial Theme Map
  const t = useMemo(() => ({
    background: isDark ? '#000000' : '#F2F2F7', 
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    surfaceSecondary: isDark ? '#2C2C2E' : '#E5E5EA',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [isDark]);

  const handlePressIn = () => {
    if (!pressable) return;
    Animated.spring(scaleAnim, {
      toValue: 0.96, // Deeper, more tactile press
      useNativeDriver: true,
      friction: 8,
      tension: 100,
    }).start();
  };

  const handlePressOut = () => {
    if (!pressable) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
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

  // Resolve Variant Styles
  const variantStyles = useMemo(() => {
    switch (variant) {
      case "elevated":
        return {
          backgroundColor: t.surface,
          borderColor: t.border,
          borderWidth: 1,
          ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: isDark ? 0 : 0.08, shadowRadius: 24 },
            android: { elevation: 6 },
          }),
        };
      case "outlined":
        return {
          backgroundColor: "transparent",
          borderColor: t.border,
          borderWidth: 1.5, // Slightly thicker for contrast without background
        };
      case "glass":
      default:
        return {
          backgroundColor: t.surface,
          borderColor: t.border,
          borderWidth: 1,
          ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0 : 0.04, shadowRadius: 10 },
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
    borderRadius: 24, // Heavy iOS squircle radius
    overflow: "hidden", // Ensures children don't bleed out of the rounded corners
  },

  // Consistent Editorial Spacing
  padding_none: { padding: 0 },
  padding_sm: { padding: SPACING.md },   // Mapped to feel generous
  padding_md: { padding: SPACING.lg },   // Native widget padding
  padding_lg: { padding: SPACING.xl },
  padding_xl: { padding: SPACING.xxl },
});
