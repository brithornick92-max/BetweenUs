/**
 * EditorialPrompt — Daily reflection bridge
 * * Velvet Glass & Apple Editorial updates integrated.
 * Pure native iOS surface mapping with Sexy Red (#D2121A) accents.
 */

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
import Icon from './Icon';
import { impact, ImpactFeedbackStyle } from '../utils/haptics';
import { useAppContext } from '../context/AppContext';
import { useMemoryContext } from '../context/MemoryContext';
import { useTheme } from '../context/ThemeContext';
import { storage, STORAGE_KEYS, promptStorage } from '../utils/storage';
import { supabase, TABLES } from '../config/supabase';
import { SPACING, withAlpha } from '../utils/theme';
import PreferenceEngine from '../services/PreferenceEngine';

const { width: screenWidth } = Dimensions.get('window');

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
          } catch { /* ignore */ }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  },

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

  submitAnswer: async (promptId, answer, userId, coupleId) => {
    const today = new Date().toISOString().split('T')[0];
    await promptStorage.setAnswer(today, promptId, { answer, userId });

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
      }
    }
    return { success: true };
  },

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
    } catch { /* offline */ }
    return null;
  },

  revealPartnerAnswer: async () => ({ success: true }),
};

const PROMPT_CATEGORIES = {
  REFLECTION: { id: 'reflection', name: 'Reflection', icon: 'chatbox-outline', color: '#5856D6' },
  GRATITUDE: { id: 'gratitude', name: 'Gratitude', icon: 'sparkles-outline', color: '#FF9F0A' },
  DREAMS: { id: 'dreams', name: 'Dreams', icon: 'moon-outline', color: '#AF52DE' },
  INTIMACY: { id: 'intimacy', name: 'Intimacy', icon: 'flame-outline', color: '#D2121A' },
  PLAYFUL: { id: 'playful', name: 'Playful', icon: 'happy-outline', color: '#34C759' },
  DAILY_LIFE: { id: 'daily_life', name: 'Daily Life', icon: 'sunny-outline', color: '#64D2FF' },
};

const EDITORIAL_PROMPTS = {
  [PROMPT_CATEGORIES.REFLECTION.id]: [
    "What moment today made you feel most connected to yourself?",
    "If you could relive one conversation from this week, which would it be?",
    "What's something you've learned about love recently?",
  ],
  [PROMPT_CATEGORIES.DAILY_LIFE.id]: [
    "What was the highlight of your day today?",
    "What's something that happened today that you want to share?",
    "How did you feel most like yourself today?",
  ],
  [PROMPT_CATEGORIES.INTIMACY.id]: [
    "What makes you feel most loved by your partner?",
    "What's your favorite way to show affection?",
    "How do you like to be comforted when you're upset?",
  ],
};

