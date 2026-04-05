// components/SeasonSelector.jsx
// "Your Season" - Not tracking health, tracking context.
// Shapes prompt ordering, date suggestions, tone.

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import Icon from './Icon';
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import { SPACING } from '../utils/theme';
import { RelationshipSeasons, SEASONS } from '../services/PolishEngine';
import StorageRouter from '../services/storage/StorageRouter';

// ------------------------------------------------------------------
// INLINE COMPONENT: Animated Season Option
// ------------------------------------------------------------------
const SeasonOption = ({ season, isSelected, isLast, onPress, t }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: isSelected ? 1 : 0,
        duration: 200,
        useNativeDriver: false, // Required for color interpolation
      }),
      Animated.spring(scaleAnim, {
        toValue: isSelected ? 0.98 : 1,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      })
    ]).start();
  }, [isSelected, fadeAnim, scaleAnim]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: isSelected ? 0.98 : 1,
      friction: 8,
      tension: 60,
      useNativeDriver: true,
    }).start();
  };

  const iconBgColor = fadeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [t.surfaceSecondary, season.color + '15']
  });

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => onPress(season.id)}
        style={styles.listOptionRow}
      >
        <Animated.View style={[styles.iconWrap, { backgroundColor: iconBgColor }]}>
          <Icon 
            name={season.icon} 
            size={20} 
            color={isSelected ? season.color : t.subtext} 
          />
        </Animated.View>
        
        <View style={styles.optionContent}>
          <Text style={[styles.optionName, { color: isSelected ? season.color : t.text }]}>
            {season.label}
          </Text>
          <Text style={[styles.optionDesc, { color: t.subtext }]} numberOfLines={1}>
            {season.description}
          </Text>
        </View>

        {isSelected && (
          <Icon name="checkmark-outline" size={24} color={season.color} />
        )}
      </TouchableOpacity>
      {!isLast && <View style={[styles.dividerIndent, { backgroundColor: t.border }]} />}
    </Animated.View>
  );
};

// ------------------------------------------------------------------
// MAIN COMPONENT
// ------------------------------------------------------------------
export default function SeasonSelector({ compact = false, onSeasonChange }) {
  const { colors, isDark } = useTheme();
  const [currentSeason, setCurrentSeason] = useState(null);

  // STRICT Midnight Intimacy x Apple Editorial Theme Map
  const t = useMemo(() => ({
    surface: isDark ? '#131016' : '#FFFFFF',
    surfaceSecondary: isDark ? '#1C1520' : '#F2F2F7',
    primary: colors.primary || '#D2121A',
    text: colors.text,
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  useEffect(() => {
    (async () => {
      const s = await RelationshipSeasons.get();
      if (s) setCurrentSeason(s.id);
    })();
  }, []);

  const handleSelect = useCallback(async (seasonId) => {
    selection();
    await RelationshipSeasons.set(seasonId);
    StorageRouter.updateCloudProfilePreferences({
      relationshipSeason: { id: seasonId, setAt: Date.now() },
    }).catch(() => {});
    setCurrentSeason(seasonId);
    onSeasonChange?.(seasonId);
  }, [onSeasonChange]);

  // Compact View (Used outside of settings/onboarding)
  if (compact) {
    const season = SEASONS.find(s => s.id === currentSeason);
    if (!season) return null;

    return (
      <TouchableOpacity 
        style={[styles.compactRow, { backgroundColor: t.surfaceSecondary, borderColor: t.border }]}
        onPress={() => impact(ImpactFeedbackStyle.Light)}
        activeOpacity={0.7}
      >
        <Icon name={season.icon} size={16} color={season.color} />
        <Text style={[styles.compactLabel, { color: t.text }]}>
          {season.label}
        </Text>
      </TouchableOpacity>
    );
  }

  // Full View (Apple Settings Widget Style)
  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: t.subtext }]}>
        YOUR SEASON
      </Text>
      
      <View style={[styles.widgetCard, { backgroundColor: t.surface, borderColor: t.border }]}>
        {SEASONS.map((season, index) => {
          const isActive = currentSeason === season.id;
          const isLast = index === SEASONS.length - 1;
          
          return (
            <SeasonOption
              key={season.id}
              season={season}
              isSelected={isActive}
              isLast={isLast}
              onPress={handleSelect}
              t={t}
            />
          );
        })}
      </View>

      <Text style={[styles.sectionFooter, { color: t.subtext }]}>
        This gently shapes the tone of the app and the prompts you receive.
      </Text>
    </View>
  );
}

// ------------------------------------------------------------------
// STYLES - Midnight Intimacy Editorial 
// ------------------------------------------------------------------
const systemFont = Platform.select({ ios: "System", android: "Roboto" });

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  sectionTitle: {
    fontFamily: systemFont,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
    paddingLeft: SPACING.xs,
  },
  sectionFooter: {
    fontFamily: systemFont,
    fontSize: 13,
    fontWeight: '500',
    marginTop: SPACING.sm,
    paddingLeft: SPACING.xs,
    paddingRight: SPACING.xl,
    lineHeight: 18,
  },

  // ── Apple Widget Card ──
  widgetCard: {
    borderRadius: 24, // Deep Apple squircle
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12 },
      android: { elevation: 2 },
    }),
  },

  // ── List Items ──
  listOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: 16,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8, // Apple standard squircle icon wrapper
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
    justifyContent: 'center',
  },
  optionName: {
    fontFamily: systemFont,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  optionDesc: {
    fontFamily: systemFont,
    fontSize: 14,
    fontWeight: '400',
  },
  dividerIndent: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 64, // Indent past the icon
  },

  // ── Compact View ──
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    alignSelf: 'flex-start',
  },
  compactLabel: {
    fontFamily: systemFont,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
