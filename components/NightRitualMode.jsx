// components/NightRitualMode.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { useAppContext } from '../context/AppContext';
import { useRitualContext } from '../context/RitualContext';
import { useMemoryContext } from '../context/MemoryContext';
import { useTheme } from '../context/ThemeContext';
import { SPACING } from '../utils/theme';

// STRICT Apple Editorial Dark Mode Palette (Forced Dark for Night Ritual)
export const getNightRitualColors = (palette) => ({
  deepNight: '#000000',
  plumVignette: '#0F0A1A',
  midnightBlue: '#0D081A',
  surface: '#1C1C1E',
  surfaceSecondary: '#2C2C2E',
  text: '#FFFFFF',
  subtext: 'rgba(235, 235, 245, 0.6)',
  border: 'rgba(255,255,255,0.08)',
  // Vibrant iOS System Accents
  iosPurple: '#5856D6',
  iosPink: '#FF2D55',
  iosOrange: '#FF9500',
  iosCyan: '#32ADE6',
});

// Inline fallback questions — used when context fails to provide data
const FALLBACK_QUESTIONS = {
  prompt: "What’s one feeling you’d like to name before you sleep?",
  checkIn: "How is your heart feeling as this day comes to an end?",
  appreciation: "What moment today made you feel most connected to love?",
  dateIdea: "What’s one gentle way we could connect tomorrow?",
};

// Gentle footer quotes — rotated each session
const NIGHT_QUOTES = [
  '"Let the day go. Just us now."',
  '"The quieter you become, the more you are able to hear." — Rumi',
  '"I belong deeply to myself, and then to you." — Warsan Shire',
  '"In the silence between us, something is always growing."',
  '"Love is not breathlessness… it is the quiet understanding."',
  '"Rest now. Tomorrow is ours."',
  '"And in the end, the love you take is equal to the love you make."',
];

// Night ritual structure — 4 elements
const getRitualElements = (colors) => ({
  PROMPT: {
    id: 'prompt',
    name: 'Tonight\'s Reflection',
    icon: '🌙',
    color: colors.iosPurple,
    gradient: [colors.iosPurple, '#3F3E9E'],
    description: 'A gentle question to end your day',
  },
  CHECK_IN: {
    id: 'checkIn',
    name: 'How Are You?',
    icon: '💫',
    color: colors.iosPink,
    gradient: [colors.iosPink, '#D11C40'],
    description: 'Share how you\'re feeling tonight',
  },
  APPRECIATION: {
    id: 'appreciation',
    name: 'Gratitude',
    icon: '✨',
    color: colors.iosOrange,
    gradient: [colors.iosOrange, '#CC7700'],
    description: 'Something beautiful from today',
  },
  DATE_IDEA: {
    id: 'dateIdea',
    name: 'Tomorrow Together',
    icon: '🌟',
    color: colors.iosCyan,
    gradient: [colors.iosCyan, '#208AB8'],
    description: 'A way to connect tomorrow',
  },
});

