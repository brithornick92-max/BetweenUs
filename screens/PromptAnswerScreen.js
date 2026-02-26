import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  TextInput,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { useAppContext } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import { useEntitlements } from "../context/EntitlementsContext";
import { promptStorage } from "../utils/storage";
import {
  TYPOGRAPHY,
  SPACING,
  BORDER_RADIUS,
  ICON_SIZES,
} from "../utils/theme";

const MAX_LEN = 1000;

// Heat-level colours, icons, and labels for card accent
const HEAT_COLORS = {
  1: ['#B07EFF', '#9060E0'],
  2: ['#FF7EB8', '#E0609A'],
  3: ['#FF7080', '#E05468'],
  4: ['#FF8534', '#E06820'],
  5: ['#FF2D2D', '#E01818'],
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

const INSPIRATION_CHIPS = [
  "I remember when...",
  "I appreciate that you...",
  "I dream of...",
  "It makes me smile when...",
  "I feel safest when...",
  "One thing I've learned..."
];

export default function PromptAnswerScreen({ route, navigation }) {
  const { prompt } = route.params || {};
  const { state } = useAppContext();
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();

  const [answer, setAnswer] = useState("");
  const [existingAnswer, setExistingAnswer] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const lastHapticLength = useRef(0);

  // Card-flip animation: card arrives face-down, then flips to reveal the prompt
  const flipProgress = useSharedValue(0); // 0 = back, 1 = front
  const dealY = useSharedValue(-60);
  const dealScale = useSharedValue(0.85);
  const dealOpacity = useSharedValue(0);

  const heat = prompt?.heat || 1;
  const catGradient = HEAT_COLORS[heat] || ['#B07EFF', '#9060E0'];
  const catIcon = HEAT_ICONS[heat] || 'hand-heart';
  const catLabel = HEAT_LABELS[heat] || 'Emotional';

  const styles = useMemo(() => createStyles(colors), [colors]);

  // Deal-in + flip on mount
  useEffect(() => {
    // Deal card in
    dealOpacity.value = withTiming(1, { duration: 300 });
    dealY.value = withSpring(0, { damping: 22, stiffness: 180, mass: 0.8 });
    dealScale.value = withSpring(1, { damping: 22, stiffness: 180, mass: 0.8 });
    // Auto-flip after deal completes
    const flipTimer = setTimeout(() => {
      flipProgress.value = withTiming(1, {
        duration: 600,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      });
      setIsFlipped(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, 500);
    return () => clearTimeout(flipTimer);
  }, []);

  // Animated styles for the card container (deal-in)
  const dealStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: dealY.value },
      { scale: dealScale.value },
    ],
    opacity: dealOpacity.value,
  }));

  // Back face (category gradient, face-down)
  const backFaceStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 0.5, 1], [0, 90, 180]);
    return {
      transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: 'hidden',
      opacity: flipProgress.value < 0.5 ? 1 : 0,
    };
  });

  // Front face (prompt text, face-up)
  const frontFaceStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 0.5, 1], [180, 90, 0]);
    return {
      transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: 'hidden',
      opacity: flipProgress.value > 0.5 ? 1 : 0,
    };
  });

  // Free users cannot respond to prompts
  useEffect(() => {
    if (!isPremium) {
      showPaywall?.('promptResponses');
      navigation.goBack();
    }
  }, [isPremium]);

  useEffect(() => {
    if (prompt) loadExistingAnswer();
  }, [prompt]);

  const loadExistingAnswer = async () => {
    if (!prompt?.id || !prompt?.dateKey) return;
    const saved = await promptStorage.getAnswer(prompt.dateKey, prompt.id);
    if (saved?.answer) {
      setExistingAnswer(saved);
      setAnswer(saved.answer);
    }
  };

  const handleTextChange = (text) => {
    const truncated = text.slice(0, MAX_LEN);
    setAnswer(truncated);

    if (
      truncated.length > 0 &&
      truncated.length % 50 === 0 &&
      truncated.length !== lastHapticLength.current
    ) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      lastHapticLength.current = truncated.length;
    }
  };

  const handleSave = async () => {
    const finalText = answer.trim();
    if (!finalText || !prompt?.id || !prompt?.dateKey) return;

    if (finalText.length > MAX_LEN) {
      Alert.alert(
        "Too long",
        `Please shorten your reflection to ${MAX_LEN} characters or less.`
      );
      return;
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSaving(true);
    try {
      const payload = {
        answer: finalText,
        timestamp: Date.now(),
        isRevealed: existingAnswer?.isRevealed || false,
      };
      await promptStorage.setAnswer(prompt.dateKey, prompt.id, payload);
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", "We couldn't save your thoughts. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!prompt) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
      <LinearGradient
        colors={[colors.primary + "12", "transparent", "transparent"]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <Animated.View
          entering={FadeInUp.duration(600).delay(150)}
          style={styles.header}
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.closeBtn}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="close"
              size={ICON_SIZES.lg}
              color={colors.text}
            />
          </TouchableOpacity>

          <View style={styles.headerStatus}>
            <MaterialCommunityIcons
              name="lock-outline"
              size={12}
              color={colors.primary}
              style={{ opacity: 0.9 }}
            />
            <Text style={styles.statusText}>PRIVATE SPACE</Text>
          </View>

          <View style={{ width: 44 }} />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Flipping prompt card — deals in then flips to reveal */}
            <Animated.View style={[styles.glassCardContainer, dealStyle]}>
              {/* BACK FACE — category gradient, face-down */}
              <Animated.View style={[styles.cardFace, backFaceStyle]}>
                <LinearGradient
                  colors={catGradient}
                  style={styles.cardBackGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.cardBackPattern}>
                    <View style={styles.cardBackPatternInner}>
                      <MaterialCommunityIcons name={catIcon} size={36} color="rgba(255,255,255,0.25)" />
                    </View>
                  </View>
                  <View style={styles.cardBackPill}>
                    <MaterialCommunityIcons name={catIcon} size={14} color="rgba(255,255,255,0.9)" />
                    <Text style={styles.cardBackPillText}>{catLabel}</Text>
                  </View>
                  {/* Corner flourishes */}
                  <Text style={[styles.cornerMark, { top: 14, left: 14 }]}>✦</Text>
                  <Text style={[styles.cornerMark, { top: 14, right: 14 }]}>✦</Text>
                  <Text style={[styles.cornerMark, { bottom: 14, left: 14 }]}>✦</Text>
                  <Text style={[styles.cornerMark, { bottom: 14, right: 14 }]}>✦</Text>
                </LinearGradient>
              </Animated.View>

              {/* FRONT FACE — prompt text */}
              <Animated.View style={[styles.cardFace, frontFaceStyle]}>
                <BlurView intensity={25} tint={isDark ? "dark" : "light"} style={styles.blurCard}>
                    {/* Category band */}
                    <LinearGradient
                      colors={catGradient}
                      style={styles.cardFrontBand}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <MaterialCommunityIcons name={catIcon} size={14} color="rgba(255,255,255,0.9)" />
                      <Text style={styles.cardFrontBandText}>{catLabel}</Text>
                    </LinearGradient>

                  <View style={styles.promptContent}>
                    <Text style={styles.promptText}>{prompt?.text}</Text>
                  </View>
                </BlurView>
              </Animated.View>
            </Animated.View>

            <Animated.View
              entering={FadeIn.duration(800).delay(300)}
              style={styles.inputWrapper}
            >
              <View style={styles.charCountRow}>
                <Text style={styles.inputLabel}>YOUR THOUGHTS</Text>
                <Text
                  style={[
                    styles.charCount,
                    answer.length >= MAX_LEN && { color: colors.primary },
                  ]}
                >
                  {answer.length}/{MAX_LEN}
                </Text>
              </View>

              <TextInput
                value={answer}
                onChangeText={handleTextChange}
                placeholder="What comes to mind..."
                placeholderTextColor={colors.text + "40"}
                multiline
                autoFocus
                selectionColor={colors.primary}
                style={styles.textInput}
                maxLength={MAX_LEN}
              />
            </Animated.View>

            <Animated.View
              entering={FadeIn.duration(600).delay(600)}
              style={styles.footer}
            >
              <View style={styles.privacyHint}>
                <MaterialCommunityIcons
                  name="shield-check-outline"
                  size={14}
                  color={colors.primary}
                  style={{ opacity: 0.7 }}
                />
                <Text style={styles.privacyText}>
                  Your partner only sees this once you both choose to reveal.
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleSave}
                disabled={!answer.trim() || isSaving}
                activeOpacity={0.85}
                style={[
                  styles.saveButton,
                  (!answer.trim() || isSaving) && styles.saveButtonDisabled,
                ]}
              >
                  <Text style={[styles.saveButtonText, { color: '#FFFFFF' }]}> 
                  {isSaving
                    ? "Saving..."
                    : existingAnswer
                      ? "Update Reflection"
                      : "Share My Heart"}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerStatus: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary + "15",
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: colors.primary + "30",
  },
  // Inspiration Chips
  chipsContainer: {
    marginBottom: SPACING.lg,
  },
  chipsLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    color: 'rgba(150,150,150,0.6)',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  chipsScroll: {
    gap: 8,
    paddingRight: SPACING.xl,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusText: {
    ...TYPOGRAPHY.caption,
    color: colors.primary,
    marginLeft: 6,
    letterSpacing: 1.5,
    fontSize: 10,
    fontWeight: "600",
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xxxl,
  },
  glassCardContainer: {
    marginBottom: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    overflow: "hidden",
    minHeight: Math.min(Dimensions.get('window').height * 0.85, 720),
  },
  cardFace: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: BORDER_RADIUS.xl,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: '#060410',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: { elevation: 6 },
    }),
  },
  cardBackGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
  },
  cardBackPattern: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
  },
  cardBackPatternInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: "center",
    justifyContent: "center",
  },
  cardBackPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    gap: 6,
  },
  cardBackPillText: {
    fontWeight: "600",
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.5,
  },
  cornerMark: {
    position: "absolute",
    fontSize: 13,
    color: 'rgba(255,255,255,0.18)',
  },
  cardFrontBand: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
  },
  cardFrontBandText: {
    fontWeight: "600",
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  blurCard: {
    flex: 1,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: (colors.surface2 || colors.surface) + "80",
  },
  promptContent: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  promptLabel: {
    ...TYPOGRAPHY.label,
    color: colors.primary,
    marginBottom: SPACING.lg,
    opacity: 0.9,
  },
  promptText: {
    fontFamily: Platform.select({
      ios: "Playfair Display",
      android: "PlayfairDisplay_300Light",
    }),
    fontSize: 18,
    lineHeight: 26,
    color: colors.text,
    textAlign: "center",
    fontWeight: "300",
    marginBottom: SPACING.md,
  },
  inputWrapper: {
    flex: 1,
    minHeight: 280,
  },
  charCountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
    paddingHorizontal: 4,
  },
  inputLabel: {
    ...TYPOGRAPHY.label,
    color: colors.text + "CC", // textSecondary approx
  },
  charCount: {
    fontSize: 12,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  textInput: {
    fontSize: 18,
    lineHeight: 28,
    color: colors.text,
    textAlignVertical: "top",
    paddingTop: 0,
    minHeight: 220,
    fontFamily: Platform.select({
      ios: "Inter",
      android: "Inter_400Regular",
    }),
  },
  footer: {
    marginTop: SPACING.lg,
  },
  privacyHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  privacyText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    marginLeft: SPACING.sm,
    lineHeight: 18,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: BORDER_RADIUS.lg,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});
