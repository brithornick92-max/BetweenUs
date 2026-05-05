/**
 * PromptAnswerScreen — Full Editorial Implementation
 * Velvet Glass · hand-drawn reflection · shared editorial scaffold.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Alert,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import Icon from '../components/Icon';
import { LinearGradient } from "expo-linear-gradient";
import EditorialScreenScaffold from '../components/EditorialScreenScaffold';
import {
  impact,
  notification,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from "../utils/haptics";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { useTheme } from "../context/ThemeContext";
import { useEntitlements } from "../context/EntitlementsContext";
import { useContent } from "../context/ContentContext";
import { useAuth } from "../context/AuthContext";
import { PremiumFeature } from '../utils/featureFlags';
import { promptStorage, savedPromptStorage } from "../utils/storage";
import { DataLayer } from "../services/localfirst";
import * as PreferenceEngine from "../services/PreferenceEngine";
import { getPromptById } from "../utils/contentLoader";
import { removeRestoredDeckItem } from "../utils/contentDeckRestores";
import { SPACING, withAlpha } from "../utils/theme";
import { CONTENT_TYPES } from "../services/WeeklyContentSetService";
import { HEAT_LEVEL_ACCENTS, HEAT_LEVEL_GRADIENTS } from "../config/constants";
import {
  canSaveFreePromptAnswer,
  resolvePromptUsageUserId,
  trackFreePromptAnswerUsage,
} from "../utils/freePromptAnswerQuota";
import { isItemInStableFreeWeeklyDeck } from "../utils/freeWeeklyDeckAccess";
import { getDailyContentDateKey } from "../utils/dailyContentDate";

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });
const MAX_LEN = 1000;

const loadAllBundledPrompts = () => {
  const bundled = require("../content/prompts.json");
  if (Array.isArray(bundled)) return bundled;
  if (Array.isArray(bundled?.items)) return bundled.items;
  if (Array.isArray(bundled?.prompts)) return bundled.prompts;
  if (Array.isArray(bundled?.default)) return bundled.default;
  if (Array.isArray(bundled?.default?.items)) return bundled.default.items;
  if (Array.isArray(bundled?.default?.prompts)) return bundled.default.prompts;
  return [];
};

// ─── Editorial Heat Mapping (Integrated Velvet Glass) ─────────────────────
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

export default function PromptAnswerScreen({ route, navigation }) {
  const { prompt: routePrompt, promptId, mode } = route.params || {};
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const { user, userProfile } = useAuth();
  const { loadUsageStatus } = useContent();

  const [prompt, setPrompt] = useState(routePrompt || null);
  const [answer, setAnswer] = useState("");
  const [existingAnswer, setExistingAnswer] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const lastHapticLength = useRef(0);
  const savingRef = useRef(false);

  // Card Physics
  const dealY = useSharedValue(-60);
  const dealScale = useSharedValue(0.92);
  const dealOpacity = useSharedValue(0);

  // Editorial Palette — respects dark/light mode
  const t = useMemo(() => isDark ? {
    background: colors.background,
    surface: colors.surface || '#1C1C1E',
    surface2: colors.surface2 || '#2C2C2E',
    surfaceGlass: colors.surfaceGlass || 'rgba(28,28,30,0.70)',
    primary: HEAT_LEVEL_ACCENTS[prompt?.heat || 1] || colors.primary || '#D2121A',
    text: colors.text,
    subtext: colors.textMuted || 'rgba(255,255,255,0.4)',
    border: colors.border || 'rgba(255,255,255,0.1)',
  } : {
    background: colors.background,
    surface: colors.surface || '#FFFFFF',
    surface2: colors.surface2 || '#E5E5EA',
    surfaceGlass: colors.surfaceGlass || 'rgba(255,255,255,0.80)',
    surfaceSecondary: colors.surfaceSecondary || colors.surface2 || 'rgba(242, 242, 247, 0.78)',
    primary: HEAT_LEVEL_ACCENTS[prompt?.heat || 1] || colors.primary || '#D2121A',
    text: colors.text,
    subtext: colors.textMuted || 'rgba(0,0,0,0.4)',
    border: colors.border || 'rgba(0,0,0,0.1)',
  }, [isDark, colors, prompt?.heat]);

  const heat = prompt?.heat || 1;
  const catGradient = HEAT_LEVEL_GRADIENTS[heat] || HEAT_LEVEL_GRADIENTS[1];
  const catIcon = HEAT_ICONS[heat] || "heart-outline";
  const catLabel = HEAT_LABELS[heat] || "Emotional";
  const isEditingAnswer = mode === 'edit' || !!existingAnswer;
  const headerTitle = isEditingAnswer ? "Edit" : "Answer";
  const canSave = answer.trim().length > 0 && !isSaving;

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  // Deal-in + flip on mount
  useEffect(() => {
    dealOpacity.value = withSpring(1, { damping: 18, stiffness: 110 });
    dealY.value = withSpring(0, { damping: 15, stiffness: 100 });
    dealScale.value = withSpring(1, { damping: 15, stiffness: 100 });
    impact(ImpactFeedbackStyle.Light);
  }, [dealOpacity, dealScale, dealY]);

  const dealStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dealY.value }, { scale: dealScale.value }],
    opacity: dealOpacity.value,
  }));

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

      if (!isPremium) {
        const weeklyEligiblePrompts = loadAllBundledPrompts().filter((item) =>
          PreferenceEngine.getPromptVisibilityState(item, profile).visible
        );
        const isWeeklyPrompt = await isItemInStableFreeWeeklyDeck(resolvedPrompt.id, weeklyEligiblePrompts, {
          contentType: CONTENT_TYPES.PROMPTS,
          user,
          userProfile,
          userSettings: profile || userProfile || {},
        });

        if (!isWeeklyPrompt) {
          showPaywall?.(PremiumFeature.UNLIMITED_PROMPTS);
          navigation.goBack();
          return;
        }
      }

      const dateKey = resolvedPrompt.dateKey || getDailyContentDateKey();
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
  }, [routePrompt, promptId, navigation, userProfile, isPremium, showPaywall, user]);

  const loadExistingAnswer = useCallback(async () => {
    if (!prompt?.id) return;
    // Supabase-backed DataLayer is authoritative; cache is display-only fallback.
    try {
      const row = await DataLayer.getPromptAnswerForToday(prompt.id, prompt.dateKey);
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
    if (!finalText || !prompt?.id || !prompt?.dateKey || savingRef.current) return;

    if (finalText.length > MAX_LEN) {
      Alert.alert(
        "Length Exceeded",
        `Please refine your thoughts to ${MAX_LEN} characters or less.`
      );
      return;
    }

    savingRef.current = true;
    setIsSaving(true);

    const isFirstResponse = !existingAnswer;
    const usageUserId = resolvePromptUsageUserId(user, userProfile);

    try {
      if (!isPremium && isFirstResponse) {
        const accessCheck = await canSaveFreePromptAnswer({
          userId: usageUserId,
          user,
          userProfile,
          isPremium,
          promptId: prompt.id,
        });
        if (!accessCheck.canSave) {
          showPaywall?.(PremiumFeature.UNLIMITED_PROMPTS);
          return;
        }
      }

      Keyboard.dismiss();

      try {
        await DataLayer.savePromptAnswer({
          promptId: prompt.id,
          answer: finalText,
          heatLevel: prompt?.heat || 1,
          dateKey: prompt.dateKey,
        });
      } catch (dataLayerError) {
        if (__DEV__) console.warn('[PromptAnswer] DataLayer prompt save failed:', dataLayerError?.message);
      }

      // Keep a local answer even when the shared cloud row cannot be written yet.
      if (prompt?.dateKey) {
        await promptStorage.setAnswer(prompt.dateKey, prompt.id, {
          answer: finalText,
          timestamp: Date.now(),
          isRevealed: existingAnswer?.isRevealed || false,
        });
      }

      await removeRestoredDeckItem(CONTENT_TYPES.PROMPTS, prompt.id).catch(() => {});

      if (!isPremium && isFirstResponse) {
        await trackFreePromptAnswerUsage({
          userId: usageUserId,
          user,
          userProfile,
          isPremium,
          promptId: prompt.id,
        });
      }

      await savedPromptStorage.remove(prompt.id);

      if (!isPremium && isFirstResponse) {
        try {
          await loadUsageStatus?.();
        } catch (usageError) {
          if (__DEV__) console.warn('[PromptAnswer] Usage status refresh failed:', usageError?.message);
        }
      }
      notification(NotificationFeedbackType.Success);

      navigation.goBack();
    } catch {
      Alert.alert("We couldn't save your answer", "Please try again.");
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  if (!prompt) return null;

  return (
    <EditorialScreenScaffold
      navigation={navigation}
      headerTitle={headerTitle}
      keyboardAvoiding
      contentContainerStyle={styles.scrollContent}
      headerRight={(
        <TouchableOpacity
          onPress={handleSave}
          disabled={!canSave}
          style={[
            styles.headerSaveButton,
            {
              backgroundColor: canSave ? withAlpha(t.primary, 0.12) : 'transparent',
              borderColor: canSave ? withAlpha(t.primary, 0.28) : t.border,
            },
          ]}
          activeOpacity={0.75}
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
    >
      <Animated.View entering={FadeInDown.delay(50).springify().damping(18)}>
        <Animated.View style={[styles.promptCard, dealStyle]}>
          <LinearGradient
            colors={isDark
              ? [withAlpha(catGradient[1], 0.35), t.surfaceGlass, t.surface]
              : [withAlpha(catGradient[0], 0.12), t.surfaceGlass, t.surface]}
            style={[styles.promptCardInner, { borderColor: t.border }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.promptMetaRow}>
              <View style={[styles.promptIconWrap, { backgroundColor: withAlpha(t.primary, 0.12) }]}>
                <Icon name={catIcon} size={18} color={t.primary} />
              </View>
              <Text style={[styles.promptEyebrow, { color: t.primary }]}>{catLabel}</Text>
            </View>

            <Text style={[styles.promptText, { color: t.text }]}>{prompt?.text}</Text>
          </LinearGradient>
        </Animated.View>
      </Animated.View>

      {/* Shared Reflection Input */}
      <Animated.View
        entering={FadeInDown.delay(80).springify().damping(18)}
        style={styles.inputWrapper}
      >
        <View style={[styles.inputSurface, { backgroundColor: t.surfaceGlass, borderColor: t.border }]}>
          <View style={styles.charCountRow}>
            <Text style={[styles.inputLabel, { color: t.primary }]}>ANSWER</Text>
            {answer.length > 0 ? (
              <Text style={[styles.charCount, { color: answer.length >= MAX_LEN ? t.primary : withAlpha(t.subtext, 0.7) }]}>
                {answer.length}/{MAX_LEN}
              </Text>
            ) : null}
          </View>

          <TextInput
            value={answer}
            onChangeText={handleTextChange}
            placeholder="Write your answer..."
            placeholderTextColor={withAlpha(t.text, 0.35)}
            multiline
            autoFocus
            selectionColor={t.primary}
            style={[styles.textInput, { color: t.text }]}
            maxLength={MAX_LEN}
            textAlignVertical="top"
          />
        </View>
      </Animated.View>
    </EditorialScreenScaffold>
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
      paddingTop: 0,
      paddingBottom: 80,
      gap: 18,
    },
    promptCard: {
      borderRadius: 18,
      ...getShadow(isDark),
    },
    promptCardInner: {
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      padding: SPACING.lg,
      overflow: 'hidden',
      minHeight: 156,
    },
    promptMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: SPACING.md,
    },
    promptIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    promptEyebrow: {
      fontFamily: SYSTEM_FONT,
      fontWeight: "900",
      fontSize: 11,
      letterSpacing: 1.5,
      textTransform: "uppercase",
    },
    promptText: {
      fontFamily: SYSTEM_FONT,
      fontSize: 23,
      fontWeight: "500",
      lineHeight: 34,
      letterSpacing: 0,
      textAlign: "left",
    },
    inputWrapper: {
      borderRadius: 18,
      ...getShadow(isDark),
    },
    inputSurface: {
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      padding: SPACING.lg,
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
  });
