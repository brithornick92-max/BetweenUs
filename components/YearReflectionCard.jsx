import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import Icon from './Icon';
import { useTheme } from '../context/ThemeContext';
import { SPACING, withAlpha } from '../utils/theme';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

/**
 * YearReflectionCard
 * Sexy Red Intimacy & Apple Editorial Updates Integrated.
 * A premium-only card that invites users into their annual narrative.
 */
export default function YearReflectionCard({ onPress }) {
  const { colors, isDark } = useTheme();

  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    primary: colors.primary || '#D2121A', // Sexy Red
    text: colors.text,
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  return (
    <AnimatedTouchable
      entering={FadeInRight.duration(600).springify().damping(18)}
      style={[
        styles.card, 
        { 
          backgroundColor: t.surface, 
          borderColor: t.border 
        }
      ]}
      activeOpacity={0.9}
      onPress={onPress}
    >
      <View style={[styles.iconCircle, { backgroundColor: withAlpha(t.primary, 0.12) }]}> 
        <Icon name="book-outline" size={20} color={t.primary} />
      </View>

      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: t.text }]}>Year Reflection</Text>
        <Text style={[styles.subtitle, { color: t.subtext }]}>
          A warm, written look back at your year together.
        </Text>
      </View>

      <Icon name="chevron-forward" size={18} color={t.border} />
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: 24, // Deep Apple Squircle
    borderWidth: 1,
    marginBottom: SPACING.md,
    gap: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12, // iOS rounded icon style
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: SYSTEM_FONT,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    letterSpacing: -0.1,
  },
});
