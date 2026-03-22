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
import { RITUAL_TYPES } from '../context/RitualContext';
import { useTheme } from '../context/ThemeContext';
import { COLORS, GRADIENTS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from '../utils/theme';

// Night theme colors — aligned to Between Us brand palette
export const getNightRitualColors = (palette) => ({
  deepNight: palette.background,       // inkBlack — screen bg
  midnightBlue: palette.surface,    // charcoalPlum — card surfaces
  softPurple: palette.surface2 || palette.surface,      // surfacePlum — secondary surfaces
  elevated: palette.surfaceElevated,        // surfaceElevated — glass cards
  moonGlow: palette.text,        // softCream — primary text
  starlight: palette.textStatic || palette.text,       // creamSubtle — secondary text
  starlightDim: palette.textMuted,    // tertiary / descriptions
  wine: palette.primary,            // primary accent
  mulberry: palette.primary,        // secondary accent
  wineDeep: palette.primary,        // gradient endpoints
  wineMuted: palette.primaryGlow || palette.primary,       // subtle accent bg
  plumVignette: palette.background,    // atmospheric gradients
  gentleGold: palette.accent || '#A89060',      // premium-only highlight
  border: palette.borderGlass || 'rgba(255,255,255,0.08)',
  borderSubtle: palette.borderGlass || 'rgba(255,255,255,0.05)',
  glassBg: palette.surfaceGlass || 'rgba(28,21,32,0.55)',
  glassBgLight: palette.surfaceElevated || 'rgba(36,28,40,0.40)',
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
    color: colors.wine,
    gradient: [colors.wine, colors.wineDeep],
    description: 'A gentle question to end your day',
  },
  CHECK_IN: {
    id: 'checkIn',
    name: 'How Are You?',
    icon: '💫',
    color: colors.mulberry,
    gradient: [colors.mulberry, colors.wine],
    description: 'Share how you\'re feeling tonight',
  },
  APPRECIATION: {
    id: 'appreciation',
    name: 'Gratitude',
    icon: '✨',
    color: colors.wineMuted,
    gradient: [colors.wineMuted, colors.wineDeep],
    description: 'Something beautiful from today',
  },
  DATE_IDEA: {
    id: 'dateIdea',
    name: 'Tomorrow Together',
    icon: '🌟',
    color: colors.wine,
    gradient: [colors.wine, colors.mulberry],
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
  const ELEMENT_COUNT = Object.keys(RITUAL_ELEMENTS).length;
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
  const slideAnimation = useRef(new Animated.Value(50)).current;
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
        // Check if there's an active ritual or create new one
        let ritual = ritualState.currentRitual;

        if (!ritual) {
          try {
            ritual = await ritualActions.getRitualWithMemoryContext(memoryState);
          } catch (memoryErr) {
            // Memory context unavailable — fall back to a standard ritual
            if (__DEV__) console.warn('Memory context unavailable, using standard ritual:', memoryErr);
            try {
              ritual = await ritualActions.startNightRitual();
            } catch (startErr) {
              if (__DEV__) console.warn('startNightRitual failed, building local ritual:', startErr);
            }
          }
        }

        // Ultimate fallback — build a fully local ritual so the UI always has data
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
        
        // Load existing responses from all ritual elements
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
        
        // Animate in with calming timing
        Animated.parallel([
          Animated.timing(fadeAnimation, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnimation, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ]).start();
        
      } catch (error) {
        console.error('Failed to initialize night ritual:', error);
      }
    };
    
    initializeRitual();
  }, [ritualState.currentRitual]);

  // Update progress animation when current element changes
  useEffect(() => {
    const progress = currentElement / Object.keys(RITUAL_ELEMENTS).length;
    Animated.timing(progressAnimation, {
      toValue: progress,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [currentElement]);

  const handleElementResponse = async (elementId, response) => {
    if (!response.trim()) return;
    
    try {
      // Gentle haptic feedback
      impact(ImpactFeedbackStyle.Light);
      
      // Update responses
      const newResponses = { ...responses, [elementId]: response.trim() };
      setResponses(newResponses);
      
      // Update ritual context
      await ritualActions.updateRitualResponse(elementId, response.trim());
      
      // Callback
      if (onElementComplete) {
        onElementComplete(elementId, response.trim());
      }
      
      // Move to next element or complete ritual
      const elementKeys = Object.keys(RITUAL_ELEMENTS);
      const nextIndex = currentElement + 1;
      
      if (nextIndex < elementKeys.length) {
        // Move to next element with gentle transition
        Animated.sequence([
          Animated.timing(slideAnimation, {
            toValue: -30,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnimation, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
        
        elementTimerRef.current = setTimeout(() => setCurrentElement(nextIndex), 300);
      } else {
        // Complete ritual
        await completeRitual(newResponses);
      }
      
    } catch (error) {
      console.error('Failed to handle element response:', error);
    }
  };

  const completeRitual = async (finalResponses) => {
    setIsCompleting(true);
    
    try {
      // Complete ritual in context
      const completedRitual = await ritualActions.completeRitual();
      
      // Gentle completion haptic
      impact(ImpactFeedbackStyle.Light);
      
      // Show completion animation
      setShowCompletion(true);
      Animated.timing(completionAnimation, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
      
      // Callback
      if (onRitualComplete) {
        onRitualComplete(completedRitual, finalResponses);
      }
      
      // Auto-dismiss after showing completion
      // Note: parent screen handles navigation via onRitualComplete.
      // We keep the completion overlay visible and do NOT reset currentRitual
      // to null, which would flash the loading state.
      completionTimerRef.current = setTimeout(() => {
        setShowCompletion(false);
        setCurrentElement(0);
        setResponses({});
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
      {Object.keys(RITUAL_ELEMENTS).map((_, i) => {
        const isActive = i === currentElement;
        const isDone = i < currentElement;
        return (
          <View
            key={i}
            style={[
              styles.stepDot,
              isDone && styles.stepDotDone,
              isActive && styles.stepDotActive,
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

    // Use element.id to look up data in the ritual object
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
        {/* Element Header */}
        <View style={styles.elementHeader}>
          <View style={styles.elementIconContainer}>
            <Text style={styles.elementIcon}>{element.icon}</Text>
          </View>
          <View style={styles.elementTitleContainer}>
            <Text style={styles.elementTitle}>{element.name}</Text>
            <Text style={styles.elementDescription}>{element.description}</Text>
          </View>
        </View>

        {/* Element Question */}
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
          />
        ) : (
          <CompletedResponse
            element={element}
            response={currentResponse}
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
                outputRange: [0.8, 1],
              }),
            }],
          },
        ]}
      >
        <BlurView intensity={30} tint="dark" style={styles.completionBlur}>
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
        <Animated.Text
          style={[
            styles.loadingText,
            { opacity: fadeAnimation },
          ]}
        >
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
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.eyebrow}>TONIGHT</Text>
            <Text style={styles.title}>Just us now</Text>
            <Text style={styles.subtitle}>
              A quiet moment before sleep
            </Text>
          </View>

          {/* Step dots */}
          {renderStepDots()}

          {/* Current element — wrapped in a glass card */}
          <View style={styles.glassCard}>
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

const RitualInput = ({ element, onSubmit, placeholder }) => {
  const { colors: themeColors } = useTheme();
  const NIGHT_COLORS = useMemo(() => getNightRitualColors(themeColors), [themeColors]);
  const styles = useMemo(() => createStyles(NIGHT_COLORS), [NIGHT_COLORS]);
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
        placeholderTextColor={NIGHT_COLORS.starlightDim + '88'}
        multiline
        textAlignVertical="top"
        maxLength={MAX_CHARS}
        selectionColor={NIGHT_COLORS.mulberry}
      />

      {/* Character counter — only shows near limit */}
      {remaining <= 60 && (
        <Text
          style={[
            styles.charCount,
            remaining <= 20 && { color: NIGHT_COLORS.wine },
          ]}
        >
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
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={isSubmitting ? 'Sharing your response' : 'Continue to next step'}
      >
        <LinearGradient
          colors={element.gradient || [NIGHT_COLORS.wine, NIGHT_COLORS.wineDeep]}
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
const CompletedResponse = ({ response }) => {
  const { colors: themeColors } = useTheme();
  const NIGHT_COLORS = useMemo(() => getNightRitualColors(themeColors), [themeColors]);
  const styles = useMemo(() => createStyles(NIGHT_COLORS), [NIGHT_COLORS]);
  
  return (
    <View style={styles.completedContainer}>
      <View style={styles.completedInner}>
        <Text style={styles.completedResponse}>{response}</Text>
        <View style={styles.completedIndicator}>
          <Text style={styles.completedIcon}>✓</Text>
          <Text style={styles.completedText}>Shared</Text>
        </View>
      </View>
    </View>
  );
};

// ═══════════════════════════════════════════════════════
// Styles — Midnight-intimacy palette, gentle glass layers
// ═══════════════════════════════════════════════════════
const createStyles = (NIGHT_COLORS) => StyleSheet.create({
  /* ── Layout ─────────────────────────────────── */
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: NIGHT_COLORS.deepNight,
  },
  loadingText: {
    ...TYPOGRAPHY.body,
    color: NIGHT_COLORS.starlight,
    fontStyle: 'italic',
  },
  backgroundGradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.screen,
    paddingTop: Platform.OS === 'ios' ? 60 : SPACING.xxl,
    paddingBottom: SPACING.xxxl,
  },

  /* ── Header ─────────────────────────────────── */
  header: {
    alignItems: 'center',
    marginBottom: SPACING.section,
  },
  eyebrow: {
    ...TYPOGRAPHY.label,
    color: NIGHT_COLORS.starlightDim,
    letterSpacing: 2.5,
    marginBottom: SPACING.xs,
  },
  title: {
    ...TYPOGRAPHY.display,
    color: NIGHT_COLORS.moonGlow,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...TYPOGRAPHY.bodySecondary,
    color: NIGHT_COLORS.starlight,
    textAlign: 'center',
  },

  /* ── Step dots ──────────────────────────────── */
  stepDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.section,
    gap: 10,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: NIGHT_COLORS.softPurple,
    borderWidth: 1,
    borderColor: NIGHT_COLORS.border,
  },
  stepDotActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: NIGHT_COLORS.wine,
    borderColor: NIGHT_COLORS.mulberry,
  },
  stepDotDone: {
    backgroundColor: NIGHT_COLORS.mulberry,
    borderColor: NIGHT_COLORS.mulberry,
  },

  /* ── Glass card wrapping the active element ── */
  glassCard: {
    backgroundColor: NIGHT_COLORS.glassBg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: NIGHT_COLORS.border,
    padding: SPACING.xl,
    marginBottom: SPACING.section,
    ...Platform.select({
      ios: {
        shadowColor: '#070509',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
    }),
  },

  /* ── Ritual element ─────────────────────────── */
  elementContainer: {
    // no extra margin — glassCard handles spacing
  },
  elementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  elementIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: NIGHT_COLORS.glassBgLight,
    borderWidth: 1,
    borderColor: NIGHT_COLORS.borderSubtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  elementIcon: {
    fontSize: 22,
  },
  elementTitleContainer: {
    flex: 1,
  },
  elementTitle: {
    ...TYPOGRAPHY.h3,
    color: NIGHT_COLORS.moonGlow,
    marginBottom: 2,
  },
  elementDescription: {
    ...TYPOGRAPHY.caption,
    color: NIGHT_COLORS.starlightDim,
  },

  /* ── Question ───────────────────────────────── */
  questionContainer: {
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.sm,
  },
  questionText: {
    ...TYPOGRAPHY.h2,
    color: NIGHT_COLORS.moonGlow,
    textAlign: 'center',
    lineHeight: 36,
  },

  /* ── Input ──────────────────────────────────── */
  inputContainer: {
    position: 'relative',
  },
  input: {
    backgroundColor: NIGHT_COLORS.glassBgLight,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.lg,
    color: NIGHT_COLORS.moonGlow,
    ...TYPOGRAPHY.body,
    minHeight: 120,
    borderWidth: 1,
    borderColor: NIGHT_COLORS.border,
    marginBottom: SPACING.sm,
  },
  charCount: {
    ...TYPOGRAPHY.caption,
    color: NIGHT_COLORS.starlightDim,
    textAlign: 'right',
    marginBottom: SPACING.sm,
    marginRight: SPACING.xs,
  },
  submitButton: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  submitButtonText: {
    ...TYPOGRAPHY.button,
    color: NIGHT_COLORS.moonGlow,
    fontWeight: '600',
  },

  /* ── Completed response ─────────────────────── */
  completedContainer: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  completedInner: {
    backgroundColor: NIGHT_COLORS.glassBgLight,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: NIGHT_COLORS.border,
  },
  completedResponse: {
    ...TYPOGRAPHY.body,
    color: NIGHT_COLORS.moonGlow,
    marginBottom: SPACING.md,
    lineHeight: 24,
  },
  completedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedIcon: {
    fontSize: 14,
    marginRight: SPACING.xs,
    color: NIGHT_COLORS.mulberry,
  },
  completedText: {
    ...TYPOGRAPHY.caption,
    color: NIGHT_COLORS.mulberry,
    fontWeight: '600',
  },

  /* ── Footer ─────────────────────────────────── */
  footer: {
    marginTop: SPACING.xl,
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  footerText: {
    ...TYPOGRAPHY.bodySecondary,
    color: NIGHT_COLORS.starlight,
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.75,
    lineHeight: 22,
  },

  /* ── Completion overlay ─────────────────────── */
  completionOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(7,5,9,0.88)',
  },
  completionBlur: {
    backgroundColor: NIGHT_COLORS.glassBg,
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    marginHorizontal: SPACING.screen,
    borderWidth: 1,
    borderColor: NIGHT_COLORS.border,
    maxWidth: 340,
    width: '100%',
  },
  completionIcon: {
    fontSize: 48,
    marginBottom: SPACING.lg,
  },
  completionTitle: {
    ...TYPOGRAPHY.h1,
    color: NIGHT_COLORS.moonGlow,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  completionMessage: {
    ...TYPOGRAPHY.bodySecondary,
    color: NIGHT_COLORS.starlightDim,
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default NightRitualMode;