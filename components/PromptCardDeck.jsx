// components/PromptCardDeck.jsx
// A swipeable card-stack for browsing prompts — feels like drawing from a deck.
// Swipe right → open/answer · Swipe left → skip · Tap → flip to reveal.
// Quiet, intimate animations aligned with Brand Guardrails.

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
  TouchableWithoutFeedback,
  Animated as RNAnimated,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
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
const CARD_W = SCREEN_W - 32;
const CARD_H = Math.min(SCREEN_H * 0.65, 580);
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

// Heat-level gradient + icon + label mapping
const HEAT_COLORS = {
  1: ['#B07EFF', '#9060E0'],
  2: ['#FF7EB8', '#E0609A'],
  3: ['#FF7080', '#E05468'],
  4: ['#FF8534', '#E06820'],
  5: ['#FF2D2D', '#E01818'],
};
// Metallic base tones per heat (dark chrome → accent)
const HEAT_METAL = {
  1: { base: '#1A1230', chrome: '#C4A8FF', highlight: '#E0CCFF', mid: '#6B48B8' },
  2: { base: '#1E0F1A', chrome: '#FFB0D6', highlight: '#FFD6EA', mid: '#B8487A' },
  3: { base: '#1E0F12', chrome: '#FFB0B8', highlight: '#FFD0D6', mid: '#B84858' },
  4: { base: '#1E1408', chrome: '#FFC080', highlight: '#FFE0B8', mid: '#B86820' },
  5: { base: '#1E0808', chrome: '#FF8080', highlight: '#FFB0B0', mid: '#B82020' },
};
const HEAT_ICONS = {
  1: 'hand-heart',
  2: 'heart-multiple',
  3: 'heart-pulse',
  4: 'water',
  5: 'fire',
};
const HEAT_LABELS = {
  1: 'Emotional',
  2: 'Flirty',
  3: 'Sensual',
  4: 'Steamy',
  5: 'Explicit',
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

  const heat = item?.heat || 1;
  const catGradient = HEAT_COLORS[heat] || ['#B07EFF', '#9060E0'];
  const catIcon = HEAT_ICONS[heat] || 'heart-outline';
  const catLabel = HEAT_LABELS[heat] || 'Emotional';
  const metal = HEAT_METAL[heat] || HEAT_METAL[1];

  // Shimmer animation for metallic highlight
  const shimmerAnim = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.timing(shimmerAnim, {
        toValue: 1,
        duration: 3000,
        easing: require('react-native').Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-CARD_W * 1.5, CARD_W * 1.5],
  });

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
          {/* Base dark metallic layer */}
          <LinearGradient
            colors={[metal.base, '#0A0A0F', metal.base]}
            style={styles.cardBack}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Metallic sheen overlay — diagonal color band */}
            <LinearGradient
              colors={[
                'transparent',
                metal.chrome + '08',
                metal.chrome + '18',
                metal.highlight + '22',
                metal.chrome + '18',
                metal.chrome + '08',
                'transparent',
              ]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />

            {/* Chrome edge highlights — top edge */}
            <LinearGradient
              colors={[metal.chrome + '30', 'transparent']}
              style={styles.topEdgeShine}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />

            {/* Chrome edge highlights — left edge */}
            <LinearGradient
              colors={[metal.chrome + '20', 'transparent']}
              style={styles.leftEdgeShine}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
            />

            {/* Animated shimmer band */}
            <RNAnimated.View
              style={[
                styles.shimmerBand,
                { transform: [{ translateX: shimmerTranslate }, { rotate: '25deg' }] },
              ]}
              pointerEvents="none"
            >
              <LinearGradient
                colors={[
                  'transparent',
                  'rgba(255,255,255,0.0)',
                  'rgba(255,255,255,0.07)',
                  'rgba(255,255,255,0.15)',
                  'rgba(255,255,255,0.07)',
                  'rgba(255,255,255,0.0)',
                  'transparent',
                ]}
                style={{ width: '100%', height: '100%' }}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
              />
            </RNAnimated.View>

            {/* Chrome inner frame */}
            <View style={[styles.backFrame, { borderColor: metal.chrome + '35' }]}>
              {/* Metallic inner top line */}
              <LinearGradient
                colors={['transparent', metal.chrome + '40', 'transparent']}
                style={styles.frameTopLine}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
              />

              {/* Top heat badge — brushed metal style */}
              <View style={[styles.backTopBadge, { borderColor: metal.chrome + '30' }]}>
                <MaterialCommunityIcons name={catIcon} size={14} color={metal.chrome} />
                <Text style={[styles.backBadgeText, { color: metal.chrome }]}>{catLabel}</Text>
              </View>

              {/* Center emblem — chrome rings */}
              <View style={styles.backEmblem}>
                <View style={[styles.backEmblemOuter, { borderColor: metal.chrome + '40' }]}>
                  <LinearGradient
                    colors={[metal.chrome + '15', 'transparent', metal.chrome + '10']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  <View style={[styles.backEmblemInner, { borderColor: metal.chrome + '25' }]}>
                    <LinearGradient
                      colors={[catGradient[0] + '30', 'transparent']}
                      style={StyleSheet.absoluteFill}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                    />
                    <MaterialCommunityIcons name={catIcon} size={38} color={metal.chrome + 'CC'} />
                  </View>
                </View>
                <Text style={[styles.backLevelText, { color: metal.chrome + '80' }]}>{'✦ '.repeat(heat).trim()}</Text>
              </View>

              {/* Metallic inner bottom line */}
              <LinearGradient
                colors={['transparent', metal.chrome + '30', 'transparent']}
                style={styles.frameBottomLine}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
              />

              <Text style={[styles.backHint, { color: metal.chrome + '50' }]}>tap to reveal</Text>
            </View>

            {/* Bottom edge shine */}
            <LinearGradient
              colors={['transparent', metal.chrome + '15']}
              style={styles.bottomEdgeShine}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />
          </LinearGradient>
        </Animated.View>

        {/* ── FRONT FACE ── */}
        <Animated.View style={[styles.card, styles.cardFrontWrap, frontStyle]}>
          <View style={[styles.cardFront, { backgroundColor: metal.base }]}>
            {/* Metallic base sheen */}
            <LinearGradient
              colors={[metal.chrome + '08', 'transparent', metal.chrome + '06']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />

            {/* Top edge chrome highlight */}
            <LinearGradient
              colors={[metal.chrome + '25', 'transparent']}
              style={styles.frontTopShine}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />

            {/* Animated shimmer on front too */}
            <RNAnimated.View
              style={[
                styles.shimmerBand,
                { transform: [{ translateX: shimmerTranslate }, { rotate: '25deg' }] },
              ]}
              pointerEvents="none"
            />

            {/* Top band — brushed metal with heat accent */}
            <View style={styles.frontBand}>
              <LinearGradient
                colors={[metal.mid + '90', catGradient[0] + '70', metal.mid + '90']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
              {/* Chrome top edge on band */}
              <LinearGradient
                colors={['rgba(255,255,255,0.25)', 'transparent']}
                style={styles.bandTopEdge}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
              />
              <View style={styles.frontBandLeft}>
                <MaterialCommunityIcons name={catIcon} size={16} color={metal.highlight} />
                <Text style={[styles.frontBandLabel, { color: metal.highlight }]}>{catLabel}</Text>
              </View>
              <Text style={[styles.frontBandLevel, { color: metal.chrome + 'AA' }]}>{'✦'.repeat(heat)}</Text>
            </View>

            {/* Chrome separator line under band */}
            <LinearGradient
              colors={['transparent', metal.chrome + '40', metal.highlight + '50', metal.chrome + '40', 'transparent']}
              style={styles.chromeDivider}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
            />

            {/* Inner card frame — metallic border */}
            <View style={[styles.frontFrame, { borderColor: metal.chrome + '18' }]}>
              {/* Subtle inner gradient */}
              <LinearGradient
                colors={[metal.chrome + '06', 'transparent', metal.chrome + '04']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.frontBody}>
                <Text
                  style={[styles.frontPromptText, { color: metal.highlight, fontSize: (item?.text?.length || 0) > 180 ? 16 : (item?.text?.length || 0) > 120 ? 18 : 22 }]}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  {item?.text || 'Something beautiful awaits…'}
                </Text>
              </View>
            </View>

            {/* Chrome separator above footer */}
            <LinearGradient
              colors={['transparent', metal.chrome + '30', metal.highlight + '40', metal.chrome + '30', 'transparent']}
              style={styles.chromeDivider}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
            />

            {/* Bottom bar */}
            <View style={styles.frontFooter}>
              <View style={styles.frontFooterContent}>
                <Text style={[styles.frontFooterText, { color: metal.chrome + '60' }]}>
                  swipe right to reflect
                </Text>
                <MaterialCommunityIcons
                  name="arrow-right"
                  size={14}
                  color={metal.chrome + '60'}
                />
              </View>
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
    borderRadius: 18,
    overflow: 'hidden',
    // Double-border metallic edge: outer chrome rim
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.6,
        shadowRadius: 32,
      },
      android: { elevation: 16 },
    }),
  },

  // ── Back face ──
  cardBack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },

  // Chrome edge shine overlays
  topEdgeShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  leftEdgeShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 40,
  },
  bottomEdgeShine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },

  // Animated shimmer band
  shimmerBand: {
    position: 'absolute',
    top: -CARD_H * 0.3,
    width: CARD_W * 0.35,
    height: CARD_H * 1.8,
  },

  backFrame: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: 12,
    margin: 8,
    paddingVertical: 22,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    overflow: 'hidden',
  },

  // Fine metallic lines inside frame
  frameTopLine: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1,
  },
  frameBottomLine: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    height: 1,
  },

  backTopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 7,
  },
  backBadgeText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  backEmblem: {
    alignItems: 'center',
    gap: 14,
  },
  backEmblemOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(255,255,255,0.25)',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 16,
      },
      android: {},
    }),
  },
  backEmblemInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  backLevelText: {
    fontFamily: FONTS.body,
    fontSize: 15,
    letterSpacing: 5,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },

  backHint: {
    fontFamily: FONTS.body,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // ── Front face ──
  cardFrontWrap: {},

  cardFront: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },

  frontTopShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 50,
    zIndex: 1,
  },

  frontBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    overflow: 'hidden',
  },
  bandTopEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  frontBandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  frontBandLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  frontBandLevel: {
    fontSize: 12,
    letterSpacing: 3,
  },

  // Chrome divider lines
  chromeDivider: {
    height: 1,
    marginHorizontal: 10,
  },

  frontFrame: {
    flex: 1,
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
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
    lineHeight: 30,
    fontWeight: '300',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  frontFooter: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    paddingTop: 6,
  },
  frontFooterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  frontFooterText: {
    fontFamily: FONTS.body,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // ── Swipe hints ──
  swipeHint: {
    position: 'absolute',
    top: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  swipeHintRight: {
    left: 16,
    backgroundColor: 'rgba(122, 30, 78, 0.9)',
  },
  swipeHintLeft: {
    right: 16,
    backgroundColor: 'rgba(60, 50, 80, 0.9)',
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
