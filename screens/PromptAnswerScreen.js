/**
 * PromptAnswerScreen — Full Editorial Implementation
 * Sexy Red Intimacy & Apple Editorial Updates Integrated.
 * Velvet Glass · Hand-drawn reflection · Physics-based Card-flip
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  StatusBar,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { useFocusEffect } from '@react-navigation/native';
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
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { useTheme } from "../context/ThemeContext";
import { useEntitlements } from "../context/EntitlementsContext";
import { useContent } from "../context/ContentContext";
import { useAuth } from "../context/AuthContext";
import PremiumGatekeeper from '../services/PremiumGatekeeper';
import { PremiumFeature } from '../utils/featureFlags';
import { promptStorage } from "../utils/storage";
import { DataLayer } from "../services/localfirst";
import { NicknameEngine } from "../services/PolishEngine";
import PreferenceEngine from "../services/PreferenceEngine";
import { getPromptById } from "../utils/contentLoader";
import { SPACING, withAlpha } from "../utils/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });
const SERIF_FONT = Platform.select({ ios: "Georgia", android: "serif" });
const MAX_LEN = 1000;

// ─── Editorial Heat Mapping (Integrated Velvet Glass) ─────────────────────
const HEAT_COLORS = {
  1: ["#FF7EB3", "#7A1B43"],
  2: ["#FF2D55", "#8E0D2C"],
  3: ["#BF5AF2", "#4C1C63"],
  4: ["#D2121A", "#4A0000"],
  5: ["#000000", "#1A1A1A"],
};
const HEAT_ICONS = {
  1: "leaf-outline",
  2: "sparkles-outline",
  3: "heart-outline",
  4: "flame-outline",
  5: "infinite-outline",
};
const HEAT_LABELS = {
  1: "Emotional",
  2: "Warmth",
  3: "Romance",
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

const TONE_PROMPT_ANSWER_COPY = {
  warm: 'Let the answer arrive softly. There is no rush here.',
  playful: 'Start loose, follow the spark, and let it surprise you.',
  intimate: 'Say the quiet part. The deeper truth is usually the one worth keeping.',
  minimal: 'Keep it direct. One honest sentence is enough to begin.',
};

export default function PromptAnswerScreen({ route, navigation }) {
  const { prompt: routePrompt, promptId } = route.params || {};
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const { user, userProfile } = useAuth();
  const { loadUsageStatus } = useContent();

  const [prompt, setPrompt] = useState(routePrompt || null);
  const [answer, setAnswer] = useState("");
  const [existingAnswer, setExistingAnswer] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTone, setSelectedTone] = useState('warm');
  const lastHapticLength = useRef(0);

  // Card Physics
  const flipProgress = useSharedValue(0);
  const dealY = useSharedValue(-60);
  const dealScale = useSharedValue(0.92);
  const dealOpacity = useSharedValue(0);

  // Editorial Palette — fixed OLED black for maximum contrast
  const t = useMemo(() => ({
    background: '#0A0A0A',
    surface: '#1C1C1E',
    primary: HEAT_COLORS[prompt?.heat || 1]?.[0] || '#D2121A',
    text: '#FFFFFF',
    subtext: 'rgba(255,255,255,0.4)',
    border: 'rgba(255,255,255,0.1)',
  }), [prompt?.heat]);

  const heat = prompt?.heat || 1;
  const catGradient = HEAT_COLORS[heat] || HEAT_COLORS[1];
  const catIcon = HEAT_ICONS[heat] || "heart-outline";
  const catLabel = HEAT_LABELS[heat] || "Emotional";

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  // Deal-in + flip on mount
  useEffect(() => {
    dealOpacity.value = withTiming(1, { duration: 500 });
    dealY.value = withSpring(0, { damping: 15, stiffness: 100 });
    dealScale.value = withSpring(1, { damping: 15, stiffness: 100 });

    // Auto-reveal flip
    const flipTimer = setTimeout(() => {
      flipProgress.value = withTiming(1, {
        duration: 700,
        easing: Easing.bezier(0.33, 1, 0.68, 1),
      });
      impact(ImpactFeedbackStyle.Medium);
    }, 600);
    return () => clearTimeout(flipTimer);
  }, []);

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

  useEffect(() => {
    let active = true;

    (async () => {
      const resolvedPrompt = routePrompt || (promptId ? getPromptById(promptId) : null);
      if (!active) return;

      if (!resolvedPrompt) {
        Alert.alert("Prompt unavailable", "This reflection is no longer available.", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
        return;
      }

      const profile = await PreferenceEngine.getContentProfile(userProfile || {});
      if (!active) return;

      const visibility = PreferenceEngine.getPromptVisibilityState(resolvedPrompt, profile);
      if (!visibility.visible) {
        Alert.alert(visibility.title, visibility.message, [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
        return;
      }

      const dateKey = resolvedPrompt.dateKey || new Date().toISOString().split('T')[0];
      setPrompt({ ...resolvedPrompt, dateKey });
    })().catch(() => {
      if (active) {
        Alert.alert("Prompt unavailable", "This reflection is no longer available.", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      }
    });

    return () => {
      active = false;
    };
  }, [routePrompt, promptId, navigation, userProfile]);

  useEffect(() => {
    if (prompt) loadExistingAnswer();
  }, [prompt]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      NicknameEngine.getConfig()
        .then((config) => {
          if (active) setSelectedTone(config?.tone || 'warm');
        })
        .catch(() => {
          if (active) setSelectedTone('warm');
        });

      return () => {
        active = false;
      };
    }, [])
  );

  const toneCopy = TONE_PROMPT_ANSWER_COPY[selectedTone] || TONE_PROMPT_ANSWER_COPY.warm;

  const loadExistingAnswer = async () => {
    if (!prompt?.id) return;
    // Try DataLayer first (E2EE, synced); fall back to legacy AsyncStorage
    try {
      const row = await DataLayer.getPromptAnswerForToday(prompt.id);
      if (row?.answer) {
        setExistingAnswer(row);
        setAnswer(row.answer);
        return;
      }
    } catch { /* DataLayer not yet initialized — fall through */ }
    if (prompt.dateKey) {
      const saved = await promptStorage.getAnswer(prompt.dateKey, prompt.id);
      if (saved?.answer) {
        setExistingAnswer(saved);
        setAnswer(saved.answer);
      }
    }
  };

  const handleTextChange = (text) => {
    const truncated = text.slice(0, MAX_LEN);
    setAnswer(truncated);
    if (truncated.length > 0 && truncated.length % 40 === 0 && truncated.length !== lastHapticLength.current) {
      impact(ImpactFeedbackStyle.Light);
      lastHapticLength.current = truncated.length;
    }
  };

  const handleSave = async () => {
    const finalText = answer.trim();
    if (!finalText || !prompt?.id || !prompt?.dateKey || isSaving) return;

    if (finalText.length > MAX_LEN) {
      Alert.alert(
        "Length Exceeded",
        `Please refine your thoughts to ${MAX_LEN} characters or less.`
      );
      return;
    }

    const isFirstResponse = !existingAnswer;

    if (!isPremium && isFirstResponse) {
      const accessCheck = await PremiumGatekeeper.canAccessPrompt(user?.uid, prompt?.heat || 1, isPremium);
      if (!accessCheck.canAccess) {
        const blockedFeature = accessCheck.reason === 'premium_required'
          ? PremiumFeature.HEAT_LEVELS_4_5
          : PremiumFeature.UNLIMITED_PROMPTS;
        showPaywall?.(blockedFeature);
        return;
      }
    }

    setIsSaving(true);
    try {
      Keyboard.dismiss();
      // Save locally first so prompt answering still works even if the
      // E2EE/sync layer is still initializing or temporarily unavailable.
      if (prompt?.dateKey) {
        await promptStorage.setAnswer(prompt.dateKey, prompt.id, {
          answer: finalText,
          timestamp: Date.now(),
          isRevealed: existingAnswer?.isRevealed || false,
        });
      }

      try {
        await DataLayer.savePromptAnswer({
          promptId: prompt.id,
          answer: finalText,
          heatLevel: prompt?.heat || 1,
        });
      } catch (dataLayerError) {
        if (__DEV__) console.warn('[PromptAnswer] DataLayer prompt save failed:', dataLayerError?.message);
      }

      if (!isPremium && isFirstResponse && user?.uid) {
        await PremiumGatekeeper.trackPromptUsage(user.uid, prompt.id, isPremium, prompt?.heat || 1);
        await loadUsageStatus?.();
      }
      notification(NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error) {
      Alert.alert("Moment Paused", "We couldn't lock in your reflection. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!prompt) return null;

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[withAlpha(catGradient[0], 0.1), "transparent"]}
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
            <Icon name="close-outline" size={30} color={t.text} />
          </TouchableOpacity>

          <View style={[styles.headerStatus, { backgroundColor: withAlpha(t.primary, 0.1), borderColor: withAlpha(t.primary, 0.2) }]}>
            <Icon name="shield-checkmark" size={12} color={t.primary} />
            <Text style={[styles.statusText, { color: t.primary }]}>SECURE SPACE</Text>
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
            {/* Flipping Prompt Card — high-end editorial physics */}
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
                      <Icon name={catIcon} size={36} color="rgba(255,255,255,0.25)" />
                    </View>
                  </View>
                  <View style={styles.cardBackPill}>
                    <Icon name={catIcon} size={14} color="rgba(255,255,255,0.9)" />
                    <Text style={styles.cardBackPillText}>
                      {prompt?.category?.toUpperCase() || catLabel.toUpperCase()}
                    </Text>
                  </View>

                  {/* Luxury corner marks */}
                  <Text style={[styles.cornerMark, { top: 20, left: 20 }]}>✦</Text>
                  <Text style={[styles.cornerMark, { top: 20, right: 20 }]}>✦</Text>
                  <Text style={[styles.cornerMark, { bottom: 20, left: 20 }]}>✦</Text>
                  <Text style={[styles.cornerMark, { bottom: 20, right: 20 }]}>✦</Text>
                </LinearGradient>
              </Animated.View>

              {/* FRONT FACE — Velvet glass prompt reveal */}
              <Animated.View style={[styles.cardFace, frontFaceStyle]}>
                <BlurView
                  intensity={30}
                  tint={isDark ? "dark" : "light"}
                  style={[styles.blurCard, { borderColor: t.border }]}
                >
                  <LinearGradient
                    colors={catGradient}
                    style={styles.cardFrontBand}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Icon name={catIcon} size={14} color="rgba(255,255,255,0.9)" />
                    <Text style={styles.cardFrontBandText}>{catLabel}</Text>
                  </LinearGradient>

                  <View style={styles.promptContent}>
                    <Text style={[styles.promptText, { color: t.text }]}>{prompt?.text}</Text>
                  </View>
                </BlurView>
              </Animated.View>
            </Animated.View>

            <Text style={[styles.toneLead, { color: t.subtext }]}>{toneCopy}</Text>

            {/* Starting Lines / Inspiration Chips */}
            <View style={styles.chipsContainer}>
              <Text style={[styles.sectionLabel, { color: t.subtext }]}>Spark your thoughts</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsScroll}
              >
                {INSPIRATION_CHIPS.map((chip, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.chip, { backgroundColor: withAlpha(t.primary, 0.05), borderColor: withAlpha(t.primary, 0.2) }]}
                    onPress={() => {
                      selection();
                      setAnswer(prev => prev + (prev.length > 0 ? ' ' : '') + chip);
                    }}
                  >
                    <Text style={[styles.chipText, { color: t.text }]}>{chip}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Private Reflection Input */}
            <Animated.View
              entering={FadeIn.duration(800).delay(800)}
              style={styles.inputWrapper}
            >
              <View style={styles.charCountRow}>
                <Text style={[styles.inputLabel, { color: t.primary }]}>YOUR REFLECTION</Text>
                <Text style={[styles.charCount, { color: answer.length >= MAX_LEN ? t.primary : t.subtext }]}>
                  {answer.length}/{MAX_LEN}
                </Text>
              </View>

              <TextInput
                value={answer}
                onChangeText={handleTextChange}
                placeholder="Share your heart privately..."
                placeholderTextColor={withAlpha(t.text, 0.3)}
                multiline
                autoFocus
                selectionColor={t.primary}
                style={[styles.textInput, { color: t.text }]}
                maxLength={MAX_LEN}
              />
            </Animated.View>

            {/* Footer & Privacy Guarantee */}
            <Animated.View
              entering={FadeIn.duration(600).delay(1000)}
              style={styles.footer}
            >
              <View style={styles.privacyHint}>
                <Icon name="lock-closed-outline" size={14} color={t.subtext} />
                <Text style={[styles.privacyText, { color: t.subtext }]}>
                  Encrypted. Locked until you both choose to reveal.
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleSave}
                disabled={!answer.trim() || isSaving}
                activeOpacity={0.9}
                style={[
                  styles.saveButton,
                  { backgroundColor: t.primary },
                  (!answer.trim() || isSaving) && styles.saveButtonDisabled,
                ]}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {existingAnswer ? "UPDATE REFLECTION" : "LOCK IN REFLECTION"}
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (t, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      height: 60,
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
      paddingHorizontal: 12,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      gap: 6,
    },
    statusText: {
      fontFamily: SYSTEM_FONT,
      fontWeight: "800",
      letterSpacing: 1,
      fontSize: 9,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: SPACING.sm,
      paddingBottom: 100,
    },
    glassCardContainer: {
      marginVertical: 32,
      height: SCREEN_HEIGHT * 0.35,
      borderRadius: 32,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.2,
          shadowRadius: 16,
        },
        android: { elevation: 8 },
      }),
    },
    cardFace: {
      ...StyleSheet.absoluteFillObject,
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
      borderRadius: 100,
      gap: 8,
    },
    cardBackPillText: {
      fontFamily: SYSTEM_FONT,
      fontWeight: "900",
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
      height: 44,
      gap: 8,
    },
    cardFrontBandText: {
      fontFamily: SYSTEM_FONT,
      fontWeight: "800",
      fontSize: 11,
      color: "rgba(255,255,255,0.9)",
      letterSpacing: 1.5,
      textTransform: "uppercase",
    },
    blurCard: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 32,
      overflow: "hidden",
    },
    promptContent: {
      alignItems: "center",
      justifyContent: "center",
      flex: 1,
      paddingHorizontal: 20,
      paddingVertical: SPACING.lg,
    },
    promptText: {
      fontFamily: Platform.select({
        ios: "DMSerifDisplay-Regular",
        android: "DMSerifDisplay_400Regular",
      }),
      fontSize: 24,
      lineHeight: 34,
      textAlign: "center",
      letterSpacing: -0.5,
    },
    toneLead: {
      fontFamily: SYSTEM_FONT,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
      marginTop: -8,
      marginBottom: 20,
      paddingHorizontal: 12,
    },
    // Inspiration Chips
    chipsContainer: {
      marginBottom: 32,
    },
    sectionLabel: {
      fontFamily: SYSTEM_FONT,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.5,
      textTransform: "uppercase",
      marginBottom: 16,
    },
    chipsScroll: {
      gap: 10,
      paddingRight: 40,
    },
    chip: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1,
    },
    chipText: {
      fontFamily: SYSTEM_FONT,
      fontSize: 14,
      fontWeight: "600",
    },
    inputWrapper: {
      flex: 1,
      minHeight: 280,
      marginBottom: 40,
    },
    charCountRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
      paddingHorizontal: 4,
    },
    inputLabel: {
      fontFamily: SYSTEM_FONT,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.5,
    },
    charCount: {
      fontSize: 11,
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
    },
    textInput: {
      fontFamily: SYSTEM_FONT,
      fontSize: 20,
      fontWeight: "500",
      lineHeight: 30,
      textAlignVertical: "top",
      paddingTop: 0,
      minHeight: 220,
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
      fontWeight: "600",
      textAlign: "center",
    },
    saveButton: {
      borderRadius: 30,
      height: 60,
      alignItems: "center",
      justifyContent: "center",
      ...Platform.select({
        ios: {
          shadowColor: "#D2121A",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
        },
        android: { elevation: 4 },
      }),
    },
    saveButtonDisabled: {
      opacity: 0.4,
    },
    saveButtonText: {
      color: "#FFF",
      fontSize: 15,
      fontFamily: SYSTEM_FONT,
      fontWeight: "900",
      letterSpacing: 1,
    },
  });
