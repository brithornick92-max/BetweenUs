import React, { useMemo, useRef } from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  Animated,
  Platform,
} from "react-native";
import { SPACING, TYPOGRAPHY, BORDER_RADIUS } from "../utils/theme";
import { useTheme } from "../context/ThemeContext";

let Haptics = null;
try {
  Haptics = require("expo-haptics");
} catch (e) {
  Haptics = null;
}

export default function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  icon = null,
  iconPosition = "left",
  fullWidth = false,
  style,
  haptic = true,
}) {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const isDisabled = disabled || loading;

  const textColor = useMemo(() => {
    if (isDisabled) return colors.textMuted;
    if (variant === "primary") return '#FFFFFF';
    if (variant === "glass") return colors.text;
    if (variant === "secondary") return colors.text;
    return colors.primary;
  }, [isDisabled, variant, colors]);

  const handlePressIn = () => {
    if (isDisabled) return;
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      friction: 8,
      tension: 100,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 100,
    }).start();
  };

  const handlePress = async () => {
    if (isDisabled) return;

    if (haptic && Platform.OS !== "web" && Haptics?.impactAsync) {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) { /* haptics non-critical */ }
    }

    onPress?.();
  };

  const variantStyle = useMemo(() => {
    switch (variant) {
      case "outline":
        return { ...styles.outline, borderColor: colors.border };
      case "ghost":
        return styles.ghost;
      case "secondary":
        return { ...styles.secondary, backgroundColor: colors.surface };
      case "glass":
        return { ...styles.glass, backgroundColor: colors.surface, borderColor: colors.border };
      default:
        return null;
    }
  }, [variant, colors]);

  const disabledStyle = useMemo(() => {
    if (!isDisabled) return null;
    if (variant === "primary" || variant === "glass") return { ...styles.disabledPrimary, backgroundColor: colors.surface };
    if (variant === "outline" || variant === "ghost") return styles.disabledTransparent;
    return styles.disabledSecondary;
  }, [isDisabled, variant, colors]);

  const primarySolidStyle = variant === "primary" && !isDisabled ? { backgroundColor: colors.primary } : null;

  const renderContent = () => (
    <View style={[styles.content, styles[`size_${size}_padding`]]}>
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          {icon && iconPosition === "left" && <View style={styles.iconLeft}>{icon}</View>}
          <Text
            style={[
              styles.text,
              styles[`text_${size}`],
              { color: textColor },
              variant === "primary" && styles.textPrimary,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === "right" && <View style={styles.iconRight}>{icon}</View>}
        </>
      )}
    </View>
  );

  return (
    <Animated.View
      style={[
        styles.container,
        fullWidth && styles.fullWidth,
        { transform: [{ scale: scaleAnim }] },
        style,
      ]}
    >
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        activeOpacity={1}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={[styles.buttonBase, variantStyle, disabledStyle, primarySolidStyle]}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: isDisabled }}
      >
        {renderContent()}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: "hidden",
  },
  fullWidth: {
    width: "100%",
  },
  buttonBase: {
    borderRadius: BORDER_RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  size_sm_padding: { paddingVertical: 10, paddingHorizontal: 16 },
  size_md_padding: { paddingVertical: 14, paddingHorizontal: 24 },
  size_lg_padding: { paddingVertical: 18, paddingHorizontal: 32 },

  outline: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  secondary: {},
  ghost: {
    backgroundColor: "transparent",
  },
  glass: {
    borderWidth: 1,
  },

  disabledPrimary: {
    opacity: 0.5,
  },
  disabledSecondary: {
    opacity: 0.5,
  },
  disabledTransparent: {
    opacity: 0.35,
  },

  text: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  textPrimary: {
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  text_sm: { fontSize: 14 },
  text_md: { fontSize: 16 },
  text_lg: { fontSize: 18 },

  iconLeft: { marginRight: 10 },
  iconRight: { marginLeft: 10 },
});
