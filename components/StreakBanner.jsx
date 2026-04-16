/**
 * StreakBanner — Visible daily streak counter for the home screen
 *
 * Shows current check-in streak with fire icon.
 * Tapping navigates to achievements. Animates on mount.
 * Milestone celebrations fire at 7, 30, and 100 days.
 * Streak shield (premium): one skipped day per week doesn't break the streak.
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from './Icon';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { SPACING } from '../utils/theme';

const MILESTONE_SEEN_KEY = '@betweenus:streakMilestoneSeen';
const STREAK_MILESTONES = [7, 30, 100];

async function getSeenMilestones() {
  try {
    const raw = await AsyncStorage.getItem(MILESTONE_SEEN_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
async function markMilestoneSeen(milestone) {
  try {
    const seen = await getSeenMilestones();
    if (!seen.includes(milestone)) {
      await AsyncStorage.setItem(MILESTONE_SEEN_KEY, JSON.stringify([...seen, milestone]));
    }
  } catch {}
}

export default function StreakBanner({ onPress }) {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { isPremiumEffective: isPremium } = useEntitlements();
  const [streak, setStreak] = useState(0);
  const [shieldActive, setShieldActive] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { DataLayer } = await import('../services/localfirst');
        const checkIns = await DataLayer.getCheckIns?.({ limit: 90 }) || [];

        // Compute current streak from check-in dates
        const daySet = new Set();
        for (const ci of checkIns) {
          const d = new Date(ci.created_at || ci.date_key);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          daySet.add(key);
        }

        // Also count prompt answers as check-ins
        const answers = await DataLayer.getPromptAnswers?.({ limit: 90 }) || [];
        for (const a of answers) {
          if (a.date_key) daySet.add(a.date_key);
        }

        const sorted = [...daySet].sort().reverse();
        let currentStreak = 0;
        const today = new Date();
        let usedShield = false;

        for (let i = 0; i < sorted.length + 1; i++) {
          const expected = new Date(today);
          expected.setDate(expected.getDate() - i);
          const expectedKey = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, '0')}-${String(expected.getDate()).padStart(2, '0')}`;

          if (daySet.has(expectedKey)) {
            currentStreak++;
          } else if (isPremium && !usedShield && i > 0 && currentStreak > 0) {
            // Streak shield: one gap is forgiven for premium users
            usedShield = true;
            setShieldActive(true);
          } else {
            break;
          }
        }

        if (active) {
          setStreak(currentStreak);
          if (currentStreak > 0) {
            Animated.spring(scaleAnim, {
              toValue: 1,
              friction: 6,
              tension: 80,
              useNativeDriver: true,
            }).start();
          }

          // Check for milestone celebrations
          if (currentStreak > 0 && STREAK_MILESTONES.includes(currentStreak)) {
            const seen = await getSeenMilestones();
            if (!seen.includes(currentStreak)) {
              await markMilestoneSeen(currentStreak);
              const milestoneMsg = currentStreak === 7
                ? "You've shown up for each other 7 days in a row. That's real commitment. 🔥"
                : currentStreak === 30
                  ? "30 days of connection — a whole month of choosing each other every day. 💫"
                  : "100 days together. That's extraordinary. Your relationship story is being written. ❤️";
              Alert.alert(`${currentStreak}-Day Streak!`, milestoneMsg, [
                { text: 'Keep Going', style: 'default' },
              ]);
            }
          }
        }
      } catch (e) {
        if (__DEV__) console.warn('[StreakBanner] Error:', e?.message);
      }
    })();
    return () => { active = false; };
  }, [user?.uid, isPremium]);

  if (streak === 0) return null;

  const bg = isDark ? '#1C1C1E' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#000000';
  const accentColor = streak >= 7 ? '#FF6B00' : colors.primary;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.container, { backgroundColor: bg, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
        activeOpacity={0.75}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${streak} day streak. Tap to view achievements.`}
      >
        <Icon name="flame" size={20} color={accentColor} />
        <Text style={[styles.streakText, { color: textColor }]}>
          {streak}
        </Text>
        <Text style={[styles.label, { color: colors.textMuted }]}>
          {streak === 1 ? 'day' : 'days'}
        </Text>
        {shieldActive && (
          <Icon name="shield-checkmark-outline" size={14} color={colors.textMuted} />
        )}
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
  streakText: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
});


export default function StreakBanner({ onPress }) {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const [streak, setStreak] = useState(0);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { DataLayer } = await import('../services/localfirst');
        const checkIns = await DataLayer.getCheckIns?.({ limit: 90 }) || [];

        // Compute current streak from check-in dates
        const daySet = new Set();
        for (const ci of checkIns) {
          const d = new Date(ci.created_at || ci.date_key);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          daySet.add(key);
        }

        // Also count prompt answers as check-ins
        const answers = await DataLayer.getPromptAnswers?.({ limit: 90 }) || [];
        for (const a of answers) {
          if (a.date_key) daySet.add(a.date_key);
        }

        const sorted = [...daySet].sort().reverse();
        let currentStreak = 0;
        const today = new Date();

        for (let i = 0; i < sorted.length; i++) {
          const expected = new Date(today);
          expected.setDate(expected.getDate() - i);
          const expectedKey = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, '0')}-${String(expected.getDate()).padStart(2, '0')}`;

          if (sorted.includes(expectedKey)) {
            currentStreak++;
          } else {
            break;
          }
        }

        if (active) {
          setStreak(currentStreak);
          if (currentStreak > 0) {
            Animated.spring(scaleAnim, {
              toValue: 1,
              friction: 6,
              tension: 80,
              useNativeDriver: true,
            }).start();
          }
        }
      } catch (e) {
        if (__DEV__) console.warn('[StreakBanner] Error:', e?.message);
      }
    })();
    return () => { active = false; };
  }, [user?.uid]);

  if (streak === 0) return null;

  const bg = isDark ? '#1C1C1E' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#000000';
  const accentColor = streak >= 7 ? '#FF6B00' : colors.primary;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.container, { backgroundColor: bg, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
        activeOpacity={0.75}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${streak} day streak. Tap to view achievements.`}
      >
        <Icon name="flame" size={20} color={accentColor} />
        <Text style={[styles.streakText, { color: textColor }]}>
          {streak}
        </Text>
        <Text style={[styles.label, { color: colors.textMuted }]}>
          {streak === 1 ? 'day' : 'days'}
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
  streakText: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
});
