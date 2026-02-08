import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Card from './Card';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../utils/theme';

/**
 * Achievement Badge Component
 * 
 * Displays achievement badges with tier-based styling and animations.
 * Supports unlocked and locked states with progress indicators.
 */
export default function AchievementBadge({
  achievement,
  size = 'medium',
  showProgress = false,
  onPress = null,
  style
}) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (achievement.unlocked) {
      // Entrance animation
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true
      }).start();

      // Glow pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true
          })
        ])
      ).start();

      // Haptic feedback for newly unlocked
      if (achievement.isNew && Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } else {
      scaleAnim.setValue(1);
    }
  }, [achievement.unlocked]);

  const getTierColors = (tier) => {
    const tierColors = {
      bronze: ['#CD7F32', '#8B4513'],
      silver: ['#C0C0C0', '#808080'],
      gold: ['#FFD700', '#FFA500'],
      platinum: ['#E5E4E2', '#B4B4B4'],
      diamond: ['#B9F2FF', '#00CED1']
    };
    return tierColors[tier] || tierColors.bronze;
  };

  const getSizeStyles = () => {
    const sizes = {
      small: { container: 60, icon: 24, fontSize: 10 },
      medium: { container: 80, icon: 32, fontSize: 12 },
      large: { container: 100, icon: 40, fontSize: 14 }
    };
    return sizes[size] || sizes.medium;
  };

  const tierColors = getTierColors(achievement.tier);
  const sizeStyles = getSizeStyles();
  const isLocked = !achievement.unlocked;

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8]
  });

  return (
    <Animated.View 
      style={[
        styles.container,
        { transform: [{ scale: scaleAnim }] },
        style
      ]}
    >
      <Card
        variant={isLocked ? 'outlined' : 'elevated'}
        padding="sm"
        onPress={onPress}
        style={styles.card}
      >
        <View style={styles.content}>
          {/* Badge Circle */}
          <View style={[styles.badgeContainer, { width: sizeStyles.container, height: sizeStyles.container }]}>
            {achievement.unlocked ? (
              <>
                {/* Glow effect */}
                <Animated.View 
                  style={[
                    styles.glow,
                    {
                      opacity: glowOpacity,
                      width: sizeStyles.container + 20,
                      height: sizeStyles.container + 20
                    }
                  ]}
                >
                  <LinearGradient
                    colors={[...tierColors, 'transparent']}
                    style={styles.glowGradient}
                  />
                </Animated.View>

                {/* Badge */}
                <LinearGradient
                  colors={tierColors}
                  style={[styles.badge, { width: sizeStyles.container, height: sizeStyles.container }]}
                >
                  <Text style={[styles.icon, { fontSize: sizeStyles.icon }]}>
                    {achievement.icon}
                  </Text>
                </LinearGradient>
              </>
            ) : (
              <View style={[styles.lockedBadge, { width: sizeStyles.container, height: sizeStyles.container }]}>
                <Text style={[styles.lockedIcon, { fontSize: sizeStyles.icon }]}>
                  🔒
                </Text>
              </View>
            )}
          </View>

          {/* Achievement Info */}
          <View style={styles.info}>
            <Text 
              style={[
                styles.name,
                isLocked && styles.lockedText,
                { fontSize: sizeStyles.fontSize + 2 }
              ]}
              numberOfLines={1}
            >
              {achievement.name}
            </Text>
            
            {size !== 'small' && (
              <Text 
                style={[
                  styles.description,
                  isLocked && styles.lockedText,
                  { fontSize: sizeStyles.fontSize }
                ]}
                numberOfLines={2}
              >
                {achievement.description}
              </Text>
            )}

            {/* Progress Bar */}
            {showProgress && !achievement.unlocked && achievement.progress !== undefined && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill,
                      { width: `${achievement.progress * 100}%` }
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {Math.round(achievement.progress * 100)}%
                </Text>
              </View>
            )}

            {/* Reward Points */}
            {achievement.reward && (
              <View style={styles.reward}>
                <Text style={styles.rewardText}>
                  +{achievement.reward.points} pts
                </Text>
              </View>
            )}
          </View>

          {/* New Badge Indicator */}
          {achievement.isNew && achievement.unlocked && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          )}
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.xs
  },
  card: {
    minHeight: 100
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative'
  },
  badgeContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md
  },
  glow: {
    position: 'absolute',
    borderRadius: 1000,
    justifyContent: 'center',
    alignItems: 'center'
  },
  glowGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 1000
  },
  badge: {
    borderRadius: 1000,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)'
  },
  lockedBadge: {
    borderRadius: 1000,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  icon: {
    textAlign: 'center'
  },
  lockedIcon: {
    textAlign: 'center',
    opacity: 0.3
  },
  info: {
    flex: 1,
    justifyContent: 'center'
  },
  name: {
    ...TYPOGRAPHY.h3,
    color: COLORS.cream,
    marginBottom: SPACING.xs
  },
  description: {
    ...TYPOGRAPHY.body,
    color: COLORS.softGray,
    marginBottom: SPACING.xs
  },
  lockedText: {
    opacity: 0.5
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
    marginRight: SPACING.sm
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.blushRose,
    borderRadius: BORDER_RADIUS.sm
  },
  progressText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.softGray,
    minWidth: 40,
    textAlign: 'right'
  },
  reward: {
    marginTop: SPACING.xs
  },
  rewardText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.blushRose,
    fontWeight: '600'
  },
  newBadge: {
    position: 'absolute',
    top: -SPACING.xs,
    right: -SPACING.xs,
    backgroundColor: COLORS.blushRose,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs / 2,
    borderRadius: BORDER_RADIUS.sm
  },
  newBadgeText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.cream,
    fontWeight: '700',
    fontSize: 10
  }
});
