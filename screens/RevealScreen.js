import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Animated,
  TouchableOpacity,
  Dimensions,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useAppContext } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import { promptStorage } from "../utils/storage";
import { TYPOGRAPHY, SPACING, BORDER_RADIUS, COLORS, SHADOWS, getGlassStyle } from "../utils/theme";
import Button from "../components/Button";

const { width } = Dimensions.get("window");

export default function RevealScreen({ route, navigation }) {
  const { prompt, userAnswer, partnerAnswer: initialPartnerAnswer, bothAnswered } = route?.params || {};
  const { state } = useAppContext();
  const { theme: activeTheme, isDark } = useTheme();

  // Safety check: if no prompt, go back
  useEffect(() => {
    if (!prompt) {
      console.warn('RevealScreen: No prompt provided in route params');
      navigation.goBack();
      return;
    }
    
    if (!prompt?.text) {
      console.warn('RevealScreen: Prompt missing text property:', prompt);
      navigation.goBack();
      return;
    }
    
    console.log('RevealScreen: Prompt loaded successfully:', { id: prompt.id, hasText: !!prompt.text });
  }, [prompt, navigation]);

  const [isRevealed, setIsRevealed] = useState(false);

  // Handle different partner answer states
  const [partnerAnswer] = useState(() => {
    if (initialPartnerAnswer) {
      return initialPartnerAnswer;
    } else if (bothAnswered === false) {
      return `${state.partnerLabel || 'Your partner'} hasn't shared their thoughts yet. Your answer might inspire them to join the conversation! 💕`;
    } else {
      return "I cherish how you handle my bad days with so much grace. It makes me want to be a better partner for you every single day.";
    }
  });

  const hasPartnerAnswer = !!initialPartnerAnswer;

  // High-End Animation Refs
  const revealAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Normalized Theme Logic (works with both your theme objects + legacy COLORS)
  const t = useMemo(() => {
    const base = activeTheme?.colors ?? activeTheme;
    return {
      background: base?.background ?? (isDark ? COLORS.warmCharcoal : COLORS.softCream),
      surface: base?.surface ?? (isDark ? COLORS.deepPlum : "#FFFFFF"),
      surfaceSecondary:
        base?.surfaceSecondary ?? (isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"),
      accent: base?.accent ?? base?.primary ?? COLORS.blushRose,
      primary: base?.primary ?? COLORS.blushRose,
      text: base?.text ?? (isDark ? COLORS.softCream : COLORS.charcoal),
      subtext: base?.textSecondary ?? (isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.6)"),
      border: base?.border ?? (isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"),
      card: base?.card ?? (isDark ? "#121212" : "#FFFFFF"),
    };
  }, [activeTheme, isDark]);

  useEffect(() => {
    // If already revealed (e.g., returning to screen), animate in
    if (userAnswer?.isRevealed) {
      triggerRevealLogic(false);
      return;
    }

    // Continuous pulse for the locked icon
    if (!isRevealed) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 1400, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [isRevealed]);

  const triggerRevealLogic = (doHaptics = true) => {
    if (doHaptics && Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setIsRevealed(true);

    Animated.parallel([
      Animated.timing(revealAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
    ]).start();
  };

  const handleReveal = async () => {
    if (!prompt?.id || !prompt?.dateKey) return;
    
    await Haptics.selectionAsync();
    
    try {
      // Mark revealed (local) for your current user's answer
      const existing = await promptStorage.getAnswer(prompt.dateKey, prompt.id);
      await promptStorage.setAnswer(prompt.dateKey, prompt.id, {
        ...(existing || userAnswer || {}),
        isRevealed: true,
        revealAt: Date.now(),
      });
      triggerRevealLogic(true);
    } catch (e) {
      // Never block UX
      triggerRevealLogic(true);
    }
  };

  if (!prompt || !prompt.text) {
    console.warn('RevealScreen: Rendering blocked - invalid prompt');
    return null;
  }

  const partnerLabel = (state.partnerLabel || "Partner").toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      {/* Soft background wash */}
      <LinearGradient
        colors={isDark ? [t.background, "#0B0B0B"] : [t.background, "#FFFFFF"]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Custom Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={async () => {
                await Haptics.selectionAsync();
                navigation.goBack();
              }} 
              style={styles.backButton}
            >
              <BlurView intensity={20} tint={isDark ? "dark" : "light"} style={styles.headerBlur}>
                <MaterialCommunityIcons name="chevron-left" size={24} color={t.text} />
              </BlurView>
            </TouchableOpacity>

            <Text style={[styles.headerTitle, { color: t.text }]}>Reflection Reveal</Text>

            <View style={{ width: 44 }} />
          </View>

          {/* Question Display */}
          <View style={[styles.promptContainer, { backgroundColor: t.surfaceSecondary, borderColor: t.border }]}>
            <Text style={[styles.questionLabel, { color: t.accent }]}>THE DAILY PROMPT</Text>
            <Text style={[styles.questionText, { color: t.text }]}>{prompt?.text || "Loading prompt..."}</Text>
          </View>

          {!isRevealed ? (
            /* LOCKED STATE */
            <View style={styles.lockedStage}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <LinearGradient colors={[t.accent, "#FF9EBC"]} style={styles.lockedCircle}>
                  <MaterialCommunityIcons name="heart-flash" size={50} color="#FFF" />
                </LinearGradient>
              </Animated.View>

              <Text style={[styles.lockedTitle, { color: t.text }]}>Ready to connect?</Text>
              <Text style={[styles.lockedSub, { color: t.subtext }]}>
                Your shared thoughts are waiting. Tap below to reveal your {state.partnerLabel || "partner"}’s reflection.
              </Text>

              <Button title="Reveal Together" onPress={handleReveal} style={styles.revealAction} />
              <Text style={[styles.miniNote, { color: t.subtext }]}>
                Private by design • Reveals only after both have answered
              </Text>
            </View>
          ) : (
            /* REVEALED STATE */
            <Animated.View
              style={{
                opacity: revealAnim,
                transform: [{ scale: scaleAnim }, { translateY: slideAnim }],
              }}
            >
              {/* My Reflection */}
              <View style={styles.answerCard}>
                <View style={[styles.userTag, { backgroundColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)" }]}>
                  <Text style={styles.tagText}>YOU</Text>
                </View>

                <View style={[styles.bubble, { backgroundColor: t.surface, borderColor: t.border }]}>
                  <Text style={[styles.bubbleText, { color: t.text }]}>
                    {userAnswer?.answer || "Your thought has been safely stored."}
                  </Text>
                </View>
              </View>

              {/* Partner Reflection */}
              <View style={styles.answerCard}>
                <View style={[styles.userTag, { backgroundColor: t.accent }]}>
                  <Text style={styles.tagText}>{partnerLabel}</Text>
                </View>

                <LinearGradient colors={[t.accent + "22", t.surface]} style={[styles.bubble, { borderColor: t.border }]}>
                  <Text style={[styles.bubbleText, { color: t.text, fontStyle: "italic" }]}>
                    “{partnerAnswer}”
                  </Text>
                </LinearGradient>
              </View>

              {/* Discussion Guide */}
              <BlurView
                intensity={isDark ? 14 : 22}
                tint={isDark ? "dark" : "light"}
                style={[styles.insightBox, { borderColor: t.border }]}
              >
                <View style={styles.insightHeader}>
                  <MaterialCommunityIcons name="auto-fix" size={20} color={t.accent} />
                  <Text style={[styles.insightTitle, { color: t.text }]}>Connection Bridge</Text>
                </View>

                <Text style={[styles.insightText, { color: t.subtext }]}>
                  What was the most surprising part of their answer? Tell them one thing you loved about their perspective.
                </Text>
              </BlurView>

              <Button
                title="Save to Journal"
                variant="outline"
                onPress={async () => {
                  await Haptics.selectionAsync();
                  navigation.navigate("Journal");
                }}
                style={{ marginTop: 24, marginBottom: 40 }}
              />
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  scrollContent: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 30 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backButton: { width: 44, height: 44 },
  headerBlur: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  promptContainer: {
    padding: 24,
    borderRadius: 30,
    marginBottom: 30,
    borderWidth: 1,
  },
  questionLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 12,
  },
  questionText: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
  },

  lockedStage: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  lockedCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    ...(SHADOWS?.large || {}),
  },
  lockedTitle: {
    fontSize: 28,
    fontWeight: "900",
    marginTop: 32,
  },
  lockedSub: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  revealAction: { marginTop: 40, minWidth: 220 },
  miniNote: { marginTop: 14, fontSize: 12, opacity: 0.7 },

  answerCard: { marginBottom: 30 },
  userTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 10,
  },
  tagText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  bubble: {
    padding: 28,
    borderRadius: 32,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    ...(SHADOWS?.small || {}),
  },
  bubbleText: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "600",
  },

  insightBox: {
    padding: 24,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginLeft: 8,
  },
  insightText: { fontSize: 14, lineHeight: 22, fontWeight: "600", opacity: 0.95 },

  waitingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },

  waitingText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});