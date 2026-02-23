// screens/DatePlansScreen.js — "Date Plans"
// Editorial mood-board layout for browsing date ideas.
// Horizontal mood pills → featured hero card → two-column grid.

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { getAllDates, filterDates, getDimensionMeta } from '../utils/contentLoader';
import { SPACING, BORDER_RADIUS } from '../utils/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_GAP = 14;
const GRID_COL = (SCREEN_W - SPACING.screen * 2 - GRID_GAP) / 2;

const FONTS = {
  serif: Platform.select({
    ios: 'DMSerifDisplay-Regular',
    android: 'DMSerifDisplay_400Regular',
    default: 'serif',
  }),
  serifAccent: Platform.select({
    ios: 'Playfair Display',
    android: 'PlayfairDisplay_300Light',
    default: 'serif',
  }),
  body: Platform.select({
    ios: 'Inter',
    android: 'Inter_400Regular',
    default: 'sans-serif',
  }),
  bodyMedium: Platform.select({
    ios: 'Inter-Medium',
    android: 'Inter_500Medium',
    default: 'sans-serif',
  }),
  bodyBold: Platform.select({
    ios: 'Inter-SemiBold',
    android: 'Inter_600SemiBold',
    default: 'sans-serif',
  }),
};

const DIMS = getDimensionMeta();

// Legacy export for any remaining callers
export { DIMS as DATE_CATEGORIES };

