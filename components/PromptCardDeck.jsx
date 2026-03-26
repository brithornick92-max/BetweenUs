import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  interpolate,
  runOnJS,
  Easing,
  useAnimatedSensor,
  SensorType,
} from "react-native-reanimated";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from 'expo-blur';
import Icon from './Icon';
import { impact, ImpactFeedbackStyle } from "../utils/haptics";
import { useTheme } from "../context/ThemeContext";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const DEFAULT_CARD_W = SCREEN_W - 56;
const DEFAULT_CARD_H = Math.min(SCREEN_H * 0.62, 520);
const CARD_HORIZONTAL_MARGIN = 28;
const CARD_VERTICAL_MARGIN = 16;

const SPRING_CONFIG = { damping: 20, stiffness: 150, mass: 1 };
const FLIP_DURATION = 600;

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });
const SERIF_FONT = Platform.select({ ios: "Georgia", android: "serif" });

// Core: Almost white tint. Bloom: Pink-to-red heat progression.
const HEAT_NEON = {
  1: { core: "#FFF0F7", bloom: "#FF85C2" }, // Soft Orchid Pink
  2: { core: "#FFEBF4", bloom: "#FF1493" }, // Deep Pink
  3: { core: "#FFE8F0", bloom: "#FF006E" }, // Vivid Magenta-Red
  4: { core: "#FFE8EE", bloom: "#F00049" }, // Carmine
  5: { core: "#FFEBEB", bloom: "#D2121A" }, // Deep Red
};

// Deep Onyx tones — light-refracting Velvet Glass palette.
const HEAT_METAL = {
  1: { base: ["#120A0E", "#050204"], chrome: "#FF85C2" }, // Soft Orchid Pink
  2: { base: ["#12080C", "#050103"], chrome: "#FF1493" }, // Deep Pink
  3: { base: ["#120809", "#050102"], chrome: "#FF006E" }, // Vivid Magenta-Red
  4: { base: ["#120406", "#050001"], chrome: "#F00049" }, // Carmine
  5: { base: ["#120202", "#050000"], chrome: "#D2121A" }, // Deep Red
};

const HEAT_ICONS = {
  1: "chatbubble-outline",
  2: "sparkles-outline",
  3: "heart-outline",
  4: "water-outline",
  5: "flame-outline",
};

