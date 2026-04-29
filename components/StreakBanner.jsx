/**
 * StreakBanner — Gentle shared-moments indicator for the home screen
 *
 * Shows the number of small connection moments created this month.
 * Hidden until 2+ moments to avoid noise.
 * Uses a subtle pulse icon instead of fire. No milestone alerts.
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Platform } from 'react-native';
import Icon from './Icon';
import { useTheme } from '../context/ThemeContext';
import { updateWidgetDaysConnected } from '../services/widgetData';
import { useAuth } from '../context/AuthContext';
import { useEntitlements } from '../context/EntitlementsContext';

function getRhythmLabel(moments) {
  if (moments >= 30) return 'Your archive is alive';
  if (moments >= 14) return 'A beautiful rhythm';
  if (moments >= 7) return 'Choosing each other';
  if (moments >= 3) return 'Small moments adding up';
  return 'A lovely start';
}

export default function StreakBanner({ onPress }) {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { isPremiumEffective: isPremium } = useEntitlements();
  const [moments, setMoments] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { DataLayer } = await import('../services/localfirst');
        const checkIns = await DataLayer.getCheckIns?.({ limit: 90 }) || [];
        const answers = await DataLayer.getPromptAnswers?.({ limit: 90 }) || [];

        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const countThisMonth = (items) => items.reduce((total, item) => {
          const rawDate = item.date_key || item.created_at;
          if (!rawDate) return total;
          const raw = String(rawDate);
          const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw;
          const d = new Date(normalized);
          if (Number.isNaN(d.getTime())) return total;
          const itemMonthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          return itemMonthKey === monthKey ? total + 1 : total;
        }, 0);

        const currentMoments = countThisMonth(checkIns) + countThisMonth(answers);

        if (active) {
          setMoments(currentMoments);
          updateWidgetDaysConnected(currentMoments).catch(() => {});
          if (currentMoments >= 2) {
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
  }, [user?.uid, isPremium, fadeAnim]);

  // Hidden until 2+ moments this month
  if (moments < 2) return null;

  const bg = isDark ? '#1C1C1E' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#000000';

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <TouchableOpacity
        style={[styles.container, { backgroundColor: bg, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
        activeOpacity={0.75}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${moments} moments this month. Tap to view your story.`}
      >
        <Icon name="pulse-outline" size={18} color={colors.primary} />
        <View style={styles.textWrap}>
          <Text style={[styles.label, { color: textColor }]}>
            {moments} moments this month
          </Text>
          <Text style={[styles.rhythm, { color: colors.textMuted }]}>
            {getRhythmLabel(moments)}
          </Text>
        </View>
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
  textWrap: {
    flexShrink: 1,
  },
  rhythm: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
});
