// screens/OnboardingScreen.js
import React, { useCallback, useMemo, useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Share,
  TextInput,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  StatusBar,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import ReAnimated, { FadeInDown } from 'react-native-reanimated';
import DateTimePicker from "@react-native-community/datetimepicker";
import { notification, selection, NotificationFeedbackType } from '../utils/haptics';
import * as Clipboard from "expo-clipboard";
import Icon from '../components/Icon';
import { useAppContext } from "../context/AppContext";
import { useContent } from "../context/ContentContext";
import { useTheme } from "../context/ThemeContext";
import { SPACING } from "../utils/theme";
import HeartbeatEntry from "../components/HeartbeatEntry";
import EnergyMatcher from "../components/EnergyMatcher";
import CrashReporting from "../services/CrashReporting";
import { useAuth } from "../context/AuthContext";
import SeasonSelector from "../components/SeasonSelector";
import { NicknameEngine } from "../services/PolishEngine";
import CloudEngine from "../services/storage/CloudEngine";
import CoupleService from "../services/supabase/CoupleService";
import StorageRouter from "../services/storage/StorageRouter";
import { STORAGE_KEYS, storage } from "../utils/storage";
import { getSupabaseOrThrow } from "../config/supabase";
import AnalyticsService, { AnalyticsEvent } from "../services/AnalyticsService";
import { HEAT_LEVEL_ACCENTS } from "../config/constants";
import { FREE_LIMITS, PREMIUM_LIMITS } from "../utils/featureFlags";

export default function OnboardingScreen({ navigation }) {
  const { actions, state } = useAppContext();
  const { colors, isDark } = useTheme();
  const { updateRelationshipStartDate } = useContent();
  const { userProfile, updateProfile, markOnboardingComplete } = useAuth();
  
  // STRICT Apple Editorial Theme Map
  const t = useMemo(() => ({
    background: colors.background,
    surface: colors.surface || (isDark ? '#1C1C1E' : '#FFFFFF'),
    surfaceSecondary: colors.surface2 || (isDark ? '#2C2C2E' : '#E5E5EA'),
    primary: colors.primary,
    accent: colors.accent || '#D4AA7E',
    text: colors.text,
    subtext: colors.textMuted || (isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)'),
    border: colors.border || (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  // Steps: 0 (Intro), 1 (Your Story), 2 (Relationship Quiz), 3 (Preferences), 4 (Pairing)
  const [step, setStep] = useState(0);

  // Form state
  const [myName, setMyName] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [anniversaryDate, setAnniversaryDate] = useState(new Date());
  const [pendingDate, setPendingDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Quiz state (step 2)
  const [loveLanguage, setLoveLanguage] = useState(null);
  const [relationshipGoal, setRelationshipGoal] = useState(null);
  const [hasKids, setHasKids] = useState(null);
  const [idealDateStyle, setIdealDateStyle] = useState(null);
  const [communicationStyle, setCommunicationStyle] = useState(null);
  // Preference state (collected in step 2)
  const [, setSelectedSeason] = useState(null);
  const [selectedHeatLevel, setSelectedHeatLevel] = useState(2);
  const [selectedTone, setSelectedTone] = useState('warm');
  
  // Invitation state
  const [inviteCode, setInviteCode] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [linkedCoupleIdOverride, setLinkedCoupleIdOverride] = useState(null);
  const inviteInFlightRef = useRef(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const alreadyLinked = !!(linkedCoupleIdOverride || state?.coupleId || userProfile?.coupleId);

  useEffect(() => {
    const profileMyName = userProfile?.partnerNames?.myName || '';
    const profilePartnerName = userProfile?.partnerNames?.partnerName || '';
    const relationshipStartDate = userProfile?.relationshipStartDate;

    if (profileMyName) setMyName((current) => current || profileMyName);
    if (profilePartnerName) setPartnerName((current) => current || profilePartnerName);
    if (relationshipStartDate) {
      const parsed = new Date(relationshipStartDate);
      if (!Number.isNaN(parsed.getTime())) {
        setAnniversaryDate(parsed);
        setPendingDate(parsed);
      }
    }
  }, [userProfile]);

  const finalizeOnboarding = useCallback(async () => {
    AnalyticsService.track(AnalyticsEvent.ONBOARDING_COMPLETED);
    await actions.completeOnboarding();
    await markOnboardingComplete?.();
  }, [actions, markOnboardingComplete]);

  // ─── Poll for partner linking after invite code is generated ───
  useEffect(() => {
    if (!inviteCode) return;
    let active = true;
    let timer = null;

    const doPoll = async () => {
      try {
        const couple = await CoupleService.getMyCouple();
        if (couple?.couple_id && active) {
          const coupleId = couple.couple_id;

          // Cache couple ID locally; Supabase membership remains authoritative.
          await storage.set(STORAGE_KEYS.COUPLE_ID, coupleId);
          await StorageRouter.setActiveCoupleId(coupleId);
          setLinkedCoupleIdOverride(coupleId);
          try {
            await CloudEngine.joinCouple(coupleId);

            const partnerMembership = await CloudEngine.getPartnerMembership(coupleId);
            if (!partnerMembership?.user_id) {
              return;
            }
          } catch (err) {
            CrashReporting.captureException(err, { context: 'onboarding_partner_join' });
            return;
          }

          clearTimeout(timer);
          notification(NotificationFeedbackType.Success);
          // Complete onboarding immediately — don't wait for Alert button
          try {
            await finalizeOnboarding();
          } catch (err) {
            if (__DEV__) console.error('completeOnboarding failed:', err);
            // Retry dispatch directly as fallback
            try {
              await storage.set(STORAGE_KEYS.ONBOARDING_COMPLETED, true);
            } catch (_) {}
          }
          Alert.alert(
            'You\'re linked',
            'Your partner has joined. Your private space is ready.'
          );
          return; // stop polling after success
        }
      } catch (_) {}
      if (active) timer = setTimeout(doPoll, 3000);
    };

    timer = setTimeout(doPoll, 3000);
    return () => { active = false; clearTimeout(timer); };
  }, [finalizeOnboarding, inviteCode]);

  const transitionTo = useCallback((nextStep) => {
    AnalyticsService.track(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, { step: nextStep - 1 });
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -20, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      setStep(nextStep);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      ]).start();
    });
  }, [fadeAnim, slideAnim]);

  // 1. Intro Transition
  useEffect(() => {
    if (step === 0) {
      AnalyticsService.track(AnalyticsEvent.ONBOARDING_STARTED);
      const timer = setTimeout(() => {
        transitionTo(1);
      }, 12000); // 12 seconds — user can tap Get Started to skip
      return () => clearTimeout(timer);
    }
  }, [step, transitionTo]);

  useEffect(() => {
    if (step !== 0) {
      fadeAnim.setValue(0);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      ]).start();
    }
  }, [fadeAnim, slideAnim, step]);

  const daysCounting = useMemo(() => {
    const diffTime = Math.abs(Date.now() - anniversaryDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays.toLocaleString();
  }, [anniversaryDate]);

  const freePlanFeatures = useMemo(() => ([
    `Free users start with ${FREE_LIMITS.WEEK_0_PROMPTS} prompts, ${FREE_LIMITS.WEEK_0_DATES} date ideas, and ${FREE_LIMITS.WEEK_0_POSITIONS} sex positions`,
    `Free users add ${FREE_LIMITS.WEEKLY_PROMPTS} prompts, ${FREE_LIMITS.WEEKLY_DATES} date ideas, and ${FREE_LIMITS.WEEKLY_POSITIONS} sex position each week`,
    'All 5 heat levels, partner linking, shared notes, calendar, app lock, and recaps',
    'Keepsake collects the last 30 days of your shared story',
  ]), []);

  const premiumPlanFeatures = useMemo(() => ([
    `Premium users start with ${PREMIUM_LIMITS.WEEK_0_PROMPTS} prompts, ${PREMIUM_LIMITS.WEEK_0_DATES} date ideas, and ${PREMIUM_LIMITS.WEEK_0_POSITIONS} sex positions`,
    `Premium users add ${PREMIUM_LIMITS.WEEKLY_PROMPTS} prompts, ${PREMIUM_LIMITS.WEEKLY_DATES} date ideas, and ${PREMIUM_LIMITS.WEEKLY_POSITIONS} sex positions each week`,
    'Full Keepsake archive beyond the free 30-day window',
    'Vibe Signal, plus shared premium access for linked partners after sync',
  ]), []);

  const buildRelationshipProfileDraft = useCallback(() => {
    const quizData = {};

    if (loveLanguage) quizData.loveLanguage = loveLanguage;
    if (relationshipGoal) quizData.relationshipGoal = relationshipGoal;
    if (idealDateStyle) quizData.idealDateStyle = idealDateStyle;
    if (communicationStyle) quizData.communicationStyle = communicationStyle;
    if (hasKids === 'yes') quizData.hasKids = true;
    if (hasKids === 'no') quizData.hasKids = false;

    return quizData;
  }, [communicationStyle, hasKids, idealDateStyle, loveLanguage, relationshipGoal]);

  const saveRelationshipProfileDraft = useCallback(async () => {
    const quizData = buildRelationshipProfileDraft();
    if (!Object.keys(quizData).length) return null;

    await updateProfile?.({ quiz: quizData });
    await actions.updateProfile({ quiz: quizData });

    return quizData;
  }, [actions, buildRelationshipProfileDraft, updateProfile]);

  /**
   * Require an existing Supabase session. Never create one implicitly.
   */
  const ensureSupabaseSession = async () => {
    const supabase = getSupabaseOrThrow();
    const { data: { session: existing } } = await supabase.auth.getSession();
    if (existing) return existing;

    return null;
  };

  const handleGenerateInvitation = async () => {
    // Hard guard — prevent overlapping attempts (button tap or any async re-entry)
    if (inviteInFlightRef.current || isGenerating) return;
    inviteInFlightRef.current = true;
    setIsGenerating(true);
    notification(NotificationFeedbackType.Success);

    try {
      // 1. Save Profile info
      if (__DEV__) console.log("[invite] Step 1: updateProfile");
      await updateProfile?.({
        partnerNames: {
          myName: myName.trim(),
          partnerName: partnerName.trim(),
        },
        display_name: myName.trim(),
      });
      await actions.updateProfile({
        partnerNames: {
          myName: myName.trim(),
          partnerName: partnerName.trim(),
        },
      });
      if (__DEV__) console.log("[invite] Step 1b: updateRelationshipStartDate");
      await updateRelationshipStartDate(anniversaryDate.toISOString());

      // Ensure CloudEngine has a valid Supabase session for pairing operations
      if (__DEV__) console.log("[invite] Step 2: getSupabaseOrThrow");
      const supabase = getSupabaseOrThrow();
      if (__DEV__) console.log("[invite] Step 2b: getSession");
      let {
        data: { session },
      } = await supabase.auth.getSession();
      if (__DEV__) console.log("[invite] Step 2c: session =", !!session);

      if (!session) {
        if (__DEV__) console.log("[invite] Step 3: No signed-in cloud session");
        session = await ensureSupabaseSession();
        if (!session) {
          // Session still unavailable after recovery attempt — surface error, do not retry
          Alert.alert(
            "Sign-in required",
            "We couldn't establish a session. Please open Sync Setup and sign in, then try again.",
            [
              { text: "Open Sync Setup", onPress: () => navigation?.navigate?.("SyncSetup") },
              { text: "OK", style: "cancel" },
            ]
          );
          return;
        }
      }

      if (__DEV__) console.log("[invite] Step 4: CloudEngine.initialize");
      await CloudEngine.initialize({ supabaseSessionPresent: true });
      if (__DEV__) console.log("[invite] Step 4b: setSupabaseSession");
      await StorageRouter.setSupabaseSession(session);

      // 2. Generate a 6-character invite code via CoupleService
      if (__DEV__) console.log("[invite] Step 5: generateInviteCode");
      const result = await CoupleService.generateInviteCode();
      if (!result?.code) throw new Error('No invite code returned');
      if (__DEV__) console.log("[invite] Step 6: code =", result.code);
      
      setInviteCode(result.code);
      if (__DEV__) console.log("[invite] Complete! Code expires:", result.expiresAt);
    } catch (error) {
      const msg = String(error?.message || "");
      if (__DEV__) console.error("[invite] Error:", error?.name, msg, error?.stack?.slice(0, 500));
      Alert.alert(
        "Couldn't generate invitation",
        error?.message || "Please try again.",
        [
          {
            text: "Open Sync Setup",
            onPress: () => navigation?.navigate?.("SyncSetup"),
          },
          { text: "OK", style: "cancel" },
        ]
      );
    } finally {
      setIsGenerating(false);
      inviteInFlightRef.current = false;
    }
  };

  const handleShare = async () => {
    const shareMessage = `${myName || "I"} made a private space for us on Between Us. Join me so we can answer, reveal, and save our moments together:\n\nInvite Code: ${inviteCode}\n\nhttps://betweenus.app/join/${inviteCode}`;
    
    try {
      await Share.share({
        message: shareMessage,
        title: "Join me on Between Us",
      });
    } catch (error) {
      if (__DEV__) console.error(error);
    }
  };

  const renderPlanSection = ({ title, subtitle, icon, items, accentColor = t.primary }) => (
    <View style={[styles.planCard, { borderColor: t.border, backgroundColor: t.surface }]}>
      <View style={styles.planHeaderRow}>
        <View style={[styles.planIconWrap, { backgroundColor: `${accentColor}18` }]}>
          <Icon name={icon} size={18} color={accentColor} />
        </View>
        <View style={styles.planHeaderText}>
          <Text style={[styles.planTitle, { color: t.text }]}>{title}</Text>
          <Text style={[styles.planSubtitle, { color: t.subtext }]}>{subtitle}</Text>
        </View>
      </View>
      <View style={styles.planFeatureList}>
        {items.map((item) => (
          <View key={item} style={styles.planFeatureRow}>
            <Icon name="checkmark-circle-outline" size={17} color={accentColor} />
            <Text style={[styles.planFeatureText, { color: t.text }]}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderIntro = () => (
    <View style={{ flex: 1 }}>
      <HeartbeatEntry />
      <ReAnimated.View
        entering={FadeInDown.delay(1800).duration(700).springify()}
        style={{
          position: 'absolute',
          bottom: 80,
          left: 0,
          right: 0,
          paddingHorizontal: SPACING.xl,
          alignItems: 'center',
          gap: 14,
        }}
      >
        {[
          { icon: 'calendar-outline', text: 'Turn ordinary days into date ideas and memories' },
          { icon: 'heart-outline', text: 'A private space that becomes your story' },
        ].map((item) => (
          <View key={item.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon name={item.icon} size={18} color={t.primary} />
            <Text style={{ fontSize: 15, color: t.text, fontWeight: '500', flex: 1 }}>{item.text}</Text>
          </View>
        ))}
        <TouchableOpacity
          onPress={() => transitionTo(1)}
          activeOpacity={0.75}
          style={{
            marginTop: 10,
            backgroundColor: t.text,
            borderRadius: 14,
            paddingVertical: 14,
            paddingHorizontal: 40,
            alignSelf: 'stretch',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: t.surface, fontSize: 16, fontWeight: '700' }}>Make This Ours</Text>
        </TouchableOpacity>
      </ReAnimated.View>
    </View>
  );

  const renderYourStory = () => (
    <KeyboardAvoidingView 
      behavior="padding"
      style={styles.content}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ReAnimated.View entering={FadeInDown.delay(100).duration(600).springify()}>
          <Text style={styles.title}>Just the Two of You</Text>
          <Text style={styles.storySubtitle}>Between Us is not relationship homework. It is a private room for the love you are still choosing.</Text>
        </ReAnimated.View>

        {/* Sample prompt preview — show the value immediately */}
        <ReAnimated.View entering={FadeInDown.delay(150).duration(600).springify()}>
          <View style={[styles.samplePromptCard, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.samplePromptEyebrow, { color: t.primary }]}>TODAY'S MOMENT</Text>
            <Text style={[styles.samplePromptText, { color: t.text }]}>
              What's one small thing about your partner that still surprises you?
            </Text>
          </View>
        </ReAnimated.View>

        <ReAnimated.View entering={FadeInDown.delay(175).duration(600).springify()}>
          <Text style={styles.groupLabel}>WHAT'S INCLUDED</Text>
          {renderPlanSection({
            title: 'Free includes',
            subtitle: 'The core couple experience',
            icon: 'heart-outline',
            items: freePlanFeatures,
          })}
          {renderPlanSection({
            title: 'Premium adds',
            subtitle: 'Everything in free, plus a larger growing library',
            icon: 'sparkles-outline',
            items: premiumPlanFeatures,
            accentColor: t.accent,
          })}
        </ReAnimated.View>

        {/* Names Group (Apple List Style) */}
        <ReAnimated.View entering={FadeInDown.delay(200).duration(600).springify()}>
          <Text style={styles.groupLabel}>NAMES</Text>
          <View style={styles.groupCard}>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>My Name</Text>
              <TextInput
                style={styles.inputOverrides}
                placeholder="e.g. Alex"
                placeholderTextColor={t.subtext}
                value={myName}
                onChangeText={setMyName}
                accessibilityLabel="Your name"
                accessibilityHint="Enter your first name"
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Partner</Text>
              <TextInput
                style={styles.inputOverrides}
                placeholder="e.g. Jordan"
                placeholderTextColor={t.subtext}
                value={partnerName}
                onChangeText={setPartnerName}
                accessibilityLabel="Partner's name"
                accessibilityHint="Enter your partner's first name"
              />
            </View>
          </View>
        </ReAnimated.View>

        {/* Date Group */}
        <ReAnimated.View entering={FadeInDown.delay(300).duration(600).springify()}>
          <Text style={styles.groupLabel}>BEGINNINGS</Text>
          <View style={styles.groupCard}>
            <TouchableOpacity 
              onPress={() => {
                setPendingDate(anniversaryDate);
                setShowDatePicker(true);
              }}
              style={styles.dateDisplay}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Anniversary date: ${anniversaryDate.toLocaleDateString('en-US')}`}
              accessibilityHint="Tap to change your start date"
            >
              <Text style={styles.inputLabel}>Start Date</Text>
              <View style={styles.dateValueWrap}>
                <Text style={styles.dateText}>
                  {anniversaryDate.toLocaleDateString('en-US')}
                </Text>
                <Icon name="chevron-forward" size={20} color={t.subtext} />
              </View>
            </TouchableOpacity>
          </View>

          <Text style={styles.calculationText}>
            <Text style={{ color: t.primary, fontWeight: '700' }}>{daysCounting}</Text> days and counting.
          </Text>

          <Modal
            visible={showDatePicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowDatePicker(false)}
          >
              <TouchableWithoutFeedback onPress={() => setShowDatePicker(false)}>
                <View style={styles.datePickerBackdrop}>
                  <TouchableWithoutFeedback onPress={() => {}}>
                    <View style={styles.datePickerModalCard}>
                      <View style={styles.datePickerActions}>
                        <TouchableOpacity
                          style={styles.datePickerActionButton}
                          onPress={() => setShowDatePicker(false)}
                        >
                          <Text style={[styles.datePickerActionText, { color: t.subtext }]}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.datePickerActionButton}
                          onPress={() => {
                            setAnniversaryDate(pendingDate);
                            setShowDatePicker(false);
                          }}
                        >
                          <Text style={[styles.datePickerActionText, { color: t.primary }]}>Done</Text>
                        </TouchableOpacity>
                      </View>
                      <DateTimePicker
                        value={pendingDate}
                        mode="date"
                        display="spinner"
                        onChange={(event, date) => {
                          if (date) setPendingDate(date);
                        }}
                        textColor={t.text}
                        themeVariant={isDark ? 'dark' : 'light'}
                      />
                    </View>
                  </TouchableWithoutFeedback>
                </View>
              </TouchableWithoutFeedback>
            </Modal>
        </ReAnimated.View>

        <ReAnimated.View entering={FadeInDown.delay(400).duration(600).springify()}>
          <TouchableOpacity 
            style={[styles.primaryButtonTouch, { backgroundColor: t.text }]} 
            activeOpacity={0.8}
            onPress={() => {
              if (!myName.trim() || !partnerName.trim()) {
                Alert.alert('One more thing', "Please enter both your name and your partner's name to continue.");
                return;
              }
              Keyboard.dismiss();
              transitionTo(2);
            }}
            disabled={showDatePicker}
            accessibilityRole="button"
            accessibilityLabel="Continue to personalization"
          >
            <Text style={[styles.primaryButtonText, { color: t.surface }]}>Continue</Text>
          </TouchableOpacity>
        </ReAnimated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const LOVE_LANGUAGES = [
    { id: 'words', icon: 'chatbubble-ellipses-outline', label: 'Words of Affirmation' },
    { id: 'touch', icon: 'hand-left-outline', label: 'Physical Touch' },
    { id: 'time', icon: 'time-outline', label: 'Quality Time' },
    { id: 'gifts', icon: 'gift-outline', label: 'Receiving Gifts' },
    { id: 'service', icon: 'construct-outline', label: 'Acts of Service' },
  ];

  const RELATIONSHIP_GOALS = [
    { id: 'deeper', icon: 'heart-outline', label: 'Keep choosing each other' },
    { id: 'communicate', icon: 'chatbubbles-outline', label: 'Feel close on busy days' },
    { id: 'fun', icon: 'happy-outline', label: 'Have more fun together' },
    { id: 'intimacy', icon: 'flame-outline', label: 'Keep sex alive' },
    { id: 'grow', icon: 'leaf-outline', label: 'Build our private story' },
  ];

  const DATE_STYLES = [
    { id: 'home', icon: 'home-outline', label: 'Cozy nights in' },
    { id: 'adventure', icon: 'compass-outline', label: 'Adventures out' },
    { id: 'mixed', icon: 'shuffle-outline', label: 'A mix of both' },
  ];

  const COMMUNICATION_STYLES = [
    { id: 'direct', icon: 'arrow-forward-outline', label: 'Direct & honest' },
    { id: 'gentle', icon: 'water-outline', label: 'Gentle & careful' },
    { id: 'playful', icon: 'sparkles-outline', label: 'Playful & light' },
  ];

  const renderQuizOption = (item, selected, onSelect, accentColor) => {
    const isActive = selected === item.id;
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.listOptionRow, { paddingVertical: 14 }]}
        onPress={() => { onSelect(item.id); selection(); }}
        activeOpacity={0.7}
        accessibilityRole="radio"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={item.label}
      >
        <View style={[styles.iconWrap, { backgroundColor: isActive ? (accentColor || t.primary) + '15' : t.surfaceSecondary }]}>
          <Icon name={item.icon} size={20} color={isActive ? (accentColor || t.primary) : t.subtext} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.listOptionName, { color: isActive ? (accentColor || t.primary) : t.text }]}>
            {item.label}
          </Text>
        </View>
        {isActive && <Icon name="checkmark-outline" size={20} color={accentColor || t.primary} />}
      </TouchableOpacity>
    );
  };

  const renderQuiz = () => (
    <KeyboardAvoidingView behavior="padding" style={styles.content}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ReAnimated.View entering={FadeInDown.delay(100).duration(600).springify()}>
          <Text style={styles.title}>What Feels Like Us</Text>
          <Text style={styles.storySubtitle}>Optional signals for better prompts and date ideas. You can skip now and add or edit this anytime in Settings.</Text>
        </ReAnimated.View>

        {/* Love Language */}
        <ReAnimated.View entering={FadeInDown.delay(200).duration(600).springify()}>
          <Text style={styles.groupLabel}>YOUR LOVE LANGUAGE</Text>
          <View style={styles.groupCard}>
            {LOVE_LANGUAGES.map((item, index) => (
              <View key={item.id}>
                {renderQuizOption(item, loveLanguage, setLoveLanguage)}
                {index < LOVE_LANGUAGES.length - 1 && <View style={styles.dividerIndent} />}
              </View>
            ))}
          </View>
        </ReAnimated.View>

        {/* Relationship Goal */}
        <ReAnimated.View entering={FadeInDown.delay(300).duration(600).springify()}>
          <Text style={styles.groupLabel}>WHAT ARE YOU HOPING FOR?</Text>
          <View style={styles.groupCard}>
            {RELATIONSHIP_GOALS.map((item, index) => (
              <View key={item.id}>
                {renderQuizOption(item, relationshipGoal, setRelationshipGoal)}
                {index < RELATIONSHIP_GOALS.length - 1 && <View style={styles.dividerIndent} />}
              </View>
            ))}
          </View>
        </ReAnimated.View>

        {/* Ideal Date Style */}
        <ReAnimated.View entering={FadeInDown.delay(400).duration(600).springify()}>
          <Text style={styles.groupLabel}>DATE NIGHT STYLE</Text>
          <View style={styles.groupCard}>
            {DATE_STYLES.map((item, index) => (
              <View key={item.id}>
                {renderQuizOption(item, idealDateStyle, setIdealDateStyle)}
                {index < DATE_STYLES.length - 1 && <View style={styles.dividerIndent} />}
              </View>
            ))}
          </View>
        </ReAnimated.View>

        {/* Communication Style */}
        <ReAnimated.View entering={FadeInDown.delay(500).duration(600).springify()}>
          <Text style={styles.groupLabel}>HOW SHOULD THIS FEEL?</Text>
          <View style={styles.groupCard}>
            {COMMUNICATION_STYLES.map((item, index) => (
              <View key={item.id}>
                {renderQuizOption(item, communicationStyle, setCommunicationStyle)}
                {index < COMMUNICATION_STYLES.length - 1 && <View style={styles.dividerIndent} />}
              </View>
            ))}
          </View>
        </ReAnimated.View>

        {/* Kids */}
        <ReAnimated.View entering={FadeInDown.delay(600).duration(600).springify()}>
          <Text style={styles.groupLabel}>DO YOU HAVE KIDS?</Text>
          <View style={styles.groupCard}>
            {[{ id: 'yes', icon: 'people-outline', label: 'Yes' }, { id: 'no', icon: 'person-outline', label: 'No' }].map((item, index) => (
              <View key={item.id}>
                {renderQuizOption(item, hasKids, setHasKids)}
                {index < 1 && <View style={styles.dividerIndent} />}
              </View>
            ))}
          </View>
        </ReAnimated.View>

        <ReAnimated.View entering={FadeInDown.delay(700).duration(600).springify()}>
          <TouchableOpacity
            style={[styles.primaryButtonTouch, { backgroundColor: t.text }]}
            activeOpacity={0.8}
            onPress={async () => {
              Keyboard.dismiss();
              try {
                await saveRelationshipProfileDraft();
              } catch (e) {
                if (__DEV__) console.warn('Error saving relationship profile:', e);
              }
              transitionTo(3);
            }}
            accessibilityRole="button"
            accessibilityLabel="Save relationship profile and continue"
          >
            <Text style={[styles.primaryButtonText, { color: t.surface }]}>Save & Continue</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { Keyboard.dismiss(); transitionTo(3); }}
            style={{ marginTop: 16, alignItems: 'center' }}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel="Skip relationship profile for now"
          >
            <Text style={styles.skipLink}>Skip relationship profile for now</Text>
          </TouchableOpacity>
        </ReAnimated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const HEAT_LABELS = [
    { level: 1, icon: 'heart-outline',         color: HEAT_LEVEL_ACCENTS[1], name: 'Emotional',   description: 'Sweet, honest, and safe' },
    { level: 2, icon: 'heart-outline',         color: HEAT_LEVEL_ACCENTS[2], name: 'Romantic',    description: 'Flirty, tender, and warm' },
    { level: 3, icon: 'flame-outline',         color: HEAT_LEVEL_ACCENTS[3], name: 'Sensual',     description: 'Desire, touch, and closeness' },
    { level: 4, icon: 'flame-outline',         color: HEAT_LEVEL_ACCENTS[4], name: 'Steamy',      description: 'Adventurous and heated' },
    { level: 5, icon: 'flame-outline',         color: HEAT_LEVEL_ACCENTS[5], name: 'Explicit',    description: 'Only if you both want explicit' },
  ];

  const TONE_OPTIONS = NicknameEngine.TONE_OPTIONS;
  const tonePreview = useMemo(() => {
    const partner = partnerName || 'your partner';
    const map = {
      warm: {
        title: 'Warm Preview',
        body: `Something for you and ${partner}. A softer invitation, a little more tenderness.`,
      },
      playful: {
        title: 'Playful Preview',
        body: `Ready for this one, ${partner}? Lighter energy, more spark, less pressure.`,
      },
      intimate: {
        title: 'Intimate Preview',
        body: `Between you and ${partner}. Quieter words, deeper tension, closer moments.`,
      },
      minimal: {
        title: 'Minimal Preview',
        body: 'Today\'s prompt. Cleaner language, less noise, straight to the feeling.',
      },
    };
    return map[selectedTone] || map.warm;
  }, [selectedTone, partnerName]);

  const renderPreferences = () => (
    <KeyboardAvoidingView 
      behavior="padding"
      style={styles.content}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Personalize</Text>
        <Text style={styles.prefSubtitle}>Choose a starting tone. You can change this together anytime in Settings.</Text>

        {/* Season Selector */}
        <View style={styles.prefSection}>
          <SeasonSelector onSeasonChange={(id) => setSelectedSeason(id)} />
        </View>

        {/* Heat Level */}
        <View style={styles.prefSection}>
          <Text style={styles.groupLabel}>SHARED HEAT LEVEL</Text>
          <Text style={styles.prefSubtitle}>Start where you both feel good. Higher heat works best when you choose it together.</Text>
          <View style={styles.groupCard}>
            {HEAT_LABELS.map((h, index) => {
              const isActive = selectedHeatLevel === h.level;
              return (
                <View key={h.level}>
                  <TouchableOpacity
                    style={styles.listOptionRow}
                    onPress={() => {
                      setSelectedHeatLevel(h.level);
                      selection();
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.iconWrap, { backgroundColor: isActive ? h.color + '15' : t.surfaceSecondary }]}>
                      <Icon name={h.icon} size={20} color={isActive ? h.color : t.subtext} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.listOptionName, { color: isActive ? h.color : t.text }]}>
                        {h.name}
                      </Text>
                      <Text style={styles.listOptionDesc} numberOfLines={1}>
                        {h.description}
                      </Text>
                    </View>
                    {isActive && <Icon name="checkmark-outline" size={20} color={h.color} />}
                  </TouchableOpacity>
                  {index < HEAT_LABELS.length - 1 && <View style={styles.dividerIndent} />}
                </View>
              );
            })}
          </View>
        </View>

        {/* Tone */}
        <View style={styles.prefSection}>
          <Text style={styles.groupLabel}>APP TONE</Text>
          <View style={styles.groupCard}>
            {TONE_OPTIONS.map((toneItem, index) => {
              const isActive = selectedTone === toneItem.id;
              return (
                  <View key={toneItem.id}>
                    <TouchableOpacity
                    style={styles.listOptionRow}
                    onPress={() => {
                      setSelectedTone(toneItem.id);
                      selection();
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.iconWrap, { backgroundColor: isActive ? t.primary + '15' : t.surfaceSecondary }]}>
                      <Icon
                        name={toneItem.icon}
                        size={20}
                        color={isActive ? t.primary : t.subtext}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.listOptionName, { color: isActive ? t.primary : t.text }]}>
                        {toneItem.label}
                      </Text>
                      <Text style={styles.listOptionDesc} numberOfLines={1}>
                        {toneItem.preview.replace(/\{partner\}|\{partnerName\}/gi, partnerName || 'your partner')}
                      </Text>
                    </View>
                    {isActive && <Icon name="checkmark-outline" size={20} color={t.primary} />}
                  </TouchableOpacity>
                  {index < TONE_OPTIONS.length - 1 && <View style={styles.dividerIndent} />}
                </View>
              );
            })}
          </View>
          <View style={[styles.groupCard, { marginTop: 12, padding: 16 }]}> 
            <Text style={[styles.groupLabel, { marginBottom: 8 }]}>{tonePreview.title}</Text>
            <Text style={[styles.prefSubtitle, { marginBottom: 0 }]}>{tonePreview.body}</Text>
          </View>
        </View>

        {/* Energy */}
        <View style={styles.prefSection}>
          <Text style={styles.groupLabel}>ENERGY</Text>
          <View style={styles.groupCard}>
            <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
              <EnergyMatcher />
            </View>
          </View>
        </View>

        <ReAnimated.View entering={FadeInDown.delay(300).duration(600).springify()}>
          <TouchableOpacity 
            style={[styles.primaryButtonTouch, { backgroundColor: t.text }]} 
            activeOpacity={0.8}
            onPress={async () => {
              Keyboard.dismiss();
              // Save all preferences
              try {
                await updateProfile?.({
                  heatLevelPreference: selectedHeatLevel,
                  partnerNames: {
                    myName: myName.trim(),
                    partnerName: partnerName.trim(),
                  },
                  display_name: myName.trim(),
                });
                await actions.updateProfile({
                  heatLevelPreference: selectedHeatLevel,
                  partnerNames: {
                    myName: myName.trim(),
                    partnerName: partnerName.trim(),
                  },
                });
                await NicknameEngine.setConfig({
                  myNickname: myName,
                  partnerNickname: partnerName,
                  tone: selectedTone,
                });
                StorageRouter.updateCloudProfilePreferences({
                  nicknameConfig: {
                    myNickname: myName,
                    partnerNickname: partnerName,
                    tone: selectedTone,
                  },
                  tone: selectedTone,
                }).catch(() => {});
              } catch (e) {
                if (__DEV__) console.warn('Error saving onboarding preferences:', e);
              }
              transitionTo(4);
            }}
          >
            <Text style={[styles.primaryButtonText, { color: t.surface }]}>Continue</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { Keyboard.dismiss(); transitionTo(4); }}
            style={{ marginTop: 16, alignItems: 'center' }}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel="Skip personalization for now"
          >
            <Text style={styles.skipLink}>Skip for now</Text>
          </TouchableOpacity>
        </ReAnimated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderPairing = () => (
    <View style={styles.content}>
      <ReAnimated.View entering={FadeInDown.delay(100).duration(800).springify()}>
        <Text style={styles.title}>Your Private Space</Text>
      </ReAnimated.View>
      
      <View style={styles.pairingContainer}>
        <ReAnimated.View entering={FadeInDown.delay(200).duration(800).springify()}>
          <Icon 
            name="infinite-outline" 
            size={48} 
            color={t.primary} 
            style={{ marginBottom: 24, alignSelf: 'center' }} 
          />
          <Text style={styles.pairingSubtitle}>This is just for you two.</Text>
        </ReAnimated.View>
        
        {!inviteCode ? (
          <ReAnimated.View entering={FadeInDown.delay(350).duration(800).springify()} style={{ width: '100%', alignItems: 'center' }}>
            <TouchableOpacity 
              style={[styles.primaryButtonTouch, { backgroundColor: t.text }]}
              activeOpacity={0.8}
              onPress={handleGenerateInvitation}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <ActivityIndicator color={t.surface} />
              ) : (
                <Text style={[styles.primaryButtonText, { color: t.surface }]}>Generate Invite</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.primaryButtonTouch, { backgroundColor: 'transparent', borderWidth: 1, borderColor: t.border, marginTop: 12 }]}
              onPress={async () => { await finalizeOnboarding(); }}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Skip pairing and go to app"
            >
              <Text style={[styles.primaryButtonText, { color: t.text }]}>I'll link later</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.joinCodeButton, { marginTop: 12 }]}
              onPress={() => navigation.navigate('ConnectPartner')}
              activeOpacity={0.7}
            >
              <Text style={styles.joinCodeButtonText}>I have a code</Text>
            </TouchableOpacity>
          </ReAnimated.View>
        ) : (
          <ReAnimated.View entering={FadeInDown.duration(600).springify()} style={{ width: '100%' }}>
            
            <View style={styles.groupCard}>
              <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>MESSAGE PREVIEW</Text>
                <Text style={styles.previewText}>
                  "Join our private space on Between Us. I want us to answer, reveal, and save little moments together."
                </Text>
              </View>

              <View style={styles.divider} />

              <TouchableOpacity 
                style={styles.inviteRow} 
                onPress={() => {
                  Clipboard.setStringAsync(inviteCode);
                  notification(NotificationFeedbackType.Success);
                }}
                activeOpacity={0.7}
              >
                <View>
                  <Text style={styles.codeLabel}>YOUR INVITE CODE</Text>
                  <Text style={styles.codeText}>{inviteCode}</Text>
                </View>
                <Icon name="copy-outline" size={24} color={t.primary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.primaryButtonTouch, { backgroundColor: t.text, marginTop: SPACING.xl }]} 
              activeOpacity={0.8}
              onPress={handleShare} 
            >
              <Text style={[styles.primaryButtonText, { color: t.surface }]}>Send Invitation</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={async () => {
                await finalizeOnboarding();
              }}
              style={{ marginTop: 32 }}
            >
              <Text style={styles.skipLink}>I'll send it later</Text>
            </TouchableOpacity>
          </ReAnimated.View>
        )}
      </View>
    </View>
  );

  const renderLinkedPairing = () => (
    <View style={styles.content}>
      <ReAnimated.View entering={FadeInDown.delay(100).duration(800).springify()}>
        <Text style={styles.title}>Pairing</Text>
      </ReAnimated.View>

      <View style={styles.pairingContainer}>
        <ReAnimated.View entering={FadeInDown.delay(200).duration(800).springify()}>
          <Icon
            name="checkmark-circle-outline"
            size={48}
            color={t.primary}
            style={{ marginBottom: 24, alignSelf: 'center' }}
          />
          <Text style={styles.pairingSubtitle}>Already connected.</Text>
          <Text style={styles.pairingBody}>
            Your account is already linked with your partner, so there is nothing else to generate here.
          </Text>
        </ReAnimated.View>

        <ReAnimated.View entering={FadeInDown.delay(350).duration(800).springify()} style={{ width: '100%', alignItems: 'center' }}>
          <TouchableOpacity
            style={[styles.primaryButtonTouch, { backgroundColor: t.text }]}
            activeOpacity={0.8}
            onPress={finalizeOnboarding}
          >
            <Text style={[styles.primaryButtonText, { color: t.surface }]}>Continue to app</Text>
          </TouchableOpacity>
        </ReAnimated.View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />

      {step === 0 ? renderIntro() : (
        <Animated.View style={[styles.stepWrapper, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {step === 1 ? renderYourStory() : step === 2 ? renderQuiz() : step === 3 ? renderPreferences() : alreadyLinked ? renderLinkedPairing() : renderPairing()}
        </Animated.View>
      )}

    </SafeAreaView>
  );
}

// ------------------------------------------------------------------
// STYLES - Apple Editorial
// ------------------------------------------------------------------
const createStyles = (t, isDark) => {
  const systemFont = Platform.select({ ios: "System", android: "Roboto" });

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.background, 
    },
    stepWrapper: {
      flex: 1,
    },
    content: {
      flex: 1,
      paddingTop: Platform.OS === 'android' ? 60 : 40,
    },
    scrollContent: {
      paddingBottom: 40,
      paddingHorizontal: SPACING.xl,
    },

    // ── Typography ──
    title: {
      fontFamily: systemFont,
      fontSize: 34,
      fontWeight: '800',
      color: t.text,
      letterSpacing: 0.3,
      marginBottom: SPACING.sm,
    },
    storySubtitle: {
      fontSize: 16,
      color: t.subtext,
      marginBottom: SPACING.lg,
      fontWeight: '500',
    },

    // ── Sample Prompt Preview ──
    samplePromptCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: SPACING.lg,
      marginBottom: SPACING.xl,
    },
    samplePromptEyebrow: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: SPACING.sm,
    },
    samplePromptText: {
      fontSize: 18,
      fontWeight: '700',
      lineHeight: 26,
      letterSpacing: -0.3,
      marginBottom: SPACING.sm,
    },
    samplePromptHint: {
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 18,
    },
    planCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: SPACING.lg,
      marginBottom: SPACING.md,
    },
    planHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: SPACING.md,
    },
    planIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    planHeaderText: {
      flex: 1,
      minWidth: 0,
    },
    planTitle: {
      fontSize: 17,
      fontWeight: '800',
      marginBottom: 2,
    },
    planSubtitle: {
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    planFeatureList: {
      gap: 10,
    },
    planFeatureRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 9,
    },
    planFeatureText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
    },

    // ── Grouped Apple Lists ──
    groupLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: t.subtext,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: SPACING.sm,
      paddingLeft: SPACING.xs,
    },
    groupCard: {
      backgroundColor: t.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: t.border,
      marginBottom: SPACING.xxl,
      overflow: 'hidden',
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      paddingVertical: 12,
    },
    inputLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: t.text,
      width: 100, // Fixed width for alignment
    },
    inputOverrides: {
      flex: 1,
      fontSize: 16,
      color: t.text,
      padding: 0,
      textAlign: 'right', // Align input to right like iOS settings
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.border,
    },
    dividerIndent: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.border,
      marginLeft: 60, // Indent past the icon
    },

    // ── Date Display ──
    dateDisplay: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingVertical: 16,
    },
    dateValueWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    dateText: {
      fontSize: 16,
      color: t.subtext,
      fontWeight: '400',
    },
    calculationText: {
      fontSize: 15,
      color: t.subtext,
      textAlign: 'center',
      marginTop: -8,
      marginBottom: SPACING.lg,
    },
    
    // ── Primary Action Button ──
    primaryButtonTouch: {
      marginTop: SPACING.md,
      borderRadius: 28,
      height: 56,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: isDark ? 0 : 0.15, shadowRadius: 12 },
        android: { elevation: 4 },
      }),
    },
    primaryButtonText: {
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.2,
    },

    // ── Date Picker Modal ──
    datePickerBackdrop: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
      paddingHorizontal: 16,
      paddingBottom: 32,
    },
    datePickerModalCard: {
      borderRadius: 24,
      backgroundColor: t.surfaceSecondary,
      overflow: 'hidden',
    },
    datePickerActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.border,
      backgroundColor: t.surface,
    },
    datePickerActionButton: {
      paddingVertical: 16,
      paddingHorizontal: SPACING.sm,
    },
    datePickerActionText: {
      fontSize: 16,
      fontWeight: '600',
    },

    // ── Preferences List Items ──
    prefSubtitle: {
      fontSize: 16,
      color: t.subtext,
      marginBottom: SPACING.xl,
      fontWeight: '500',
    },
    prefSection: {
      marginBottom: SPACING.lg,
    },
    listOptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.lg,
      gap: 16,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 8, // Apple standard squircle icon wrapper
      alignItems: 'center',
      justifyContent: 'center',
    },
    listOptionName: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 2,
    },
    listOptionDesc: {
      fontSize: 14,
      color: t.subtext,
    },

    // ── Pairing Screen ──
    pairingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: -80, // Offset for visual center
    },
    pairingSubtitle: {
      fontFamily: systemFont,
      fontSize: 28,
      fontWeight: '800',
      color: t.text,
      textAlign: 'center',
      marginBottom: SPACING.sm,
      letterSpacing: -0.5,
    },
    pairingBody: {
      fontSize: 16,
      color: t.subtext,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: SPACING.xxxl,
      paddingHorizontal: SPACING.md,
    },
    joinCodeButton: {
      marginTop: SPACING.lg,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
      width: '100%',
      alignItems: 'center',
    },
    joinCodeButtonText: {
      color: t.text,
      fontSize: 16,
      fontWeight: '600',
    },
    skipLink: {
      color: t.subtext,
      fontSize: 15,
      fontWeight: '500',
    },
    
    // ── Invite Code Preview ──
    previewBox: {
      padding: SPACING.lg,
      backgroundColor: t.surfaceSecondary,
    },
    previewLabel: {
      color: t.subtext,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.5,
      marginBottom: 8,
    },
    previewText: {
      color: t.text,
      fontSize: 16,
      fontWeight: '400',
      lineHeight: 24,
    },
    inviteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: SPACING.lg,
    },
    codeLabel: {
      color: t.subtext,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.5,
      marginBottom: 4,
    },
    codeText: {
      color: t.text,
      fontSize: 32,
      fontWeight: '800',
      letterSpacing: 4,
    },

    // ── Cloud Auth Modal (Apple System Alert Style) ──
    cloudAuthOverlay: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    cloudAuthCard: {
      width: '100%',
      backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
      borderRadius: 14,
      alignItems: 'center',
      overflow: 'hidden',
    },
    cloudAuthTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: t.text,
      marginTop: 20,
      marginBottom: 4,
      textAlign: 'center',
    },
    cloudAuthBody: {
      fontSize: 13,
      color: t.subtext,
      textAlign: 'center',
      marginBottom: 16,
      paddingHorizontal: 16,
    },
    cloudAuthInputWrap: {
      width: '100%',
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    cloudAuthInput: {
      backgroundColor: t.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      borderRadius: 6,
      padding: 10,
      fontSize: 14,
      color: t.text,
    },
    cloudAuthBtns: {
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.border,
    },
    cloudAuthBtn: {
      flex: 1,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cloudAuthCancelText: {
      fontSize: 17,
      color: '#007AFF', // Standard iOS Blue
      fontWeight: '400',
    },
    cloudAuthConfirmText: {
      fontSize: 17,
      color: '#007AFF',
      fontWeight: '600', // Bold for positive action
    },
  });
};
