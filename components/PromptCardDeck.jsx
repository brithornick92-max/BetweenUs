// components/PromptCardDeck.jsx
// A swipeable card-stack for browsing prompts — feels like drawing from a deck.
// Swipe right → open/answer · Swipe left → skip · Tap → flip to reveal.
// Quiet, intimate animations aligned with Brand Guardrails.

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  interpolate,
  runOnJS,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { SPACING, BORDER_RADIUS } from '../utils/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CARD_W = SCREEN_W - 48;
const CARD_H = Math.min(SCREEN_H * 0.52, 440);
const SWIPE_THRESHOLD = SCREEN_W * 0.28;

const SPRING_CONFIG = { damping: 22, stiffness: 180, mass: 0.8 };
const FLIP_DURATION = 500;

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
  bodyBold: Platform.select({
    ios: 'Inter-SemiBold',
    android: 'Inter_600SemiBold',
    default: 'sans-serif',
  }),
};

// Category gradient + icon mapping
const CAT_COLORS = {
  romance:   ['#D4607A', '#9A2E5E'],
  playful:   ['#F09A5A', '#D96B2A'],
  physical:  ['#9B72CF', '#6B3FA0'],
  fantasy:   ['#C84B5A', '#8B1A2A'],
  sensory:   ['#C49A6C', '#8A6540'],
  emotional: ['#7B6DAF', '#504880'],
  future:    ['#5BA8D4', '#2E6E9A'],
  memory:    ['#5FAA7A', '#337A50'],
  visual:    ['#D4A830', '#A07820'],
};
const CAT_COLORS_DARK = {
  romance:   ['#3A1520', '#1E0A12'],
  playful:   ['#2E1A0E', '#1A0E06'],
  physical:  ['#1E1430', '#100A1E'],
  fantasy:   ['#2A1018', '#16080E'],
  sensory:   ['#241A12', '#140E08'],
  emotional: ['#181428', '#0E0C18'],
  future:    ['#0E1E2A', '#081218'],
  memory:    ['#0E2218', '#08140E'],
  visual:    ['#281E08', '#181204'],
};
const CAT_ICONS = {
  romance:   'heart',
  playful:   'star-four-points',
  physical:  'fire',
  fantasy:   'lightning-bolt',
  sensory:   'weather-night',
  emotional: 'chat-outline',
  future:    'telescope',
  memory:    'camera-outline',
  visual:    'eye-outline',
};
const CAT_LABELS = {
  romance:   'Romantic',
  playful:   'Playful',
  physical:  'Intimate',
  fantasy:   'Spicy',
  sensory:   'Cozy',
  emotional: 'Deep Talk',
  future:    'Dreams',
  memory:    'Appreciation',
  visual:    'Curiosity',
};

