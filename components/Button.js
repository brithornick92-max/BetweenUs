/**
 * Button — Editorial Action Component
 * Sexy Red Intimacy & Apple Editorial Updates Integrated.
 * Pure native iOS surface mapping with high-contrast pill styling.
 */

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
import { SPACING, withAlpha } from "../utils/theme";

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

  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    background: colors.background, 
    surface: isDark ? '#131016' : '#FFFFFF',
    surfaceSecondary: isDark ? '#1C1520' : '#F2F2F7',
    primary: colors.primary || '#C3113D', // Sexy Red
    text: colors.text,
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const isDisabled = disabled || loading;

  const textColor = useMemo(() => {
    if (isDisabled) return t.subtext;
    if (variant === "primary") return "#FFFFFF"; 
    if (variant === "glass" || variant === "secondary") return t.text;
    if (variant === "outline" || variant === "ghost") return t.text;
    return t.primary;
  }, [isDisabled, variant, t]);

  const handlePressIn = () => {
    if (isDisabled) return;
    Animated.spring(scaleAnim, {
      toValue: 0.95, // Tactile Apple-style compression
      useNativeDriver: true,
      friction: 9,
      tension: 80,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 9,
      tension: 60,
    }).start();
  };

  const handlePress = async () => {
    if (isDisabled) return;

    if (haptic && Platform.OS !== "web") {
      try {
        impact(ImpactFeedbackStyle.Medium);
      } catch (e) { /* non-critical */ }
    }

    onPress?.();
  };

  const variantStyle = useMemo(() => {
    switch (variant) {
      case "primary":
        return {
          backgroundColor: t.primary,
          borderWidth: 0,
          ...Platform.select({
            ios: { 
              shadowColor: t.primary, 
              shadowOffset: { width: 0, height: 8 }, 
              shadowOpacity: 0.25, 
              shadowRadius: 12 
            },
            android: { elevation: 4 },
          }),
        };
      case "outline":
        return { 
          backgroundColor: "transparent", 
          borderWidth: 1.5, 
          borderColor: isDark ? withAlpha(t.primary, 0.3) : t.border 
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
          backgroundColor: withAlpha(t.surface, 0.8), 
          borderWidth: 1, 
          borderColor: t.border,
          ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
            android: { elevation: 2 },
          }),
        };
      default:
        return { backgroundColor: t.primary };
    }
  }, [variant, t, isDark]);

  const disabledStyle = useMemo(() => {
    if (!isDisabled) return null;
    return { 
      opacity: 0.4,
      backgroundColor: variant === "primary" ? t.primary : t.surfaceSecondary,
    };
  }, [isDisabled, variant, t]);

  const renderContent = () => (
    <View style={[styles.content, styles[`size_${size}_padding`]]}>
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          {icon && iconPosition === "left" && (
            <View style={styles.iconLeft}>
              {React.cloneElement(icon, { color: textColor, size: size === 'lg' ? 22 : 18 })}
            </View>
          )}
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
          {icon && iconPosition === "right" && (
            <View style={styles.iconRight}>
              {React.cloneElement(icon, { color: textColor, size: size === 'lg' ? 22 : 18 })}
            </View>
          )}
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
        activeOpacity={0.9}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={[styles.buttonBase, variantStyle, disabledStyle]}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        {renderContent()}
      </TouchableOpacity>
    </Animated.View>
  );
}

const systemFont = Platform.select({ ios: "System", android: "Roboto" });

const styles = StyleSheet.create({
  container: {
    borderRadius: 999, // Perfect Editorial Pill
    overflow: "visible",
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
  size_sm_padding: { height: 42, paddingHorizontal: 16 },
  size_md_padding: { height: 56, paddingHorizontal: 28 },
  size_lg_padding: { height: 68, paddingHorizontal: 36 },
  text: {
    fontFamily: systemFont,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.4,
    textTransform: "uppercase",
  },
  text_sm: { fontSize: 13 },
  text_md: { fontSize: 15 },
  text_lg: { fontSize: 17 },
  iconLeft: { marginRight: 10 },
  iconRight: { marginLeft: 10 },
});
