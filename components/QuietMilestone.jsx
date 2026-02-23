// components/QuietMilestone.jsx — Gentle milestone acknowledgment
// Brand-aligned replacement for AchievementBadge
// No tiers, no points, no "unlocked" — just a quiet moment of recognition.

import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import Card from './Card';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY, withAlpha } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';

let Haptics = null;
try { Haptics = require('expo-haptics'); } catch { Haptics = null; }

/**
 * QuietMilestone — A gentle acknowledgement of something meaningful.
 *
 * Replaces AchievementBadge with brand-aligned design:
 * - No tier system (bronze/silver/gold)
 * - No points
 * - No "achievement unlocked" language
 * - Soft fade-in instead of bouncy animation
 *
 * Props are intentionally backward-compatible with AchievementBadge
 * so existing call sites work without changes.
 */
export default function QuietMilestone({
  achievement,
  size = 'medium',
  showProgress = false,
  onPress = null,
  style,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const isDiscovered = achievement?.unlocked;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    if (achievement?.isNew && isDiscovered && Platform.OS !== 'web' && Haptics?.notificationAsync) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [isDiscovered]);

  const getSizeConfig = () => {
    const sizes = {
      small: { icon: 24, nameSize: 12 },
      medium: { icon: 32, nameSize: 14 },
      large: { icon: 40, nameSize: 16 },
    };
    return sizes[size] || sizes.medium;
  };

  const sizeConfig = getSizeConfig();

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }, style]}>
      <Card
        variant={isDiscovered ? 'glass' : 'outlined'}
        padding="sm"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${achievement?.name || 'Milestone'}${isDiscovered ? '' : ', not yet discovered'}`}
      >
        <View style={styles.content}>
          {/* Icon */}
          <View style={[styles.iconContainer, !isDiscovered && styles.iconLocked]}>
            <Text style={[styles.icon, { fontSize: sizeConfig.icon }]}>
              {isDiscovered ? (achievement?.icon || '✨') : '🌙'}
            </Text>
          </View>

          {/* Info */}
          <View style={styles.info}>
            <Text
              style={[
                styles.name,
                { fontSize: sizeConfig.nameSize },
                !isDiscovered && styles.muted,
              ]}
              numberOfLines={1}
            >
              {achievement?.name || 'A quiet milestone'}
            </Text>

            {size !== 'small' && achievement?.description && (
              <Text
                style={[styles.description, !isDiscovered && styles.muted]}
                numberOfLines={2}
              >
                {achievement.description}
              </Text>
            )}

            {/* Gentle progress hint */}
            {showProgress && !isDiscovered && achievement?.progress !== undefined && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.round(achievement.progress * 100)}%` },
                    ]}
                  />
                </View>
              </View>
            )}
          </View>

          {/* New indicator */}
          {achievement?.isNew && isDiscovered && (
            <View style={styles.newDot} />
          )}
        </View>
      </Card>
    </Animated.View>
  );
}

// Backward-compatible alias
export { QuietMilestone as AchievementBadge };

const createStyles = (colors) =>
  StyleSheet.create({
    container: { marginVertical: SPACING.xs },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      position: 'relative',
    },
    iconContainer: {
      width: 52,
      height: 52,
      borderRadius: 26,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.md,
      backgroundColor: withAlpha(colors.primary, 0.08),
    },
    iconLocked: {
      backgroundColor: withAlpha(colors.text, 0.04),
    },
    icon: { textAlign: 'center' },
    info: { flex: 1, justifyContent: 'center' },
    name: {
      ...TYPOGRAPHY.h3,
      color: colors.text,
      marginBottom: 2,
    },
    description: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
    },
    muted: { opacity: 0.4 },
    progressContainer: { marginTop: SPACING.xs },
    progressBar: {
      height: 3,
      backgroundColor: withAlpha(colors.text, 0.06),
      borderRadius: BORDER_RADIUS.sm,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: withAlpha(colors.primary, 0.4),
      borderRadius: BORDER_RADIUS.sm,
    },
    newDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      position: 'absolute',
      top: 0,
      right: 0,
    },
  });
