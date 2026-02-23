/**
 * MilestoneCard — Subtle, rare recognition of meaningful moments
 * 
 * Shows as a gentle card on the Home screen, not a notification.
 * One sentence, no CTA pressure. Appears very rarely.
 * Thriving couples like reflection, not achievement badges.
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { BORDER_RADIUS, SPACING } from '../utils/theme';
import { RelationshipMilestones } from '../services/PolishEngine';

export default function MilestoneCard() {
  const { colors } = useTheme();
  const [milestone, setMilestone] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const m = await RelationshipMilestones.checkForMilestone();
      if (m) {
        setMilestone(m);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          delay: 600,
          useNativeDriver: true,
        }).start();
      }
    })();
  }, []);

  const handleDismiss = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => setDismissed(true));
  };

  if (!milestone || dismissed) return null;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleDismiss}
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={[styles.iconCircle, { backgroundColor: colors.primary + '12' }]}>
          <MaterialCommunityIcons
            name={milestone.icon}
            size={20}
            color={colors.primary}
          />
        </View>
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