// ── Small grid card ──────────────────────────────────────────
function DateGridCard({ date, colors, isDark, onPress }) {
  const heatRaw = DIMS.heat.find((h) => h.level === date.heat) || DIMS.heat[0];
  const loadRaw = DIMS.load.find((l) => l.level === date.load) || DIMS.load[1];
  const heatMeta = { ...heatRaw, color: isDark ? heatRaw.darkColor : heatRaw.color };
  const loadMeta = { ...loadRaw, color: isDark ? loadRaw.darkColor : loadRaw.color };
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const cardBg = isDark ? '#0C0810' : '#FAF0EE';
  const cardBorder = isDark ? 'rgba(196,86,122,0.06)' : 'rgba(176,68,102,0.10)';

  return (
    <Animated.View style={[styles.gridCard, animStyle]}>
      <TouchableOpacity
        onPressIn={() => { scale.value = withSpring(0.96); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        onPress={onPress}
        activeOpacity={1}
        style={[
          styles.gridCardInner,
          {
            backgroundColor: cardBg,
            borderColor: cardBorder,
          },
        ]}
      >
        {/* Accent stripe */}
        <View style={[styles.gridStripe, { backgroundColor: heatMeta.color + '55' }]} />

        <View style={styles.gridCardBody}>
          {/* Badges */}
          <View style={styles.gridBadgeRow}>
            <View style={[styles.gridBadge, { backgroundColor: heatMeta.color + '1A' }]}>
              <Text style={[styles.gridBadgeText, { color: heatMeta.color }]}>
                {heatMeta.icon}
              </Text>
            </View>
            <View style={[styles.gridBadge, { backgroundColor: loadMeta.color + '1A' }]}>
              <Text style={[styles.gridBadgeText, { color: loadMeta.color }]}>
                {loadMeta.icon}
              </Text>
            </View>
          </View>

          {/* Title */}
          <Text
            style={[styles.gridTitle, { color: colors.text }]}
            numberOfLines={3}
          >
            {date.title}
          </Text>

          {/* Meta row */}
          <View style={styles.gridMeta}>
            {date.minutes ? (
              <Text style={[styles.gridMetaText, { color: colors.textMuted }]}>
                {date.minutes}m
              </Text>
            ) : null}
            {date.location ? (
              <Text style={[styles.gridMetaText, { color: colors.textMuted }]}>
                {date.location === 'home' ? '🏠' : '📍'}
              </Text>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Hero featured card ───────────────────────────────────────
function FeaturedCard({ date, colors, isDark, onPress }) {
  if (!date) return null;
  const heatRaw = DIMS.heat.find((h) => h.level === date.heat) || DIMS.heat[0];
  const loadRaw = DIMS.load.find((l) => l.level === date.load) || DIMS.load[1];
  const heatMeta = { ...heatRaw, color: isDark ? heatRaw.darkColor : heatRaw.color };
  const loadMeta = { ...loadRaw, color: isDark ? loadRaw.darkColor : loadRaw.color };
  const desc = Array.isArray(date.steps) && date.steps[0] ? date.steps[0] : '';
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const heroBg = isDark ? '#0C0810' : '#FBF2EF';
  const heroBorder = isDark ? 'rgba(196,86,122,0.08)' : 'rgba(176,68,102,0.12)';

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        onPressIn={() => { scale.value = withSpring(0.97); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        onPress={onPress}
        activeOpacity={1}
        style={[
          styles.heroCard,
          {
            backgroundColor: heroBg,
            borderColor: heroBorder,
          },
        ]}
      >
        <LinearGradient
          colors={isDark ? [heatMeta.color + '18', 'transparent'] : [heatMeta.color + '12', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.heroInner}>
          {/* Badges */}
          <View style={styles.heroBadgeRow}>
            <View style={[styles.heroBadge, { backgroundColor: heatMeta.color + '20' }]}>
              <Text style={[styles.heroBadgeText, { color: heatMeta.color }]}>
                {heatMeta.icon} {heatMeta.label}
              </Text>
            </View>
            <View style={[styles.heroBadge, { backgroundColor: loadMeta.color + '20' }]}>
              <Text style={[styles.heroBadgeText, { color: loadMeta.color }]}>
                {loadMeta.icon} {loadMeta.label}
              </Text>
            </View>
            {date._matchLabel ? (
              <Text style={[styles.heroMatchLabel, { color: '#C9A84C' }]}>
                {date._matchLabel}
              </Text>
            ) : null}
          </View>

          {/* Title */}
          <Text style={[styles.heroTitle, { color: colors.text }]} numberOfLines={2}>
            {date.title}
          </Text>

          {/* Description */}
          {desc ? (
            <Text
              style={[styles.heroDesc, { color: colors.textMuted }]}
              numberOfLines={2}
            >
              {desc}
            </Text>
          ) : null}

          {/* Footer */}
          <View style={styles.heroFooter}>
            <View style={styles.heroMetaRow}>
              {date.minutes ? (
                <View style={styles.heroMetaItem}>
                  <MaterialCommunityIcons name="clock-outline" size={13} color={colors.textMuted} />
                  <Text style={[styles.heroMetaText, { color: colors.textMuted }]}>
                    {date.minutes} min
                  </Text>
                </View>
              ) : null}
              {date.location ? (
                <View style={styles.heroMetaItem}>
                  <MaterialCommunityIcons
                    name={date.location === 'home' ? 'home-variant-outline' : 'map-marker-outline'}
                    size={13}
                    color={colors.textMuted}
                  />
                  <Text style={[styles.heroMetaText, { color: colors.textMuted }]}>
                    {date.location === 'home' ? 'Home' : 'Out'}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={[styles.heroAction, { backgroundColor: colors.primary + '18' }]}>
              <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primary} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Screen — Editorial mood-board layout
// ═══════════════════════════════════════════════════════════════
export default function DatePlansScreen({ navigation }) {
  const { colors, gradients, isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();

  // ── Browse state ──
  const [allDates, setAllDates] = useState([]);
  const [selectedHeat, setSelectedHeat] = useState(null);
  const [selectedLoad, setSelectedLoad] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState(null);

  useFocusEffect(
    useCallback(() => {
      setAllDates(getAllDates());
    }, []),
  );

  // ── Derived data ──
  const browseFilters = useMemo(() => {
    const f = {};
    if (selectedHeat) f.heat = selectedHeat;
    if (selectedLoad) f.load = selectedLoad;
    if (selectedStyle) f.style = selectedStyle;
    return f;
  }, [selectedHeat, selectedLoad, selectedStyle]);

  const filteredDates = useMemo(
    () => filterDates(allDates, browseFilters),
    [allDates, browseFilters],
  );

  const hasFilters = selectedHeat || selectedLoad || selectedStyle;

  // Featured date = first match (or random free one when not premium)
  const featuredDate = useMemo(() => {
    if (!filteredDates.length) return null;
    if (!isPremium) {
      const free = filteredDates.filter((d) => !d?.isPremium);
      return free.length ? free[0] : filteredDates[0];
    }
    return filteredDates[0];
  }, [isPremium, filteredDates]);

  const gridDates = useMemo(() => {
    if (!filteredDates.length || !featuredDate) return [];
    return filteredDates.filter((d) => d !== featuredDate);
  }, [filteredDates, featuredDate]);

  // ── All filter chips: combine heat, load, style into a single row ──
  const allChips = useMemo(() => {
    const chips = [];
    DIMS.heat.forEach((h) => {
      chips.push({
        key: `heat-${h.level}`,
        dim: 'heat',
        value: h.level,
        label: h.label,
        icon: h.icon,
        color: isDark ? h.darkColor : h.color,
        active: selectedHeat === h.level,
        locked: !isPremium && h.level >= 4,
      });
    });
    DIMS.load.forEach((l) => {
      chips.push({
        key: `load-${l.level}`,
        dim: 'load',
        value: l.level,
        label: l.label,
        icon: l.icon,
        color: isDark ? l.darkColor : l.color,
        active: selectedLoad === l.level,
        locked: false,
      });
    });
    DIMS.style.forEach((s) => {
      chips.push({
        key: `style-${s.id}`,
        dim: 'style',
        value: s.id,
        label: s.label,
        icon: s.icon,
        color: isDark ? s.darkColor : s.color,
        active: selectedStyle === s.id,
        locked: false,
      });
    });
    return chips;
  }, [selectedHeat, selectedLoad, selectedStyle, isPremium, isDark]);

  // ── Callbacks ──
  const handleChipPress = useCallback(
    async (chip) => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (chip.locked) {
        showPaywall?.('HEAT_LEVEL');
        return;
      }
      if (chip.dim === 'heat') setSelectedHeat((p) => (p === chip.value ? null : chip.value));
      else if (chip.dim === 'load') setSelectedLoad((p) => (p === chip.value ? null : chip.value));
      else setSelectedStyle((p) => (p === chip.value ? null : chip.value));
    },
    [showPaywall],
  );

  const clearBrowseFilters = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedHeat(null);
    setSelectedLoad(null);
    setSelectedStyle(null);
  }, []);

  const openDate = useCallback(
    (date) => {
      if (!isPremium && date?.isPremium) {
        showPaywall?.('DATE_PLANS_BROWSE');
        return;
      }
      navigation.navigate('DateNightDetail', { date });
    },
    [isPremium, showPaywall, navigation],
  );

  const handleRandom = useCallback(async () => {
    if (!filteredDates.length) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    openDate(filteredDates[Math.floor(Math.random() * filteredDates.length)]);
  }, [filteredDates, openDate]);

  // ── Render ──
  const bg = gradients?.screenBackground || [colors.background, colors.background];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={bg} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ─── Header ─── */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.eyebrow, { color: colors.primary }]}>
                  DISCOVER
                </Text>
                <Text style={[styles.title, { color: colors.text }]}>
                  Date Night
                </Text>
              </View>
              {/* Surprise Me floating button */}
              {filteredDates.length > 0 && (
                <TouchableOpacity onPress={handleRandom} activeOpacity={0.85}>
                  <LinearGradient
                    colors={[colors.primary, colors.primaryMuted || colors.primary + 'CC']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.surpriseBtn}
                  >
                    <MaterialCommunityIcons name="shuffle-variant" size={16} color="#fff" />
                    <Text style={styles.surpriseBtnText}>Surprise</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              How do you want to feel together?
            </Text>
          </View>

          {/* ─── Filter chips (single horizontal row) ─── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {allChips.map((chip) => (
              <TouchableOpacity
                key={chip.key}
                style={[
                  styles.chip,
                  {
                    backgroundColor: chip.active
                      ? chip.color + '20'
                      : (colors.surfaceGlass || colors.surface),
                    borderColor: chip.active ? chip.color + '55' : colors.border,
                    opacity: chip.locked ? 0.45 : 1,
                  },
                ]}
                onPress={() => handleChipPress(chip)}
                activeOpacity={0.8}
              >
                <Text style={styles.chipIcon}>{chip.icon}</Text>
                <Text
                  style={[
                    styles.chipLabel,
                    { color: chip.active ? chip.color : colors.textSecondary || colors.textMuted },
                  ]}
                >
                  {chip.label}
                </Text>
                {chip.locked && (
                  <MaterialCommunityIcons name="lock" size={10} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            ))}
            {hasFilters && (
              <TouchableOpacity
                style={[styles.chip, styles.chipClear, { borderColor: colors.border }]}
                onPress={clearBrowseFilters}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="close" size={13} color={colors.textMuted} />
                <Text style={[styles.chipLabel, { color: colors.textMuted }]}>Clear</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* ─── Results count ─── */}
          <View style={styles.countsRow}>
            <Text style={[styles.countsText, { color: colors.textMuted }]}>
              {filteredDates.length} {filteredDates.length === 1 ? 'idea' : 'ideas'}
              {hasFilters ? ' matched' : ' to explore'}
            </Text>
          </View>

          {/* ─── Empty state ─── */}
          {!filteredDates.length ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons
                name="heart-off-outline"
                size={44}
                color={colors.textMuted}
                style={{ opacity: 0.4, marginBottom: 14 }}
              />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No matches
              </Text>
              <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
                Try a different combination of moods
              </Text>
            </View>
          ) : (
            <>
              {/* ─── Featured hero card ─── */}
              {featuredDate && (
                <FeaturedCard
                  date={featuredDate}
                  colors={colors}
                  isDark={isDark}
                  onPress={() => openDate(featuredDate)}
                />
              )}

              {/* ─── Paywall gate for non-premium ─── */}
              {!isPremium && (
                <TouchableOpacity
                  style={[
                    styles.unlockBanner,
                    {
                      backgroundColor: colors.primary + '0D',
                      borderColor: colors.primary + '30',
                    },
                  ]}
                  onPress={() => showPaywall?.('DATE_PLANS_BROWSE')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.unlockIconCircle, { backgroundColor: colors.primary + '18' }]}>
                    <MaterialCommunityIcons
                      name="lock-open-variant-outline"
                      size={18}
                      color={colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.unlockTitle, { color: colors.text }]}>
                      Unlock all {filteredDates.length} dates
                    </Text>
                    <Text style={[styles.unlockSub, { color: colors.textMuted }]}>
                      Premium members get unlimited access
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={colors.primary} />
                </TouchableOpacity>
              )}

              {/* ─── Two-column grid ─── */}
              {(isPremium ? gridDates : []).length > 0 && (
                <View style={styles.grid}>
                  {gridDates.map((d, i) => (
                    <DateGridCard
                      key={d.id || i}
                      date={d}
                      colors={colors}
                      isDark={isDark}
                      onPress={() => openDate(d)}
                    />
                  ))}
                </View>
              )}
            </>
          )}

          <View style={{ height: 140 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// Styles — Editorial mood-board
// ═══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.screen },

  // ── Header
  header: { paddingTop: SPACING.lg, marginBottom: 4 },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  eyebrow: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 38,
    fontWeight: '400',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: FONTS.serifAccent,
    fontSize: 15,
    fontStyle: 'italic',
    opacity: 0.65,
    marginBottom: 2,
  },
  surpriseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: BORDER_RADIUS.full,
    gap: 6,
    marginBottom: 6,
  },
  surpriseBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: '#fff',
    letterSpacing: 0.3,
  },

  // ── Filter chips
  chipRow: {
    paddingVertical: 10,
    gap: 7,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    gap: 3,
  },
  chipClear: {
    backgroundColor: 'transparent',
    paddingHorizontal: 7,
  },
  chipIcon: { fontSize: 7 },
  chipLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 8,
    letterSpacing: 0.1,
  },

  // ── Counts
  countsRow: {
    marginBottom: 18,
  },
  countsText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    letterSpacing: 0.2,
  },

  // ── Featured hero card
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#060410',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
      },
      android: { elevation: 8 },
    }),
  },
  heroInner: {
    padding: 22,
    gap: 14,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  heroBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  heroBadgeText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  heroMatchLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  heroTitle: {
    fontFamily: FONTS.serif,
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  heroDesc: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 22,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroMetaText: {
    fontFamily: FONTS.body,
    fontSize: 12,
  },
  heroAction: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Two-column grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    marginTop: 4,
  },
  gridCard: {
    width: GRID_COL,
    marginBottom: 2,
  },
  gridCardInner: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#060410',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
    }),
  },
  gridStripe: {
    height: 3,
  },
  gridCardBody: {
    padding: 14,
    gap: 8,
  },
  gridBadgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  gridBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridBadgeText: {
    fontSize: 12,
  },
  gridTitle: {
    fontFamily: FONTS.serif,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21,
  },
  gridMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  gridMetaText: {
    fontFamily: FONTS.body,
    fontSize: 11,
  },

  // ── Unlock banner
  unlockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    marginBottom: 22,
  },
  unlockIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockTitle: { fontFamily: FONTS.bodyBold, fontSize: 15 },
  unlockSub: { fontFamily: FONTS.body, fontSize: 12, marginTop: 2 },

  // ── Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 6,
  },
  emptyTitle: {
    fontFamily: FONTS.serif,
    fontSize: 22,
    fontWeight: '300',
  },
  emptyBody: {
    fontFamily: FONTS.serifAccent,
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
