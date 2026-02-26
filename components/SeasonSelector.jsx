/**
 * SeasonSelector — "Your Season"
 * 
 * Not tracking health — tracking context.
 * Slightly influences prompt ordering, date suggestions, tone.
 * Thriving couples change. The app should move with them.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { BORDER_RADIUS, SPACING } from '../utils/theme';
import { RelationshipSeasons, SEASONS } from '../services/PolishEngine';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function SeasonSelector({ compact = false, onSeasonChange }) {
  const { colors } = useTheme();
  const [currentSeason, setCurrentSeason] = useState(null);

  useEffect(() => {
    (async () => {
      const s = await RelationshipSeasons.get();
      if (s) setCurrentSeason(s.id);
    })();
  }, []);

  const handleSelect = useCallback(async (seasonId) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await RelationshipSeasons.set(seasonId);
    setCurrentSeason(seasonId);
    onSeasonChange?.(seasonId);
  }, [onSeasonChange]);

  // Compact: single row showing current season, tappable to cycle
  if (compact) {
    const season = SEASONS.find(s => s.id === currentSeason);
    if (!season) return null;

    return (
      <View style={[styles.compactRow, { borderColor: colors.border }]}>
        <MaterialCommunityIcons name={season.icon} size={14} color={season.color} />
        <Text style={[styles.compactLabel, { color: colors.textMuted }]}>
          {season.label}
        </Text>
        <Text style={[styles.compactSub, { color: colors.textMuted }]}>
          {season.description}
        </Text>
      </View>
    );
  }

  // Full: all seasons in a selectable list
  return (
    <View style={styles.container}>
      <Animated.Text entering={FadeIn.duration(400)} style={[styles.title, { color: colors.textMuted }]}>
        YOUR SEASON
      </Animated.Text>
      <Animated.Text entering={FadeIn.delay(100).duration(400)} style={[styles.subtitle, { color: colors.textMuted }]}>
        Shapes what the app suggests
      </Animated.Text>
      <View style={styles.grid}>
        {SEASONS.map((season, index) => {
          const isActive = currentSeason === season.id;
          return (
            <AnimatedTouchable
              key={season.id}
              entering={FadeInDown.delay(150 + index * 80).duration(400).springify().damping(16)}
              style={[
                styles.seasonCard,
                { borderColor: isActive ? season.color : colors.border },
                isActive && { backgroundColor: season.color + '10' },
              ]}
              onPress={() => handleSelect(season.id)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconWrap, { backgroundColor: season.color + '15' }]}>
                <MaterialCommunityIcons name={season.icon} size={20} color={season.color} />
              </View>
              <Text style={[styles.seasonLabel, { color: isActive ? season.color : colors.text }]}>
                {season.label}
              </Text>
              <Text style={[styles.seasonDesc, { color: colors.textMuted }]} numberOfLines={2}>
                {season.description}
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
    paddingVertical: SPACING.sm,
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginBottom: SPACING.md,
    opacity: 0.7,
  },
  grid: {
    gap: SPACING.sm,
  },
  seasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    gap: SPACING.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seasonLabel: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    minWidth: 100,
  },
  seasonDesc: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 16,
  },

  // Compact
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    gap: 8,
  },
  compactLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  compactSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    opacity: 0.6,
    flex: 1,
  },
});
