// screens/DateNightScreen.js — Date night card game
// Velvet Glass & Apple Editorial High-End Updates Integrated.

import React, {
  useState, useMemo, useCallback, useRef,
  useImperativeHandle, forwardRef, useEffect,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Platform, Dimensions, StatusBar, InteractionManager,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from '../components/Icon';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming, runOnJS, interpolate,
  Easing, withSequence,
} from 'react-native-reanimated';
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/ThemeContext';
import { useAppContext } from '../context/AppContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { getAllDates, getDimensionMeta } from '../utils/contentLoader';
import { PremiumFeature } from '../utils/featureFlags';
import { SPACING } from '../utils/theme';
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';
import * as PreferenceEngine from '../services/PreferenceEngine';
import { useAuth } from '../context/AuthContext';
import { getPartnerDisplayName } from '../utils/profileNames';
import DateCardFront, { HEAT_ICONS } from '../components/DateCardFront';
import DateCardBack from '../components/DateCardBack';
import { SoftBoundaries } from '../services/PolishEngine';
import { CONTENT_TYPES } from '../services/WeeklyContentSetService';
import {
  getDateShortlist,
  addDateToShortlist,
  removeDateFromShortlist,
} from '../services/supabase/dateShortlistService';
import {
  getDateHistory,
  getRecentlyCompletedDateIds,
  removeDateSavedKeepsake,
  saveDateSavedKeepsake,
} from '../utils/dateHistory';
import { getDateMatchState } from '../utils/coupleMatches';
import {
  canOpenFreeDateDetail,
  trackFreeDateDetailUsage,
} from '../utils/freePromptAnswerQuota';
import { resolveWeeklyContentAnchorDate } from '../utils/contentSchedule';
import { getRestoredDeckItemIds } from '../utils/contentDeckRestores';
import { buildStableWeeklySet } from '../utils/stableWeeklyContent';

const { width, height } = Dimensions.get('window');
const CARD_W = width - 40;
const SHORTLIST_GAP = 14;
const SHORTLIST_CARD_W = Math.floor((width - 40 - SHORTLIST_GAP) / 2);
const CARD_H = Math.min(height * 0.52, 480);
const CARD_STACK_LIFT = height < 760 ? 56 : height < 850 ? 46 : 38;
const SWIPE_THRESHOLD = 90;
const FLIP_DURATION = 650;
const DIMS = getDimensionMeta();
const SPRING = { damping: 20, stiffness: 150, mass: 0.8 };
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });
const TONE_DATE_COPY = {
  warm: {
    subtitle: 'A date shaped around your mood.',
    emptySetup: 'Choose a mood to reveal plans shaped around today.',
    emptyResults: 'No warm matches surfaced. Try easing the filters or choosing a gentler lane.',
  },
  playful: {
    subtitle: 'Lighter plans with movement, spark, and surprise.',
    emptySetup: 'Choose the mood above to reveal playful plans shaped around what you both want today.',
    emptyResults: 'Nothing playful matched that mix. Shift the filters and see what opens up.',
  },
  intimate: {
    subtitle: 'Closer plans for slower tension and deeper connection.',
    emptySetup: 'Choose the mood above to reveal intimate plans shaped around what you both want today.',
    emptyResults: 'No intimate matches yet. Try a neighboring mood or a softer effort level.',
  },
  minimal: {
    subtitle: 'Clean plans with less friction and more clarity.',
    emptySetup: 'Choose the mood above to reveal simple plans shaped around what you both want today.',
    emptyResults: 'No minimal matches appeared. Reset or simplify the filter mix.',
  },
};

function getCardIdentity(item) {
  return item?.id ?? item?.title ?? null;
}

function shuffleArray(arr, avoidFirstItem = arr[0]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  if (a.length > 1 && getCardIdentity(a[0]) === getCardIdentity(avoidFirstItem)) {
    const swapIndex = a.findIndex((item) => getCardIdentity(item) !== getCardIdentity(avoidFirstItem));
    if (swapIndex > 0) {
      [a[0], a[swapIndex]] = [a[swapIndex], a[0]];
    }
  }
  return a;
}

