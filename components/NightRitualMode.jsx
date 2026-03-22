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
  StatusBar,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from './Icon';
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { useAppContext } from '../context/AppContext';
import { useRitualContext } from '../context/RitualContext';
import { useMemoryContext } from '../context/MemoryContext';
import { useTheme } from '../context/ThemeContext';
import { SPACING, withAlpha } from '../utils/theme';

// Midnight Intimacy x Apple Editorial Palette (Forced Dark for Night Ritual)
export const getNightRitualColors = (palette) => ({
  deepNight: '#070509',
  plumVignette: '#120206', // Subtle sexy red vignette
  midnightBlue: '#0A0003',
  surface: '#131016',
  surfaceSecondary: '#1C1520',
  text: '#F2E9E6',
  subtext: 'rgba(242,233,230,0.6)',
  border: 'rgba(255,255,255,0.08)',
  // Vibrant Intimate Accents
  primary: '#C3113D', // Sexy Red
  iosPurple: '#5E5CE6',
  iosOrange: '#FF9F0A',
  iosCyan: '#64D2FF',
  gold: '#A89060',
});

// Inline fallback questions
const FALLBACK_QUESTIONS = {
  prompt: "What’s one feeling you’d like to name before you sleep?",
  checkIn: "How is your heart feeling as this day comes to an end?",
  appreciation: "What moment today made you feel most connected to love?",
  dateIdea: "What’s one gentle way we could connect tomorrow?",
};

// Gentle footer quotes
const NIGHT_QUOTES = [
  '"Let the day go. Just us now."',
  '"The quieter you become, the more you are able to hear." — Rumi',
  '"I belong deeply to myself, and then to you." — Warsan Shire',
  '"In the silence between us, something is always growing."',
  '"Love is not breathlessness… it is the quiet understanding."',
  '"Rest now. Tomorrow is ours."',
  '"And in the end, the love you take is equal to the love you make."',
];

