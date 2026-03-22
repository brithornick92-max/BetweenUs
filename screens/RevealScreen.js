// screens/RevealScreen.js
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
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { useAppContext } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import { promptStorage } from "../utils/storage";
import { SPACING, BORDER_RADIUS, SHADOWS } from "../utils/theme";
import Button from "../components/Button";

const { width } = Dimensions.get("window");

export default function RevealScreen({ route, navigation }) {
  const { prompt, userAnswer, partnerAnswer: initialPartnerAnswer, bothAnswered } = route?.params || {};
  const { state } = useAppContext();
  const { colors, isDark } = useTheme();

  // Safety check
  useEffect(() => {
    if (!prompt || !prompt?.text) {
      console.warn('RevealScreen: Invalid prompt provided');
      navigation.goBack();
      return;
    }
  }, [prompt, navigation]);

  const [isRevealed, setIsRevealed] = useState(false);

  // Handle partner states
  const hasPartnerAnswer = !!initialPartnerAnswer;
  const isWaitingForPartner = !initialPartnerAnswer || bothAnswered === false;
  const [partnerAnswer] = useState(() => initialPartnerAnswer || null);

  // High-End Animation Refs
  const revealAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Normalized Theme Logic (Velvet Glass Palette)
  const t = useMemo(() => ({
    background: colors.background,
    surface: colors.surface,
    surfaceSecondary: colors.surface2 || '#1C1C1E',
    surfaceGlass: isDark ? 'rgba(28, 28, 30, 0.65)' : 'rgba(255, 255, 255, 0.7)',
    accent: colors.accent || '#FF2D55',
    primary: colors.primary,
    text: colors.text,
    subtext: colors.text + '99',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  useEffect(() => {
    if (userAnswer?.isRevealed) {
      triggerRevealLogic(false);
      return;
    }

    if (!isRevealed) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [isRevealed, userAnswer]);

  const triggerRevealLogic = (doHaptics = true) => {
    if (doHaptics && Platform.OS !== "web") {
      notification(NotificationFeedbackType.Success);
    }
    setIsRevealed(true);

    Animated.parallel([
      Animated.timing(revealAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleReveal = async () => {
    if (!prompt?.id || !prompt?.dateKey) return;
    selection();
    
    try {
      const existing = await promptStorage.getAnswer(prompt.dateKey, prompt.id);
      await promptStorage.setAnswer(prompt.dateKey, prompt.id, {
        ...(existing || userAnswer || {}),
        isRevealed: true,
        revealAt: Date.now(),
      });
      triggerRevealLogic(true);
    } catch (e) {
      triggerRevealLogic(true);
    }
  };

  if (!prompt || !prompt.text) return null;

  const partnerLabel = (state.partnerLabel || "Partner").toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Velvet background gradient */}
      <LinearGradient
        colors={isDark 
          ? [t.background, '#0F0A1A', '#0D081A', t.background] 
          : [t.background, '#F3EDE8', t.background]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={() => { selection(); navigation.goBack(); }} 
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <BlurView intensity={20} tint={isDark ? "dark" : "light"} style={styles.headerBlur}>
                <MaterialCommunityIcons name="chevron-left" size={28} color={t.text} />
              </BlurView>
            </TouchableOpacity>
          </View>

          {/* Hero Prompt Card (Glass Style) */}
          <View style={[styles.promptContainer, { backgroundColor: t.surfaceGlass, borderColor: t.border }]}>
            <View style={styles.eyebrowRow}>
              <MaterialCommunityIcons name="star-four-points" size={12} color={t.accent} />
              <Text style={[styles.questionLabel, { color: t.accent }]}>THE DAILY PROMPT</Text>
            </View>
            <Text style={[styles.questionText, { color: t.text }]}>{prompt.text}</Text>
          </View>

          {!isRevealed ? (
            /* LOCKED STATE */
            <View style={styles.lockedStage}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <LinearGradient 
                  colors={[t.accent, '#7A1E4E']} 
                  style={[styles.lockedCircle, { shadowColor: t.accent }]}
                >
                  <MaterialCommunityIcons name="lock-heart" size={42} color="#FFFFFF" />
                </LinearGradient>
              </Animated.View>

              <Text style={[styles.lockedTitle, { color: t.text }]}>Ready to connect?</Text>
              <Text style={[styles.lockedSub, { color: t.subtext }]}>
                This is your moment. When you reveal, you’ll see how {state.partnerLabel || "your partner"}’s heart answered the same question.
              </Text>

              <Button title="Reveal Together" onPress={handleReveal} style={styles.revealAction} />
              
              <View style={styles.privacyNoteContainer}>
                <MaterialCommunityIcons name="shield-lock-outline" size={14} color={t.subtext} />
                <Text style={[styles.miniNote, { color: t.subtext }]}>
                  {isWaitingForPartner ? 'Your answer stays sealed until both share' : 'Shared reflections are just between you two'}
                </Text>
              </View>
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
                <Text style={[styles.tagText, { color: t.subtext }]}>YOU</Text>
                <View style={[styles.bubble, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: t.border }]}>
                  <Text style={[styles.bubbleText, { color: t.text }]}>
                    {userAnswer?.answer || "Your thought has been safely stored."}
                  </Text>
                </View>
              </View>

              {/* Partner Reflection */}
              <View style={styles.answerCard}>
                <Text style={[styles.tagText, { color: t.accent }]}>{partnerLabel}</Text>
                {hasPartnerAnswer ? (
                  <LinearGradient
                    colors={isDark ? [t.accent + "15", '#1C1C1E'] : [t.accent + "10", '#FFFFFF']}
                    style={[styles.bubble, { borderColor: t.border }]}
                  >
                    <Text style={[styles.bubbleText, { color: t.text }]}>
                      {partnerAnswer}
                    </Text>
                  </LinearGradient>
                ) : (
                  <View style={[styles.bubble, { backgroundColor: t.surfaceSecondary, borderColor: t.border, alignItems: 'center', paddingVertical: 40 }]}>
                    <MaterialCommunityIcons name="heart-pulse" size={36} color={t.accent + '80'} style={{ marginBottom: 16 }} />
                    <Text style={[styles.bubbleText, { color: t.subtext, textAlign: 'center' }]}>
                      {state.partnerLabel || 'Your partner'} hasn't shared their thoughts yet.
                    </Text>
                    <Text style={[styles.miniNote, { color: t.subtext, marginTop: 12 }]}>
                      They'll see yours once they answer too ✨
                    </Text>
                  </View>
                )}
              </View>

              {/* Discussion Guide / Keep Going */}
              <BlurView
                intensity={isDark ? 15 : 30}
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
                onPress={() => {
                  selection();
                  navigation.navigate("JournalEntry");
                }}
                style={styles.journalAction}
              />
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ------------------------------------------------------------------
// STYLES - Apple Editorial Velvet Glass Layout
// ------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { 
    paddingHorizontal: SPACING.xl, 
    paddingTop: SPACING.sm, 
    paddingBottom: SPACING.xxxl 
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.lg,
  },
  backButton: { width: 44, height: 44 },
  headerBlur: {
    width: 44, height: 44,
    borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },

  // Hero Prompt
  promptContainer: {
    padding: SPACING.xl,
    borderRadius: 30,
    marginBottom: SPACING.xxl,
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20 },
      android: { elevation: 6 },
    }),
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.md,
  },
  questionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  questionText: {
    fontSize: 26,
    fontWeight: "300",
    lineHeight: 38,
    letterSpacing: -0.4,
    fontFamily: Platform.select({ ios: "System", android: "serif" }),
  },

  // Locked State
  lockedStage: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.md,
  },
  lockedCircle: {
    width: 100, height: 100,
    borderRadius: 50,
    alignItems: "center", justifyContent: "center",
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16 },
      android: { elevation: 8 },
    }),
  },
  lockedTitle: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginTop: SPACING.xxl,
    marginBottom: SPACING.sm,
  },
  lockedSub: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "400",
    paddingHorizontal: SPACING.lg,
  },
  revealAction: { 
    marginTop: SPACING.xxl, 
    width: '100%',
    height: 56,
    borderRadius: 28,
  },
  privacyNoteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACING.lg,
  },
  miniNote: { 
    fontSize: 13, 
    fontWeight: "500",
  },

  // Revealed State
  answerCard: { 
    marginBottom: SPACING.xl,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
    marginLeft: SPACING.sm,
  },
  bubble: {
    padding: SPACING.xl,
    borderRadius: 28,
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
      android: { elevation: 2 },
    }),
  },
  bubbleText: {
    fontSize: 17,
    lineHeight: 28,
    fontWeight: "400",
  },

  // Insights / Keep Going
  insightBox: {
    padding: SPACING.xl,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    marginTop: SPACING.md,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginLeft: 8,
    letterSpacing: -0.2,
  },
  insightText: { 
    fontSize: 15, 
    lineHeight: 24, 
    fontWeight: "500",
  },

  journalAction: { 
    marginTop: SPACING.xxl, 
    marginBottom: SPACING.xl,
    height: 56,
    borderRadius: 28,
  },
});
