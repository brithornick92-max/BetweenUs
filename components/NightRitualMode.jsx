// components/NightRitualMode.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAppContext } from '../context/AppContext';
import { useRitualContext } from '../context/RitualContext';
import { useMemoryContext } from '../context/MemoryContext';
import { RITUAL_TYPES } from '../context/RitualContext';
import { COLORS, GRADIENTS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from '../utils/theme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Night theme colors - calming and intimate
export const NIGHT_COLORS = {
  deepNight: '#0A0A0F',
  midnightBlue: '#1A1A2E',
  softPurple: '#16213E',
  moonGlow: '#E8E8F0',
  starlight: '#C7C7D1',
  dreamyPink: '#E6B3C7',
  calmLavender: '#B8A9C9',
  gentleGold: '#D4C5A9',
  whisperBlue: '#A8B5C8',
  text: '#E8E8F0',
  textSecondary: '#C7C7D1',
};

// Night ritual structure - 4 elements as per requirements
const RITUAL_ELEMENTS = {
  PROMPT: {
    id: 'prompt',
    name: 'Tonight\'s Reflection',
    icon: '🌙',
    color: NIGHT_COLORS.dreamyPink,
    gradient: [NIGHT_COLORS.dreamyPink, NIGHT_COLORS.calmLavender],
    description: 'A gentle question to end your day',
  },
  CHECK_IN: {
    id: 'checkIn',
    name: 'How Are You?',
    icon: '💫',
    color: NIGHT_COLORS.whisperBlue,
    gradient: [NIGHT_COLORS.whisperBlue, NIGHT_COLORS.softPurple],
    description: 'Share how you\'re feeling tonight',
  },
  APPRECIATION: {
    id: 'appreciation',
    name: 'Gratitude',
    icon: '✨',
    color: NIGHT_COLORS.gentleGold,
    gradient: [NIGHT_COLORS.gentleGold, NIGHT_COLORS.moonGlow],
    description: 'Something beautiful from today',
  },
  DATE_IDEA: {
    id: 'dateIdea',
    name: 'Tomorrow Together',
    icon: '🌟',
    color: NIGHT_COLORS.calmLavender,
    gradient: [NIGHT_COLORS.calmLavender, NIGHT_COLORS.dreamyPink],
    description: 'A way to connect tomorrow',
  },
};

const NightRitualMode = ({
  style,
  onRitualComplete,
  onElementComplete,
  compact = false,
}) => {
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

  // Initialize ritual on mount
  useEffect(() => {
    const initializeRitual = async () => {
      try {
        // Check if there's an active ritual or create new one
        let ritual = ritualState.currentRitual;
        
        if (!ritual) {
          // Create new ritual with memory context
          ritual = await ritualActions.getRitualWithMemoryContext(memoryState);
        }
        
        setCurrentRitual(ritual);
        
        // Load existing responses
        if (ritual.checkIn?.userAnswer) {
          setResponses(prev => ({ ...prev, checkIn: ritual.checkIn.userAnswer }));
        }
        if (ritual.appreciation?.userAnswer) {
          setResponses(prev => ({ ...prev, appreciation: ritual.appreciation.userAnswer }));
        }
        if (ritual.dateIdea?.userAnswer) {
          setResponses(prev => ({ ...prev, dateIdea: ritual.dateIdea.userAnswer }));
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
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
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
        
        setTimeout(() => setCurrentElement(nextIndex), 300);
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
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
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
      setTimeout(() => {
        setShowCompletion(false);
        setCurrentElement(0);
        setResponses({});
        setCurrentRitual(null);
      }, 3000);
      
    } catch (error) {
      console.error('Failed to complete ritual:', error);
    } finally {
      setIsCompleting(false);
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressTrack}>
        <Animated.View 
          style={[
            styles.progressFill,
            {
              width: progressAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
      <Text style={styles.progressText}>
        {currentElement + 1} of {Object.keys(RITUAL_ELEMENTS).length}
      </Text>
    </View>
  );

  const renderRitualElement = () => {
    const elementKeys = Object.keys(RITUAL_ELEMENTS);
    const elementKey = elementKeys[currentElement];
    const element = RITUAL_ELEMENTS[elementKey];
    
    if (!element) return null;

    const currentResponse = responses[elementKey] || '';
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
            {currentRitual?.[elementKey]?.question || 'Loading...'}
          </Text>
        </View>

        {/* Response Input */}
        {!isCompleted ? (
          <RitualInput
            element={element}
            onSubmit={(response) => handleElementResponse(elementKey, response)}
            placeholder={getPlaceholderForElement(elementKey)}
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
        <BlurView intensity={20} style={styles.completionBlur}>
          <Text style={styles.completionIcon}>🌙</Text>
          <Text style={styles.completionTitle}>Sweet Dreams</Text>
          <Text style={styles.completionMessage}>
            Your ritual is complete. Rest well, knowing you've connected with your heart tonight.
          </Text>
        </BlurView>
      </Animated.View>
    );
  };

  const getPlaceholderForElement = (elementKey) => {
    const placeholders = {
      checkIn: 'How are you feeling tonight?',
      appreciation: 'What brought you joy today?',
      dateIdea: 'How could we connect tomorrow?',
    };
    return placeholders[elementKey] || 'Share your thoughts...';
  };

  if (!currentRitual) {
    return (
      <View style={[styles.container, styles.loadingContainer, style]}>
        <Text style={styles.loadingText}>Preparing your night ritual...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={[NIGHT_COLORS.deepNight, NIGHT_COLORS.midnightBlue, NIGHT_COLORS.softPurple]}
        style={styles.backgroundGradient}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Tonight</Text>
            <Text style={styles.subtitle}>A moment of connection before sleep</Text>
          </View>

          {/* Progress */}
          {renderProgressBar()}

          {/* Current Element */}
          {renderRitualElement()}

          {/* Calming Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              "The quieter you become, the more you are able to hear." — Rumi
            </Text>
          </View>
        </ScrollView>

        {/* Completion Overlay */}
        {renderCompletion()}
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

// Ritual Input Component
const RitualInput = ({ element, onSubmit, placeholder }) => {
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
        style={styles.input}
        value={response}
        onChangeText={setResponse}
        placeholder={placeholder}
        placeholderTextColor={NIGHT_COLORS.starlight + '60'}
        multiline
        textAlignVertical="top"
        maxLength={300}
      />
      
      <TouchableOpacity
        onPress={handleSubmit}
        disabled={!response.trim() || isSubmitting}
        style={[
          styles.submitButton,
          (!response.trim() || isSubmitting) && styles.submitButtonDisabled
        ]}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={element.gradient}
          style={styles.submitButtonGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Sharing...' : 'Continue'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

// Completed Response Component
const CompletedResponse = ({ element, response }) => (
  <View style={styles.completedContainer}>
    <BlurView intensity={10} style={styles.completedBlur}>
      <Text style={styles.completedResponse}>{response}</Text>
      <View style={styles.completedIndicator}>
        <Text style={styles.completedIcon}>✓</Text>
        <Text style={styles.completedText}>Shared</Text>
      </View>
    </BlurView>
  </View>
);

const styles = StyleSheet.create({
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
    color: NIGHT_COLORS.moonGlow,
  },
  
  backgroundGradient: {
    flex: 1,
  },
  
  scrollView: {
    flex: 1,
  },
  
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
  },
  
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  
  title: {
    ...TYPOGRAPHY.h1,
    color: NIGHT_COLORS.moonGlow,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  
  subtitle: {
    ...TYPOGRAPHY.body,
    color: NIGHT_COLORS.starlight,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  
  progressContainer: {
    marginBottom: SPACING.xl,
  },
  
  progressTrack: {
    height: 4,
    backgroundColor: NIGHT_COLORS.softPurple,
    borderRadius: 2,
    marginBottom: SPACING.sm,
  },
  
  progressFill: {
    height: '100%',
    backgroundColor: NIGHT_COLORS.dreamyPink,
    borderRadius: 2,
  },
  
  progressText: {
    ...TYPOGRAPHY.caption,
    color: NIGHT_COLORS.starlight,
    textAlign: 'center',
  },
  
  elementContainer: {
    marginBottom: SPACING.xl,
  },
  
  elementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  
  elementIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: NIGHT_COLORS.softPurple + '40',
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
    ...TYPOGRAPHY.h2,
    color: NIGHT_COLORS.moonGlow,
    marginBottom: SPACING.xs,
  },
  
  elementDescription: {
    ...TYPOGRAPHY.body,
    color: NIGHT_COLORS.starlight,
    opacity: 0.8,
  },
  
  questionContainer: {
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  
  questionText: {
    ...TYPOGRAPHY.h3,
    color: NIGHT_COLORS.moonGlow,
    textAlign: 'center',
    lineHeight: 28,
  },
  
  inputContainer: {
    // Input container styling
  },
  
  input: {
    backgroundColor: NIGHT_COLORS.softPurple + '30',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    color: NIGHT_COLORS.moonGlow,
    ...TYPOGRAPHY.body,
    minHeight: 100,
    borderWidth: 0.5,
    borderColor: NIGHT_COLORS.dreamyPink + '30',
    marginBottom: SPACING.lg,
  },
  
  submitButton: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  
  submitButtonDisabled: {
    opacity: 0.5,
  },
  
  submitButtonGradient: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  
  submitButtonText: {
    ...TYPOGRAPHY.button,
    color: NIGHT_COLORS.deepNight,
    fontWeight: '600',
  },
  
  completedContainer: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  
  completedBlur: {
    backgroundColor: NIGHT_COLORS.softPurple + '20',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 0.5,
    borderColor: NIGHT_COLORS.dreamyPink + '30',
  },
  
  completedResponse: {
    ...TYPOGRAPHY.body,
    color: NIGHT_COLORS.moonGlow,
    marginBottom: SPACING.md,
    lineHeight: 22,
  },
  
  completedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  completedIcon: {
    fontSize: 16,
    marginRight: SPACING.xs,
    color: NIGHT_COLORS.gentleGold,
  },
  
  completedText: {
    ...TYPOGRAPHY.caption,
    color: NIGHT_COLORS.gentleGold,
    fontWeight: '600',
  },
  
  footer: {
    marginTop: SPACING.xxl,
    paddingTop: SPACING.xl,
    borderTopWidth: 0.5,
    borderTopColor: NIGHT_COLORS.softPurple + '40',
    alignItems: 'center',
  },
  
  footerText: {
    ...TYPOGRAPHY.pullQuote,
    color: NIGHT_COLORS.starlight,
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.8,
  },
  
  completionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: NIGHT_COLORS.deepNight + '90',
  },
  
  completionBlur: {
    backgroundColor: NIGHT_COLORS.softPurple + '20',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xxl,
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    borderWidth: 0.5,
    borderColor: NIGHT_COLORS.dreamyPink + '30',
  },
  
  completionIcon: {
    fontSize: 48,
    marginBottom: SPACING.lg,
  },
  
  completionTitle: {
    ...TYPOGRAPHY.h1,
    color: NIGHT_COLORS.moonGlow,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  
  completionMessage: {
    ...TYPOGRAPHY.body,
    color: NIGHT_COLORS.starlight,
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default NightRitualMode;