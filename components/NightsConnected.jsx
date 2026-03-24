// components/NightsConnected.jsx — Gentle nights-connected counter
// Quiet, warm, brand-aligned replacement for StreakIndicator
// Sexy Red Intimacy & Apple Editorial Updates Integrated.

import React, { useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  FadeInDown,
  FadeIn,
  Easing,
} from 'react-native-reanimated';
import Card from './Card';
import { SPACING, TYPOGRAPHY, withAlpha } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import Icon from './Icon';

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

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
  const { colors, isDark } = useTheme();

  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    primary: colors.primary || '#D2121A', // Sexy Red
    text: colors.text,
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);
  const safeHistory = Array.isArray(streakHistory) ? streakHistory : [];

  // High-end heart "breathing" animation
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
  }, []);

  const heartPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: pulse.value === 1 ? 0.9 : 1,
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
          <Animated.View style={heartPulseStyle}>
            <Icon name="heart-outline" size={20} color={t.primary} />
          </Animated.View>
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
        <Animated.View entering={FadeIn.duration(800)} style={styles.countSection}>
          <Animated.View style={[styles.heartContainer, heartPulseStyle]}>
            <Icon name="heart-outline" size={42} color={t.primary} />
          </Animated.View>
          <Animated.Text entering={FadeInDown.delay(200).duration(600)} style={styles.count}>
            {currentStreak}
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(350).duration(600)} style={styles.label}>
            nights connected
          </Animated.Text>
        </Animated.View>

        {/* Warm message */}
        <Animated.Text entering={FadeInDown.delay(450).duration(600)} style={styles.message}>
          {message}
        </Animated.Text>

        {/* Editorial Stats Row */}
        <Animated.View entering={FadeInDown.delay(550).duration(600)} style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{longestStreak}</Text>
            <Text style={styles.statLabel}>longest run</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: t.border }]} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{safeHistory.length}</Text>
            <Text style={styles.statLabel}>total evenings</Text>
          </View>
        </Animated.View>

        {/* Progress Dots — Subtle editorial accents */}
        {safeHistory.length > 0 && (
          <View style={styles.recentDays}>
            {safeHistory.slice(-7).map((day, index) => (
              <Animated.View
                key={index}
                entering={FadeIn.delay(650 + index * 80).duration(400)}
                style={[
                  styles.dayDot,
                  day.completed && { backgroundColor: t.primary },
                ]}
              />
            ))}
          </View>
        )}
      </View>
    </Card>
  );
}

const createStyles = (t, isDark) =>
  StyleSheet.create({
    card: { 
      marginVertical: SPACING.sm,
      borderRadius: 28, // Deep Apple Squircle
      borderWidth: 1,
      borderColor: t.border,
    },
    content: { alignItems: 'center', paddingVertical: SPACING.md },
    countSection: { alignItems: 'center', marginBottom: SPACING.lg },
    heartContainer: {
      marginBottom: SPACING.md,
      shadowColor: t.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
    },
    count: {
      fontFamily: SYSTEM_FONT,
      fontSize: 48,
      fontWeight: '800',
      color: t.text,
      letterSpacing: -1,
    },
    label: {
      fontFamily: SYSTEM_FONT,
      fontSize: 13,
      fontWeight: '700',
      color: t.subtext,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginTop: 4,
    },
    message: {
      fontFamily: SYSTEM_FONT,
      fontSize: 16,
      fontWeight: '500',
      color: t.text,
      textAlign: 'center',
      fontStyle: 'italic',
      marginBottom: SPACING.xl,
      paddingHorizontal: SPACING.xl,
    },
    stats: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      marginBottom: SPACING.xl,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: {
      fontFamily: SYSTEM_FONT,
      fontSize: 20,
      fontWeight: '800',
      color: t.text,
    },
    statLabel: {
      fontFamily: SYSTEM_FONT,
      fontSize: 12,
      fontWeight: '600',
      color: t.subtext,
      textTransform: 'lowercase',
      marginTop: 2,
    },
    statDivider: {
      width: 1,
      height: 24,
      opacity: 0.5,
    },
    recentDays: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 10,
    },
    dayDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: t.border,
    },
    // Compact View
    compactCard: { 
      marginVertical: SPACING.xs,
      borderRadius: 20,
    },
    compactContent: { 
      flexDirection: 'row', 
      alignItems: 'center',
      paddingHorizontal: SPACING.sm,
    },
    compactInfo: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
      marginLeft: 10,
    },
    compactNumber: {
      fontFamily: SYSTEM_FONT,
      fontSize: 18,
      fontWeight: '800',
      color: t.text,
    },
    compactLabel: {
      fontFamily: SYSTEM_FONT,
      fontSize: 12,
      fontWeight: '600',
      color: t.subtext,
    },
  });
  