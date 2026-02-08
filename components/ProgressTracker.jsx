import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Card from './Card';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../utils/theme';

/**
 * Progress Tracker Component
 * 
 * Visualizes progress towards goals with animated progress bars,
 * milestones, and achievement tracking.
 */
export default function ProgressTracker({
  title,
  progress = 0,
  target = 100,
  current = 0,
  unit = '',
  milestones = [],
  variant = 'default',
  showPercentage = true,
  animated = true,
  style
}) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (animated) {
      // Animate progress bar
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 1000,
        useNativeDriver: false
      }).start();

      // Pulse animation when near completion
      if (progress >= 0.9) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.05,
              duration: 800,
              useNativeDriver: true
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true
            })
          ])
        ).start();
      }
    } else {
      progressAnim.setValue(progress);
    }
  }, [progress, animated]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%']
  });

  const getProgressColor = () => {
    if (progress >= 1) return [COLORS.blushRose, COLORS.deepPlum];
    if (progress >= 0.75) return ['#4CAF50', '#2E7D32'];
    if (progress >= 0.5) return ['#FFC107', '#F57C00'];
    return ['#2196F3', '#1565C0'];
  };

  const progressColors = getProgressColor();
  const percentage = Math.round(progress * 100);
  const isComplete = progress >= 1;

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: pulseAnim }] }, style]}>
      <Card variant={variant === 'elevated' ? 'elevated' : 'glass'} padding="md">
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            {showPercentage && (
              <Text style={[styles.percentage, isComplete && styles.completeText]}>
                {percentage}%
              </Text>
            )}
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <Animated.View style={[styles.progressBarFill, { width: progressWidth }]}>
                <LinearGradient
                  colors={progressColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.progressGradient}
                />
              </Animated.View>

              {/* Milestones */}
              {milestones.map((milestone, index) => {
                const milestonePosition = (milestone.value / target) * 100;
                const isReached = current >= milestone.value;
                
                return (
                  <View
                    key={index}
                    style={[
                      styles.milestone,
                      { left: `${milestonePosition}%` },
                      isReached && styles.milestoneReached
                    ]}
                  >
                    <View style={[styles.milestoneDot, isReached && styles.milestoneDotReached]} />
                    {milestone.label && (
                      <Text style={styles.milestoneLabel}>{milestone.label}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Stats */}
          <View style={styles.stats}>
            <Text style={styles.statsText}>
              {current} / {target} {unit}
            </Text>
            {!isComplete && target - current > 0 && (
              <Text style={styles.remainingText}>
                {target - current} {unit} to go
              </Text>
            )}
            {isComplete && (
              <Text style={styles.completeText}>
                ✨ Complete!
              </Text>
            )}
          </View>

          {/* Completion Message */}
          {isComplete && (
            <View style={styles.completionBanner}>
              <LinearGradient
                colors={[COLORS.blushRose + '40', COLORS.deepPlum + '40']}
                style={styles.completionGradient}
              >
                <Text style={styles.completionText}>🎉 Goal Achieved!</Text>
              </LinearGradient>
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
  content: {
    width: '100%'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.cream,
    flex: 1
  },
  percentage: {
    ...TYPOGRAPHY.h2,
    color: COLORS.blushRose,
    fontWeight: '700'
  },
  progressBarContainer: {
    marginBottom: SPACING.md
  },
  progressBarBackground: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: BORDER_RADIUS.md,
    overflow: 'visible',
    position: 'relative'
  },
  progressBarFill: {
    height: '100%',
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden'
  },
  progressGradient: {
    width: '100%',
    height: '100%'
  },
  milestone: {
    position: 'absolute',
    top: -4,
    transform: [{ translateX: -6 }],
    alignItems: 'center'
  },
  milestoneDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)'
  },
  milestoneReached: {
    zIndex: 10
  },
  milestoneDotReached: {
    backgroundColor: COLORS.blushRose,
    borderColor: COLORS.cream
  },
  milestoneLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.softGray,
    marginTop: SPACING.xs,
    fontSize: 10
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  statsText: {
    ...TYPOGRAPHY.body,
    color: COLORS.cream,
    fontWeight: '600'
  },
  remainingText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.softGray
  },
  completeText: {
    ...TYPOGRAPHY.body,
    color: COLORS.blushRose,
    fontWeight: '700'
  },
  completionBanner: {
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden'
  },
  completionGradient: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignItems: 'center'
  },
  completionText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.cream,
    fontWeight: '700'
  }
});
