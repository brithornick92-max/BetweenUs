import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, TYPOGRAPHY } from '../utils/theme';

const { width, height } = Dimensions.get('window');

/**
 * Reward Animation Component
 * 
 * Displays celebration animations for achievements, challenges, and rewards.
 * Includes confetti, particle effects, and haptic feedback.
 */
export default function RewardAnimation({
  visible = false,
  type = 'achievement', // 'achievement', 'challenge', 'streak', 'points'
  title = 'Congratulations!',
  message = '',
  points = 0,
  icon = '🎉',
  onComplete = null,
  duration = 3000
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const confettiAnims = useRef(
    Array.from({ length: 20 }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      rotate: new Animated.Value(0),
      opacity: new Animated.Value(1)
    }))
  ).current;

  useEffect(() => {
    if (visible) {
      // Haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Main animation sequence
      Animated.sequence([
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        }),
        // Scale up
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true
        })
      ]).start();

      // Confetti animation
      confettiAnims.forEach((anim, index) => {
        const startX = width / 2 + (Math.random() - 0.5) * 100;
        const endX = startX + (Math.random() - 0.5) * width;
        const endY = height + 100;
        const delay = index * 50;

        Animated.parallel([
          Animated.timing(anim.x, {
            toValue: endX,
            duration: 2000,
            delay,
            useNativeDriver: true
          }),
          Animated.timing(anim.y, {
            toValue: endY,
            duration: 2000,
            delay,
            useNativeDriver: true
          }),
          Animated.timing(anim.rotate, {
            toValue: Math.random() * 720,
            duration: 2000,
            delay,
            useNativeDriver: true
          }),
          Animated.timing(anim.opacity, {
            toValue: 0,
            duration: 2000,
            delay,
            useNativeDriver: true
          })
        ]).start();
      });

      // Auto-dismiss
      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true
        }).start(() => {
          if (onComplete) onComplete();
        });
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  const getColors = () => {
    switch (type) {
      case 'achievement':
        return [COLORS.blushRose, COLORS.deepPlum];
      case 'challenge':
        return ['#4CAF50', '#2E7D32'];
      case 'streak':
        return ['#FF9800', '#F57C00'];
      case 'points':
        return ['#2196F3', '#1565C0'];
      default:
        return [COLORS.blushRose, COLORS.deepPlum];
    }
  };

  const colors = getColors();

  return (
    <Animated.View 
      style={[
        styles.container,
        { opacity: fadeAnim }
      ]}
      pointerEvents="none"
    >
      {/* Confetti */}
      {confettiAnims.map((anim, index) => {
        const confettiColors = [
          COLORS.blushRose,
          COLORS.deepPlum,
          '#FFD700',
          '#4CAF50',
          '#2196F3',
          '#FF5722'
        ];
        const color = confettiColors[index % confettiColors.length];

        return (
          <Animated.View
            key={index}
            style={[
              styles.confetti,
              {
                backgroundColor: color,
                transform: [
                  { translateX: anim.x },
                  { translateY: anim.y },
                  { 
                    rotate: anim.rotate.interpolate({
                      inputRange: [0, 360],
                      outputRange: ['0deg', '360deg']
                    })
                  }
                ],
                opacity: anim.opacity
              }
            ]}
          />
        );
      })}

      {/* Main Content */}
      <Animated.View 
        style={[
          styles.content,
          { transform: [{ scale: scaleAnim }] }
        ]}
      >
        <LinearGradient
          colors={[...colors, colors[0]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Icon */}
          <Text style={styles.icon}>{icon}</Text>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          {message && (
            <Text style={styles.message}>{message}</Text>
          )}

          {/* Points */}
          {points > 0 && (
            <View style={styles.pointsContainer}>
              <Text style={styles.pointsLabel}>+{points}</Text>
              <Text style={styles.pointsText}>points</Text>
            </View>
          )}

          {/* Sparkles */}
          <View style={styles.sparkles}>
            <Text style={styles.sparkle}>✨</Text>
            <Text style={styles.sparkle}>⭐</Text>
            <Text style={styles.sparkle}>✨</Text>
          </View>
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 9999
  },
  confetti: {
    position: 'absolute',
    width: 10,
    height: 10,
    top: height / 3
  },
  content: {
    width: width * 0.85,
    maxWidth: 400,
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.3,
        shadowRadius: 30
      },
      android: { elevation: 16 }
    })
  },
  gradient: {
    padding: SPACING.xl,
    alignItems: 'center'
  },
  icon: {
    fontSize: 80,
    marginBottom: SPACING.md
  },
  title: {
    ...TYPOGRAPHY.h1,
    color: COLORS.cream,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: SPACING.sm
  },
  message: {
    ...TYPOGRAPHY.body,
    color: COLORS.cream,
    textAlign: 'center',
    marginBottom: SPACING.md,
    opacity: 0.9
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: SPACING.md,
    gap: SPACING.xs
  },
  pointsLabel: {
    ...TYPOGRAPHY.display,
    color: COLORS.cream,
    fontWeight: '800',
    fontSize: 48
  },
  pointsText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.cream,
    opacity: 0.8
  },
  sparkles: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
    gap: SPACING.md
  },
  sparkle: {
    fontSize: 24
  }
});
