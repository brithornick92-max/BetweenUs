// components/QuietMilestone.jsx — Gentle milestone acknowledgment
// Brand-aligned replacement for AchievementBadge
// Sexy Red Intimacy & Apple Editorial Updates Integrated.

import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import Card from './Card';
import Icon from './Icon';
import { SPACING, withAlpha } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { notification, NotificationFeedbackType } from '../utils/haptics';

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

/**
 * QuietMilestone — A gentle acknowledgement of something meaningful.
 *
 * Replaces AchievementBadge with brand-aligned design:
 * - No tier system (bronze/silver/gold)
 * - No points
 * - No "achievement unlocked" language
 * - Sexy Red primary accents with Midnight Intimacy surfaces
 */
export default function QuietMilestone({
  achievement,
  size = 'medium',
  showProgress = false,
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
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const isDiscovered = achievement?.unlocked;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    if (achievement?.isNew && isDiscovered) {
      notification(NotificationFeedbackType.Success).catch(() => {});
    }
  }, [isDiscovered]);

  const getSizeConfig = () => {
    const sizes = {
      small: { icon: 18, nameSize: 13, wrap: 40 },
      medium: { icon: 22, nameSize: 15, wrap: 48 },
      large: { icon: 26, nameSize: 17, wrap: 56 },
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
        style={{ borderRadius: 20 }}
        accessibilityRole="button"
      >
        <View style={styles.content}>
          {/* Icon Container */}
          <View 
            style={[
              styles.iconContainer, 
              { 
                width: sizeConfig.wrap, 
                height: sizeConfig.wrap, 
                borderRadius: sizeConfig.wrap / 4,
                backgroundColor: isDiscovered ? withAlpha(t.primary, 0.12) : withAlpha(t.text, 0.05)
              }
            ]}
          >
            <Icon 
              name={isDiscovered ? (achievement?.icon || 'sparkles-outline') : 'moon-outline'} 
              size={sizeConfig.icon} 
              color={isDiscovered ? t.primary : t.subtext} 
            />
          </View>

          {/* Info */}
          <View style={styles.info}>
            <Text
              style={[
                styles.name,
                { fontSize: sizeConfig.nameSize, color: t.text },
                !isDiscovered && styles.muted,
              ]}
              numberOfLines={1}
            >
              {achievement?.name || 'A quiet milestone'}
            </Text>

            {size !== 'small' && achievement?.description && (
              <Text
                style={[styles.description, { color: t.subtext }, !isDiscovered && styles.muted]}
                numberOfLines={2}
              >
                {achievement.description}
              </Text>
            )}

            {/* Subtle progress track */}
            {showProgress && !isDiscovered && achievement?.progress !== undefined && (
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { backgroundColor: t.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { 
                        width: `${Math.round(achievement.progress * 100)}%`,
                        backgroundColor: withAlpha(t.primary, 0.4) 
                      },
                    ]}
                  />
                </View>
              </View>
            )}
          </View>

          {/* New Status Dot */}
          {achievement?.isNew && isDiscovered && (
            <View style={[styles.newDot, { backgroundColor: t.primary }]} />
          )}
        </View>
      </Card>
    </Animated.View>
  );
}

// Backward-compatible alias
export { QuietMilestone as AchievementBadge };

const createStyles = (t, isDark) =>
  StyleSheet.create({
    container: { marginVertical: SPACING.xs },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      position: 'relative',
      paddingVertical: 4,
    },
    iconContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.md,
    },
    info: { flex: 1, justifyContent: 'center' },
    name: {
      fontFamily: SYSTEM_FONT,
      fontWeight: '800',
      letterSpacing: -0.3,
      marginBottom: 2,
    },
    description: {
      fontFamily: SYSTEM_FONT,
      fontSize: 13,
      fontWeight: '500',
      letterSpacing: -0.1,
      lineHeight: 18,
    },
    muted: { opacity: 0.5 },
    progressContainer: { marginTop: 8 },
    progressBar: {
      height: 4,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 2,
    },
    newDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      position: 'absolute',
      top: -2,
      right: -2,
      borderWidth: 1.5,
      borderColor: t.surface,
    },
  });
  