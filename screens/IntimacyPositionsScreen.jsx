/**
 * BETWEEN US - INTIMACY POSITIONS ENGINE
 * Matches HomeScreen.js — Crisp solid widgets, native typography, heavy shadows.
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

// Context & Services
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useAuth } from '../context/AuthContext';
import { getPartnerDisplayName } from '../utils/profileNames';

// Utilities & Components
import { SPACING } from '../utils/theme';
import Icon from '../components/Icon';
import IntimacyPositionCard from '../components/IntimacyPositionCard';
import positionsData from '../content/intimacy-positions.json';
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';
import EditorialScreenScaffold from '../components/EditorialScreenScaffold';
import {
  getIntimacyFavorites,
  getIntimacyTried,
  rateIntimacyTried,
  toggleIntimacyFavorite,
  toggleIntimacyTried,
} from '../utils/intimacyFavorites';

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });
const systemFont = Platform.select({ ios: "System", android: "Roboto" });

// Calculate weeks since intimacy positions launch
const LAUNCH_DATE = new Date('2026-04-18');
function getCurrentWeek() {
  const now = new Date();
  return Math.floor((now - LAUNCH_DATE) / (7 * 24 * 60 * 60 * 1000));
}

export default function IntimacyPositionsScreen() {
  const { colors, isDark } = useTheme();
  const { isPremiumEffective, showPaywall } = useEntitlements();
  const { userProfile } = useAuth();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const isCompact = width < 390;
  
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [favorites, setFavorites] = useState({});
  const [triedPositions, setTriedPositions] = useState({});
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [triedBusy, setTriedBusy] = useState(false);

  // ─── THEME MAP ───
  const t = useMemo(() => ({
    background: colors.background,
    surface: colors.surface || (isDark ? '#1C1C1E' : '#FFFFFF'), 
    surfaceSecondary: colors.surface2 || (isDark ? '#2C2C2E' : '#F2F2F7'),
    primary: colors.primary || '#D2121A', // Sexy Red
    accent: colors.accent || '#D4AA7E',
    text: colors.text,
    subtext: colors.textMuted || (isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)'),
    border: colors.border || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
    borderGlass: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
  }), [colors, isDark]);

  const currentWeek = getCurrentWeek();
  const partnerLabel = getPartnerDisplayName(userProfile, null, 'your partner');

  const availablePositions = useMemo(() => {
    return positionsData.items.filter(
      (p) => p.id.startsWith('ip') && !p.id.includes('-q') && (p.releaseWeek ?? 0) <= currentWeek
    );
  }, [currentWeek]);

  const position = availablePositions[selectedIndex];
  const favoritePositions = useMemo(
    () => availablePositions.filter((item) => favorites[item.id]),
    [availablePositions, favorites]
  );

  // ─── ANIMATIONS ───
  const headerAnim = useRef(new Animated.Value(0)).current;
  const pickerAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(pickerAnim, { toValue: 1, friction: 9, tension: 60, useNativeDriver: true }),
      Animated.spring(cardAnim, { toValue: 1, friction: 9, tension: 60, useNativeDriver: true }),
    ]).start();
  }, [headerAnim, pickerAnim, cardAnim]);

  useEffect(() => {
    let active = true;

    Promise.all([getIntimacyFavorites(), getIntimacyTried()]).then(([savedFavorites, savedTried]) => {
      if (active) {
        setFavorites(savedFavorites);
        setTriedPositions(savedTried);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (selectedIndex >= availablePositions.length) {
      setSelectedIndex(0);
    }
  }, [availablePositions.length, selectedIndex]);

  // ─── HANDLERS ───
  const handleBack = useCallback(() => {
    impact(ImpactFeedbackStyle.Light);
    navigation.goBack();
  }, [navigation]);

  const handlePaywall = useCallback(() => {
    impact(ImpactFeedbackStyle.Medium);
    showPaywall?.('HEAT_LEVELS_4_5');
  }, [showPaywall]);

  const handleToggleFavorite = useCallback(async () => {
    if (!position || favoriteBusy) return;

    setFavoriteBusy(true);
    try {
      impact(ImpactFeedbackStyle.Light);
      const next = await toggleIntimacyFavorite(position, {
        currentlyFavorite: !!favorites[position.id],
      });
      setFavorites(next.favorites);
    } finally {
      setFavoriteBusy(false);
    }
  }, [favoriteBusy, favorites, position]);

  const handleToggleTried = useCallback(async () => {
    if (!position || triedBusy) return;

    setTriedBusy(true);
    try {
      impact(ImpactFeedbackStyle.Light);
      const next = await toggleIntimacyTried(position, {
        currentlyTried: !!triedPositions[position.id],
      });
      setTriedPositions(next.tried);
    } finally {
      setTriedBusy(false);
    }
  }, [position, triedBusy, triedPositions]);

  const handleRateTried = useCallback(async (rating) => {
    if (!position) return;

    selection();
    const next = await rateIntimacyTried(position, rating);
    setTriedPositions(next.tried);
  }, [position]);

  // ════════════════════════════════════
  //  LOCKED STATE RENDER
  // ════════════════════════════════════
  if (!isPremiumEffective) {
    return (
      <EditorialScreenScaffold
        navigation={navigation}
        headerTitle="Private Spark"
        headerSubtitle="INTIMACY"
        scroll={false}
        onBack={handleBack}
        bodyStyle={{ paddingHorizontal: 0 }} // Remove scaffold padding for edge-to-edge
      >
          <View style={styles.lockedWrap}>
            <Animated.View style={{
              opacity: cardAnim,
              transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
            }}>
              <View style={styles.cardContainer}>
                <View style={[styles.editorialCard, styles.editorialCardColumn, { backgroundColor: t.surface, borderColor: t.borderGlass }, !isDark && styles.lightShadow]}>
                  <View style={styles.cardContent}>
                    <Text style={[styles.cardTag, { color: t.subtext }]}>SHARED PREMIUM</Text>
                    <Text style={[styles.cardTitle, { color: t.text }]}>More Spark Together</Text>
                    <Text style={[styles.cardEmail, { color: t.subtext }]}>A closer space for you and {partnerLabel}.</Text>
                  </View>

                  <View style={[styles.answerBubble, { backgroundColor: t.surfaceSecondary, borderColor: t.border }] }>
                    <Text style={[styles.answerText, { color: t.text }]}>Explore illustrated intimacy ideas designed for closeness, play, and desire. New releases arrive every week.</Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.cta, { backgroundColor: t.text }]}
                    onPress={handlePaywall}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.ctaLabel, { color: isDark ? '#000000' : '#FFFFFF' }]}>Discover Premium</Text>
                    <Icon name="arrow-forward-outline" size={20} color={isDark ? '#000000' : '#FFFFFF'} />
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          </View>
      </EditorialScreenScaffold>
    );
  }

  // ════════════════════════════════════
  //  UNLOCKED STATE RENDER
  // ════════════════════════════════════
  return (
    <EditorialScreenScaffold
      navigation={navigation}
      headerTitle="Intimacy"
      headerSubtitle="WEEKLY RELEASES"
      scroll={false}
      onBack={handleBack}
      bodyStyle={{ paddingHorizontal: 0 }} // Remove scaffold padding for edge-to-edge
    >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >

          <Animated.View
            style={{
              opacity: pickerAnim,
              transform: [{ translateY: pickerAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
            }}
          >
            <View style={styles.cardContainer}>
              <View style={[styles.editorialCard, styles.editorialCardColumn, styles.positionCardShell, { backgroundColor: t.surface, borderColor: t.borderGlass }, !isDark && styles.lightShadow]}>
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTag, { color: t.subtext }]}>ACTIVE COLLECTION</Text>
                  <Text style={[styles.cardTitle, { color: t.text }]}>Curated positions for deeper connection</Text>
                  <Text style={[styles.cardEmail, { color: t.subtext }]}>A closer space for you and {partnerLabel}.</Text>
                </View>

                {!!favoritePositions.length && (
                  <View style={styles.favoritesBlock}>
                    <Text style={[styles.favoritesLabel, { color: t.subtext }]}>YOUR FAVORITES</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.favoriteRow}
                      style={styles.favoriteScroll}
                    >
                      {favoritePositions.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          activeOpacity={0.75}
                          onPress={() => {
                            const nextIndex = availablePositions.findIndex((candidate) => candidate.id === item.id);
                            if (nextIndex >= 0) {
                              selection();
                              setSelectedIndex(nextIndex);
                            }
                          }}
                          style={[styles.favoritePill, { backgroundColor: t.surfaceSecondary, borderColor: t.border }]}
                        >
                          <Icon name="heart-outline" size={14} color={t.primary} />
                          <Text style={[styles.favoritePillText, { color: t.primary }]}>{item.title}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pickerRow}
                  style={styles.pickerScroll}
                >
                  {availablePositions.map((p, i) => {
                    const active = i === selectedIndex;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => {
                          selection();
                          setSelectedIndex(i);
                        }}
                        activeOpacity={0.7}
                        style={[
                          styles.pickerPill,
                          {
                            backgroundColor: active ? t.primary : t.surfaceSecondary,
                            borderColor: active ? t.primary : t.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.pickerText,
                            { color: active ? '#FFFFFF' : t.primary },
                          ]}
                          numberOfLines={2}
                        >
                          {p.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {position && (
                  <IntimacyPositionCard
                    key={position.id}
                    position={position}
                    t={t}
                    isDark={isDark}
                    isFavorite={!!favorites[position.id]}
                    onToggleFavorite={handleToggleFavorite}
                    favoriteBusy={favoriteBusy}
                    isTried={!!triedPositions[position.id]}
                    onToggleTried={handleToggleTried}
                    triedBusy={triedBusy}
                    rating={triedPositions[position.id]?.rating || null}
                    onRate={handleRateTried}
                    compact={isCompact}
                  />
                )}
              </View>
            </View>
          </Animated.View>

        </ScrollView>
    </EditorialScreenScaffold>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 160,
  },

  cardContainer: {
    marginVertical: SPACING.md,
    marginHorizontal: -SPACING.screen, // Extend to screen edges
  },
  editorialCard: {
    borderRadius: 0, // Remove border radius for edge-to-edge
    paddingHorizontal: SPACING.screen, // Add horizontal padding for content
    paddingVertical: SPACING.lg, 
    flexDirection: 'column',
    alignItems: 'stretch',
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderLeftWidth: 3, // Double border on left
    borderRightWidth: 3, // Double border on right
    position: 'relative',
    overflow: 'hidden',
  },
  editorialCardColumn: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  positionCardShell: {
    paddingBottom: SPACING.lg, 
  },
  lightShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  cardContent: {
    width: '100%',
    marginBottom: SPACING.xl, // Expanded breathing room above the picker
  },
  cardTag: {
    fontFamily: systemFont,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 8,
    paddingLeft: SPACING.md, // Extra padding on left
    paddingRight: SPACING.sm,
  },
  cardTitle: {
    fontFamily: systemFont,
    fontWeight: '800',
    fontSize: 22, 
    lineHeight: 28,
    letterSpacing: -0.4,
    marginBottom: 6,
    paddingLeft: SPACING.md, // Extra padding on left
    paddingRight: SPACING.sm,
  },
  cardEmail: {
    fontFamily: systemFont,
    fontWeight: '500',
    fontSize: 15,
    paddingLeft: SPACING.md, // Extra padding on left
    paddingRight: SPACING.sm,
  },
  favoritesBlock: {
    width: '100%',
    marginBottom: SPACING.lg,
  },
  favoritesLabel: {
    fontFamily: systemFont,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  favoriteScroll: {
    flexGrow: 0,
  },
  favoriteRow: {
    gap: 8, 
  },
  favoritePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderColor: 'rgba(210, 18, 26, 0.3)',
    backgroundColor: 'rgba(210, 18, 26, 0.08)',
  },
  favoritePillText: {
    fontFamily: systemFont,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: -0.2,
  },
  // ── Picker ──
  pickerScroll: {
    flexGrow: 0,
    marginBottom: SPACING.xl,
  },
  pickerRow: {
    gap: 10,
  },
  pickerPill: {
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerText: {
    fontFamily: systemFont,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 18,
    textAlign: 'center',
  },
  // ── Hero Card (Locked State) ──
  lockedWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 60,
  },
  answerBubble: {
    borderRadius: 20,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  answerText: {
    fontFamily: systemFont,
    fontSize: 17,
    lineHeight: 24, 
    fontWeight: '400',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60, 
    borderRadius: 100,
    gap: 10,
  },
  ctaLabel: {
    fontFamily: systemFont,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
});