const EditorialPrompt = ({
  style,
  promptId = null,
  category = PROMPT_CATEGORIES.DAILY_LIFE.id,
  onAnswerSubmit,
  onPartnerAnswerRevealed,
}) => {
  const { colors, isDark } = useTheme();
  const { state: appState } = useAppContext();
  const { state: memoryState } = useMemoryContext();

  const t = useMemo(() => ({
    background: 'transparent', 
    surface: isDark ? '#131016' : '#FFFFFF',
    surfaceSecondary: isDark ? '#1C1520' : '#F2F2F7',
    primary: colors.primary || '#D2121A',
    text: colors.text,
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
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

  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    let isMounted = true;
    const loadPrompt = async () => {
      try {
        let prompt;
        if (promptId) prompt = await promptSyncService.getPromptWithPrivacy(promptId);
        if (!prompt) prompt = await generateDailyPrompt(category);
        if (!isMounted) return;

        setCurrentPrompt(prompt);
        if (prompt.userAnswer) {
          setUserAnswer(prompt.userAnswer);
          setHasUserSubmitted(true);
        }
        
        Animated.parallel([
          Animated.timing(fadeAnimation, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.spring(slideAnimation, { toValue: 0, friction: 9, tension: 60, useNativeDriver: true }),
        ]).start();
      } catch (error) {
        console.error('Failed to load prompt:', error);
      }
    };
    loadPrompt();
    return () => { isMounted = false; };
  }, [promptId, category]);

  useEffect(() => {
    if (!currentPrompt?.id) return;
    const unsubLocal = promptSyncService.addListener((event, data) => {
      if (event === 'partner_answer_received' && data.promptId === currentPrompt.id) {
        setPartnerAnswer(data.partnerAnswer);
        if (hasUserSubmitted) setIsPartnerAnswerRevealed(true);
      }
    });
    return () => unsubLocal();
  }, [currentPrompt?.id, hasUserSubmitted]);

  const generateDailyPrompt = async (categoryId) => {
    const today = new Date().toISOString().split('T')[0];
    const prompts = EDITORIAL_PROMPTS[categoryId] || EDITORIAL_PROMPTS.reflection;
    const dayOfMonth = parseInt(today.split('-')[2], 10);
    const promptIndex = dayOfMonth % prompts.length;

    return {
      id: `prompt_${today}_${categoryId}`,
      date: today,
      category: categoryId,
      question: prompts[promptIndex],
      userAnswer: null,
      createdAt: new Date(),
    };
  };

  const handleAnswerSubmit = async () => {
    if (!userAnswer.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      impact(ImpactFeedbackStyle.Medium);
      await promptSyncService.submitAnswer(currentPrompt.id, userAnswer.trim(), appState.userId, appState.coupleId);
      setHasUserSubmitted(true);
      onAnswerSubmit?.(currentPrompt, userAnswer.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.container, style]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Animated.View style={[styles.content, { opacity: fadeAnimation, transform: [{ translateY: slideAnimation }] }]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          <View style={styles.header}>
            <View style={styles.categoryContainer}>
              <View style={[styles.categoryIconWrap, { backgroundColor: withAlpha(promptCategory.color, 0.15) }]}>
                <Icon name={promptCategory.icon} size={18} color={promptCategory.color} />
              </View>
              <Text style={[styles.categoryName, { color: promptCategory.color }]}>{promptCategory.name}</Text>
            </View>
            <Text style={styles.dateText}>{new Date().toLocaleDateString()}</Text>
          </View>

          <View style={styles.questionContainer}>
            <Text style={styles.questionText}>{currentPrompt?.question}</Text>
          </View>

          <View style={styles.answerSection}>
            <Text style={styles.answerLabel}>YOUR REFLECTION</Text>
            {hasUserSubmitted ? (
              <View style={styles.submittedCard}>
                <Text style={styles.submittedText}>{userAnswer}</Text>
              </View>
            ) : (
              <View>
                <TextInput
                  style={styles.answerInput}
                  value={userAnswer}
                  onChangeText={setUserAnswer}
                  placeholder="Share your thoughts..."
                  placeholderTextColor={t.subtext}
                  multiline
                />
                <TouchableOpacity onPress={handleAnswerSubmit} style={[styles.submitButton, { backgroundColor: t.primary }]} disabled={!userAnswer.trim()}>
                  <Text style={styles.submitButtonText}>Submit Reflection</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.answerSection}>
            <Text style={styles.answerLabel}>PARTNER'S REFLECTION</Text>
            <View style={[styles.submittedCard, !isPartnerAnswerRevealed && styles.blurredCard]}>
              <Text style={isPartnerAnswerRevealed ? styles.submittedText : styles.blurredText}>
                {isPartnerAnswerRevealed ? partnerAnswer : "Shared once you both reflect."}
              </Text>
            </View>
          </View>

        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

const createStyles = (t, isDark) => {
  const systemFont = Platform.select({ ios: "System", android: "Roboto" });
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.background },
    scrollContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: 100 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
    categoryContainer: { flexDirection: 'row', alignItems: 'center' },
    categoryIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    categoryName: { fontFamily: systemFont, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
    dateText: { fontSize: 14, fontWeight: '600', color: t.subtext },
    questionContainer: { marginBottom: 48 },
    questionText: { fontFamily: systemFont, fontSize: 32, fontWeight: '800', color: t.text, lineHeight: 38, letterSpacing: -0.5 },
    answerSection: { marginBottom: 40 },
    answerLabel: { fontSize: 12, fontWeight: '800', color: t.subtext, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 },
    answerInput: { backgroundColor: t.surface, borderRadius: 24, padding: 20, fontSize: 17, color: t.text, borderWidth: 1, borderColor: t.border, minHeight: 140, textAlignVertical: 'top' },
    submitButton: { marginTop: 16, alignSelf: 'flex-end', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 24 },
    submitButtonText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
    submittedCard: { backgroundColor: t.surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: t.border },
    submittedText: { fontSize: 17, color: t.text, lineHeight: 26 },
    blurredCard: { backgroundColor: t.surfaceSecondary, alignItems: 'center', justifyContent: 'center', minHeight: 80 },
    blurredText: { fontSize: 15, fontWeight: '600', color: t.subtext, fontStyle: 'italic' }
  });
};

export default EditorialPrompt;
