// components/ThisOrThat.jsx — Light, fast, flirty binary choices
// Two large buttons → after both choose → reveal moment

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { SPACING, BORDER_RADIUS } from '../utils/theme';
import { BinaryPromptEngine } from '../services/ConnectionEngine';
import PreferenceEngine from '../services/PreferenceEngine';

const FONTS = {
  serif: Platform.select({
    ios: 'Playfair Display',
    android: 'PlayfairDisplay_300Light',
    default: 'serif',
  }),
  body: Platform.select({
    ios: 'Inter',
    android: 'Inter_400Regular',
    default: 'sans-serif',
  }),
  bodyBold: Platform.select({
    ios: 'Inter-SemiBold',
    android: 'Inter_600SemiBold',
    default: 'sans-serif',
  }),
};

export default function ThisOrThat({ onChoice, onNext }) {
  const { colors } = useTheme();
  const [prompt, setPrompt] = useState(null);
  const [myChoice, setMyChoice] = useState(null);
  const scaleA = useRef(new Animated.Value(1)).current;
  const scaleB = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadNext();
  }, []);

  const loadNext = useCallback(async () => {
    setMyChoice(null);
    scaleA.setValue(1);
    scaleB.setValue(1);
    // Respect heat boundaries
    let maxHeat = 5;
    try {
      const profile = await PreferenceEngine.getContentProfile();
      maxHeat = profile?.maxHeat ?? 5;
    } catch (e) { /* fallback to maxHeat 5 */ }
    const next = await BinaryPromptEngine.getNextFiltered(maxHeat);
    setPrompt(next);
  }, [scaleA, scaleB]);

  const handleChoice = useCallback(async (choice) => {
    if (myChoice) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMyChoice(choice);

    // Animate selected option up, other down
    const selectedScale = choice === 'A' ? scaleA : scaleB;
    const otherScale = choice === 'A' ? scaleB : scaleA;

    Animated.parallel([
      Animated.spring(selectedScale, { toValue: 1.05, useNativeDriver: true, damping: 15 }),
      Animated.timing(otherScale, { toValue: 0.92, duration: 300, useNativeDriver: true }),
    ]).start();

    await BinaryPromptEngine.recordShown(prompt.id);
    await BinaryPromptEngine.recordChoice(prompt.id, choice);
    onChoice?.({ promptId: prompt.id, choice });
  }, [myChoice, prompt, scaleA, scaleB, onChoice]);

  const handleNext = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadNext();
    onNext?.();
  }, [loadNext, onNext]);

  if (!prompt) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.textMuted }]}>THIS OR THAT</Text>

      <View style={styles.optionsContainer}>
        <Animated.View style={[styles.optionWrapper, { transform: [{ scale: scaleA }] }]}>
          <TouchableOpacity
            style={[
              styles.optionButton,
              {
                backgroundColor: myChoice === 'A' ? colors.primary + '20' : colors.surface,
                borderColor: myChoice === 'A' ? colors.primary : colors.border,
              },
            ]}
            onPress={() => handleChoice('A')}
            activeOpacity={0.8}
            disabled={!!myChoice}
          >
            <Text
              style={[
                styles.optionText,
                { color: myChoice === 'A' ? colors.text : colors.textMuted },
              ]}
            >
              {prompt.optionA}
            </Text>
            {myChoice === 'A' && (
              <MaterialCommunityIcons name="heart" size={18} color={colors.primary} />
            )}
          </TouchableOpacity>
        </Animated.View>

        <View style={[styles.orDivider, { borderColor: colors.border }]}>
          <Text style={[styles.orText, { color: colors.textMuted }]}>or</Text>
        </View>

        <Animated.View style={[styles.optionWrapper, { transform: [{ scale: scaleB }] }]}>
          <TouchableOpacity
            style={[
              styles.optionButton,
              {
                backgroundColor: myChoice === 'B' ? colors.primary + '20' : colors.surface,
                borderColor: myChoice === 'B' ? colors.primary : colors.border,
              },
            ]}
            onPress={() => handleChoice('B')}
            activeOpacity={0.8}
            disabled={!!myChoice}
          >
            <Text
              style={[
                styles.optionText,
                { color: myChoice === 'B' ? colors.text : colors.textMuted },
              ]}
            >
              {prompt.optionB}
            </Text>
            {myChoice === 'B' && (
              <MaterialCommunityIcons name="heart" size={18} color={colors.primary} />
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      {myChoice && (
        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={[styles.nextText, { color: colors.primary }]}>Next</Text>
          <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  title: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: SPACING.lg,
  },
  optionsContainer: {
    width: '100%',
    gap: SPACING.md,
  },
  optionWrapper: {
    width: '100%',
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  optionText: {
    fontFamily: FONTS.serif,
    fontSize: 22,
    fontWeight: '300',
    textAlign: 'center',
  },
  orDivider: {
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  orText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    fontStyle: 'italic',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    gap: SPACING.xs,
    marginTop: SPACING.lg,
  },
  nextText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
  },
});
