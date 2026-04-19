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
  KeyboardAvoidingView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInRight,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import Icon from '../components/Icon';
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import DataLayer from '../services/data/DataLayer';
import { SPACING } from '../utils/theme';
import { getMyDisplayName, getPartnerDisplayName } from '../utils/profileNames';
import { storage, STORAGE_KEYS } from '../utils/storage';

const { width: SCREEN_W } = Dimensions.get('window');
const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });
const SERIF_FONT = Platform.select({
  ios: 'DMSerifDisplay-Regular',
  android: 'DMSerifDisplay_400Regular',
  default: 'serif',
});

// ─── Quiz question bank ────────────────────────────────────────────────────
// Questions are phrased in 2nd person about the responder's partner.
// They're answered FROM the responder's perspective ("I think my partner would…")
// so that when both reveal, the comparison is: "what they guessed" vs "what you actually said".
const QUIZ_QUESTIONS = [
  // Personality & habits
  { id: 'q001', text: 'What would {partner} order on a spontaneous date night out?', category: 'personality', emoji: '🍽️' },
  { id: 'q002', text: 'What song is always stuck in {partner}\'s head?', category: 'personality', emoji: '🎵' },
  { id: 'q003', text: 'If {partner} had a whole free Saturday, how would they spend it?', category: 'personality', emoji: '☀️' },
  { id: 'q004', text: 'What comfort food does {partner} reach for after a rough day?', category: 'personality', emoji: '🍜' },
  { id: 'q005', text: 'What\'s {partner}\'s go-to move when they\'re trying to cheer you up?', category: 'love', emoji: '💛' },
  // Love & connection
  { id: 'q006', text: 'What moment do you think {partner} considers your relationship\'s turning point?', category: 'love', emoji: '💫' },
  { id: 'q007', text: 'What do you think {partner} finds most attractive about you?', category: 'love', emoji: '💕' },
  { id: 'q008', text: 'What small thing do you do that {partner} secretly loves?', category: 'love', emoji: '🤫' },
  { id: 'q009', text: 'If {partner} could relive one moment from your relationship, which would it be?', category: 'love', emoji: '⏪' },
  { id: 'q010', text: 'What does {partner} find most annoying… but also kind of charming about you?', category: 'love', emoji: '😏' },
  // Dreams & future
  { id: 'q011', text: 'What\'s one dream {partner} hasn\'t told many people about?', category: 'future', emoji: '🌙' },
  { id: 'q012', text: 'Where would {partner} move if they could live anywhere in the world?', category: 'future', emoji: '🌍' },
  { id: 'q013', text: 'What kind of home does {partner} picture for your future together?', category: 'future', emoji: '🏡' },
  { id: 'q014', text: 'If {partner} could master one skill overnight, what would it be?', category: 'future', emoji: '✨' },
  // Playful / fun
  { id: 'q015', text: 'What would {partner}\'s superpower be, based on their personality?', category: 'playful', emoji: '🦸' },
  { id: 'q016', text: 'What movie character is {partner} most like without realizing it?', category: 'playful', emoji: '🎬' },
  { id: 'q017', text: 'If {partner}\'s life was a playlist, what\'s the opening track?', category: 'playful', emoji: '🎧' },
  { id: 'q018', text: 'What would {partner}\'s ideal lazy Sunday morning look like in detail?', category: 'playful', emoji: '☕' },
  // Deep
  { id: 'q019', text: 'What does {partner} need most when they\'re overwhelmed but won\'t ask for?', category: 'deep', emoji: '🫂' },
  { id: 'q020', text: 'What\'s one fear {partner} has that most people wouldn\'t guess?', category: 'deep', emoji: '🌑' },
  { id: 'q021', text: 'What does {partner} consider their biggest personal win from the past year?', category: 'deep', emoji: '🏆' },
  { id: 'q022', text: 'What\'s something {partner} is still figuring out about themselves?', category: 'deep', emoji: '🔍' },
  { id: 'q023', text: 'What moment in your relationship do you think made {partner} feel truly seen?', category: 'deep', emoji: '💎' },
];

