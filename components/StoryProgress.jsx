// components/StoryProgress.jsx — "Your story so far"
// Brand-aligned replacement for ProgressTracker
// Sexy Red Intimacy & Apple Editorial Updates Integrated.

import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Card from './Card';
import { SPACING, withAlpha } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

/**
 * StoryProgress — A gentle "your story so far" visualization.
 *
 * Replaces ProgressTracker with brand-aligned design:
 * - No gamification pressure
 * - Sexy Red primary accents
 * - Editorial system typography
 */
function StoryProgress({
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
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      Animated.spring(progressAnim, {
        toValue: progress,
        friction: 8,
        tension: 40,
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
    >
      <Card 
        variant={variant === 'elevated' ? 'elevated' : 'glass'} 
        padding="md"
        style={styles.card}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: t.text }]}>{title}</Text>
            {showPercentage && (
              <Text style={[styles.percentage, { color: t.subtext }]}>
                {Math.round(progress * 100)}%
              </Text>
            )}
          </View>

          {/* Editorial Progress Bar */}
          <View style={styles.barContainer}>
            <View style={[styles.barBackground, { backgroundColor: withAlpha(t.text, 0.06) }]}>
              <Animated.View style={[styles.barFill, { width: progressWidth }]}>
                <LinearGradient
                  colors={[t.primary, withAlpha(t.primary, 0.8)]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.barGradient}
                />
              </Animated.View>

              {/* Milestone markers */}
              {safeMilestones.map((ms, i) => {
                const pos = (ms.value / target) * 100;
                const reached = current >= ms.value;
                return (
                  <View
                    key={i}
                    style={[
                      styles.milestoneDot,
                      { left: `${pos}%`, backgroundColor: t.surface, borderColor: reached ? t.primary : t.border },
                    ]}
                  />
                );
              })}
            </View>
          </View>

          {/* Narrative Info */}
          <Text style={[styles.narrative, { color: t.subtext }]}>{displayText}</Text>
        </View>
      </Card>
    </View>
  );
}

const createStyles = (t, isDark) =>
  StyleSheet.create({
    container: { 
      marginVertical: SPACING.sm,
      paddingHorizontal: 4,
    },
    card: {
      borderRadius: 24, // Deep Apple Squircle
      borderWidth: 1,
      borderColor: t.border,
    },
    content: { width: '100%', paddingVertical: 4 },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.lg,
    },
    title: {
      fontFamily: SYSTEM_FONT,
      fontSize: 17,
      fontWeight: '800',
      letterSpacing: -0.4,
      flex: 1,
    },
    percentage: {
      fontFamily: SYSTEM_FONT,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    barContainer: { 
      marginBottom: SPACING.md,
      paddingHorizontal: 2,
    },
    barBackground: {
      height: 8,
      borderRadius: 4,
      overflow: 'visible',
      position: 'relative',
    },
    barFill: {
      height: '100%',
      borderRadius: 4,
      overflow: 'hidden',
    },
    barGradient: { width: '100%', height: '100%' },
    milestoneDot: {
      position: 'absolute',
      top: -2,
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 2,
      transform: [{ translateX: -6 }],
      zIndex: 2,
    },
    narrative: {
      fontFamily: SYSTEM_FONT,
      fontSize: 13,
      fontWeight: '600',
      fontStyle: 'italic',
      letterSpacing: -0.1,
      marginTop: 4,
    },
  });
  
export default React.memo(StoryProgress);
