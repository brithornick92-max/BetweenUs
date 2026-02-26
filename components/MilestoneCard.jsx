/**
 * MilestoneCard — Subtle, rare recognition of meaningful moments
 * 
 * Shows as a gentle card on the Home screen, not a notification.
 * One sentence, no CTA pressure. Appears very rarely.
 * Thriving couples like reflection, not achievement badges.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  runOnJS,
  Easing,
  FadeInDown,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { BORDER_RADIUS, SPACING } from '../utils/theme';
import { RelationshipMilestones } from '../services/PolishEngine';

export default function MilestoneCard() {
  const { colors } = useTheme();
  const [milestone, setMilestone] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  useEffect(() => {
    (async () => {
      const m = await RelationshipMilestones.checkForMilestone();
      if (m) {
        setMilestone(m);
        opacity.value = withDelay(600, withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }));
        translateY.value = withDelay(600, withSpring(0, { damping: 18, stiffness: 140 }));
      }
    })();
  }, []);

  const handleDismiss = useCallback(() => {
    opacity.value = withTiming(0, { duration: 350 }, (finished) => {
      if (finished) runOnJS(setDismissed)(true);
    });
    translateY.value = withTiming(-8, { duration: 350 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!milestone || dismissed) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleDismiss}
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Animated.View
          entering={FadeInDown.delay(800).duration(400)}
          style={[styles.iconCircle, { backgroundColor: colors.primary + '12' }]}
        >
          <MaterialCommunityIcons
            name={milestone.icon}
            size={20}
            color={colors.primary}
          />
        </Animated.View>
        <Text style={[styles.message, { color: colors.text }]}>
          {milestone.message}
        </Text>
        <MaterialCommunityIcons
          name="close"
          size={14}
          color={colors.textMuted}
          style={styles.dismiss}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md + 2,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  dismiss: {
    opacity: 0.4,
    padding: 4,
  },
});
