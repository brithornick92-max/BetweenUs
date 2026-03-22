// components/GlassCard.jsx — Magnetic Glass card component
// Frosted glass effect with subtle border glow and deep shadow
// Used across all screens for consistent premium feel

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { BORDER_RADIUS, SPACING } from '../utils/theme';

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
  const { colors, isDark, gradients } = useTheme();

  const blurIntensity = intensity ?? 30;

  const variants = {
    default: {
      backgroundColor: isDark ? 'rgba(28,21,32,0.55)' : 'rgba(255,255,255,0.75)',
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(19,16,22,0.08)',
    },
    subtle: {
      backgroundColor: isDark ? 'rgba(28,21,32,0.35)' : 'rgba(255,255,255,0.45)',
      borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(19,16,22,0.04)',
    },
    elevated: {
      backgroundColor: isDark ? 'rgba(36,28,40,0.65)' : 'rgba(255,255,255,0.90)',
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(19,16,22,0.12)',
    },
  };

  const v = variants[variant] || variants.default;

  return (
    <Animated.View
      entering={FadeIn.duration(500)}
      style={[styles.wrapper, style]}
      {...rest}
    >
      {/* Optional accent glow bloom behind card */}
      {glow && (
        <View style={styles.glowWrap} pointerEvents="none">
          <LinearGradient
            colors={[colors.primaryGlow || colors.primary + '35', 'transparent']}
            style={styles.glowGradient}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
        </View>
      )}

      {/* Glass card */}
      <View style={[styles.card, v, styles.shadowIOS]}>
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

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  glowWrap: {
    position: 'absolute',
    top: -20,
    left: '10%',
    right: '10%',
    height: 80,
    zIndex: -1,
  },
  glowGradient: {
    flex: 1,
    borderRadius: 80,
  },
  card: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  shadowIOS: {
    shadowColor: '#070509',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  blur: {
    flex: 1,
  },
  content: {
    padding: SPACING.xl,
  },
});
