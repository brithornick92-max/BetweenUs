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
  Pressable,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from './Icon';
import { impact, notification, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { useRitualContext } from '../context/RitualContext';
import { useMemoryContext } from '../context/MemoryContext';
import { useTheme } from '../context/ThemeContext';
import { withAlpha } from '../utils/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Midnight Intimacy x Apple Editorial Palette
export const getNightRitualColors = (palette) => ({
  deepNight: '#050307',
  plumVignette: '#110408',
  midnightBlue: '#08080C',
  surface: 'rgba(25, 20, 30, 0.7)',
  surfaceSecondary: 'rgba(40, 35, 50, 0.5)',
  text: '#FFFFFF',
  subtext: 'rgba(255, 255, 255, 0.55)',
  border: 'rgba(255, 255, 255, 0.12)',
  primary: '#E31B23', // Lustrous Sexy Red
  iosPurple: '#7D7AFF',
  iosOrange: '#FF9F0A',
  iosCyan: '#64D2FF',
  gold: '#D4AF37',
});

const FALLBACK_QUESTIONS = {
  prompt: "What's one feeling you'd like to name before you sleep?",
  checkIn: "How is your heart feeling as this day comes to an end?",
  appreciation: "What moment today made you feel most connected to love?",
  dateIdea: "What's one gentle way we could connect tomorrow?",
};

const NIGHT_QUOTES = [
  '"Let the day go. Just us now."',
  '"The quieter you become, the more you are able to hear."',
  '"I belong deeply to myself, and then to you."',
  '"Rest now. Tomorrow is ours."',
];

const getRitualElements = (colors) => ({
  PROMPT: {
    id: 'prompt',
    name: "Tonight's Reflection",
    icon: 'moon-outline',
    color: colors.iosPurple,
    gradient: [colors.iosPurple, '#5856D6'],
    description: 'Reflect on the day',
  },
  CHECK_IN: {
    id: 'checkIn',
    name: 'Emotional Check-In',
    icon: 'heart-outline',
    color: colors.primary,
    gradient: [colors.primary, '#9F1218'],
    description: 'Pulse check',
  },
  APPRECIATION: {
    id: 'appreciation',
    name: 'Gratitude',
    icon: 'sparkles-outline',
    color: colors.gold,
    gradient: [colors.gold, '#B8860B'],
    description: 'Notice the light',
  },
  DATE_IDEA: {
    id: 'dateIdea',
    name: 'Future Connection',
    icon: 'calendar-outline',
    color: colors.iosCyan,
    gradient: [colors.iosCyan, '#007AFF'],
    description: 'Plan a moment',
  },
});

const NightRitualMode = ({ style, onRitualComplete, onElementComplete }) => {
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

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const completionAnim = useRef(new Animated.Value(0)).current;
  const nextTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const initializeRitual = async () => {
      try {
        let ritual = ritualState.currentRitual;
        if (!ritual) {
          try {
            ritual = await ritualActions.getRitualWithMemoryContext(memoryState);
          } catch {
            ritual = await ritualActions.startNightRitual();
          }
        }

        if (!ritual) {
          ritual = {
            id: `fall_${Date.now()}`,
            prompt: { question: FALLBACK_QUESTIONS.prompt },
            checkIn: { question: FALLBACK_QUESTIONS.checkIn },
            appreciation: { question: FALLBACK_QUESTIONS.appreciation },
            dateIdea: { question: FALLBACK_QUESTIONS.dateIdea },
          };
        }

        setCurrentRitual(ritual);
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.spring(slideAnim, { toValue: 0, bounciness: 4, useNativeDriver: true }),
        ]).start();
      } catch (err) {
        console.error('Failed to initialize night ritual:', err);
      }
    };
    initializeRitual();
  }, []);

  useEffect(() => {
    const progress = (currentElement + 1) / Object.keys(RITUAL_ELEMENTS).length;
    Animated.timing(progressAnim, { toValue: progress, duration: 600, useNativeDriver: false }).start();
  }, [currentElement]);

  const handleNext = async (elementId, response) => {
    impact(ImpactFeedbackStyle.Medium);
    const newResponses = { ...responses, [elementId]: response };
    setResponses(newResponses);
    await ritualActions.updateRitualResponse(elementId, response);
    if (onElementComplete) onElementComplete(elementId, response);

    if (currentElement < Object.keys(RITUAL_ELEMENTS).length - 1) {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
      nextTimerRef.current = setTimeout(() => setCurrentElement(prev => prev + 1), 200);
    } else {
      completeRitual(newResponses);
    }
  };

  const completeRitual = async (finalResponses) => {
    setIsCompleting(true);
    setShowCompletion(true);
    notification(NotificationFeedbackType.Success);
    Animated.timing(completionAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();

    try {
      const completedRitual = await ritualActions.completeRitual();
      if (onRitualComplete) onRitualComplete(completedRitual, finalResponses);
    } catch (err) {
      console.error('Failed to complete ritual:', err);
    } finally {
      setIsCompleting(false);
    }
  };

  const currentKey = Object.keys(RITUAL_ELEMENTS)[currentElement];
  const element = RITUAL_ELEMENTS[currentKey];
  const nightQuote = useRef(NIGHT_QUOTES[Math.floor(Math.random() * NIGHT_QUOTES.length)]).current;

  if (!currentRitual) return null;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[NIGHT_COLORS.deepNight, NIGHT_COLORS.plumVignette, NIGHT_COLORS.midnightBlue]}
        style={styles.backgroundGradient}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.eyebrow}>NIGHT RITUAL</Text>
            <Text style={styles.title}>Just us now.</Text>
            <View style={styles.progressContainer}>
              <Animated.View
                style={[
                  styles.progressBar,
                  {
                    width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                    backgroundColor: element.color,
                  },
                ]}
              />
            </View>
          </View>

          {/* Main Card */}
          <Animated.View style={[styles.cardContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <BlurView intensity={60} tint="dark" style={styles.velvetCard}>
              <View style={styles.elementBadge}>
                <View style={[styles.iconCircle, { backgroundColor: withAlpha(element.color, 0.2) }]}>
                  <Icon name={element.icon} size={20} color={element.color} />
                </View>
                <Text style={[styles.elementName, { color: element.color }]}>{element.name.toUpperCase()}</Text>
              </View>

              <Text style={styles.questionText}>
                {currentRitual?.[element.id]?.question || FALLBACK_QUESTIONS[element.id]}
              </Text>

              <RitualInput
                element={element}
                onNext={(val) => handleNext(element.id, val)}
                colors={NIGHT_COLORS}
                styles={styles}
              />
            </BlurView>
          </Animated.View>

          <View style={styles.footer}>
            <Text style={styles.footerQuote}>{nightQuote}</Text>
          </View>
        </ScrollView>

        {showCompletion && (
          <Animated.View style={[styles.completionOverlay, { opacity: completionAnim }]}>
            <BlurView intensity={90} tint="dark" style={styles.completionContent}>
              <Icon name="moon-outline" size={64} color={NIGHT_COLORS.primary} />
              <Text style={styles.completionTitle}>Sleep Well</Text>
              <Text style={styles.completionSubtitle}>Your heart is heard.</Text>
              <TouchableOpacity
                style={styles.doneButton}
                onPress={() => setShowCompletion(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.doneButtonText}>Close</Text>
              </TouchableOpacity>
            </BlurView>
          </Animated.View>
        )}
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

// -- Ritual Input --
const RitualInput = ({ element, onNext, colors, styles }) => {
  const [text, setText] = useState('');
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  return (
    <View style={styles.inputWrapper}>
      <TextInput
        style={styles.textInput}
        placeholder="Type your heart out..."
        placeholderTextColor={colors.subtext}
        multiline
        textAlignVertical="top"
        value={text}
        onChangeText={setText}
        selectionColor={element.color}
        maxLength={300}
      />
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onPress={() => text.trim() && onNext(text.trim())}
          disabled={!text.trim()}
          style={({ pressed }) => [{ opacity: !text.trim() ? 0.45 : pressed ? 0.9 : 1 }]}
        >
          <LinearGradient colors={element.gradient} style={styles.continueButton}>
            <Text style={styles.continueText}>Continue</Text>
            <Icon name="arrow-forward-outline" size={16} color="#FFF" />
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
};

const createStyles = (t) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  backgroundGradient: { flex: 1 },
  scrollContent: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 80 : 40,
    paddingBottom: 100,
  },
  header: { marginBottom: 40 },
  eyebrow: { color: t.primary, fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' },
  title: { color: '#FFF', fontSize: 42, fontWeight: '800', letterSpacing: -1.5 },
  progressContainer: {
    height: 4,
    width: 120,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressBar: { height: '100%', borderRadius: 2 },
  cardContainer: { width: '100%', marginBottom: 30 },
  velvetCard: {
    borderRadius: 36,
    padding: 32,
    borderWidth: 1,
    borderColor: t.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
  },
  elementBadge: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  elementName: { fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  questionText: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
    letterSpacing: -0.5,
    marginBottom: 32,
  },
  inputWrapper: { gap: 20 },
  textInput: {
    color: '#FFF',
    fontSize: 18,
    minHeight: 120,
    textAlignVertical: 'top',
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  continueButton: {
    height: 60,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  continueText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  footer: { alignItems: 'center', marginTop: 20 },
  footerQuote: {
    color: t.subtext,
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 24,
  },
  completionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  completionContent: {
    padding: 40,
    borderRadius: 40,
    alignItems: 'center',
    width: '85%',
    borderWidth: 1,
    borderColor: t.border,
    overflow: 'hidden',
  },
  completionTitle: { color: '#FFF', fontSize: 32, fontWeight: '800', marginTop: 24 },
  completionSubtitle: { color: t.subtext, fontSize: 18, marginTop: 8, marginBottom: 32 },
  doneButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  doneButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});

export default NightRitualMode;