const CATEGORY_COLORS = {
  personality: '#D4AA7E',
  love: '#D2121A',
  future: '#7B68EE',
  playful: '#3BAFA5',
  deep: '#7E4FA3',
};

const TODAY_QUIZ_KEY = '@betweenus:quizDateKey';
const TODAY_QUIZ_QUESTION_KEY = '@betweenus:quizQuestionId';
const MY_QUIZ_ANSWER_KEY = '@betweenus:quizMyAnswer';

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  const { userProfile } = useAuth();

  const t = useMemo(() => ({
    background: isDark ? '#0A0612' : '#0A0612',
    surface: 'rgba(255,255,255,0.04)',
    surfaceSecondary: 'rgba(255,255,255,0.08)',
    text: '#FFFFFF',
    subtext: 'rgba(255,255,255,0.55)',
    border: 'rgba(255,255,255,0.08)',
    primary: '#D4AA7E',    // champagne gold
    accent: '#7E4FA3',     // velvet plum
    red: '#D2121A',
  }), [isDark]);

  const styles = useMemo(() => createStyles(t), [t]);

  const myName = getMyDisplayName(userProfile, state?.userProfile, null);
  const partnerName = getPartnerDisplayName(state?.userProfile, userProfile, null) || 'your partner';

  const todayKey = useMemo(() => getTodayKey(), []);
  const question = useMemo(() => getDailyQuestion(todayKey), [todayKey]);
  const questionText = substitutePartnerName(question.text, partnerName);
  const accentColor = CATEGORY_COLORS[question.category] || t.primary;

  const [myAnswer, setMyAnswer] = useState('');
  const [partnerAnswer, setPartnerAnswer] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [partnerHasSubmitted, setPartnerHasSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);

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
        // Check if I already submitted today
        const savedKey = await storage.getString(TODAY_QUIZ_KEY);
        const savedAnswer = await storage.getString(MY_QUIZ_ANSWER_KEY);
        const savedQId = await storage.getString(TODAY_QUIZ_QUESTION_KEY);

        if (savedKey === todayKey && savedQId === question.id && savedAnswer) {
          setMyAnswer(savedAnswer);
          setHasSubmitted(true);
        }

        // Check if partner answered via DataLayer
        try {
          const rows = await DataLayer.getPromptAnswers?.({ type: 'quiz', dateKey: todayKey, questionId: question.id });
          if (rows?.length) {
            const mine = rows.find(r => r.is_mine);
            const theirs = rows.find(r => !r.is_mine);
            if (mine) {
              setMyAnswer(mine.answer || '');
              setHasSubmitted(true);
            }
            if (theirs?.answer) {
              setPartnerAnswer(theirs.answer);
              setPartnerHasSubmitted(true);
            }
          }
        } catch {
          // DataLayer may not have quiz support yet — graceful fallback
        }
      } catch {
        // no-op
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [todayKey, question.id]);

  const handleSubmit = useCallback(async () => {
    const trimmed = myAnswer.trim();
    if (!trimmed) return;
    Keyboard.dismiss();
    setIsSaving(true);
    try {
      // Persist locally
      await storage.setString(TODAY_QUIZ_KEY, todayKey);
      await storage.setString(TODAY_QUIZ_QUESTION_KEY, question.id);
      await storage.setString(MY_QUIZ_ANSWER_KEY, trimmed);

      // Try to sync (graceful — not critical path)
      try {
        await DataLayer.saveQuizAnswer?.({
          type: 'quiz',
          dateKey: todayKey,
          questionId: question.id,
          questionText: question.text,
          answer: trimmed,
        });
        // Notify partner
        import('../services/PartnerNotifications').then(({ default: PN }) =>
          PN.quizAnswered?.(myName)
        ).catch(() => {});
      } catch {
        // graceful — local save succeeded
      }

      notification(NotificationFeedbackType.Success).catch(() => {});
      setHasSubmitted(true);
    } catch (err) {
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [myAnswer, todayKey, question.id, question.text, myName]);

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

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.background, justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar barStyle="light-content" />
        <Icon name="help-circle-outline" size={32} color={t.subtext} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#0D0618', '#0A0612', '#120820']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Glow blob */}
      <View
        style={{
          position: 'absolute',
          top: -80,
          left: SCREEN_W / 2 - 140,
          width: 280,
          height: 280,
          borderRadius: 140,
          backgroundColor: accentColor,
          opacity: 0.08,
        }}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <BlurView intensity={40} tint="dark" style={styles.circleBtn}>
                <Icon name="chevron-back" size={22} color={t.text} />
              </BlurView>
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.headerEyebrow}>DAILY QUIZ</Text>
              <Text style={styles.headerTitle}>How well do you know them?</Text>
            </View>

            <View style={{ width: 44 }} />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

            {/* Category badge */}
            <Animated.View entering={FadeIn.delay(100)} style={styles.badgeRow}>
              <View style={[styles.categoryBadge, { borderColor: accentColor + '44', backgroundColor: accentColor + '18' }]}>
                <Text style={styles.categoryEmoji}>{question.emoji}</Text>
                <Text style={[styles.categoryLabel, { color: accentColor }]}>
                  {question.category.toUpperCase()}
                </Text>
              </View>
            </Animated.View>

            {/* Question card */}
            <Animated.View entering={FadeInDown.springify().damping(18).delay(150)} style={styles.questionCard}>
              <LinearGradient
                colors={[accentColor + '22', accentColor + '08', 'transparent']}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Text style={styles.questionText}>{questionText}</Text>
              <View style={styles.questionFooter}>
                <Icon name="people-outline" size={14} color={t.subtext} />
                <Text style={styles.questionHint}>
                  Both answer — then reveal and see how close you were
                </Text>
              </View>
            </Animated.View>

            {/* ── Phase A: Input (not yet submitted) ── */}
            {!hasSubmitted && (
              <Animated.View entering={FadeInUp.springify().damping(18).delay(250)} style={styles.inputSection}>
                <Text style={styles.inputLabel}>Your guess about {partnerName}</Text>
                <BlurView intensity={30} tint="dark" style={styles.inputCard}>
                  <TextInput
                    ref={inputRef}
                    style={styles.textInput}
                    placeholder={`What do you think ${partnerName} would say…`}
                    placeholderTextColor={t.subtext}
                    value={myAnswer}
                    onChangeText={setMyAnswer}
                    multiline
                    maxLength={400}
                    selectionColor={accentColor}
                    autoFocus={false}
                  />
                </BlurView>
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={!myAnswer.trim() || isSaving}
                  activeOpacity={0.85}
                  style={{ marginTop: SPACING.md }}
                >
                  <LinearGradient
                    colors={myAnswer.trim() ? [accentColor, accentColor + 'CC'] : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']}
                    style={styles.submitBtn}
                  >
                    <Text style={[styles.submitBtnText, !myAnswer.trim() && { color: t.subtext }]}>
                      {isSaving ? 'Locking in…' : 'Lock In My Answer'}
                    </Text>
                    {myAnswer.trim() && <Icon name="lock-closed-outline" size={16} color="#FFF" style={{ marginLeft: 8 }} />}
                  </LinearGradient>
                </TouchableOpacity>
                <Text style={styles.helperText}>
                  {partnerName}'s answer is hidden until you both submit
                </Text>
              </Animated.View>
            )}

            {/* ── Phase B: Waiting / Reveal ── */}
            {hasSubmitted && (
              <Animated.View entering={FadeInUp.springify().damping(18)} style={styles.waitSection}>

                {/* Your locked answer */}
                <View style={styles.lockedCard}>
                  <View style={styles.lockedCardHeader}>
                    <Icon name="lock-closed" size={14} color={t.primary} />
                    <Text style={styles.lockedCardLabel}>YOUR GUESS</Text>
                  </View>
                  <Text style={styles.lockedAnswer}>{myAnswer}</Text>
                </View>

                {/* Partner status */}
                <View style={[styles.partnerStatusCard, { borderColor: partnerHasSubmitted ? accentColor + '55' : t.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={[styles.statusDot, { backgroundColor: partnerHasSubmitted ? '#34C759' : '#FF9F0A' }]} />
                    <Text style={styles.partnerStatusText}>
                      {partnerHasSubmitted
                        ? `${partnerName} answered ✓`
                        : `Waiting for ${partnerName} to answer…`}
                    </Text>
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
                  style={{ marginTop: SPACING.md }}
                >
                  <LinearGradient
                    colors={partnerHasSubmitted
                      ? ['#D2121A', '#8A0B11']
                      : ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.03)']}
                    style={styles.revealBtn}
                  >
                    <Icon
                      name={partnerHasSubmitted ? 'eye-outline' : 'time-outline'}
                      size={18}
                      color={partnerHasSubmitted ? '#FFF' : t.subtext}
                    />
                    <Text style={[styles.revealBtnText, !partnerHasSubmitted && { color: t.subtext }]}>
                      {partnerHasSubmitted ? 'Reveal Both Answers' : `Waiting for ${partnerName}…`}
                    </Text>
                  </LinearGradient>
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
                        <View style={[styles.revealCard, { borderColor: t.red + '44' }]}>
                          <Text style={[styles.revealCardOwner, { color: t.red }]}>{partnerName} said</Text>
                          <Text style={styles.revealCardAnswer}>{partnerAnswer || '…'}</Text>
                        </View>
                      </View>

                      <Text style={styles.revealCta}>
                        How close were you? Talk about it tonight.
                      </Text>
                    </View>
                  </Animated.View>
                )}

              </Animated.View>
            )}

            <View style={{ height: 60 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const createStyles = (t) => StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0612' },
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.border,
    overflow: 'hidden',
  },
  headerCenter: { alignItems: 'center' },
  headerEyebrow: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.5,
    color: t.subtext,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: SERIF_FONT,
    fontSize: 16,
    color: t.text,
    marginTop: 2,
  },

  badgeRow: {
    alignItems: 'flex-start',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  categoryEmoji: { fontSize: 14 },
  categoryLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  questionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 28,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 20 },
      android: { elevation: 8 },
    }),
  },
  questionText: {
    fontFamily: SERIF_FONT,
    fontSize: 24,
    color: t.text,
    lineHeight: 36,
    marginBottom: 20,
  },
  questionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  questionHint: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    color: t.subtext,
    flexShrink: 1,
  },

  inputSection: { marginBottom: SPACING.md },
  inputLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: t.subtext,
    marginBottom: SPACING.sm,
  },
  inputCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    minHeight: 100,
  },
  textInput: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    color: t.text,
    padding: 16,
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
    color: '#FFF',
    letterSpacing: 0.3,
  },
  helperText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    color: t.subtext,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 18,
  },

  waitSection: { gap: SPACING.md },

  lockedCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 20,
  },
  lockedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  lockedCardLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: t.primary,
  },
  lockedAnswer: {
    fontFamily: SERIF_FONT,
    fontSize: 17,
    color: t.text,
    lineHeight: 26,
  },

  partnerStatusCard: {
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 16,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  partnerStatusText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '600',
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

  revealPanel: {
    marginTop: SPACING.lg,
  },
  revealPanelInner: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 24,
    gap: SPACING.md,
    overflow: 'hidden',
  },
  revealPanelTitle: {
    fontFamily: SERIF_FONT,
    fontSize: 22,
    color: t.text,
    textAlign: 'center',
  },
  revealRow: {
    flexDirection: 'row',
    gap: 12,
  },
  revealCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 14,
    gap: 8,
  },
  revealCardOwner: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: t.primary,
    textTransform: 'uppercase',
  },
  revealCardAnswer: {
    fontFamily: SERIF_FONT,
    fontSize: 15,
    color: t.text,
    lineHeight: 22,
  },
  revealCta: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    color: t.subtext,
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
  },
});
