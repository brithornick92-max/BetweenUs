// components/GlassCard.jsx — Magnetic Glass card component
// Frosted glass effect with subtle border glow and deep shadow
// Used across all screens for consistent premium feel

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
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

  const blurIntensity = intensity ?? (isDark ? 30 : 20);

  const variants = {
    default: {
      backgroundColor: isDark ? 'rgba(20,15,28,0.55)' : 'rgba(255,255,255,0.70)',
      borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.35)',
    },
    subtle: {
      backgroundColor: isDark ? 'rgba(20,15,28,0.35)' : 'rgba(255,255,255,0.50)',
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.20)',
    },
    elevated: {
      backgroundColor: isDark ? 'rgba(30,22,44,0.65)' : 'rgba(255,255,255,0.85)',
      borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.45)',
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
      <View style={[styles.card, v, Platform.OS === 'ios' ? styles.shadowIOS : styles.shadowAndroid]}>
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={blurIntensity}
            tint={isDark ? 'dark' : 'light'}
            style={styles.blur}
          >
            <View style={styles.content}>{children}</View>
          </BlurView>
        ) : (
          <View style={[styles.content, { backgroundColor: v.backgroundColor }]}>
            {children}
          </View>
        )}
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
    shadowColor: '#060410',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
  },
  shadowAndroid: {
    elevation: 8,
  },
  blur: {
    flex: 1,
  },
  content: {
    padding: SPACING.xl,
  },
});
