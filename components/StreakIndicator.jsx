import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import Card from './Card';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../utils/theme';

/**
 * Streak Indicator Component
 * 
 * Displays current streak with fire animation and milestone tracking.
 * Shows streak history and motivational messages.
 */
export default function StreakIndicator({
  currentStreak = 0,
  longestStreak = 0,
  streakHistory = [],
  compact = false,
  onPress = null,
  style
}) {
  const flameAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (currentStreak > 0) {
      // Flame flicker animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(flameAnim, {
            toValue: 1.1,
            duration: 500,
            useNativeDriver: true
          }),
          Animated.timing(flameAnim, {
            toValue: 0.9,
            duration: 500,
            useNativeDriver: true
          }),
          Animated.timing(flameAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true
          })
        ])
      ).start();

      // Glow pulse for long streaks
      if (currentStreak >= 7) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true
            }),
            Animated.timing(glowAnim, {
              toValue: 0,
              duration: 1500,
              useNativeDriver: true
            })
          ])
        ).start();
      }
    }
  }, [currentStreak]);

  const getStreakLevel = (streak) => {
    if (streak >= 100) return { level: 'legendary', color: '#9C27B0', emoji: '👑' };
    if (streak >= 30) return { level: 'master', color: '#FF5722', emoji: '🔥' };
    if (streak >= 14) return { level: 'strong', color: '#FF9800', emoji: '💪' };
    if (streak >= 7) return { level: 'building', color: '#FFC107', emoji: '⭐' };
    if (streak >= 3) return { level: 'starting', color: '#4CAF50', emoji: '🌱' };
    return { level: 'new', color: '#2196F3', emoji: '✨' };
  };

  const getMotivationalMessage = (streak) => {
    if (streak === 0) return "Start your streak today!";
    if (streak === 1) return "Great start! Keep it going!";
    if (streak < 7) return `${7 - streak} days to your first week!`;
    if (streak === 7) return "🎉 One week streak!";
    if (streak < 30) return `${30 - streak} days to a month!`;
    if (streak === 30) return "🎊 One month streak!";
    if (streak < 100) return `${100 - streak} days to legendary!`;
    return "🏆 Legendary streak!";
  };

  const streakLevel = getStreakLevel(currentStreak);
  const motivationalMessage = getMotivationalMessage(currentStreak);
  const isNewRecord = currentStreak > 0 && currentStreak === longestStreak;

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.6]
  });

  if (compact) {
    return (
      <Card variant="glass" padding="sm" onPress={onPress} style={[styles.compactCard, style]}>
        <View style={styles.compactContent}>
          <Animated.Text 
            style={[
              styles.compactFlame,
              { transform: [{ scale: flameAnim }] }
            ]}
          >
            🔥
          </Animated.Text>
          <View style={styles.compactInfo}>
            <Text style={styles.compactStreak}>{currentStreak}</Text>
            <Text style={styles.compactLabel}>day streak</Text>
          </View>
        </View>
      </Card>
    );
  }

  return (
    <Card variant="elevated" padding="md" onPress={onPress} style={[styles.card, style]}>
      <View style={styles.content}>
        {/* Flame Display */}
        <View style={styles.flameContainer}>
          {currentStreak >= 7 && (
            <Animated.View 
              style={[
                styles.glow,
                { opacity: glowOpacity }
              ]}
            >
              <LinearGradient
                colors={[streakLevel.color + '80', 'transparent']}
                style={styles.glowGradient}
              />
            </Animated.View>
          )}
          
          <Animated.Text 
            style={[
              styles.flame,
              { transform: [{ scale: flameAnim }] }
            ]}
          >
            {currentStreak > 0 ? '🔥' : '💨'}
          </Animated.Text>
        </View>

        {/* Streak Count */}
        <View style={styles.streakInfo}>
          <Text style={styles.streakNumber}>{currentStreak}</Text>
          <Text style={styles.streakLabel}>Day Streak</Text>
          
          {isNewRecord && (
            <View style={styles.recordBadge}>
              <Text style={styles.recordText}>🏆 New Record!</Text>
            </View>
          )}
        </View>

        {/* Level Badge */}
        <View style={[styles.levelBadge, { backgroundColor: streakLevel.color + '30' }]}>
          <Text style={styles.levelEmoji}>{streakLevel.emoji}</Text>
          <Text style={[styles.levelText, { color: streakLevel.color }]}>
            {streakLevel.level.toUpperCase()}
          </Text>
        </View>

        {/* Motivational Message */}
        <Text style={styles.motivationalMessage}>{motivationalMessage}</Text>

        {/* Stats */}
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{longestStreak}</Text>
            <Text style={styles.statLabel}>Longest</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{streakHistory.length}</Text>
            <Text style={styles.statLabel}>Total Days</Text>
          </View>
        </View>

        {/* Streak Calendar (Last 7 Days) */}
        {streakHistory.length > 0 && (
          <View style={styles.calendar}>
            <Text style={styles.calendarTitle}>Last 7 Days</Text>
            <View style={styles.calendarDays}>
              {streakHistory.slice(-7).map((day, index) => (
                <View 
                  key={index}
                  style={[
                    styles.calendarDay,
                    day.completed && styles.calendarDayCompleted
                  ]}
                >
                  <Text style={styles.calendarDayText}>
                    {day.completed ? '✓' : '○'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Next Milestone */}
        {currentStreak > 0 && currentStreak < 100 && (
          <View style={styles.milestone}>
            <Text style={styles.milestoneLabel}>Next Milestone:</Text>
            <View style={styles.milestoneProgress}>
              <View style={styles.milestoneBar}>
                <View 
                  style={[
                    styles.milestoneFill,
                    { 
                      width: `${(currentStreak % (currentStreak < 7 ? 7 : currentStreak < 30 ? 30 : 100)) / (currentStreak < 7 ? 7 : currentStreak < 30 ? 30 : 100) * 100}%`,
                      backgroundColor: streakLevel.color
                    }
                  ]}
                />
              </View>
              <Text style={styles.milestoneText}>
                {currentStreak < 7 ? '7 days' : currentStreak < 30 ? '30 days' : '100 days'}
              </Text>
            </View>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: SPACING.xs
  },
  content: {
    alignItems: 'center'
  },
  flameContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md
  },
  glow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60
  },
  glowGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 60
  },
  flame: {
    fontSize: 80
  },
  streakInfo: {
    alignItems: 'center',
    marginBottom: SPACING.md
  },
  streakNumber: {
    ...TYPOGRAPHY.display,
    color: COLORS.cream,
    fontWeight: '800',
    fontSize: 48
  },
  streakLabel: {
    ...TYPOGRAPHY.h3,
    color: COLORS.softGray,
    marginTop: SPACING.xs
  },
  recordBadge: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.blushRose + '30',
    borderRadius: BORDER_RADIUS.md
  },
  recordText: {
    ...TYPOGRAPHY.body,
    color: COLORS.blushRose,
    fontWeight: '700'
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    gap: SPACING.xs
  },
  levelEmoji: {
    fontSize: 20
  },
  levelText: {
    ...TYPOGRAPHY.body,
    fontWeight: '700'
  },
  motivationalMessage: {
    ...TYPOGRAPHY.body,
    color: COLORS.cream,
    textAlign: 'center',
    marginBottom: SPACING.lg
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: SPACING.lg
  },
  statItem: {
    flex: 1,
    alignItems: 'center'
  },
  statValue: {
    ...TYPOGRAPHY.h2,
    color: COLORS.blushRose,
    fontWeight: '700'
  },
  statLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.softGray,
    marginTop: SPACING.xs
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
  },
  calendar: {
    width: '100%',
    marginBottom: SPACING.md
  },
  calendarTitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.softGray,
    marginBottom: SPACING.sm,
    textAlign: 'center'
  },
  calendarDays: {
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  calendarDay: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  calendarDayCompleted: {
    backgroundColor: COLORS.blushRose + '30',
    borderColor: COLORS.blushRose
  },
  calendarDayText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.cream
  },
  milestone: {
    width: '100%'
  },
  milestoneLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.softGray,
    marginBottom: SPACING.xs
  },
  milestoneProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm
  },
  milestoneBar: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden'
  },
  milestoneFill: {
    height: '100%',
    borderRadius: BORDER_RADIUS.sm
  },
  milestoneText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.cream,
    fontWeight: '600'
  },
  // Compact styles
  compactCard: {
    marginVertical: SPACING.xs / 2
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  compactFlame: {
    fontSize: 32,
    marginRight: SPACING.sm
  },
  compactInfo: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.xs
  },
  compactStreak: {
    ...TYPOGRAPHY.h2,
    color: COLORS.cream,
    fontWeight: '700'
  },
  compactLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.softGray
  }
});
