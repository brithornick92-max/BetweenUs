// components/EditorialPrompt.jsx
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
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAppContext } from '../context/AppContext';
import { useMemoryContext } from '../context/MemoryContext';
import { storage, STORAGE_KEYS } from '../utils/storage';
// NOTE: promptSync module not yet implemented — stubbed to prevent crash
const promptSyncService = {
  syncPromptAnswer: async () => ({ success: true }),
  onPartnerAnswer: () => () => {},
  getSharedPrompt: async () => null,
};
import { COLORS, GRADIENTS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from '../utils/theme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Editorial prompt categories and themes
const PROMPT_CATEGORIES = {
  REFLECTION: {
    id: 'reflection',
    name: 'Daily Reflection',
    icon: '💭',
    color: COLORS.deepPlum,
    gradient: [COLORS.deepPlum, COLORS.charcoal],
  },
  GRATITUDE: {
    id: 'gratitude',
    name: 'Gratitude',
    icon: '🙏',
    color: COLORS.mutedGold,
    gradient: GRADIENTS.goldShimmer,
  },
  DREAMS: {
    id: 'dreams',
    name: 'Dreams & Future',
    icon: '✨',
    color: COLORS.blushRose,
    gradient: GRADIENTS.roseDepth,
  },
  INTIMACY: {
    id: 'intimacy',
    name: 'Intimacy',
    icon: '💕',
    color: COLORS.deepRed,
    gradient: [COLORS.deepRed, COLORS.beetroot],
  },
  PLAYFUL: {
    id: 'playful',
    name: 'Playful',
    icon: '😄',
    color: COLORS.champagneGold,
    gradient: [COLORS.champagneGold, COLORS.mutedGold],
  },
  DAILY_LIFE: {
    id: 'daily_life',
    name: 'Daily Life',
    icon: '☀️',
    color: COLORS.mutedGold,
    gradient: [COLORS.mutedGold, COLORS.champagneGold],
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
    "What's one way you'd like to surprise your partner this year?",
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
  const { state: appState } = useAppContext();
  const { state: memoryState } = useMemoryContext();
  
  const [currentPrompt, setCurrentPrompt] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [partnerAnswer, setPartnerAnswer] = useState('');
  const [isPartnerAnswerRevealed, setIsPartnerAnswerRevealed] = useState(false);
  const [hasUserSubmitted, setHasUserSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [promptCategory, setPromptCategory] = useState(PROMPT_CATEGORIES[category]);
  
  // Animation values
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const blurAnimation = useRef(new Animated.Value(20)).current;
  const revealAnimation = useRef(new Animated.Value(0)).current;
  const submitAnimation = useRef(new Animated.Value(1)).current;

  // Load or generate prompt on mount
  useEffect(() => {
    const loadPrompt = async () => {
      try {
        let prompt;
        
        if (promptId) {
          // Load specific prompt with privacy controls
          prompt = await promptSyncService.getPromptWithPrivacy(promptId);
        }
        
        if (!prompt) {
          // Generate new prompt
          prompt = await generateDailyPrompt(category);
        }
        
        setCurrentPrompt(prompt);
        setPromptCategory(PROMPT_CATEGORIES[prompt.category] || PROMPT_CATEGORIES.REFLECTION);
        
        // Load existing answers
        if (prompt.userAnswer) {
          setUserAnswer(prompt.userAnswer);
          setHasUserSubmitted(true);
        }
        
        if (prompt.partnerAnswer && prompt.partnerAnswer !== '[HIDDEN]') {
          setPartnerAnswer(prompt.partnerAnswer);
          if (prompt.isRevealed) {
            setIsPartnerAnswerRevealed(true);
          }
        } else if (prompt.hasPartnerAnswer) {
          // Partner has answered but it's hidden
          setPartnerAnswer('Partner has shared their reflection...');
        }
        
        // Animate in
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
    
    // Set up sync listeners
    const unsubscribe = promptSyncService.addListener((event, data) => {
      switch (event) {
        case 'partner_answer_received':
          if (data.promptId === currentPrompt?.id) {
            if (data.canReveal) {
              setPartnerAnswer(data.partnerAnswer);
              setTimeout(() => revealPartnerAnswer(), 400);
            } else {
              setPartnerAnswer('Partner has shared their reflection...');
            }
          }
          break;
        case 'partner_answer_revealed':
          if (data.promptId === currentPrompt?.id) {
            setIsPartnerAnswerRevealed(true);
          }
          break;
        case 'answer_synced':
          // Handle successful sync
          break;
      }
    });
    
    return unsubscribe;
  }, [promptId, category, currentPrompt?.id]);

  const generateDailyPrompt = async (categoryId) => {
    const today = new Date().toISOString().split('T')[0];
    const prompts = EDITORIAL_PROMPTS[categoryId] || EDITORIAL_PROMPTS.reflection;
    
    // Use date as seed for consistent daily prompt
    const dateHash = today.split('-').reduce((acc, val) => acc + parseInt(val), 0);
    const promptIndex = dateHash % prompts.length;
    
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
    
    // Store prompt
    const storedPrompts = await storage.get(STORAGE_KEYS.EDITORIAL_PROMPTS) || {};
    storedPrompts[prompt.id] = prompt;
    await storage.set(STORAGE_KEYS.EDITORIAL_PROMPTS, storedPrompts);
    
    return prompt;
  };

  const handleAnswerSubmit = async () => {
    if (!userAnswer.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      // Haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Submit animation
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
      
      // Submit answer through sync service
      const result = await promptSyncService.submitAnswer(
        currentPrompt.id,
        userAnswer.trim(),
        appState.userId
      );
      
      setHasUserSubmitted(true);
      
      // If partner has already answered, their answer will be revealed automatically
      // by the sync service listener
      
      // Callback
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
    if (!partnerAnswer || isPartnerAnswerRevealed) return;
    
    try {
      // Use sync service to reveal answer with proper privacy controls
      await promptSyncService.revealPartnerAnswer(currentPrompt.id);
      
      // Haptic feedback for reveal
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Reveal animation with 400ms timing as per requirements
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
      
      // Callback
      if (onPartnerAnswerRevealed) {
        onPartnerAnswerRevealed(currentPrompt, partnerAnswer);
      }
      
    } catch (error) {
      console.error('Failed to reveal partner answer:', error);
    }
  };

  const renderPromptHeader = () => (
    <View style={styles.promptHeader}>
      <View style={styles.categoryContainer}>
        <Text style={styles.categoryIcon}>{promptCategory.icon}</Text>
        <Text style={styles.categoryName}>{promptCategory.name}</Text>
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
      <Text style={styles.answerLabel}>Your Reflection</Text>
      
      {hasUserSubmitted ? (
        <View style={styles.submittedAnswer}>
          <BlurView intensity={5} style={styles.submittedAnswerBlur}>
            <Text style={styles.submittedAnswerText}>{userAnswer}</Text>
            <Text style={styles.submittedTimestamp}>
              Submitted {currentPrompt?.userSubmittedAt ? 
                new Date(currentPrompt.userSubmittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
                'just now'
              }
            </Text>
          </BlurView>
        </View>
      ) : (
        <View style={styles.answerInputContainer}>
          <TextInput
            style={styles.answerInput}
            value={userAnswer}
            onChangeText={setUserAnswer}
            placeholder="Share your thoughts..."
            placeholderTextColor={COLORS.creamSubtle + '60'}
            multiline
            textAlignVertical="top"
            maxLength={500}
          />
          
          <Animated.View style={[styles.submitButtonContainer, { transform: [{ scale: submitAnimation }] }]}>
            <TouchableOpacity
              onPress={handleAnswerSubmit}
              disabled={!userAnswer.trim() || isSubmitting}
              style={[
                styles.submitButton,
                (!userAnswer.trim() || isSubmitting) && styles.submitButtonDisabled
              ]}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={promptCategory.gradient}
                style={styles.submitButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.submitButtonText}>
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
          <Text style={styles.answerLabel}>Partner's Reflection</Text>
          <View style={styles.waitingForPartner}>
            <BlurView intensity={10} style={styles.waitingBlur}>
              <Text style={styles.waitingText}>
                {hasUserSubmitted ? 
                  'Waiting for your partner to reflect...' :
                  'Submit your reflection to see your partner\'s response'
                }
              </Text>
            </BlurView>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.answerSection}>
        <Text style={styles.answerLabel}>Partner's Reflection</Text>
        
        <Animated.View style={[
          styles.partnerAnswer,
          {
            opacity: isPartnerAnswerRevealed ? revealAnimation : 1,
          }
        ]}>
          <BlurView 
            intensity={isPartnerAnswerRevealed ? 5 : blurAnimation} 
            style={styles.partnerAnswerBlur}
          >
            {isPartnerAnswerRevealed ? (
              <>
                <Text style={styles.partnerAnswerText}>{partnerAnswer}</Text>
                <Text style={styles.revealedTimestamp}>
                  Revealed {currentPrompt?.revealedAt ? 
                    new Date(currentPrompt.revealedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
                    'just now'
                  }
                </Text>
              </>
            ) : (
              <View style={styles.blurredContent}>
                <Text style={styles.blurredText}>
                  Your partner has shared their reflection...
                </Text>
                <Text style={styles.blurredSubtext}>
                  Submit your answer to reveal theirs
                </Text>
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
        <Text style={styles.loadingText}>Preparing your daily reflection...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Animated.View style={[styles.content, { opacity: fadeAnimation }]}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          {renderPromptHeader()}
          
          {/* Question */}
          {renderPromptQuestion()}
          
          {/* User Answer Section */}
          {renderUserAnswerSection()}
          
          {/* Partner Answer Section */}
          {renderPartnerAnswerSection()}
          
          {/* Editorial Footer */}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  loadingText: {
    ...TYPOGRAPHY.body,
    color: COLORS.creamSubtle,
  },
  
  content: {
    flex: 1,
  },
  
  scrollView: {
    flex: 1,
  },
  
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
  },
  
  promptHeader: {
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
    fontSize: 20,
    marginRight: SPACING.sm,
  },
  
  categoryName: {
    ...TYPOGRAPHY.label,
    color: COLORS.blushRose,
  },
  
  dateContainer: {
    // Date styling
  },
  
  dateText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.creamSubtle,
  },
  
  questionContainer: {
    marginBottom: SPACING.xxl,
    paddingHorizontal: SPACING.md,
  },
  
  questionText: {
    ...TYPOGRAPHY.h1,
    color: COLORS.softCream,
    textAlign: 'center',
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  
  answerSection: {
    marginBottom: SPACING.xl,
  },
  
  answerLabel: {
    ...TYPOGRAPHY.h3,
    color: COLORS.blushRose,
    marginBottom: SPACING.md,
  },
  
  answerInputContainer: {
    // Input container styling
  },
  
  answerInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    color: COLORS.softCream,
    ...TYPOGRAPHY.body,
    minHeight: 120,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 211, 233, 0.3)',
    marginBottom: SPACING.lg,
  },
  
  submitButtonContainer: {
    // Submit button container
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
    color: COLORS.pureWhite,
  },
  
  submittedAnswer: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  
  submittedAnswerBlur: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 211, 233, 0.3)',
  },
  
  submittedAnswerText: {
    ...TYPOGRAPHY.body,
    color: COLORS.softCream,
    marginBottom: SPACING.sm,
    lineHeight: 24,
  },
  
  submittedTimestamp: {
    ...TYPOGRAPHY.caption,
    color: COLORS.creamSubtle,
  },
  
  waitingForPartner: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  
  waitingBlur: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 211, 233, 0.2)',
  },
  
  waitingText: {
    ...TYPOGRAPHY.body,
    color: COLORS.creamSubtle,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  
  partnerAnswer: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  
  partnerAnswerBlur: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 211, 233, 0.3)',
  },
  
  partnerAnswerText: {
    ...TYPOGRAPHY.body,
    color: COLORS.softCream,
    marginBottom: SPACING.sm,
    lineHeight: 24,
  },
  
  revealedTimestamp: {
    ...TYPOGRAPHY.caption,
    color: COLORS.creamSubtle,
  },
  
  blurredContent: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  
  blurredText: {
    ...TYPOGRAPHY.body,
    color: COLORS.creamSubtle,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  
  blurredSubtext: {
    ...TYPOGRAPHY.caption,
    color: COLORS.creamSubtle + '80',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  
  editorialFooter: {
    marginTop: SPACING.xxl,
    paddingTop: SPACING.xl,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 211, 233, 0.2)',
    alignItems: 'center',
  },
  
  editorialFooterText: {
    ...TYPOGRAPHY.pullQuote,
    color: COLORS.creamSubtle,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default EditorialPrompt;