function DeckCard({ item, index, isTop, onSwipeRight, onSwipeLeft, onLongPress, isDark, colors, cardWidth, cardHeight, shimmerBandStyle }) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotateZ = useSharedValue(0);
  const flipProgress = useSharedValue(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const scale = useSharedValue(1);
  const swipeThreshold = cardWidth * 0.32;

  const heat = item?.heat || 1;
  const neon = HEAT_NEON[heat] || HEAT_NEON[1];
  const catIcon = HEAT_ICONS[heat] || "heart-outline";
  const metal = HEAT_METAL[heat] || HEAT_METAL[1];

  const rotationSensor = useAnimatedSensor(SensorType.ROTATION, { interval: 16 });

  const shimmerLoop = useSharedValue(0);
  useEffect(() => {
    shimmerLoop.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false);
  }, []);

  const shimmerAnimatedStyle = useAnimatedStyle(() => {
    const roll = rotationSensor.sensor.value.roll || 0;
    const sensorOffset = interpolate(roll, [-0.5, 0.5], [-cardWidth, cardWidth]);
    const finalTranslate = sensorOffset + (shimmerLoop.value * cardWidth * 2) - cardWidth;
    return { transform: [{ translateX: finalTranslate }, { rotate: "25deg" }] };
  }, [cardWidth]);

  const pulseAnim = useSharedValue(0.3);
  useEffect(() => {
    pulseAnim.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulseAnim.value }));

  useEffect(() => {
    if (isTop) {
      translateX.value = 0; translateY.value = 0; rotateZ.value = 0;
      flipProgress.value = 0; setIsFlipped(false);
      scale.value = withSpring(1, SPRING_CONFIG);
    }
  }, [isTop]);

  const handleSwipeComplete = useCallback((direction) => {
    impact(ImpactFeedbackStyle.Medium);
    if (direction === "right") onSwipeRight?.(item);
    else onSwipeLeft?.(item);
  }, [item, onSwipeRight, onSwipeLeft]);

  const handleLongPress = useCallback(() => {
    impact(ImpactFeedbackStyle.Light);
    onLongPress?.(item);
  }, [item, onLongPress]);

  const handleFlip = useCallback(() => {
    impact(ImpactFeedbackStyle.Light);
    const target = isFlipped ? 0 : 1;
    flipProgress.value = withTiming(target, { duration: FLIP_DURATION, easing: Easing.bezier(0.2, 0.8, 0.2, 1) });
    setIsFlipped(!isFlipped);
  }, [isFlipped, flipProgress]);

  const panGesture = Gesture.Pan()
    .enabled(isTop)
    .onStart(() => { scale.value = withSpring(1.02, SPRING_CONFIG); })
    .onUpdate((e) => {
      translateX.value = e.translationX; translateY.value = e.translationY * 0.3; rotateZ.value = e.translationX * 0.06;
    })
    .onEnd((e) => {
      scale.value = withSpring(1, SPRING_CONFIG);
      if (Math.abs(e.translationX) > swipeThreshold) {
        const direction = e.translationX > 0 ? "right" : "left";
        const flyX = direction === "right" ? SCREEN_W * 1.5 : -SCREEN_W * 1.5;
        translateX.value = withTiming(flyX, { duration: 350, easing: Easing.out(Easing.cubic) });
        translateY.value = withTiming(e.translationY * 0.5, { duration: 350 });
        rotateZ.value = withTiming(e.translationX > 0 ? 15 : -15, { duration: 350 });
        runOnJS(handleSwipeComplete)(direction);
      } else {
        translateX.value = withSpring(0, SPRING_CONFIG); translateY.value = withSpring(0, SPRING_CONFIG); rotateZ.value = withSpring(0, SPRING_CONFIG);
      }
    });

  const tapGesture = Gesture.Tap().enabled(isTop).onEnd(() => { runOnJS(handleFlip)(); });
  const longPressGesture = Gesture.LongPress()
    .enabled(isTop)
    .minDuration(500)
    .onStart(() => { runOnJS(handleLongPress)(); });
  const gesture = Gesture.Exclusive(longPressGesture, panGesture, tapGesture);

  const stackOffset = isTop ? 0 : Math.min(index, 2);

  const containerStyle = useAnimatedStyle(() => {
    const baseScale = isTop ? scale.value : interpolate(stackOffset, [0, 1, 2], [1, 0.95, 0.9]);
    return {
      transform: [
        { translateX: isTop ? translateX.value : 0 }, { translateY: isTop ? translateY.value : stackOffset * 15 },
        { rotate: isTop ? `${rotateZ.value}deg` : `${stackOffset * -1.2}deg` }, { scale: baseScale },
      ],
      zIndex: isTop ? 100 : 50 - index,
      opacity: index > 3 ? 0 : interpolate(index, [0, 1, 2, 3], [1, 0.8, 0.5, 0.2]),
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 0.5, 1], [0, 90, 180]);
    return { transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }], backfaceVisibility: "hidden", opacity: flipProgress.value < 0.5 ? 1 : 0 };
  });

  const frontStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 0.5, 1], [180, 90, 0]);
    return { transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }], backfaceVisibility: "hidden", opacity: flipProgress.value > 0.5 ? 1 : 0 };
  });

  const rightHintStyle = useAnimatedStyle(() => ({ opacity: interpolate(translateX.value, [0, swipeThreshold], [0, 0.9], "clamp") }), [swipeThreshold]);
  const leftHintStyle = useAnimatedStyle(() => ({ opacity: interpolate(translateX.value, [-swipeThreshold, 0], [0.9, 0], "clamp") }), [swipeThreshold]);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.cardContainer, { width: cardWidth, height: cardHeight }, containerStyle]}>

        {/* BACK FACE (The Cover) */}
        <Animated.View style={[styles.card, backStyle, { borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }]}>
          <LinearGradient colors={metal.base} style={styles.cardBack} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>

            {/* Metallic Shimmer Band */}
            <Animated.View style={[styles.shimmerBand, shimmerBandStyle, shimmerAnimatedStyle]} pointerEvents="none">
              <LinearGradient colors={["transparent", metal.chrome + "00", metal.chrome + "12", metal.chrome + "25", metal.chrome + "12", "transparent"]} style={{ width: "100%", height: "100%" }} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} />
            </Animated.View>

            {/* Elegant Outer Border */}
            <View style={[styles.backFrame, { borderColor: metal.chrome + "25" }]}>

              {/* Luxury Corner Suits */}
              <Icon name={catIcon} size={14} color={neon.bloom} style={[styles.cornerSuit, { top: 16, left: 16 }]} />
              <Icon name={catIcon} size={14} color={neon.bloom} style={[styles.cornerSuit, { top: 16, right: 16 }]} />

              <View style={styles.cardCenterLockup}>
                {/* Luminous Number with Heavy Bloom */}
                <Text style={[styles.heroNumber, {
                  color: neon.core,
                  textShadowColor: neon.bloom,
                  textShadowRadius: 25,
                  textShadowOffset: { width: 0, height: 0 },
                }]}>
                  {heat}
                </Text>

                {/* Sub-label instead of stars/circles */}
                <Text style={[styles.levelSubtext, { color: neon.bloom }]}>INTENSITY</Text>
              </View>

              <Animated.Text style={[styles.backHint, { color: metal.chrome }, pulseStyle]}>TAP TO REVEAL</Animated.Text>
            </View>

          </LinearGradient>
        </Animated.View>

        {/* FRONT FACE (The Prompt) */}
        <Animated.View style={[styles.card, frontStyle, { borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }]}>
          <View style={[styles.cardFront, { backgroundColor: metal.base[0] }]}>

            {/* Metallic Shimmer Band */}
            <Animated.View style={[styles.shimmerBand, shimmerBandStyle, shimmerAnimatedStyle]} pointerEvents="none">
              <LinearGradient colors={["transparent", metal.chrome + "00", metal.chrome + "10", metal.chrome + "20", metal.chrome + "10", "transparent"]} style={{ width: "100%", height: "100%" }} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} />
            </Animated.View>

            {/* Front Band */}
            <LinearGradient colors={["#111", "#000"]} style={styles.frontBand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={styles.frontBandLeft}>
                <Text style={[styles.frontBandLabel, { color: neon.core, textShadowColor: neon.bloom, textShadowRadius: 10 }]}>{heat}</Text>
              </View>
              <Icon name={catIcon} size={18} color={neon.bloom} />
            </LinearGradient>

            <LinearGradient colors={["transparent", metal.chrome + "50", "transparent"]} style={styles.chromeDivider} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} />

            <View style={styles.frontBody}>
              <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }} showsVerticalScrollIndicator={false}>
                <Text style={[styles.frontPromptText, { color: "#FFFFFF", fontSize: (item?.text?.length || 0) > 180 ? 20 : (item?.text?.length || 0) > 120 ? 24 : 28 }]}>
                  {item?.text || "Something beautiful awaits\u2026"}
                </Text>
              </ScrollView>
            </View>

            <LinearGradient colors={["transparent", metal.chrome + "50", "transparent"]} style={styles.chromeDivider} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} />

            <View style={styles.frontFooter}>
              <BlurView intensity={20} tint="dark" style={styles.footerBlur}>
                <Text style={[styles.frontFooterText, { color: neon.bloom }]}>SWIPE RIGHT TO REFLECT</Text>
                <Icon name="arrow-forward" size={14} color={neon.bloom} />
              </BlurView>
            </View>
          </View>
        </Animated.View>

        {/* Swipe hints */}
        {isTop && (
          <>
            <Animated.View style={[styles.swipeHint, styles.swipeHintRight, rightHintStyle]}>
              <Icon name="pencil-outline" size={24} color="#FFF" />
              <Text style={styles.swipeHintText}>Reflect</Text>
            </Animated.View>
            <Animated.View style={[styles.swipeHint, styles.swipeHintLeft, leftHintStyle, { backgroundColor: colors.surface2 }]}>
              <Icon name="close-outline" size={24} color="#FFF" />
              <Text style={styles.swipeHintText}>Skip</Text>
            </Animated.View>
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

export default function PromptCardDeck({ prompts = [], onSelect, onSkip, onLongPress }) {
  const { isDark, colors } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deckLayout, setDeckLayout] = useState({ width: DEFAULT_CARD_W + (CARD_HORIZONTAL_MARGIN * 2), height: DEFAULT_CARD_H + (CARD_VERTICAL_MARGIN * 2) });
  const visibleCards = useMemo(() => prompts.slice(currentIndex, currentIndex + 4), [prompts, currentIndex]);
  const advanceCard = useCallback(() => setCurrentIndex((prev) => (prev >= prompts.length - 1 ? 0 : prev + 1)), [prompts.length]);

  const cardWidth = useMemo(() => {
    if (!deckLayout.width) return DEFAULT_CARD_W;
    const availableWidth = Math.max(deckLayout.width - (CARD_HORIZONTAL_MARGIN * 2), 220);
    return Math.min(DEFAULT_CARD_W, availableWidth);
  }, [deckLayout.width]);

  const cardHeight = useMemo(() => {
    if (!deckLayout.height) return DEFAULT_CARD_H;
    const availableHeight = Math.max(deckLayout.height - (CARD_VERTICAL_MARGIN * 2), 220);
    return Math.min(DEFAULT_CARD_H, availableHeight);
  }, [deckLayout.height]);

  const shimmerBandStyle = useMemo(() => ({
    top: -cardHeight / 2,
    width: cardWidth,
    height: cardHeight * 2,
  }), [cardHeight, cardWidth]);

  const handleDeckLayout = useCallback((event) => {
    const { width, height } = event.nativeEvent.layout;
    if (!width || !height) return;
    setDeckLayout((prev) => {
      if (prev.width === width && prev.height === height) return prev;
      return { width, height };
    });
  }, []);

  const handleSwipeRight = useCallback((item) => { onSelect?.(item); setTimeout(advanceCard, 200); }, [onSelect, advanceCard]);
  const handleSwipeLeft = useCallback((item) => { onSkip?.(item); setTimeout(advanceCard, 200); }, [onSkip, advanceCard]);

  if (!prompts.length) return null;

  return (
    <View style={styles.deck} onLayout={handleDeckLayout}>
      <View style={[styles.stackArea, { width: cardWidth, height: cardHeight }] }>
        {visibleCards.map((item, i) => (
          <DeckCard
            key={`${item?.id || i}_${currentIndex + i}`}
            item={item}
            index={i}
            isTop={i === 0}
            onSwipeRight={handleSwipeRight}
            onSwipeLeft={handleSwipeLeft}
            onLongPress={onLongPress}
            isDark={isDark}
            colors={colors}
            cardWidth={cardWidth}
            cardHeight={cardHeight}
            shimmerBandStyle={shimmerBandStyle}
          />
        )).reverse()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  deck: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: CARD_HORIZONTAL_MARGIN, paddingVertical: CARD_VERTICAL_MARGIN },
  stackArea: { alignItems: "center", justifyContent: "center" },
  cardContainer: { position: "absolute" },
  card: {
    position: "absolute", width: "100%", height: "100%", borderRadius: 28, borderWidth: 1, overflow: "hidden", backgroundColor: "#000",
    shadowColor: "#000", shadowOffset: { width: 0, height: 25 }, shadowOpacity: 0.9, shadowRadius: 35, elevation: 20
  },
  shimmerBand: { position: "absolute", zIndex: 10 },
  cardBack: { flex: 1, padding: 12 },
  backFrame: {
    flex: 1, alignItems: "center", justifyContent: "space-between",
    borderWidth: 1, borderRadius: 16, paddingVertical: 32, paddingHorizontal: 16
  },
  cornerSuit: { position: 'absolute', opacity: 0.8 },
  cardCenterLockup: { alignItems: 'center', justifyContent: 'center' },
  heroNumber: { fontFamily: SYSTEM_FONT, fontSize: 96, lineHeight: 104, fontWeight: "200" },
  levelSubtext: { fontFamily: SYSTEM_FONT, fontSize: 12, fontWeight: '800', letterSpacing: 8, marginTop: 6, opacity: 0.9 },
  backHint: { fontFamily: SYSTEM_FONT, fontSize: 11, fontWeight: '800', letterSpacing: 2, textTransform: "uppercase" },

  cardFront: { flex: 1, borderRadius: 28, overflow: "hidden" },
  frontBand: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 18 },
  frontBandLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  frontBandLabel: { fontFamily: SERIF_FONT, fontSize: 32, lineHeight: 36 },
  chromeDivider: { height: 1, marginHorizontal: 20, opacity: 0.5 },
  frontBody: { flex: 1, justifyContent: "center", paddingHorizontal: 28, paddingVertical: 24 },
  frontPromptText: { fontFamily: SERIF_FONT, lineHeight: 36, fontWeight: "400", textAlign: "center" },
  frontFooter: { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 16 },
  footerBlur: { flex: 1, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  frontFooterText: { fontFamily: SYSTEM_FONT, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: "uppercase" },

  swipeHint: { position: "absolute", top: 20, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 2, borderColor: "rgba(255,255,255,0.15)" },
  swipeHintRight: { left: 16, backgroundColor: "#D2121A" },
  swipeHintLeft: { right: 16 },
  swipeHintText: { fontFamily: SYSTEM_FONT, fontSize: 14, fontWeight: "800", color: "#FFF", letterSpacing: 0.5, textTransform: "uppercase" },
});