const NightRitualMode = ({
  style,
  onRitualComplete,
  onElementComplete,
  compact = false,
}) => {
  const { colors: themeColors } = useTheme();
  const NIGHT_COLORS = useMemo(() => getNightRitualColors(themeColors), [themeColors]);
  const styles = useMemo(() => createStyles(NIGHT_COLORS), [NIGHT_COLORS]);
  const RITUAL_ELEMENTS = getRitualElements(NIGHT_COLORS);
  
  const { state: appState } = useAppContext();
  const { state: ritualState, actions: ritualActions } = useRitualContext();
  const { state: memoryState } = useMemoryContext();
  
  const [currentRitual, setCurrentRitual] = useState(null);
  const [currentElement, setCurrentElement] = useState(0);
  const [responses, setResponses] = useState({});
  const [isCompleting, setIsCompleting] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  
  // Animation values
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(40)).current;
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const completionAnimation = useRef(new Animated.Value(0)).current;
  const elementTimerRef = useRef(null);
  const completionTimerRef = useRef(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (elementTimerRef.current) clearTimeout(elementTimerRef.current);
      if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
    };
  }, []);

  // Initialize ritual on mount
  useEffect(() => {
    const initializeRitual = async () => {
      try {
        let ritual = ritualState.currentRitual;

        if (!ritual) {
          try {
            ritual = await ritualActions.getRitualWithMemoryContext(memoryState);
          } catch (memoryErr) {
            if (__DEV__) console.warn('Memory context unavailable, using standard ritual:', memoryErr);
            try {
              ritual = await ritualActions.startNightRitual();
            } catch (startErr) {
              if (__DEV__) console.warn('startNightRitual failed, building local ritual:', startErr);
            }
          }
        }

        if (!ritual || !ritual.prompt?.question) {
          ritual = {
            id: `ritual_fallback_${Date.now()}`,
            date: new Date(),
            type: 'standard',
            prompt: { question: FALLBACK_QUESTIONS.prompt, userAnswer: null, partnerAnswer: null, isRevealed: false },
            checkIn: { question: FALLBACK_QUESTIONS.checkIn, userAnswer: null, partnerAnswer: null, isRevealed: false },
            appreciation: { question: FALLBACK_QUESTIONS.appreciation, userAnswer: null, partnerAnswer: null, isRevealed: false },
            dateIdea: { question: FALLBACK_QUESTIONS.dateIdea, userAnswer: null, partnerAnswer: null, isRevealed: false },
            completedAt: null,
            partnerCompleted: false,
          };
        }

        setCurrentRitual(ritual);
        
        const loadedResponses = {};
        for (const key of Object.keys(RITUAL_ELEMENTS)) {
          const id = RITUAL_ELEMENTS[key].id;
          if (ritual[id]?.userAnswer) {
            loadedResponses[id] = ritual[id].userAnswer;
          }
        }
        if (Object.keys(loadedResponses).length > 0) {
          setResponses(prev => ({ ...prev, ...loadedResponses }));
        }
        
        // Native Apple Spring Entrance
        Animated.parallel([
          Animated.timing(fadeAnimation, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.spring(slideAnimation, {
            toValue: 0,
            friction: 9,
            tension: 50,
            useNativeDriver: true,
          }),
        ]).start();
        
      } catch (error) {
        console.error('Failed to initialize night ritual:', error);
      }
    };
    
    initializeRitual();
  }, [ritualState.currentRitual]);

  // Update progress animation
  useEffect(() => {
    const progress = currentElement / Object.keys(RITUAL_ELEMENTS).length;
    Animated.spring(progressAnimation, {
      toValue: progress,
      friction: 8,
      tension: 50,
      useNativeDriver: false,
    }).start();
  }, [currentElement]);

  const handleElementResponse = async (elementId, response) => {
    if (!response.trim()) return;
    
    try {
      impact(ImpactFeedbackStyle.Light);
      
      const newResponses = { ...responses, [elementId]: response.trim() };
      setResponses(newResponses);
      
      await ritualActions.updateRitualResponse(elementId, response.trim());
      
      if (onElementComplete) {
        onElementComplete(elementId, response.trim());
      }
      
      const elementKeys = Object.keys(RITUAL_ELEMENTS);
      const nextIndex = currentElement + 1;
      
      if (nextIndex < elementKeys.length) {
        Animated.sequence([
          Animated.timing(slideAnimation, {
            toValue: -20,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.spring(slideAnimation, {
            toValue: 0,
            friction: 9,
            tension: 60,
            useNativeDriver: true,
          }),
        ]).start();
        
        elementTimerRef.current = setTimeout(() => setCurrentElement(nextIndex), 250);
      } else {
        await completeRitual(newResponses);
      }
      
    } catch (error) {
      console.error('Failed to handle element response:', error);
    }
  };

  const completeRitual = async (finalResponses) => {
    setIsCompleting(true);
    
    try {
      const completedRitual = await ritualActions.completeRitual();
      impact(ImpactFeedbackStyle.Light);
      
      setShowCompletion(true);
      Animated.spring(completionAnimation, {
        toValue: 1,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }).start();
      
      if (onRitualComplete) {
        onRitualComplete(completedRitual, finalResponses);
      }
      
      completionTimerRef.current = setTimeout(() => {
        Animated.timing(completionAnimation, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start(() => {
          setShowCompletion(false);
          setCurrentElement(0);
          setResponses({});
        });
      }, 3000);
      
    } catch (error) {
      console.error('Failed to complete ritual:', error);
    } finally {
      setIsCompleting(false);
    }
  };

  const nightQuote = useRef(
    NIGHT_QUOTES[Math.floor(Math.random() * NIGHT_QUOTES.length)]
  ).current;

  const renderStepDots = () => (
    <View style={styles.stepDotsRow}>
      {Object.keys(RITUAL_ELEMENTS).map((key, i) => {
        const isActive = i === currentElement;
        const isDone = i < currentElement;
        const color = RITUAL_ELEMENTS[key].color;
        
        return (
          <View
            key={i}
            style={[
              styles.stepDot,
              isDone && { backgroundColor: color, borderColor: color },
              isActive && { backgroundColor: color, borderColor: color, transform: [{ scale: 1.3 }] },
            ]}
          />
        );
      })}
    </View>
  );

  const renderRitualElement = () => {
    const elementKeys = Object.keys(RITUAL_ELEMENTS);
    const elementKey = elementKeys[currentElement];
    const element = RITUAL_ELEMENTS[elementKey];
    
    if (!element) return null;

    const elementId = element.id;
    const currentResponse = responses[elementId] || '';
    const isCompleted = !!currentResponse;

    return (
      <Animated.View 
        style={[
          styles.elementContainer,
          {
            opacity: fadeAnimation,
            transform: [{ translateY: slideAnimation }],
          },
        ]}
      >
        {/* Editorial Flush-Left Header */}
        <View style={styles.elementHeader}>
          <View style={[styles.elementIconContainer, { backgroundColor: element.color + '20' }]}>
            <Text style={styles.elementIcon}>{element.icon}</Text>
          </View>
          <View style={styles.elementTitleContainer}>
            <Text style={styles.elementTitle}>{element.name}</Text>
            <Text style={styles.elementDescription}>{element.description}</Text>
          </View>
        </View>

        {/* Heavy Flush-Left Question */}
        <View style={styles.questionContainer}>
          <Text style={styles.questionText}>
            {currentRitual?.[elementId]?.question || FALLBACK_QUESTIONS[elementId] || 'What\'s on your mind tonight?'}
          </Text>
        </View>

        {/* Response Input */}
        {!isCompleted ? (
          <RitualInput
            element={element}
            onSubmit={(response) => handleElementResponse(elementId, response)}
            placeholder={getPlaceholderForElement(elementId)}
            styles={styles}
            NIGHT_COLORS={NIGHT_COLORS}
          />
        ) : (
          <CompletedResponse
            element={element}
            response={currentResponse}
            styles={styles}
            NIGHT_COLORS={NIGHT_COLORS}
          />
        )}
      </Animated.View>
    );
  };

  const renderCompletion = () => {
    if (!showCompletion) return null;

    return (
      <Animated.View 
        style={[
          styles.completionOverlay,
          {
            opacity: completionAnimation,
            transform: [{
              scale: completionAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0.95, 1],
              }),
            }],
          },
        ]}
      >
        <BlurView intensity={40} tint="dark" style={styles.completionModalCard}>
          <Text style={styles.completionIcon}>🌙</Text>
          <Text style={styles.completionTitle}>Rest well</Text>
          <Text style={styles.completionMessage}>
            You showed up tonight. That’s what matters.
          </Text>
        </BlurView>
      </Animated.View>
    );
  };

  const getPlaceholderForElement = (elementId) => {
    const placeholders = {
      prompt: 'Let your thoughts flow gently...',
      checkIn: 'How are you feeling tonight?',
      appreciation: 'What brought you joy today?',
      dateIdea: 'How could we connect tomorrow?',
    };
    return placeholders[elementId] || 'Share your thoughts...';
  };

  if (!currentRitual) {
    return (
      <View style={[styles.container, styles.loadingContainer, style]}>
        <Animated.Text style={[styles.loadingText, { opacity: fadeAnimation }]}>
          Finding something meaningful…
        </Animated.Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      <LinearGradient
        colors={[
          NIGHT_COLORS.deepNight,
          NIGHT_COLORS.plumVignette,
          NIGHT_COLORS.midnightBlue,
        ]}
        locations={[0, 0.45, 1]}
        style={styles.backgroundGradient}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={true}
        >
          {/* Flush-Left Editorial Header */}
          <View style={styles.header}>
            <Text style={styles.eyebrow}>TONIGHT</Text>
            <Text style={styles.title}>Just us now</Text>
            <Text style={styles.subtitle}>
              A quiet moment before sleep.
            </Text>
          </View>

          {/* Left-Aligned Step dots */}
          {renderStepDots()}

          {/* Current element — Solid Editorial Squircle */}
          <View style={styles.widgetCard}>
            {renderRitualElement()}
          </View>

          {/* Calming Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {nightQuote}
            </Text>
          </View>
        </ScrollView>

        {/* Completion Overlay */}
        {renderCompletion()}
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

// ── Ritual Input ──────────────────────────────────────
const MAX_CHARS = 300;

const RitualInput = ({ element, onSubmit, placeholder, styles, NIGHT_COLORS }) => {
  const [response, setResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!response.trim() || isSubmitting) return;
    setIsSubmitting(true);
    await onSubmit(response);
    setIsSubmitting(false);
    setResponse('');
  };

  const remaining = MAX_CHARS - response.length;

  return (
    <View style={styles.inputContainer}>
      <TextInput
        style={styles.input}
        value={response}
        onChangeText={setResponse}
        placeholder={placeholder}
        placeholderTextColor={NIGHT_COLORS.subtext}
        multiline
        textAlignVertical="top"
        maxLength={MAX_CHARS}
        selectionColor={element.color}
      />

      {remaining <= 60 && (
        <Text style={[styles.charCount, remaining <= 20 && { color: NIGHT_COLORS.iosPink }]}>
          {remaining}
        </Text>
      )}

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={!response.trim() || isSubmitting}
        style={[
          styles.submitButton,
          (!response.trim() || isSubmitting) && styles.submitButtonDisabled,
        ]}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={element.gradient}
          style={styles.submitButtonGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Sharing…' : 'Continue'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

// ── Completed Response ───────────────────────────────
const CompletedResponse = ({ response, element, styles }) => {
  return (
    <View style={styles.completedContainer}>
      <View style={styles.completedInner}>
        <Text style={styles.completedResponse}>{response}</Text>
        <View style={styles.completedIndicator}>
          <Text style={[styles.completedIcon, { color: element.color }]}>✓</Text>
          <Text style={[styles.completedText, { color: element.color }]}>Shared</Text>
        </View>
      </View>
    </View>
  );
};

// ═══════════════════════════════════════════════════════
// Styles — Apple Editorial Dark Mode
// ═══════════════════════════════════════════════════════
const createStyles = (t) => {
  const systemFont = Platform.select({ ios: "System", android: "Roboto" });

  return StyleSheet.create({
    /* ── Layout ─────────────────────────────────── */
    container: {
      flex: 1,
    },
    loadingContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: t.deepNight,
    },
    loadingText: {
      fontSize: 16,
      fontWeight: '500',
      color: t.subtext,
      fontStyle: 'italic',
    },
    backgroundGradient: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: SPACING.xl,
      paddingTop: Platform.OS === 'ios' ? 80 : SPACING.xxxl,
      paddingBottom: SPACING.xxxl,
    },

    /* ── Header (Flush Left Apple Editorial) ────── */
    header: {
      alignItems: 'flex-start',
      marginBottom: SPACING.lg,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: '800',
      color: t.subtext,
      letterSpacing: 2,
      marginBottom: SPACING.xs,
      textTransform: 'uppercase',
    },
    title: {
      fontFamily: systemFont,
      fontSize: 38,
      fontWeight: '800',
      color: t.text,
      letterSpacing: -0.5,
      marginBottom: 4,
      lineHeight: 44,
    },
    subtitle: {
      fontSize: 16,
      fontWeight: '500',
      color: t.subtext,
      lineHeight: 24,
    },

    /* ── Step dots ──────────────────────────────── */
    stepDotsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      marginBottom: SPACING.xl,
      gap: 12,
    },
    stepDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.surfaceSecondary,
    },

    /* ── Solid Apple Widget Card ────────────────── */
    widgetCard: {
      backgroundColor: t.surface,
      borderRadius: 32,
      borderWidth: 1,
      borderColor: t.border,
      padding: 24,
      marginBottom: SPACING.xl,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.15,
          shadowRadius: 20,
        },
        android: { elevation: 6 },
      }),
    },

    /* ── Ritual element ─────────────────────────── */
    elementContainer: {
      // spacing handled by widgetCard padding
    },
    elementHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.xl,
    },
    elementIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.md,
    },
    elementIcon: {
      fontSize: 24,
    },
    elementTitleContainer: {
      flex: 1,
    },
    elementTitle: {
      fontFamily: systemFont,
      fontSize: 18,
      fontWeight: '700',
      color: t.text,
      marginBottom: 2,
      letterSpacing: -0.2,
    },
    elementDescription: {
      fontSize: 14,
      fontWeight: '500',
      color: t.subtext,
    },

    /* ── Question (Heavy Editorial Left) ────────── */
    questionContainer: {
      marginBottom: SPACING.xl,
    },
    questionText: {
      fontFamily: systemFont,
      fontSize: 28,
      fontWeight: '700',
      color: t.text,
      textAlign: 'left',
      lineHeight: 36,
      letterSpacing: -0.5,
    },

    /* ── Input ──────────────────────────────────── */
    inputContainer: {
      position: 'relative',
    },
    input: {
      backgroundColor: t.surfaceSecondary,
      borderRadius: 16,
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.lg,
      color: t.text,
      fontSize: 17,
      fontWeight: '400',
      minHeight: 120,
      borderWidth: 1,
      borderColor: t.border,
      marginBottom: SPACING.md,
    },
    charCount: {
      fontSize: 12,
      fontWeight: '600',
      color: t.subtext,
      textAlign: 'right',
      marginBottom: SPACING.sm,
      marginRight: SPACING.xs,
    },
    submitButton: {
      borderRadius: 28,
      overflow: 'hidden',
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 10 },
        android: { elevation: 4 },
      }),
    },
    submitButtonDisabled: {
      opacity: 0.4,
    },
    submitButtonGradient: {
      height: 56,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: SPACING.xl,
    },
    submitButtonText: {
      fontSize: 17,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: -0.3,
    },

    /* ── Completed response ─────────────────────── */
    completedContainer: {
      borderRadius: 20,
      overflow: 'hidden',
    },
    completedInner: {
      backgroundColor: t.surfaceSecondary,
      borderRadius: 20,
      padding: SPACING.xl,
      borderWidth: 1,
      borderColor: t.border,
    },
    completedResponse: {
      fontSize: 17,
      fontWeight: '400',
      color: t.text,
      marginBottom: SPACING.lg,
      lineHeight: 26,
    },
    completedIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    completedIcon: {
      fontSize: 14,
      fontWeight: '800',
      marginRight: SPACING.xs,
    },
    completedText: {
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    /* ── Footer ─────────────────────────────────── */
    footer: {
      marginTop: SPACING.xl,
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
    },
    footerText: {
      fontSize: 15,
      fontWeight: '500',
      color: t.subtext,
      textAlign: 'center',
      fontStyle: 'italic',
      lineHeight: 22,
    },

    /* ── Completion overlay ─────────────────────── */
    completionOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    completionModalCard: {
      borderRadius: 32,
      paddingVertical: SPACING.xxxl,
      paddingHorizontal: SPACING.xl,
      alignItems: 'center',
      marginHorizontal: SPACING.xl,
      borderWidth: 1,
      borderColor: t.border,
      width: '85%',
      overflow: 'hidden',
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 30 },
        android: { elevation: 10 },
      }),
    },
    completionIcon: {
      fontSize: 56,
      marginBottom: SPACING.lg,
    },
    completionTitle: {
      fontFamily: systemFont,
      fontSize: 30,
      fontWeight: '800',
      color: t.text,
      textAlign: 'center',
      marginBottom: SPACING.sm,
      letterSpacing: -0.5,
    },
    completionMessage: {
      fontSize: 16,
      fontWeight: '500',
      color: t.subtext,
      textAlign: 'center',
      lineHeight: 24,
      paddingHorizontal: SPACING.md,
    },
  });
};

export default NightRitualMode;
