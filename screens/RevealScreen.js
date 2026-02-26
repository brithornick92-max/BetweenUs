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
import { TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS, getGlassStyle } from "../utils/theme";
import Button from "../components/Button";

const { width } = Dimensions.get("window");

export default function RevealScreen({ route, navigation }) {
  const { prompt, userAnswer, partnerAnswer: initialPartnerAnswer, bothAnswered } = route?.params || {};
  const { state } = useAppContext();
  const { colors, isDark } = useTheme();

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
    
    if (__DEV__) console.log('RevealScreen: Prompt loaded successfully:', { id: prompt.id, hasText: !!prompt.text });
  }, [prompt, navigation]);

  const [isRevealed, setIsRevealed] = useState(false);

  // Handle different partner answer states
  const hasPartnerAnswer = !!initialPartnerAnswer;
  const isWaitingForPartner = !initialPartnerAnswer || bothAnswered === false;

  const [partnerAnswer] = useState(() => {
    if (initialPartnerAnswer) {
      return initialPartnerAnswer;
    }
    return null;
  });

  // High-End Animation Refs
  const revealAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Normalized Theme Logic
  const t = useMemo(() => {
    return {
      background: colors.background,
      surface: colors.surface,
      surfaceSecondary: colors.surface2,
      accent: colors.accent,
      primary: colors.primary,
      text: colors.text,
      subtext: colors.textMuted,
      border: colors.border,
      card: colors.surface,
    };
  }, [colors]);

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
        colors={isDark ? [t.background, t.surface] : [t.background, t.surfaceSecondary]}
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

            <Text style={[styles.headerTitle, { color: t.text }]}>Your Reflection</Text>

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
                  <MaterialCommunityIcons name="heart-flash" size={50} color={t.text} />
                </LinearGradient>
              </Animated.View>

              <Text style={[styles.lockedTitle, { color: t.text }]}>Ready to connect?</Text>
              <Text style={[styles.lockedSub, { color: t.subtext }]}>
                This is your moment. When you reveal, you’ll see how {state.partnerLabel || "your partner"}’s heart answered the same question.
              </Text>

              <Button title="Reveal Together" onPress={handleReveal} style={styles.revealAction} />
              <Text style={[styles.miniNote, { color: t.subtext }]}>
                Private by design {isWaitingForPartner ? '• Your answer stays sealed until both share' : '• Shared reflections are just between you two'}
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
                <View style={[styles.userTag, { backgroundColor: isDark ? "#151118" : t.accent + "30" }]}> 
                  <Text style={[styles.tagText, { color: t.text }]}>YOU</Text>
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
                  <Text style={[styles.tagText, { color: t.text }]}>{partnerLabel}</Text>
                </View>

                {hasPartnerAnswer ? (
                  <LinearGradient
                    colors={[t.accent + "22", t.surface]}
                    style={[styles.bubble, { borderColor: t.border }]}
                  >
                    <Text style={[styles.bubbleText, { color: t.text }]}>
                      {partnerAnswer}
                    </Text>
                  </LinearGradient>
                ) : (
                  <View
                    style={[
                      styles.bubble,
                      { backgroundColor: t.surfaceSecondary, borderColor: t.border, alignItems: 'center' },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="heart-pulse"
                      size={32}
                      color={t.accent}
                      style={{ marginBottom: 12 }}
                    />
                    <Text style={[styles.bubbleText, { color: t.subtext, textAlign: 'center' }]}>
                      {state.partnerLabel || 'Your partner'} hasn't shared their thoughts yet.
                    </Text>
                    <Text style={[styles.miniNote, { color: t.subtext, marginTop: 8 }]}>
                      They'll see yours once they answer too ✨
                    </Text>
                  </View>
                )}
              </View>

              {/* Discussion Guide */}
              <BlurView
                intensity={isDark ? 14 : 22}
                tint={isDark ? "dark" : "light"}
                style={[styles.insightBox, { borderColor: t.border }]}
              >
                <View style={styles.insightHeader}>
                  <MaterialCommunityIcons name="auto-fix" size={20} color={t.accent} />
                  <Text style={[styles.insightTitle, { color: t.text }]}>Keep Going</Text>
                </View>

                <Text style={[styles.insightText, { color: t.subtext }]}>
                  What surprised you about their answer? Tell them the one thing that made you feel closer.
                </Text>
              </BlurView>

              <Button
                title="Save to Journal"
                variant="outline"
                onPress={async () => {
                  await Haptics.selectionAsync();
                  navigation.navigate("JournalEntry");
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
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  promptContainer: {
    padding: 28,
    borderRadius: 30,
    marginBottom: 30,
    borderWidth: 1,
    minHeight: Math.min(Dimensions.get('window').height * 0.85, 720),
    justifyContent: 'center',
  },
  questionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 12,
  },
  questionText: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 30,
  },

  lockedStage: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    paddingHorizontal: 10,
  },
  lockedCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: "center",
    justifyContent: "center",
    ...(SHADOWS?.large || {}),
  },
  lockedTitle: {
    fontFamily: Platform.select({
      ios: "PlayfairDisplay_700Bold",
      android: "PlayfairDisplay_700Bold",
    }),
    fontSize: 30,
    fontWeight: "700",
    marginTop: 36,
  },
  lockedSub: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 26,
    paddingHorizontal: 10,
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
    fontSize: 10,
    fontWeight: "700",
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
    fontWeight: "700",
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
  },
});