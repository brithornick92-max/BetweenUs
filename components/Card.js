import React, { useRef } from "react";
import { View, StyleSheet, TouchableOpacity, Animated, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { SPACING, BORDER_RADIUS } from "../utils/theme";
import { useTheme } from "../context/ThemeContext";

/**
 * High-End Surface Component
 * Variants: glass, elevated, outlined
 */
export default function Card({
  children,
  variant = "glass",
  onPress = null,
  padding = "md",
  style,
  activeOpacity = 0.9,
  useHaptics = true,
}) {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pressable = typeof onPress === "function";

  const handlePressIn = () => {
    if (!pressable) return;
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      friction: 12,
      tension: 150,
    }).start();
  };

  const handlePressOut = () => {
    if (!pressable) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 12,
      tension: 150,
    }).start();
  };

  const handlePress = () => {
    if (!pressable) return;
    if (useHaptics && Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const backgroundColor = variant === "outlined" ? "transparent" : colors.surface;
  const borderColor = colors.border;

  const combinedStyles = [
    styles.base,
    styles[`padding_${padding}`],
    { backgroundColor, borderColor },
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

const styles = StyleSheet.create({
  base: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    overflow: "hidden",
  },

  padding_none: { padding: 0 },
  padding_sm: { padding: SPACING.sm },
  padding_md: { padding: SPACING.md },
  padding_lg: { padding: SPACING.lg },
  padding_xl: { padding: SPACING.xl },
});
