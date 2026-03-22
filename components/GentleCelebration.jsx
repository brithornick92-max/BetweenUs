// components/GentleCelebration.jsx — Soft acknowledgment animation
// Brand-aligned replacement for RewardAnimation
// Sexy Red Intimacy & Apple Editorial Updates Integrated.

import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { SPACING, withAlpha } from '../utils/theme';
import Icon from './Icon';
import { notification, NotificationFeedbackType } from '../utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

/**
 * GentleCelebration — A soft, momentary acknowledgment.
 *
 * Replaces RewardAnimation:
 * - No confetti / particle system
 * - No points counter
 * - Deep Sexy Red ambient glow
 * - Heavy Apple Editorial typography
 */
export default function GentleCelebration({
  visible = false,
  type = 'milestone',
  title = 'A quiet milestone',
  message = '',
  points = 0,        // ignored — kept for backward compat
  icon = 'sparkles-outline',
  onComplete = null,
  duration = 3500,
}) {
  const { colors, isDark } = useTheme();

  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    background: colors.background,
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    primary: colors.primary || '#D2121A', // Sexy Red
    text: colors.text,
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (!visible) return;

    // High-end Success Haptic
    notification(NotificationFeedbackType.Success).catch(() => {});

    // Sophisticated Apple entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss with smooth decay
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 800,
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
    >
      {/* Ambient Red Glow Background */}
      <View style={styles.glowOverlay} />

      <Animated.View
        style={[styles.card, { transform: [{ scale: scaleAnim }] }]}
      >
        <View style={[styles.iconWrap, { backgroundColor: withAlpha(t.primary, 0.12) }]}>
          <Icon name={icon} size={42} color={t.primary} />
        </View>

        <Text style={[styles.title, { color: t.text }]}>{title}</Text>
        
        {message ? (
          <Text style={[styles.message, { color: t.subtext }]}>{message}</Text>
        ) : null}

        <View style={[styles.indicator, { backgroundColor: t.primary }]} />
      </Animated.View>
    </Animated.View>
  );
}

export { GentleCelebration as RewardAnimation };

const createStyles = (t, isDark) =>
  StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 99999,
    },
    glowOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDark ? 'rgba(10, 0, 3, 0.85)' : 'rgba(255, 255, 255, 0.8)',
    },
    card: {
      width: SCREEN_WIDTH * 0.8,
      maxWidth: 360,
      backgroundColor: t.surface,
      borderRadius: 32, // Deep Apple Squircle
      padding: SPACING.xxl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: t.border,
      ...Platform.select({
        ios: {
          shadowColor: isDark ? '#000' : t.primary,
          shadowOffset: { width: 0, height: 20 },
          shadowOpacity: isDark ? 0.5 : 0.15,
          shadowRadius: 40,
        },
        android: { elevation: 12 },
      }),
    },
    iconWrap: {
      width: 80,
      height: 80,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: SPACING.xl,
    },
    title: {
      fontFamily: SYSTEM_FONT,
      fontSize: 26,
      fontWeight: '800',
      textAlign: 'center',
      letterSpacing: -0.5,
      marginBottom: SPACING.sm,
      lineHeight: 32,
    },
    message: {
      fontFamily: SYSTEM_FONT,
      fontSize: 16,
      fontWeight: '500',
      textAlign: 'center',
      fontStyle: 'italic',
      lineHeight: 22,
      paddingHorizontal: SPACING.md,
    },
    indicator: {
      marginTop: 32,
      width: 4,
      height: 4,
      borderRadius: 2,
      opacity: 0.6,
    }
  });
  