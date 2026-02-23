// components/EnergyMatcher.jsx — "How much energy do you have right now?"
// Subtle, Premium. Adjusts content intensity.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { SPACING, BORDER_RADIUS } from '../utils/theme';
import { ContentIntensityMatcher, ENERGY_LEVELS } from '../services/ConnectionEngine';
import { useContent } from '../context/ContentContext';

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

export default function EnergyMatcher({ onSelect, compact = false }) {
  const { colors } = useTheme();
  const { loadContentProfile } = useContent() || {};
  const [selected, setSelected] = useState('medium');

  useEffect(() => {
    ContentIntensityMatcher.getEnergyLevel().then(setSelected);
  }, []);

  const handleSelect = useCallback(async (level) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(level);
    await ContentIntensityMatcher.setEnergyLevel(level);
    const params = ContentIntensityMatcher.getContentParams(level);
    onSelect?.(level, params);
    // Refresh global content profile so all screens see updated energy
    loadContentProfile?.().catch(() => {});
  }, [onSelect, loadContentProfile]);

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        {ENERGY_LEVELS.map((level) => {
          const isSelected = selected === level.id;
          return (
            <TouchableOpacity
              key={level.id}
              style={[
                styles.compactButton,
                {
                  backgroundColor: isSelected ? colors.primary + '20' : 'transparent',
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
              onPress={() => handleSelect(level.id)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={level.icon}
                size={18}
                color={isSelected ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.compactLabel,
                  { color: isSelected ? colors.text : colors.textMuted },
                ]}
              >
                {level.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.question, { color: colors.text }]}>
        How much energy do you have?
      </Text>
      <View style={styles.options}>
        {ENERGY_LEVELS.map((level) => {
          const isSelected = selected === level.id;
          return (
            <TouchableOpacity
              key={level.id}
              style={[
                styles.option,
                {
                  backgroundColor: isSelected ? colors.primary + '15' : colors.surface,
                  borderColor: isSelected ? colors.primary + '50' : colors.border,
                },
              ]}
              onPress={() => handleSelect(level.id)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={level.icon}
                size={28}
                color={isSelected ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.label, { color: isSelected ? colors.text : colors.textMuted }]}>
                {level.label}
              </Text>
              <Text style={[styles.description, { color: colors.textMuted }]}>
                {level.description}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  question: {
    fontFamily: FONTS.serif,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    fontWeight: '300',
  },
  options: {
    flexDirection: 'row',
    gap: SPACING.sm,
    width: '100%',
  },
  option: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: 6,
  },
  label: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    textAlign: 'center',
  },
  description: {
    fontFamily: FONTS.body,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },
  compactContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    justifyContent: 'center',
  },
  compactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    gap: 6,
  },
  compactLabel: {
    fontFamily: FONTS.body,
    fontSize: 13,
  },
});
