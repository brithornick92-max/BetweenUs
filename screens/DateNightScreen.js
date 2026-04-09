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
  Easing,
} from 'react-native-reanimated';
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { getAllDates, filterDates, getDimensionMeta, getFilteredDatesWithProfile } from '../utils/contentLoader';
import { FREE_LIMITS, PremiumFeature } from '../utils/featureFlags';
import { SPACING, BORDER_RADIUS, withAlpha } from '../utils/theme'; // BORDER_RADIUS kept for styles
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';
import PreferenceEngine from '../services/PreferenceEngine';
import { useAuth } from '../context/AuthContext';
import DateCardFront from '../components/DateCardFront';
import DateCardBack from '../components/DateCardBack';
import { getDateCardPalette } from '../components/dateCardPalette';
import { SoftBoundaries } from '../services/PolishEngine';

const { width, height } = Dimensions.get('window');
const CARD_W = width - 40;
const CARD_H = Math.min(height * 0.52, 480);
const CARD_STACK_LIFT = height < 760 ? 56 : height < 850 ? 46 : 38;
const SWIPE_THRESHOLD = 90;
const FLIP_DURATION = 650;
const DIMS = getDimensionMeta();
const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

const SPRING = { damping: 20, stiffness: 150, mass: 0.8 };

const FONTS = {
  serif: Platform.select({ ios: 'DMSerifDisplay-Regular', android: 'DMSerifDisplay_400Regular', default: 'serif' }),
  body: Platform.select({ ios: 'Lato-Regular', android: 'Lato_400Regular', default: 'sans-serif' }),
  bodyBold: Platform.select({ ios: 'Lato-Bold', android: 'Lato_700Bold', default: 'sans-serif' }),
};

const TONE_DATE_COPY = {
  warm: {
    subtitle: 'Tender plans with softness, comfort, and room to land.',
    emptySetup: 'Choose the mood above to reveal warm plans shaped around your night.',
    emptyResults: 'No warm matches surfaced. Try easing the filters or choosing a gentler lane.',
  },
  playful: {
    subtitle: 'Lighter plans with movement, spark, and surprise.',
    emptySetup: 'Choose the mood above to reveal playful plans shaped around your night.',
    emptyResults: 'Nothing playful matched that mix. Shift the filters and see what opens up.',
  },
  intimate: {
    subtitle: 'Closer plans for slower tension and deeper connection.',
    emptySetup: 'Choose the mood above to reveal intimate plans shaped around your night.',
    emptyResults: 'No intimate matches yet. Try a neighboring mood or a softer effort level.',
  },
  minimal: {
    subtitle: 'Clean plans with less friction and more clarity.',
    emptySetup: 'Choose the mood above to reveal simple plans shaped around your night.',
    emptyResults: 'No minimal matches appeared. Reset or simplify the filter mix.',
  },
};

const DECK_FILTER_ICONS = {
  heat: {
    1: 'heart-outline',
    2: 'sparkles-outline',
    3: 'flame-outline',
  },
  load: {
    1: 'moon-outline',
    2: 'sunny-outline',
    3: 'flash-outline',
  },
  style: {
    talking: 'chatbubble-outline',
    doing: 'compass-outline',
    mixed: 'shuffle-outline',
  },
};

function getDeckFilterIcon(type, option) {
  if (!option) return null;
  const key = type === 'style' ? option.id : option.level;
  return DECK_FILTER_ICONS[type]?.[key] || 'ellipse-outline';
}

function getDeckFilterTone(type, option) {
  if (!option) return null;
  if (type === 'style') {
    const styleToneMap = {
      talking: 1,
      doing: 2,
      mixed: 3,
    };
    return getDateCardPalette(styleToneMap[option.id] || 1);
  }
  return getDateCardPalette(option.level);
}


