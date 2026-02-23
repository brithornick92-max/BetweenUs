// components/GentleCelebration.jsx — Soft acknowledgment animation
// Brand-aligned replacement for RewardAnimation
// No confetti, no points, no full-screen takeover — just a warm glow.

import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { SPACING, TYPOGRAPHY, withAlpha } from '../utils/theme';

let Haptics = null;
try { Haptics = require('expo-haptics'); } catch { Haptics = null; }

/**
 * GentleCelebration — A soft, momentary acknowledgment.
 *
 * Replaces RewardAnimation:
 * - No confetti / particle system
 * - No points counter
 * - No full-screen dark overlay
 * - Gentle fade-in/out with a single warm glow
 *
 * Props are backward-compatible with RewardAnimation.
 */
export default function GentleCelebration({
  visible = false,
  type = 'milestone',
  title = 'A quiet milestone',
  message = '',
  points = 0,        // ignored — kept for backward compat
  icon = '✨',
  onComplete = null,
  duration = 3000,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (!visible) return;

    // Gentle haptic
    if (Platform.OS !== 'web' && Haptics?.notificationAsync) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

    // Soft entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start(() => onComplete?.());
    }, duration);

    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.container, { opacity: fadeAnim }]}
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLabel={`${title}. ${message}`}
    >
      <Animated.View
        style={[styles.card, { transform: [{ scale: scaleAnim }] }]}
      >
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.title}>{title}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </Animated.View>
    </Animated.View>
  );
}

// Backward-compatible alias
export { GentleCelebration as RewardAnimation };

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: withAlpha(colors.background, 0.6),
      zIndex: 9999,
    },
    card: {
      width: Dimensions.get('window').width * 0.75,
      maxWidth: 340,
      backgroundColor: withAlpha(colors.surface2, 0.95),
      borderRadius: 24,
      padding: SPACING.xl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: withAlpha(colors.primary, 0.15),
    },
    icon: {
      fontSize: 48,
      marginBottom: SPACING.md,
    },
    title: {
      ...TYPOGRAPHY.h2,
      color: colors.text,
      textAlign: 'center',
      marginBottom: SPACING.xs,
    },
    message: {
      ...TYPOGRAPHY.body,
      color: colors.textMuted,
      textAlign: 'center',
      fontStyle: 'italic',
    },
  });
