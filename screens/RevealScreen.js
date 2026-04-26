// screens/RevealScreen.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  TouchableOpacity,
  Platform,
  StatusBar,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from "expo-linear-gradient";
import Icon from '../components/Icon';
import { BlurView } from "expo-blur";
import CloseScreenHeader, { CLOSE_HEADER_STYLES } from '../components/CloseScreenHeader';
import { notification, selection, NotificationFeedbackType } from '../utils/haptics';
import { useAppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { promptStorage } from "../utils/storage";
import { DataLayer } from "../services/localfirst";
import PartnerNotifications from "../services/PartnerNotifications";
import { SPACING } from "../utils/theme";
import { getMyDisplayName, getPartnerDisplayName } from '../utils/profileNames';
import Button from "../components/Button";

export default function RevealScreen({ route, navigation }) {
  const { prompt, userAnswer, partnerAnswer: initialPartnerAnswer, bothAnswered } = route?.params || {};
  const { state } = useAppContext();
  const { userProfile } = useAuth();
  const { colors, isDark } = useTheme();

  // Safety check
  useEffect(() => {
    if (!prompt || !prompt?.text) {
      if (__DEV__) console.warn('RevealScreen: Invalid prompt provided');
      navigation.goBack();
      return;
    }
  }, [prompt, navigation]);

  const [isRevealed, setIsRevealed] = useState(!!userAnswer?.isRevealed);

  // Handle partner states
  const hasPartnerAnswer = !!initialPartnerAnswer;
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
    accent: colors.accent || '#D4AA7E',
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
    if (!prompt?.id) return;
    selection();
    
    try {
      // Mark as revealed in the active DataLayer.
      const row = await DataLayer.getPromptAnswerForToday(prompt.id);
      if (row?.id) {
        await DataLayer.revealPromptAnswer(row.id);
      }
      // Also mark in legacy promptStorage for backward compat
      if (prompt.dateKey) {
        const existing = await promptStorage.getAnswer(prompt.dateKey, prompt.id);
        await promptStorage.setAnswer(prompt.dateKey, prompt.id, {
          ...(existing || userAnswer || {}),
          isRevealed: true,
          revealAt: Date.now(),
        });
      }
      triggerRevealLogic(true);
    } catch {
      triggerRevealLogic(true);
    }
  };

  if (!prompt || !prompt.text) return null;

  const partnerName = getPartnerDisplayName(userProfile, state?.userProfile, 'your partner');
  const myName = getMyDisplayName(userProfile, state?.userProfile, 'You');
  const revealStage = isRevealed
    ? 'revealed'
    : hasPartnerAnswer && bothAnswered !== false
      ? 'ready_to_reveal'
      : 'waiting_for_partner';
  const revealCopy = {
    waiting_for_partner: {
      eyebrow: 'SAVED PRIVATELY',
      title: 'A reveal is forming',
      body: `Your answer is in. ${partnerName} can add theirs whenever they're ready.`,
      primaryLabel: `Let ${partnerName} know`,
      helper: 'Nothing is shown until both answers are in.',
    },
    ready_to_reveal: {
      eyebrow: 'PRIVATE REVEAL',
      title: 'You both left something',
      body: 'Open the reveal and see where you met today.',
      primaryLabel: 'Reveal together',
      helper: 'The app shows both answers together when you open this moment.',
    },
    revealed: {
      eyebrow: 'REVEALED',
      title: "Here's what you both left",
      body: 'You both made a small private moment today. Save it to your archive or turn it into time together.',
      primaryLabel: 'Save to our archive',
      secondaryLabel: 'Plan something from this',
    },
  }[revealStage];

  const handleNudgePartner = async () => {
    if (!prompt?.id) return;
    selection();
    await PartnerNotifications.promptAnswered(myName, prompt.id);
    notification(NotificationFeedbackType.Success);
  };

  const handleSaveMoment = () => {
    selection();
    navigation.navigate("AddMemory", {
      source: 'prompt_reveal',
      promptText: prompt.text,
      myAnswer: userAnswer?.answer || '',
      partnerAnswer: partnerAnswer || '',
    });
  };

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
          
          <CloseScreenHeader
            title="Private Reveal"
            subtitle={revealCopy.eyebrow}
            titleColor={t.text}
            subtitleColor={t.primary}
            closeColor={t.text}
            onClose={() => { selection(); navigation.goBack(); }}
          />

          {/* Hero Prompt Card (Glass Style) */}
          <View style={[styles.promptContainer, { backgroundColor: t.surfaceGlass, borderColor: t.border }]}>
            <View style={styles.eyebrowRow}>
              <Icon name="sparkles-outline" size={12} color={t.primary} />
              <Text style={[styles.questionLabel, { color: t.primary }]}>TODAY BETWEEN US</Text>
            </View>
            <Text style={[styles.questionText, { color: t.text }]}>{prompt.text}</Text>
          </View>

          {revealStage !== 'revealed' ? (
            /* LOCKED STATE */
            <View style={styles.lockedStage}>
              <View style={{ width: '100%', alignItems: 'center' }}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }], marginBottom: SPACING.xxl }}>
                  <LinearGradient 
                    colors={['#D2121A', '#8F0C11']} 
                    style={[styles.lockedCircle, { shadowColor: '#D2121A' }]}
                  >
                    <Icon name="lock-closed-outline" size={42} color="#FFFFFF" />
                  </LinearGradient>
                </Animated.View>
              </View>

              <Text style={[styles.lockedEyebrow, { color: t.primary }]}>{revealCopy.eyebrow}</Text>
              <Text style={[styles.lockedTitle, { color: t.text }]}>{revealCopy.title}</Text>
              <Text style={[styles.lockedSub, { color: t.subtext }]}>
                {revealCopy.body}
              </Text>

              <Button
                title={revealCopy.primaryLabel}
                onPress={revealStage === 'waiting_for_partner' ? handleNudgePartner : handleReveal}
                style={styles.revealAction}
              />
              
              <View style={styles.privacyNoteContainer}>
                <Icon name="shield-outline" size={14} color={t.subtext} />
                <Text style={[styles.miniNote, { color: t.subtext }]}>
                  {revealCopy.helper}
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
                <Text style={[styles.tagText, { color: t.subtext }]}>You said</Text>
                <View style={[styles.bubble, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: t.border }]}>
                  <Text style={[styles.bubbleText, { color: t.text }]}>
                    {userAnswer?.answer || "Your answer is saved."}
                  </Text>
                </View>
              </View>

              {/* Partner Reflection */}
              <View style={styles.answerCard}>
                <Text style={[styles.tagText, { color: t.accent }]}>{partnerName} said</Text>
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
                    <Icon name="pulse-outline" size={36} color={t.accent + '80'} style={{ marginBottom: 16 }} />
                    <Text style={[styles.bubbleText, { color: t.subtext, textAlign: 'center' }]}>
                      {partnerName || 'Your partner'} hasn't shared their thoughts yet.
                    </Text>
                    <Text style={[styles.miniNote, { color: t.subtext, marginTop: 12 }]}>
                      They can reveal yours after they answer too.
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
                  <Icon name="bookmark-outline" size={20} color={t.accent} />
                  <Text style={[styles.insightTitle, { color: t.text }]}>Worth keeping</Text>
                </View>
                <Text style={[styles.insightText, { color: t.subtext }]}>
                  {revealCopy.body}
                </Text>
              </BlurView>

              <Button
                title={revealCopy.primaryLabel}
                variant="outline"
                onPress={handleSaveMoment}
                style={styles.journalAction}
              />
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  selection();
                  navigation.navigate("DatePlans", {
                    source: 'prompt_reveal',
                    promptText: prompt.text,
                  });
                }}
                style={styles.secondaryAction}
              >
                <Text style={[styles.secondaryActionText, { color: t.primary }]}>
                  {revealCopy.secondaryLabel}
                </Text>
              </TouchableOpacity>
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
    flexGrow: 1,
    paddingHorizontal: SPACING.xl, 
    paddingTop: SPACING.sm, 
    paddingBottom: SPACING.xxxl 
  },

  // Header
  header: CLOSE_HEADER_STYLES.header,
  backButton: CLOSE_HEADER_STYLES.closeButton,
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
    fontFamily: Platform.select({ ios: "System", android: "Roboto" }),
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
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  lockedEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: SPACING.xl,
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
    height: 56,
    borderRadius: 28,
  },
  secondaryAction: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
