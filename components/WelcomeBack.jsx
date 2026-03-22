/**
 * WelcomeBack — Gentle re-entry after absence
 * Sexy Red Intimacy & Apple Editorial Updates Integrated.
 * * No guilt. No "you missed X days."
 * Just a warm, one-sentence message that fades after a moment.
 * Builds luxury psychological safety and trust.
 */

import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { SPACING, withAlpha } from '../utils/theme';
import { GentleReEntry } from '../services/PolishEngine';
import Icon from './Icon';

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

export default function WelcomeBack() {
  const { colors, isDark } = useTheme();
  const [state, setState] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-10)).current;

  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    primary: colors.primary || '#D2121A', // Sexy Red
    text: colors.text,
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await GentleReEntry.getReEntryState();
      if (cancelled) return;
      
      if (result.isReturning && result.greeting) {
        setState(result);
        
        // Sophisticated Apple-style entrance and exit
        Animated.sequence([
          Animated.parallel([
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 1000,
              delay: 500,
              useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
              toValue: 0,
              friction: 8,
              tension: 40,
              useNativeDriver: true,
            })
          ]),
          Animated.delay(6500),
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]).start();
      }
    })();
    return () => { cancelled = true; };
  }, [fadeAnim, slideAnim]);

  if (!state) return null;

  return (
    <Animated.View
      style={[
        styles.container, 
        { 
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
      accessibilityRole="alert"
    >
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: withAlpha(t.primary, 0.1) }]}>
          <Icon name="heart-outline" size={16} color={t.primary} />
        </View>
        
        <Text style={[styles.greeting, { color: t.text }]}>
          {state.greeting}
        </Text>
      </View>
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
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 24, // Deep Apple Squircle
    borderWidth: 1,
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: '600',
    fontStyle: 'italic',
    letterSpacing: -0.1,
    lineHeight: 20,
  },
});
