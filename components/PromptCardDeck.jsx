// components/PromptCardDeck.jsx
// A swipeable card-stack for browsing prompts — feels like drawing from a deck.
// Swipe right → open/answer · Swipe left → skip · Tap → flip to reveal.
// Quiet, intimate animations aligned with Brand Guardrails.

import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  Platform,
  TouchableWithoutFeedback,
  Animated as RNAnimated,
} from "react-native";
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
  useAnimatedSensor,
  SensorType,
  Extrapolation,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  impact,
  notification,
  selection,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from "../utils/haptics";
import { useTheme } from "../context/ThemeContext";
import { SPACING, BORDER_RADIUS } from "../utils/theme";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const CARD_W = SCREEN_W - 72; // Increased margins to make the card smaller
const CARD_H = Math.min(SCREEN_H * 0.55, 460); // Reduced height constraint
const SWIPE_THRESHOLD = SCREEN_W * 0.28;

const SPRING_CONFIG = { damping: 22, stiffness: 180, mass: 0.8 };
const FLIP_DURATION = 500;

const FONTS = {
  serif: Platform.select({
    ios: "DMSerifDisplay-Regular",
    android: "DMSerifDisplay_400Regular",
    default: "serif",
  }),
  serifAccent: Platform.select({
    ios: "DMSerifDisplay-Regular",
    android: "DMSerifDisplay_400Regular",
    default: "serif",
  }),
  body: Platform.select({
    ios: "Lato-Regular",
    android: "Lato_400Regular",
    default: "sans-serif",
  }),
  bodyBold: Platform.select({
    ios: "Lato-Bold",
    android: "Lato_700Bold",
    default: "sans-serif",
  }),
};

// Heat-level gradient + icon + label mapping
const HEAT_COLORS = {
  1: ["#F7A8B8", "#D68898"], // Innocent pink gradient
  2: ["#F27A9B", "#C85A7B"], // Rose pink gradient
  3: ["#E84A7B", "#A83A5A"], // Hot pink gradient
  4: ["#E23A68", "#A42045"], // Crimson gradient
  5: ["#B81438", "#6A081A"], // Dark ruby gradient
};
// Metallic base tones per heat (dark chrome → accent)
const HEAT_METAL = {
  1: {
    base: "#2A1820",
    chrome: "#FFD6E0",
    highlight: "#FFE8EE",
    mid: "#D68898",
  },
  2: {
    base: "#251218",
    chrome: "#FFB8C8",
    highlight: "#FFD6E0",
    mid: "#C85A7B",
  },
  3: {
    base: "#200A10",
    chrome: "#FF88AA",
    highlight: "#FFB8C8",
    mid: "#A83A5A",
  },
  4: {
    base: "#1C060A",
    chrome: "#FF5588",
    highlight: "#FF88AA",
    mid: "#A42045",
  },
  5: {
    base: "#150305",
    chrome: "#FF3355",
    highlight: "#FF5588",
    mid: "#6A081A",
  },
};
const HEAT_ICONS = {
  1: "spa-outline",
  2: "star-four-points-outline",
  3: "cards-heart-outline",
  4: "water-outline",
  5: "fire",
};
const HEAT_LABELS = {
  1: "1",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
};

