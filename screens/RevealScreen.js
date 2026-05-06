// screens/RevealScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from "expo-linear-gradient";
import Icon from '../components/Icon';
import { notification, selection, NotificationFeedbackType } from '../utils/haptics';
import { useAppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { promptStorage } from "../utils/storage";
import { DataLayer } from "../services/localfirst";
import { SPACING } from "../utils/theme";
import { getMyDisplayName, getPartnerDisplayName } from '../utils/profileNames';
import Button from "../components/Button";

export default function RevealScreen({ route, navigation }) {
  const { prompt, userAnswer, partnerAnswer: initialPartnerAnswer } = route?.params || {};
  const { state } = useAppContext();
  const { user, userProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const activePromptUserId = user?.id || user?.uid || state?.userId || null;

  // Safety check
  useEffect(() => {
    if (!prompt || !prompt?.text) {
      if (__DEV__) console.warn('RevealScreen: Invalid prompt provided');
      navigation.goBack();
      return;
    }
  }, [prompt, navigation]);

  const [isRevealed, setIsRevealed] = useState(!!userAnswer?.isRevealed);
  const [includeInKeepsake, setIncludeInKeepsake] = useState(!!userAnswer?.includeInKeepsake);
  const [isKeepsakeSaving, setIsKeepsakeSaving] = useState(false);

  // Handle partner states
  const [partnerAnswer, setPartnerAnswer] = useState(() => initialPartnerAnswer || null);
  const hasPartnerAnswer = !!partnerAnswer;

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

  const triggerRevealLogic = useCallback((doHaptics = true) => {
    if (doHaptics && Platform.OS !== "web") {
      notification(NotificationFeedbackType.Success);
    }
    setIsRevealed(true);

    Animated.parallel([
      Animated.timing(revealAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 50, useNativeDriver: true }),
    ]).start();
  }, [revealAnim, scaleAnim, slideAnim]);

  useEffect(() => {
    if (userAnswer?.isRevealed) {
      triggerRevealLogic(false);
      return undefined;
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

    return undefined;
  }, [isRevealed, pulseAnim, triggerRevealLogic, userAnswer?.isRevealed]);

  const handleReveal = async () => {
    if (!prompt?.id) return;
    selection();
    
    try {
      // Mark as revealed in the active DataLayer.
      const row = await DataLayer.getPromptAnswerForToday(prompt.id, prompt.dateKey);
      if (row?.partnerAnswer) {
        setPartnerAnswer(row.partnerAnswer);
      }
      if (row?.id) {
        await DataLayer.revealPromptAnswer(row.id);
      }
      // Also update promptStorage as a local display/cache fallback
      if (prompt.dateKey) {
        const existing = activePromptUserId
          ? await promptStorage.getAnswerForUser(prompt.dateKey, prompt.id, activePromptUserId)
          : await promptStorage.getAnswer(prompt.dateKey, prompt.id);
        await promptStorage.setAnswer(prompt.dateKey, prompt.id, {
          ...(existing || userAnswer || {}),
          userId: activePromptUserId || undefined,
          isRevealed: true,
          revealAt: Date.now(),
        });
      }
      triggerRevealLogic(true);
    } catch {
      triggerRevealLogic(true);
    }
  };

  useEffect(() => {
    if (initialPartnerAnswer) {
      setPartnerAnswer(initialPartnerAnswer);
    }
  }, [initialPartnerAnswer]);

  const refreshRevealState = useCallback(async () => {
    if (!prompt?.id) return;

    const row = await DataLayer.getPromptAnswerForToday(prompt.id, prompt.dateKey);

    if (row) {
      setPartnerAnswer(row.partnerAnswer || null);
      setIncludeInKeepsake(!!row.includeInKeepsake);
    }

    if (row?.isRevealed || row?.is_revealed) {
      triggerRevealLogic(false);
    }
  }, [prompt?.dateKey, prompt?.id, triggerRevealLogic]);

  useFocusEffect(
    useCallback(() => {
      refreshRevealState().catch(() => {});
      return undefined;
    }, [refreshRevealState])
  );

  useFocusEffect(
    useCallback(() => {
      if (!state?.coupleId || !prompt?.id) return undefined;

      let channelRef = null;
      let cancelled = false;

      const setup = async () => {
        try {
          const { supabase } = require('../config/supabase');
          if (!supabase || cancelled) return;

          const channel = supabase
            .channel(`prompt_reveal_${state.coupleId}_${prompt.id}`)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'couple_data',
                filter: `couple_id=eq.${state.coupleId}`,
              },
              (payload) => {
                const row = payload.new || payload.old;
                const currentUserId = user?.uid || user?.id;

                if (row?.data_type !== 'prompt_answer') return;
                if (currentUserId && row?.created_by === currentUserId) return;
                if (row?.value?.promptId !== prompt.id || row?.value?.dateKey !== prompt.dateKey) return;

                refreshRevealState().catch(() => {});
              }
            )
            .subscribe();

          if (cancelled) {
            supabase.removeChannel(channel);
            return;
          }

          channelRef = channel;
        } catch {
          // Focus refresh still keeps reveal state accurate without realtime.
        }
      };

      setup();

      return () => {
        cancelled = true;

        if (channelRef) {
          try {
            const { supabase } = require('../config/supabase');
            supabase?.removeChannel(channelRef);
          } catch {}

          channelRef = null;
        }
      };
    }, [prompt?.dateKey, prompt?.id, refreshRevealState, state?.coupleId, user?.id, user?.uid])
  );

  if (!prompt || !prompt.text) return null;

  const partnerName = getPartnerDisplayName(userProfile, state?.userProfile, 'your partner');
  const myName = getMyDisplayName(userProfile, state?.userProfile, 'You');
  const revealStage = isRevealed
    ? 'revealed'
    : hasPartnerAnswer
      ? 'ready_to_reveal'
      : 'waiting_for_partner';
  const revealCopy = {
    waiting_for_partner: {
      eyebrow: 'SAVED PRIVATELY',
      stageLabel: 'ANSWER SAVED',
      title: 'A reveal is forming',
      primaryLabel: 'Answer saved',
    },
    ready_to_reveal: {
      eyebrow: 'PRIVATE REVEAL',
      stageLabel: 'BOTH ANSWERS SAVED',
      title: 'You both left something',
      primaryLabel: 'Reveal together',
    },
    revealed: {
      eyebrow: 'REVEALED',
      stageLabel: null,
      title: "Here's what you both left",
      primaryLabel: 'Save to our archive',
      secondaryLabel: 'Plan something from this',
    },
  }[revealStage];
  const isCompactReveal = revealStage === 'revealed';

  const handleSaveMoment = () => {
    if (!prompt?.id || isKeepsakeSaving) return;
    selection();

    const nextValue = !includeInKeepsake;
    setIsKeepsakeSaving(true);

    Promise.resolve()
      .then(async () => {
        const row = await DataLayer.getPromptAnswerForToday(prompt.id, prompt.dateKey).catch(() => null);
        const answerText = row?.answer || userAnswer?.answer || '';
        if (!answerText) return;

        await DataLayer.savePromptAnswer({
          promptId: prompt.id,
          answer: answerText,
          heatLevel: prompt?.heat || 1,
          dateKey: prompt.dateKey,
          includeInKeepsake: nextValue,
        }).catch(() => {});

        if (prompt.dateKey) {
          const existing = activePromptUserId
            ? await promptStorage.getAnswerForUser(prompt.dateKey, prompt.id, activePromptUserId)
            : await promptStorage.getAnswer(prompt.dateKey, prompt.id);
          await promptStorage.setAnswer(prompt.dateKey, prompt.id, {
            ...(existing || userAnswer || {}),
            answer: answerText,
            userId: activePromptUserId || undefined,
            includeInKeepsake: nextValue,
          });
        }

        setIncludeInKeepsake(nextValue);
        notification(NotificationFeedbackType.Success);
      })
      .finally(() => setIsKeepsakeSaving(false));
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
          
          <View style={styles.header}>
            <View style={[styles.headerPill, { backgroundColor: t.surfaceGlass, borderColor: t.border }]}>
              <Text
                style={[styles.headerSubtitle, { color: t.primary }]}
                allowFontScaling={false}
              >
                {revealCopy.eyebrow}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => { selection(); navigation.goBack(); }}
              style={styles.closeButton}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
              activeOpacity={0.75}
            >
              <Icon name="close-outline" size={28} color={t.text} />
            </TouchableOpacity>
          </View>

          {/* Hero Prompt Card (Glass Style) */}
          <View
            style={[
              styles.promptContainer,
              isCompactReveal && styles.promptContainerCompact,
              { backgroundColor: t.surfaceGlass, borderColor: t.border },
            ]}
          >
            <Text
              style={[styles.questionText, isCompactReveal && styles.questionTextCompact, { color: t.text }]}
              allowFontScaling={false}
            >
              {prompt.text}
            </Text>
          </View>

          {revealStage !== 'revealed' ? (
            /* LOCKED STATE */
            <View style={styles.lockedStage}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <LinearGradient
                  colors={['#D2121A', '#8F0C11']}
                  style={[styles.lockedCircle, { shadowColor: '#D2121A' }]}
                >
                  <Icon name="lock-closed-outline" size={34} color="#FFFFFF" />
                </LinearGradient>
              </Animated.View>

              <Text
                style={[styles.lockedTitle, { color: t.text }]}
                allowFontScaling={false}
              >
                {revealCopy.title}
              </Text>

              <Button
                title={revealCopy.primaryLabel}
                onPress={handleReveal}
                disabled={revealStage === 'waiting_for_partner'}
                style={styles.revealAction}
              />
              
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
              <View style={[styles.answerCard, styles.answerCardCompact]}>
                <Text style={[styles.tagText, { color: t.subtext }]} allowFontScaling={false}>
                  {myName} said
                </Text>
                <View style={[styles.bubble, styles.bubbleCompact, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: t.border }]}>
                  <Text style={[styles.bubbleText, { color: t.text }]} allowFontScaling={false}>
                    {userAnswer?.answer || "Your answer is saved."}
                  </Text>
                </View>
              </View>

              {/* Partner Reflection */}
              <View style={[styles.answerCard, styles.answerCardCompact]}>
                <Text style={[styles.tagText, { color: t.accent }]} allowFontScaling={false}>
                  {partnerName} said
                </Text>
                {hasPartnerAnswer ? (
                  <LinearGradient
                    colors={isDark ? [t.accent + "15", '#1C1C1E'] : [t.accent + "10", '#FFFFFF']}
                    style={[styles.bubble, styles.bubbleCompact, { borderColor: t.border }]}
                  >
                    <Text style={[styles.bubbleText, { color: t.text }]} allowFontScaling={false}>
                      {partnerAnswer}
                    </Text>
                  </LinearGradient>
                ) : (
                  <View style={[styles.bubble, { backgroundColor: t.surfaceSecondary, borderColor: t.border, alignItems: 'center', paddingVertical: 40 }]}>
                    <Icon name="pulse-outline" size={36} color={t.accent + '80'} style={{ marginBottom: 16 }} />
                    <Text
                      style={[styles.bubbleText, { color: t.subtext, textAlign: 'center' }]}
                      allowFontScaling={false}
                    >
                      {partnerName} hasn't shared their thoughts yet.
                    </Text>
                  </View>
                )}
              </View>

              <Button
                title={includeInKeepsake ? 'In Keepsake' : 'Add to Keepsake'}
                variant="outline"
                onPress={handleSaveMoment}
                disabled={isKeepsakeSaving}
                style={styles.journalAction}
              />
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  selection();
                  navigation.navigate("MainTabs", {
                    screen: "DatePlans",
                    params: {
                      source: 'prompt_reveal',
                      promptText: prompt.text,
                    },
                  });
                }}
                style={styles.secondaryAction}
              >
                <Text style={[styles.secondaryActionText, { color: t.primary }]} allowFontScaling={false}>
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
    paddingBottom: SPACING.xxl,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  headerPill: {
    minHeight: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
    lineHeight: 12,
    textTransform: 'uppercase',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },

  // Hero Prompt
  promptContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: 20,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16 },
      android: { elevation: 6 },
    }),
  },
  promptContainerCompact: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
  },
  questionText: {
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 25,
    letterSpacing: 0,
    fontFamily: Platform.select({ ios: "System", android: "Roboto" }),
  },
  questionTextCompact: {
    fontSize: 18,
    lineHeight: 25,
  },

  // Locked State
  lockedStage: {
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
    paddingHorizontal: SPACING.sm,
  },
  lockedCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.24, shadowRadius: 14 },
      android: { elevation: 8 },
    }),
  },
  lockedTitle: {
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 38,
    marginTop: SPACING.lg,
    marginBottom: 0,
    textAlign: 'center',
  },
  lockedEyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  lockedSub: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "400",
    paddingHorizontal: SPACING.lg,
  },
  revealAction: { 
    marginTop: SPACING.xl,
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
    marginBottom: SPACING.lg,
  },
  answerCardCompact: {
    marginBottom: SPACING.md,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.3,
    marginBottom: SPACING.xs,
    marginLeft: SPACING.sm,
  },
  bubble: {
    padding: SPACING.lg,
    borderRadius: 22,
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
      android: { elevation: 2 },
    }),
  },
  bubbleCompact: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 20,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
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
    marginTop: SPACING.md,
    height: 54,
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
