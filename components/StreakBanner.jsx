/**
 * StreakBanner — Gentle rhythm indicator for the home screen
 *
 * Shows consecutive days of connection with warm, non-gamified language.
 * Hidden until 2+ consecutive days to avoid "1 day" noise.
 * Uses a subtle pulse icon instead of fire. No milestone alerts.
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Platform } from 'react-native';
import Icon from './Icon';
import { useTheme } from '../context/ThemeContext';
import { updateWidgetDaysConnected } from '../services/widgetData';
import { useAuth } from '../context/AuthContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { SPACING } from '../utils/theme';

function getRhythmLabel(days) {
  if (days >= 30) return 'Deeply connected';
  if (days >= 14) return 'A beautiful rhythm';
  if (days >= 7) return 'Showing up together';
  if (days >= 3) return 'Finding your rhythm';
  return 'Connected';
}

export default function StreakBanner({ onPress }) {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { isPremiumEffective: isPremium } = useEntitlements();
  const [streak, setStreak] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { DataLayer } = await import('../services/localfirst');
        const checkIns = await DataLayer.getCheckIns?.({ limit: 90 }) || [];

        const daySet = new Set();
        for (const ci of checkIns) {
          const d = new Date(ci.created_at || ci.date_key);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          daySet.add(key);
        }

        const answers = await DataLayer.getPromptAnswers?.({ limit: 90 }) || [];
        for (const a of answers) {
          if (a.date_key) daySet.add(a.date_key);
        }

        const sorted = [...daySet].sort().reverse();
        let currentStreak = 0;
        const today = new Date();

        for (let i = 0; i < sorted.length + 1; i++) {
          const expected = new Date(today);
          expected.setDate(expected.getDate() - i);
          const expectedKey = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, '0')}-${String(expected.getDate()).padStart(2, '0')}`;

          if (daySet.has(expectedKey)) {
            currentStreak++;
          } else {
            break;
          }
        }

        if (active) {
          setStreak(currentStreak);
          updateWidgetDaysConnected(currentStreak).catch(() => {});
          if (currentStreak >= 2) {
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }).start();
          }
        }
      } catch (e) {
        if (__DEV__) console.warn('[StreakBanner] Error:', e?.message);
      }
    })();
    return () => { active = false; };
  }, [user?.uid, isPremium]);

  // Hidden until 2+ consecutive days
  if (streak < 2) return null;

  const bg = isDark ? '#1C1C1E' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#000000';

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <TouchableOpacity
        style={[styles.container, { backgroundColor: bg, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
        activeOpacity={0.75}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${streak} nights connected. Tap to view moments.`}
      >
        <Icon name="pulse-outline" size={18} color={colors.primary} />
        <Text style={[styles.label, { color: textColor }]}>
          {streak} nights connected
        </Text>
        <Text style={[styles.rhythm, { color: colors.textMuted }]}>
          {getRhythmLabel(streak)}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  rhythm: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 2,
  },
});
