// screens/PromptAnswerScreen.js — Full Editorial Implementation
// Velvet Glass · Hand-drawn reflection · Physics-based Card-flip

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
import Icon from '../components/Icon';
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import {
  impact,
  notification,
  selection,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from "../utils/haptics";
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
import { TYPOGRAPHY, SPACING, BORDER_RADIUS, ICON_SIZES } from "../utils/theme";

const MAX_LEN = 1000;

// Heat-level colours, icons, and labels for card accent
const HEAT_COLORS = {
  1: ["#7A1E4E", "#5E1940"],
  2: ["#9A2E5E", "#7A1E4E"],
  3: ["#B84070", "#9A2E5E"],
  4: ["#C45060", "#A83850"],
  5: ["#D04848", "#B03030"],
};
const HEAT_ICONS = {
  1: "spa-outline",
  2: "star-four-points-outline",
  3: "cards-heart-outline",
  4: "water-outline",
  5: "fire",
};
const HEAT_LABELS = {
  1: "Emotional",
  2: "Flirty",
  3: "Sensual",
  4: "Steamy",
  5: "Explicit",
};

const INSPIRATION_CHIPS = [
  "I remember when...",
  "I appreciate that you...",
  "I dream of...",
  "It makes me smile when...",
  "I feel safest when...",
  "One thing I've learned...",
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
  const dealY = useSharedValue(-100);
  const dealScale = useSharedValue(0.85);
  const dealOpacity = useSharedValue(0);

  const heat = prompt?.heat || 1;
  const isDarkRef = isDark;
  
  const getHeatColors = (heatLvl) => {
    if (isDarkRef) {
      const darkColors = {
        1: ["#7A1E4E", "#5E1940"],
        2: ["#9A2E5E", "#7A1E4E"],
        3: ["#B84070", "#9A2E5E"],
        4: ["#C45060", "#A83850"],
        5: ["#D04848", "#B03030"],
      };
      return darkColors[heatLvl] || darkColors[1];
    }
    
    // Light mode colors (warmer, readable tones on light backgrounds)
    return [colors.primary, colors.primaryMuted || colors.primary];
  };

  const catGradient = getHeatColors(heat);
  const catIcon = HEAT_ICONS[heat] || "hand-heart";
  const catLabel = HEAT_LABELS[heat] || "Emotional";

  const styles = useMemo(() => createStyles(colors), [colors]);

  // Deal-in + flip on mount
  useEffect(() => {
    // Stage 1: Deal the card in face-down
    dealOpacity.value = withTiming(1, { duration: 450 });
    dealY.value = withSpring(0, { damping: 18, stiffness: 120, mass: 1 });
    dealScale.value = withSpring(1, { damping: 18, stiffness: 120, mass: 1 });

    // Stage 2: Automatic flip to reveal the prompt text
    const flipTimer = setTimeout(() => {
      flipProgress.value = withTiming(1, {
        duration: 800,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      });
      setIsFlipped(true);
      impact(ImpactFeedbackStyle.Medium);
    }, 650);
    return () => clearTimeout(flipTimer);
  }, []);

  // Animated styles for the card container (deal-in)
  const dealStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dealY.value }, { scale: dealScale.value }],
    opacity: dealOpacity.value,
  }));

  // Back face (category gradient, face-down)
  const backFaceStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 0.5, 1], [0, 90, 180]);
    return {
      transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: "hidden",
      opacity: flipProgress.value < 0.5 ? 1 : 0,
    };
  });

  // Front face (prompt text, face-up)
  const frontFaceStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 0.5, 1], [180, 90, 0]);
    return {
      transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: "hidden",
      opacity: flipProgress.value > 0.5 ? 1 : 0,
    };
  });

  // Free users cannot respond to prompts
  useEffect(() => {
    if (!isPremium) {
      showPaywall?.("promptResponses");
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

    // Haptic punctuation: Subtle "tick" every 50 characters to provide tactile feedback
    if (
      truncated.length > 0 &&
      truncated.length % 50 === 0 &&
      truncated.length !== lastHapticLength.current
    ) {
      impact(ImpactFeedbackStyle.Light);
      lastHapticLength.current = truncated.length;
    }
  };

  const handleSave = async () => {
    const finalText = answer.trim();
    if (!finalText || !prompt?.id || !prompt?.dateKey) return;

    if (finalText.length > MAX_LEN) {
      Alert.alert(
        "Length Exceeded",
        `Please refine your thoughts to ${MAX_LEN} characters or less.`
      );
      return;
    }

    notification(NotificationFeedbackType.Success);
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
      Alert.alert("Moment Paused", "We couldn't lock in your reflection. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!prompt) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.background },
        ]}
      />
      <LinearGradient
        colors={[catGradient[0] + "18", "transparent", "transparent"]}
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
            <Icon
              name="close"
              size={ICON_SIZES.lg}
              color={colors.text}
            />
          </TouchableOpacity>

          <View style={styles.headerStatus}>
            <Icon
              name="shield-lock"
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
            {/* Flipping prompt card — high-end editorial physics */}
            <Animated.View style={[styles.glassCardContainer, dealStyle]}>
              {/* BACK FACE — category brand identity */}
              <Animated.View style={[styles.cardFace, backFaceStyle]}>
                <LinearGradient
                  colors={catGradient}
                  style={styles.cardBackGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.cardBackPattern}>
                    <View style={styles.cardBackPatternInner}>
                      <Icon
                        name={catIcon}
                        size={36}
                        color="rgba(255,255,255,0.25)"
                      />
                    </View>
                  </View>
                  <View style={styles.cardBackPill}>
                    <Icon
                      name={catIcon}
                      size={14}
                      color="rgba(255,255,255,0.9)"
                    />
                    <Text style={styles.cardBackPillText}>{catLabel.toUpperCase()}</Text>
                  </View>
                  
                  {/* Luxury corner marks */}
                  <Text style={[styles.cornerMark, { top: 20, left: 20 }]}>✦</Text>
                  <Text style={[styles.cornerMark, { top: 20, right: 20 }]}>✦</Text>
                  <Text style={[styles.cornerMark, { bottom: 20, left: 20 }]}>✦</Text>
                  <Text style={[styles.cornerMark, { bottom: 20, right: 20 }]}>✦</Text>
                </LinearGradient>
              </Animated.View>

              {/* FRONT FACE — the drawn prompt text */}
              <Animated.View style={[styles.cardFace, frontFaceStyle]}>
                <BlurView
                  intensity={30}
                  tint={isDark ? "dark" : "light"}
                  style={styles.blurCard}
                >
                  {/* Category Accent Band */}
                  <LinearGradient
                    colors={catGradient}
                    style={styles.cardFrontBand}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Icon
                      name={catIcon}
                      size={14}
                      color="rgba(255,255,255,0.9)"
                    />
                    <Text style={styles.cardFrontBandText}>{catLabel}</Text>
                  </LinearGradient>

                  <View style={styles.promptContent}>
                    <Text style={styles.promptText}>{prompt?.text}</Text>
                  </View>
                </BlurView>
              </Animated.View>
            </Animated.View>

            {/* Inspiration Chips Section */}
            <View style={styles.chipsContainer}>
                <Text style={styles.chipsLabel}>Starting lines</Text>
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={styles.chipsScroll}
                >
                    {INSPIRATION_CHIPS.map((chip, idx) => (
                        <TouchableOpacity 
                            key={idx} 
                            style={[styles.chip, { backgroundColor: withAlpha(colors.primary, 0.05), borderColor: withAlpha(colors.primary, 0.2) }]}
                            onPress={() => {
                                impact(ImpactFeedbackStyle.Light);
                                setAnswer(prev => prev + (prev.length > 0 ? ' ' : '') + chip);
                            }}
                        >
                            <Text style={[styles.chipText, { color: colors.text }]}>{chip}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Private Reflection Input Section */}
            <Animated.View
              entering={FadeIn.duration(800).delay(800)}
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
                placeholder="Share your heart privately..."
                placeholderTextColor={colors.text + "40"}
                multiline
                autoFocus
                selectionColor={colors.primary}
                style={[styles.textInput, { color: colors.text }]}
                maxLength={MAX_LEN}
              />
            </Animated.View>

            {/* Footer & Privacy Guarantee */}
            <Animated.View
              entering={FadeIn.duration(600).delay(1000)}
              style={styles.footer}
            >
              <View style={styles.privacyHint}>
                <Icon
                  name="eye-off-outline"
                  size={14}
                  color={colors.primary}
                  style={{ opacity: 0.7 }}
                />
                <Text style={styles.privacyText}>
                  This reflection is locked until you both choose to reveal.
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleSave}
                disabled={!answer.trim() || isSaving}
                activeOpacity={0.85}
                style={[
                  styles.saveButton,
                  { backgroundColor: colors.primary },
                  (!answer.trim() || isSaving) && styles.saveButtonDisabled,
                ]}
              >
                <Text style={[styles.saveButtonText, { color: "#FFF" }]}>
                  {isSaving
                    ? "LOCKING IN..."
                    : existingAnswer
                    ? "UPDATE REFLECTION"
                    : "SHARE MY HEART"}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
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
      marginBottom: SPACING.xl,
    },
    chipsLabel: {
      fontSize: 10,
      fontFamily: 'Lato_700Bold',
      letterSpacing: 1.5,
      color: colors.textMuted,
      marginBottom: 12,
      textTransform: "uppercase",
      marginLeft: 4,
    },
    chipsScroll: {
      gap: 8,
      paddingRight: SPACING.xl,
      paddingLeft: 4,
    },
    chip: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: BORDER_RADIUS.full,
      borderWidth: 1,
    },
    chipText: {
      fontSize: 13,
      fontFamily: 'Lato_400Regular',
    },
    statusText: {
      fontFamily: 'Lato_700Bold',
      color: colors.primary,
      marginLeft: 6,
      letterSpacing: 1.5,
      fontSize: 10,
    },
    scrollContent: {
      padding: SPACING.lg,
      paddingTop: SPACING.sm,
      paddingBottom: 100,
    },
    glassCardContainer: {
      marginBottom: SPACING.xl,
      borderRadius: 32,
      overflow: "hidden",
      height: Dimensions.get("window").height * 0.38,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.15,
          shadowRadius: 16,
        },
        android: { elevation: 8 }
      })
    },
    cardFace: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 32,
      overflow: "hidden",
      backfaceVisibility: "hidden",
    },
    cardBackGradient: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: SPACING.xl,
    },
    cardBackPattern: {
      width: 90,
      height: 90,
      borderRadius: 45,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.15)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: SPACING.lg,
    },
    cardBackPatternInner: {
      width: 60,
      height: 60,
      borderRadius: 30,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      alignItems: "center",
      justifyContent: "center",
    },
    cardBackPill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.12)",
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: BORDER_RADIUS.full,
      gap: 8,
    },
    cardBackPillText: {
      fontFamily: 'Lato_700Bold',
      fontSize: 11,
      color: "rgba(255,255,255,0.9)",
      letterSpacing: 2,
    },
    cornerMark: {
      position: "absolute",
      fontSize: 18,
      color: "rgba(255,255,255,0.25)",
    },
    cardFrontBand: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 14,
      gap: 8,
    },
    cardFrontBandText: {
      fontFamily: 'Lato_700Bold',
      fontSize: 11,
      color: "rgba(255,255,255,0.9)",
      letterSpacing: 1.5,
      textTransform: "uppercase",
    },
    blurCard: {
      flex: 1,
      padding: SPACING.lg,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      borderRadius: 32,
    },
    promptContent: {
      alignItems: "center",
      justifyContent: "center",
      flex: 1,
      paddingHorizontal: 20,
    },
    promptText: {
      fontFamily: Platform.select({
        ios: "DMSerifDisplay-Regular",
        android: "DMSerifDisplay_400Regular",
      }),
      fontSize: 24,
      lineHeight: 34,
      color: colors.text,
      textAlign: "center",
    },
    inputWrapper: {
      flex: 1,
      minHeight: 280,
    },
    charCountRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
      paddingHorizontal: 4,
    },
    inputLabel: {
      fontFamily: 'Lato_700Bold',
      fontSize: 11,
      letterSpacing: 1.2,
      color: colors.textMuted,
    },
    charCount: {
      fontSize: 11,
      fontVariant: ["tabular-nums"],
    },
    textInput: {
      fontSize: 20,
      lineHeight: 30,
      textAlignVertical: "top",
      paddingTop: 0,
      minHeight: 220,
      fontFamily: 'Lato_400Regular',
    },
    footer: {
      marginTop: 24,
    },
    privacyHint: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 24,
      paddingHorizontal: SPACING.lg,
      gap: 8,
    },
    privacyText: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "center",
    },
    saveButton: {
      borderRadius: 20,
      height: 60,
      alignItems: "center",
      justifyContent: "center",
      ...Platform.select({
        ios: {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.3,
          shadowRadius: 10,
        },
        android: { elevation: 4 }
      })
    },
    saveButtonDisabled: {
      opacity: 0.4,
    },
    saveButtonText: {
      fontSize: 15,
      fontFamily: 'Lato_700Bold',
      letterSpacing: 2,
    },
  });
  