// ────────────────────────────────────────────────────────
// Single card — handles flip + swipe
// ────────────────────────────────────────────────────────
function DeckCard({
  item,
  index,
  isTop,
  onSwipeRight,
  onSwipeLeft,
  colors,
  isDark,
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotateZ = useSharedValue(0);
  const flipProgress = useSharedValue(0); // 0 = back, 1 = front
  const [isFlipped, setIsFlipped] = useState(false);
  const scale = useSharedValue(1);

  const heat = item?.heat || 1;
  const getCatGradient = () => {
    if (isDark) {
      return HEAT_COLORS[heat] || ["#B07EFF", "#9060E0"];
    }
    return [colors.primary, colors.primaryMuted || colors.primary];
  };
  const catGradient = getCatGradient();
  const catIcon = HEAT_ICONS[heat] || "heart-outline";
  const catLabel = HEAT_LABELS[heat] || "1";
  
  const getMetal = () => {
    if (isDark) return HEAT_METAL[heat] || HEAT_METAL[1];
    return {
      base: colors.surface,
      chrome: colors.primaryGlow || colors.primary,
      highlight: colors.primary,
      mid: colors.border,
    };
  };
  const metal = getMetal();

  // Device rotation sensor for subtle metallic shimmer
  const rotationSensor = useAnimatedSensor(SensorType.ROTATION, {
    interval: 16,
  });

  // Continuous subtle loop to keep the metal "alive" even when still
  const shimmerLoop = useSharedValue(0);
  useEffect(() => {
    shimmerLoop.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  // Compute combined shimmer transform (loop + tracking device tilt + pan gesture)
  const shimmerAnimatedStyle = useAnimatedStyle(() => {
    const pitch = rotationSensor.sensor.value.pitch || 0;
    const roll = rotationSensor.sensor.value.roll || 0;

    // Combine device tilt and gesture drag into a phase shift
    // pitch & roll are in radians (up to ~1.5). Drag mapped relative to card width.
    const interactionPhase =
      pitch * 0.8 + roll * 0.8 + (translateX.value / CARD_W) * 0.5;

    // Total raw phase: time-based loop + interaction phase
    // Use true modulo mapping [0, 1) constantly
    let totalPhase = (shimmerLoop.value + interactionPhase) % 1;
    if (totalPhase < 0) totalPhase += 1;

    // Map the 0..1 phase linearly across the card space (-1.5 to 1.5 lets it organically enter & exit)
    const finalTranslate = interpolate(
      totalPhase,
      [0, 1],
      [-CARD_W * 1.5, CARD_W * 1.5]
    );

    return {
      transform: [{ translateX: finalTranslate }, { rotate: "45deg" }],
    };
  });

  // Pulse animation for 'tap to reveal' text
  const pulseAnim = useSharedValue(0.4);
  useEffect(() => {
    pulseAnim.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseAnim.value,
  }));

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

  const handleSwipeComplete = useCallback(
    (direction) => {
      impact(ImpactFeedbackStyle.Medium);
      if (direction === "right") {
        onSwipeRight?.(item);
      } else {
        onSwipeLeft?.(item);
      }
    },
    [item, onSwipeRight, onSwipeLeft]
  );

  const handleFlip = useCallback(() => {
    impact(ImpactFeedbackStyle.Light);
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
        const direction = e.translationX > 0 ? "right" : "left";
        const flyX = direction === "right" ? SCREEN_W * 1.5 : -SCREEN_W * 1.5;
        translateX.value = withTiming(flyX, {
          duration: 350,
          easing: Easing.out(Easing.cubic),
        });
        translateY.value = withTiming(e.translationY * 0.5, { duration: 350 });
        rotateZ.value = withTiming(e.translationX > 0 ? 15 : -15, {
          duration: 350,
        });
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
    const baseScale = isTop
      ? scale.value
      : interpolate(stackOffset, [0, 1, 2], [1, 0.95, 0.9]);
    return {
      transform: [
        { translateX: isTop ? translateX.value : 0 },
        { translateY: isTop ? translateY.value : stackOffset * 10 },
        { rotate: isTop ? `${rotateZ.value}deg` : `${stackOffset * -1.2}deg` },
        { scale: baseScale },
      ],
      zIndex: isTop ? 100 : 50 - index,
      opacity:
        index > 3 ? 0 : interpolate(index, [0, 1, 2, 3], [1, 0.7, 0.45, 0.2]),
    };
  });

  // ── Card back (face-down) ──
  const backStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 0.5, 1], [0, 90, 180]);
    return {
      transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: "hidden",
      opacity: flipProgress.value < 0.5 ? 1 : 0,
    };
  });

  // ── Card front (face-up — shows prompt text) ──
  const frontStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 0.5, 1], [180, 90, 0]);
    return {
      transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: "hidden",
      opacity: flipProgress.value > 0.5 ? 1 : 0,
    };
  });

  // Swipe hint overlays
  const rightHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 0.85],
      "clamp"
    ),
  }));
  const leftHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [0.85, 0],
      "clamp"
    ),
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.cardContainer, containerStyle]}>
        {/* ── BACK FACE ── */}
        <Animated.View style={[styles.card, backStyle, { borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)", shadowColor: isDark ? "#000" : "#666", shadowOpacity: isDark ? 0.6 : 0.2 } ]}>
          {/* Base dark metallic layer */}
          <LinearGradient
            colors={[metal.base, "#0A0A0F", metal.base]}
            style={styles.cardBack}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Metallic sheen overlay — diagonal color band */}
            <LinearGradient
              colors={[
                "transparent",
                metal.chrome + "08",
                metal.chrome + "18",
                metal.highlight + "22",
                metal.chrome + "18",
                metal.chrome + "08",
                "transparent",
              ]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />

            {/* Chrome edge highlights — top edge */}
            <LinearGradient
              colors={[metal.chrome + "30", "transparent"]}
              style={styles.topEdgeShine}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />

            {/* Chrome edge highlights — left edge */}
            <LinearGradient
              colors={[metal.chrome + "20", "transparent"]}
              style={styles.leftEdgeShine}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
            />

            {/* Animated shimmer band */}
            <Animated.View
              style={[styles.shimmerBand, shimmerAnimatedStyle]}
              pointerEvents="none"
            >
              <LinearGradient
                colors={[
                  "transparent",
                  "rgba(255,255,255,0.0)",
                  "rgba(255,255,255,0.03)",
                  "rgba(255,255,255,0.04)",
                  "rgba(255,255,255,0.03)",
                  "rgba(255,255,255,0.0)",
                  "transparent",
                ]}
                style={{ width: "100%", height: "100%" }}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
              />
            </Animated.View>

            {/* Chrome inner frame */}
            <View
              style={[styles.backFrame, { borderColor: metal.chrome + "35" }]}
            >
              {/* Metallic inner top line */}
              <LinearGradient
                colors={["transparent", metal.chrome + "40", "transparent"]}
                style={styles.frameTopLine}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
              />

              {/* Top heat number (no pill, no icon) */}
              <View style={styles.backTopNumber}>
                <Text
                  style={[styles.backTopNumberText, { color: catGradient[0] }]}
                >
                  {catLabel}
                </Text>
              </View>

              {/* Center emblem — chrome rings */}
              <View style={styles.backEmblem}>
                <View
                  style={[
                    styles.backEmblemOuter,
                    { borderColor: metal.chrome + "40" },
                  ]}
                >
                  <LinearGradient
                    colors={[
                      metal.chrome + "15",
                      "transparent",
                      metal.chrome + "10",
                    ]}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  <View
                    style={[
                      styles.backEmblemInner,
                      { borderColor: metal.chrome + "25" },
                    ]}
                  >
                    <LinearGradient
                      colors={[catGradient[0] + "30", "transparent"]}
                      style={StyleSheet.absoluteFill}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                    />
                    <MaterialCommunityIcons
                      name={catIcon}
                      size={32}
                      color={catGradient[0]}
                    />
                  </View>
                </View>
                <Text style={[styles.backLevelText, { color: catGradient[0] }]}>
                  {"✦ ".repeat(heat).trim()}
                </Text>
              </View>

              {/* Metallic inner bottom line */}
              <LinearGradient
                colors={["transparent", metal.chrome + "30", "transparent"]}
                style={styles.frameBottomLine}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
              />

              <Animated.Text
                style={[styles.backHint, { color: colors.text }, pulseStyle]}
              >
                TAP TO REVEAL
              </Animated.Text>
            </View>

            {/* Bottom edge shine */}
            <LinearGradient
              colors={["transparent", metal.chrome + "15"]}
              style={styles.bottomEdgeShine}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />
          </LinearGradient>
        </Animated.View>

        {/* ── FRONT FACE ── */}
        <Animated.View style={[styles.card, styles.cardFrontWrap, frontStyle, { borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)", shadowColor: isDark ? "#000" : "#666", shadowOpacity: isDark ? 0.6 : 0.2 } ]}>
          <View style={[styles.cardFront, { backgroundColor: metal.base }]}>
            {/* Metallic base sheen */}
            <LinearGradient
              colors={[metal.chrome + "08", "transparent", metal.chrome + "06"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />

            {/* Top edge chrome highlight */}
            <LinearGradient
              colors={[metal.chrome + "25", "transparent"]}
              style={styles.frontTopShine}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />

            {/* Animated shimmer on front too */}
            <Animated.View
              style={[
                styles.shimmerBand,
                shimmerAnimatedStyle,
              ]}
              pointerEvents="none"
            >
              <LinearGradient
                colors={[
                  "transparent",
                  "rgba(255,255,255,0.0)",
                  "rgba(255,255,255,0.03)",
                  "rgba(255,255,255,0.04)",
                  "rgba(255,255,255,0.03)",
                  "rgba(255,255,255,0.0)",
                  "transparent",
                ]}
                style={{ width: "100%", height: "100%" }}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
              />
            </Animated.View>

            {/* Top band — brushed metal with heat accent */}
            <LinearGradient
              colors={[catGradient[0], catGradient[1] || catGradient[0]]}
              style={styles.frontBand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {/* Chrome top edge on band */}
              <LinearGradient
                colors={["rgba(255,255,255,0.08)", "transparent"]}
                style={styles.bandTopEdge}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
              />
              <View style={styles.frontBandLeft}>
                <Text
                  style={[
                    styles.frontBandLabel,
                    { color: colors.text, fontSize: 24, letterSpacing: 0 },
                  ]}
                >
                  {catLabel}
                </Text>
              </View>
              <Text style={[styles.frontBandLevel, { color: colors.text }]}>
                {"✦".repeat(heat)}
              </Text>
            </LinearGradient>

            {/* Chrome separator line under band */}
            <LinearGradient
              colors={[
                "transparent",
                metal.chrome + "40",
                metal.highlight + "50",
                metal.chrome + "40",
                "transparent",
              ]}
              style={styles.chromeDivider}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
            />

            {/* Inner card frame — metallic border */}
            <View
              style={[styles.frontFrame, { borderColor: metal.chrome + "18" }]}
            >
              {/* Subtle inner gradient */}
              <LinearGradient
                colors={[
                  metal.chrome + "06",
                  "transparent",
                  metal.chrome + "04",
                ]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.frontBody}>
                <ScrollView contentContainerStyle={{flexGrow: 1, justifyContent: "center" }} showsVerticalScrollIndicator={false}>
                  <Text
                    style={[
                      styles.frontPromptText,
                      {
                        color: colors.text,
                        fontSize:
                          (item?.text?.length || 0) > 180
                            ? 15
                            : (item?.text?.length || 0) > 120
                            ? 17
                            : 20,
                      },
                    ]}
                  >
                    {item?.text || "Something beautiful awaits…"}
                  </Text>
                </ScrollView>
              </View>
            </View>

            {/* Chrome separator above footer */}
            <LinearGradient
              colors={[
                "transparent",
                metal.chrome + "30",
                metal.highlight + "40",
                metal.chrome + "30",
                "transparent",
              ]}
              style={styles.chromeDivider}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
            />

            {/* Bottom bar */}
            <View style={styles.frontFooter}>
              <View style={styles.frontFooterContent}>
                <Text
                  style={[
                    styles.frontFooterText,
                    {
                      color: colors.text,
                      textShadowColor: catGradient[0],
                      textShadowOffset: { width: 0, height: 0 },
                      textShadowRadius: 6,
                    },
                  ]}
                >
                  swipe right to reflect
                </Text>
                <MaterialCommunityIcons
                  name="arrow-right"
                  size={14}
                  color="#FFFFFF"
                  style={{
                    textShadowColor: catGradient[0],
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 6,
                  }}
                />
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── Swipe hint overlays (only for top card) ── */}
        {isTop && (
          <>
            <Animated.View
              style={[styles.swipeHint, styles.swipeHintRight, rightHintStyle]}
            >
              <MaterialCommunityIcons
                name="pencil-outline"
                size={28}
                color="#F2E9E6"
              />
              <Text style={styles.swipeHintText}>Reflect</Text>
            </Animated.View>
            <Animated.View
              style={[styles.swipeHint, styles.swipeHintLeft, leftHintStyle]}
            >
              <MaterialCommunityIcons
                name="arrow-right"
                size={28}
                color="#F2E9E6"
              />
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
export default function PromptCardDeck({
  prompts = [],
  onSelect,
  onSkip,
  onDraw,
}) {
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

  const handleSwipeRight = useCallback(
    (item) => {
      onSelect?.(item);
      // Brief delay so the fly-out animation finishes
      setTimeout(advanceCard, 200);
    },
    [onSelect, advanceCard]
  );

  const handleSwipeLeft = useCallback(
    (item) => {
      onSkip?.(item);
      setTimeout(advanceCard, 200);
    },
    [onSkip, advanceCard]
  );

  const handleDraw = useCallback(() => {
    impact(ImpactFeedbackStyle.Medium);
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
        {visibleCards
          .map((item, i) => (
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
          ))
          .reverse()}
      </View>

      {/* Draw button */}
      <Animated.View
        entering={FadeIn.duration(600).delay(300)}
        style={styles.controls}
      >
        <TouchableWithoutFeedback onPress={handleDraw}>
          <Animated.View
            style={[
              styles.drawButton,
              { backgroundColor: colors.primary, borderColor: colors.primary },
              drawButtonStyle,
            ]}
          >
            <MaterialCommunityIcons
              name="cards-outline"
              size={18}
              color="#FFFFFF"
            />
            <Text style={[styles.drawButtonText, { color: colors.text }]}>
              Draw next
            </Text>
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
    alignItems: "center",
    justifyContent: "center",
  },

  stackArea: {
    width: CARD_W,
    height: CARD_H,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Shared card shell ──
  cardContainer: {
    position: "absolute",
    width: CARD_W,
    height: CARD_H,
  },

  card: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: 18,
    overflow: "hidden",

    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.08)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.6,
        shadowRadius: 35,
      },
      android: { elevation: 20 },
    }),
  },

  // ── Back face ──
  cardBack: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },

  // Chrome edge shine overlays
  topEdgeShine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  leftEdgeShine: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 40,
  },
  bottomEdgeShine: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },

  // Animated shimmer band
  shimmerBand: {
    position: "absolute",
    top: -CARD_H * 0.3,
    width: CARD_W * 0.35,
    height: CARD_H * 1.8,
  },

  backFrame: {
    flex: 1,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "space-evenly",
    borderWidth: 3,
    borderRadius: 12,
    margin: 8,
    paddingTop: 32,
    paddingBottom: 32,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.02)",
    overflow: "hidden",
  },

  // Fine metallic lines inside frame
  frameTopLine: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    height: 4,
  },
  frameBottomLine: {
    position: "absolute",
    bottom: 46,
    left: 16,
    right: 16,
    height: 4,
  },

  backTopNumber: {
    alignItems: "center",
    justifyContent: "center",
    // Constrain height so the big number doesn't push other elements down
    height: 60,
  },
  backTopNumberText: {
    fontFamily: FONTS.serifAccent,
    fontSize: 56,
    lineHeight: 60,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  backEmblem: {
    alignItems: "center",
    gap: 12,
  },
  backEmblemOuter: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#070509",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {},
    }),
  },
  backEmblemInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
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
    textTransform: "uppercase",
  },

  // ── Front face ──
  cardFrontWrap: {},

  cardFront: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
  },

  frontTopShine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 50,
    zIndex: 1,
  },

  frontBand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: "hidden",
  },
  bandTopEdge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  frontBandLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  frontBandLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  frontBandLevel: {
    fontSize: 12,
    letterSpacing: 3,
  },

  // Chrome divider lines
  chromeDivider: {
    height: 4,
    marginHorizontal: 10,
  },

  frontFrame: {
    flex: 1,
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 6,
    borderWidth: 3,
    borderRadius: 10,
    overflow: "hidden",
  },

  frontBody: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  frontPromptText: {
    fontFamily: FONTS.serifAccent,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "300",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  frontFooter: {
    paddingHorizontal: 18,
    paddingBottom: 24,
    paddingTop: 6,
  },
  frontFooterContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  frontFooterText: {
    fontFamily: FONTS.body,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },

  // ── Swipe hints ──
  swipeHint: {
    position: "absolute",
    top: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.08)",
  },
  swipeHintRight: {
    left: 16,
    backgroundColor: "rgba(122, 30, 78, 0.9)",
  },
  swipeHintLeft: {
    right: 16,
    backgroundColor: "rgba(60, 50, 80, 0.9)",
  },
  swipeHintText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: "#F2E9E6",
    letterSpacing: 0.3,
  },

  // ── Controls ──
  controls: {
    alignItems: "center",
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
    gap: SPACING.md,
  },

  counterText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    letterSpacing: 0.3,
  },

  drawButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 3,
    gap: 8,
  },
  drawButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    letterSpacing: 0.3,
  },
});
