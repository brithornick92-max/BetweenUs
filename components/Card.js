import React, { useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, BORDER_RADIUS } from '../utils/theme';

/**
 * High-End Surface Component
 * Variants:
 * - 'glass': Translucent blur (Apple-style)
 * - 'elevated': Deep shadows for prominence
 * - 'outlined': Subtle borders for secondary info
 * - 'gradient': Interactive brand-colored backgrounds
 */
export default function Card({
  children,
  variant = 'glass',
  onPress = null,
  padding = 'md',
  style,
  activeOpacity = 0.9,
  useHaptics = true,
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pressable = typeof onPress === 'function';

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
    if (useHaptics && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const combinedStyles = [
    styles.base,
    styles[`padding_${padding}`],
    variant === 'elevated' && styles.elevated,
    variant === 'outlined' && styles.outlined,
    style,
  ];

  const body = (() => {
    if (variant === 'glass') {
      return (
        <BlurView
          intensity={Platform.OS === 'ios' ? 20 : 40}
          tint="dark"
          style={combinedStyles}
        >
          {children}
        </BlurView>
      );
    }

    if (variant === 'gradient') {
      return (
        <LinearGradient
          colors={[COLORS.deepPlum, COLORS.warmCharcoal]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[combinedStyles, styles.gradientBorder]}
        >
          {children}
        </LinearGradient>
      );
    }

    return <View style={combinedStyles}>{children}</View>;
  })();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      {pressable ? (
        <TouchableOpacity
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={activeOpacity}
        >
          <View style={[styles.shadowWrapper, variant === 'outlined' && styles.noShadow]}>
            {body}
          </View>
        </TouchableOpacity>
      ) : (
        <View style={[styles.shadowWrapper, variant === 'outlined' && styles.noShadow]}>
          {body}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadowWrapper: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
    }),
  },
  noShadow: {
    ...Platform.select({
      ios: { shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 } },
      android: { elevation: 0 },
    }),
  },
  base: {
    backgroundColor: 'rgba(30, 30, 30, 0.7)',
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  elevated: {
    backgroundColor: COLORS.deepPlum,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(184, 115, 144, 0.3)',
  },
  gradientBorder: {
    borderColor: COLORS.blushRose + '40',
  },

  padding_none: { padding: 0 },
  padding_sm: { padding: SPACING.sm },
  padding_md: { padding: SPACING.md },
  padding_lg: { padding: SPACING.lg },
  padding_xl: { padding: SPACING.xl },
});
