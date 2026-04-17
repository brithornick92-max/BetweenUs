// components/NightRitualMode.jsx
// components/NightRitualMode.jsx
/**
 * BETWEEN US - NIGHT RITUAL ENGINE (EDITORIAL V3)
 * High-End Apple Editorial Layout + Sexy Red (#D2121A)
 * Matches Home, Intimacy, Settings, and Saved Space architectures.
 */

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
import { LinearGradient } from 'expo-linear-gradient';
import Icon from './Icon';
import GlowOrb from './GlowOrb';
import FilmGrain from './FilmGrain';
import { impact, notification, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { useRitualContext } from '../context/RitualContext';
import { useMemoryContext } from '../context/MemoryContext';
import { useTheme } from '../context/ThemeContext';
import { SPACING, withAlpha } from '../utils/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });
const SERIF_FONT = Platform.select({ ios: "Georgia", android: "serif" });

const FALLBACK_QUESTIONS = {
  prompt: [
    "What's one feeling you'd like to name before you sleep?",
    "If tonight could hold one wish, what would it be?",
    "What part of today do you want to carry into tomorrow?",
    "What gentle truth do you want to sit with tonight?",
    "If you could whisper one thing to your sleeping self, what would it be?",
    "What's something small that felt big today?",
    "What are you ready to let go of before sleep?",
    "If this evening had a soundtrack, what would be playing?",
    "What's one thing you're quietly proud of from today?",
    "What would make tomorrow feel softer than today?",
    "Where in your body are you holding today's story?",
    "What's a thought that kept returning to you today?",
  ],
  checkIn: [
    "How is your heart feeling as this day comes to an end?",
    "What emotions are you carrying with you tonight?",
    "As you prepare for rest, what's on your mind?",
    "How full is your cup right now — and what would top it off?",
    "What kind of comfort are you craving right now?",
    "Is there something you wanted to say today but didn't?",
    "On a scale of cozy to restless, how do you feel?",
    "What's the heaviest thing you're carrying tonight?",
    "How did you take care of yourself today?",
    "What part of your day felt the most like 'you'?",
    "What would make right now feel a little more peaceful?",
    "What kind of energy are you bringing to bed tonight?",
  ],
  appreciation: [
    "What moment today made you feel most connected to love?",
    "What's something beautiful you noticed about us today?",
    "What quiet act of love did you witness or receive today?",
    "What made you smile about our relationship today?",
    "When did you feel most seen today?",
    "What's a comfort you find in us that you didn't expect?",
    "What recent memory of us makes you feel warm inside?",
    "What about us feels effortless right now?",
    "What's a tiny thing someone did that meant more than they realize?",
    "What's one way we've grown together that you're grateful for?",
    "What's a gift this ordinary day gave you?",
    "What's something about our routine that you secretly love?",
  ],
  dateIdea: [
    "What's one gentle way we could connect tomorrow?",
    "How could we make tomorrow feel special together?",
    "What would bring you joy to do together soon?",
    "If we had two free hours, how would you spend them with me?",
    "What's a meal we could cook together this week?",
    "What's something playful we haven't done in a while?",
    "What would a perfect lazy morning together look like?",
    "What's an activity that would make us both laugh?",
    "If tomorrow had no obligations, what would we do first?",
    "What's a conversation topic we never seem to get to?",
    "What's a skill we could learn side by side?",
    "What's one thing on your bucket list we could start planning?",
  ],
};

const pickFallback = (category) => {
  const options = FALLBACK_QUESTIONS[category];
  return options[Math.floor(Math.random() * options.length)];
};

const NIGHT_QUOTES = [
  '"Let the day go. Just us now."',
  '"The quieter you become, the more you are able to hear."',
  '"I belong deeply to myself, and then to you."',
  '"Rest now. Tomorrow is ours."',
  '"In the hush of night, the heart speaks loudest."',
  '"We don\'t have to figure it all out tonight."',
  '"Some things only make sense in the dark."',
  '"The night is not the end. It\'s the softest beginning."',
  '"Sleep is the kindest thing you can give yourself."',
  '"Stars can only shine when it\'s dark enough."',
  '"This is enough. We are enough."',
  '"Let tonight hold what tomorrow doesn\'t need to know yet."',
  '"Breathe out the day. Breathe in the quiet."',
  '"You don\'t have to carry everything into morning."',
  '"The moon doesn\'t rush the stars. Neither should we."',
  '"Even silence between us says something gentle."',
  '"Night is when the soul does its gentlest work."',
  '"Close your eyes. I\'m right here."',
  '"You made it through today. That\'s everything."',
  '"Love is the last good thought before sleep."',
  '"No alarms. No plans. Just stillness."',
  '"The best conversations happen after midnight."',
  '"Let the world wait. This moment is ours."',
  '"Tonight we rest. Tomorrow we rise together."',
];

const getRitualElements = (colors) => ({
  PROMPT: {
    id: 'prompt',
    name: "Tonight's Reflection",
    icon: 'moon-outline',
    color: colors.text,
    gradient: ['#FFFFFF', '#E5E5EA'], // Pure Apple White
    textColor: '#000000',             // Black text for stark contrast
    description: 'Reflect on the day',
  },
  CHECK_IN: {
    id: 'checkIn',
    name: 'Emotional Check-In',
    icon: 'heart-outline',
    color: colors.primary,
    gradient: [colors.primary, '#8A0B11'], // Deep Sexy Red
    textColor: '#FFFFFF',
    description: 'Pulse check',
  },
  APPRECIATION: {
    id: 'appreciation',
    name: 'Gratitude',
    icon: 'sparkles-outline',
    color: colors.accent,
    gradient: [colors.accent, '#A67C52'], // Champagne Gold
    textColor: '#FFFFFF',
    description: 'Notice the light',
  },
  DATE_IDEA: {
    id: 'dateIdea',
    name: 'Future Connection',
    icon: 'calendar-outline',
    color: colors.text,
    gradient: ['#2C2C2E', '#1C1C1E'], // Graphite / Pitch Black
    textColor: '#FFFFFF',
    description: 'Plan a moment',
  },
});

const NightRitualMode = ({ style, onRitualComplete, onElementComplete, onDismiss }) => {
  const { colors, isDark } = useTheme();
  
  // ─── THEME MAP (Forcing Dark Mode Aesthetics for Night Ritual) ───
  const t = useMemo(() => ({
    background: '#050305',
    surface: 'rgba(28, 28, 30, 0.95)', // Solid dark Apple surface
    surfaceSecondary: '#2C2C2E',
    primary: colors.primary || '#D2121A', // Sexy Red
    accent: colors.accent || '#D4AA7E',
    text: '#FFFFFF',
    subtext: 'rgba(235, 235, 245, 0.6)',
    border: 'rgba(255, 255, 255, 0.1)',
  }), [colors]);

  const styles = useMemo(() => createStyles(t), [t]);
  const RITUAL_ELEMENTS = getRitualElements(t);

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
  const ritualActionsRef = useRef(ritualActions);
  const memoryStateRef = useRef(memoryState);
  ritualActionsRef.current = ritualActions;
  memoryStateRef.current = memoryState;

  useEffect(() => {
    return () => {
      if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let entranceAnim = null;
    const initializeRitual = async () => {
      try {
        let ritual = ritualState.currentRitual;
        if (!ritual) {
          try {
            ritual = await ritualActionsRef.current.getRitualWithMemoryContext(memoryStateRef.current);
          } catch {
            ritual = await ritualActionsRef.current.startNightRitual();
          }
        }

        if (!ritual) {
          ritual = {
            id: `fall_${Date.now()}`,
            prompt: { question: pickFallback('prompt') },
            checkIn: { question: pickFallback('checkIn') },
            appreciation: { question: pickFallback('appreciation') },
            dateIdea: { question: pickFallback('dateIdea') },
          };
        }

        if (cancelled) return;
        setCurrentRitual(ritual);
        entranceAnim = Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.spring(slideAnim, { toValue: 0, bounciness: 4, useNativeDriver: true }),
        ]);
        entranceAnim.start();
      } catch (err) {
        if (__DEV__) console.error('Failed to initialize night ritual:', err);
      }
    };
    initializeRitual();
    return () => {
      cancelled = true;
      entranceAnim?.stop();
    };
  }, []);

  useEffect(() => {
    const progress = (currentElement + 1) / Object.keys(RITUAL_ELEMENTS).length;
    const anim = Animated.timing(progressAnim, { toValue: progress, duration: 600, useNativeDriver: false });
    anim.start();
    return () => anim.stop();
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
      if (__DEV__) console.error('Failed to complete ritual:', err);
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
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      <LinearGradient
        colors={['#050305', '#140A0D', '#000000']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <GlowOrb color={t.primary} size={500} top={-200} left={SCREEN_WIDTH - 200} opacity={0.15} />
      <GlowOrb color={'#FFFFFF'} size={300} top={SCREEN_HEIGHT * 0.7} left={-100} delay={1500} opacity={0.08} />
      <FilmGrain opacity={0.1} />

      {/* ── Fixed Nav Header ── */}
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={onDismiss} hitSlop={16} style={styles.iconButton}>
          <Icon name="close" size={28} color={t.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* ── Editorial Header ── */}
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

        {/* ── Solid Surface Card ── */}
        <Animated.View style={[styles.cardContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={[styles.ritualCard, getShadow(true)]}>
            <View style={styles.elementBadge}>
              <View style={[styles.iconCircle, { backgroundColor: withAlpha(element.color, 0.15) }]}>
                <Icon name={element.icon} size={20} color={element.color} />
              </View>
              <Text style={[styles.elementName, { color: element.color }]}>{element.name.toUpperCase()}</Text>
            </View>

            <Text style={styles.questionText}>
              {currentRitual?.[element.id]?.question || pickFallback(element.id)}
            </Text>

            <RitualInput
              element={element}
              onNext={(val) => handleNext(element.id, val)}
              t={t}
              styles={styles}
            />
          </View>
        </Animated.View>

        <View style={styles.footer}>
          <Text style={styles.footerQuote}>{nightQuote}</Text>
        </View>
      </ScrollView>

      {/* ── Completion Overlay ── */}
      {showCompletion && (
        <Animated.View style={[styles.completionOverlay, { opacity: completionAnim }]}>
          <View style={[styles.completionContent, getShadow(true)]}>
            <Icon name="moon-outline" size={64} color={t.primary} />
            <Text style={styles.completionTitle}>Sleep Well</Text>
            <Text style={styles.completionSubtitle}>Your heart is heard.</Text>
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => {
                impact(ImpactFeedbackStyle.Light);
                setShowCompletion(false);
                if (onDismiss) onDismiss();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.doneButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
};

// -- Ritual Input --
const RitualInput = ({ element, onNext, t, styles }) => {
  const [text, setText] = useState('');
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  return (
    <View style={styles.inputWrapper}>
      <TextInput
        style={styles.textInput}
        placeholder="Type your heart out..."
        placeholderTextColor={t.subtext}
        multiline
        textAlignVertical="top"
        value={text}
        onChangeText={setText}
        selectionColor={element.color === '#FFFFFF' ? t.primary : element.color}
        maxLength={300}
      />
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onPress={() => {
            if (text.trim()) {
              impact(ImpactFeedbackStyle.Light);
              onNext(text.trim());
            }
          }}
          disabled={!text.trim()}
          style={({ pressed }) => [{ opacity: !text.trim() ? 0.45 : pressed ? 0.9 : 1 }]}
        >
          <LinearGradient colors={element.gradient} style={styles.continueButton}>
            <Text style={[styles.continueText, { color: element.textColor }]}>Continue</Text>
            <Icon name="arrow-forward-outline" size={20} color={element.textColor} />
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
};

// ─── HIGH-END DESIGN SYSTEM STYLES ───
const getShadow = (isDark) => Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: isDark ? 0.4 : 0.08, shadowRadius: 24 },
  android: { elevation: 6 },
});

const createStyles = (t) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  
  // ── Fixed Nav Header ──
  navHeader: {
    paddingHorizontal: SPACING.screen || 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 4,
    flexDirection: 'row',
    zIndex: 10,
  },
  iconButton: {
    padding: 8,
    marginLeft: -8,
  },

  scrollContent: {
    paddingHorizontal: SPACING.screen || 24,
    paddingBottom: 100,
  },
  header: { marginBottom: SPACING.xl || 32, marginTop: SPACING.md || 16 },
  eyebrow: { 
    fontFamily: SYSTEM_FONT,
    color: t.primary, 
    fontSize: 12, 
    fontWeight: '800', 
    letterSpacing: 2, 
    marginBottom: 8, 
    textTransform: 'uppercase' 
  },
  title: { 
    fontFamily: SERIF_FONT,
    color: t.text, 
    fontSize: 42, 
    lineHeight: 48,
    letterSpacing: -0.5,
  },
  progressContainer: {
    height: 4,
    width: 120,
    backgroundColor: t.border,
    borderRadius: 2,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressBar: { height: '100%', borderRadius: 2 },
  
  cardContainer: { width: '100%', marginBottom: 30 },
  ritualCard: {
    borderRadius: 24, // Deep squircle
    padding: SPACING.xl || 24,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
  },
  elementBadge: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  elementName: { 
    fontFamily: SYSTEM_FONT,
    fontSize: 13, 
    fontWeight: '800', 
    letterSpacing: 1 
  },
  questionText: {
    fontFamily: SYSTEM_FONT,
    color: t.text,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    letterSpacing: -0.5,
    marginBottom: 36,
  },
  inputWrapper: { gap: 24 },
  textInput: {
    fontFamily: SYSTEM_FONT,
    color: t.text,
    fontSize: 17,
    lineHeight: 24,
    minHeight: 140,
    textAlignVertical: 'top',
    padding: SPACING.lg || 24,
    backgroundColor: t.surfaceSecondary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: t.border,
  },
  continueButton: {
    height: 56, // Apple standard height
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  continueText: { 
    fontFamily: SYSTEM_FONT,
    fontSize: 17, 
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  footer: { alignItems: 'center', marginTop: 24 },
  footerQuote: {
    fontFamily: SYSTEM_FONT,
    color: t.subtext,
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 24,
  },

  // ── Completion Overlay ──
  completionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 3, 5, 0.95)', // Nearly opaque ink
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    paddingHorizontal: SPACING.screen || 24,
  },
  completionContent: {
    padding: 40,
    borderRadius: 32,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
  },
  completionTitle: { 
    fontFamily: SERIF_FONT,
    color: t.text, 
    fontSize: 36, 
    marginTop: 24,
    letterSpacing: -0.5,
  },
  completionSubtitle: { 
    fontFamily: SYSTEM_FONT,
    color: t.subtext, 
    fontSize: 16, 
    marginTop: 8, 
    marginBottom: 36,
    fontWeight: '500', 
  },
  doneButton: {
    height: 56,
    width: '100%',
    borderRadius: 28,
    backgroundColor: t.surfaceSecondary,
    borderWidth: 1,
    borderColor: t.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: { 
    fontFamily: SYSTEM_FONT,
    color: t.text, 
    fontSize: 17, 
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});

export default NightRitualMode;
