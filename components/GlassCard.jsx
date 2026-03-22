// components/GlassCard.jsx — Magnetic Glass card component
// Frosted glass effect with subtle border glow and deep shadow
// Velvet Glass & Apple Editorial updates integrated

import React, { useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { SPACING } from '../utils/theme';

/**
 * GlassCard — frosted glass surface
 *
 * @param {object}  style      - extra style overrides
 * @param {boolean} glow       - show a subtle accent glow behind the card
 * @param {number}  intensity  - blur intensity (default 30/20 dark/light)
 * @param {string}  variant    - 'default' | 'subtle' | 'elevated'
 * @param {object}  children
 */
export default function GlassCard({
  children,
  style,
  glow = false,
  intensity,
  variant = 'default',
  ...rest
}) {
  const { colors, isDark } = useTheme();

  // STRICT Apple Editorial & Velvet Glass Theme Map
  const t = useMemo(() => ({
    surfaceGlass: isDark ? 'rgba(28, 28, 30, 0.65)' : 'rgba(255, 255, 255, 0.7)',
    surfaceGlassSubtle: isDark ? 'rgba(28, 28, 30, 0.4)' : 'rgba(255, 255, 255, 0.5)',
    surfaceGlassElevated: isDark ? 'rgba(44, 44, 46, 0.75)' : 'rgba(255, 255, 255, 0.9)',
    border: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    borderSubtle: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    primaryGlow: colors.primaryGlow || colors.primary + '40',
  }), [colors, isDark]);

  const blurIntensity = intensity ?? (isDark ? 20 : 40);

  const variants = {
    default: {
      backgroundColor: t.surfaceGlass,
      borderColor: t.border,
    },
    subtle: {
      backgroundColor: t.surfaceGlassSubtle,
      borderColor: t.borderSubtle,
    },
    elevated: {
      backgroundColor: t.surfaceGlassElevated,
      borderColor: t.border,
    },
  };

  const v = variants[variant] || variants.default;

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      style={[styles.wrapper, style]}
      {...rest}
    >
      {/* Optional accent glow bloom behind card */}
      {glow && (
        <View style={styles.glowWrap} pointerEvents="none">
          <LinearGradient
            colors={[t.primaryGlow, 'transparent']}
            style={styles.glowGradient}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
        </View>
      )}

      {/* Glass card */}
      <View style={[styles.card, { backgroundColor: v.backgroundColor, borderColor: v.borderColor }, styles.shadowIOS]}>
        <BlurView
          intensity={blurIntensity}
          tint={isDark ? "dark" : "light"}
          style={styles.blur}
        >
          <View style={styles.content}>{children}</View>
        </BlurView>
      </View>
    </Animated.View>
  );
}

// ------------------------------------------------------------------
// STYLES - Apple Editorial Squircle & Diffused Shadow
// ------------------------------------------------------------------
const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    width: '100%',
  },
  glowWrap: {
    position: 'absolute',
    top: -24,
    left: '15%',
    right: '15%',
    height: 100,
    zIndex: -1,
  },
  glowGradient: {
    flex: 1,
    borderRadius: 100,
  },
  card: {
    borderRadius: 28, // Deep Apple squircle radius
    borderWidth: 1,
    overflow: 'hidden',
  },
  shadowIOS: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
      },
      android: { elevation: 4 },
    }),
  },
  blur: {
    flex: 1,
  },
  content: {
    padding: SPACING.xl,
  },
});
