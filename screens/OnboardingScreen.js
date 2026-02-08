import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  Platform,
  KeyboardAvoidingView,
  Alert,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useAppContext } from "../context/AppContext";
import { useContent } from "../context/ContentContext";
import { useTheme } from "../context/ThemeContext";
import analytics from "../utils/analytics";
import feedbackCollector from "../utils/feedbackCollector";
import abTestManager from "../utils/abTestManager";
import { TYPOGRAPHY, SPACING, BORDER_RADIUS, GRADIENTS, COLORS, SHADOWS, getGlassStyle } from "../utils/theme";
import { MaterialCommunityIcons, FontAwesome6, Feather, Ionicons } from "@expo/vector-icons";
import Chip from "../components/Chip";
import Input from "../components/Input";

const { width } = Dimensions.get("window");

const GOALS = [
  { id: "connection", label: "Connection", icon: "heart", iconSet: "Feather" },
  { id: "intimacy", label: "Intimacy", icon: "sparkles", iconSet: "Ionicons" },
  { id: "memories", label: "Memories", icon: "camera", iconSet: "Feather" },
  { id: "adventure", label: "Adventure", icon: "compass", iconSet: "Feather" },
];

const GENDER_OPTIONS = [
  { id: "woman", label: "Woman" },
  { id: "man", label: "Man" },
  { id: "nonbinary", label: "Non-binary" },
  { id: "other", label: "Other" },
];

