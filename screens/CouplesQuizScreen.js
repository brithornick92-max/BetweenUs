/**
 * CouplesQuizScreen.js — "How Well Do You Know Them?"
 *
 * The "about your partner" mechanic:
 *  1. You see a question about your partner ("What would [name] order on a first date?")
 *  2. You write your guess — your answer is hidden until they answer about themselves
 *  3. Once both have answered, the reveal shows how close you were
 *
 * Uses the same bilateral hidden-until-both pattern as today's prompts so
 * the infrastructure (DataLayer, PartnerNotifications) is already there.
 *
 * Design: Deep plum / champagne gold — playful but intimate. Apple Editorial type.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  Alert,
  Keyboard,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import Icon from '../components/Icon';
import EditorialScreenScaffold from '../components/EditorialScreenScaffold';
import { impact, notification, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { DataLayer } from '../services/localfirst';
import { SPACING } from '../utils/theme';
import { getMyDisplayName, getPartnerDisplayName } from '../utils/profileNames';
import { storage } from '../utils/storage';
import { getDailyContentDateKey } from '../utils/dailyContentDate';

const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });

// Load quiz questions - 365 unique questions for daily rotation
const loadQuizQuestions = () => {
  try {
    const data = require('../content/quizQuestions.json');
    return data.questions || [];
  } catch {
    // Fallback questions if file doesn't exist
    return [
      { id: 'q001', text: 'What would {partner} order on a spontaneous date night out?', category: 'personality', icon: 'restaurant-outline' },
      { id: 'q002', text: 'What song is always stuck in {partner}\'s head?', category: 'personality', icon: 'musical-notes-outline' },
      { id: 'q003', text: 'If {partner} had a whole free Saturday, how would they spend it?', category: 'personality', icon: 'sunny-outline' },
    ];
  }
};

const QUIZ_QUESTIONS = loadQuizQuestions();



const TODAY_QUIZ_KEY = '@betweenus:cache:quizDateKey';
const TODAY_QUIZ_QUESTION_KEY = '@betweenus:cache:quizQuestionId';
const MY_QUIZ_ANSWER_KEY = '@betweenus:cache:quizMyAnswer';

export function getQuizPromptId(questionId) {
  return `quiz:${questionId}`;
}

export function getQuizCacheKeys(scopeKey = 'anonymous:solo') {
  const normalizedScope = String(scopeKey || 'anonymous:solo').replace(/[^a-zA-Z0-9_.:-]/g, '_');

  return {
    date: `@betweenus:cache:quiz:${normalizedScope}:dateKey`,
    question: `@betweenus:cache:quiz:${normalizedScope}:questionId`,
    answer: `@betweenus:cache:quiz:${normalizedScope}:myAnswer`,
  };
}

function isMatchingPromptAnswer(row, promptId, dk) {
  const rowPromptId = row?.prompt_id || row?.promptId || row?.value?.promptId || null;
  const rowDateKey = row?.date_key || row?.dateKey || row?.value?.dateKey || null;

  return rowPromptId === promptId && rowDateKey === dk;
}

function getTodayKey() {
  return getDailyContentDateKey();
}

function getDailyQuestion(dateKey) {
  // Deterministic question selection based on date so both partners see same question
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) & 0xffffffff;
  }
  return QUIZ_QUESTIONS[Math.abs(hash) % QUIZ_QUESTIONS.length];
}

function substitutePartnerName(text, partnerName) {
  return text.replace(/\{partner\}/g, partnerName || 'your partner');
}

// ─── Screen ────────────────────────────────────────────────────────────────

export default function CouplesQuizScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { state } = useAppContext();
  const { user, userProfile } = useAuth();

  // Theme map matching VibeSignalScreen exactly
  const t = useMemo(() => ({
    background:       colors.background,
    surface:          isDark ? '#1C1C1E' : '#FFFFFF',
    surfaceSecondary: isDark ? '#2C2C2E' : '#F2F2F7',
    primary:          colors.primary || '#D2121A',
    text:             colors.text,
    subtext:          isDark ? 'rgba(255,255,255,0.6)' : 'rgba(60,60,67,0.6)',
    border:           isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  const myName = getMyDisplayName(userProfile, state?.userProfile, null);
  const partnerName = getPartnerDisplayName(userProfile, state?.userProfile, null) || 'your partner';
  const quizCacheScope = useMemo(() => {
    const userKey = user?.id || user?.uid || state?.userId || user?.email || 'anonymous';
    const coupleKey = state?.coupleId || userProfile?.coupleId || 'solo';
    return `${userKey}:${coupleKey}`;
  }, [state?.coupleId, state?.userId, user?.email, user?.id, user?.uid, userProfile?.coupleId]);
  const quizCacheKeys = useMemo(() => getQuizCacheKeys(quizCacheScope), [quizCacheScope]);

  const todayKey = useMemo(() => getTodayKey(), []);
  const question = useMemo(() => getDailyQuestion(todayKey), [todayKey]);
  const quizPromptId = useMemo(() => getQuizPromptId(question.id), [question.id]);
  const questionText = substitutePartnerName(question.text, partnerName);
  // All category pills use primary red for consistency
  const accentColor = t.primary;

  const [myAnswer, setMyAnswer] = useState('');
  const [partnerAnswer, setPartnerAnswer] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [partnerHasSubmitted, setPartnerHasSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [answerId, setAnswerId] = useState(null);

  const revealScale = useSharedValue(0);
  const revealStyle = useAnimatedStyle(() => ({
    transform: [{ scale: revealScale.value }],
    opacity: interpolate(revealScale.value, [0, 1], [0, 1]),
  }));

  const inputRef = useRef(null);

  // ── Load today's state ─────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        let hasSyncedAnswer = false;

        // Check synced answers via the prompt-answer system.
        try {
          const [personalRows, sharedRows] = await Promise.all([
            DataLayer.getPromptAnswers?.({ dateKey: todayKey, promptId: quizPromptId }),
            DataLayer.getSharedPromptAnswers?.({ dateKey: todayKey, promptId: quizPromptId }),
          ]);

          const matchingSharedRows = (sharedRows || []).filter((row) =>
            isMatchingPromptAnswer(row, quizPromptId, todayKey)
          );
          const matchingPersonalRows = (personalRows || []).filter((row) =>
            isMatchingPromptAnswer(row, quizPromptId, todayKey)
          );
          const mine = matchingSharedRows[0] || matchingPersonalRows[0] || null;

          if (mine) {
            setAnswerId(mine.id || null);

            if (mine.answer) {
              setMyAnswer(mine.answer);
              setHasSubmitted(true);
              hasSyncedAnswer = true;
            }

            if (mine.partnerAnswer) {
              setPartnerAnswer(mine.partnerAnswer);
              setPartnerHasSubmitted(true);
            }
          }
        } catch {
          // Scoped local fallback below still keeps the screen usable offline.
        }

        if (!hasSyncedAnswer) {
          const savedKey = await storage.get(quizCacheKeys.date);
          const savedAnswer = await storage.get(quizCacheKeys.answer);
          const savedQId = await storage.get(quizCacheKeys.question);

          if (savedKey === todayKey && savedQId === question.id && savedAnswer) {
            setMyAnswer(savedAnswer);
            setHasSubmitted(true);
          }
        }
      } catch {
        // no-op
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [todayKey, question.id, quizPromptId, quizCacheKeys]);

  const handleSubmit = useCallback(async () => {
    const trimmed = myAnswer.trim();
    if (!trimmed) return;
    Keyboard.dismiss();
    setIsSaving(true);
    try {
      // Persist locally
      await storage.set(quizCacheKeys.date, todayKey);
      await storage.set(quizCacheKeys.question, question.id);
      await storage.set(quizCacheKeys.answer, trimmed);

      // Sync using the same bilateral prompt-answer path as today's prompt.
      try {
        const savedAnswer = await DataLayer.savePromptAnswer?.({
          promptId: quizPromptId,
          answer: trimmed,
          heatLevel: 1,
          dateKey: todayKey,
        });
        setAnswerId((current) => savedAnswer?.id || current);

        const sharedRows = await DataLayer.getSharedPromptAnswers?.({
          dateKey: todayKey,
          promptId: quizPromptId,
        });

        const matchingSharedRow = (sharedRows || []).find((row) =>
          isMatchingPromptAnswer(row, quizPromptId, todayKey)
        );

        if (matchingSharedRow?.partnerAnswer) {
          setPartnerAnswer(matchingSharedRow.partnerAnswer);
          setPartnerHasSubmitted(true);
        }

        // Notify partner
        import('../services/PartnerNotifications').then(({ default: PN }) =>
          PN.quizAnswered?.(myName)
        ).catch(() => {});
      } catch {
        // graceful — local save succeeded
      }

      notification(NotificationFeedbackType.Success).catch(() => {});
      setHasSubmitted(true);
    } catch {
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [myAnswer, todayKey, question.id, quizPromptId, myName, quizCacheKeys]);

  const clearLocalQuizAnswer = useCallback(async () => {
    await Promise.all([
      storage.remove(quizCacheKeys.date),
      storage.remove(quizCacheKeys.question),
      storage.remove(quizCacheKeys.answer),
      storage.remove(TODAY_QUIZ_KEY),
      storage.remove(TODAY_QUIZ_QUESTION_KEY),
      storage.remove(MY_QUIZ_ANSWER_KEY),
    ]);
  }, [quizCacheKeys]);

  const resetSubmittedAnswerState = useCallback(() => {
    setMyAnswer('');
    setAnswerId(null);
    setHasSubmitted(false);
    setPartnerAnswer('');
    setPartnerHasSubmitted(false);
    setIsRevealed(false);
    revealScale.value = 0;
  }, [revealScale]);

  const handleEditAnswer = useCallback(() => {
    impact(ImpactFeedbackStyle.Light);
    setHasSubmitted(false);
    setPartnerAnswer('');
    setPartnerHasSubmitted(false);
    setIsRevealed(false);
    revealScale.value = 0;
    setTimeout(() => inputRef.current?.focus?.(), 80);
  }, [revealScale]);

  const handleDeleteAnswer = useCallback(() => {
    Alert.alert(
      'Delete quiz answer?',
      'This removes your answer for today. You can answer again afterward.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsSaving(true);
            try {
              if (answerId && typeof DataLayer.deletePromptAnswer === 'function') {
                await DataLayer.deletePromptAnswer(answerId);
              }

              await clearLocalQuizAnswer();
              resetSubmittedAnswerState();
              notification(NotificationFeedbackType.Success).catch(() => {});
            } catch {
              Alert.alert('Could not delete', 'Please try again.');
            } finally {
              setIsSaving(false);
            }
          },
        },
      ]
    );
  }, [answerId, clearLocalQuizAnswer, resetSubmittedAnswerState]);

  const handleReveal = useCallback(() => {
    if (!partnerHasSubmitted) {
      Alert.alert(
        `Waiting for ${partnerName}`,
        `${partnerName} hasn't answered yet. Answers reveal when you've both weighed in — that's what makes it fun.`,
        [{ text: 'Got it' }]
      );
      return;
    }
    impact(ImpactFeedbackStyle.Heavy);
    setIsRevealed(true);
    revealScale.value = withSpring(1, { damping: 14, stiffness: 120 });
  }, [partnerHasSubmitted, partnerName, revealScale]);

  // ── Render phases ──────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    impact(ImpactFeedbackStyle.Light);
    navigation.goBack();
  }, [navigation]);

  if (isLoading) {
    return (
      <EditorialScreenScaffold
        navigation={navigation}
        headerTitle="Daily Quiz"
        headerSubtitle="KNOW YOUR PARTNER?"
        scroll={false}
        onBack={handleBack}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="help-circle-outline" size={32} color={colors.textMuted} />
        </View>
      </EditorialScreenScaffold>
    );
  }

  return (
    <EditorialScreenScaffold
      navigation={navigation}
      headerTitle="Daily Quiz"
      headerSubtitle="KNOW YOUR PARTNER?"
      scroll={false}
      onBack={handleBack}
      keyboardAvoiding
    >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
            {/* Category badge */}
            <Animated.View entering={FadeIn.duration(800).delay(400)} style={styles.badgeRow}>
              <View style={styles.categoryBadge}>
                <Icon name={question.icon || 'sparkles-outline'} size={12} color={accentColor} />
                <Text style={[styles.categoryLabel, { color: accentColor }]}>
                  {(question.category || 'about them').toUpperCase()}
                </Text>
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(800).delay(600)} style={[styles.mainContainer, { backgroundColor: t.surface, borderColor: t.border }]}>
              
              {/* Question text */}
              <View style={styles.questionCard}>
                <Text style={[styles.questionText, { color: t.text }]}>{questionText}</Text>
              </View>

              {/* ── Phase A: Input (not yet submitted) ── */}
              {!hasSubmitted && (
                <View style={styles.inputSection}>
                  <Text style={[styles.inputLabel, { color: t.subtext }]}>YOUR GUESS ABOUT {partnerName.toUpperCase()}</Text>
                  <View style={[styles.inputCard, { borderColor: t.border }]}>
                    <TextInput
                      ref={inputRef}
                      style={[styles.textInput, { color: t.text }]}
                      placeholder={`What do you think ${partnerName} would say…`}
                      placeholderTextColor={t.subtext}
                      value={myAnswer}
                      onChangeText={setMyAnswer}
                      multiline
                      maxLength={400}
                      selectionColor={accentColor}
                      autoFocus={false}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={!myAnswer.trim() || isSaving}
                    activeOpacity={0.85}
                    style={[styles.submitBtn, { opacity: myAnswer.trim() ? 1 : 0.4, backgroundColor: t.text }]}
                  >
                    <Text style={[styles.submitBtnText, { color: isDark ? '#000000' : '#FFFFFF' }]}>
                      {isSaving ? 'Locking in…' : 'Lock In My Answer'}
                    </Text>
                    {myAnswer.trim() && <Icon name="lock-closed-outline" size={16} color={isDark ? '#000000' : '#FFFFFF'} />}
                  </TouchableOpacity>
                  <Text style={[styles.helperText, { color: t.subtext }]}>
                    {partnerName}'s answer is hidden until you both submit
                  </Text>
                </View>
              )}

              {/* ── Phase B: Waiting / Reveal ── */}
              {hasSubmitted && (
                <View style={styles.waitSection}>

                  {/* Your locked answer */}
                  <View style={styles.lockedCard}>
                    <View style={styles.lockedCardHeader}>
                      <Icon name="lock-closed" size={14} color={t.primary} />
                      <Text style={styles.lockedCardLabel}>YOUR GUESS</Text>
                    </View>
                    <Text style={styles.lockedAnswer}>{myAnswer}</Text>
                    <View style={styles.answerActionRow}>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Edit daily quiz answer"
                        onPress={handleEditAnswer}
                        disabled={isSaving}
                        activeOpacity={0.8}
                        style={[styles.answerActionButton, { borderColor: t.border }]}
                      >
                        <Icon name="create-outline" size={15} color={t.primary} />
                        <Text style={[styles.answerActionText, { color: t.primary }]}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Delete daily quiz answer"
                        onPress={handleDeleteAnswer}
                        disabled={isSaving}
                        activeOpacity={0.8}
                        style={[styles.answerActionButton, { borderColor: t.border }]}
                      >
                        <Icon name="trash-outline" size={15} color={t.primary} />
                        <Text style={[styles.answerActionText, { color: t.primary }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Partner status */}
                  <View style={[styles.partnerStatusCard, { borderColor: partnerHasSubmitted ? accentColor + '55' : t.border }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={[styles.statusDot, { backgroundColor: partnerHasSubmitted ? '#34C759' : '#FF9F0A' }]} />
                      <Text style={styles.partnerStatusText}>
                        {partnerHasSubmitted
                          ? `${partnerName} answered`
                          : `Waiting for ${partnerName}…`}
                      </Text>
                      {partnerHasSubmitted && <Icon name="checkmark-circle" size={18} color="#34C759" />}
                    </View>
                    {!partnerHasSubmitted && (
                      <Text style={styles.partnerStatusHint}>
                        Their answer is locked — the reveal happens when you're both in.
                      </Text>
                    )}
                  </View>

                  {/* Reveal button */}
                  <TouchableOpacity
                    onPress={handleReveal}
                    activeOpacity={0.85}
                    style={[
                      styles.revealBtn,
                      {
                        marginTop: SPACING.md,
                        backgroundColor: partnerHasSubmitted ? t.primary : t.surface,
                        borderWidth: partnerHasSubmitted ? 0 : 1,
                        borderColor: t.border,
                      },
                    ]}
                  >
                    <Icon
                      name={partnerHasSubmitted ? 'eye-outline' : 'time-outline'}
                      size={18}
                      color={partnerHasSubmitted ? '#FFF' : t.subtext}
                    />
                    <Text style={[styles.revealBtnText, !partnerHasSubmitted && { color: t.subtext }]}>
                      {partnerHasSubmitted ? 'Reveal Both Answers' : `Waiting for ${partnerName}…`}
                    </Text>
                  </TouchableOpacity>

                  {/* ── Reveal panel ── */}
                  {isRevealed && (
                    <Animated.View style={[styles.revealPanel, revealStyle]}>
                      <View style={styles.revealPanelInner}>
                        <Text style={styles.revealPanelTitle}>The Big Reveal</Text>

                        <View style={styles.revealRow}>
                          <View style={[styles.revealCard, { borderColor: accentColor + '44' }]}>
                            <Text style={styles.revealCardOwner}>You guessed</Text>
                            <Text style={styles.revealCardAnswer}>{myAnswer}</Text>
                          </View>
                          <View style={[styles.revealCard, { borderColor: t.primary + '44' }]}>
                            <Text style={[styles.revealCardOwner, { color: t.primary }]}>{partnerName} said</Text>
                            <Text style={styles.revealCardAnswer}>{partnerAnswer || '…'}</Text>
                          </View>
                        </View>

                        <Text style={styles.revealCta}>
                          How close were you? Talk about it today.
                        </Text>
                      </View>
                    </Animated.View>
                  )}

                </View>
              )}
            </Animated.View>

            <View style={{ height: 60 }} />
          </ScrollView>
    </EditorialScreenScaffold>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const createStyles = (t, isDark) => StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 120 },

  // ── Category Badge ──
  badgeRow: {
    paddingHorizontal: SPACING.md, // Align with mainContainer margin
    marginBottom: SPACING.md,      // Tighter margin
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
    paddingVertical: 8,
    borderRadius: 100,
    gap: 6,
  },
  categoryLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  // ── Main Container ──
  mainContainer: {
    marginHorizontal: SPACING.md,
    borderRadius: 32,
    borderWidth: 1,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl, // Reduced bottom padding since inner elements have padding
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: isDark ? 0.4 : 0.15, shadowRadius: 20 },
      android: { elevation: 6 },
    }),
  },

  // ── Question Card ──
  questionCard: {
    marginHorizontal: SPACING.lg,
    paddingHorizontal: 0,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.lg,
  },
  questionText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 26,  // Increased from 22 for more impact
    fontWeight: '800', // Made bolder
    lineHeight: 34,
    letterSpacing: -0.6,
  },
  questionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  questionHint: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '500',
    color: t.subtext,
    flexShrink: 1,
    lineHeight: 16,
  },

  // ── Input Phase ──
  inputSection: {
    paddingHorizontal: SPACING.lg, // Reduced from xl to lg to give more space
  },
  inputLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  inputCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surfaceSecondary,
    minHeight: 120,
    overflow: 'hidden',
    marginBottom: SPACING.xl,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.15 : 0.04, shadowRadius: 12 },
      android: { elevation: 2 },
    }),
  },
  textInput: {
    fontFamily: SYSTEM_FONT,
    fontSize: 17,
    padding: 20,
    lineHeight: 24,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitBtn: {
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitBtnText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  helperText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 18,
  },

  // ── Submitted / Wait Phase ──
  waitSection: { 
    paddingHorizontal: SPACING.lg, // Reduced from xl to lg
    gap: SPACING.md,
  },

  lockedCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surfaceSecondary,
    padding: SPACING.xl,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.15 : 0.04, shadowRadius: 12 },
      android: { elevation: 2 },
    }),
  },
  lockedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  lockedCardLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: t.primary,
  },
  lockedAnswer: {
    fontFamily: SYSTEM_FONT,
    fontSize: 17,
    fontWeight: '400',
    color: t.text,
    lineHeight: 26,
  },
  answerActionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  answerActionButton: {
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  answerActionText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  partnerStatusCard: {
    borderRadius: 24,
    borderWidth: 1,
    backgroundColor: t.surfaceSecondary,
    padding: SPACING.xl,
    gap: SPACING.sm,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.15 : 0.04, shadowRadius: 12 },
      android: { elevation: 2 },
    }),
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  partnerStatusText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '700',
    color: t.text,
  },
  partnerStatusHint: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    color: t.subtext,
    lineHeight: 18,
  },

  revealBtn: {
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  revealBtnText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.3,
  },

  // ── Reveal Panel ──
  revealPanel: {
    marginTop: SPACING.lg,
  },
  revealPanelInner: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surfaceSecondary,
    padding: SPACING.xl,
    gap: SPACING.md,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.15 : 0.04, shadowRadius: 12 },
      android: { elevation: 2 },
    }),
  },
  revealPanelTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: t.text,
    textAlign: 'center',
  },
  revealRow: {
    flexDirection: 'row',
    gap: 12,
  },
  revealCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: t.surface,
    padding: SPACING.md,
    gap: 8,
  },
  revealCardOwner: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: t.primary,
  },
  revealCardAnswer: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: '400',
    color: t.text,
    lineHeight: 22,
  },
  revealCta: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '500',
    color: t.subtext,
    textAlign: 'center',
    lineHeight: 20,
  },
});
