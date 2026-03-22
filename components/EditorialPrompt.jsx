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
  Platform,
} from 'react-native';
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { useAppContext } from '../context/AppContext';
import { useMemoryContext } from '../context/MemoryContext';
import { useTheme } from '../context/ThemeContext';
import { storage, STORAGE_KEYS, promptStorage } from '../utils/storage';
import { supabase, TABLES } from '../config/supabase';
import { SPACING } from '../utils/theme';
import PreferenceEngine from '../services/PreferenceEngine';

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

// Editorial prompt categories and themes (Mapped to Apple iOS system colors)
const PROMPT_CATEGORIES = {
  REFLECTION: {
    id: 'reflection',
    name: 'Daily Reflection',
    icon: '💭',
    color: '#5856D6', // iOS Purple
  },
  GRATITUDE: {
    id: 'gratitude',
    name: 'Gratitude',
    icon: '🙏',
    color: '#FF9500', // iOS Orange
  },
  DREAMS: {
    id: 'dreams',
    name: 'Dreams & Future',
    icon: '✨',
    color: '#AF52DE', // iOS Indigo
  },
  INTIMACY: {
    id: 'intimacy',
    name: 'Intimacy',
    icon: '💕',
    color: '#FF2D55', // iOS Pink
  },
  PLAYFUL: {
    id: 'playful',
    name: 'Playful',
    icon: '😄',
    color: '#34C759', // iOS Green
  },
  DAILY_LIFE: {
    id: 'daily_life',
    name: 'Daily Life',
    icon: '☀️',
    color: '#32ADE6', // iOS Cyan
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
  const { colors, isDark } = useTheme();
  const { state: appState } = useAppContext();
  const { state: memoryState } = useMemoryContext();

  // STRICT Apple Editorial Theme Map 
  const t = useMemo(() => ({
    background: 'transparent', 
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    surfaceSecondary: isDark ? '#2C2C2E' : '#F2F2F7',
    primary: colors.primary,
    text: isDark ? '#FFFFFF' : '#000000',
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  const [currentPrompt, setCurrentPrompt] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [partnerAnswer, setPartnerAnswer] = useState('');
  const [isPartnerAnswerRevealed, setIsPartnerAnswerRevealed] = useState(false);
  const [hasUserSubmitted, setHasUserSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const promptCategory = useMemo(() => {
    const catId = currentPrompt?.category || category;
    return Object.values(PROMPT_CATEGORIES).find(c => c.id === catId) || PROMPT_CATEGORIES.REFLECTION;
  }, [currentPrompt?.category, category]);

  // Animation values
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(20)).current;
  const revealAnimation = useRef(new Animated.Value(0)).current;
  const submitAnimation = useRef(new Animated.Value(1)).current;

  // ---------------------------------------------------------------------------
  // 1) Load or generate prompt
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

        // Native iOS Spring Entrance
        fadeAnimation.setValue(0);
        slideAnimation.setValue(20);
        Animated.parallel([
          Animated.timing(fadeAnimation, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.spring(slideAnimation, {
            toValue: 0,
            friction: 9,
            tension: 60,
            useNativeDriver: true,
          }),
        ]).start();
      } catch (error) {
        console.error('Failed to load prompt:', error);
      }
    };

    loadPrompt();

    return () => {
      isMounted = false;
    };
  }, [promptId, category]);

  // ---------------------------------------------------------------------------
  // 2) Set up sync listeners + Supabase Realtime for partner answers
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!currentPrompt?.id) return;

    const cleanups = [];

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

    if (appState.coupleId && appState.userId) {
      const unsubRealtime = promptSyncService.subscribeToPartner(
        appState.coupleId,
        appState.userId,
        currentPrompt.id
      );
      if (typeof unsubRealtime === 'function') cleanups.push(unsubRealtime);

      promptSyncService.fetchPartnerAnswer(currentPrompt.id, appState.coupleId, appState.userId)
        .then(answer => {
          if (answer) {
            setPartnerAnswer(answer);
          }
        });
    }

    return () => cleanups.forEach(fn => fn());
  }, [currentPrompt?.id, appState.coupleId]);

  const generateDailyPrompt = async (categoryId) => {
    const today = new Date().toISOString().split('T')[0];
    const [curYear, curMonth] = today.split('-');
    const monthKey = `${curYear}-${curMonth}`;
    const prompts = EDITORIAL_PROMPTS[categoryId] || EDITORIAL_PROMPTS.reflection;

    let usedIndices = [];
    const storageKey = `editorial_month_${categoryId}`;
    try {
      const raw = await storage.get(storageKey, null);
      if (raw && raw.month === monthKey && Array.isArray(raw.indices)) {
        usedIndices = raw.indices;
      }
    } catch (e) { /* fallback to fresh start */ }

    const allIndices = prompts.map((_, i) => i);
    let freshIndices = allIndices.filter(i => !usedIndices.includes(i));
    if (freshIndices.length === 0) freshIndices = allIndices;

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

    if (!usedIndices.includes(promptIndex)) usedIndices.push(promptIndex);
    try {
      await storage.set(storageKey, { month: monthKey, indices: usedIndices });
    } catch (e) {
      console.warn('[EditorialPrompt] Failed to persist month history:', e?.message);
    }

    const storedPrompts = await storage.get(STORAGE_KEYS.EDITORIAL_PROMPTS, {});
    storedPrompts[prompt.id] = prompt;
    await storage.set(STORAGE_KEYS.EDITORIAL_PROMPTS, storedPrompts);

    return prompt;
  };

  const handleAnswerSubmit = async () => {
    if (!userAnswer.trim() || isSubmitting || !currentPrompt?.id) return;

    setIsSubmitting(true);

    try {
      impact(ImpactFeedbackStyle.Medium);

      Animated.sequence([
        Animated.timing(submitAnimation, {
          toValue: 0.95,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(submitAnimation, {
          toValue: 1,
          friction: 8,
          tension: 60,
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

      impact(ImpactFeedbackStyle.Light);

      Animated.timing(revealAnimation, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

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
        <View style={[styles.categoryIconWrap, { backgroundColor: promptCategory.color + '15' }]}>
          <Text style={styles.categoryIcon}>{promptCategory.icon}</Text>
        </View>
        <Text style={[styles.categoryName, { color: promptCategory.color }]}>{promptCategory.name}</Text>
      </View>
      <View style={styles.dateContainer}>
        <Text style={styles.dateText}>
          {currentPrompt ? new Date(currentPrompt.createdAt).toLocaleDateString() : 'Today'}
        </Text>
      </View>
    </View>
  );

  const renderPromptQuestion = () => (
    <View style={styles.questionContainer}>
      <Text style={styles.questionText}>
        {currentPrompt?.question || 'Loading your daily reflection...'}
      </Text>
    </View>
  );

  const renderUserAnswerSection = () => (
    <View style={styles.answerSection}>
      <Text style={styles.answerLabel}>YOUR REFLECTION</Text>

      {hasUserSubmitted ? (
        <View style={styles.submittedAnswerCard}>
          <Text style={styles.submittedAnswerText}>{userAnswer}</Text>
          <Text style={styles.submittedTimestamp}>
            Submitted{' '}
            {currentPrompt?.userSubmittedAt
              ? new Date(currentPrompt.userSubmittedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'just now'}
          </Text>
        </View>
      ) : (
        <View style={styles.answerInputContainer}>
          <TextInput
            style={styles.answerInput}
            value={userAnswer}
            onChangeText={setUserAnswer}
            placeholder="Share your thoughts..."
            placeholderTextColor={t.subtext}
            multiline
            textAlignVertical="top"
            maxLength={500}
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
              <Text style={styles.submitButtonText}> 
                {isSubmitting ? 'Submitting...' : 'Submit Reflection'}
              </Text>
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
          <Text style={styles.answerLabel}>PARTNER'S REFLECTION</Text>
          <View style={[styles.submittedAnswerCard, { backgroundColor: 'transparent', borderStyle: 'dashed' }]}>
            <Text style={styles.waitingText}>
              {hasUserSubmitted
                ? 'Waiting for your partner to reflect...'
                : "Submit your reflection to see your partner's response."}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.answerSection}>
        <Text style={styles.answerLabel}>PARTNER'S REFLECTION</Text>

        <Animated.View
          style={[
            styles.submittedAnswerCard,
            !isPartnerAnswerRevealed && { backgroundColor: t.surfaceSecondary },
            {
              opacity: isPartnerAnswerRevealed ? revealAnimation : 1,
            },
          ]}
        >
          {isPartnerAnswerRevealed ? (
            <>
              <Text style={styles.partnerAnswerText}>{partnerAnswer}</Text>
              <Text style={styles.revealedTimestamp}>
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
              <Text style={styles.blurredText}>Your partner has shared their reflection...</Text>
              <Text style={styles.blurredSubtext}>Submit your answer to reveal theirs.</Text>
            </View>
          )}
        </Animated.View>
      </View>
    );
  };

  if (!currentPrompt) {
    return (
      <View style={[styles.container, styles.loadingContainer, style]}>
        <Text style={styles.loadingText}>Preparing your daily reflection...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <Animated.View style={[styles.content, { opacity: fadeAnimation, transform: [{ translateY: slideAnimation }] }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          bounces={true}
        >
          {renderPromptHeader()}
          {renderPromptQuestion()}
          {renderUserAnswerSection()}
          {renderPartnerAnswerSection()}

          <View style={styles.editorialFooter}>
            <Text style={styles.editorialFooterText}>
              "The unexamined life is not worth living." — Socrates
            </Text>
          </View>
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

// ------------------------------------------------------------------
// STYLES - Pure Apple Editorial 
// ------------------------------------------------------------------
const createStyles = (t, isDark) => {
  const systemFont = Platform.select({ ios: "System", android: "Roboto" });

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.background,
    },
    loadingContainer: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 16,
      fontStyle: 'italic',
      color: t.subtext,
    },
    content: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.xl,
      paddingBottom: 160, // Clear the bottom tab bar securely
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
    categoryIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: SPACING.sm,
    },
    categoryIcon: {
      fontSize: 16,
    },
    categoryName: {
      fontFamily: systemFont,
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: -0.2,
    },
    dateContainer: {
      alignItems: 'flex-end',
    },
    dateText: {
      fontSize: 14,
      fontWeight: '600',
      color: t.subtext,
    },
    questionContainer: {
      marginBottom: SPACING.xxxl,
    },
    questionText: {
      fontFamily: systemFont,
      fontSize: 32,
      fontWeight: '800',
      color: t.text,
      lineHeight: 38,
      letterSpacing: -0.5,
    },

    // ── Answers ──
    answerSection: {
      marginBottom: SPACING.xxl,
    },
    answerLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: t.subtext,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: SPACING.md,
      paddingLeft: 4,
    },
    answerInputContainer: {
      width: '100%',
    },
    answerInput: {
      backgroundColor: t.surface,
      borderRadius: 24, // iOS Squircle
      padding: SPACING.xl,
      fontSize: 17,
      color: t.text,
      borderWidth: 1,
      borderColor: t.border,
      minHeight: 140,
      textAlignVertical: 'top',
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0 : 0.04, shadowRadius: 8 },
        android: { elevation: 2 },
      }),
    },
    submitButtonContainer: {
      marginTop: SPACING.lg,
      alignSelf: 'flex-end',
    },
    submitButton: {
      backgroundColor: t.text, // High contrast Apple action
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 24,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0 : 0.15, shadowRadius: 8 },
        android: { elevation: 3 },
      }),
    },
    submitButtonDisabled: {
      opacity: 0.5,
    },
    submitButtonText: {
      color: t.surface,
      fontSize: 15,
      fontWeight: '700',
    },
    
    // ── Submitted Answer Widget ──
    submittedAnswerCard: {
      backgroundColor: t.surface,
      borderRadius: 24,
      padding: SPACING.xl,
      borderWidth: 1,
      borderColor: t.border,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0 : 0.04, shadowRadius: 8 },
        android: { elevation: 2 },
      }),
    },
    submittedAnswerText: {
      fontSize: 17,
      color: t.text,
      lineHeight: 26,
    },
    submittedTimestamp: {
      fontSize: 12,
      fontWeight: '600',
      color: t.subtext,
      marginTop: SPACING.md,
    },

    // ── Partner Empty / Waiting State ──
    waitingText: {
      fontSize: 15,
      fontWeight: '500',
      color: t.subtext,
      textAlign: 'center',
      fontStyle: 'italic',
      paddingVertical: SPACING.md,
    },

    // ── Partner Answer ──
    partnerAnswerText: {
      fontSize: 17,
      color: t.text,
      lineHeight: 26,
    },
    revealedTimestamp: {
      fontSize: 12,
      fontWeight: '600',
      color: t.subtext,
      marginTop: SPACING.md,
    },
    blurredContent: {
      alignItems: 'center',
      paddingVertical: SPACING.md,
    },
    blurredText: {
      fontSize: 15,
      fontWeight: '600',
      color: t.text,
      marginBottom: 6,
    },
    blurredSubtext: {
      fontSize: 13,
      fontWeight: '500',
      color: t.subtext,
    },

    // ── Footer ──
    editorialFooter: {
      marginTop: SPACING.xxl,
      paddingTop: SPACING.xl,
      borderTopWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
    },
    editorialFooterText: {
      fontSize: 14,
      fontWeight: '500',
      color: t.subtext,
      fontStyle: 'italic',
      textAlign: 'center',
    },
  });
};

export default EditorialPrompt;