export default function OnboardingScreen({ navigation }) {
  const { actions } = useAppContext();
  const { theme: activeTheme, isDark } = useTheme();
  const { updateRelationshipStartDate, getRelationshipDurationText, getDurationCategory, getRelationshipDuration } = useContent();
  const [step, setStep] = useState(0);

  // A/B Testing state
  const [experimentVariants, setExperimentVariants] = useState({});
  const [onboardingConfig, setOnboardingConfig] = useState(null);
  const [valuePropositionConfig, setValuePropositionConfig] = useState(null);

  // Animation values
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(50)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  // Form state
  const [selectedGoals, setSelectedGoals] = useState([]);
  const [genderIdentity, setGenderIdentity] = useState(null);
  const [customPartnerLabel, setCustomPartnerLabel] = useState("");
  const [myName, setMyName] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [selectedHeatLevel, setSelectedHeatLevel] = useState(3); // Default to Heat 3
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  // Anniversary date state
  const [anniversaryDate, setAnniversaryDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [hasSetDate, setHasSetDate] = useState(false);
  const [showAnniversaryBenefits, setShowAnniversaryBenefits] = useState(false);

  // Initialize A/B testing and track onboarding start
  useEffect(() => {
    initializeExperiments();
    analytics.trackUserBehavior('onboarding_started', {
      timestamp: Date.now()
    });
  }, []);

  const initializeExperiments = async () => {
    try {
      // Get user ID (in real app, this would come from auth context)
      const userId = 'user_' + Math.random().toString(36).substring(2, 9);
      
      // Initialize user experiments
      const experiments = await abTestManager.initializeUserExperiments(userId);
      setExperimentVariants(experiments);
      
      // Get experiment configurations
      const onboardingVariant = await abTestManager.deployAnniversaryPlacementExperiment(userId);
      const valuePropositionVariant = await abTestManager.deployValuePropositionExperiment(userId);
      
      const onboardingConf = abTestManager.getOnboardingExperimentConfig(onboardingVariant);
      const valuePropositionConf = abTestManager.getValuePropositionConfig(valuePropositionVariant);
      
      setOnboardingConfig(onboardingConf);
      setValuePropositionConfig(valuePropositionConf);
      
      // Track experiment initialization
      await analytics.trackFeatureUsage('ab_test', 'onboarding_experiments_initialized', {
        user_id: userId,
        onboarding_variant: onboardingVariant,
        value_proposition_variant: valuePropositionVariant,
        experiments_count: Object.keys(experiments).length
      });
      
    } catch (error) {
      console.error('Failed to initialize experiments:', error);
      // Fallback to default configuration
      setOnboardingConfig(abTestManager.getOnboardingExperimentConfig('control'));
      setValuePropositionConfig(abTestManager.getValuePropositionConfig('control'));
    }
  };

  useEffect(() => {
    // Entrance animation for each step
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

    // Pulse animation for interactive elements
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [step]);

  // Reset animations when step changes
  useEffect(() => {
    fadeAnimation.setValue(0);
    slideAnimation.setValue(50);
    
    Animated.parallel([
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnimation, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [step]);

  // ✅ Sophisticated dark theme for onboarding
  const t = useMemo(() => {
    return {
      // Deep, mature color palette
      text: COLORS.softCream,
      textSecondary: "rgba(246,242,238,0.65)",
      border: "rgba(255,255,255,0.08)",
      surface: "rgba(255,255,255,0.04)",
      surfaceSecondary: "rgba(255,255,255,0.02)",
      blushRose: COLORS.blushRose,
      blushRoseLight: COLORS.blushRoseLight,
      mutedGold: COLORS.mutedGold,

      // Enhanced gradients for dark theme
      gradients: { 
        primary: [COLORS.obsidian, COLORS.warmCharcoal, COLORS.deepPlum],
        action: [COLORS.blushRose, COLORS.beetroot, COLORS.deepPlum],
      },
    };
  }, []);

  const handleNext = async () => {
    await Haptics.selectionAsync();
    
    // Track step progression with A/B test data
    await analytics.trackUserBehavior('onboarding_step_completed', {
      step: step,
      step_name: getStepName(step),
      experiment_variants: experimentVariants
    });
    
    // Track A/B test events
    const userId = 'user_' + Math.random().toString(36).substring(2, 9); // In real app, get from auth
    await abTestManager.trackOnboardingExperimentEvents(userId, 'step_completed', {
      step: step,
      step_name: getStepName(step)
    });
    
    // Validation for specific steps
    if (step === 6 && !termsAccepted) {
      Alert.alert('Terms Required', 'Please accept the Terms of Service to continue');
      return;
    }
    
    if (step < 7) { // Updated to include all new steps
      setStep(step + 1);
      return;
    }

    // Final step - complete onboarding
    try {
      const finalPartnerLabel = (customPartnerLabel || "partner").trim();

      await actions.updateProfile({
        goals: selectedGoals,
        genderIdentity,
        partnerNames: {
          myName: myName || 'Me',
          partnerName: partnerName || 'Partner'
        },
        heatLevelPreference: selectedHeatLevel,
        termsAcceptedAt: new Date().toISOString(),
      });

      await actions.setPartnerLabel(finalPartnerLabel);
      
      // Save anniversary date if set
      if (hasSetDate) {
        const relationshipDuration = getRelationshipDuration();
        await updateRelationshipStartDate(anniversaryDate.toISOString());
        
        // Track anniversary date setting with A/B test context
        await analytics.trackAnniversaryDateSet(relationshipDuration, 'onboarding');
        await abTestManager.trackOnboardingExperimentEvents(userId, 'anniversary_date_set', {
          duration_days: relationshipDuration,
          source: 'onboarding'
        });
      }
      
      // Track onboarding completion with experiment data
      await analytics.trackOnboardingCompletion(hasSetDate, hasSetDate ? getDurationCategory(getRelationshipDuration()) : null);
      await abTestManager.trackOnboardingExperimentEvents(userId, 'onboarding_completed', {
        has_anniversary_date: hasSetDate,
        experiment_variants: experimentVariants
      });
      
      await actions.completeOnboarding();

      // Collect onboarding feedback after a delay
      setTimeout(async () => {
        const shouldPrompt = await feedbackCollector.shouldPromptForFeedback('onboarding', 'onboarding', 168); // 7 days cooldown
        if (shouldPrompt) {
          // This would trigger a feedback modal in a real implementation
          console.log('📝 Onboarding feedback prompt ready');
        }
      }, 5000);

      // Navigation will be handled by RootNavigator based on onboardingCompleted state
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      
      // Track onboarding error with experiment context
      await analytics.trackUserBehavior('onboarding_error', {
        error: error.message,
        step: step,
        experiment_variants: experimentVariants
      });
      
      Alert.alert('Error', 'Failed to complete setup. Please try again.');
    }
  };

  const getStepName = (stepIndex) => {
    const stepNames = ['welcome', 'disclaimer', 'goals', 'identity', 'partner_names', 'heat_level', 'terms', 'anniversary', 'completion'];
    return stepNames[stepIndex] || 'unknown';
  };

  const handleGoalToggle = async (goalId) => {
    await Haptics.selectionAsync();
    
    const wasSelected = selectedGoals.includes(goalId);
    setSelectedGoals((prev) =>
      prev.includes(goalId) ? prev.filter((g) => g !== goalId) : [...prev, goalId]
    );
    
    // Track goal selection
    await analytics.trackUserBehavior('onboarding_goal_selected', {
      goal: goalId,
      action: wasSelected ? 'deselected' : 'selected',
      total_goals: wasSelected ? selectedGoals.length - 1 : selectedGoals.length + 1
    });
  };

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (selectedDate) {
      setAnniversaryDate(selectedDate);
      setHasSetDate(true);
      setShowAnniversaryBenefits(true);
      
      // Track anniversary date selection
      const duration = Math.ceil((new Date() - selectedDate) / (1000 * 60 * 60 * 24));
      analytics.trackUserBehavior('anniversary_date_selected', {
        duration_days: duration,
        duration_category: getDurationCategory(duration),
        source: 'onboarding'
      });
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Success);
    }
  };

  const showDatePickerModal = () => {
    setShowDatePicker(true);
    analytics.trackUserBehavior('anniversary_date_picker_opened', { source: 'onboarding' });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const skipAnniversaryDate = () => {
    setHasSetDate(false);
    setShowAnniversaryBenefits(false);
    
    // Track anniversary date skip
    analytics.trackUserBehavior('anniversary_date_skipped', { source: 'onboarding' });
    
    Haptics.selectionAsync();
  };

  const getHeatLevelInfo = (level) => {
    const heatLevels = {
      1: {
        title: 'Heat 1: Emotional Connection',
        description: 'Pure emotional intimacy, deep conversations, and heartfelt moments'
      },
      2: {
        title: 'Heat 2: Flirty & Romantic',
        description: 'Playful flirting, romantic gestures, and sweet affection'
      },
      3: {
        title: 'Heat 3: Intimate & Sensual',
        description: 'Moderately sexual content, sensual exploration, and physical intimacy'
      },
      4: {
        title: 'Heat 4: Playfully Sexual',
        description: 'Adventurous and playful sexual content, exploring desires'
      },
      5: {
        title: 'Heat 5: Intensely Passionate',
        description: 'Deeply passionate and explicit content for adventurous couples'
      }
    };
    return heatLevels[level] || heatLevels[3];
  };

  const renderStep = () => {
    switch (step) {
      case 0: // Welcome
        return (
          <Animated.View 
            style={[
              styles.stepContainer,
              {
                opacity: fadeAnimation,
                transform: [{ translateY: slideAnimation }],
              }
            ]}
          >
            <Animated.View 
              style={[
                styles.puffyIcon, 
                { 
                  backgroundColor: "rgba(247,190,239,0.08)",
                  transform: [{ scale: pulseAnimation }]
                }
              ]}
            >
              <LinearGradient
                colors={[
                  "rgba(247,190,239,0.15)", 
                  "rgba(247,190,239,0.08)", 
                  "rgba(247,190,239,0.03)"
                ]}
                style={StyleSheet.absoluteFill}
              />
              <Image 
                source={require('../assets/icon.png')} 
                style={styles.appIcon}
                resizeMode="contain"
              />
            </Animated.View>

            <Text style={[TYPOGRAPHY.display, { color: COLORS.softCream, textAlign: "center", fontSize: 44, marginBottom: 8 }]}>
              Between Us
            </Text>

            <View style={styles.taglineContainer}>
              <Text style={[styles.tagline, { color: COLORS.mutedGold }]}>PRIVATE</Text>
              <View style={[styles.taglineDot, { backgroundColor: COLORS.mutedGold }]} />
              <Text style={[styles.tagline, { color: COLORS.mutedGold }]}>INTIMATE</Text>
              <View style={[styles.taglineDot, { backgroundColor: COLORS.mutedGold }]} />
              <Text style={[styles.tagline, { color: COLORS.mutedGold }]}>YOURS</Text>
            </View>

            <Text style={[TYPOGRAPHY.body, { color: "rgba(246,242,238,0.7)", textAlign: "center", marginTop: 24, fontSize: 17, lineHeight: 26 }]}>
              A sanctuary for deepening intimacy{"\n"}and preserving your most precious moments.
            </Text>
          </Animated.View>
        );

      case 1: // Disclaimer - "Is this app right for you?"
        return (
          <Animated.View 
            style={[
              styles.stepContainer,
              {
                opacity: fadeAnimation,
                transform: [{ translateY: slideAnimation }],
              }
            ]}
          >
            <View style={[styles.puffyIcon, { backgroundColor: "rgba(212,175,55,0.08)", width: 100, height: 100 }]}>
              <MaterialCommunityIcons name="heart-pulse" size={40} color={COLORS.mutedGold} />
            </View>

            <Text style={[TYPOGRAPHY.h1, { color: COLORS.softCream, textAlign: "center", fontSize: 32, marginBottom: 16 }]}>
              Is This App Right for You?
            </Text>

            <Text style={[TYPOGRAPHY.body, { color: "rgba(246,242,238,0.8)", textAlign: "center", fontSize: 16, lineHeight: 24, marginBottom: 32 }]}>
              Between Us is designed for couples in healthy, thriving relationships
            </Text>

            <View style={styles.disclaimerCard}>
              <View style={styles.disclaimerSection}>
                <MaterialCommunityIcons name="check-circle" size={24} color={COLORS.blushRose} />
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={[styles.disclaimerTitle, { color: COLORS.softCream }]}>Perfect For:</Text>
                  <Text style={[styles.disclaimerText, { color: "rgba(246,242,238,0.7)" }]}>
                    • Couples who want to deepen their connection{'\n'}
                    • Partners looking to maintain relationship vitality{'\n'}
                    • Couples who enjoy exploring intimacy together{'\n'}
                    • Partners seeking better communication
                  </Text>
                </View>
              </View>

              <View style={[styles.disclaimerDivider, { backgroundColor: "rgba(255,255,255,0.1)" }]} />

              <View style={styles.disclaimerSection}>
                <MaterialCommunityIcons name="alert-circle" size={24} color={COLORS.warning} />
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={[styles.disclaimerTitle, { color: COLORS.warning }]}>Not Appropriate For:</Text>
                  <Text style={[styles.disclaimerText, { color: "rgba(246,242,238,0.7)" }]}>
                    • Couples experiencing serious conflicts{'\n'}
                    • Relationships with trust issues{'\n'}
                    • Situations involving abuse{'\n'}
                    • Relationships requiring professional therapy
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.importantNote, { backgroundColor: "rgba(212,175,55,0.08)", borderColor: "rgba(212,175,55,0.3)" }]}>
              <MaterialCommunityIcons name="information" size={20} color={COLORS.mutedGold} />
              <Text style={[styles.importantNoteText, { color: "rgba(246,242,238,0.8)" }]}>
                This app is for enhancement, not repair. If you're experiencing serious issues, please seek professional counseling.
              </Text>
            </View>
          </Animated.View>
        );

      case 2: // Goals
        return (
          <Animated.View 
            style={[
              styles.stepContainer, 
              { alignItems: "flex-start" },
              {
                opacity: fadeAnimation,
                transform: [{ translateY: slideAnimation }],
              }
            ]}
          >
            <View style={{ width: "100%", alignItems: "center", marginBottom: 24 }}>
              <Text style={[TYPOGRAPHY.h1, { color: t.text, fontSize: 36, textAlign: "center", marginBottom: 12 }]}>
                What matters most?
              </Text>

              <Text style={[TYPOGRAPHY.body, { color: t.textSecondary, textAlign: "center", fontSize: 16, lineHeight: 24, opacity: 0.8 }]}>
                Select what you'd love to cultivate together
              </Text>
            </View>

            <View style={styles.goalsGrid}>
              {GOALS.map((goal) => {
                const isSelected = selectedGoals.includes(goal.id);

                return (
                  <Animated.View
                    key={goal.id}
                    style={[
                      styles.goalCard,
                      isSelected && styles.goalCardActive,
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => handleGoalToggle(goal.id)}
                      activeOpacity={0.9}
                      style={{ flex: 1 }}
                    >
                      <BlurView
                        intensity={isDark ? 35 : 60}
                        tint={isDark ? "dark" : "light"}
                        style={[
                          styles.goalCardBlur,
                          isSelected && { 
                            borderColor: "rgba(247,190,239,0.5)",
                            borderWidth: 2.5,
                          }
                        ]}
                      >
                        <LinearGradient
                          colors={
                            isSelected
                              ? [
                                  "rgba(247,190,239,0.20)", 
                                  "rgba(247,190,239,0.12)", 
                                  "rgba(247,190,239,0.06)"
                                ]
                              : [
                                  "rgba(255,255,255,0.06)", 
                                  "rgba(255,255,255,0.03)", 
                                  "rgba(255,255,255,0.01)"
                                ]
                          }
                          style={StyleSheet.absoluteFill}
                        />

                        <View style={[
                          styles.goalIconContainer,
                          isSelected && { 
                            backgroundColor: "rgba(247,190,239,0.25)",
                            borderWidth: 2,
                            borderColor: "rgba(247,190,239,0.4)",
                            ...SHADOWS.medium,
                          }
                        ]}>
                          {goal.iconSet === "Feather" && (
                            <Feather
                              name={goal.icon}
                              size={36}
                              color={isSelected ? COLORS.blushRose : "rgba(246,242,238,0.6)"}
                            />
                          )}
                          {goal.iconSet === "Ionicons" && (
                            <Ionicons
                              name={goal.icon}
                              size={36}
                              color={isSelected ? COLORS.blushRose : "rgba(246,242,238,0.6)"}
                            />
                          )}
                          {goal.iconSet === "FontAwesome6" && (
                            <FontAwesome6
                              name={goal.icon}
                              size={36}
                              color={isSelected ? COLORS.blushRose : "rgba(246,242,238,0.6)"}
                            />
                          )}
                          {!goal.iconSet && (
                            <MaterialCommunityIcons
                              name={goal.icon}
                              size={36}
                              color={isSelected ? COLORS.blushRose : "rgba(246,242,238,0.6)"}
                            />
                          )}
                        </View>

                        <Text 
                          style={[
                            styles.goalLabel,
                            { color: isSelected ? COLORS.blushRose : COLORS.softCream },
                            isSelected && styles.goalLabelActive
                          ]}
                          numberOfLines={1}
                        >
                          {goal.label}
                        </Text>

                        {isSelected && (
                          <Animated.View style={[styles.goalActiveIndicator, { backgroundColor: COLORS.blushRose }]}>
                            <MaterialCommunityIcons name="check" size={16} color={COLORS.obsidian} />
                          </Animated.View>
                        )}
                      </BlurView>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>
        );

      case 3: // Identity (was case 2)
        return (
          <Animated.View 
            style={[
              styles.stepContainer, 
              { alignItems: "flex-start" },
              {
                opacity: fadeAnimation,
                transform: [{ translateY: slideAnimation }],
              }
            ]}
          >
            <View style={{ width: "100%", alignItems: "center", marginBottom: 24 }}>
              <Text style={[TYPOGRAPHY.h1, { color: COLORS.softCream, fontSize: 36, textAlign: "center", marginBottom: 12 }]}>
                Personalize It
              </Text>
              
              <Text style={[TYPOGRAPHY.body, { color: "rgba(246,242,238,0.7)", textAlign: "center", fontSize: 16, lineHeight: 24, opacity: 0.8 }]}>
                Help us create your perfect experience
              </Text>
            </View>

            <Text style={[styles.sectionLabel, { color: "rgba(246,242,238,0.65)" }]}>I identify as...</Text>

            <View style={styles.optionsGrid}>
              {GENDER_OPTIONS.map((opt) => (
                <Chip
                  key={opt.id}
                  label={opt.label}
                  selected={genderIdentity === opt.id}
                  onPress={() => setGenderIdentity(opt.id)}
                />
              ))}
            </View>

            <Text style={[styles.sectionLabel, { color: "rgba(246,242,238,0.65)" }]}>
              I call my partner...
            </Text>

            <View style={{ width: "100%", marginBottom: 40 }}>
              <Input
                value={customPartnerLabel}
                onChangeText={setCustomPartnerLabel}
                placeholder="e.g. My Love, Babe, Wife"
                style={{ marginBottom: 0 }}
                autoCorrect={false}
                returnKeyType="done"
              />
            </View>
          </Animated.View>
        );

      case 4: // Partner Names
        return (
          <Animated.View 
            style={[
              styles.stepContainer,
              {
                opacity: fadeAnimation,
                transform: [{ translateY: slideAnimation }],
              }
            ]}
          >
            <View style={{ width: "100%", alignItems: "center", marginBottom: 32 }}>
              <View style={[styles.puffyIcon, { backgroundColor: "rgba(247,190,239,0.08)", width: 100, height: 100 }]}>
                <MaterialCommunityIcons name="account-heart" size={40} color={COLORS.blushRose} />
              </View>

              <Text style={[TYPOGRAPHY.h1, { color: COLORS.softCream, fontSize: 32, textAlign: "center", marginBottom: 12 }]}>
                What Do You Call Each Other?
              </Text>

              <Text style={[TYPOGRAPHY.body, { color: "rgba(246,242,238,0.7)", textAlign: "center", fontSize: 16, lineHeight: 24 }]}>
                Personalize how you see yourselves in the app
              </Text>
            </View>

            <View style={{ width: "100%", marginBottom: 24 }}>
              <Text style={[styles.inputLabel, { color: "rgba(246,242,238,0.65)" }]}>My name</Text>
              <Input
                value={myName}
                onChangeText={setMyName}
                placeholder="e.g. Sarah, Alex, Me"
                style={{ marginBottom: 0 }}
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <View style={{ width: "100%", marginBottom: 24 }}>
              <Text style={[styles.inputLabel, { color: "rgba(246,242,238,0.65)" }]}>My partner's name</Text>
              <Input
                value={partnerName}
                onChangeText={setPartnerName}
                placeholder="e.g. John, Emma, Partner"
                style={{ marginBottom: 0 }}
                autoCorrect={false}
                returnKeyType="done"
              />
            </View>

            <View style={[styles.exampleCard, { backgroundColor: "rgba(247,190,239,0.06)", borderColor: "rgba(247,190,239,0.2)" }]}>
              <MaterialCommunityIcons name="lightbulb-on" size={20} color={COLORS.blushRose} />
              <Text style={[styles.exampleText, { color: "rgba(246,242,238,0.8)" }]}>
                These names will appear in prompts and throughout the app. You can change them anytime in Settings.
              </Text>
            </View>
          </Animated.View>
        );

      case 5: // Heat Level Preference
        return (
          <Animated.View 
            style={[
              styles.stepContainer,
              {
                opacity: fadeAnimation,
                transform: [{ translateY: slideAnimation }],
              }
            ]}
          >
            <View style={{ width: "100%", alignItems: "center", marginBottom: 32 }}>
              <View style={[styles.puffyIcon, { backgroundColor: "rgba(247,190,239,0.08)", width: 100, height: 100 }]}>
                <MaterialCommunityIcons name="fire" size={40} color={COLORS.blushRose} />
              </View>

              <Text style={[TYPOGRAPHY.h1, { color: COLORS.softCream, fontSize: 32, textAlign: "center", marginBottom: 12 }]}>
                Choose Your Heat Level
              </Text>

              <Text style={[TYPOGRAPHY.body, { color: "rgba(246,242,238,0.7)", textAlign: "center", fontSize: 16, lineHeight: 24 }]}>
                Select the level of intimacy you're comfortable with
              </Text>
            </View>

            <View style={{ width: "100%", gap: 16 }}>
              {[1, 2, 3, 4, 5].map((level) => {
                const isSelected = selectedHeatLevel === level;
                const heatInfo = getHeatLevelInfo(level);
                
                return (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.heatLevelCard,
                      {
                        backgroundColor: isSelected ? "rgba(247,190,239,0.12)" : "rgba(255,255,255,0.04)",
                        borderColor: isSelected ? "rgba(247,190,239,0.4)" : "rgba(255,255,255,0.08)",
                        borderWidth: isSelected ? 2 : 1,
                      }
                    ]}
                    onPress={() => {
                      setSelectedHeatLevel(level);
                      Haptics.selectionAsync();
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.heatLevelHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {[...Array(level)].map((_, i) => (
                          <MaterialCommunityIcons
                            key={i}
                            name="fire"
                            size={16}
                            color={isSelected ? COLORS.blushRose : "rgba(246,242,238,0.5)"}
                          />
                        ))}
                      </View>
                      {isSelected && (
                        <MaterialCommunityIcons name="check-circle" size={24} color={COLORS.blushRose} />
                      )}
                    </View>
                    <Text style={[styles.heatLevelTitle, { color: isSelected ? COLORS.blushRose : COLORS.softCream }]}>
                      {heatInfo.title}
                    </Text>
                    <Text style={[styles.heatLevelDescription, { color: "rgba(246,242,238,0.7)" }]}>
                      {heatInfo.description}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.exampleCard, { backgroundColor: "rgba(212,175,55,0.06)", borderColor: "rgba(212,175,55,0.2)", marginTop: 24 }]}>
              <MaterialCommunityIcons name="information" size={20} color={COLORS.mutedGold} />
              <Text style={[styles.exampleText, { color: "rgba(246,242,238,0.8)" }]}>
                You can adjust this anytime in Settings. Start with what feels comfortable and explore at your own pace.
              </Text>
            </View>
          </Animated.View>
        );

      case 6: // Terms of Service
        return (
          <Animated.View 
            style={[
              styles.stepContainer,
              {
                opacity: fadeAnimation,
                transform: [{ translateY: slideAnimation }],
              }
            ]}
          >
            <View style={{ width: "100%", alignItems: "center", marginBottom: 24 }}>
              <View style={[styles.puffyIcon, { backgroundColor: "rgba(212,175,55,0.08)", width: 100, height: 100 }]}>
                <MaterialCommunityIcons name="file-document-check" size={40} color={COLORS.mutedGold} />
              </View>

              <Text style={[TYPOGRAPHY.h1, { color: COLORS.softCream, fontSize: 32, textAlign: "center", marginBottom: 12 }]}>
                Terms & Privacy
              </Text>

              <Text style={[TYPOGRAPHY.body, { color: "rgba(246,242,238,0.7)", textAlign: "center", fontSize: 16, lineHeight: 24 }]}>
                Please review and accept our terms to continue
              </Text>
            </View>

            <View style={[styles.termsCard, { backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }]}>
              <TouchableOpacity
                style={styles.termsLink}
                onPress={() => navigation.navigate('Terms')}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="file-document" size={24} color={COLORS.blushRose} />
                <Text style={[styles.termsLinkText, { color: COLORS.blushRose }]}>Read Terms of Service</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.blushRose} />
              </TouchableOpacity>

              <View style={[styles.termsDivider, { backgroundColor: "rgba(255,255,255,0.08)" }]} />

              <TouchableOpacity
                style={styles.termsLink}
                onPress={() => navigation.navigate('PrivacyPolicy')}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="shield-lock" size={24} color={COLORS.blushRose} />
                <Text style={[styles.termsLinkText, { color: COLORS.blushRose }]}>Read Privacy Policy</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.blushRose} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.termsCheckbox, { borderColor: termsAccepted ? COLORS.blushRose : "rgba(255,255,255,0.2)" }]}
              onPress={() => {
                setTermsAccepted(!termsAccepted);
                Haptics.selectionAsync();
              }}
              activeOpacity={0.8}
            >
              <View style={[
                styles.checkbox,
                {
                  backgroundColor: termsAccepted ? COLORS.blushRose : "transparent",
                  borderColor: termsAccepted ? COLORS.blushRose : "rgba(255,255,255,0.2)",
                }
              ]}>
                {termsAccepted && (
                  <MaterialCommunityIcons name="check" size={20} color={COLORS.obsidian} />
                )}
              </View>
              <Text style={[styles.termsCheckboxText, { color: COLORS.softCream }]}>
                I have read and agree to the Terms of Service and Privacy Policy
              </Text>
            </TouchableOpacity>

            <View style={[styles.exampleCard, { backgroundColor: "rgba(212,175,55,0.06)", borderColor: "rgba(212,175,55,0.2)", marginTop: 24 }]}>
              <MaterialCommunityIcons name="shield-check" size={20} color={COLORS.mutedGold} />
              <Text style={[styles.exampleText, { color: "rgba(246,242,238,0.8)" }]}>
                Your data is encrypted and private. We never sell your information.
              </Text>
            </View>
          </Animated.View>
        );

      case 7: // Anniversary Date (was case 3)
        return (
          <Animated.View 
            style={[
              styles.stepContainer,
              {
                opacity: fadeAnimation,
                transform: [{ translateY: slideAnimation }],
              }
            ]}
          >
            <View style={{ alignItems: "center", marginBottom: 32 }}>
              <View style={[styles.puffyIcon, { backgroundColor: "rgba(212,175,55,0.08)", width: 120, height: 120 }]}>
                <MaterialCommunityIcons name="calendar-heart" size={48} color={COLORS.mutedGold} />
              </View>

              <Text style={[TYPOGRAPHY.h1, { color: COLORS.softCream, textAlign: "center", fontSize: 32, marginBottom: 12 }]}>
                When did you start dating?
              </Text>

              <Text style={[TYPOGRAPHY.body, { color: "rgba(246,242,238,0.7)", textAlign: "center", fontSize: 16, lineHeight: 24, marginBottom: 16 }]}>
                This helps us personalize prompts for your{"\n"}relationship stage
              </Text>

              {/* Value proposition benefits */}
              <View style={styles.benefitsContainer}>
                <View style={styles.benefitItem}>
                  <MaterialCommunityIcons name="sparkles" size={16} color={COLORS.blushRose} />
                  <Text style={styles.benefitText}>Stage-appropriate conversation starters</Text>
                </View>
                <View style={styles.benefitItem}>
                  <MaterialCommunityIcons name="heart-pulse" size={16} color={COLORS.blushRose} />
                  <Text style={styles.benefitText}>Relationship milestone celebrations</Text>
                </View>
                <View style={styles.benefitItem}>
                  <MaterialCommunityIcons name="chart-line" size={16} color={COLORS.blushRose} />
                  <Text style={styles.benefitText}>Growth-focused prompts that evolve with you</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity 
              style={[
                styles.dateCard, 
                { 
                  backgroundColor: hasSetDate ? "rgba(212,175,55,0.08)" : "rgba(255,255,255,0.04)",
                  borderColor: hasSetDate ? "rgba(212,175,55,0.3)" : "rgba(255,255,255,0.08)"
                }
              ]}
              onPress={showDatePickerModal}
              activeOpacity={0.9}
            >
              <MaterialCommunityIcons 
                name="calendar-edit" 
                size={24} 
                color={hasSetDate ? COLORS.mutedGold : "rgba(246,242,238,0.6)"} 
              />
              <Text style={[
                styles.dateText, 
                { color: hasSetDate ? COLORS.mutedGold : "rgba(246,242,238,0.6)" }
              ]}>
                {hasSetDate 
                  ? anniversaryDate.toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })
                  : "Select your anniversary date"
                }
              </Text>
            </TouchableOpacity>

            {hasSetDate && (
              <Animated.View 
                style={[
                  styles.durationDisplay,
                  {
                    opacity: showAnniversaryBenefits ? 1 : 0,
                    transform: [{
                      translateY: showAnniversaryBenefits ? 0 : 20
                    }]
                  }
                ]}
              >
                <MaterialCommunityIcons name="heart" size={16} color={COLORS.blushRose} />
                <Text style={[styles.durationText, { color: COLORS.blushRose }]}>
                  Together for {getRelationshipDurationText()}
                </Text>
              </Animated.View>
            )}

            {hasSetDate && showAnniversaryBenefits && (
              <Animated.View 
                style={[
                  styles.personalizationPreview,
                  {
                    opacity: showAnniversaryBenefits ? 1 : 0,
                    transform: [{
                      translateY: showAnniversaryBenefits ? 0 : 30
                    }]
                  }
                ]}
              >
                <View style={styles.previewHeader}>
                  <MaterialCommunityIcons name="auto-fix" size={20} color={COLORS.mutedGold} />
                  <Text style={[styles.previewTitle, { color: COLORS.mutedGold }]}>
                    Personalization Preview
                  </Text>
                </View>
                
                <Text style={[styles.previewDescription, { color: COLORS.softCream }]}>
                  Your prompts are now tailored for{" "}
                  <Text style={{ color: COLORS.blushRose, fontWeight: '700' }}>
                    {getDurationCategory(getRelationshipDuration()) === 'new' ? 'new love' :
                     getDurationCategory(getRelationshipDuration()) === 'developing' ? 'growing relationships' :
                     getDurationCategory(getRelationshipDuration()) === 'established' ? 'committed partnerships' :
                     getDurationCategory(getRelationshipDuration()) === 'mature' ? 'seasoned couples' :
                     'long-term partnerships'}
                  </Text>
                  {" "}with conversation starters that feel perfectly relevant to where you are in your journey together.
                </Text>
              </Animated.View>
            )}

            <TouchableOpacity 
              style={styles.skipButton}
              onPress={skipAnniversaryDate}
              activeOpacity={0.8}
            >
              <Text style={[styles.skipText, { color: "rgba(246,242,238,0.5)" }]}>
                Skip for now (you can add this later in Settings)
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={anniversaryDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                maximumDate={new Date()}
                minimumDate={new Date(1950, 0, 1)}
              />
            )}
          </Animated.View>
        );

      case 8: // Completion (was case 4)
        return (
          <Animated.View 
            style={[
              styles.stepContainer,
              {
                opacity: fadeAnimation,
                transform: [{ translateY: slideAnimation }],
              }
            ]}
          >
            <View style={{ alignItems: "center", marginBottom: 32 }}>
              <MaterialCommunityIcons name="check-circle" size={64} color={COLORS.mutedGold} />

              <Text style={[TYPOGRAPHY.h1, { color: COLORS.softCream, textAlign: "center", marginTop: 24, fontSize: 36 }]}>
                You're All Set!
              </Text>

              <Text style={[TYPOGRAPHY.body, { color: "rgba(246,242,238,0.7)", textAlign: "center", marginTop: 12, fontSize: 16, lineHeight: 24 }]}>
                Ready to explore Between Us?{"\n"}You can invite your partner anytime from Settings.
              </Text>
            </View>

            {hasSetDate && (
              <View style={styles.personalizedCard}>
                <MaterialCommunityIcons name="sparkles" size={24} color={COLORS.blushRose} />
                <Text style={[styles.personalizedText, { color: COLORS.softCream }]}>
                  Your prompts are now personalized for couples who have been together for{" "}
                  <Text style={{ color: COLORS.blushRose, fontWeight: '700' }}>
                    {getRelationshipDurationText()}
                  </Text>
                </Text>
              </View>
            )}

            <TouchableOpacity 
              style={[styles.inviteCard, { backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }]}
              activeOpacity={0.9}
            >
              <View style={{ alignItems: "center", paddingVertical: 8 }}>
                <Image 
                  source={require('../assets/icon.png')} 
                  style={styles.inviteIcon}
                  resizeMode="contain"
                />
                <Text style={[TYPOGRAPHY.body, { color: COLORS.softCream, textAlign: "center", fontSize: 15, lineHeight: 22 }]}>
                  Partner linking is optional.{"\n"}Enjoy Between Us solo or connect later!
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        );

      default:
        return null;
    }
  };

  return (
    <LinearGradient 
      colors={[
        COLORS.obsidian,           // Deep black
        COLORS.warmCharcoal,       // Rich charcoal
        COLORS.deepPlum + "E6",    // Deep plum with opacity
        COLORS.warmCharcoal,       // Back to charcoal
      ]} 
      locations={[0, 0.3, 0.7, 1]}
      style={styles.container}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {renderStep()}
          </ScrollView>

          <View style={styles.footer}>
            {step > 0 && (
              <TouchableOpacity onPress={() => setStep(step - 1)} style={styles.backButton}>
                <Text style={[TYPOGRAPHY.caption, { color: "rgba(255,255,255,0.6)" }]}>Back</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.puffyButton} onPress={handleNext} activeOpacity={0.9}>
              <LinearGradient 
                colors={[COLORS.blushRose, COLORS.beetroot, COLORS.deepPlum]} 
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.buttonText}>{step === 8 ? "Enter Between Us" : "Continue"}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  scrollContent: { 
    padding: SPACING.xl, 
    paddingTop: SPACING.xxxl, // More top padding since no progress bar
    paddingBottom: SPACING.xxxl, // Extra bottom padding for keyboard
    flexGrow: 1, 
    justifyContent: "center",
    minHeight: width * 1.1, // Slightly reduced for keyboard space
  },
  
  stepContainer: { 
    alignItems: "center", 
    width: "100%",
    paddingVertical: SPACING.xl,
  },

  // Welcome Screen Premium Styling
  puffyIcon: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.xxxl,
    ...SHADOWS.puffy,
    overflow: "hidden",
    position: "relative",
  },

  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },

  taglineContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 16,
    gap: 12,
  },

  tagline: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2.5,
    opacity: 0.8,
  },

  taglineDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.6,
  },

  // Goals Section Premium Layout
  goalsGrid: { 
    flexDirection: "row", 
    flexWrap: "wrap", 
    gap: 24, 
    justifyContent: "center",
    marginTop: 40,
    paddingHorizontal: 16,
  },
  
  goalCard: { 
    width: (width - SPACING.xl * 2 - 56) / 2, // Perfect 2x2 grid
    height: 180,
    marginBottom: 16,
  },
  
  goalCardActive: {
    ...SHADOWS.large,
    transform: [{ scale: 1.03 }],
  },
  
  goalCardBlur: {
    flex: 1,
    borderRadius: BORDER_RADIUS.xxl,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 24,
    position: "relative",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  
  goalIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    position: "relative",
  },
  
  goalLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
    textAlign: "center",
    lineHeight: 12, // Match fontSize for consistent spacing
    paddingHorizontal: 4,
  },
  
  goalLabelActive: {
    fontWeight: "800",
    letterSpacing: 0.3,
    // Keep same fontSize to maintain consistency
  },
  
  goalActiveIndicator: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.medium,
  },

  // Identity Section Premium Styling
  sectionLabel: {
    ...TYPOGRAPHY.h2,
    fontSize: 16,
    alignSelf: "flex-start",
    marginBottom: 20,
    marginTop: 32,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontWeight: "800",
  },

  optionsGrid: { 
    flexDirection: "row", 
    flexWrap: "wrap", 
    gap: 12, 
    width: "100%",
    marginBottom: 8,
  },

  // Link Section Premium Styling
  inviteCard: {
    padding: 32,
    borderRadius: BORDER_RADIUS.xxl,
    marginTop: 48,
    width: "100%",
    borderWidth: 1.5,
    ...SHADOWS.medium,
  },

  inviteIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 16,
    opacity: 0.9,
  },

  // Anniversary Date Section
  benefitsContainer: {
    alignItems: 'flex-start',
    marginTop: 16,
    paddingHorizontal: 20,
  },

  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  benefitText: {
    fontSize: 13,
    color: 'rgba(246,242,238,0.8)',
    marginLeft: 8,
    fontWeight: '500',
  },

  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 2,
    marginBottom: 24,
    width: '100%',
    ...SHADOWS.medium,
  },

  dateText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 16,
    flex: 1,
  },

  durationDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(247,190,239,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: 24,
  },

  durationText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },

  personalizationPreview: {
    backgroundColor: 'rgba(212,175,55,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    borderRadius: BORDER_RADIUS.xl,
    padding: 20,
    marginBottom: 24,
    width: '100%',
  },

  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  previewTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },

  previewDescription: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },

  skipButton: {
    padding: 16,
    marginTop: 16,
  },

  skipText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },

  personalizedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(247,190,239,0.08)',
    padding: 20,
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(247,190,239,0.2)',
  },

  personalizedText: {
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 12,
    flex: 1,
  },

  // Footer Premium Layout
  footer: { 
    padding: SPACING.xl, 
    paddingBottom: SPACING.xxl,
    flexDirection: "row", 
    alignItems: "center", 
    gap: 24,
    marginTop: "auto",
  },
  
  backButton: { 
    padding: 16,
    borderRadius: BORDER_RADIUS.lg,
  },

  puffyButton: { 
    flex: 1, 
    height: 64, 
    borderRadius: BORDER_RADIUS.xl, 
    overflow: "hidden",
    ...SHADOWS.large,
  },
  
  buttonGradient: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center",
    paddingHorizontal: 24,
  },
  
  buttonText: { 
    ...TYPOGRAPHY.button, 
    color: COLORS.pureWhite,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  // Disclaimer styles
  disclaimerCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: BORDER_RADIUS.xl,
    padding: 24,
    marginBottom: 24,
    width: '100%',
  },

  disclaimerSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  disclaimerTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },

  disclaimerText: {
    fontSize: 14,
    lineHeight: 22,
  },

  disclaimerDivider: {
    height: 1,
    marginVertical: 20,
  },

  importantNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginTop: 16,
  },

  importantNoteText: {
    fontSize: 13,
    lineHeight: 20,
    marginLeft: 12,
    flex: 1,
  },

  // Partner names styles
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  exampleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
  },

  exampleText: {
    fontSize: 13,
    lineHeight: 20,
    marginLeft: 12,
    flex: 1,
  },

  // Heat level styles
  heatLevelCard: {
    padding: 20,
    borderRadius: BORDER_RADIUS.xl,
    ...SHADOWS.medium,
  },

  heatLevelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  heatLevelTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },

  heatLevelDescription: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Terms styles
  termsCard: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 24,
  },

  termsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },

  termsLinkText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },

  termsDivider: {
    height: 1,
  },

  termsCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    gap: 16,
  },

  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  termsCheckboxText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
});