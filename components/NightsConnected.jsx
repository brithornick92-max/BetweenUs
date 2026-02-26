// components/NightsConnected.jsx — Gentle nights-connected counter
// Quiet, warm, brand-aligned replacement for StreakIndicator
// No gamification language. No levels. No fire. Just quiet connection.

import React, { useMemo, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  FadeInDown,
  FadeIn,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import Card from './Card';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY, withAlpha, SANS } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';

/**
 * NightsConnected — A quiet, intimate counter
 *
 * Shows how many evenings a couple has connected.
 * No streaks, no fire, no levels — just a gentle number and a warm message.
 */
export default function NightsConnected({
  currentStreak = 0,
  longestStreak = 0,
  streakHistory = [],
  compact = false,
  onPress = null,
  style,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const safeHistory = Array.isArray(streakHistory) ? streakHistory : [];

  // Gentle heartbeat / pulse animation on the heart emoji
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);
  const heartPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const getMessage = (count) => {
    if (count === 0) return 'Begin tonight — just one moment together';
    if (count === 1) return 'A beautiful start';
    if (count < 7) return 'Something lovely is growing';
    if (count === 7) return 'One week of closeness';
    if (count < 30) return 'A rhythm is forming';
    if (count === 30) return 'A month of choosing each other';
    if (count < 100) return 'Something truly special';
    return 'A beautiful story, still being written';
  };

  const message = getMessage(currentStreak);

  if (compact) {
    return (
      <Card
        variant="glass"
        padding="sm"
        onPress={onPress}
        style={[styles.compactCard, style]}
        accessibilityRole="button"
        accessibilityLabel={`${currentStreak} nights connected`}
      >
        <View style={styles.compactContent}>
          <Text style={styles.compactEmoji}>❤️</Text>
          <View style={styles.compactInfo}>
            <Text style={styles.compactNumber}>{currentStreak}</Text>
            <Text style={styles.compactLabel}>nights connected</Text>
          </View>
        </View>
      </Card>
    );
  }

  return (
    <Card
      variant="glass"
      padding="md"
      onPress={onPress}
      style={[styles.card, style]}
      accessibilityRole="button"
      accessibilityLabel={`${currentStreak} nights connected. ${message}`}
    >
      <View style={styles.content}>
        {/* Gentle count */}
        <Animated.View entering={FadeIn.duration(600)} style={styles.countSection}>
          <Animated.Text style={[styles.heartEmoji, heartPulseStyle]}>❤️</Animated.Text>
          <Animated.Text entering={FadeInDown.delay(200).duration(500)} style={styles.count}>{currentStreak}</Animated.Text>
          <Animated.Text entering={FadeInDown.delay(350).duration(500)} style={styles.label}>nights connected</Animated.Text>
        </Animated.View>

        {/* Warm message */}
        <Animated.Text entering={FadeInDown.delay(450).duration(500)} style={styles.message}>{message}</Animated.Text>

        {/* Quiet stats */}
        <Animated.View entering={FadeInDown.delay(550).duration(500)} style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{longestStreak}</Text>
            <Text style={styles.statLabel}>longest</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{safeHistory.length}</Text>
            <Text style={styles.statLabel}>total evenings</Text>
          </View>
        </Animated.View>

        {/* Last 7 days — soft dots */}
        {safeHistory.length > 0 && (
          <View style={styles.recentDays}>
            {safeHistory.slice(-7).map((day, index) => (
              <Animated.View
                key={index}
                entering={FadeIn.delay(650 + index * 80).duration(400)}
                style={[
                  styles.dayDot,
                  day.completed && styles.dayDotFilled,
                ]}
              />
            ))}
          </View>
        )}
      </View>
    </Card>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    card: { marginVertical: SPACING.xs },
    content: { alignItems: 'center' },
    countSection: { alignItems: 'center', marginBottom: SPACING.lg },
    heartEmoji: {
      fontSize: 48,
      marginBottom: SPACING.sm,
    },
    count: {
      ...TYPOGRAPHY.display,
      color: colors.text,
      fontSize: 42,
    },
    label: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      marginTop: SPACING.xs,
    },
    message: {
      ...TYPOGRAPHY.body,
      color: colors.text,
      textAlign: 'center',
      fontStyle: 'italic',
      marginBottom: SPACING.lg,
      opacity: 0.85,
    },
    stats: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      marginBottom: SPACING.lg,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: {
      ...TYPOGRAPHY.h3,
      color: colors.primary,
    },
    statLabel: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      marginTop: SPACING.xs,
    },
    statDivider: {
      width: 1,
      height: 32,
      backgroundColor: withAlpha(colors.text, 0.08),
    },
    recentDays: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: SPACING.sm,
    },
    dayDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: withAlpha(colors.text, 0.08),
    },
    dayDotFilled: {
      backgroundColor: withAlpha(colors.primary, 0.6),
    },
    // Compact
    compactCard: { marginVertical: SPACING.xs / 2 },
    compactContent: { flexDirection: 'row', alignItems: 'center' },
    compactEmoji: { fontSize: 36, marginRight: SPACING.sm },
    compactInfo: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: SPACING.xs,
    },
    compactNumber: {
      ...TYPOGRAPHY.h2,
      color: colors.text,
    },
    compactLabel: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
    },
  });
