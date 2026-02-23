/**
 * WelcomeBack — Gentle re-entry after absence
 * 
 * No guilt. No "you missed X days."
 * Just a warm, one-sentence message that fades after a moment.
 * Builds psychological safety and trust.
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { SPACING, BORDER_RADIUS, SANS, withAlpha } from '../utils/theme';
import { GentleReEntry } from '../services/PolishEngine';

export default function WelcomeBack() {
  const { colors } = useTheme();
  const [state, setState] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await GentleReEntry.getReEntryState();
      if (cancelled) return;
      if (result.isReturning && result.greeting) {
        setState(result);
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            delay: 300,
            useNativeDriver: true,
          }),
          Animated.delay(6000),
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]).start();
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!state) return null;

  return (
    <Animated.View
      style={[styles.container, { opacity: fadeAnim }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={state.greeting}
    >
      <View style={[styles.card, { backgroundColor: withAlpha(colors.primary, 0.04), borderColor: withAlpha(colors.primary, 0.1) }]}>
        <Text style={[styles.greeting, { color: colors.text }]}>
          {state.greeting}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  card: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  greeting: {
    fontSize: 15,
    fontFamily: SANS,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 22,
  },
});
