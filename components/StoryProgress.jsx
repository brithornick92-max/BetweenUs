// components/StoryProgress.jsx — "Your story so far"
// Brand-aligned replacement for ProgressTracker
// Gentle narrative visualization, not a metrics dashboard.

import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Card from './Card';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY, withAlpha } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';

/**
 * StoryProgress — A gentle "your story so far" visualization.
 *
 * Replaces ProgressTracker with brand-aligned design:
 * - No "Goal Achieved!" celebration
 * - No pulsing attention-grab
 * - No percentage display by default
 * - Warm, narrative framing
 *
 * Props are backward-compatible with ProgressTracker.
 */
export default function StoryProgress({
  title = 'Your story so far',
  progress = 0,
  target = 100,
  current = 0,
  unit = '',
  milestones = [],
  variant = 'default',
  showPercentage = false,
  animated = true,
  style,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 800,
        useNativeDriver: false,
      }).start();
    } else {
      progressAnim.setValue(progress);
    }
  }, [progress, animated]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const safeMilestones = Array.isArray(milestones) ? milestones : [];
  const isComplete = progress >= 1;
  const displayText = isComplete
    ? `${current} ${unit} — a beautiful journey`
    : `${current} of ${target} ${unit}`;

  return (
    <View
      style={[styles.container, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: target, now: current }}
      accessibilityLabel={`${title}: ${current} of ${target} ${unit}`}
    >
      <Card variant={variant === 'elevated' ? 'elevated' : 'glass'} padding="md">
        <View style={styles.content}>
          {/* Title */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            {showPercentage && (
              <Text style={styles.percentage}>
                {Math.round(progress * 100)}%
              </Text>
            )}
          </View>

          {/* Progress bar */}
          <View style={styles.barContainer}>
            <View style={styles.barBackground}>
              <Animated.View style={[styles.barFill, { width: progressWidth }]}>
                <LinearGradient
                  colors={[colors.primary, colors.primaryMuted || colors.primary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.barGradient}
                />
              </Animated.View>

              {/* Milestone dots */}
              {safeMilestones.map((ms, i) => {
                const pos = (ms.value / target) * 100;
                const reached = current >= ms.value;
                return (
                  <View
                    key={i}
                    style={[
                      styles.milestoneDot,
                      { left: `${pos}%` },
                      reached && styles.milestoneDotReached,
                    ]}
                  />
                );
              })}
            </View>
          </View>

          {/* Narrative stat */}
          <Text style={styles.narrative}>{displayText}</Text>
        </View>
      </Card>
    </View>
  );
}

// Backward-compatible alias
export { StoryProgress as ProgressTracker };

const createStyles = (colors) =>
  StyleSheet.create({
    container: { marginVertical: SPACING.xs },
    content: { width: '100%' },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    title: {
      ...TYPOGRAPHY.h3,
      color: colors.text,
      flex: 1,
    },
    percentage: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
    },
    barContainer: { marginBottom: SPACING.md },
    barBackground: {
      height: 6,
      backgroundColor: withAlpha(colors.text, 0.06),
      borderRadius: BORDER_RADIUS.sm,
      overflow: 'visible',
      position: 'relative',
    },
    barFill: {
      height: '100%',
      borderRadius: BORDER_RADIUS.sm,
      overflow: 'hidden',
    },
    barGradient: { width: '100%', height: '100%' },
    milestoneDot: {
      position: 'absolute',
      top: -3,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: withAlpha(colors.text, 0.15),
      borderWidth: 1.5,
      borderColor: withAlpha(colors.text, 0.25),
      transform: [{ translateX: -4 }],
    },
    milestoneDotReached: {
      backgroundColor: colors.primary,
      borderColor: colors.text,
    },
    narrative: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      fontStyle: 'italic',
    },
  });
