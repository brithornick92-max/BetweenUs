// components/GlassCard.jsx — Magnetic Glass card component
// Frosted glass effect with subtle Sexy Red glow and deep shadow
// Sexy Red Intimacy & Apple Editorial Updates Integrated.

import React, { useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { SPACING, withAlpha } from '../utils/theme';

/**
 * GlassCard — High-end frosted glass surface
 *
 * @param {object}  style      - extra style overrides
 * @param {boolean} glow       - show a subtle Sexy Red bloom behind the card
 * @param {number}  intensity  - blur intensity (default 25/45 dark/light)
 * @param {string}  variant    - 'default' | 'subtle' | 'elevated'
 */
function GlassCard({
  children,
  style,
  glow = false,
  intensity,
  variant = 'default',
  ...rest
}) {
  const { colors, isDark } = useTheme();

  // ─── SEXY RED x VELVET GLASS THEME MAP ───
  const t = useMemo(() => ({
    // Midnight Intimacy Plum-tinted glass for dark mode
    surfaceGlass: isDark ? 'rgba(19, 16, 22, 0.75)' : 'rgba(255, 255, 255, 0.7)',
    surfaceGlassSubtle: isDark ? 'rgba(19, 16, 22, 0.45)' : 'rgba(255, 255, 255, 0.5)',
    surfaceGlassElevated: isDark ? 'rgba(28, 21, 32, 0.85)' : 'rgba(255, 255, 255, 0.9)',
    border: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
    borderSubtle: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
    primary: colors.primary || '#D2121A',
    primaryGlow: withAlpha(colors.primary || '#D2121A', 0.25),
  }), [colors, isDark]);

  const blurIntensity = intensity ?? (isDark ? 25 : 45);

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
      entering={FadeIn.duration(600)}
      style={[styles.wrapper, style]}
      {...rest}
    >
      {/* Editorial Accent Glow — Sexy Red Bloom */}
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

      {/* Glass Surface */}
      <View style={[
        styles.card, 
        { 
          backgroundColor: v.backgroundColor, 
          borderColor: v.borderColor 
        }, 
        styles.shadowNative
      ]}>
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
    width: '100%',
  },
  glowWrap: {
    position: 'absolute',
    top: -30,
    left: '10%',
    right: '10%',
    height: 120,
    zIndex: -1,
    opacity: 0.8,
  },
  glowGradient: {
    flex: 1,
    borderRadius: 100,
  },
  card: {
    borderRadius: 28, // Deep Apple Squircle
    borderWidth: 1,
    overflow: 'hidden',
  },
  shadowNative: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: { elevation: 6 },
    }),
  },
  blur: {
    flex: 1,
  },
  content: {
    padding: SPACING.xl,
  },
});

export default React.memo(GlassCard);
