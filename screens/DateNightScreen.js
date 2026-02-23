// screens/DateNightScreen.js — Date night card game
// Swipe right to save for tonight, swipe left to skip.
// Cards start face-down with heat-themed gradient back, tap to flip and reveal.
// Behind cards animate outward as the top card is dragged.

import React, {
  useState, useMemo, useCallback, useRef,
  useImperativeHandle, forwardRef, useEffect,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback,
  ScrollView, Platform, Dimensions, StatusBar, InteractionManager,
  ActivityIndicator, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming, runOnJS, interpolate,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { getAllDates, filterDates, getDimensionMeta } from '../utils/contentLoader';
import { FREE_LIMITS } from '../utils/featureFlags';
import { SPACING, BORDER_RADIUS } from '../utils/theme';
import PreferenceEngine from '../services/PreferenceEngine';
import { useAuth } from '../context/AuthContext';
import DateCardFront, { HEAT_GRADIENTS, HEAT_ICONS } from '../components/DateCardFront';
import DateCardBack from '../components/DateCardBack';

const { width, height } = Dimensions.get('window');
const CARD_W = width - 48;
const CARD_H = Math.min(height * 0.38, 340);
const SWIPE_THRESHOLD = 85;
const FLIP_DURATION = 500;
const DIMS = getDimensionMeta();

const SPRING = { damping: 22, stiffness: 180, mass: 0.8 };

const FONTS = {
  serif: Platform.select({ ios: 'Playfair Display', android: 'PlayfairDisplay_300Light', default: 'serif' }),
  body: Platform.select({ ios: 'Inter', android: 'Inter_400Regular', default: 'sans-serif' }),
  bodyBold: Platform.select({ ios: 'Inter-SemiBold', android: 'Inter_600SemiBold', default: 'sans-serif' }),
};

// HEAT_GRADIENTS and HEAT_ICONS now imported from components/DateCardFront

// CardFront = DateCardFront (imported from components/DateCardFront)
const CardFront = ({ date, colors }) => <DateCardFront date={date} colors={colors} dims={DIMS} />;

// CardBack = DateCardBack (imported from components/DateCardBack)
const CardBack = ({ date }) => <DateCardBack date={date} dims={DIMS} />;

// ── Card stack with flip + swipe ─────────────────────────────────────────────────
const CardStack = forwardRef(function CardStack(
  { deck, deckIndex, colors, isDark, onSwipeLeft, onSwipeRight, onPress },
  ref,
) {
  const topX = useSharedValue(0);
  const topY = useSharedValue(0);
  const flipProgress = useSharedValue(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const deckRef = useRef({ deck, deckIndex, onSwipeLeft, onSwipeRight, onPress });
  useEffect(() => {
    deckRef.current = { deck, deckIndex, onSwipeLeft, onSwipeRight, onPress };
  }, [deck, deckIndex, onSwipeLeft, onSwipeRight, onPress]);

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [reset]);

  const doSwipeLeft = useCallback(() => {
    const { onSwipeLeft: cb } = deckRef.current;
    reset();
    cb();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [reset]);

  const handleFlip = useCallback(() => {
    const target = isFlipped ? 0 : 1;
    flipProgress.value = withTiming(target, {
      duration: FLIP_DURATION,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
    });
    setIsFlipped(!isFlipped);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [isFlipped, flipProgress]);

  useImperativeHandle(ref, () => ({
    swipeRight: () => {
      topX.value = withTiming(width + 120, { duration: 320 }, () => runOnJS(doSwipeRight)());
    },
    swipeLeft: () => {
      topX.value = withTiming(-(width + 120), { duration: 320 }, () => runOnJS(doSwipeLeft)());
    },
  }), [doSwipeRight, doSwipeLeft]);

  // Pan gesture (only when flipped to front)
  // activeOffsetX prevents conflict with parent ScrollView's vertical scroll
  const gesture = Gesture.Pan()
    .enabled(isFlipped)
    .activeOffsetX([-15, 15])
    .failOffsetY([-20, 20])
    .onUpdate((e) => {
      topX.value = e.translationX;
      topY.value = e.translationY * 0.25;
    })
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD) {
        topX.value = withTiming(width + 120, { duration: 320 }, () => runOnJS(doSwipeRight)());
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        topX.value = withTiming(-(width + 120), { duration: 320 }, () => runOnJS(doSwipeLeft)());
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
      const { deck: d, deckIndex: i, onPress: pressHandler } = deckRef.current;
      if (d[i]) runOnJS(pressHandler)(d[i]);
    }
  });

  const composedGesture = Gesture.Race(gesture, tap);

  // Top card drag animation
  const topStyle = useAnimatedStyle(() => {
    const rotate = interpolate(topX.value, [-width / 2, 0, width / 2], [-13, 0, 13]);
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
    return {
      transform: [
        { scale: 0.94 + p * 0.06 },
        { translateY: 10 - p * 10 },
      ],
    };
  });

  const behind2Style = useAnimatedStyle(() => {
    const p = Math.min(Math.abs(topX.value) / SWIPE_THRESHOLD, 1);
    return {
      transform: [
        { scale: 0.88 + p * 0.06 },
        { translateY: 20 - p * 10 },
      ],
    };
  });

  // Flip faces
  const backFaceStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 0.5, 1], [0, 90, 180]);
    return {
      transform: [{ perspective: 1200 }, { rotateY: rotateY + 'deg' }],
      backfaceVisibility: 'hidden',
      opacity: flipProgress.value < 0.5 ? 1 : 0,
    };
  });

  const frontFaceStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 0.5, 1], [180, 90, 0]);
    return {
      transform: [{ perspective: 1200 }, { rotateY: rotateY + 'deg' }],
      backfaceVisibility: 'hidden',
      opacity: flipProgress.value > 0.5 ? 1 : 0,
    };
  });

  // Swipe hint overlays
  const rightHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(topX.value, [0, SWIPE_THRESHOLD], [0, 0.9], 'clamp'),
  }));
  const leftHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(topX.value, [-SWIPE_THRESHOLD, 0], [0.9, 0], 'clamp'),
  }));

  const topCard = deck[deckIndex];
  const nextCard = deck[deckIndex + 1];
  const nextNextCard = deck[deckIndex + 2];

  if (!topCard) return null;

  const cardBase = {
    height: CARD_H,
    position: 'absolute',
    width: CARD_W,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#060410',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: { elevation: 6 },
    }),
  };

  return (
    <View style={[styles.stackContainer, { height: CARD_H + 28 }]}>
      {/* Card 3 — furthest back */}
      {nextNextCard && (
        <Animated.View
          style={[
            cardBase,
            { backgroundColor: isDark ? colors.surface : '#FAF6F2', borderColor: colors.primary + '12', zIndex: 1 },
            behind2Style,
          ]}
        >
          <CardBack date={nextNextCard} />
        </Animated.View>
      )}

      {/* Card 2 */}
      {nextCard && (
        <Animated.View
          style={[
            cardBase,
            { backgroundColor: isDark ? colors.surface : '#FAF6F2', borderColor: colors.primary + '18', zIndex: 2 },
            behind1Style,
          ]}
        >
          <CardBack date={nextCard} />
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
            <CardBack date={topCard} />
          </Animated.View>

          {/* Front face */}
          <Animated.View style={[styles.flipFace, frontFaceStyle]}>
            <View style={[styles.cardFrontWrap, { backgroundColor: isDark ? '#0E0B14' : '#FAF6F2' }]}>
              <CardFront date={topCard} colors={colors} />
            </View>
          </Animated.View>

          {/* Swipe hint pills (only show when flipped) */}
          {isFlipped && (
            <>
              <Animated.View style={[styles.swipeHint, styles.swipeHintRight, rightHintStyle]}>
                <MaterialCommunityIcons name="heart" size={18} color="#FFF" />
                <Text style={styles.swipeHintText}>Tonight</Text>
              </Animated.View>
              <Animated.View style={[styles.swipeHint, styles.swipeHintLeft, leftHintStyle]}>
                <MaterialCommunityIcons name="arrow-right" size={18} color="#FFF" />
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

  const [ready, setReady] = useState(false);
  const [allDates, setAllDates] = useState([]);
  const [contentProfile, setContentProfile] = useState(null);
  const [selectedHeat, setSelectedHeat] = useState(null);
  const [selectedLoad, setSelectedLoad] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState(null);
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

  useEffect(() => {
    setDeckIndex(0);
    setLikedDates([]);
  }, [selectedHeat, selectedLoad, selectedStyle]);

  const activeFilters = useMemo(() => {
    const f = {};
    if (selectedHeat) f.heat = selectedHeat;
    if (selectedLoad) f.load = selectedLoad;
    if (selectedStyle) f.style = selectedStyle;
    if (!selectedHeat && contentProfile?.maxHeat) f.maxHeat = contentProfile.maxHeat;
    return f;
  }, [selectedHeat, selectedLoad, selectedStyle, contentProfile]);

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
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDeckIndex(0);
    setLikedDates([]);
  }, []);

  const handleFilterPress = useCallback(async (dim, value) => {
    await Haptics.selectionAsync();
    if (dim === 'heat') setSelectedHeat(prev => prev === value ? null : value);
    else if (dim === 'load') setSelectedLoad(prev => prev === value ? null : value);
    else setSelectedStyle(prev => prev === value ? null : value);
    setDropdownOpen(null);
  }, []);

  const clearFilters = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedHeat(null);
    setSelectedLoad(null);
    setSelectedStyle(null);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#070509' : '#F7F0EB' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
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
            <Text style={[styles.headerEye, { color: colors.primary + 'AA' }]}>
              {!ready ? 'Shuffling your deck\u2026' : !isPremium && remaining > 0 ? remaining + ' free previews left' : remaining > 0 ? remaining + ' cards in your deck' : deck.length > 0 ? 'All drawn!' : allDates.length + '+ date ideas'}
            </Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Draw a date</Text>
          </View>
          <TouchableOpacity
            style={[styles.filterToggle, { borderColor: colors.border, backgroundColor: filtersOpen ? colors.primary + '12' : 'transparent' }]}
            onPress={() => setFiltersOpen(o => !o)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="tune-variant" size={16} color={hasFilters ? colors.primary : colors.textMuted} />
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
                    style={[styles.dropdownBtn, { borderColor: activeHeat ? activeHeat.color + '60' : colors.border, backgroundColor: activeHeat ? activeHeat.color + '10' : isDark ? colors.surface : '#FFFAF7' }]}
                    onPress={() => setDropdownOpen(o => o === 'heat' ? null : 'heat')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dropdownLabel, { color: colors.textMuted }]}>Mood</Text>
                    <View style={styles.dropdownValue}>
                      {activeHeat ? (
                        <Text style={[styles.dropdownValueText, { color: activeHeat.color }]}>{activeHeat.icon} {activeHeat.label}</Text>
                      ) : (
                        <Text style={[styles.dropdownValueText, { color: colors.textMuted, opacity: 0.6 }]}>Any</Text>
                      )}
                      <MaterialCommunityIcons name={dropdownOpen === 'heat' ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textMuted} />
                    </View>
                  </TouchableOpacity>
                );
              })()}

              {/* Effort dropdown */}
              {(() => {
                const activeLoad = DIMS.load.find(l => l.level === selectedLoad);
                return (
                  <TouchableOpacity
                    style={[styles.dropdownBtn, { borderColor: activeLoad ? activeLoad.color + '60' : colors.border, backgroundColor: activeLoad ? activeLoad.color + '10' : isDark ? colors.surface : '#FFFAF7' }]}
                    onPress={() => setDropdownOpen(o => o === 'load' ? null : 'load')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dropdownLabel, { color: colors.textMuted }]}>Effort</Text>
                    <View style={styles.dropdownValue}>
                      {activeLoad ? (
                        <Text style={[styles.dropdownValueText, { color: activeLoad.color }]}>{activeLoad.icon} {activeLoad.label}</Text>
                      ) : (
                        <Text style={[styles.dropdownValueText, { color: colors.textMuted, opacity: 0.6 }]}>Any</Text>
                      )}
                      <MaterialCommunityIcons name={dropdownOpen === 'load' ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textMuted} />
                    </View>
                  </TouchableOpacity>
                );
              })()}

              {/* Style dropdown */}
              {(() => {
                const activeStyle = DIMS.style.find(s => s.id === selectedStyle);
                return (
                  <TouchableOpacity
                    style={[styles.dropdownBtn, { borderColor: activeStyle ? activeStyle.color + '60' : colors.border, backgroundColor: activeStyle ? activeStyle.color + '10' : isDark ? colors.surface : '#FFFAF7' }]}
                    onPress={() => setDropdownOpen(o => o === 'style' ? null : 'style')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dropdownLabel, { color: colors.textMuted }]}>Style</Text>
                    <View style={styles.dropdownValue}>
                      {activeStyle ? (
                        <Text style={[styles.dropdownValueText, { color: activeStyle.color }]}>{activeStyle.icon} {activeStyle.label}</Text>
                      ) : (
                        <Text style={[styles.dropdownValueText, { color: colors.textMuted, opacity: 0.6 }]}>Any</Text>
                      )}
                      <MaterialCommunityIcons name={dropdownOpen === 'style' ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textMuted} />
                    </View>
                  </TouchableOpacity>
                );
              })()}
            </View>

            {hasFilters && (
              <TouchableOpacity style={styles.clearFiltersBtn} onPress={clearFilters} activeOpacity={0.7}>
                <MaterialCommunityIcons name="close-circle-outline" size={14} color={colors.textMuted} />
                <Text style={[styles.clearFiltersTxt, { color: colors.textMuted }]}>Clear all</Text>
              </TouchableOpacity>
            )}

            {/* Dropdown option panels */}
            {dropdownOpen === 'heat' && (
              <View style={[styles.dropdownPanel, { backgroundColor: isDark ? colors.surface : '#FFFAF7', borderColor: colors.border }]}>
                {DIMS.heat.map((h) => {
                  const active = selectedHeat === h.level;
                  const locked = !isPremium && h.level >= 4;
                  return (
                    <TouchableOpacity
                      key={h.level}
                      style={[styles.dropdownOption, active && { backgroundColor: h.color + '15' }, locked && { opacity: 0.4 }]}
                      onPress={() => locked ? showPaywall?.('HEAT_LEVEL') : handleFilterPress('heat', h.level)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dropdownOptionEmoji}>{h.icon}</Text>
                      <View style={styles.dropdownOptionContent}>
                        <Text style={[styles.dropdownOptionLabel, { color: active ? h.color : colors.text }]}>{h.label}</Text>
                      </View>
                      {active && <MaterialCommunityIcons name="check" size={18} color={h.color} />}
                      {locked && <MaterialCommunityIcons name="lock-outline" size={14} color={colors.textMuted} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {dropdownOpen === 'load' && (
              <View style={[styles.dropdownPanel, { backgroundColor: isDark ? colors.surface : '#FFFAF7', borderColor: colors.border }]}>
                {DIMS.load.map((l) => {
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
                      {active && <MaterialCommunityIcons name="check" size={18} color={l.color} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {dropdownOpen === 'style' && (
              <View style={[styles.dropdownPanel, { backgroundColor: isDark ? colors.surface : '#FFFAF7', borderColor: colors.border }]}>
                {DIMS.style.map((s) => {
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
                      {active && <MaterialCommunityIcons name="check" size={18} color={s.color} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Card stack */}
        <View style={styles.stackWrapper}>
          {deck.length === 0 ? (
            <View style={[styles.emptyStack, { borderColor: colors.border }]}>
              <MaterialCommunityIcons name="cards-outline" size={40} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No matches</Text>
              <Text style={[styles.emptyBody, { color: colors.textMuted }]}>Adjust your filters above</Text>
            </View>
          ) : deckDone ? (
            <View style={[styles.emptyStack, { borderColor: colors.border }]}>
              {!isPremium ? (
                <>
                  <Text style={{ fontSize: 40 }}>🔒</Text>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>You've seen your free previews</Text>
                  <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
                    Unlock {allDates.length}+ dates across 5 heat levels
                  </Text>
                  <View style={styles.teaserChips}>
                    {DIMS.heat.slice(0, 3).map(h => (
                      <View key={h.level} style={[styles.teaserChipSm, { borderColor: h.color + '30' }]}>
                        <Text style={[styles.teaserChipSmTxt, { color: h.color }]}>{h.icon}</Text>
                      </View>
                    ))}
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>→</Text>
                    {DIMS.heat.slice(3).map(h => (
                      <View key={h.level} style={[styles.teaserChipSm, { borderColor: h.color + '30', backgroundColor: h.color + '08' }]}>
                        <Text style={[styles.teaserChipSmTxt, { color: h.color }]}>{h.icon}</Text>
                        <MaterialCommunityIcons name="lock-outline" size={9} color={h.color} />
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={[styles.resetBtn, { backgroundColor: colors.primary }]}
                    onPress={() => showPaywall?.('UNLIMITED_DATE_IDEAS')}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons name="star-outline" size={16} color="#FFF" />
                    <Text style={styles.resetTxt}>Unlock all dates</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 40 }}>✨</Text>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>All cards drawn</Text>
                  <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
                    {likedDates.length > 0 ? likedDates.length + ' saved for tonight' : 'Shuffle and draw again'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.resetBtn, { backgroundColor: colors.primary }]}
                    onPress={handleReset}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons name="cards-outline" size={16} color="#FFF" />
                    <Text style={styles.resetTxt}>Shuffle deck</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
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
        {!deckDone && deck.length > 0 && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: isDark ? colors.surface : '#FFF', borderColor: colors.border }]}
              onPress={() => stackRef.current?.swipeLeft()}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="close" size={26} color={colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.actionCounterWrap}>
              <Text style={[styles.actionCounter, { color: colors.textMuted }]}>
                {deckIndex + 1} / {deck.length}
              </Text>
              {!isPremium && (
                <Text style={[styles.actionCounterSub, { color: colors.primary + '90' }]}>
                  of {allDates.length}+ total
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.likeBtn}
              onPress={() => stackRef.current?.swipeRight()}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[colors.primary, colors.primary + 'BB']}
                style={styles.likeBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <MaterialCommunityIcons name="heart" size={26} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Free-user teaser banner */}
        {!isPremium && !deckDone && deck.length > 0 && (
          <TouchableOpacity
            style={[styles.teaserBanner, { backgroundColor: isDark ? colors.primary + '14' : colors.primary + '0A', borderColor: colors.primary + '25' }]}
            onPress={() => showPaywall?.('UNLIMITED_DATE_IDEAS')}
            activeOpacity={0.8}
          >
            <View style={styles.teaserTop}>
              <MaterialCommunityIcons name="lock-open-variant-outline" size={16} color={colors.primary} />
              <Text style={[styles.teaserTitle, { color: colors.text }]}>
                {allDates.length}+ dates waiting for you
              </Text>
            </View>
            <Text style={[styles.teaserBody, { color: colors.textMuted }]}>
              From cozy nights in to adventurous outings — upgrade to unlock every idea
            </Text>
            <View style={styles.teaserChips}>
              {DIMS.heat.map(h => (
                <View key={h.level} style={[styles.teaserChip, { borderColor: h.color + '40', backgroundColor: h.color + '10' }]}>
                  <Text style={[styles.teaserChipTxt, { color: h.color }]}>{h.icon} {h.label}</Text>
                  {h.level >= 4 && <MaterialCommunityIcons name="lock-outline" size={10} color={h.color} style={{ marginLeft: 2 }} />}
                </View>
              ))}
            </View>
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
                    style={[styles.likedCard, { backgroundColor: isDark ? colors.surface : '#FAF6F2', borderColor: hm.color + '30' }]}
                    onPress={() => openDate(d)}
                    activeOpacity={0.85}
                  >
                    <Text style={{ fontSize: 16 }}>{hm.icon}</Text>
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

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 16 },
  scrollContent: { flexGrow: 1, paddingBottom: 4 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerEye: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  headerTitle: {
    fontFamily: FONTS.serif,
    fontSize: 30,
    fontWeight: '300',
    letterSpacing: -0.3,
    lineHeight: 36,
  },
  filterToggle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  filterDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },

  // Filter dropdowns
  filterSection: {
    marginBottom: SPACING.md,
    gap: 10,
  },
  filterDropdowns: {
    flexDirection: 'row',
    gap: 10,
  },
  dropdownBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  dropdownLabel: {
    fontFamily: FONTS.body,
    fontSize: 8,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  dropdownValue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownValueText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 0.1,
  },
  dropdownPanel: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  dropdownOptionEmoji: { fontSize: 14 },
  dropdownOptionContent: { flex: 1 },
  dropdownOptionLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 0.1,
  },
  clearFiltersBtn: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  clearFiltersTxt: { fontFamily: FONTS.body, fontSize: 12, letterSpacing: 0.2 },

  // Stack
  stackWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stackContainer: { width: CARD_W, alignItems: 'center', justifyContent: 'flex-end' },

  // Flip face (absolute overlay for back/front)
  flipFace: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: BORDER_RADIUS.xl,
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
    borderColor: 'rgba(255,255,255,0.12)',
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
    backgroundColor: 'rgba(255,255,255,0.12)',
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
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  cardFrontInner: { flex: 1 },
  cardFrontBand: {
    height: 5,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
  },
  cardFrontBandTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  cardFrontBandTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  cardFrontBandTagText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  cardFrontBody: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 20,
    gap: 8,
  },
  cardFrontTitle: {
    fontFamily: FONTS.serif,
    fontSize: 24,
    fontWeight: '400',
    lineHeight: 31,
    letterSpacing: -0.2,
  },
  cardFrontDesc: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.8,
  },
  cardFrontFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  cardFrontMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardFrontMetaTxt: { fontFamily: FONTS.body, fontSize: 12 },
  cardFrontFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardFrontHint: {
    fontFamily: FONTS.body,
    fontSize: 11,
    letterSpacing: 0.3,
    fontStyle: 'italic',
  },

  // Swipe hint pills
  swipeHint: {
    position: 'absolute',
    top: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    zIndex: 10,
  },
  swipeHintRight: {
    left: 14,
    backgroundColor: 'rgba(90, 30, 60, 0.9)',
  },
  swipeHintLeft: {
    right: 14,
    backgroundColor: 'rgba(40, 35, 55, 0.9)',
  },
  swipeHintText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: '#FFF',
    letterSpacing: 0.3,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    paddingVertical: SPACING.md,
  },
  actionBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCounter: {
    fontFamily: FONTS.body,
    fontSize: 13,
    letterSpacing: 0.5,
    minWidth: 52,
    textAlign: 'center',
  },
  likeBtn: { width: 66, height: 66, borderRadius: 33, overflow: 'hidden' },
  likeBtnGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Empty / end states
  emptyStack: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyTitle: { fontFamily: FONTS.serif, fontSize: 22, fontWeight: '300' },
  emptyBody: { fontFamily: FONTS.body, fontSize: 14, textAlign: 'center' },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: BORDER_RADIUS.full,
    marginTop: 8,
  },
  resetTxt: { fontFamily: FONTS.bodyBold, fontSize: 14, color: '#FFF' },

  // Free-user teaser
  teaserBanner: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: SPACING.md,
    gap: 8,
  },
  teaserTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teaserTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    letterSpacing: 0.2,
  },
  teaserBody: {
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 18,
  },
  teaserChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  teaserChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  teaserChipTxt: {
    fontFamily: FONTS.body,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  teaserChipSm: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 2,
  },
  teaserChipSmTxt: {
    fontSize: 13,
  },
  actionCounterWrap: {
    alignItems: 'center',
    minWidth: 52,
  },
  actionCounterSub: {
    fontFamily: FONTS.body,
    fontSize: 10,
    letterSpacing: 0.2,
    marginTop: 1,
  },

  // Tonight's list
  likedSection: { paddingBottom: 8 },
  likedTitle: { fontFamily: FONTS.bodyBold, fontSize: 13, letterSpacing: 0.3, marginBottom: 8 },
  likedRow: { gap: 8 },
  likedCard: {
    width: 130,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 6,
  },
  likedCardTitle: { fontFamily: FONTS.serif, fontSize: 13, lineHeight: 18 },
});