// Night ritual structure
const getRitualElements = (colors) => ({
  PROMPT: {
    id: 'prompt',
    name: 'Tonight\'s Reflection',
    icon: 'moon-outline',
    color: colors.iosPurple,
    gradient: [colors.iosPurple, '#3F3E9E'],
    description: 'A gentle question to end your day',
  },
  CHECK_IN: {
    id: 'checkIn',
    name: 'How Are You?',
    icon: 'heart-outline',
    color: colors.primary, // Sexy Red
    gradient: [colors.primary, '#9A0D30'],
    description: 'Share how you\'re feeling tonight',
  },
  APPRECIATION: {
    id: 'appreciation',
    name: 'Gratitude',
    icon: 'sparkles-outline',
    color: colors.gold,
    gradient: [colors.gold, '#8B7340'],
    description: 'Something beautiful from today',
  },
  DATE_IDEA: {
    id: 'dateIdea',
    name: 'Tomorrow Together',
    icon: 'calendar-outline',
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
  
  const { state: ritualState, actions: ritualActions } = useRitualContext();
  const { state: memoryState } = useMemoryContext();
  
  const [currentRitual, setCurrentRitual] = useState(null);
  const [currentElement, setCurrentElement] = useState(0);
  const [responses, setResponses] = useState({});
  const [isCompleting, setIsCompleting] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(40)).current;
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const completionAnimation = useRef(new Animated.Value(0)).current;
  const elementTimerRef = useRef(null);
  const completionTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (elementTimerRef.current) clearTimeout(elementTimerRef.current);
      if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const initializeRitual = async () => {
      try {
        let ritual = ritualState.currentRitual;

        if (!ritual) {
          try {
            ritual = await ritualActions.getRitualWithMemoryContext(memoryState);
          } catch (err) {
            ritual = await ritualActions.startNightRitual();
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
        
        Animated.parallel([
          Animated.timing(fadeAnimation, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(slideAnimation, { toValue: 0, friction: 9, tension: 50, useNativeDriver: true }),
        ]).start();
        
      } catch (error) {
        console.error('Failed to initialize night ritual:', error);
      }
    };
    
    initializeRitual();
  }, [ritualState.currentRitual]);

  useEffect(() => {
    const progress = currentElement / Object.keys(RITUAL_ELEMENTS).length;
    Animated.spring(progressAnimation, { toValue: progress, friction: 8, tension: 50, useNativeDriver: false }).start();
  }, [currentElement]);

  const handleElementResponse = async (elementId, response) => {
    if (!response.trim()) return;
    
    try {
      impact(ImpactFeedbackStyle.Light);
      const newResponses = { ...responses, [elementId]: response.trim() };
      setResponses(newResponses);
      await ritualActions.updateRitualResponse(elementId, response.trim());
      
      if (onElementComplete) onElementComplete(elementId, response.trim());
      
      const elementKeys = Object.keys(RITUAL_ELEMENTS);
      const nextIndex = currentElement + 1;
      
      if (nextIndex < elementKeys.length) {
        Animated.sequence([
          Animated.timing(slideAnimation, { toValue: -20, duration: 250, useNativeDriver: true }),
          Animated.spring(slideAnimation, { toValue: 0, friction: 9, tension: 60, useNativeDriver: true }),
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
      impact(ImpactFeedbackStyle.Medium);
      setShowCompletion(true);
      Animated.spring(completionAnimation, { toValue: 1, friction: 8, tension: 50, useNativeDriver: true }).start();
      
      if (onRitualComplete) onRitualComplete(completedRitual, finalResponses);
      
      completionTimerRef.current = setTimeout(() => {
        Animated.timing(completionAnimation, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
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

  const nightQuote = useRef(NIGHT_QUOTES[Math.floor(Math.random() * NIGHT_QUOTES.length)]).current;

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
              isDone && { backgroundColor: color },
              isActive && { backgroundColor: color, transform: [{ scale: 1.4 }] },
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
      <Animated.View style={[styles.elementContainer, { opacity: fadeAnimation, transform: [{ translateY: slideAnimation }] }]}>
        <View style={styles.elementHeader}>
          <View style={[styles.elementIconContainer, { backgroundColor: withAlpha(element.color, 0.15) }]}>
            <Icon name={element.icon} size={22} color={element.color} />
          </View>
          <View style={styles.elementTitleContainer}>
            <Text style={[styles.elementTitle, { color: NIGHT_COLORS.text }]}>{element.name}</Text>
            <Text style={styles.elementDescription}>{element.description}</Text>
          </View>
        </View>

        <View style={styles.questionContainer}>
          <Text style={[styles.questionText, { color: NIGHT_COLORS.text }]}>
            {currentRitual?.[elementId]?.question || FALLBACK_QUESTIONS[elementId]}
          </Text>
        </View>

        {!isCompleted ? (
          <RitualInput
            element={element}
            onSubmit={(response) => handleElementResponse(elementId, response)}
            placeholder={getPlaceholderForElement(elementId)}
            styles={styles}
            NIGHT_COLORS={NIGHT_COLORS}
          />
        ) : (
          <CompletedResponse element={element} response={currentResponse} styles={styles} />
        )}
      </Animated.View>
    );
  };

  const renderCompletion = () => {
    if (!showCompletion) return null;
    return (
      <Animated.View style={[styles.completionOverlay, { opacity: completionAnimation }]}>
        <BlurView intensity={40} tint="dark" style={styles.completionModalCard}>
          <Icon name="moon-outline" size={56} color={NIGHT_COLORS.primary} />
          <Text style={[styles.completionTitle, { color: NIGHT_COLORS.text }]}>Rest well</Text>
          <Text style={styles.completionMessage}>You showed up tonight. That’s what matters.</Text>
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

  if (!currentRitual) return null;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[NIGHT_COLORS.deepNight, NIGHT_COLORS.plumVignette, NIGHT_COLORS.midnightBlue]} style={styles.backgroundGradient}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.eyebrow}>TONIGHT</Text>
            <Text style={[styles.title, { color: NIGHT_COLORS.text }]}>Just us now</Text>
            <Text style={styles.subtitle}>A quiet moment before sleep.</Text>
          </View>

          {renderStepDots()}

          <View style={styles.widgetCard}>
            {renderRitualElement()}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{nightQuote}</Text>
          </View>
        </ScrollView>
        {renderCompletion()}
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

// ── Ritual Input ──────────────────────────────────────
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
  return (
    <View style={styles.inputContainer}>
      <TextInput
        style={[styles.input, { color: NIGHT_COLORS.text, borderColor: NIGHT_COLORS.border }]}
        value={response}
        onChangeText={setResponse}
        placeholder={placeholder}
        placeholderTextColor={NIGHT_COLORS.subtext}
        multiline
        textAlignVertical="top"
        maxLength={300}
        selectionColor={element.color}
      />
      <TouchableOpacity onPress={handleSubmit} disabled={!response.trim() || isSubmitting} style={[styles.submitButton, !response.trim() && { opacity: 0.5 }]} activeOpacity={0.85}>
        <LinearGradient colors={element.gradient} style={styles.submitButtonGradient}>
          <Text style={styles.submitButtonText}>{isSubmitting ? 'Sharing…' : 'Continue'}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

// ── Completed Response ───────────────────────────────
const CompletedResponse = ({ response, element, styles }) => (
  <View style={styles.completedInner}>
    <Text style={styles.completedResponse}>{response}</Text>
    <View style={styles.completedIndicator}>
      <Icon name="checkmark-circle-outline" size={16} color={element.color} />
      <Text style={[styles.completedText, { color: element.color }]}>Shared</Text>
    </View>
  </View>
);

const createStyles = (t) => {
  const systemFont = Platform.select({ ios: "System", android: "Roboto" });
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.deepNight },
    backgroundGradient: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: SPACING.screen, paddingTop: Platform.OS === 'ios' ? 80 : 40, paddingBottom: 100 },
    header: { alignItems: 'flex-start', marginBottom: SPACING.lg },
    eyebrow: { fontSize: 12, fontWeight: '800', color: t.primary, letterSpacing: 2, marginBottom: 4, textTransform: 'uppercase' },
    title: { fontFamily: systemFont, fontSize: 38, fontWeight: '800', letterSpacing: -0.5, lineHeight: 44 },
    subtitle: { fontSize: 16, fontWeight: '500', color: t.subtext, lineHeight: 24 },
    stepDotsRow: { flexDirection: 'row', gap: 12, marginBottom: SPACING.xl },
    stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.surfaceSecondary },
    widgetCard: { backgroundColor: t.surface, borderRadius: 32, borderWidth: 1, borderColor: t.border, padding: 24, marginBottom: SPACING.xl },
    elementHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xl },
    elementIconContainer: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    elementTitleContainer: { flex: 1 },
    elementTitle: { fontFamily: systemFont, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
    elementDescription: { fontSize: 13, fontWeight: '500', color: t.subtext, marginTop: 1 },
    questionContainer: { marginBottom: SPACING.xl },
    questionText: { fontFamily: systemFont, fontSize: 28, fontWeight: '800', lineHeight: 34, letterSpacing: -0.5 },
    inputContainer: { position: 'relative' },
    input: { backgroundColor: t.surfaceSecondary, borderRadius: 20, padding: 20, fontSize: 17, minHeight: 140, borderWidth: 1, marginBottom: 20 },
    submitButton: { borderRadius: 28, overflow: 'hidden' },
    submitButtonGradient: { height: 56, justifyContent: 'center', alignItems: 'center' },
    submitButtonText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 },
    completedInner: { backgroundColor: t.surfaceSecondary, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: t.border },
    completedResponse: { fontSize: 17, fontWeight: '400', color: t.text, marginBottom: 16, lineHeight: 26 },
    completedIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    completedText: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    footer: { marginTop: 20, alignItems: 'center', paddingHorizontal: 20 },
    footerText: { fontSize: 15, fontWeight: '500', color: t.subtext, textAlign: 'center', fontStyle: 'italic' },
    completionOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.85)' },
    completionModalCard: { borderRadius: 32, padding: 40, alignItems: 'center', width: '85%', borderWidth: 1, borderColor: t.border, overflow: 'hidden' },
    completionTitle: { fontFamily: systemFont, fontSize: 28, fontWeight: '800', marginTop: 20, marginBottom: 8 },
    completionMessage: { fontSize: 16, fontWeight: '500', color: t.subtext, textAlign: 'center', lineHeight: 22 },
  });
};

export default NightRitualMode;
