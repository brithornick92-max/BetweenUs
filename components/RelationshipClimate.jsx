// components/RelationshipClimate.jsx — "We're in the mood for…" picker
// No scores. No tracking. No trends. Just a vibe.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Dimensions,
} from 'react-native';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { SPACING, BORDER_RADIUS } from '../utils/theme';
import { RelationshipClimateState, CLIMATE_OPTIONS } from '../services/ConnectionEngine';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = SPACING.sm;
const CARD_WIDTH = (SCREEN_WIDTH - SPACING.md * 2 - GRID_GAP) / 2;

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

export default function RelationshipClimate({ onClimateChange, compact = false }) {
  const { colors, isDark } = useTheme();
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    RelationshipClimateState.get().then(data => {
      if (data?.id) setSelected(data.id);
    });
  }, []);

  const handleSelect = useCallback(async (climateId) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(climateId);
    await RelationshipClimateState.set(climateId);
    onClimateChange?.(climateId);
  }, [onClimateChange]);

  if (compact && selected) {
    const current = CLIMATE_OPTIONS.find(c => c.id === selected);
    const compactColor = isDark ? current.colorDark : current.colorLight;
    return (
      <TouchableOpacity
        style={[styles.compactContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setSelected(null)} // Tap to re-pick
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name={current.icon} size={18} color={compactColor} />
        <Text style={[styles.compactLabel, { color: colors.textMuted }]}>
          In the mood for <Text style={{ color: compactColor, fontWeight: '600' }}>{current.label}</Text>
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.question, { color: colors.text }]}>
        We're in the mood for…
      </Text>
      <View style={styles.optionsGrid}>
        {CLIMATE_OPTIONS.map((option) => {
          const isSelected = selected === option.id;
          const c = isDark ? option.colorDark : option.colorLight;
          return (
            <AnimatedTouchable
              key={option.id}
              style={[
                styles.option,
                {
                  backgroundColor: isSelected
                    ? c + '28'
                    : isDark ? c + '10' : c + '0D',
                  borderColor: isSelected
                    ? c + '55'
                    : isDark ? c + '20' : c + '18',
                },
                Platform.OS === 'ios' && styles.shadowIOS,
              ]}
              onPress={() => handleSelect(option.id)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.iconCircle,
                {
                  backgroundColor: isSelected ? c + '30' : c + '18',
                },
              ]}>
                <MaterialCommunityIcons
                  name={option.icon}
                  size={24}
                  color={isSelected ? c : c + 'BB'}
                />
              </View>
              <Text
                style={[
                  styles.optionLabel,
                  {
                    color: isSelected ? colors.text : c,
                    fontWeight: isSelected ? '600' : '500',
                  },
                ]}
              >
                {option.label}
              </Text>
            </AnimatedTouchable>
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
    fontSize: 20,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    fontWeight: '300',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: GRID_GAP,
    paddingHorizontal: SPACING.md,
  },
  option: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    width: CARD_WIDTH,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    gap: 8,
  },
  shadowIOS: {
    shadowColor: '#060410',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontFamily: FONTS.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 16,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    gap: SPACING.sm,
    alignSelf: 'center',
  },
  compactLabel: {
    fontFamily: FONTS.body,
    fontSize: 13,
  },
});
