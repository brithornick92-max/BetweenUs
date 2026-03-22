/**
 * MilestoneCard — Subtle, rare recognition of meaningful moments
 * Sexy Red Intimacy & Apple Editorial Updates Integrated.
 * * Shows as a gentle card on the Home screen, not a notification.
 * One sentence, no CTA pressure. Appears very rarely.
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
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
import Icon from './Icon';
import { useTheme } from '../context/ThemeContext';
import { SPACING, withAlpha } from '../utils/theme';
import { RelationshipMilestones } from '../services/PolishEngine';

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

export default function MilestoneCard() {
  const { colors, isDark } = useTheme();
  const [milestone, setMilestone] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    primary: colors.primary || '#C3113D', // Sexy Red
    text: colors.text,
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  useEffect(() => {
    (async () => {
      const m = await RelationshipMilestones.checkForMilestone();
      if (m) {
        setMilestone(m);
        opacity.value = withDelay(800, withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }));
        translateY.value = withDelay(800, withSpring(0, { damping: 20, stiffness: 120 }));
      }
    })();
  }, []);

  const handleDismiss = useCallback(() => {
    opacity.value = withTiming(0, { duration: 350 }, (finished) => {
      if (finished) runOnJS(setDismissed)(true);
    });
    translateY.value = withTiming(-12, { duration: 350 });
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
        style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}
      >
        <Animated.View
          entering={FadeInDown.delay(1000).duration(500)}
          style={[styles.iconCircle, { backgroundColor: withAlpha(t.primary, 0.12) }]}
        >
          <Icon
            name={milestone.icon}
            size={18}
            color={t.primary}
          />
        </Animated.View>

        <Text style={[styles.message, { color: t.text }]}>
          {milestone.message}
        </Text>

        <TouchableOpacity 
          onPress={handleDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.dismissBtn}
        >
          <Icon
            name="close-outline"
            size={18}
            color={t.subtext}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.lg,
    paddingHorizontal: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: 24, // Deep Apple Squircle
    borderWidth: 1,
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12, // iOS rounded icon style
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  dismissBtn: {
    opacity: 0.6,
    padding: 4,
  },
});
