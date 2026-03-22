// components/Button.jsx
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
import { useTheme } from "../context/ThemeContext";
import { impact, ImpactFeedbackStyle } from "../utils/haptics";
import { SPACING, BORDER_RADIUS } from "../utils/theme";

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
  const { colors, isDark } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // STRICT Apple Editorial Theme Map
  const t = useMemo(() => ({
    background: isDark ? '#000000' : '#F2F2F7', 
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    surfaceSecondary: isDark ? '#2C2C2E' : '#E5E5EA',
    primary: colors.primary,
    text: isDark ? '#FFFFFF' : '#000000',
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const isDisabled = disabled || loading;

  const textColor = useMemo(() => {
    if (isDisabled) return t.subtext;
    if (variant === "primary") return t.background; // High contrast (e.g., white text on black button)
    if (variant === "glass") return t.text;
    if (variant === "secondary") return t.text;
    if (variant === "outline" || variant === "ghost") return t.text;
    return t.primary;
  }, [isDisabled, variant, t]);

  const handlePressIn = () => {
    if (isDisabled) return;
    Animated.spring(scaleAnim, {
      toValue: 0.94,
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
      tension: 60,
    }).start();
  };

  const handlePress = async () => {
    if (isDisabled) return;

    if (haptic && Platform.OS !== "web") {
      try {
        impact(ImpactFeedbackStyle.Light);
      } catch (e) { /* haptics non-critical */ }
    }

    onPress?.();
  };

  const variantStyle = useMemo(() => {
    switch (variant) {
      case "primary":
        return {
          backgroundColor: t.text, // Solid, high contrast Apple Action Button
          borderWidth: 0,
          ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0 : 0.15, shadowRadius: 8 },
            android: { elevation: 3 },
          }),
        };
      case "outline":
        return { 
          backgroundColor: "transparent", 
          borderWidth: 1.5, 
          borderColor: t.border 
        };
      case "ghost":
        return { 
          backgroundColor: "transparent",
          borderWidth: 0,
        };
      case "secondary":
        return { 
          backgroundColor: t.surfaceSecondary,
          borderWidth: 0,
        };
      case "glass":
        return { 
          backgroundColor: t.surface, 
          borderWidth: 1, 
          borderColor: t.border,
          ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0 : 0.05, shadowRadius: 8 },
            android: { elevation: 2 },
          }),
        };
      default:
        return { backgroundColor: t.text };
    }
  }, [variant, t, isDark]);

  const disabledStyle = useMemo(() => {
    if (!isDisabled) return null;
    if (variant === "primary" || variant === "glass") {
      return { 
        backgroundColor: t.surfaceSecondary, 
        borderColor: 'transparent',
        shadowOpacity: 0,
        elevation: 0,
      };
    }
    return { opacity: 0.5 };
  }, [isDisabled, variant, t]);

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
            ]}
            numberOfLines={1}
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
        activeOpacity={0.85}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={[styles.buttonBase, variantStyle, disabledStyle]}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: isDisabled }}
      >
        {renderContent()}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ------------------------------------------------------------------
// STYLES - Apple Editorial
// ------------------------------------------------------------------
const systemFont = Platform.select({ ios: "System", android: "Roboto" });

const styles = StyleSheet.create({
  container: {
    borderRadius: 999, // Apple pill-shaped fully rounded buttons
    overflow: "visible", // Allow shadows to spill
  },
  fullWidth: {
    width: "100%",
  },
  buttonBase: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Sizing (Tuned to Native iOS heights) ──
  size_sm_padding: { height: 40, paddingHorizontal: 16 },
  size_md_padding: { height: 54, paddingHorizontal: 24 },
  size_lg_padding: { height: 64, paddingHorizontal: 32 },

  // ── Typography ──
  text: {
    fontFamily: systemFont,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.3, // Tight tracking for modern feel
  },
  text_sm: { fontSize: 15 },
  text_md: { fontSize: 17 },
  text_lg: { fontSize: 19 },

  iconLeft: { marginRight: 8 },
  iconRight: { marginLeft: 8 },
});