// ────────────────────────────────────────────────────────
// Single card — handles flip + swipe
// ────────────────────────────────────────────────────────
function DeckCard({ item, index, isTop, onSwipeRight, onSwipeLeft, colors, isDark }) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotateZ = useSharedValue(0);
  const flipProgress = useSharedValue(0); // 0 = back, 1 = front
  const [isFlipped, setIsFlipped] = useState(false);
  const scale = useSharedValue(1);

  const catColors = isDark ? CAT_COLORS_DARK : CAT_COLORS;
  const catGradient = catColors[item?.category] || (isDark ? ['#14101A', '#0A080E'] : [colors.primary, colors.primaryMuted || colors.primary]);
  const catIcon = CAT_ICONS[item?.category] || 'help-circle-outline';
  const catLabel = CAT_LABELS[item?.category] || item?.category || '';

  // Reset when card becomes top
  useEffect(() => {
    if (isTop) {
      translateX.value = 0;
      translateY.value = 0;
      rotateZ.value = 0;
      flipProgress.value = 0;
      setIsFlipped(false);
      scale.value = withSpring(1, SPRING_CONFIG);
    }
  }, [isTop]);

  const handleSwipeComplete = useCallback((direction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (direction === 'right') {
      onSwipeRight?.(item);
    } else {
      onSwipeLeft?.(item);
    }
  }, [item, onSwipeRight, onSwipeLeft]);

  const handleFlip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const target = isFlipped ? 0 : 1;
    flipProgress.value = withTiming(target, {
      duration: FLIP_DURATION,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
    });
    setIsFlipped(!isFlipped);
  }, [isFlipped, flipProgress]);

  // Pan gesture for swiping
  const panGesture = Gesture.Pan()
    .enabled(isTop)
    .onStart(() => {
      scale.value = withSpring(1.02, SPRING_CONFIG);
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.3;
      rotateZ.value = e.translationX * 0.06; // subtle tilt in degrees
    })
    .onEnd((e) => {
      scale.value = withSpring(1, SPRING_CONFIG);

      if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        const direction = e.translationX > 0 ? 'right' : 'left';
        const flyX = direction === 'right' ? SCREEN_W * 1.5 : -SCREEN_W * 1.5;
        translateX.value = withTiming(flyX, { duration: 350, easing: Easing.out(Easing.cubic) });
        translateY.value = withTiming(e.translationY * 0.5, { duration: 350 });
        rotateZ.value = withTiming(e.translationX > 0 ? 15 : -15, { duration: 350 });
        runOnJS(handleSwipeComplete)(direction);
      } else {
        translateX.value = withSpring(0, SPRING_CONFIG);
        translateY.value = withSpring(0, SPRING_CONFIG);
        rotateZ.value = withSpring(0, SPRING_CONFIG);
      }
    });

  // Tap gesture for flip
  const tapGesture = Gesture.Tap()
    .enabled(isTop)
    .onEnd(() => {
      runOnJS(handleFlip)();
    });

  const gesture = Gesture.Race(panGesture, tapGesture);

  // Stacked offset for bg cards
  const stackOffset = isTop ? 0 : Math.min(index, 2);

  // Animated container (position + rotate)
  const containerStyle = useAnimatedStyle(() => {
    const baseScale = isTop ? scale.value : interpolate(stackOffset, [0, 1, 2], [1, 0.95, 0.9]);
    return {
      transform: [
        { translateX: isTop ? translateX.value : 0 },
        { translateY: isTop ? translateY.value : stackOffset * 10 },
        { rotate: isTop ? `${rotateZ.value}deg` : `${stackOffset * -1.2}deg` },
        { scale: baseScale },
      ],
      zIndex: isTop ? 100 : 50 - index,
      opacity: index > 3 ? 0 : interpolate(index, [0, 1, 2, 3], [1, 0.7, 0.45, 0.2]),
    };
  });

  // ── Card back (face-down) ──
  const backStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 0.5, 1], [0, 90, 180]);
    return {
      transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: 'hidden',
      opacity: flipProgress.value < 0.5 ? 1 : 0,
    };
  });

  // ── Card front (face-up — shows prompt text) ──
  const frontStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 0.5, 1], [180, 90, 0]);
    return {
      transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: 'hidden',
      opacity: flipProgress.value > 0.5 ? 1 : 0,
    };
  });

  // Swipe hint overlays
  const rightHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 0.85], 'clamp'),
  }));
  const leftHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [0.85, 0], 'clamp'),
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.cardContainer, containerStyle]}>
        {/* ── BACK FACE ── */}
        <Animated.View style={[styles.card, backStyle]}>
          <LinearGradient
            colors={catGradient}
            style={styles.cardBack}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Decorative pattern */}
            <View style={styles.backPattern}>
              <View style={styles.backPatternInner}>
                <MaterialCommunityIcons name={catIcon} size={48} color="rgba(255,255,255,0.25)" />
              </View>
            </View>

            {/* Category label */}
            <View style={styles.backCategoryPill}>
              <MaterialCommunityIcons name={catIcon} size={14} color="rgba(255,255,255,0.9)" />
              <Text style={styles.backCategoryText}>{catLabel}</Text>
            </View>

            {/* Subtle hint */}
            <Text style={styles.backHint}>tap to reveal</Text>

            {/* Corner flourishes */}
            <View style={[styles.cornerMark, styles.topLeft]}>
              <Text style={styles.cornerText}>✦</Text>
            </View>
            <View style={[styles.cornerMark, styles.topRight]}>
              <Text style={styles.cornerText}>✦</Text>
            </View>
            <View style={[styles.cornerMark, styles.bottomLeft]}>
              <Text style={styles.cornerText}>✦</Text>
            </View>
            <View style={[styles.cornerMark, styles.bottomRight]}>
              <Text style={styles.cornerText}>✦</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── FRONT FACE ── */}
        <Animated.View style={[styles.card, styles.cardFrontWrap, frontStyle]}>
          <View style={[styles.cardFront, { backgroundColor: isDark ? '#0A080E' : '#FFFAF7' }]}>
            {/* Category band */}
            <LinearGradient
              colors={catGradient}
              style={styles.frontBand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <MaterialCommunityIcons name={catIcon} size={16} color="rgba(255,255,255,0.9)" />
              <Text style={styles.frontBandLabel}>{catLabel}</Text>
            </LinearGradient>

            {/* Prompt text */}
            <View style={styles.frontBody}>
              <Text
                style={[styles.frontPromptText, { color: colors.text }]}
                numberOfLines={8}
              >
                {item?.text || 'Something beautiful awaits…'}
              </Text>
            </View>

            {/* Bottom hint */}
            <View style={styles.frontFooter}>
              <Text style={[styles.frontFooterText, { color: colors.textMuted }]}>
                swipe right to reflect
              </Text>
              <MaterialCommunityIcons
                name="arrow-right"
                size={14}
                color={colors.textMuted}
              />
            </View>
          </View>
        </Animated.View>

        {/* ── Swipe hint overlays (only for top card) ── */}
        {isTop && (
          <>
            <Animated.View style={[styles.swipeHint, styles.swipeHintRight, rightHintStyle]}>
              <MaterialCommunityIcons name="pencil-outline" size={28} color="#FFF" />
              <Text style={styles.swipeHintText}>Reflect</Text>
            </Animated.View>
            <Animated.View style={[styles.swipeHint, styles.swipeHintLeft, leftHintStyle]}>
              <MaterialCommunityIcons name="arrow-right" size={28} color="#FFF" />
              <Text style={styles.swipeHintText}>Next</Text>
            </Animated.View>
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

// ────────────────────────────────────────────────────────
// Full deck component
// ────────────────────────────────────────────────────────
export default function PromptCardDeck({ prompts = [], onSelect, onSkip, onDraw }) {
  const { colors, isDark } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const drawScale = useSharedValue(1);

  const visibleCards = useMemo(() => {
    return prompts.slice(currentIndex, currentIndex + 4);
  }, [prompts, currentIndex]);

  const remaining = prompts.length - currentIndex;

  const advanceCard = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev >= prompts.length - 1) return 0; // loop back
      return prev + 1;
    });
  }, [prompts.length]);

  const handleSwipeRight = useCallback((item) => {
    onSelect?.(item);
    // Brief delay so the fly-out animation finishes
    setTimeout(advanceCard, 200);
  }, [onSelect, advanceCard]);

  const handleSwipeLeft = useCallback((item) => {
    onSkip?.(item);
    setTimeout(advanceCard, 200);
  }, [onSkip, advanceCard]);

  const handleDraw = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    drawScale.value = withSpring(0.92, { damping: 15, stiffness: 300 });
    setTimeout(() => {
      drawScale.value = withSpring(1, SPRING_CONFIG);
    }, 120);
    advanceCard();
    onDraw?.();
  }, [advanceCard, onDraw, drawScale]);

  const drawButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: drawScale.value }],
  }));

  if (!prompts.length) return null;

  return (
    <View style={styles.deck}>
      {/* Card stack */}
      <View style={styles.stackArea}>
        {visibleCards.map((item, i) => (
          <DeckCard
            key={`${item?.id || i}_${currentIndex + i}`}
            item={item}
            index={i}
            isTop={i === 0}
            onSwipeRight={handleSwipeRight}
            onSwipeLeft={handleSwipeLeft}
            colors={colors}
            isDark={isDark}
          />
        )).reverse()}
      </View>

      {/* Counter + Draw button */}
      <Animated.View entering={FadeIn.duration(600).delay(300)} style={styles.controls}>
        <Text style={[styles.counterText, { color: colors.textMuted }]}>
          {remaining} {remaining === 1 ? 'card' : 'cards'} remaining
        </Text>

        <TouchableWithoutFeedback onPress={handleDraw}>
          <Animated.View style={[styles.drawButton, { borderColor: colors.primary + '40' }, drawButtonStyle]}>
            <MaterialCommunityIcons name="cards-outline" size={18} color={colors.primary} />
            <Text style={[styles.drawButtonText, { color: colors.primary }]}>Draw next</Text>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Animated.View>
    </View>
  );
}

// ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  deck: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  stackArea: {
    width: CARD_W,
    height: CARD_H,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Shared card shell ──
  cardContainer: {
    position: 'absolute',
    width: CARD_W,
    height: CARD_H,
  },

  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#060410',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
      },
      android: { elevation: 8 },
    }),
  },

  // ── Back face ──
  cardBack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },

  backPattern: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  backPatternInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  backCategoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.full,
    gap: 6,
    marginBottom: SPACING.md,
  },
  backCategoryText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.5,
  },

  backHint: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.5,
  },

  // Corner flourishes
  cornerMark: {
    position: 'absolute',
  },
  topLeft: { top: 18, left: 18 },
  topRight: { top: 18, right: 18 },
  bottomLeft: { bottom: 18, left: 18 },
  bottomRight: { bottom: 18, right: 18 },
  cornerText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.18)',
  },

  // ── Front face ──
  cardFrontWrap: {
    // sits on top of the back
  },

  cardFront: {
    flex: 1,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },

  frontBand: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 8,
  },
  frontBandLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  frontBody: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  frontPromptText: {
    fontFamily: FONTS.serifAccent,
    fontSize: 22,
    lineHeight: 32,
    fontWeight: '300',
    textAlign: 'center',
  },

  frontFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 20,
    gap: 6,
  },
  frontFooterText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    letterSpacing: 0.3,
  },

  // ── Swipe hints ──
  swipeHint: {
    position: 'absolute',
    top: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swipeHintRight: {
    left: 16,
    backgroundColor: 'rgba(122, 30, 78, 0.85)',
  },
  swipeHintLeft: {
    right: 16,
    backgroundColor: 'rgba(60, 50, 80, 0.85)',
  },
  swipeHintText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: '#FFF',
    letterSpacing: 0.3,
  },

  // ── Controls ──
  controls: {
    alignItems: 'center',
    marginTop: SPACING.xl,
    gap: SPACING.md,
  },

  counterText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    letterSpacing: 0.3,
  },

  drawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    gap: 8,
  },
  drawButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    letterSpacing: 0.3,
  },
});
