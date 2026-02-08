import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  Animated,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from 'expo-haptics';
import { useAppContext } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import { promptStorage } from "../utils/storage";
import { TYPOGRAPHY, SPACING, BORDER_RADIUS, COLORS, SHADOWS, getGlassStyle } from "../utils/theme";
import Button from "../components/Button";
import Input from "../components/Input";

const MAX_LEN = 1000;

export default function PromptAnswerScreen({ route, navigation }) {
  const { prompt } = route.params || {};
  const { state } = useAppContext();
  const { theme: activeTheme, isDark } = useTheme();

  // ✅ Normalize theme access (supports {colors} or flat theme)
  const t = useMemo(() => {
    const base = activeTheme?.colors ? activeTheme.colors : activeTheme;

    return {
      background: base?.background ?? (isDark ? COLORS.warmCharcoal : COLORS.softCream),
      surface: base?.surface ?? (isDark ? COLORS.deepPlum : "#FFFFFF"),
      surfaceSecondary:
        base?.surfaceSecondary ?? (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)"),
      text: base?.text ?? (isDark ? COLORS.softCream : COLORS.charcoal),
      textSecondary:
        base?.textSecondary ??
        (isDark ? "rgba(246,242,238,0.70)" : "rgba(51,51,51,0.68)"),
      border: base?.border ?? (isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"),

      blushRose: base?.accent ?? COLORS.blushRose,
      mutedGold: COLORS.mutedGold,

      success: base?.success ?? COLORS.success,
      error: base?.error ?? COLORS.error,
    };
  }, [activeTheme, isDark]);

  const [answer, setAnswer] = useState("");
  const [existingAnswer, setExistingAnswer] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Animation values
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (prompt) loadExistingAnswer();
    
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnimation, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt]);

  const loadExistingAnswer = async () => {
    if (!prompt?.id || !prompt?.dateKey) return;
    const saved = await promptStorage.getAnswer(prompt.dateKey, prompt.id);
    if (saved?.answer) {
      setExistingAnswer(saved);
      setAnswer(saved.answer);
    }
  };

  const handleSave = async () => {
    const finalText = answer.trim();
    if (!finalText || !prompt?.id || !prompt?.dateKey) return;

    // ✅ Hard-enforce max length on save too
    if (finalText.length > MAX_LEN) {
      Alert.alert("Too long", `Please shorten your reflection to ${MAX_LEN} characters or less.`);
      return;
    }

    await Haptics.selectionAsync();
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
      Alert.alert("Error", "We couldn’t save your thoughts. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!prompt) return null;

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      {/* Background Gradient */}
      <LinearGradient
        colors={
          isDark
            ? [COLORS.warmCharcoal, COLORS.deepPlum + "40", COLORS.warmCharcoal]
            : [COLORS.softCream, COLORS.blushRose + "15", COLORS.softCream]
        }
        style={StyleSheet.absoluteFill}
        locations={[0, 0.5, 1]}
      />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          {/* Safe Space Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={async () => {
                await Haptics.selectionAsync();
                navigation.goBack();
              }} 
              style={styles.closeBtn}
            >
              <BlurView
                intensity={isDark ? 30 : 50}
                tint={isDark ? "dark" : "light"}
                style={styles.closeBtnBlur}
              >
                <MaterialCommunityIcons name="close" size={24} color={t.textSecondary} />
              </BlurView>
            </TouchableOpacity>

            <View style={styles.headerStatus}>
              <MaterialCommunityIcons name="lock-outline" size={14} color={t.textSecondary} />
              <Text style={[TYPOGRAPHY.caption, { color: t.textSecondary, marginLeft: 4 }]}>
                Private &amp; Secure
              </Text>
            </View>

            <View style={{ width: 40 }} />
          </View>

          <Animated.ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={{
              opacity: fadeAnimation,
              transform: [{ translateY: slideAnimation }],
            }}
          >
            {/* Curated Prompt View */}
            <BlurView
              intensity={isDark ? 30 : 50}
              tint={isDark ? "dark" : "light"}
              style={[styles.promptContainer, { borderColor: t.border }]}
            >
              <LinearGradient
                colors={
                  isDark
                    ? ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.01)"]
                    : ["rgba(255,255,255,0.85)", "rgba(255,255,255,0.6)"]
                }
                style={StyleSheet.absoluteFill}
              />

              <View style={styles.promptContent}>
                <Text style={[TYPOGRAPHY.caption, { color: t.blushRose, letterSpacing: 2, marginBottom: 8 }]}>
                  TODAY&apos;S REFLECTION
                </Text>
                <Text style={[TYPOGRAPHY.h1, { color: t.text, lineHeight: 32 }]}>{prompt?.text || "Loading prompt..."}</Text>
              </View>
            </BlurView>

            {/* Input Area */}
            <View style={styles.inputWrapper}>
              <View style={styles.metaRow}>
                <Text style={[TYPOGRAPHY.h2, { fontSize: 14, color: t.textSecondary }]}>Your Thoughts</Text>
                <Text
                  style={[
                    TYPOGRAPHY.caption,
                    { color: answer.length > MAX_LEN * 0.9 ? t.error : t.textSecondary },
                  ]}
                >
                  {answer.length}/{MAX_LEN}
                </Text>
              </View>

              <Input
                value={answer}
                onChangeText={(txt) => setAnswer((txt || "").slice(0, MAX_LEN))}
                placeholder="Start writing from the heart..."
                multiline
                autoFocus
                numberOfLines={8}
                style={styles.textArea}
                maxLength={MAX_LEN}
              />
            </View>

            {/* Hint Card */}
            <BlurView
              intensity={isDark ? 20 : 40}
              tint={isDark ? "dark" : "light"}
              style={[styles.hintCard, { borderColor: t.border }]}
            >
              <LinearGradient
                colors={[t.mutedGold + "15", t.mutedGold + "05"]}
                style={StyleSheet.absoluteFill}
              />
              <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color={t.mutedGold} />
              <Text style={[TYPOGRAPHY.body, { fontSize: 13, color: t.textSecondary, flex: 1 }]}>
                Your {state.partnerLabel || "partner"} won&apos;t see this until you both choose to reveal.
              </Text>
            </BlurView>
          </Animated.ScrollView>

          {/* Action Bar */}
          <BlurView
            intensity={isDark ? 30 : 50}
            tint={isDark ? "dark" : "light"}
            style={[styles.actionBar, { borderTopColor: t.border }]}
          >
            <LinearGradient
              colors={
                isDark
                  ? ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.01)"]
                  : ["rgba(255,255,255,0.85)", "rgba(255,255,255,0.6)"]
              }
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.actionContent}>
              <Button
                title={existingAnswer ? "Update Reflection" : "Save to Vault"}
                onPress={handleSave}
                loading={isSaving}
                disabled={!answer.trim()}
                fullWidth
              />
            </View>
          </BlurView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    height: 60,
  },
  closeBtn: { width: 40, height: 40 },
  closeBtnBlur: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  headerStatus: { flexDirection: "row", alignItems: "center" },

  scrollContent: { padding: SPACING.lg },

  promptContainer: {
    borderRadius: BORDER_RADIUS.xxl,
    marginBottom: 30,
    borderWidth: 1,
    overflow: "hidden",
    ...SHADOWS.medium,
  },

  promptContent: {
    padding: 24,
  },

  inputWrapper: { marginBottom: 20 },

  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingHorizontal: 4,
  },

  textArea: {
    minHeight: 200,
    textAlignVertical: "top",
    fontSize: 17,
  },

  hintCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginTop: 10,
    overflow: "hidden",
  },

  actionBar: {
    borderTopWidth: 1,
    overflow: "hidden",
  },

  actionContent: {
    padding: SPACING.lg,
  },
});