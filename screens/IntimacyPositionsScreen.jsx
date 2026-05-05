/**
 * BETWEEN US - SEX POSITIONS ENGINE
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';

// Context & Services
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useAuth } from '../context/AuthContext';
import { getPartnerDisplayName } from '../utils/profileNames';
import contentAccessService from '../services/ContentAccessService';
import { CONTENT_TYPES } from '../services/WeeklyContentSetService';
import * as PreferenceEngine from '../services/PreferenceEngine';

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
import { resolveWeeklyContentAnchorDate } from '../utils/contentSchedule';
import { getIntimacyMatchState } from '../utils/coupleMatches';
import { buildStableWeeklySet } from '../utils/stableWeeklyContent';
import { resolveWeeklyDeckItems } from '../utils/weeklyDeckVisibility';

const systemFont = Platform.select({ ios: "System", android: "Roboto" });
let lastSelectedPositionId = null;

export function resolveSelectedPositionIndex(availablePositions, {
  selectedPositionId = null,
  selectedIndex = 0,
} = {}) {
  if (!availablePositions?.length) return 0;

  if (selectedPositionId) {
    const indexById = availablePositions.findIndex((item) => item.id === selectedPositionId);
    if (indexById >= 0) return indexById;
  }

  return selectedIndex < availablePositions.length ? selectedIndex : 0;
}

export function resolveAvailablePositions(weeklyPositionSet) {
  return resolveWeeklyDeckItems(weeklyPositionSet);
}

export default function IntimacyPositionsScreen() {
  const { colors, isDark } = useTheme();
  const { isPremiumEffective, premiumStartedAt, showPaywall } = useEntitlements();
  const { userProfile } = useAuth();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const isCompact = width < 390;
  
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedPositionId, setSelectedPositionId] = useState(lastSelectedPositionId);
  const [favorites, setFavorites] = useState({});
  const [positionMatches, setPositionMatches] = useState({});
  const [triedPositions, setTriedPositions] = useState({});
  const [weeklyPositionSet, setWeeklyPositionSet] = useState(null);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [triedBusy, setTriedBusy] = useState(false);
  const [ratingBusy, setRatingBusy] = useState(false);
  const favoriteBusyRef = useRef(false);
  const triedBusyRef = useRef(false);
  const ratingBusyRef = useRef(false);
  const selectedPositionIdRef = useRef(null);
  const selectedIndexRef = useRef(0);
  const availablePositionsRef = useRef([]);

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

  const partnerLabel = getPartnerDisplayName(userProfile, null, 'your partner');

  const myLabel =
    userProfile?.myName
    || userProfile?.displayName
    || userProfile?.name
    || 'you';

  const intimacyForLine = `For ${myLabel} and ${partnerLabel}.`;

  const positionCatalog = useMemo(
    () => positionsData.items.filter((p) =>
      p.id.startsWith('ip') &&
      !p.id.includes('-q')
    ),
    []
  );
  const availablePositions = useMemo(
    () => resolveAvailablePositions(weeklyPositionSet),
    [weeklyPositionSet]
  );

  const contentAnchorDate = useMemo(() => resolveWeeklyContentAnchorDate({
    isPremium: isPremiumEffective,
    premiumStartedAt,
    userProfile,
  }), [isPremiumEffective, premiumStartedAt, userProfile]);

  useEffect(() => {
    availablePositionsRef.current = availablePositions;
  }, [availablePositions]);

  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  const selectedIndexSafe = useMemo(() => {
    return resolveSelectedPositionIndex(availablePositions, {
      selectedPositionId: selectedPositionIdRef.current || selectedPositionId,
      selectedIndex,
    });
  }, [availablePositions, selectedIndex, selectedPositionId]);

  const position = availablePositions[selectedIndexSafe];

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

  const loadPositionAccess = useCallback(async () => {
    const profile = await PreferenceEngine.getContentProfile(userProfile || {});
    const result = await contentAccessService.getAccessiblePositions(positionCatalog, {
      isPremium: isPremiumEffective,
      userSettings: profile || userProfile || {},
      includeAll: true,
    });

    const weeklySet = await buildStableWeeklySet(result.positions || [], {
      contentType: CONTENT_TYPES.POSITIONS,
      userId: userProfile?.id || userProfile?.user_id || userProfile?.uid || userProfile?.sub || 'anonymous',
      isPremium: isPremiumEffective,
      userSettings: profile || userProfile || {},
      userCreatedAt: contentAnchorDate,
      date: new Date(),
    });

    setWeeklyPositionSet(weeklySet);
  }, [contentAnchorDate, isPremiumEffective, positionCatalog, userProfile]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        await loadPositionAccess();
      } catch {
        if (active) {
          setWeeklyPositionSet(null);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [loadPositionAccess]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      loadPositionAccess().catch(() => {
        if (!active) return;
        setWeeklyPositionSet(null);
      });

      return () => {
        active = false;
      };
    }, [loadPositionAccess])
  );

  useEffect(() => {
    let active = true;

    Promise.all([
      getIntimacyFavorites({ ownedOnly: true }),
      getIntimacyTried(),
      getIntimacyMatchState(),
    ]).then(([savedFavorites, savedTried, matches]) => {
      if (active) {
        setFavorites(savedFavorites);
        setTriedPositions(savedTried);
        setPositionMatches(matches || {});
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!availablePositions.length) return;

    const positionId = selectedPositionIdRef.current || selectedPositionId;
    if (positionId) {
      const indexById = availablePositions.findIndex((item) => item.id === positionId);
      if (indexById >= 0 && indexById !== selectedIndex) {
        setSelectedIndex(indexById);
      }
      return;
    }

    const fallbackIndex = selectedIndex < availablePositions.length ? selectedIndex : 0;
    const fallbackPosition = availablePositions[fallbackIndex];

    if (fallbackPosition?.id) {
      selectedPositionIdRef.current = fallbackPosition.id;
      lastSelectedPositionId = fallbackPosition.id;
      setSelectedPositionId(fallbackPosition.id);
    }

    if (selectedIndex >= availablePositions.length) {
      setSelectedIndex(0);
    }
  }, [availablePositions, selectedIndex, selectedPositionId]);

  // ─── HANDLERS ───
  const handleBack = useCallback(() => {
    impact(ImpactFeedbackStyle.Light);
    navigation.goBack();
  }, [navigation]);

  const handlePaywall = useCallback(() => {
    impact(ImpactFeedbackStyle.Medium);
    showPaywall?.();
  }, [showPaywall]);

  const rememberSelectedPosition = useCallback((nextPosition = position) => {
    const nextPositionId = typeof nextPosition === 'string' ? nextPosition : nextPosition?.id;
    if (!nextPositionId) return;

    selectedPositionIdRef.current = nextPositionId;
    lastSelectedPositionId = nextPositionId;
    setSelectedPositionId(nextPositionId);

    const positions = availablePositionsRef.current || [];
    const nextIndex = positions.findIndex((item) => item.id === nextPositionId);
    if (nextIndex >= 0 && nextIndex !== selectedIndexRef.current) {
      selectedIndexRef.current = nextIndex;
      setSelectedIndex(nextIndex);
    }
  }, [position]);

  const handleToggleFavorite = useCallback(async () => {
    if (!position || favoriteBusyRef.current) return;

    const positionId = position.id;
    rememberSelectedPosition(positionId);
    favoriteBusyRef.current = true;
    setFavoriteBusy(true);
    try {
      impact(ImpactFeedbackStyle.Light);
      const next = await toggleIntimacyFavorite(position, {
        currentlyFavorite: !!favorites[position.id],
      });
      rememberSelectedPosition(positionId);
      setFavorites(next.favorites);
      setPositionMatches(await getIntimacyMatchState());
    } catch (error) {
      rememberSelectedPosition(positionId);
      if (__DEV__) {
        console.warn('[IntimacyPositions] Failed to update favorite state:', error?.message);
      }
    } finally {
      rememberSelectedPosition(positionId);
      favoriteBusyRef.current = false;
      setFavoriteBusy(false);
    }
  }, [favorites, position, rememberSelectedPosition]);

  const handleToggleTried = useCallback(async () => {
    if (!position || triedBusyRef.current) return;

    const positionId = position.id;
    const wasTried = !!triedPositions[positionId];
    const previousTried = triedPositions;
    const optimisticTried = { ...previousTried };

    // Lock in position reference before any state changes
    selectedPositionIdRef.current = positionId;
    lastSelectedPositionId = positionId;

    if (wasTried) {
      delete optimisticTried[positionId];
    } else {
      optimisticTried[positionId] = {
        positionId,
        title: position.title,
        commonName: position.commonName || null,
        mood: position.mood || null,
        heat: position.heat || null,
        triedAt: previousTried[positionId]?.triedAt || new Date().toISOString(),
        rating: previousTried[positionId]?.rating || null,
        memoryId: previousTried[positionId]?.memoryId || null,
      };
    }

    triedBusyRef.current = true;
    setTriedBusy(true);
    setTriedPositions(optimisticTried);

    try {
      impact(ImpactFeedbackStyle.Light);
      const next = await toggleIntimacyTried(position, {
        currentlyTried: wasTried,
        currentTried: previousTried,
      });
      // Only update tried state, don't touch position state
      setTriedPositions(next.tried);
      await loadPositionAccess();
    } catch (error) {
      setTriedPositions(previousTried);
      if (__DEV__) {
        console.warn('[IntimacyPositions] Failed to update tried state:', error?.message);
      }
    } finally {
      // Ensure position refs stay locked to prevent any drift
      selectedPositionIdRef.current = positionId;
      lastSelectedPositionId = positionId;
      triedBusyRef.current = false;
      setTriedBusy(false);
    }
  }, [loadPositionAccess, position, triedPositions]);

  const handleRateTried = useCallback(async (rating) => {
    if (!position || ratingBusyRef.current) return;

    const positionId = position.id;
    
    // Lock in position reference before any state changes
    selectedPositionIdRef.current = positionId;
    lastSelectedPositionId = positionId;

    ratingBusyRef.current = true;
    setRatingBusy(true);
    selection();

    const previousTried = triedPositions;
    const previousEntry = previousTried[positionId] || null;
    const nextRating = previousEntry?.rating === rating ? null : rating;
    setTriedPositions({
      ...previousTried,
      [positionId]: {
        ...(previousEntry || {
          positionId,
          title: position.title,
          commonName: position.commonName || null,
          mood: position.mood || null,
          heat: position.heat || null,
          triedAt: new Date().toISOString(),
          memoryId: null,
        }),
        rating: nextRating,
      },
    });

    try {
      const next = await rateIntimacyTried(position, rating);
      // Only update tried state, don't touch position state
      setTriedPositions(next.tried);
    } catch (error) {
      setTriedPositions(previousTried);
      if (__DEV__) {
        console.warn('[IntimacyPositions] Failed to rate tried state:', error?.message);
      }
    } finally {
      // Ensure position refs stay locked to prevent any drift
      selectedPositionIdRef.current = positionId;
      lastSelectedPositionId = positionId;
      ratingBusyRef.current = false;
      setRatingBusy(false);
    }
  }, [position, triedPositions]);

  return (
    <EditorialScreenScaffold
      navigation={navigation}
      headerTitle="Sex Positions"
      headerSubtitle="SEX POSITIONS"
      headerDescription={isPremiumEffective ? "Starts with 10 sex positions and grows by 3 each week." : "Starts with 5 sex positions and adds 1 more each week."}
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
                  <Text style={[styles.cardTag, { color: t.subtext }]}>YOUR LIBRARY</Text>
                  <Text style={[styles.cardTitle, { color: t.text }]}>Explore closeness</Text>
                  <Text style={[styles.cardEmail, { color: t.subtext }]}>{intimacyForLine}</Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pickerRow}
                  style={styles.pickerScroll}
                >
                  {availablePositions.map((p, i) => {
                    const active = i === selectedIndexSafe;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => {
                          selection();
                          rememberSelectedPosition(p);
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
                        {p.isLockedPreview || p.requiresPremium ? (
                          <Icon name="lock-closed-outline" size={13} color={active ? '#FFFFFF' : t.primary} />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {position && (position.isLockedPreview || position.requiresPremium) && (
                  <View style={[styles.answerBubble, styles.lockedPreviewBubble, { backgroundColor: t.surfaceSecondary, borderColor: t.border }]}>
                    <View style={styles.lockedPreviewHeader}>
                      <Icon name="lock-closed-outline" size={18} color={t.primary} />
                      <Text style={[styles.lockedPreviewTitle, { color: t.text }]}>{position.title}</Text>
                    </View>
                    <Text style={[styles.answerText, { color: t.text }]}>
                      {position.previewText || position.shortSummary || 'This premium sex position is part of this week\'s full set.'}
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={handlePaywall}
                      style={[styles.cta, { backgroundColor: t.primary, marginTop: SPACING.lg }]}
                    >
                      <Icon name="sparkles-outline" size={18} color="#FFFFFF" />
                      <Text style={[styles.ctaLabel, { color: '#FFFFFF' }]}>
                        {weeklyPositionSet?.upgradeCopy?.cta || 'Unlock Premium Sex Positions'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {position && !(position.isLockedPreview || position.requiresPremium) && (
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
                    ratingBusy={ratingBusy}
                    isMatch={!!positionMatches[position.id]?.isMatch}
                    compact={isCompact}
                  />
                )}
                {!position && (
                  <View style={[styles.answerBubble, { backgroundColor: t.surfaceSecondary, borderColor: t.border }]}>
                    <Text style={[styles.answerText, { color: t.text }]}>No positions match your current boundaries.</Text>
                  </View>
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
    marginHorizontal: 0,
  },
  editorialCard: {
    borderRadius: 28,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg, 
    flexDirection: 'column',
    alignItems: 'stretch',
    borderWidth: 1,
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
    paddingLeft: SPACING.screen,
  },
  cardTitle: {
    fontFamily: systemFont,
    fontWeight: '800',
    fontSize: 22, 
    lineHeight: 28,
    letterSpacing: -0.4,
    marginBottom: 6,
    paddingLeft: SPACING.screen,
  },
  cardEmail: {
    fontFamily: systemFont,
    fontWeight: '500',
    fontSize: 15,
    paddingLeft: SPACING.screen,
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
    paddingLeft: SPACING.screen,
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
  lockedPreviewBubble: {
    gap: SPACING.md,
  },
  lockedPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockedPreviewTitle: {
    flex: 1,
    fontFamily: systemFont,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
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
  weeklyDropBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    marginBottom: SPACING.xl,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  weeklyDropText: {
    fontFamily: systemFont,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
