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
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from "../utils/theme";

let Haptics = null;
try {
  Haptics = require("expo-haptics");
} catch (e) {
  Haptics = null;
}

/**
 * Luxury Button Component with Magazine Aesthetic
 * ✨ Glassmorphism variants
 * ✨ Premium gradient overlays
 * ✨ Sophisticated animations
 */
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
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const isDisabled = disabled || loading;

  const textColor = useMemo(() => {
    if (isDisabled) {
      if (variant === "primary" || variant === "glass") return COLORS.softCream;
      return COLORS.creamSubtle;
    }
    if (variant === "primary" || variant === "glass") return COLORS.pureWhite;
    if (variant === "secondary") return COLORS.deepPlum;
    return COLORS.blushRose;
  }, [isDisabled, variant]);

  const handlePressIn = () => {
    if (isDisabled) return;
    
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.96,
        useNativeDriver: true,
        friction: 8,
        tension: 100,
      }),
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 100,
      }),
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePress = async () => {
    if (isDisabled) return;

    if (haptic && Platform.OS !== "web" && Haptics?.impactAsync) {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }

    onPress?.();
  };

  const variantStyle = useMemo(() => {
    switch (variant) {
      case "outline":
        return styles.outline;
      case "ghost":
        return styles.ghost;
      case "secondary":
        return styles.secondary;
      case "glass":
        return styles.glass;
      default:
        return null;
    }
  }, [variant]);

  const disabledStyle = useMemo(() => {
    if (!isDisabled) return null;
    if (variant === "primary" || variant === "glass") return styles.disabledPrimary;
    if (variant === "outline" || variant === "ghost") return styles.disabledTransparent;
    return styles.disabledSecondary;
  }, [isDisabled, variant]);

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

  const showGradient = variant === "primary" && !isDisabled;
  const showGlass = variant === "glass" && !isDisabled;

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
        style={[styles.buttonBase, variantStyle, disabledStyle]}
      >
        {showGradient ? (
          <LinearGradient
            colors={[COLORS.blushRose, COLORS.beetroot]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            <Animated.View
              style={[
                styles.glowOverlay,
                { opacity: glowAnim },
              ]}
            />
            {renderContent()}
          </LinearGradient>
        ) : showGlass ? (
          <BlurView
            intensity={Platform.OS === "ios" ? 40 : 60}
            tint="dark"
            style={styles.glassBlur}
          >
            <LinearGradient
              colors={["rgba(255,255,255,0.1)", "rgba(255,255,255,0.05)"]}
              style={StyleSheet.absoluteFill}
            />
            {renderContent()}
          </BlurView>
        ) : (
          renderContent()
        )}
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
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  gradient: {
    width: "100%",
    borderRadius: BORDER_RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  glassBlur: {
    width: "100%",
    borderRadius: BORDER_RADIUS.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  glowOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  // Sizes
  size_sm_padding: { paddingVertical: 10, paddingHorizontal: 16 },
  size_md_padding: { paddingVertical: 14, paddingHorizontal: 24 },
  size_lg_padding: { paddingVertical: 18, paddingHorizontal: 32 },

  // Variants
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: COLORS.blushRose + "80",
  },
  secondary: {
    backgroundColor: COLORS.creamSubtle,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  glass: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },

  // Disabled states
  disabledPrimary: {
    opacity: 0.5,
    backgroundColor: COLORS.deepPlum,
  },
  disabledSecondary: {
    opacity: 0.5,
  },
  disabledTransparent: {
    opacity: 0.35,
  },

  // Text
  text: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  textPrimary: {
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  text_sm: { fontSize: 14 },
  text_md: { fontSize: 16 },
  text_lg: { fontSize: 18 },

  iconLeft: { marginRight: 10 },
  iconRight: { marginLeft: 10 },
});
