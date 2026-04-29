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
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from '../components/Icon';
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import CloseScreenHeader from '../components/CloseScreenHeader';
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
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { useAppContext } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import { useEntitlements } from "../context/EntitlementsContext";
import { useContent } from "../context/ContentContext";
import { useAuth } from "../context/AuthContext";
import PremiumGatekeeper from '../services/PremiumGatekeeper';
import { PremiumFeature } from '../utils/featureFlags';
import { promptStorage } from "../utils/storage";
import { DataLayer } from "../services/localfirst";
import * as PreferenceEngine from "../services/PreferenceEngine";
import { getPromptById } from "../utils/contentLoader";
import { getPartnerDisplayName } from "../utils/profileNames";
import { SPACING, withAlpha } from "../utils/theme";

const { width: SCREEN_W } = Dimensions.get("window");
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

export default function PromptAnswerScreen({ route, navigation }) {
  const { prompt: routePrompt, promptId, mode } = route.params || {};
  const { state } = useAppContext();
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const { user, userProfile } = useAuth();
  const { loadUsageStatus } = useContent();

  const [prompt, setPrompt] = useState(routePrompt || null);
  const [answer, setAnswer] = useState("");
  const [existingAnswer, setExistingAnswer] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const lastHapticLength = useRef(0);

  // Card Physics
  const flipProgress = useSharedValue(0);
  const dealY = useSharedValue(-60);
  const dealScale = useSharedValue(0.92);
  const dealOpacity = useSharedValue(0);

  // Editorial Palette — respects dark/light mode
  const t = useMemo(() => isDark ? {
    background: colors.background,
    surface: colors.surface || '#1C1C1E',
    primary: HEAT_COLORS[prompt?.heat || 1]?.[0] || '#D2121A',
    text: colors.text,
    subtext: colors.textMuted || 'rgba(255,255,255,0.4)',
    border: colors.border || 'rgba(255,255,255,0.1)',
  } : {
    background: colors.background,
    surface: colors.surface || '#FFFFFF',
    surfaceSecondary: colors.surfaceSecondary || 'rgba(242, 242, 247, 0.78)',
    primary: HEAT_COLORS[prompt?.heat || 1]?.[0] || '#D2121A',
    text: colors.text,
    subtext: colors.textMuted || 'rgba(0,0,0,0.4)',
    border: colors.border || 'rgba(0,0,0,0.1)',
  }, [isDark, colors, prompt?.heat]);

  const heat = prompt?.heat || 1;
  const catGradient = HEAT_COLORS[heat] || HEAT_COLORS[1];
  const catIcon = HEAT_ICONS[heat] || "heart-outline";
  const catLabel = HEAT_LABELS[heat] || "Emotional";
  const hasLinkedPartner = !!state?.coupleId;
  const partnerLabel = getPartnerDisplayName(userProfile, state?.userProfile, 'your partner');
  const isEditingAnswer = mode === 'edit' || !!existingAnswer;
  const helperCopy = hasLinkedPartner || isEditingAnswer
    ? ""
    : `Ask ${partnerLabel} to answer too.`;
  const privacyCopy = hasLinkedPartner || isEditingAnswer
    ? `Waiting for ${partnerLabel}…`
    : `Ask ${partnerLabel} to answer too.`;
  const headerTitle = isEditingAnswer ? "Edit Answer" : "Your Answer";
  const canSave = answer.trim().length > 0 && !isSaving;

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
  }, [dealOpacity, dealScale, dealY, flipProgress]);

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

  const loadExistingAnswer = useCallback(async () => {
    if (!prompt?.id) return;
    // Supabase-backed DataLayer is authoritative; cache is display-only fallback.
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
  }, [prompt]);

  useEffect(() => {
    if (prompt) loadExistingAnswer();
  }, [prompt, loadExistingAnswer]);

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
        showPaywall?.(PremiumFeature.UNLIMITED_PROMPTS);
        return;
      }
    }

    setIsSaving(true);
    try {
      Keyboard.dismiss();
      await DataLayer.savePromptAnswer({
        promptId: prompt.id,
        answer: finalText,
        heatLevel: prompt?.heat || 1,
      });

      // Cache after the authoritative write path accepts the change.
      if (prompt?.dateKey) {
        await promptStorage.setAnswer(prompt.dateKey, prompt.id, {
          answer: finalText,
          timestamp: Date.now(),
          isRevealed: existingAnswer?.isRevealed || false,
        });
      }

      if (!isPremium && isFirstResponse && user?.uid) {
        await PremiumGatekeeper.trackPromptUsage(user.uid, prompt.id, isPremium, prompt?.heat || 1);
        await loadUsageStatus?.();
      }
      notification(NotificationFeedbackType.Success);

      navigation.goBack();
    } catch {
      Alert.alert("We couldn't save your answer", "Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!prompt) return null;

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
      <LinearGradient
        colors={isDark
          ? [t.background, withAlpha(catGradient[1], 0.28), '#0A0003', t.background]
          : [t.background, withAlpha(catGradient[0], 0.08), t.background]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <GlowOrb
        color={t.primary}
        size={400}
        top={-160}
        left={SCREEN_W - 200}
        opacity={isDark ? 0.16 : 0.07}
      />
      <FilmGrain opacity={isDark ? 0.08 : 0.04} />

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <CloseScreenHeader
          title={headerTitle}
          subtitle="TODAY BETWEEN US"
          titleColor={t.text}
          subtitleColor={t.primary}
          closeColor={t.text}
          onClose={() => navigation.goBack()}
          rightAccessory={(
            <TouchableOpacity
              onPress={handleSave}
              disabled={!canSave}
              style={[
                styles.headerSaveButton,
                {
                  backgroundColor: canSave ? withAlpha(t.primary, 0.15) : 'transparent',
                  borderColor: canSave ? withAlpha(t.primary, 0.3) : 'transparent',
                },
              ]}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={t.primary} />
              ) : (
                <Text style={[styles.headerSaveButtonText, { color: canSave ? t.primary : t.subtext }]}>
                  {isEditingAnswer ? 'Update' : 'Save'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        />

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
            <Animated.View entering={FadeInDown.delay(50).springify().damping(18)} style={[styles.glassCardContainer, dealStyle]}>
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

            {helperCopy ? (
              <Text style={[styles.toneLead, { color: t.subtext }]}>{helperCopy}</Text>
            ) : null}

            {/* Starting Lines / Inspiration Chips */}
            {!isEditingAnswer ? (
              <View style={styles.chipsContainer}>
                <Text style={[styles.sectionLabel, { color: t.subtext }]}>Need a starting line?</Text>
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
            ) : null}

            {/* Shared Reflection Input */}
            <Animated.View
              entering={FadeInDown.delay(80).springify().damping(18)}
              style={styles.inputWrapper}
            >
              <BlurView
                intensity={isDark ? 45 : 25}
                tint={isDark ? 'dark' : 'light'}
                style={[styles.inputBlur, { backgroundColor: t.surface, borderColor: t.border }]}
              >
                <View style={styles.charCountRow}>
                  <Text style={[styles.inputLabel, { color: t.primary }]}>YOUR ANSWER</Text>
                  <Text style={[styles.charCount, { color: answer.length >= MAX_LEN ? t.primary : withAlpha(t.subtext, 0.7) }]}>
                    {answer.length}/{MAX_LEN}
                  </Text>
                </View>

                <TextInput
                  value={answer}
                  onChangeText={handleTextChange}
                  placeholder="Leave them one small piece of your heart..."
                  placeholderTextColor={withAlpha(t.text, 0.35)}
                  multiline
                  autoFocus
                  selectionColor={t.primary}
                  style={[styles.textInput, { color: t.text }]}
                  maxLength={MAX_LEN}
                  textAlignVertical="top"
                />
              </BlurView>
            </Animated.View>

            {/* Footer & Privacy Guarantee */}
            <Animated.View
              entering={FadeIn.duration(600).delay(180)}
              style={styles.footer}
            >
              {!isEditingAnswer ? (
                <View style={styles.privacyHint}>
                  <Icon name="lock-closed-outline" size={14} color={t.subtext} />
                  <Text style={[styles.privacyText, { color: t.subtext }]}>
                    {privacyCopy}
                  </Text>
                </View>
              ) : null}

              <View style={styles.footerSpacer} />
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const getShadow = (isDark) => Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isDark ? 0.28 : 0.08,
    shadowRadius: 22,
  },
  android: { elevation: 6 },
});

const createStyles = (t, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.background,
    },
    headerSaveButton: {
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 8,
      minWidth: 64,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
    },
    headerSaveButtonText: {
      fontFamily: SYSTEM_FONT,
      fontSize: 15,
      fontWeight: '800',
    },
    scrollContent: {
      paddingHorizontal: SPACING.screen,
      paddingTop: SPACING.md,
      paddingBottom: 80,
      gap: 20,
    },
    glassCardContainer: {
      height: 245,
      borderRadius: 28,
      ...getShadow(isDark),
    },
    cardFace: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 28,
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
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 28,
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
      fontFamily: SERIF_FONT,
      fontSize: 22,
      lineHeight: 30,
      textAlign: "center",
    },
    toneLead: {
      fontFamily: SYSTEM_FONT,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
      paddingHorizontal: 12,
    },
    // Inspiration Chips
    chipsContainer: {
      marginTop: -2,
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
      borderRadius: 26,
      ...getShadow(isDark),
    },
    inputBlur: {
      borderRadius: 26,
      borderWidth: StyleSheet.hairlineWidth,
      padding: SPACING.xl,
      overflow: 'hidden',
    },
    charCountRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
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
      fontSize: 17,
      lineHeight: 25,
      textAlignVertical: "top",
      paddingTop: 0,
      minHeight: 150,
    },
    footer: {
      marginTop: -4,
    },
    privacyHint: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: SPACING.lg,
      gap: 8,
    },
    privacyText: {
      fontSize: 12,
      fontWeight: "600",
      textAlign: "center",
    },
    footerSpacer: {
      height: 24,
    },
  });