// ── Card stack with flip + swipe ─────────────────────────────────────────────────
const CardStack = forwardRef(function CardStack(
  { deck, deckIndex, colors, isDark, partnerName, onSwipeLeft, onSwipeRight, onPress, onLongPress, onReveal },
  ref,
) {
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const topX = useSharedValue(0);
  const topY = useSharedValue(0);
  const flipProgress = useSharedValue(0);
  const shuffleAnim = useSharedValue(0);
  const shuffleProgress = useSharedValue(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Keep ref in sync during render (NOT in useEffect) so gesture handlers
  // always read the same deck/deckIndex that's currently displayed on screen.
  const deckRef = useRef({ deck, deckIndex, onSwipeLeft, onSwipeRight, onPress, onLongPress });
  deckRef.current = { deck, deckIndex, onSwipeLeft, onSwipeRight, onPress, onLongPress, onReveal };

  // Reset flip + position when deck advances
  useEffect(() => {
    flipProgress.value = 0;
    setIsFlipped(false);
    topX.value = 0;
    topY.value = 0;
  }, [deckIndex, flipProgress, topX, topY]);

  const reset = useCallback(() => {
    topX.value = 0;
    topY.value = 0;
    flipProgress.value = 0;
    setIsFlipped(false);
  }, [flipProgress, topX, topY]);

  const doSwipeRight = useCallback(() => {
    const { deck: d, deckIndex: i, onSwipeRight: cb } = deckRef.current;
    reset();
    cb(d[i]);
    impact(ImpactFeedbackStyle.Medium);
  }, [reset]);

  const doSwipeLeft = useCallback(() => {
    const { onSwipeLeft: cb } = deckRef.current;
    reset();
    cb();
    impact(ImpactFeedbackStyle.Light);
  }, [reset]);

  const handleFlip = useCallback(() => {
    const target = isFlipped ? 0 : 1;
    const { deck: d, deckIndex: i, onReveal: revealHandler } = deckRef.current;
    if (!isFlipped && d[i]) {
      revealHandler?.(d[i]);
    }
    flipProgress.value = withTiming(target, {
      duration: FLIP_DURATION,
      easing: Easing.bezier(0.33, 1, 0.68, 1),
    });
    setIsFlipped(!isFlipped);
    impact(ImpactFeedbackStyle.Medium);
  }, [isFlipped, flipProgress]);

  // Open detail for the current top card — runs on JS thread so deckRef is fresh
  const doCardPress = useCallback(() => {
    const { deck: d, deckIndex: i, onPress: pressHandler } = deckRef.current;
    if (d[i]) pressHandler(d[i]);
  }, []);

  const doCardLongPress = useCallback(() => {
    const { deck: d, deckIndex: i, onLongPress: longPressHandler } = deckRef.current;
    if (d[i]) longPressHandler?.(d[i]);
  }, []);

  useImperativeHandle(ref, () => ({
    swipeRight: () => {
      topX.value = withTiming(width + 150, { duration: 400 }, () => runOnJS(doSwipeRight)());
    },
    swipeLeft: () => {
      topX.value = withTiming(-(width + 150), { duration: 400 }, () => runOnJS(doSwipeLeft)());
    },
    shuffle: () => {
      shuffleProgress.value = 0;
      shuffleProgress.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) shuffleProgress.value = 0;
      });
      shuffleAnim.value = withSequence(
        withTiming(1, { duration: 120 }),
        withTiming(-1, { duration: 120 }),
        withTiming(1, { duration: 120 }),
        withTiming(0, { duration: 120 })
      );
    }
  }), [doSwipeRight, doSwipeLeft, shuffleAnim, shuffleProgress, topX]);

  // Pan gesture (only when flipped to front)
  // activeOffsetX prevents conflict with parent ScrollView's vertical scroll
  const gesture = Gesture.Pan()
    .enabled(isFlipped)
    .activeOffsetX([-10, 10])
    .onUpdate((e) => {
      topX.value = e.translationX;
      topY.value = e.translationY * 0.2;
    })
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD) {
        topX.value = withTiming(width + 150, { duration: 350 }, () => runOnJS(doSwipeRight)());
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        topX.value = withTiming(-(width + 150), { duration: 350 }, () => runOnJS(doSwipeLeft)());
      } else {
        topX.value = withSpring(0, SPRING);
        topY.value = withSpring(0, SPRING);
      }
    });

  // Tap gesture (flip when face-down, open detail when face-up)
  const tap = Gesture.Tap().onEnd(() => {
    if (!isFlipped) {
      runOnJS(handleFlip)();
    } else {
      runOnJS(doCardPress)();
    }
  });

  const longPress = Gesture.LongPress()
    .enabled(isFlipped)
    .minDuration(500)
    .onStart(() => {
      runOnJS(doCardLongPress)();
    });

  const composedGesture = Gesture.Race(gesture, tap, longPress);

  // Top card drag animation
  const topStyle = useAnimatedStyle(() => {
    const rotate = interpolate(topX.value, [-width, 0, width], [-15, 0, 15]);
    const shuffleX = interpolate(shuffleAnim.value, [-1, 0, 1], [-25, 0, 25]);
    const shuffleRotate = interpolate(shuffleAnim.value, [-1, 0, 1], [-8, 0, 8]);
    const deckShuffleX = interpolate(shuffleProgress.value, [0, 0.35, 0.7, 1], [0, 64, -20, 0]);
    const deckShuffleY = interpolate(shuffleProgress.value, [0, 0.35, 0.7, 1], [0, -10, 12, 0]);
    const deckShuffleRotate = interpolate(shuffleProgress.value, [0, 0.35, 0.7, 1], [0, 7, -4, 0]);
    const deckShuffleScale = interpolate(shuffleProgress.value, [0, 0.35, 1], [1, 1.015, 1]);

    return {
      transform: [
        { translateX: topX.value + shuffleX + deckShuffleX },
        { translateY: topY.value + deckShuffleY },
        { rotate: rotate + shuffleRotate + deckShuffleRotate + 'deg' },
        { scale: deckShuffleScale },
      ],
    };
  });

  // Behind cards animate outward as top moves
  const behind1Style = useAnimatedStyle(() => {
    const p = Math.min(Math.abs(topX.value) / SWIPE_THRESHOLD, 1);
    const shuffleX = interpolate(shuffleAnim.value, [-1, 0, 1], [25, 0, -25]);
    const shuffleRotate = interpolate(shuffleAnim.value, [-1, 0, 1], [8, 0, -8]);
    const deckShuffleX = interpolate(shuffleProgress.value, [0, 0.35, 0.7, 1], [0, -54, 18, 0]);
    const deckShuffleY = interpolate(shuffleProgress.value, [0, 0.35, 0.7, 1], [0, -5, 9, 0]);
    const deckShuffleRotate = interpolate(shuffleProgress.value, [0, 0.35, 0.7, 1], [0, -6, 3, 0]);
    const deckShuffleScale = interpolate(shuffleProgress.value, [0, 0.35, 1], [1, 1.011, 1]);
    return {
      transform: [
        { translateX: shuffleX + deckShuffleX },
        { scale: (0.94 + p * 0.06) * deckShuffleScale },
        { translateY: 15 - p * 15 + deckShuffleY },
        { rotate: shuffleRotate + deckShuffleRotate + 'deg' },
      ],
    };
  });

  const behind2Style = useAnimatedStyle(() => {
    const p = Math.min(Math.abs(topX.value) / SWIPE_THRESHOLD, 1);
    const shuffleX = interpolate(shuffleAnim.value, [-1, 0, 1], [-15, 0, 15]);
    const shuffleRotate = interpolate(shuffleAnim.value, [-1, 0, 1], [-4, 0, 4]);
    const deckShuffleX = interpolate(shuffleProgress.value, [0, 0.35, 0.7, 1], [0, 44, -14, 0]);
    const deckShuffleY = interpolate(shuffleProgress.value, [0, 0.35, 0.7, 1], [0, 0, 6, 0]);
    const deckShuffleRotate = interpolate(shuffleProgress.value, [0, 0.35, 0.7, 1], [0, 5, -2.5, 0]);
    const deckShuffleScale = interpolate(shuffleProgress.value, [0, 0.35, 1], [1, 1.007, 1]);
    return {
      transform: [
        { translateX: shuffleX + deckShuffleX },
        { scale: (0.88 + p * 0.06) * deckShuffleScale },
        { translateY: 30 - p * 15 + deckShuffleY },
        { rotate: shuffleRotate + deckShuffleRotate + 'deg' },
      ],
    };
  });

  // Flip faces
  const backFaceStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 0.5, 1], [0, 90, 180]);
    return {
      transform: [{ perspective: 1500 }, { rotateY: rotateY + 'deg' }],
      opacity: flipProgress.value < 0.5 ? 1 : 0,
    };
  });

  const frontFaceStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 0.5, 1], [180, 90, 0]);
    return {
      transform: [{ perspective: 1500 }, { rotateY: rotateY + 'deg' }],
      opacity: flipProgress.value > 0.5 ? 1 : 0,
    };
  });

  // Swipe hint overlays
  const rightHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(topX.value, [0, SWIPE_THRESHOLD], [0, 0.95], 'clamp'),
  }));
  const leftHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(topX.value, [-SWIPE_THRESHOLD, 0], [0.95, 0], 'clamp'),
  }));

  const topCard = deck[deckIndex];
  const nextCard = deck[deckIndex + 1];
  const nextNextCard = deck[deckIndex + 2];

  if (!topCard) return null;

  const cardBase = {
    height: CARD_H,
    position: 'absolute',
    width: CARD_W,
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: isDark ? 0.5 : 0.12,
        shadowRadius: 30,
      },
      android: { elevation: 12 },
    }),
  };

  return (
    <View style={[styles.stackContainer, { height: CARD_H + 40 }]}>
      {/* Card 3 — furthest back */}
      {nextNextCard && (
        <Animated.View
          style={[
            cardBase,
            { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', zIndex: 1 },
            behind2Style,
          ]}
        >
          <DateCardBack date={nextNextCard} dims={DIMS} isDark={isDark} />
        </Animated.View>
      )}

      {/* Card 2 */}
      {nextCard && (
        <Animated.View
          style={[
            cardBase,
            { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', zIndex: 2 },
            behind1Style,
          ]}
        >
          <DateCardBack date={nextCard} dims={DIMS} isDark={isDark} />
        </Animated.View>
      )}

      {/* Card 1 — top, gesture-enabled */}
      <GestureDetector gesture={composedGesture}>
        <Animated.View
          style={[
            cardBase,
            { zIndex: 3 },
            topStyle,
          ]}
        >
          {/* Back face */}
          <Animated.View style={[styles.flipFace, backFaceStyle]}>
            <DateCardBack date={topCard} dims={DIMS} isDark={isDark} />
          </Animated.View>

          {/* Front face */}
          <Animated.View style={[styles.flipFace, frontFaceStyle]}>
            <View style={[styles.cardFrontWrap, { backgroundColor: isDark ? '#131016' : '#FFFFFF' }]}>
              <DateCardFront date={topCard} colors={colors} dims={DIMS} isDark={isDark} partnerName={partnerName} />
            </View>
          </Animated.View>

          {/* Swipe hint pills (only show when flipped) */}
          {isFlipped && (
            <>
              <Animated.View style={[styles.swipeHint, styles.swipeHintRight, rightHintStyle]}>
                <Icon name="heart-outline" size={18} color="#FFFFFF" />
                <Text style={styles.swipeHintText}>Today</Text>
              </Animated.View>
              <Animated.View style={[styles.swipeHint, styles.swipeHintLeft, leftHintStyle]}>
                <Icon name="close-outline" size={20} color="#FFFFFF" />
                <Text style={styles.swipeHintText}>Skip</Text>
              </Animated.View>
            </>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

// ── Main screen ─────────────────────────────────────────────────────────────
export default function DateNightScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium, premiumStartedAt, showPaywall } = useEntitlements();
  const { user, userProfile } = useAuth();
  const { state } = useAppContext();
  const userId = userProfile?.id || userProfile?.user_id || userProfile?.uid || userProfile?.sub || user?.uid || user?.id || null;
  const partnerName = useMemo(
    () => getPartnerDisplayName(userProfile, state?.userProfile, 'your partner'),
    [state?.userProfile, userProfile]
  );

  const t = useMemo(() => ({
    background: colors.background,
    primary: colors.primary || '#D2121A',
    text: colors.text,
    textMuted: colors.textMuted,
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    border: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    accent: colors.accent,
    surfaceGlass: colors.surfaceGlass,
  }), [colors, isDark]);

  const styles = createStyles(colors, isDark);

  const [ready, setReady] = useState(false);
  const [allDates, setAllDates] = useState([]);
  const [weeklyDateSet, setWeeklyDateSet] = useState(null);
  const [contentProfile, setContentProfile] = useState(null);
  const [deckIndex, setDeckIndex] = useState(0);
  const [likedDates, setLikedDates] = useState([]);
  const [dateMatches, setDateMatches] = useState({});
  const [shortlistBusyIds, setShortlistBusyIds] = useState({});

  const stackRef = useRef(null);
  const shortlistBusyRef = useRef(new Set());
  const [shuffledDeck, setShuffledDeck] = useState(null);
  const emptyShuffleAnim = useSharedValue(0);
  const contentAnchorDate = useMemo(() => resolveWeeklyContentAnchorDate({
    isPremium,
    premiumStartedAt,
    user,
    userProfile,
  }), [isPremium, premiumStartedAt, user, userProfile]);

  // Defer heavy work until the tab transition animation finishes.
  // Reload on focus so season, tone, energy, and boundaries changes take effect.
  useFocusEffect(
    useCallback(() => {
      setReady(false);
      const task = InteractionManager.runAfterInteractions(async () => {
        const dates = getAllDates();
        
        // Get content profile, boundaries, and recent completions first.
        let profile = null;
        let bounds = null;
        let recentlyCompletedDateIds = new Set();
        let restoredDateIds = new Set();
        const [profileResult, boundsResult, historyResult, restoredIdsResult] = await Promise.allSettled([
          PreferenceEngine.getContentProfile(userProfile || {}),
          SoftBoundaries.getAll(),
          getDateHistory(),
          getRestoredDeckItemIds(CONTENT_TYPES.DATES),
        ]);

        if (profileResult.status === 'fulfilled') {
          profile = profileResult.value;
          setContentProfile(profile);
        }

        if (boundsResult.status === 'fulfilled') {
          bounds = boundsResult.value;
        }

        if (historyResult.status === 'fulfilled') {
          recentlyCompletedDateIds = getRecentlyCompletedDateIds(historyResult.value);
        }

        if (restoredIdsResult.status === 'fulfilled') {
          restoredDateIds = restoredIdsResult.value;
        }

        // Apply boundaries and keep completed dates hidden unless the user
        // explicitly restored them to the deck.
        const boundaryEligible = dates.filter(d => {
          if (!d) return false;
          const heat = d.heat || 1;
          // Apply boundary filters
          if (bounds?.pausedDates?.includes(d.id)) return false;
          if (profile?.boundaries?.hiddenCategories?.includes(d.category)) return false;
          if (profile?.maxHeat && heat > profile.maxHeat) return false;
          if (bounds?.hideSpicy && heat >= 4) return false;
          return true;
        });
        const activeBoundaryEligible = boundaryEligible.filter((date) => {
          const dateId = String(date?.id || '');
          return restoredDateIds.has(dateId) || !recentlyCompletedDateIds.has(date?.id);
        });

        setAllDates(activeBoundaryEligible);

        // Build this user's stable weekly allocation. Boundary changes filter this
        // allocation, but they do not backfill extra cards until the next week.
        const weeklySet = await buildStableWeeklySet(activeBoundaryEligible, {
          contentType: CONTENT_TYPES.DATES,
          userId: userId || 'anonymous',
          isPremium,
          userSettings: profile || userProfile || {},
          userCreatedAt: contentAnchorDate,
          date: new Date(),
        });

        setWeeklyDateSet(weeklySet);

        if (userId) {
          Promise.all([
            getDateShortlist(userId).catch(() => []),
            getDateMatchState(userId).catch(() => ({})),
          ])
            .then(([rows, matches]) => {
              const ids = new Set((rows || []).map((row) => row.date_id));
              setLikedDates(boundaryEligible.filter((date) => ids.has(date.id)));
              setDateMatches(matches || {});
            })
            .catch(() => {});
        }

        setReady(true);
      });
      return () => task.cancel();
    }, [contentAnchorDate, isPremium, userId, userProfile])
  );

  const visibleDateDeck = useMemo(() => {
    const weeklyItems = weeklyDateSet?.items || [];
    if (!weeklyItems.length) return null;
  
    return weeklyItems.map((item) => ({
      ...item,
      title: item.title || item.previewText || 'Premium date idea',
      heat: item.heat || 1,
      load: item.load || 1,
      style: item.style || 'mixed',
      weeklySetMeta: item.weeklySetMeta,
      isLockedPreview: item.isLockedPreview,
      requiresPremium: item.requiresPremium,
      upgradeCopy: weeklyDateSet.upgradeCopy,
    }));
  }, [weeklyDateSet]);

  const baseDeck = useMemo(() => {
    let finalDeck = [];
    
    if (!isPremium && visibleDateDeck?.length) {
      finalDeck = [...visibleDateDeck];
    } else if (isPremium) {
      const baseDates = visibleDateDeck?.length ? visibleDateDeck : allDates;

      if (!contentProfile) {
        finalDeck = [...baseDates];
      } else {
        // Personalize: preferred content first, then the rest in catalog order.
        const personalized = PreferenceEngine.filterDatesWithProfile(baseDates, contentProfile);
        const personalizedIds = new Set(personalized.map((d) => d.id));
        const remaining = baseDates.filter((d) => !personalizedIds.has(d.id));

        finalDeck = [...personalized, ...remaining];
      }
    }

    return finalDeck;
  }, [allDates, contentProfile, isPremium, visibleDateDeck]);

  useEffect(() => {
    setShuffledDeck(null);
    setDeckIndex(0);
  }, [baseDeck]);

  const deck = shuffledDeck || baseDeck;
  const freeDeckDateIds = useMemo(
    () => new Set(deck.map((date) => String(date?.id || ''))),
    [deck]
  );

  const deckDone = deckIndex >= deck.length && deck.length > 0;
  const freeDeckDone = !isPremium && deckDone;
  const toneCopy = TONE_DATE_COPY[contentProfile?.tone || 'warm'] || TONE_DATE_COPY.warm;

  const handleSwipeRight = useCallback((date) => {
    if (date?.isLockedPreview || date?.requiresPremium) {
      impact(ImpactFeedbackStyle.Medium);
      showPaywall?.(PremiumFeature.UNLIMITED_DATE_IDEAS);
      setDeckIndex(prev => prev + 1);
      return;
    }

    if (!date?.id) {
      setDeckIndex(prev => prev + 1);
      return;
    }

    const wasSaved = likedDates.some(item => item.id === date.id);
    setLikedDates(prev => (
      wasSaved
        ? prev.filter(item => item.id !== date.id)
        : prev.some(item => item.id === date.id) ? prev : [...prev, date]
    ));

    const persist = Promise.all([
      userId
        ? (wasSaved
          ? removeDateFromShortlist(userId, date.id)
          : addDateToShortlist(userId, date.id))
        : Promise.resolve(),
      wasSaved
        ? removeDateSavedKeepsake(date.id)
        : saveDateSavedKeepsake(date),
    ]);

    persist
      .then(() => getDateMatchState(userId).then(setDateMatches).catch(() => {}))
      .catch(() => {
        setLikedDates(prev => (
          wasSaved
            ? prev.some(item => item.id === date.id) ? prev : [...prev, date]
            : prev.filter(item => item.id !== date.id)
        ));
      });

    setDeckIndex(prev => prev + 1);
  }, [likedDates, userId, showPaywall]);

  const handleSwipeLeft = useCallback(() => {
    setDeckIndex(prev => prev + 1);
  }, []);

  const openDate = useCallback(async (date) => {
    if (date?.isLockedPreview || date?.requiresPremium) {
      impact(ImpactFeedbackStyle.Medium);
      showPaywall?.(PremiumFeature.UNLIMITED_DATE_IDEAS);
      return;
    }

    if (!isPremium && date?.id) {
      const dateId = String(date.id);
      try {
        const accessCheck = await canOpenFreeDateDetail({
          userId,
          user,
          userProfile,
          isPremium,
          dateId,
        });

        if ((!freeDeckDateIds.has(dateId) && !accessCheck.alreadyUsed) || !accessCheck.canUse) {
          showPaywall?.(PremiumFeature.UNLIMITED_DATE_IDEAS);
          return;
        }

        const trackResult = await trackFreeDateDetailUsage({
          userId,
          user,
          userProfile,
          isPremium,
          dateId,
        });

        if (trackResult?.canUse === false) {
          showPaywall?.(PremiumFeature.UNLIMITED_DATE_IDEAS);
          return;
        }
      } catch (error) {
        if (__DEV__) console.warn('[DateNight] Failed to track free date detail view:', error?.message);
        showPaywall?.(PremiumFeature.UNLIMITED_DATE_IDEAS);
        return;
      }
    }

    navigation.navigate('DateNightDetail', { date });
  }, [freeDeckDateIds, isPremium, navigation, showPaywall, user, userId, userProfile]);

  const handleReset = useCallback(() => {
    if (freeDeckDone) return;

    // 1. Trigger the visual shuffle animation
    if (stackRef.current) {
      stackRef.current.shuffle();
    } else {
      emptyShuffleAnim.value = withSequence(
        withTiming(1, { duration: 120 }),
        withTiming(-1, { duration: 120 }),
        withTiming(1, { duration: 120 }),
        withTiming(0, { duration: 120 })
      );
    }

    // 2. Play the haptics
    impact(ImpactFeedbackStyle.Medium);
    setTimeout(() => impact(ImpactFeedbackStyle.Light), 50);
    setTimeout(() => impact(ImpactFeedbackStyle.Light), 100);
    setTimeout(() => impact(ImpactFeedbackStyle.Medium), 150);

    // 3. Swap the cards as the visible stack settles
    setTimeout(() => {
      setShuffledDeck(shuffleArray(baseDeck, deck[deckIndex]));
      setDeckIndex(0);
    }, 420);
  }, [baseDeck, deck, deckIndex, emptyShuffleAnim, freeDeckDone]);

  const emptyStyle = useAnimatedStyle(() => {
    const shuffleX = interpolate(emptyShuffleAnim.value, [-1, 0, 1], [-15, 0, 15]);
    const shuffleRotate = interpolate(emptyShuffleAnim.value, [-1, 0, 1], [-4, 0, 4]);
    return { transform: [{ translateX: shuffleX }, { rotate: shuffleRotate + 'deg' }] };
  });

  const refreshBoundaryProfile = useCallback(async () => {
    const profile = await PreferenceEngine.getContentProfile(userProfile || {});
    setContentProfile(profile);
  }, [userProfile]);

  const handleToggleShortlist = useCallback(async (date) => {
    if (!date?.id || shortlistBusyRef.current.has(date.id)) return;
    selection();
    shortlistBusyRef.current.add(date.id);
    setShortlistBusyIds(prev => ({ ...prev, [date.id]: true }));

    const wasSaved = likedDates.some(item => item.id === date.id);
    setLikedDates(prev => (
      wasSaved
        ? prev.filter(item => item.id !== date.id)
        : prev.some(item => item.id === date.id) ? prev : [...prev, date]
    ));

    try {
      if (userId) {
        if (wasSaved) {
          await removeDateFromShortlist(userId, date.id);
        } else {
          await addDateToShortlist(userId, date.id);
        }
      }

      if (wasSaved) {
        await removeDateSavedKeepsake(date.id);
      } else {
        await saveDateSavedKeepsake(date);
      }

      setDateMatches(await getDateMatchState(userId));
    } catch (error) {
      setLikedDates(prev => (
        wasSaved
          ? prev.some(item => item.id === date.id) ? prev : [...prev, date]
          : prev.filter(item => item.id !== date.id)
      ));
      if (__DEV__) console.warn('[DateNight] Failed to toggle shortlist:', error?.message);
    } finally {
      shortlistBusyRef.current.delete(date.id);
      setShortlistBusyIds(prev => {
        const next = { ...prev };
        delete next[date.id];
        return next;
      });
    }
  }, [likedDates, userId]);

  const handlePauseDate = useCallback((date) => {    if (!date?.id) return;

    Alert.alert(
      'Pause This Date Idea',
      'This date will stop resurfacing until you unpause it in Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pause Date',
          onPress: async () => {
            await SoftBoundaries.pauseDate(date.id);
            if (userId) {
              await removeDateFromShortlist(userId, date.id).catch(() => {});
            }
            setLikedDates((prev) => prev.filter((entry) => entry.id !== date.id));
            await refreshBoundaryProfile();
          },
        },
      ]
    );
  }, [refreshBoundaryProfile, userId]);

  return (
    <View style={[styles.root, { backgroundColor: t.background }]}>
      <LinearGradient
        colors={isDark ? ['#0A0A0C', '#120206', '#0A0A0C'] : ['#FFFFFF', '#F9F6F4', '#FFFFFF']}
        style={StyleSheet.absoluteFillObject}
      />
      <GlowOrb color="#D2121A" size={400} top={-100} left={width - 250} opacity={0.12} />
      <GlowOrb color={isDark ? '#4A1010' : '#F8D7DA'} size={300} top={650} left={-100} opacity={isDark ? 0.1 : 0.35} />
      <FilmGrain opacity={0.035} />
      
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
      
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={true}
          keyboardShouldPersistTaps="handled"
        >

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerEye, { color: t.primary }]}>
            {ready ? 'Make Time Together' : 'Preparing ideas...'}
          </Text>
          
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, { color: t.text }]}>Dates</Text>
          </View>
          
          {/* Shuffle Button */}
          <View style={styles.shuffleSection}>
            <TouchableOpacity
              style={[styles.shuffleButton, { 
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                borderColor: t.border,
                opacity: freeDeckDone ? 0.45 : 1,
              }]}
              onPress={handleReset}
              disabled={freeDeckDone}
              activeOpacity={0.7}
            >
              <Icon name="shuffle-outline" size={16} color={t.primary} />
              <Text style={[styles.shuffleText, { color: t.text }]}>Shuffle Deck</Text>
            </TouchableOpacity>
          </View>

          {false && !isPremium && weeklyDateSet?.upgradeCopy?.body ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: colors.primary + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignSelf: 'flex-start' }}>
              <Icon name="sparkles" size={14} color={colors.primary} />
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary }}>
                {weeklyDateSet.upgradeCopy.body}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Show lightweight placeholder until data is ready */}
        {!ready ? (
          <View style={styles.stackWrapper}>
            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 100 }} />
          </View>
        ) : (
        <>
        {/* Card Stack Content */}
        <View style={styles.stackWrapper}>
          {deck.length === 0 ? (
            <View style={styles.emptyStack}>
              <Icon name="search-outline" size={40} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Matches</Text>
              <Text style={[styles.emptyBody, { color: colors.textMuted }]}>{toneCopy.emptyResults}</Text>
            </View>
          ) : deckDone ? (
            <AnimatedBlurView intensity={20} tint={isDark ? "dark" : "light"} style={[styles.emptyStack, emptyStyle]}>
              {false && !isPremium ? (
                <>
                  <Icon name="lock-closed-outline" size={42} color={colors.primary} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>Explore More</Text>
                  <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
                    Premium opens this week's full date set plus {allDates.length}+ date ideas across romantic, adventure, wellness, and after-dark categories.
                  </Text>
                  <TouchableOpacity
                    style={[styles.resetBtn, { backgroundColor: colors.primary }]}
                    onPress={() => showPaywall?.(PremiumFeature.UNLIMITED_DATE_IDEAS)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.resetTxt, { color: '#FFFFFF' }]}>Open Premium</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Icon name="sparkles-outline" size={42} color={colors.text} style={{ marginBottom: 8 }} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>Deck Complete</Text>
                  <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
                    {!isPremium
                      ? "This week's draw is complete."
                      : likedDates.length > 0 ? `You've selected ${likedDates.length} ideas for today.` : 'Ready to shuffle and go again?'}
                  </Text>
                  {isPremium ? (
                    <TouchableOpacity
                      style={[styles.resetBtn, { backgroundColor: colors.text }]}
                      onPress={handleReset}
                      activeOpacity={0.85}
                    >
                      <Icon name="shuffle-outline" size={18} color={colors.background} />
                      <Text style={[styles.resetTxt, { color: colors.background }]}>Shuffle Deck</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              )}
            </AnimatedBlurView>
          ) : (
            <>
              <CardStack
                ref={stackRef}
                deck={deck}
                deckIndex={deckIndex}
                colors={colors}
                isDark={isDark}
                partnerName={partnerName}
                onSwipeRight={handleSwipeRight}
                onSwipeLeft={handleSwipeLeft}
                onPress={openDate}
                onLongPress={handlePauseDate}
              />
            </>
          )}
        </View>

        {/* Interaction Controls */}
        {!deckDone && deck.length > 0 && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(242,242,247,0.9)' }]}
              onPress={() => stackRef.current?.swipeLeft()}
              activeOpacity={0.8}
            >
              <Icon name="close-outline" size={28} color={colors.text + '80'} />
            </TouchableOpacity>

            <View style={styles.counterGroup}>
              <Text style={[styles.counterMain, { color: colors.text }]}>{deckIndex + 1}</Text>
              <View style={[styles.counterLine, { backgroundColor: colors.text + '20' }]} />
              <Text style={[styles.counterSub, { color: colors.textMuted }]}>{deck.length}</Text>
            </View>

            <TouchableOpacity
              style={styles.likeBtn}
              onPress={() => stackRef.current?.swipeRight()}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[colors.primary, '#9A0F14']}
                style={styles.likeBtnGrad}
              >
                <Icon name="heart-outline" size={28} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Premium Teaser (Editorial Style) */}
        {!isPremium && !deckDone && deck.length > 0 && (
          <View
            style={[styles.editorialBanner, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}
          >
            <View style={styles.editorialTag}>
              <Text style={[styles.editorialTagText, { color: colors.primary }]}>MADE FOR YOU TWO</Text>
            </View>
            <Text style={[styles.editorialTitle, { color: colors.text }]}>More date ideas made for you</Text>
            <Text style={[styles.editorialBody, { color: colors.textMuted }]}>
              Premium starts with 100 date ideas and adds 15 more each week.
            </Text>
          </View>
        )}

        {/* Horizontal Liked List */}
        {likedDates.length > 0 && (
          <View style={styles.likedSection}>
            <View style={styles.likedHeader}>
              <Text style={[styles.likedTitle, { color: colors.text }]}>Shortlist</Text>
              <View style={[styles.likedBadge, { backgroundColor: colors.primary + '20' }]}>
                <Text style={[styles.likedBadgeText, { color: colors.primary }]}>{likedDates.length}</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.likedRow}>
              {likedDates.map((d, i) => {
                const hm = DIMS.heat.find(h => h.level === d.heat) || DIMS.heat[0];
                const isMatch = !!dateMatches[d.id]?.isMatch;
                return (
                  <TouchableOpacity
                    key={d.id || i}
                    style={[styles.likedCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
                    onPress={() => openDate(d)}
                    onLongPress={() => handlePauseDate(d)}
                    activeOpacity={0.85}
                  >
                    <TouchableOpacity
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: true, disabled: !!shortlistBusyIds[d.id] }}
                      accessibilityLabel="Remove saved date"
                      activeOpacity={0.75}
                      disabled={!!shortlistBusyIds[d.id]}
                      onPress={() => handleToggleShortlist(d)}
                      style={[
                        styles.likedSaveButton,
                        { backgroundColor: colors.primary + '18', borderColor: colors.primary + '35' },
                        shortlistBusyIds[d.id] && styles.disabledControl,
                      ]}
                    >
                      <Icon name="bookmark" size={15} color={colors.primary} />
                    </TouchableOpacity>
                    {isMatch ? (
                      <View style={styles.matchBadge}>
                        <Icon name="heart" size={11} color="#FFFFFF" />
                        <Text style={styles.matchBadgeText}>Match</Text>
                      </View>
                    ) : null}
                    <View style={[styles.likedCardIcon, { backgroundColor: hm.color + '15' }]}>
                      <Icon name={HEAT_ICONS[d.heat] || 'heart-outline'} size={18} color={hm.color} />
                    </View>
                    <Text style={[styles.likedCardTitle, { color: colors.text }]} numberOfLines={4}>
                      {d.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        </>
        )}

        <View style={{ height: 120 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ------------------------------------------------------------------
// STYLES - Apple Editorial Velvet Glass 
// ------------------------------------------------------------------
const createStyles = (colors, isDark) => StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 20 },
  scrollContent: { flexGrow: 1, paddingTop: 10 },

  header: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  headerEye: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 42,
    flex: 1,
    paddingRight: SPACING.md,
  },
  headerSubtitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  shuffleSection: {
    paddingHorizontal: 32,
    marginBottom: 4,
    alignItems: 'center',
  },
  shuffleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  shuffleText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  filterToggle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSection: {
    marginBottom: 24,
  },
  filterDropdowns: {
    flexDirection: 'row',
    gap: 10,
  },
  dropdownBtn: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 12,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  dropdownLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
    textAlign: 'center',
  },
  dropdownValue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  dropdownSideSlot: {
    width: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownValueCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownValueText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  dropdownValueMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },
  dropdownValueIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownPanel: {
    borderRadius: 24,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginTop: 12,
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.15)',
  },
  dropdownOptionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownOptionContent: { flex: 1 },
  dropdownOptionLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '700',
  },
  dropdownOptionSub: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.8,
  },
  clearFiltersBtn: {
    alignSelf: 'center',
    marginTop: 16,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(150,150,150,0.08)',
  },
  clearFiltersTxt: { fontFamily: SYSTEM_FONT, fontSize: 12, fontWeight: '700', opacity: 0.6 },

  stackWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -CARD_STACK_LIFT,
    marginBottom: 10,
  },
  stackContainer: { width: CARD_W, alignItems: 'center', justifyContent: 'flex-end' },
  boundaryHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 24,
  },
  boundaryHintText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  flipFace: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 36,
    overflow: 'hidden',
  },
  cardFrontWrap: {
    flex: 1,
  },

  swipeHint: {
    position: 'absolute',
    top: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  swipeHintRight: {
    left: 20,
    backgroundColor: 'rgba(210, 18, 26, 0.95)',
  },
  swipeHintLeft: {
    right: 20,
    backgroundColor: 'rgba(30, 30, 35, 0.9)',
  },
  swipeHintText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 36,
    paddingVertical: 24,
  },
  actionBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 10 },
      android: { elevation: 4 },
    }),
  },
  counterGroup: {
    alignItems: 'center',
    width: 40,
  },
  counterMain: { fontFamily: SYSTEM_FONT, fontSize: 18, fontWeight: '800' },
  counterLine: { width: 20, height: 2, marginVertical: 2, borderRadius: 1 },
  counterSub: { fontFamily: SYSTEM_FONT, fontSize: 12, fontWeight: '600', opacity: 0.5 },
  likeBtn: { 
    width: 68, height: 68, borderRadius: 34, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#D2121A', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 18 },
      android: { elevation: 10 },
    }),
  },
  likeBtnGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  emptyStack: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 36,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  setupEmptyStack: {
    marginTop: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  emptyBody: { fontSize: 16, textAlign: 'center', lineHeight: 24, opacity: 0.7 },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 25,
    marginTop: 12,
  },
  resetTxt: { fontFamily: SYSTEM_FONT, fontSize: 16, fontWeight: '800' },

  editorialBanner: {
    borderRadius: 24,
    padding: 24,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
  },
  editorialTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.primary + '10',
    marginBottom: 12,
  },
  editorialTagText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  editorialTitle: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  editorialBody: { fontSize: 14, lineHeight: 20, opacity: 0.6 },

  likedSection: { marginTop: 10 },
  likedHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  likedTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  likedBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  likedBadgeText: { fontSize: 12, fontWeight: '800' },
  likedRow: { gap: SHORTLIST_GAP, paddingRight: 20 },
  likedCard: {
    width: SHORTLIST_CARD_W,
    minHeight: 174,
    padding: 16,
    paddingRight: 46,
    paddingBottom: 46,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 12,
  },
  likedSaveButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  matchBadge: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  matchBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  likedCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likedCardTitle: { fontSize: 15, fontWeight: '800', lineHeight: 19 },
  disabledControl: {
    opacity: 0.55,
  },
  weeklyDropBanner: {
    display: 'none',
    height: 0,
    minHeight: 0,
    maxHeight: 0,
    opacity: 0,
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  weeklyDropText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
