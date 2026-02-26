// components/EditorialPrompt.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAppContext } from '../context/AppContext';
import { useMemoryContext } from '../context/MemoryContext';
import { useTheme } from '../context/ThemeContext';
import { storage, STORAGE_KEYS, promptStorage } from '../utils/storage';
import { supabase, TABLES } from '../config/supabase';
import { TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from '../utils/theme';
import PreferenceEngine from '../services/PreferenceEngine';
import { Platform } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Prompt sync adapter — bridges local storage + Supabase couple_data for partner sharing.
const promptSyncService = {
  _listeners: new Set(),

  addListener(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  },

  _emit(event, data) {
    this._listeners.forEach(cb => {
      try { cb(event, data); } catch { /* ignore */ }
    });
  },

  // Partner real-time sync — subscribe to couple_data changes for prompt answers
  subscribeToPartner(coupleId, userId, promptId) {
    if (!supabase || !coupleId) return () => {};

    const channel = supabase
      .channel(`prompt_sync_${coupleId}_${promptId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: TABLES.COUPLE_DATA,
          filter: `couple_id=eq.${coupleId}`,
        },
        (payload) => {
          const row = payload.new;
          if (row?.data_type !== 'prompt_answer' || row?.created_by === userId) return;
          try {
            const meta = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
            if (meta?.promptId === promptId) {
              this._emit('partner_answer_received', {
                promptId,
                partnerAnswer: meta.answer,
                canReveal: true,
              });
            }
          } catch { /* ignore parse errors */ }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  },

  // Load a prompt's saved answer (when navigated to by ID)
  getPromptWithPrivacy: async (promptId) => {
    if (!promptId) return null;
    try {
      const today = new Date().toISOString().split('T')[0];
      const saved = await promptStorage.getAnswer(today, promptId);
      return saved ? { id: promptId, userAnswer: saved.content || saved.answer, ...saved } : null;
    } catch {
      return null;
    }
  },

  // Persist the user's answer to encrypted local storage + sync to Supabase
  submitAnswer: async (promptId, answer, userId, coupleId) => {
    const today = new Date().toISOString().split('T')[0];
    await promptStorage.setAnswer(today, promptId, { answer, userId });

    // Sync to Supabase couple_data so partner can see it
    if (supabase && coupleId && userId) {
      try {
        await supabase
          .from(TABLES.COUPLE_DATA)
          .upsert({
            couple_id: coupleId,
            key: `prompt_answer_${today}_${promptId}_${userId}`,
            data_type: 'prompt_answer',
            value: JSON.stringify({ promptId, answer, date: today }),
            created_by: userId,
            is_private: false,
          }, { onConflict: 'couple_id,key' });
      } catch (err) {
        if (__DEV__) console.warn('[PromptSync] Supabase sync failed:', err.message);
        // Local save succeeded — partner sync will catch up later
      }
    }

    return { success: true };
  },

  // Fetch partner's answer from Supabase couple_data
  fetchPartnerAnswer: async (promptId, coupleId, userId) => {
    if (!supabase || !coupleId) return null;
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from(TABLES.COUPLE_DATA)
        .select('value, created_by')
        .eq('couple_id', coupleId)
        .eq('data_type', 'prompt_answer')
        .like('key', `prompt_answer_${today}_${promptId}_%`)
        .neq('created_by', userId)
        .maybeSingle();

      if (!error && data) {
        const meta = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        return meta?.answer || null;
      }
    } catch { /* offline — no partner data */ }
    return null;
  },

  // Partner reveal — mark as revealed (no server action needed, it's a local UI state)
  revealPartnerAnswer: async () => ({ success: true }),
};

// Editorial prompt categories and themes
const PROMPT_CATEGORIES = {
  REFLECTION: {
    id: 'reflection',
    name: 'Daily Reflection',
    icon: '💭',
  },
  GRATITUDE: {
    id: 'gratitude',
    name: 'Gratitude',
    icon: '🙏',
  },
  DREAMS: {
    id: 'dreams',
    name: 'Dreams & Future',
    icon: '✨',
  },
  INTIMACY: {
    id: 'intimacy',
    name: 'Intimacy',
    icon: '💕',
  },
  PLAYFUL: {
    id: 'playful',
    name: 'Playful',
    icon: '😄',
  },
  DAILY_LIFE: {
    id: 'daily_life',
    name: 'Daily Life',
    icon: '☀️',
  },
};

// Sample editorial prompts
const EDITORIAL_PROMPTS = {
  [PROMPT_CATEGORIES.REFLECTION.id]: [
    "What moment today made you feel most connected to yourself?",
    "If you could relive one conversation from this week, which would it be and why?",
    "What's something you've learned about love recently?",
    "How has your perspective on relationships evolved this year?",
    "What would you tell your younger self about love?",
  ],
  [PROMPT_CATEGORIES.GRATITUDE.id]: [
    "What's one small thing your partner did recently that made you smile?",
    "Which quality in your partner are you most grateful for today?",
    "What's a memory with your partner that still gives you butterflies?",
    "How has your partner helped you grow as a person?",
    "What's something about your relationship that you never want to take for granted?",
  ],
  [PROMPT_CATEGORIES.DREAMS.id]: [
    "What's one adventure you'd love to experience together?",
    "How do you envision your relationship in five years?",
    "What's a dream you have that you haven't shared yet?",
    "What tradition would you like to start together?",
    "What's one way you'd love to delight your partner this year?",
  ],
  [PROMPT_CATEGORIES.INTIMACY.id]: [
    "What makes you feel most loved by your partner?",
    "When do you feel most beautiful/handsome in your relationship?",
    "What's your favorite way to show affection?",
    "What's something vulnerable you'd like to share?",
    "How do you like to be comforted when you're upset?",
  ],
  [PROMPT_CATEGORIES.PLAYFUL.id]: [
    "What's the silliest thing you and your partner do together?",
    "If you could have any superpower as a couple, what would it be?",
    "What's your partner's most endearing quirk?",
    "What would be the perfect lazy Sunday together?",
    "What inside joke do you two have that no one else understands?",
  ],
  [PROMPT_CATEGORIES.DAILY_LIFE.id]: [
    "What was the highlight of your day today?",
    "Tell me about a moment today when you thought of me.",
    "What's something that happened today that you want to share with me?",
    "How are you feeling right now, and what's on your mind?",
    "What made you smile today?",
    "What was challenging about your day, and how did you handle it?",
    "What's something you learned or discovered today?",
    "Who did you interact with today that made an impact on you?",
    "What are you looking forward to tomorrow?",
    "What's one thing from today that you're grateful for?",
    "How did you take care of yourself today?",
    "What's something you accomplished today, big or small?",
    "What was different about today compared to yesterday?",
    "What's on your mind as the day comes to an end?",
    "How did you feel most like yourself today?",
  ],
};

const EditorialPrompt = ({
  style,
  promptId = null,
  category = PROMPT_CATEGORIES.DAILY_LIFE.id,
  onAnswerSubmit,
  onPartnerAnswerRevealed,
  compact = false,
}) => {
  const { colors, isDark, gradients } = useTheme();
  const { state: appState } = useAppContext();
  const { state: memoryState } = useMemoryContext();

  const styles = useMemo(() => createStyles(colors), [colors]);

  const [currentPrompt, setCurrentPrompt] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [partnerAnswer, setPartnerAnswer] = useState('');
  const [isPartnerAnswerRevealed, setIsPartnerAnswerRevealed] = useState(false);
  const [hasUserSubmitted, setHasUserSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derived category data with dynamic colors
  const promptCategory = useMemo(() => {
    const catId = currentPrompt?.category || category;
    const cat = Object.values(PROMPT_CATEGORIES).find(c => c.id === catId) || PROMPT_CATEGORIES.REFLECTION;
    
    // Map categories to dynamic gradients
    let catGradient = gradients.primary;
    if (catId === 'gratitude' || catId === 'daily_life') {
      catGradient = gradients.gold || gradients.primary;
    } else if (catId === 'playful') {
      catGradient = gradients.champagne || gradients.primary;
    } else if (catId === 'intimacy') {
      catGradient = [colors.primaryMuted, colors.danger];
    }
    
    return { ...cat, gradient: catGradient };
  }, [currentPrompt?.category, category, colors, gradients]);

  // Animation values
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const blurAnimation = useRef(new Animated.Value(20)).current;
  const revealAnimation = useRef(new Animated.Value(0)).current;
  const submitAnimation = useRef(new Animated.Value(1)).current;

  // ---------------------------------------------------------------------------
  // 1) Load or generate prompt (IMPORTANT: do NOT depend on currentPrompt?.id)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    const loadPrompt = async () => {
      try {
        let prompt;

        if (promptId) {
          prompt = await promptSyncService.getPromptWithPrivacy(promptId);
        }

        if (!prompt) {
          // Respect boundaries — remap intimacy when hideSpicy is on
          let effectiveCategory = category;
          try {
            const profile = await PreferenceEngine.getContentProfile();
            if (profile?.hideSpicy && category === 'intimacy') {
              effectiveCategory = 'reflection';
            }
          } catch (e) { /* fallback to default category */ }
          prompt = await generateDailyPrompt(effectiveCategory);
        }

        if (!isMounted) return;

        setCurrentPrompt(prompt);

        // Load existing answers
        if (prompt.userAnswer) {
          setUserAnswer(prompt.userAnswer);
          setHasUserSubmitted(true);
        } else {
          setUserAnswer('');
          setHasUserSubmitted(false);
        }

        if (prompt.partnerAnswer && prompt.partnerAnswer !== '[HIDDEN]') {
          setPartnerAnswer(prompt.partnerAnswer);
          setIsPartnerAnswerRevealed(!!prompt.isRevealed);
        } else if (prompt.hasPartnerAnswer) {
          setPartnerAnswer('Partner has shared their reflection...');
          setIsPartnerAnswerRevealed(false);
        } else {
          setPartnerAnswer('');
          setIsPartnerAnswerRevealed(false);
        }

        // Animate in
        fadeAnimation.setValue(0);
        Animated.timing(fadeAnimation, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }).start();
      } catch (error) {
        console.error('Failed to load prompt:', error);
      }
    };

    loadPrompt();

    return () => {
      isMounted = false;
    };
    // ✅ Only these — removing currentPrompt?.id prevents the focus-killing reload loop
  }, [promptId, category]);

  // ---------------------------------------------------------------------------
  // 2) Set up sync listeners + Supabase Realtime for partner answers
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!currentPrompt?.id) return;

    const cleanups = [];

    // Local event listener
    const unsubLocal = promptSyncService.addListener((event, data) => {
      switch (event) {
        case 'partner_answer_received':
          if (data.promptId === currentPrompt.id) {
            if (data.canReveal) {
              setPartnerAnswer(data.partnerAnswer);
              setTimeout(() => revealPartnerAnswer(), 400);
            } else {
              setPartnerAnswer('Partner has shared their reflection...');
            }
          }
          break;
        case 'partner_answer_revealed':
          if (data.promptId === currentPrompt.id) {
            setIsPartnerAnswerRevealed(true);
          }
          break;
        default:
          break;
      }
    });
    if (typeof unsubLocal === 'function') cleanups.push(unsubLocal);

    // Supabase Realtime subscription for live partner answers
    if (appState.coupleId && appState.userId) {
      const unsubRealtime = promptSyncService.subscribeToPartner(
        appState.coupleId,
        appState.userId,
        currentPrompt.id
      );
      if (typeof unsubRealtime === 'function') cleanups.push(unsubRealtime);

      // Also fetch any existing partner answer (in case they answered first)
      promptSyncService.fetchPartnerAnswer(currentPrompt.id, appState.coupleId, appState.userId)
        .then(answer => {
          if (answer) {
            setPartnerAnswer(answer);
          }
        });
    }

    return () => cleanups.forEach(fn => fn());
  }, [currentPrompt?.id, appState.coupleId]); // re-subscribe when prompt or couple changes

  const generateDailyPrompt = async (categoryId) => {
    const today = new Date().toISOString().split('T')[0];
    const [curYear, curMonth] = today.split('-');
    const monthKey = `${curYear}-${curMonth}`;
    const prompts = EDITORIAL_PROMPTS[categoryId] || EDITORIAL_PROMPTS.reflection;

    // Load this month's used indices for this category to avoid repeats
    let usedIndices = [];
    const storageKey = `editorial_month_${categoryId}`;
    try {
      const raw = await storage.get(storageKey, null);
      if (raw && raw.month === monthKey && Array.isArray(raw.indices)) {
        usedIndices = raw.indices;
      }
    } catch (e) { /* fallback to fresh start */ }

    // Build list of fresh (unused this month) indices
    const allIndices = prompts.map((_, i) => i);
    let freshIndices = allIndices.filter(i => !usedIndices.includes(i));
    // If all prompts have been shown, reset the cycle
    if (freshIndices.length === 0) freshIndices = allIndices;

    // Deterministic pick from the fresh set using the day of month
    const dayOfMonth = parseInt(today.split('-')[2], 10);
    const promptIndex = freshIndices[dayOfMonth % freshIndices.length];

    const prompt = {
      id: `prompt_${today}_${categoryId}`,
      date: today,
      category: categoryId,
      question: prompts[promptIndex],
      userAnswer: null,
      partnerAnswer: null,
      createdAt: new Date(),
      isRevealed: false,
    };

    // Persist the updated month history
    if (!usedIndices.includes(promptIndex)) usedIndices.push(promptIndex);
    try {
      await storage.set(storageKey, { month: monthKey, indices: usedIndices });
    } catch (e) {
      console.warn('[EditorialPrompt] Failed to persist month history:', e?.message);
    }

    // Store prompt
    const storedPrompts = await storage.get(STORAGE_KEYS.EDITORIAL_PROMPTS, {});
    storedPrompts[prompt.id] = prompt;
    await storage.set(STORAGE_KEYS.EDITORIAL_PROMPTS, storedPrompts);

    return prompt;
  };

  const handleAnswerSubmit = async () => {
    if (!userAnswer.trim() || isSubmitting || !currentPrompt?.id) return;

    setIsSubmitting(true);

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      Animated.sequence([
        Animated.timing(submitAnimation, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(submitAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      await promptSyncService.submitAnswer(currentPrompt.id, userAnswer.trim(), appState.userId, appState.coupleId);

      setHasUserSubmitted(true);

      if (onAnswerSubmit) {
        onAnswerSubmit(currentPrompt, userAnswer.trim());
      }
    } catch (error) {
      console.error('Failed to submit answer:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const revealPartnerAnswer = async () => {
    if (!partnerAnswer || isPartnerAnswerRevealed || !currentPrompt?.id) return;

    try {
      await promptSyncService.revealPartnerAnswer(currentPrompt.id);

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      Animated.parallel([
        Animated.timing(blurAnimation, {
          toValue: 0,
          duration: 400,
          useNativeDriver: false,
        }),
        Animated.timing(revealAnimation, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();

      setIsPartnerAnswerRevealed(true);

      if (onPartnerAnswerRevealed) {
        onPartnerAnswerRevealed(currentPrompt, partnerAnswer);
      }
    } catch (error) {
      console.error('Failed to reveal partner answer:', error);
    }
  };

  const renderPromptHeader = () => (
    <View style={styles.header}>
      <View style={styles.categoryContainer}>
        <Text style={styles.categoryIcon}>{promptCategory.icon}</Text>
        <Text style={[styles.categoryName, { color: colors.primary }]}>{promptCategory.name}</Text>
      </View>

      <View style={styles.dateContainer}>
        <Text style={[styles.dateText, { color: colors.textMuted }]}>
          {currentPrompt ? new Date(currentPrompt.createdAt).toLocaleDateString() : 'Today'}
        </Text>
      </View>
    </View>
  );

  const renderPromptQuestion = () => (
    <View style={styles.questionContainer}>
      <Text style={[styles.questionText, { color: colors.text }]}>
        {currentPrompt?.question || 'Loading your daily reflection...'}
      </Text>
    </View>
  );

  const renderUserAnswerSection = () => (
    <View style={styles.answerSection}>
      <Text style={[styles.answerLabel, { color: colors.primary }]}>Your Reflection</Text>

      {hasUserSubmitted ? (
        <View style={styles.submittedAnswer}>
          <BlurView intensity={5} style={[styles.submittedAnswerBlur, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
            <Text style={[styles.submittedAnswerText, { color: colors.text }]}>{userAnswer}</Text>
            <Text style={[styles.submittedTimestamp, { color: colors.textMuted }]}>
              Submitted{' '}
              {currentPrompt?.userSubmittedAt
                ? new Date(currentPrompt.userSubmittedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'just now'}
            </Text>
          </BlurView>
        </View>
      ) : (
        <View style={styles.answerInputContainer}>
          <TextInput
            style={[styles.answerInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            value={userAnswer}
            onChangeText={setUserAnswer}
            placeholder="Share your thoughts..."
            placeholderTextColor={colors.textMuted + '60'}
            multiline
            textAlignVertical="top"
            maxLength={500}
            // These help reduce “focus lost” weirdness on iOS
            blurOnSubmit={false}
            autoCorrect
            autoCapitalize="sentences"
            scrollEnabled
          />

          <Animated.View style={[styles.submitButtonContainer, { transform: [{ scale: submitAnimation }] }]}>
            <TouchableOpacity
              onPress={handleAnswerSubmit}
              disabled={!userAnswer.trim() || isSubmitting}
              style={[
                styles.submitButton,
                (!userAnswer.trim() || isSubmitting) && styles.submitButtonDisabled,
              ]}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={promptCategory.gradient || ['#6B2D5B', '#4A1942']}
                style={styles.submitButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={[styles.submitButtonText, { color: colors.text }]}> 
                  {isSubmitting ? 'Submitting...' : 'Submit Reflection'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}
    </View>
  );

  const renderPartnerAnswerSection = () => {
    if (!partnerAnswer) {
      return (
        <View style={styles.answerSection}>
          <Text style={[styles.answerLabel, { color: colors.primary }]}>Partner's Reflection</Text>
          <View style={styles.waitingForPartner}>
            <BlurView intensity={10} style={[styles.waitingBlur, { backgroundColor: colors.surface + '40', borderColor: colors.border }]}>
              <Text style={[styles.waitingText, { color: colors.textMuted }]}>
                {hasUserSubmitted
                  ? 'Waiting for your partner to reflect...'
                  : "Submit your reflection to see your partner's response"}
              </Text>
            </BlurView>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.answerSection}>
        <Text style={[styles.answerLabel, { color: colors.primary }]}>Partner's Reflection</Text>

        <Animated.View
          style={[
            styles.partnerAnswer,
            {
              opacity: isPartnerAnswerRevealed ? revealAnimation : 1,
            },
          ]}
        >
          <BlurView intensity={isPartnerAnswerRevealed ? 5 : blurAnimation} style={[styles.partnerAnswerBlur, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
            {isPartnerAnswerRevealed ? (
              <>
                <Text style={[styles.partnerAnswerText, { color: colors.text }]}>{partnerAnswer}</Text>
                <Text style={[styles.revealedTimestamp, { color: colors.textMuted }]}>
                  Revealed{' '}
                  {currentPrompt?.revealedAt
                    ? new Date(currentPrompt.revealedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'just now'}
                </Text>
              </>
            ) : (
              <View style={styles.blurredContent}>
                <Text style={[styles.blurredText, { color: colors.textMuted }]}>Your partner has shared their reflection...</Text>
                <Text style={[styles.blurredSubtext, { color: colors.textMuted + '80' }]}>Submit your answer to reveal theirs</Text>
              </View>
            )}
          </BlurView>
        </Animated.View>
      </View>
    );
  };

  if (!currentPrompt) {
    return (
      <View style={[styles.container, styles.loadingContainer, style]}>
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Preparing your daily reflection...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      // If you have a header/nav bar, adjust this up (common iOS fix)
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <Animated.View style={[styles.content, { opacity: fadeAnimation }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          // ✅ Key keyboard props
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          {renderPromptHeader()}
          {renderPromptQuestion()}
          {renderUserAnswerSection()}
          {renderPartnerAnswerSection()}

          <View style={[styles.editorialFooter, { borderTopColor: colors.border }]}>
            <Text style={[styles.editorialFooterText, { color: colors.textMuted }]}>
              "The unexamined life is not worth living." — Socrates
            </Text>
          </View>
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...TYPOGRAPHY.body,
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    fontSize: 24,
    marginRight: SPACING.sm,
  },
  categoryName: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
  },
  dateContainer: {
    alignItems: 'flex-end',
  },
  dateText: {
    ...TYPOGRAPHY.caption,
  },
  questionContainer: {
    marginBottom: SPACING.xxl,
  },
  questionText: {
    ...TYPOGRAPHY.h1,
    fontSize: 26,
    lineHeight: 34,
  },
  answerSection: {
    marginBottom: SPACING.xxl,
  },
  answerLabel: {
    ...TYPOGRAPHY.label,
    marginBottom: SPACING.md,
  },
  answerInputContainer: {
    width: '100%',
  },
  answerInput: {
    ...TYPOGRAPHY.body,
    minHeight: 120,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    textAlignVertical: 'top',
  },
  submitButtonContainer: {
    marginTop: SPACING.md,
    alignSelf: 'flex-end',
  },
  submitButton: {
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonGradient: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl,
  },
  submitButtonText: {
    ...TYPOGRAPHY.button,
    fontSize: 14,
  },
  submittedAnswer: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  submittedAnswerBlur: {
    padding: SPACING.md,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
  },
  submittedAnswerText: {
    ...TYPOGRAPHY.body,
  },
  submittedTimestamp: {
    ...TYPOGRAPHY.caption,
    marginTop: SPACING.sm,
    fontStyle: 'italic',
  },
  waitingForPartner: {
    marginTop: SPACING.sm,
  },
  waitingBlur: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  waitingText: {
    ...TYPOGRAPHY.bodySecondary,
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  partnerAnswer: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  partnerAnswerBlur: {
    padding: SPACING.md,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    minHeight: 80,
    justifyContent: 'center',
  },
  partnerAnswerText: {
    ...TYPOGRAPHY.body,
  },
  revealedTimestamp: {
    ...TYPOGRAPHY.caption,
    marginTop: SPACING.sm,
    fontStyle: 'italic',
  },
  blurredContent: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  blurredText: {
    ...TYPOGRAPHY.bodySecondary,
    fontSize: 14,
    marginBottom: 4,
  },
  blurredSubtext: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
  },
  editorialFooter: {
    marginTop: SPACING.xxl,
    paddingTop: SPACING.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  editorialFooterText: {
    ...TYPOGRAPHY.caption,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

export default EditorialPrompt;