// screens/DateNightScreen.js — Date night card game
// Sexy Red Intimacy & Apple Editorial Updates Integrated.

import React, {
  useState, useMemo, useCallback, useRef,
  useImperativeHandle, forwardRef, useEffect,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Platform, Dimensions, StatusBar, InteractionManager,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
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
import { getAllDates, filterDates, getDimensionMeta } from '../utils/contentLoader';
import { FREE_LIMITS } from '../utils/featureFlags';
import { SPACING, BORDER_RADIUS, withAlpha } from '../utils/theme'; // BORDER_RADIUS kept for styles
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';
import PreferenceEngine from '../services/PreferenceEngine';
import { useAuth } from '../context/AuthContext';
import DateCardFront from '../components/DateCardFront';
import DateCardBack from '../components/DateCardBack';

const { width, height } = Dimensions.get('window');
const CARD_W = width - 40;
const CARD_H = Math.min(height * 0.5, 460);
const SWIPE_THRESHOLD = 90;
const FLIP_DURATION = 600;
const DIMS = getDimensionMeta();
const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

const SPRING = { damping: 20, stiffness: 150, mass: 0.8 };

const FONTS = {
  serif: Platform.select({ ios: 'DMSerifDisplay-Regular', android: 'DMSerifDisplay_400Regular', default: 'serif' }),
  body: Platform.select({ ios: 'Lato-Regular', android: 'Lato_400Regular', default: 'sans-serif' }),
  bodyBold: Platform.select({ ios: 'Lato-Bold', android: 'Lato_700Bold', default: 'sans-serif' }),
};


// ── Card stack with flip + swipe ─────────────────────────────────────────────────
const CardStack = forwardRef(function CardStack(
  { deck, deckIndex, colors, isDark, onSwipeLeft, onSwipeRight, onPress },
  ref,
) {
  const topX = useSharedValue(0);
  const topY = useSharedValue(0);
  const flipProgress = useSharedValue(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Keep ref in sync during render (NOT in useEffect) so gesture handlers
  // always read the same deck/deckIndex that's currently displayed on screen.
  const deckRef = useRef({ deck, deckIndex, onSwipeLeft, onSwipeRight, onPress });
  deckRef.current = { deck, deckIndex, onSwipeLeft, onSwipeRight, onPress };

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

  const composedGesture = Gesture.Race(gesture, tap);

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
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 15 },
        shadowOpacity: isDark ? 0.4 : 0.1,
        shadowRadius: 25,
      },
      android: { elevation: 10 },
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
                <Ionicons name="heart" size={18} color="#FFFFFF" />
                <Text style={styles.swipeHintText}>Tonight</Text>
              </Animated.View>
              <Animated.View style={[styles.swipeHint, styles.swipeHintLeft, leftHintStyle]}>
                <Ionicons name="close-outline" size={20} color="#FFFFFF" />
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
    primary: colors.primary || '#C3113D',
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
  const [selectedHeat, setSelectedHeat] = useState(null);   // mood: 1=Heart, 2=Play, 3=Heat
  const [selectedLoad, setSelectedLoad] = useState(null);   // energy: 1=Chill, 2=Moderate, 3=Active
  const [selectedStyle, setSelectedStyle] = useState(null); // style: talking, doing, mixed
  const [deckIndex, setDeckIndex] = useState(0);
  const [likedDates, setLikedDates] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(null); // 'heat' | 'load' | 'style' | null

  const stackRef = useRef(null);
  const loadedProfileRef = useRef(null);

  // Defer heavy work until the tab transition animation finishes
  // Only reload when userProfile actually changes (not on every focus event)
  useFocusEffect(
    useCallback(() => {
      const profileKey = JSON.stringify(userProfile || {});
      if (loadedProfileRef.current === profileKey) return; // already loaded for this profile
      loadedProfileRef.current = profileKey;
      const task = InteractionManager.runAfterInteractions(() => {
        setAllDates(getAllDates());
        PreferenceEngine.getContentProfile(userProfile || {})
          .then(setContentProfile)
          .catch(() => {})
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
    let base = filterDates(allDates, activeFilters);
    if (contentProfile && base.length > 0) {
      const dims = {};
      if (selectedHeat) dims.heat = selectedHeat;
      if (selectedLoad) dims.load = selectedLoad;
      if (selectedStyle) dims.style = selectedStyle;
      base = PreferenceEngine.filterDatesWithProfile(base, contentProfile, dims);
    }
    // Free users only see a small preview of dates
    if (!isPremium && base.length > FREE_LIMITS.VISIBLE_DATE_IDEAS) {
      base = base.slice(0, FREE_LIMITS.VISIBLE_DATE_IDEAS);
    }
    return base;
  }, [allDates, activeFilters, contentProfile, selectedHeat, selectedLoad, selectedStyle, isPremium]);

  const allSelected = selectedHeat && selectedLoad && selectedStyle;
  const hasFilters = selectedHeat || selectedLoad || selectedStyle;
  const remaining = deck.length - deckIndex;
  const deckDone = deckIndex >= deck.length && deck.length > 0;

  const handleSwipeRight = useCallback((date) => {
    if (!isPremium && likedDates.length >= 1) {
      showPaywall?.('DATE_NIGHT_BROWSE');
      return;
    }
    setLikedDates(prev => [...prev, date]);
    setDeckIndex(prev => prev + 1);
  }, [isPremium, likedDates.length, showPaywall]);

  const handleSwipeLeft = useCallback(() => {
    setDeckIndex(prev => prev + 1);
  }, []);

  const openDate = useCallback((date) => {
    if (!isPremium) {
      showPaywall?.('DATE_NIGHT_BROWSE');
      return;
    }
    navigation.navigate('DateNightDetail', { date });
  }, [isPremium, showPaywall, navigation]);

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

  return (
    <View style={[styles.root, { backgroundColor: t.background }]}>
      <LinearGradient
        colors={isDark ? [t.background, '#120206', t.background] : [t.background, '#F9F6F4', t.background]}
        style={StyleSheet.absoluteFillObject}
      />
      <GlowOrb color={withAlpha(t.primary, 0.1)} size={300} top={-50} left={-50} />
      <GlowOrb color={withAlpha(t.accent || t.primary, 0.06)} size={180} top={350} left={width - 80} delay={1500} />
      <FilmGrain opacity={0.03} />
      
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.headerEye, { color: t.subtext }]}>
              {!ready ? 'Preparing Decks...' : !allSelected ? allDates.length + '+ date ideas' : !isPremium && remaining > 0 ? remaining + ' free previews left' : remaining > 0 ? remaining + ' cards in your deck' : deck.length > 0 ? 'All drawn!' : allDates.length + '+ date ideas'}
            </Text>
            <Text style={[styles.headerTitle, { color: t.text }]}>The Deck</Text>
          </View>
          <TouchableOpacity
            style={[styles.filterToggle, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', backgroundColor: filtersOpen ? colors.primary + '15' : colors.surface }]}
            onPress={() => setFiltersOpen(o => !o)}
            activeOpacity={0.7}
          >
            <Ionicons name="options-outline" size={20} color={hasFilters ? colors.primary : colors.text} />
            {hasFilters && <View style={[styles.filterDot, { backgroundColor: colors.primary }]} />}
          </TouchableOpacity>
        </View>

        {/* Show lightweight placeholder until data is ready */}
        {!ready ? (
          <View style={styles.stackWrapper}>
            <ActivityIndicator size="small" color={colors.primary} style={{ opacity: 0.5 }} />
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
                return (
                  <TouchableOpacity
                    style={[styles.dropdownBtn, { 
                      borderColor: activeHeat ? activeHeat.color + '40' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'), 
                      backgroundColor: activeHeat ? activeHeat.color + '10' : (isDark ? 'rgba(28,28,30,0.5)' : 'rgba(255,255,255,0.6)')
                    }]}
                    onPress={() => setDropdownOpen(o => o === 'heat' ? null : 'heat')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dropdownLabel, { color: colors.textMuted }]}>Mood</Text>
                    <View style={styles.dropdownValue}>
                      {activeHeat ? (
                        <Text style={[styles.dropdownValueText, { color: activeHeat.color }]}>{activeHeat.icon} {activeHeat.label}</Text>
                      ) : (
                        <Text style={[styles.dropdownValueText, { color: colors.text, opacity: 0.9 }]}>Choose</Text>
                      )}
                      <Ionicons name={dropdownOpen === 'heat' ? 'chevron-up-outline' : 'chevron-down-outline'} size={14} color={colors.text + '80'} />
                    </View>
                  </TouchableOpacity>
                );
              })()}

              {/* Effort dropdown */}
              {(() => {
                const activeLoad = DIMS.load.find(l => l.level === selectedLoad);
                return (
                  <TouchableOpacity
                    style={[styles.dropdownBtn, { 
                      borderColor: activeLoad ? activeLoad.color + '40' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'), 
                      backgroundColor: activeLoad ? activeLoad.color + '10' : (isDark ? 'rgba(28,28,30,0.5)' : 'rgba(255,255,255,0.6)') 
                    }]}
                    onPress={() => setDropdownOpen(o => o === 'load' ? null : 'load')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dropdownLabel, { color: colors.textMuted }]}>Energy</Text>
                    <View style={styles.dropdownValue}>
                      {activeLoad ? (
                        <Text style={[styles.dropdownValueText, { color: activeLoad.color }]}>{activeLoad.icon} {activeLoad.label}</Text>
                      ) : (
                        <Text style={[styles.dropdownValueText, { color: colors.text, opacity: 0.9 }]}>Choose</Text>
                      )}
                      <Ionicons name={dropdownOpen === 'load' ? 'chevron-up-outline' : 'chevron-down-outline'} size={14} color={colors.text + '80'} />
                    </View>
                  </TouchableOpacity>
                );
              })()}

              {/* Style dropdown */}
              {(() => {
                const activeStyle = DIMS.style.find(s => s.id === selectedStyle);
                return (
                  <TouchableOpacity
                    style={[styles.dropdownBtn, { 
                      borderColor: activeStyle ? activeStyle.color + '40' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'), 
                      backgroundColor: activeStyle ? activeStyle.color + '10' : (isDark ? 'rgba(28,28,30,0.5)' : 'rgba(255,255,255,0.6)') 
                    }]}
                    onPress={() => setDropdownOpen(o => o === 'style' ? null : 'style')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dropdownLabel, { color: colors.textMuted }]}>Style</Text>
                    <View style={styles.dropdownValue}>
                      {activeStyle ? (
                        <Text style={[styles.dropdownValueText, { color: activeStyle.color }]}>{activeStyle.icon} {activeStyle.label}</Text>
                      ) : (
                        <Text style={[styles.dropdownValueText, { color: colors.text, opacity: 0.9 }]}>Choose</Text>
                      )}
                      <Ionicons name={dropdownOpen === 'style' ? 'chevron-up-outline' : 'chevron-down-outline'} size={14} color={colors.text + '80'} />
                    </View>
                  </TouchableOpacity>
                );
              })()}
            </View>

            {hasFilters && (
              <TouchableOpacity style={styles.clearFiltersBtn} onPress={clearFilters} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                <Text style={[styles.clearFiltersTxt, { color: colors.textMuted }]}>Clear filters</Text>
              </TouchableOpacity>
            )}

            {/* Dropdown option panels (Frosted Glass) */}
            {dropdownOpen && (
              <BlurView intensity={isDark ? 20 : 40} tint={isDark ? "dark" : "light"} style={[styles.dropdownPanel, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                {dropdownOpen === 'heat' && DIMS.heat.map((h) => {
                  const active = selectedHeat === h.level;
                  return (
                    <TouchableOpacity
                      key={h.level}
                      style={[styles.dropdownOption, active && { backgroundColor: h.color + '15' }]}
                      onPress={() => handleFilterPress('heat', h.level)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dropdownOptionEmoji}>{h.icon}</Text>
                      <View style={styles.dropdownOptionContent}>
                        <Text style={[styles.dropdownOptionLabel, { color: active ? h.color : colors.text }]}>{h.label}</Text>
                      </View>
                      {active && <Ionicons name="checkmark-circle" size={20} color={h.color} />}
                    </TouchableOpacity>
                  );
                })}
                {dropdownOpen === 'load' && DIMS.load.map((l) => {
                  const active = selectedLoad === l.level;
                  return (
                    <TouchableOpacity
                      key={l.level}
                      style={[styles.dropdownOption, active && { backgroundColor: l.color + '15' }]}
                      onPress={() => handleFilterPress('load', l.level)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dropdownOptionEmoji}>{l.icon}</Text>
                      <View style={styles.dropdownOptionContent}>
                        <Text style={[styles.dropdownOptionLabel, { color: active ? l.color : colors.text }]}>{l.label}</Text>
                      </View>
                      {active && <Ionicons name="checkmark-circle" size={20} color={l.color} />}
                    </TouchableOpacity>
                  );
                })}
                {dropdownOpen === 'style' && DIMS.style.map((s) => {
                  const active = selectedStyle === s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.dropdownOption, active && { backgroundColor: s.color + '15' }]}
                      onPress={() => handleFilterPress('style', s.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dropdownOptionEmoji}>{s.icon}</Text>
                      <View style={styles.dropdownOptionContent}>
                        <Text style={[styles.dropdownOptionLabel, { color: active ? s.color : colors.text }]}>{s.label}</Text>
                      </View>
                      {active && <Ionicons name="checkmark-circle" size={20} color={s.color} />}
                    </TouchableOpacity>
                  );
                })}
              </BlurView>
            )}
          </View>
        )}

        {/* Card stack */}
        <View style={styles.stackWrapper}>
          {!allSelected ? (
            <BlurView intensity={isDark ? 10 : 20} tint={isDark ? "dark" : "light"} style={[styles.emptyStack, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
              <Ionicons name="sparkles" size={42} color={colors.primary + '80'} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Pick your vibe</Text>
              <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
                Choose one from each category above{'\n'}to see your personalized date deck
              </Text>
              <View style={[styles.teaserChips, { marginTop: 16 }]}>
                {!selectedHeat && (
                  <TouchableOpacity 
                    style={[styles.teaserChip, { borderColor: colors.primary + '30', backgroundColor: colors.primary + '10' }]}
                    onPress={() => { selection(); setFiltersOpen(true); setDropdownOpen('heat'); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.teaserChipTxt, { color: colors.primary }]}>MOOD</Text>
                  </TouchableOpacity>
                )}
                {!selectedLoad && (
                  <TouchableOpacity 
                    style={[styles.teaserChip, { borderColor: colors.primary + '30', backgroundColor: colors.primary + '10' }]}
                    onPress={() => { selection(); setFiltersOpen(true); setDropdownOpen('load'); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.teaserChipTxt, { color: colors.primary }]}>ENERGY</Text>
                  </TouchableOpacity>
                )}
                {!selectedStyle && (
                  <TouchableOpacity 
                    style={[styles.teaserChip, { borderColor: colors.primary + '30', backgroundColor: colors.primary + '10' }]}
                    onPress={() => { selection(); setFiltersOpen(true); setDropdownOpen('style'); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.teaserChipTxt, { color: colors.primary }]}>STYLE</Text>
                  </TouchableOpacity>
                )}
              </View>
            </BlurView>
          ) : deck.length === 0 ? (
            <BlurView intensity={isDark ? 10 : 20} tint={isDark ? "dark" : "light"} style={[styles.emptyStack, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
              <Ionicons name="search-outline" size={40} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No matches</Text>
              <Text style={[styles.emptyBody, { color: colors.textMuted }]}>Try a different combination</Text>
            </BlurView>
          ) : deckDone ? (
            <BlurView intensity={isDark ? 10 : 20} tint={isDark ? "dark" : "light"} style={[styles.emptyStack, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
              {!isPremium ? (
                <>
                  <Text style={{ fontSize: 42, marginBottom: 8 }}>🔒</Text>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>Out of free previews</Text>
                  <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
                    Unlock {allDates.length}+ highly-curated date ideas.
                  </Text>
                  <View style={styles.teaserChips}>
                    {DIMS.heat.map(h => (
                      <View key={h.level} style={[styles.teaserChipSm, { borderColor: h.color + '25', backgroundColor: h.color + '10' }]}>
                        <Text style={[styles.teaserChipSmTxt, { color: h.color }]}>{h.icon} {h.label}</Text>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={[styles.resetBtn, { backgroundColor: colors.primary }]}
                    onPress={() => showPaywall?.('UNLIMITED_DATE_IDEAS')}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="star" size={16} color="#FFFFFF" />
                    <Text style={[styles.resetTxt, { color: '#FFFFFF' }]}>Unlock all dates</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 42, marginBottom: 8 }}>✨</Text>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>All cards drawn</Text>
                  <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
                    {likedDates.length > 0 ? likedDates.length + ' saved for tonight' : 'Shuffle and draw again'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.resetBtn, { backgroundColor: colors.text }]}
                    onPress={handleReset}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="shuffle-outline" size={18} color={colors.background} />
                    <Text style={[styles.resetTxt, { color: colors.background }]}>Shuffle deck</Text>
                  </TouchableOpacity>
                </>
              )}
            </BlurView>
          ) : (
            <CardStack
              ref={stackRef}
              deck={deck}
              deckIndex={deckIndex}
              colors={colors}
              isDark={isDark}
              onSwipeRight={handleSwipeRight}
              onSwipeLeft={handleSwipeLeft}
              onPress={openDate}
            />
          )}
        </View>

        {/* Action buttons */}
        {allSelected && !deckDone && deck.length > 0 && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
              onPress={() => stackRef.current?.swipeLeft()}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={28} color={colors.text + '80'} />
            </TouchableOpacity>

            <View style={styles.actionCounterWrap}>
              <Text style={[styles.actionCounter, { color: colors.textMuted }]}>
                {deckIndex + 1} / {deck.length}
              </Text>
              {!isPremium && (
                <Text style={[styles.actionCounterSub, { color: colors.primary + '90' }]}>
                  of {allDates.length}+
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.likeBtn}
              onPress={() => stackRef.current?.swipeRight()}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[colors.primary, colors.accent || colors.primary + 'BB']}
                style={styles.likeBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="heart" size={28} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Free-user teaser banner (Apple Editorial Style) */}
        {allSelected && !isPremium && !deckDone && deck.length > 0 && (
          <TouchableOpacity
            style={[styles.teaserBanner, { backgroundColor: colors.surfaceGlass || 'rgba(255,255,255,0.05)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
            onPress={() => showPaywall?.('UNLIMITED_DATE_IDEAS')}
            activeOpacity={0.8}
          >
            <View style={styles.teaserTop}>
              <Ionicons name="star" size={16} color={colors.primary} />
              <Text style={[styles.teaserTitle, { color: colors.text }]}>
                Unlock {allDates.length}+ dates
              </Text>
            </View>
            <Text style={[styles.teaserBody, { color: colors.textMuted }]}>
              From cozy nights in to adventurous outings — discover the full collection.
            </Text>
          </TouchableOpacity>
        )}

        {/* Tonight's list */}
        {likedDates.length > 0 && (
          <View style={styles.likedSection}>
            <Text style={[styles.likedTitle, { color: colors.text }]}>
              Tonight's picks <Text style={{ color: colors.primary }}>({likedDates.length})</Text>
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.likedRow}>
              {likedDates.map((d, i) => {
                const hm = DIMS.heat.find(h => h.level === d.heat) || DIMS.heat[0];
                return (
                  <TouchableOpacity
                    key={d.id || i}
                    style={[styles.likedCard, { backgroundColor: colors.surface, borderColor: hm.color + '20' }]}
                    onPress={() => openDate(d)}
                    activeOpacity={0.85}
                  >
                    <Text style={{ fontSize: 18 }}>{hm.icon}</Text>
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

        <View style={{ height: 100 }} />
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
  safe: { flex: 1, paddingHorizontal: 16 },
  scrollContent: { flexGrow: 1, paddingBottom: 4 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  headerEye: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 42,
  },
  filterToggle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.background,
  },

  // Filter dropdowns
  filterSection: {
    marginBottom: SPACING.lg,
    gap: 12,
  },
  filterDropdowns: {
    flexDirection: 'row',
    gap: 12,
  },
  dropdownBtn: {
    flex: 1,
    borderRadius: 24, // Editorial squircle pills
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dropdownLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
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
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dropdownPanel: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 4,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.1)',
  },
  dropdownOptionEmoji: { fontSize: 18 },
  dropdownOptionContent: { flex: 1 },
  dropdownOptionLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  clearFiltersBtn: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(150,150,150,0.08)',
  },
  clearFiltersTxt: { fontFamily: FONTS.bodyBold, fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },

  // Stack
  stackWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stackContainer: { width: CARD_W, alignItems: 'center', justifyContent: 'flex-end' },

  // Flip face (absolute overlay for back/front)
  flipFace: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 28, // Matches CardBase
    overflow: 'hidden',
  },

  // Card back
  cardBackGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  backRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  backRingInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.full,
    gap: 7,
    marginBottom: SPACING.sm,
  },
  backPillEmoji: { fontSize: 15 },
  backPillText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: 0.8,
  },
  backHint: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.8,
    fontStyle: 'italic',
  },
  cornerMark: {
    position: 'absolute',
    fontSize: 11,
    color: 'rgba(255,255,255,0.10)',
  },

  // Card front
  cardFrontWrap: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
  },
  cardFrontInner: { flex: 1 },
  cardFrontBand: {
    height: 6,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  cardFrontBandTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  cardFrontBandTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  cardFrontBandTagText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  cardFrontBody: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 24,
    gap: 10,
  },
  cardFrontTitle: {
    fontFamily: FONTS.serif,
    fontSize: 26,
    fontWeight: '400',
    lineHeight: 34,
    letterSpacing: -0.2,
  },
  cardFrontDesc: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 24,
    opacity: 0.85,
  },
  cardFrontFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  cardFrontMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardFrontMetaTxt: { fontFamily: FONTS.bodyBold, fontWeight: '600', fontSize: 13 },
  cardFrontFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardFrontHint: {
    fontFamily: FONTS.body,
    fontSize: 12,
    letterSpacing: 0.3,
    fontStyle: 'italic',
  },

  // Swipe hint pills
  swipeHint: {
    position: 'absolute',
    top: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 10,
  },
  swipeHintRight: {
    left: 16,
    backgroundColor: 'rgba(255, 45, 85, 0.9)', // Apple Red/Pink
  },
  swipeHintLeft: {
    right: 16,
    backgroundColor: 'rgba(40, 40, 45, 0.95)',
  },
  swipeHintText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    paddingVertical: SPACING.xl,
  },
  actionBtn: {
    width: 64, // Larger, more premium buttons
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 12 },
      android: { elevation: 4 },
    }),
  },
  actionCounter: {
    fontFamily: FONTS.bodyBold,
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.5,
    minWidth: 52,
    textAlign: 'center',
  },
  likeBtn: { 
    width: 64, height: 64, borderRadius: 32, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#C3113D', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16 },
      android: { elevation: 8 },
    }),
  },
  likeBtnGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Empty / end states
  emptyStack: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 28,
    paddingBottom: 20,
  },
  emptyTitle: { fontFamily: Platform.select({ ios: "System", android: "Roboto" }), fontSize: 26, fontWeight: '800', letterSpacing: -0.3 },
  emptyBody: { fontFamily: FONTS.body, fontSize: 15, textAlign: 'center', lineHeight: 24, fontWeight: '500', opacity: 0.9 },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 12,
  },
  resetTxt: { fontFamily: FONTS.bodyBold, fontSize: 15, fontWeight: '700' },

  // Free-user teaser
  teaserBanner: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    marginBottom: SPACING.lg,
    gap: 10,
  },
  teaserTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teaserTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  teaserBody: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
  },
  teaserChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  teaserChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  teaserChipTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  teaserChipSm: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 4,
  },
  teaserChipSmTxt: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionCounterWrap: {
    alignItems: 'center',
    minWidth: 52,
  },
  actionCounterSub: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: 2,
  },

  // Tonight's list
  likedSection: { paddingTop: SPACING.md, paddingBottom: 16 },
  likedTitle: { fontFamily: FONTS.bodyBold, fontSize: 15, fontWeight: '700', letterSpacing: 0.3, marginBottom: 12 },
  likedRow: { gap: 12 },
  likedCard: {
    width: 140,
    padding: 16,
    borderRadius: 22, // Widget squircle
    borderWidth: 1,
    gap: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  likedCardTitle: { fontFamily: FONTS.bodyBold, fontWeight: '600', fontSize: 14, lineHeight: 20 },
});