// ── Card stack with flip + swipe ─────────────────────────────────────────────────
const CardStack = forwardRef(function CardStack(
  { deck, deckIndex, colors, isDark, onSwipeLeft, onSwipeRight, onPress, onLongPress },
  ref,
) {
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const topX = useSharedValue(0);
  const topY = useSharedValue(0);
  const flipProgress = useSharedValue(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Keep ref in sync during render (NOT in useEffect) so gesture handlers
  // always read the same deck/deckIndex that's currently displayed on screen.
  const deckRef = useRef({ deck, deckIndex, onSwipeLeft, onSwipeRight, onPress, onLongPress });
  deckRef.current = { deck, deckIndex, onSwipeLeft, onSwipeRight, onPress, onLongPress };

  // Reset flip + position when deck advances
  useEffect(() => {
    flipProgress.value = 0;
    setIsFlipped(false);
    topX.value = 0;
    topY.value = 0;
  }, [deckIndex]);

  const reset = useCallback(() => {
    topX.value = 0;
    topY.value = 0;
    flipProgress.value = 0;
    setIsFlipped(false);
  }, []);

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
  }), [doSwipeRight, doSwipeLeft]);

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
    return {
      transform: [
        { translateX: topX.value },
        { translateY: topY.value },
        { rotate: rotate + 'deg' },
      ],
    };
  });

  // Behind cards animate outward as top moves
  const behind1Style = useAnimatedStyle(() => {
    const p = Math.min(Math.abs(topX.value) / SWIPE_THRESHOLD, 1);
    return { transform: [{ scale: 0.94 + p * 0.06 }, { translateY: 15 - p * 15 }] };
  });

  const behind2Style = useAnimatedStyle(() => {
    const p = Math.min(Math.abs(topX.value) / SWIPE_THRESHOLD, 1);
    return { transform: [{ scale: 0.88 + p * 0.06 }, { translateY: 30 - p * 15 }] };
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
          <DateCardBack date={nextNextCard} dims={DIMS} />
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
          <DateCardBack date={nextCard} dims={DIMS} />
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
            <DateCardBack date={topCard} dims={DIMS} />
          </Animated.View>

          {/* Front face */}
          <Animated.View style={[styles.flipFace, frontFaceStyle]}>
            <View style={[styles.cardFrontWrap, { backgroundColor: isDark ? '#131016' : '#FFFFFF' }]}>
              <DateCardFront date={topCard} colors={colors} dims={DIMS} />
            </View>
          </Animated.View>

          {/* Swipe hint pills (only show when flipped) */}
          {isFlipped && (
            <>
              <Animated.View style={[styles.swipeHint, styles.swipeHintRight, rightHintStyle]}>
                <Icon name="heart-outline" size={18} color="#FFFFFF" />
                <Text style={styles.swipeHintText}>Tonight</Text>
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
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const { userProfile } = useAuth();

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
  const [contentProfile, setContentProfile] = useState(null);
  const [rawBoundaries, setRawBoundaries] = useState(null);
  const [selectedHeat, setSelectedHeat] = useState(null);   // mood: 1=Heart, 2=Play, 3=Heat
  const [selectedLoad, setSelectedLoad] = useState(null);   // energy: 1=Chill, 2=Moderate, 3=Active
  const [selectedStyle, setSelectedStyle] = useState(null); // style: talking, doing, mixed
  const [deckIndex, setDeckIndex] = useState(0);
  const [likedDates, setLikedDates] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(null); // 'heat' | 'load' | 'style' | null

  const stackRef = useRef(null);

  // Defer heavy work until the tab transition animation finishes.
  // Reload on focus so season, tone, energy, and boundaries changes take effect.
  useFocusEffect(
    useCallback(() => {
      setReady(false);
      const task = InteractionManager.runAfterInteractions(() => {
        setAllDates(getAllDates());
        Promise.all([
          PreferenceEngine.getContentProfile(userProfile || {}),
          SoftBoundaries.getAll(),
        ])
          .then(([profile, bounds]) => {
            setContentProfile(profile);
            setRawBoundaries(bounds);
          })
          .catch(() => {
            SoftBoundaries.getAll().then(setRawBoundaries).catch(() => {});
          })
          .finally(() => setReady(true));
      });
      return () => task.cancel();
    }, [userProfile])
  );

  // Reset deck position whenever the filtered deck changes
  // (filter change, profile load, premium status change)
  useEffect(() => {
    setDeckIndex(0);
    setLikedDates([]);
  }, [selectedHeat, selectedLoad, selectedStyle, contentProfile, isPremium]);

  const activeFilters = useMemo(() => {
    const f = {};
    if (selectedHeat) f.heat = selectedHeat;
    if (selectedLoad) f.load = selectedLoad;
    if (selectedStyle) f.style = selectedStyle;
    return f;
  }, [selectedHeat, selectedLoad, selectedStyle]);

  const deck = useMemo(() => {
    // When no profile, apply raw boundaries synchronously so paused/heat-capped dates never surface
    const boundaryFilteredDates = contentProfile
      ? allDates
      : allDates.filter((date) => {
          if (!date) return false;
          if (rawBoundaries?.pausedDates?.includes(date.id)) return false;
          if (rawBoundaries?.maxHeatOverride != null && typeof date.heat === 'number' && date.heat > rawBoundaries.maxHeatOverride) return false;
          return true;
        });

    const strictProfileBase = contentProfile ? getFilteredDatesWithProfile(contentProfile) : boundaryFilteredDates;
    const fallbackProfileBase = contentProfile
      ? allDates.filter((date) => {
          if (contentProfile.boundaries?.pausedDates?.includes(date.id)) return false;
          if (typeof contentProfile.maxHeat === 'number' && date.heat > contentProfile.maxHeat) return false;
          return true;
        })
      : boundaryFilteredDates;

    const dims = {};
    if (selectedHeat) dims.heat = selectedHeat;
    if (selectedLoad) dims.load = selectedLoad;
    if (selectedStyle) dims.style = selectedStyle;

    let base = filterDates(strictProfileBase, activeFilters);

    if (contentProfile && base.length > 0) {
      const personalized = PreferenceEngine.filterDatesWithProfile(base, contentProfile, dims);
      if (personalized.length > 0) {
        base = personalized;
      }
    }

    if (base.length === 0) {
      base = filterDates(fallbackProfileBase, activeFilters);
    }

    // Free users only see a small preview of dates
    if (!isPremium && base.length > FREE_LIMITS.VISIBLE_DATE_IDEAS) {
      base = base.slice(0, FREE_LIMITS.VISIBLE_DATE_IDEAS);
    }
    return base;
  }, [allDates, activeFilters, contentProfile, rawBoundaries, selectedHeat, selectedLoad, selectedStyle, isPremium]);

  const allSelected = selectedHeat && selectedLoad && selectedStyle;
  const hasFilters = selectedHeat || selectedLoad || selectedStyle;
  const remaining = deck.length - deckIndex;
  const deckDone = deckIndex >= deck.length && deck.length > 0;
  const toneCopy = TONE_DATE_COPY[contentProfile?.tone || 'warm'] || TONE_DATE_COPY.warm;

  const handleSwipeRight = useCallback((date) => {
    setLikedDates(prev => [...prev, date]);
    setDeckIndex(prev => prev + 1);
  }, []);

  const handleSwipeLeft = useCallback(() => {
    setDeckIndex(prev => prev + 1);
  }, []);

  const openDate = useCallback((date) => {
    navigation.navigate('DateNightDetail', { date });
  }, [navigation]);

  const handleReset = useCallback(async () => {
    impact(ImpactFeedbackStyle.Light);
    setDeckIndex(0);
    setLikedDates([]);
  }, []);

  const handleFilterPress = useCallback(async (dim, value) => {
    selection();
    // Required selection — tapping same value again does nothing (can't deselect)
    if (dim === 'heat') setSelectedHeat(value);
    else if (dim === 'load') setSelectedLoad(value);
    else setSelectedStyle(value);
    setDropdownOpen(null);
  }, []);

  const clearFilters = useCallback(async () => {
    impact(ImpactFeedbackStyle.Light);
    setSelectedHeat(null);
    setSelectedLoad(null);
    setSelectedStyle(null);
  }, []);

  const refreshBoundaryProfile = useCallback(async () => {
    const profile = await PreferenceEngine.getContentProfile(userProfile || {});
    setContentProfile(profile);
  }, [userProfile]);

  const handlePauseDate = useCallback((date) => {
    if (!date?.id) return;

    Alert.alert(
      'Pause This Date Idea',
      'This date will stop resurfacing until you unpause it in Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pause Date',
          onPress: async () => {
            await SoftBoundaries.pauseDate(date.id);
            setLikedDates((prev) => prev.filter((entry) => entry.id !== date.id));
            await refreshBoundaryProfile();
          },
        },
      ]
    );
  }, [refreshBoundaryProfile]);

  return (
    <View style={[styles.root, { backgroundColor: t.background }]}>
      <LinearGradient
        colors={isDark ? ['#0A0A0C', '#120206', '#0A0A0C'] : ['#FFFFFF', '#F9F6F4', '#FFFFFF']}
        style={StyleSheet.absoluteFillObject}
      />
      <GlowOrb color="#D2121A" size={400} top={-100} left={width - 250} opacity={0.12} />
      <GlowOrb color={isDark ? '#4A1010' : '#F2F2F7'} size={300} top={650} left={-100} opacity={0.1} />
      <FilmGrain opacity={0.035} />
      
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={true}
          keyboardShouldPersistTaps="handled"
        >

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.headerEye, { color: t.primary }]}>
              {!ready ? 'Preparing Decks...' : !allSelected ? allDates.length + '+ Curated Ideas' : !isPremium && remaining > 0 ? remaining + ' Previews Remaining' : remaining > 0 ? remaining + ' Potential Plans' : deck.length > 0 ? 'All Cards Drawn' : allDates.length + '+ Curated Ideas'}
            </Text>
            <Text style={[styles.headerTitle, { color: t.text }]}>The Deck</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>{toneCopy.subtitle}</Text>
          </View>
          <TouchableOpacity
            style={[styles.filterToggle, { 
              borderColor: hasFilters ? colors.primary + '40' : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'), 
              backgroundColor: filtersOpen ? colors.primary + '15' : 'transparent' 
            }]}
            onPress={() => setFiltersOpen(o => !o)}
            activeOpacity={0.7}
          >
            <Icon name="funnel-outline" size={20} color={hasFilters ? colors.primary : colors.text} />
            {hasFilters && <View style={[styles.filterDot, { backgroundColor: colors.primary }]} />}
          </TouchableOpacity>
        </View>

        {/* Show lightweight placeholder until data is ready */}
        {!ready ? (
          <View style={styles.stackWrapper}>
            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 100 }} />
          </View>
        ) : (
        <>
        {/* Filters — dropdown selectors */}
        {filtersOpen && (
          <View style={styles.filterSection}>
            <View style={styles.filterDropdowns}>
              {/* Mood dropdown */}
              {(() => {
                const activeHeat = DIMS.heat.find(h => h.level === selectedHeat);
                const activeHeatTone = getDeckFilterTone('heat', activeHeat);
                return (
                  <TouchableOpacity
                    style={[styles.dropdownBtn, { 
                      borderColor: activeHeatTone ? withAlpha(activeHeatTone.chrome, 0.42) : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'), 
                      backgroundColor: activeHeatTone ? withAlpha(activeHeatTone.base, 0.9) : (isDark ? 'rgba(28,28,30,0.5)' : 'rgba(255,255,255,0.6)')
                    }]}
                    onPress={() => setDropdownOpen(o => o === 'heat' ? null : 'heat')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dropdownLabel, { color: colors.textMuted }]}>Mood</Text>
                    <View style={styles.dropdownValue}>
                      {activeHeat ? (
                        <View style={styles.dropdownValueMeta}>
                          <View style={[styles.dropdownValueIcon, { backgroundColor: activeHeatTone.base, borderColor: withAlpha(activeHeatTone.chrome, 0.36) }]}>
                            <Icon name={getDeckFilterIcon('heat', activeHeat)} size={14} color={activeHeatTone.highlight} />
                          </View>
                          <Text style={[styles.dropdownValueText, { color: activeHeatTone.highlight }]}>{activeHeat.label}</Text>
                        </View>
                      ) : (
                        <Text style={[styles.dropdownValueText, { color: colors.text, opacity: 0.9 }]}>Choose</Text>
                      )}
                      <Icon name={dropdownOpen === 'heat' ? 'chevron-up-outline' : 'chevron-down-outline'} size={14} color={activeHeatTone ? withAlpha(activeHeatTone.highlight, 0.8) : colors.text + '80'} />
                    </View>
                  </TouchableOpacity>
                );
              })()}

              {/* Effort dropdown */}
              {(() => {
                const activeLoad = DIMS.load.find(l => l.level === selectedLoad);
                const activeLoadTone = getDeckFilterTone('load', activeLoad);
                return (
                  <TouchableOpacity
                    style={[styles.dropdownBtn, { 
                      borderColor: activeLoadTone ? withAlpha(activeLoadTone.chrome, 0.42) : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'), 
                      backgroundColor: activeLoadTone ? withAlpha(activeLoadTone.base, 0.9) : (isDark ? 'rgba(28,28,30,0.5)' : 'rgba(255,255,255,0.6)') 
                    }]}
                    onPress={() => setDropdownOpen(o => o === 'load' ? null : 'load')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dropdownLabel, { color: colors.textMuted }]}>Energy</Text>
                    <View style={styles.dropdownValue}>
                      {activeLoad ? (
                        <View style={styles.dropdownValueMeta}>
                          <View style={[styles.dropdownValueIcon, { backgroundColor: activeLoadTone.base, borderColor: withAlpha(activeLoadTone.chrome, 0.36) }]}>
                            <Icon name={getDeckFilterIcon('load', activeLoad)} size={14} color={activeLoadTone.highlight} />
                          </View>
                          <Text style={[styles.dropdownValueText, { color: activeLoadTone.highlight }]}>{activeLoad.label}</Text>
                        </View>
                      ) : (
                        <Text style={[styles.dropdownValueText, { color: colors.text, opacity: 0.9 }]}>Choose</Text>
                      )}
                      <Icon name={dropdownOpen === 'load' ? 'chevron-up-outline' : 'chevron-down-outline'} size={14} color={activeLoadTone ? withAlpha(activeLoadTone.highlight, 0.8) : colors.text + '80'} />
                    </View>
                  </TouchableOpacity>
                );
              })()}

              {/* Style dropdown */}
              {(() => {
                const activeStyle = DIMS.style.find(s => s.id === selectedStyle);
                const activeStyleTone = getDeckFilterTone('style', activeStyle);
                return (
                  <TouchableOpacity
                    style={[styles.dropdownBtn, { 
                      borderColor: activeStyleTone ? withAlpha(activeStyleTone.chrome, 0.42) : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'), 
                      backgroundColor: activeStyleTone ? withAlpha(activeStyleTone.base, 0.9) : (isDark ? 'rgba(28,28,30,0.5)' : 'rgba(255,255,255,0.6)') 
                    }]}
                    onPress={() => setDropdownOpen(o => o === 'style' ? null : 'style')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dropdownLabel, { color: colors.textMuted }]}>Style</Text>
                    <View style={styles.dropdownValue}>
                      {activeStyle ? (
                        <View style={styles.dropdownValueMeta}>
                          <View style={[styles.dropdownValueIcon, { backgroundColor: activeStyleTone.base, borderColor: withAlpha(activeStyleTone.chrome, 0.36) }]}>
                            <Icon name={getDeckFilterIcon('style', activeStyle)} size={14} color={activeStyleTone.highlight} />
                          </View>
                          <Text style={[styles.dropdownValueText, { color: activeStyleTone.highlight }]}>{activeStyle.label}</Text>
                        </View>
                      ) : (
                        <Text style={[styles.dropdownValueText, { color: colors.text, opacity: 0.9 }]}>Choose</Text>
                      )}
                      <Icon name={dropdownOpen === 'style' ? 'chevron-up-outline' : 'chevron-down-outline'} size={14} color={activeStyleTone ? withAlpha(activeStyleTone.highlight, 0.8) : colors.text + '80'} />
                    </View>
                  </TouchableOpacity>
                );
              })()}
            </View>

            {/* Dropdown Options (Velvet Glass Layer) */}
            {dropdownOpen && (
              <BlurView intensity={isDark ? 30 : 60} tint={isDark ? "dark" : "light"} style={[styles.dropdownPanel, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]}>
                {(dropdownOpen === 'heat' ? DIMS.heat : dropdownOpen === 'load' ? DIMS.load : DIMS.style).map((opt) => {
                  const val = dropdownOpen === 'style' ? opt.id : opt.level;
                  const current = dropdownOpen === 'heat' ? selectedHeat : dropdownOpen === 'load' ? selectedLoad : selectedStyle;
                  const active = current === val;
                  const tone = getDeckFilterTone(dropdownOpen, opt);
                  return (
                    <TouchableOpacity
                      key={val}
                      style={[styles.dropdownOption, active && { backgroundColor: withAlpha(tone.base, 0.94) }]}
                      onPress={() => handleFilterPress(dropdownOpen, val)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.dropdownOptionIcon, { backgroundColor: tone.base, borderColor: withAlpha(tone.chrome, 0.34) }]}>
                        <Icon name={getDeckFilterIcon(dropdownOpen, opt)} size={18} color={tone.highlight} />
                      </View>
                      <View style={styles.dropdownOptionContent}>
                        <Text style={[styles.dropdownOptionLabel, { color: active ? tone.highlight : colors.text }]}>{opt.label}</Text>
                        <Text style={[styles.dropdownOptionSub, { color: active ? withAlpha(tone.body, 0.9) : colors.textMuted }]}>{opt.description || 'Curated category'}</Text>
                      </View>
                      {active && <Icon name="checkmark-circle-outline" size={20} color={tone.highlight} />}
                    </TouchableOpacity>
                  );
                })}
              </BlurView>
            )}

            {hasFilters && (
              <TouchableOpacity style={styles.clearFiltersBtn} onPress={clearFilters} activeOpacity={0.7}>
                <Text style={[styles.clearFiltersTxt, { color: colors.textMuted }]}>Reset Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Card Stack Content */}
        <View style={styles.stackWrapper}>
          {!allSelected ? (
            <BlurView intensity={isDark ? 15 : 25} tint={isDark ? "dark" : "light"} style={[styles.emptyStack, styles.setupEmptyStack, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
              <View style={styles.emptyIconCircle}>
                <Icon name="sparkles-outline" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Craft Your Night</Text>
              <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
                {toneCopy.emptySetup}
              </Text>
            </BlurView>
          ) : deck.length === 0 ? (
            <View style={styles.emptyStack}>
              <Icon name="search-outline" size={40} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Matches</Text>
              <Text style={[styles.emptyBody, { color: colors.textMuted }]}>{toneCopy.emptyResults}</Text>
            </View>
          ) : deckDone ? (
            <BlurView intensity={20} tint={isDark ? "dark" : "light"} style={styles.emptyStack}>
              {!isPremium ? (
                <>
                  <Icon name="lock-closed-outline" size={42} color={colors.primary} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>Explore More</Text>
                  <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
                    Unlock {allDates.length}+ high-end date nights and curated intimacy exercises.
                  </Text>
                  <TouchableOpacity
                    style={[styles.resetBtn, { backgroundColor: colors.primary }]}
                    onPress={() => showPaywall?.(PremiumFeature.UNLIMITED_DATE_IDEAS)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.resetTxt, { color: '#FFFFFF' }]}>Unlock Everything</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 42, marginBottom: 8 }}>✨</Text>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>Deck Complete</Text>
                  <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
                    {likedDates.length > 0 ? `You've selected ${likedDates.length} ideas for tonight.` : 'Ready to shuffle and go again?'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.resetBtn, { backgroundColor: colors.text }]}
                    onPress={handleReset}
                    activeOpacity={0.85}
                  >
                    <Icon name="shuffle-outline" size={18} color={colors.background} />
                    <Text style={[styles.resetTxt, { color: colors.background }]}>Shuffle Deck</Text>
                  </TouchableOpacity>
                </>
              )}
            </BlurView>
          ) : (
            <>
              <CardStack
                ref={stackRef}
                deck={deck}
                deckIndex={deckIndex}
                colors={colors}
                isDark={isDark}
                onSwipeRight={handleSwipeRight}
                onSwipeLeft={handleSwipeLeft}
                onPress={openDate}
                onLongPress={handlePauseDate}
              />
              <View style={styles.boundaryHintRow}>
                <Icon name="hand-left-outline" size={14} color={colors.textMuted} />
                <Text style={[styles.boundaryHintText, { color: colors.textMuted }]}>Long-press a card to pause that date idea.</Text>
              </View>
            </>
          )}
        </View>

        {/* Interaction Controls */}
        {allSelected && !deckDone && deck.length > 0 && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF' }]}
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
        {allSelected && !isPremium && !deckDone && deck.length > 0 && (
          <TouchableOpacity
            style={[styles.editorialBanner, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}
            onPress={() => showPaywall?.(PremiumFeature.UNLIMITED_DATE_IDEAS)}
            activeOpacity={0.8}
          >
            <View style={styles.editorialTag}>
              <Text style={[styles.editorialTagText, { color: colors.primary }]}>PREMIUM ACCESS</Text>
            </View>
            <Text style={[styles.editorialTitle, { color: colors.text }]}>Unlock {allDates.length}+ Hidden Gems</Text>
            <Text style={[styles.editorialBody, { color: colors.textMuted }]}>
              Get full access to high-heat intimacy prompts and exclusive date plans.
            </Text>
          </TouchableOpacity>
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
                return (
                  <TouchableOpacity
                    key={d.id || i}
                    style={[styles.likedCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
                    onPress={() => openDate(d)}
                    onLongPress={() => handlePauseDate(d)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.likedCardEmoji, { backgroundColor: hm.color + '15' }]}>
                      <Text style={{ fontSize: 16 }}>{hm.icon}</Text>
                    </View>
                    <Text style={[styles.likedCardTitle, { color: colors.text }]} numberOfLines={2}>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  headerEye: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 46,
  },
  headerSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    maxWidth: 260,
  },
  filterToggle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.background,
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
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dropdownLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  dropdownValue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownValueText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    fontWeight: '700',
  },
  dropdownValueMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    fontFamily: FONTS.bodyBold,
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
  clearFiltersTxt: { fontFamily: FONTS.bodyBold, fontSize: 12, fontWeight: '700', opacity: 0.6 },

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
    fontFamily: FONTS.bodyBold,
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
    fontFamily: FONTS.bodyBold,
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
  counterMain: { fontFamily: FONTS.bodyBold, fontSize: 18, fontWeight: '800' },
  counterLine: { width: 20, height: 2, marginVertical: 2, borderRadius: 1 },
  counterSub: { fontFamily: FONTS.bodyBold, fontSize: 12, fontWeight: '600', opacity: 0.5 },
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
  resetTxt: { fontFamily: FONTS.bodyBold, fontSize: 16, fontWeight: '800' },

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
  likedRow: { gap: 14, paddingRight: 20 },
  likedCard: {
    width: 150,
    padding: 18,
    borderRadius: 24,
    borderWidth: 1.5,
    gap: 12,
  },
  likedCardEmoji: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likedCardTitle: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
});
