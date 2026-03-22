import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  Animated,
  Share,
  TextInput,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import ReAnimated, { FadeInDown } from 'react-native-reanimated';
import DateTimePicker from "@react-native-community/datetimepicker";
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import * as Clipboard from "expo-clipboard";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppContext } from "../context/AppContext";
import { useContent } from "../context/ContentContext";
import { useTheme } from "../context/ThemeContext";
import { TYPOGRAPHY, COLORS } from "../utils/theme";
import HeartbeatEntry from "../components/HeartbeatEntry";
import GlassCard from "../components/GlassCard";
import CrashReporting from "../services/CrashReporting";
import { useAuth } from "../context/AuthContext";
import SeasonSelector from "../components/SeasonSelector";
import EnergyMatcher from "../components/EnergyMatcher";
import { NicknameEngine, SEASONS } from "../services/PolishEngine";
import CloudEngine from "../services/storage/CloudEngine";
import CoupleKeyService from "../services/security/CoupleKeyService";
import CoupleService from "../services/supabase/CoupleService";
import StorageRouter from "../services/storage/StorageRouter";
import SupabaseAuthService from "../services/supabase/SupabaseAuthService";
import { cloudSyncStorage, STORAGE_KEYS, storage } from "../utils/storage";
import { getSupabaseOrThrow } from "../config/supabase";

const { width } = Dimensions.get("window");

export default function OnboardingScreen({ navigation }) {
  const { actions } = useAppContext();
  const { colors, isDark } = useTheme();
  const { updateRelationshipStartDate } = useContent();
  const { user } = useAuth();
  
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Steps: 0 (Intro), 1 (Your Story), 2 (Preferences), 3 (Pairing)
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Form state
  const [myName, setMyName] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [anniversaryDate, setAnniversaryDate] = useState(new Date());
  const [pendingDate, setPendingDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Preference state (collected in step 2)
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [selectedHeatLevel, setSelectedHeatLevel] = useState(2);
  const [selectedTone, setSelectedTone] = useState('warm');
  
  // Invitation state
  const [inviteCode, setInviteCode] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Cloud auth modal state (for inline Supabase session bridging)
  const [showCloudAuth, setShowCloudAuth] = useState(false);
  const [cloudAuthPw, setCloudAuthPw] = useState('');
  const [cloudAuthBusy, setCloudAuthBusy] = useState(false);
  const cloudAuthResolve = useRef(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // ─── Poll for partner linking after invite code is generated ───
  useEffect(() => {
    if (!inviteCode) return;
    let active = true;
    const poll = setInterval(async () => {
      try {
        const couple = await CoupleService.getMyCouple();
        if (couple?.couple_id && active) {
          clearInterval(poll);
          // Store couple ID locally
          await storage.set(STORAGE_KEYS.COUPLE_ID, couple.couple_id);
          await StorageRouter.setActiveCoupleId(couple.couple_id);
          // Upload our public key to the new couple membership
          try {
            const myPubKey = await CoupleKeyService.getDevicePublicKeyB64();
            await CloudEngine.joinCouple(couple.couple_id, myPubKey).catch(() => {});
          } catch (err) {
            CrashReporting.captureException(err, { context: 'onboarding_key_upload' });
          }
          notification(NotificationFeedbackType.Success);
          Alert.alert(
            'You\'re linked! 💕',
            `Your partner has joined. You\'re now connected on Between Us.`,
            [{ text: 'Let\'s go!', onPress: () => actions.completeOnboarding() }]
          );
        }
      } catch (_) {}
    }, 3000);
    return () => { active = false; clearInterval(poll); };
  }, [inviteCode]);

  // 1. Intro Transition
  useEffect(() => {
    if (step === 0) {
      const timer = setTimeout(() => {
        transitionTo(1);
      }, 4000); // 4 seconds for Pulse & Quote
      return () => clearTimeout(timer);
    }
  }, [step]);

  const transitionTo = (nextStep) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -20, duration: 400, useNativeDriver: true }),
    ]).start(() => {
      setStep(nextStep);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start();
    });
  };

  useEffect(() => {
    if (step !== 0) {
      fadeAnim.setValue(0);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start();
    }
  }, [step]);

  const daysCounting = useMemo(() => {
    const diffTime = Math.abs(new Date() - anniversaryDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays.toLocaleString();
  }, [anniversaryDate]);

  /**
   * Ensure a Supabase session exists. If not, show an inline password
   * modal so the user can set up their cloud account without leaving onboarding.
   */
  const ensureSupabaseSession = async () => {
    const supabase = getSupabaseOrThrow();
    const { data: { session: existing } } = await supabase.auth.getSession();
    if (existing) return existing;

    const email = user?.email;
    if (!email) return null;

    return new Promise((resolve) => {
      cloudAuthResolve.current = resolve;
      setCloudAuthPw('');
      setShowCloudAuth(true);
    });
  };

  const handleCloudAuthDone = async () => {
    const email = user?.email;
    const pw = cloudAuthPw;
    if (!pw || pw.length < 6) {
      Alert.alert('Invalid password', 'Password must be at least 6 characters.');
      return;
    }
    setCloudAuthBusy(true);
    try {
      let session = null;
      try { session = await SupabaseAuthService.signInWithPassword(email, pw); } catch (_) {}
      if (!session) {
        session = await SupabaseAuthService.signUp(email, pw);
        if (!session) {
          try { session = await SupabaseAuthService.signInWithPassword(email, pw); } catch (_) {}
        }
      }
      if (session) {
        await StorageRouter.setSupabaseSession(session);
        await cloudSyncStorage.setSyncStatus({ enabled: true, email: session.user?.email || email });
        await StorageRouter.configureSync({ isPremium: true, syncEnabled: true, supabaseSessionPresent: true });
      }
      setShowCloudAuth(false);
      cloudAuthResolve.current?.(session);
    } catch (err) {
      Alert.alert('Sign-in failed', err?.message || 'Please try again.');
    } finally {
      setCloudAuthBusy(false);
    }
  };

  const handleCloudAuthCancel = () => {
    setShowCloudAuth(false);
    cloudAuthResolve.current?.(null);
  };

  const handleGenerateInvitation = async () => {
    setIsGenerating(true);
    notification(NotificationFeedbackType.Success);

    try {
      // 1. Save Profile info
      if (__DEV__) console.log("🔑 [invite] Step 1: updateProfile");
      await actions.updateProfile({
        partnerNames: {
          myName: myName || "Partner A",
          partnerName: partnerName || "Partner B",
        },
      });
      if (__DEV__) console.log("🔑 [invite] Step 1b: updateRelationshipStartDate");
      await updateRelationshipStartDate(anniversaryDate.toISOString());

      // Ensure CloudEngine has a valid Supabase session for pairing operations
      if (__DEV__) console.log("🔑 [invite] Step 2: getSupabaseOrThrow");
      const supabase = getSupabaseOrThrow();
      if (__DEV__) console.log("🔑 [invite] Step 2b: getSession");
      let {
        data: { session },
      } = await supabase.auth.getSession();
      if (__DEV__) console.log("🔑 [invite] Step 2c: session =", !!session);

      if (!session) {
        if (__DEV__) console.log("🔑 [invite] Step 3: No session — prompting for password");
        session = await ensureSupabaseSession();
        if (!session) {
          setIsGenerating(false);
          return;
        }
      }

      if (__DEV__) console.log("🔑 [invite] Step 4: CloudEngine.initialize");
      await CloudEngine.initialize({ supabaseSessionPresent: true });
      if (__DEV__) console.log("🔑 [invite] Step 4b: setSupabaseSession");
      await StorageRouter.setSupabaseSession(session);

      // 2. Generate a 6-character invite code via CoupleService
      if (__DEV__) console.log("🔑 [invite] Step 5: generateInviteCode");
      const result = await CoupleService.generateInviteCode();
      if (__DEV__) console.log("🔑 [invite] Step 6: code =", result.code);
      
      setInviteCode(result.code);
      if (__DEV__) console.log("🔑 [invite] ✅ Complete! Code expires:", result.expiresAt);
    } catch (error) {
      const msg = String(error?.message || "");
      console.error("🔑 [invite] ❌ Error:", error?.name, msg, error?.stack?.slice(0, 500));
      if (msg.toLowerCase().includes("cloud pairing is not signed in yet")) {
        // Try the inline password prompt instead of navigating away
        const retrySession = await ensureSupabaseSession();
        if (retrySession) {
          // Retry the whole flow
          setIsGenerating(false);
          handleGenerateInvitation();
        }
        return;
      }

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
    }
  };

  const handleShare = async () => {
    const shareMessage = `Reach across the digital void. ${myName || "I"} am inviting you to Between Us. Join our private space here:\n\nInvite Code: ${inviteCode}\n\nhttps://betweenus.app/join/${inviteCode}`;
    
    try {
      await Share.share({
        message: shareMessage,
        title: "Join me on Between Us",
      });
    } catch (error) {
      console.error(error);
    }
  };

  const renderIntro = () => <HeartbeatEntry />;

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
          <Text style={[TYPOGRAPHY.display, styles.title]}>Your Story</Text>
          <Text style={styles.storySubtitle}>Tell us a little about your relationship</Text>
        </ReAnimated.View>

        {/* Names Card */}
        <ReAnimated.View entering={FadeInDown.delay(200).duration(600).springify()}>
          <GlassCard variant="elevated" glow={false} style={styles.storyCard}>
            <View style={styles.storyCardHeader}>
              <View style={[styles.cardIconWrap, { backgroundColor: colors.primary + '15' }]}>
                <MaterialCommunityIcons name="account-heart-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.storyCardTitle}>Who's in this love story?</Text>
            </View>

            <View style={styles.storyFieldColumn}>
              <View style={styles.storyFieldGroup}>
                <Text style={styles.storyFieldLabel} numberOfLines={1}>YOUR NAME</Text>
                <TextInput
                  style={styles.storyInput}
                  placeholder="e.g. Alex"
                  placeholderTextColor={colors.text + '30'}
                  value={myName}
                  onChangeText={setMyName}
                  accessibilityLabel="Your name"
                  accessibilityHint="Enter your first name"
                />
              </View>
              
              <View style={styles.storyFieldGroup}>
                <Text style={styles.storyFieldLabel} numberOfLines={1}>PARTNER'S NAME</Text>
                <TextInput
                  style={styles.storyInput}
                  placeholder="e.g. Jordan"
                  placeholderTextColor={colors.text + '30'}
                  value={partnerName}
                  onChangeText={setPartnerName}
                  accessibilityLabel="Partner's name"
                  accessibilityHint="Enter your partner's first name"
                />
              </View>
            </View>
          </GlassCard>
        </ReAnimated.View>

        {/* Date Card */}
        <ReAnimated.View entering={FadeInDown.delay(300).duration(600).springify()}>
          <GlassCard variant="elevated" style={styles.storyCard}>
            <View style={styles.storyCardHeader}>
              <View style={[styles.cardIconWrap, { backgroundColor: colors.primary + '15' }]}>
                <MaterialCommunityIcons name="calendar-heart" size={20} color={colors.primary} />
              </View>
              <Text style={styles.storyCardTitle}>When did it all begin?</Text>
            </View>
            
            <TouchableOpacity 
              onPress={() => {
                setPendingDate(anniversaryDate);
                setShowDatePicker(true);
              }}
              style={styles.dateDisplay}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Anniversary date: ${anniversaryDate.toLocaleDateString('en-US')}`}
              accessibilityHint="Tap to change your relationship start date"
            >
              <Text style={styles.dateText}>
                {anniversaryDate.toLocaleDateString('en-US')}
              </Text>
            </TouchableOpacity>

            <Text style={styles.calculationText}>
              <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{daysCounting}</Text> days and counting
            </Text>

            {/* Simple Celebration Animation triggered when days > 0 */}
            {daysCounting !== '0' && (
              <View style={styles.celebrationContainer}>
                <MaterialCommunityIcons name="heart" size={24} color={colors.primary} />
              </View>
            )}

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
                        <DateTimePicker
                          value={pendingDate}
                          mode="date"
                          display="spinner"
                          onChange={(event, date) => {
                            if (date) setPendingDate(date);
                          }}
                          textColor={colors.text}
                        />

                        <View style={styles.datePickerActions}>
                          <TouchableOpacity
                            style={styles.datePickerActionButton}
                            onPress={() => setShowDatePicker(false)}
                          >
                            <Text style={[styles.datePickerActionText, { color: colors.textMuted }]}>Cancel</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.datePickerActionButton}
                            onPress={() => {
                              setAnniversaryDate(pendingDate);
                              setShowDatePicker(false);
                            }}
                          >
                            <Text style={[styles.datePickerActionText, { color: colors.primary }]}>Done</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableWithoutFeedback>
                  </View>
                </TouchableWithoutFeedback>
              </Modal>
          </GlassCard>
        </ReAnimated.View>

        <ReAnimated.View entering={FadeInDown.delay(400).duration(600).springify()}>
          <TouchableOpacity 
            style={styles.primaryButtonTouch} 
            activeOpacity={0.8}
            onPress={() => {
              Keyboard.dismiss();
              transitionTo(2);
            }}
            disabled={showDatePicker}
            accessibilityRole="button"
            accessibilityLabel="Continue to preferences"
          >
            <LinearGradient
              colors={[colors.primary, colors.primary + 'D0']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.primaryButtonGradient}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
              <Feather name="arrow-right" size={20} color="#F2E9E6" style={{ marginLeft: 8 }} />
            </LinearGradient>
          </TouchableOpacity>
        </ReAnimated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const HEAT_LABELS = [
    { level: 1, icon: 'heart-outline',        color: '#8B6BA0', name: 'Emotional Connection', description: 'Intimacy & trust' },
    { level: 2, icon: 'heart-multiple-outline', color: '#C2607A', name: 'Flirty & Romantic',    description: 'Flirty & tender' },
    { level: 3, icon: 'candle',                color: '#D4834A', name: 'Sensual',               description: 'Desire & closeness' },
    { level: 4, icon: 'fire',                  color: '#D0504A', name: 'Steamy',                description: 'Adventurous & heated' },
    { level: 5, icon: 'fire-alert',            color: '#B03030', name: 'Explicit',              description: 'Intensely passionate' },
  ];

  const TONE_OPTIONS = NicknameEngine.TONE_OPTIONS;

  const renderPreferences = () => (
    <KeyboardAvoidingView 
      behavior="padding"
      style={styles.content}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[TYPOGRAPHY.display, styles.title]}>Personalize</Text>
        <Text style={styles.prefSubtitle}>These shape what the app suggests. Change anytime in Settings.</Text>

        {/* Season Selector */}
        <View style={styles.prefSection}>
          <SeasonSelector onSeasonChange={(id) => setSelectedSeason(id)} />
        </View>

        {/* Heat Level */}
        <View style={styles.prefSection}>
          <Text style={styles.prefLabel}>COMFORT LEVEL</Text>
          <Text style={styles.prefHint}>Choose what kind of prompts you want</Text>
          <View style={styles.heatGrid}>
            {HEAT_LABELS.map((h, index) => {
              const isActive = selectedHeatLevel === h.level;
              return (
                <ReAnimated.View
                  key={h.level}
                  entering={FadeInDown.delay(100 + index * 70).duration(400).springify().damping(16)}
                >
                  <TouchableOpacity
                    style={[
                      styles.heatOption,
                      { 
                        borderColor: isActive ? h.color : 'rgba(255,255,255,0.05)',
                        backgroundColor: isActive ? h.color + '15' : 'rgba(255,255,255,0.02)',
                        opacity: isActive ? 1 : 0.5,
                        transform: [{ scale: isActive ? 1 : 0.98 }]
                      },
                    ]}
                    onPress={() => {
                      setSelectedHeatLevel(h.level);
                      selection();
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.heatIconWrap, { backgroundColor: isActive ? h.color + '20' : 'rgba(255,255,255,0.05)' }]}>
                      <MaterialCommunityIcons name={h.icon} size={20} color={isActive ? h.color : colors.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.heatName, { color: isActive ? h.color : colors.text }]}>
                        {h.name}
                      </Text>
                      <Text style={[styles.heatDesc, { color: colors.textMuted }]} numberOfLines={1}>
                        {h.description}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </ReAnimated.View>
              );
            })}
          </View>
        </View>

        {/* Tone */}
        <View style={styles.prefSection}>
          <Text style={styles.prefLabel}>APP TONE</Text>
          <Text style={styles.prefHint}>How should the app talk to you?</Text>
          <View style={styles.toneGrid}>
            {TONE_OPTIONS.map((t) => {
              const isActive = selectedTone === t.id;
              return (
                  <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.toneOption,
                    { 
                      borderColor: isActive ? colors.primary : 'rgba(255,255,255,0.05)',
                      backgroundColor: isActive ? colors.primary + '15' : 'rgba(255,255,255,0.02)',
                      opacity: isActive ? 1 : 0.5,
                      transform: [{ scale: isActive ? 1 : 0.98 }]
                    },
                  ]}
                  onPress={() => {
                    setSelectedTone(t.id);
                    selection();
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.heatIconWrap, { backgroundColor: isActive ? colors.primary + '20' : 'rgba(255,255,255,0.05)' }]}>
                    <MaterialCommunityIcons
                      name={t.icon}
                      size={20}
                      color={isActive ? colors.primary : colors.textMuted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.toneName, { color: isActive ? colors.primary : colors.text }]}>
                      {t.label}
                    </Text>
                    <Text style={[styles.tonePreview, { color: colors.textMuted }]} numberOfLines={1}>
                      {t.preview.replace(/\{partner\}|\{partnerName\}/gi, partnerName || 'your partner')}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <ReAnimated.View entering={FadeInDown.delay(300).duration(600).springify()}>
          <TouchableOpacity 
            style={styles.primaryButtonTouch} 
            activeOpacity={0.8}
            onPress={async () => {
              Keyboard.dismiss();
              // Save all preferences
              try {
                // Save heat level
                await actions.updateProfile({
                  heatLevelPreference: selectedHeatLevel,
                  partnerNames: {
                    myName: myName || 'Partner A',
                    partnerName: partnerName || 'Partner B',
                  },
                });
                // Save tone
                await NicknameEngine.setConfig({
                  myNickname: myName,
                  partnerNickname: partnerName,
                  tone: selectedTone,
                });
              } catch (e) {
                console.warn('Error saving onboarding preferences:', e);
              }
              transitionTo(3);
            }}
          >
            <LinearGradient
              colors={[colors.primary, colors.primary + 'D0']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.primaryButtonGradient}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
              <Feather name="arrow-right" size={20} color="#F2E9E6" style={{ marginLeft: 8 }} />
            </LinearGradient>
          </TouchableOpacity>
        </ReAnimated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderPairing = () => (
    <View style={styles.content}>
      <ReAnimated.View entering={FadeInDown.delay(100).duration(800).springify()}>
        <Text style={[TYPOGRAPHY.display, styles.title]}>Pairing</Text>
      </ReAnimated.View>
      
      <View style={styles.pairingContainer}>
        <ReAnimated.View entering={FadeInDown.delay(200).duration(800).springify()}>
          <MaterialCommunityIcons 
            name="infinity" 
            size={48} 
            color={colors.primary} 
            style={{ marginBottom: 24, alignSelf: 'center', opacity: 0.8 }} 
          />
          <Text style={[TYPOGRAPHY.h2, styles.pairingSubtitle]}>Reach across the digital void.</Text>
          <Text style={styles.pairingBody}>
            Invite your partner to connect their app to yours. Your shared memory starts here.
          </Text>
        </ReAnimated.View>
        
        {!inviteCode ? (
          <ReAnimated.View entering={FadeInDown.delay(350).duration(800).springify()} style={{ width: '100%', alignItems: 'center' }}>
            <TouchableOpacity 
              style={styles.generateInviteButtonTouch}
              activeOpacity={0.8}
              onPress={handleGenerateInvitation}
              disabled={isGenerating}
              accessibilityRole="button"
              accessibilityLabel="Generate invitation"
              accessibilityHint="Creates a code to invite your partner"
              accessibilityState={{ disabled: isGenerating }}
            >
              <LinearGradient
                colors={[colors.primary, colors.primary + 'D0']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                style={styles.generateInviteButtonGradient}
              >
                {isGenerating ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="creation" size={20} color="#F2E9E6" style={{ marginRight: 8 }} />
                    <Text style={styles.generateInviteButtonText}>Generate Invitation</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.joinCodeButton}
              onPress={() => navigation.navigate('JoinWithCode')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="I have an invite code"
              accessibilityHint="Enter an invite code from your partner"
            >
              <MaterialCommunityIcons name="key-variant" size={20} color={colors.primary} />
              <Text style={styles.joinCodeButtonText}>I have a code</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={async () => {
                await actions.completeOnboarding();
              }}
              style={{ marginTop: 32 }}
              activeOpacity={0.6}
            >
              <Text style={styles.skipLink}>I'll link later</Text>
            </TouchableOpacity>
          </ReAnimated.View>
        ) : (
          <ReAnimated.View entering={FadeInDown.duration(600).springify()} style={{ width: '100%' }}>
            <GlassCard variant="elevated" glow={true} style={styles.inviteCard}>
              <View style={styles.previewBox}>
                <View style={styles.previewHeaderRow}>
                  <MaterialCommunityIcons name="message-text-outline" size={16} color={colors.primary} />
                  <Text style={styles.previewLabel}>MESSAGE PREVIEW</Text>
                </View>

                <Text style={styles.previewText}>
                  "I am inviting you to connect on Between Us. Use my code to join our private space."
                </Text>
              </View>

              <TouchableOpacity 
                style={styles.inviteRow} 
                onPress={() => {
                  Clipboard.setStringAsync(inviteCode);
                  notification(NotificationFeedbackType.Success);
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Invite code: ${inviteCode}. Tap to copy.`}
              >
                <View>
                  <Text style={styles.codeLabel}>YOUR INVITE CODE</Text>
                  <Text style={styles.codeText}>{inviteCode}</Text>
                </View>
                <View style={styles.copyIconWrap}>
                  <Feather name="copy" size={20} color={colors.primary} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.shareSlotTouch} 
                activeOpacity={0.8}
                onPress={handleShare} 
                accessibilityRole="button" 
                accessibilityLabel="Send invitation to partner"
              >
                <LinearGradient
                  colors={[colors.primary, colors.primary + "D0"]}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 1}}
                  style={styles.shareGradient}
                >
                  <Text style={styles.shareText}>Send Invitation</Text>
                  <Feather name="share" size={18} color="#F2E9E6" />
                </LinearGradient>
              </TouchableOpacity>
            </GlassCard>

            <TouchableOpacity 
              onPress={async () => {
                await actions.completeOnboarding();
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

  return (
    <SafeAreaView style={styles.container}>
      {step === 0 ? renderIntro() : (
        <Animated.View style={[styles.stepWrapper, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {step === 1 ? renderYourStory() : step === 2 ? renderPreferences() : renderPairing()}
        </Animated.View>
      )}

      {/* Cloud Auth Password Modal */}
      <Modal visible={showCloudAuth} transparent animationType="fade" onRequestClose={handleCloudAuthCancel}>
        <KeyboardAvoidingView
          style={styles.cloudAuthOverlay}
          behavior="padding"
        >
          <View style={[styles.cloudAuthCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="cloud-lock-outline" size={32} color={colors.primary} style={{ marginBottom: 12 }} />
            <Text style={[styles.cloudAuthTitle, { color: colors.text }]}>One more step</Text>
            <Text style={[styles.cloudAuthBody, { color: colors.textMuted }]}>
              Enter your password to enable partner linking.
            </Text>
            <TextInput
              style={[styles.cloudAuthInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={cloudAuthPw}
              onChangeText={setCloudAuthPw}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleCloudAuthDone}
              editable={!cloudAuthBusy}
            />
            <View style={styles.cloudAuthBtns}>
              <TouchableOpacity style={[styles.cloudAuthBtn, { backgroundColor: colors.background }]} onPress={handleCloudAuthCancel} disabled={cloudAuthBusy}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.cloudAuthBtn, { backgroundColor: colors.primary }]} onPress={handleCloudAuthDone} disabled={cloudAuthBusy}>
                {cloudAuthBusy
                  ? <ActivityIndicator size="small" color="#F2E9E6" />
                  : <Text style={{ color: '#F2E9E6', fontWeight: '700' }}>Continue</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background, 
  },
  stepWrapper: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 40,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  title: {
    color: colors.text, 
    fontSize: 42,
    marginBottom: 40,
    textAlign: 'center',
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
  },
  inputGroup: {
    marginBottom: 30,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    color: colors.text,
    fontSize: 20,
    paddingVertical: 10,
    fontFamily: 'Lato-Regular',
  },
  question: {
    color: colors.text,
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 34,
  },
  dateSelector: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  dateText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '500',
  },
  calculationText: {
    color: colors.textMuted,
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  datePickerContainer: {
    width: '100%',
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  datePickerBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay || 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  datePickerModalCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  datePickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  datePickerActionButton: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  datePickerActionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 40,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryButtonText: {
    color: "#F2E9E6",
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
  
  // Pairing screen elements
  pairingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -40,
  },
  pairingSubtitle: {
    color: colors.text,
    textAlign: 'center',
    fontSize: 26,
    fontFamily: 'PlayfairDisplay-Regular',
    marginBottom: 16,
  },
  pairingBody: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Lato-Italic',
    marginBottom: 48,
    paddingHorizontal: 16,
  },
  generateInviteButtonTouch: {
    width: '100%',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    borderRadius: 999,
  },
  generateInviteButtonGradient: {
    minHeight: 64,
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateInviteButtonText: {
    color: '#F2E9E6',
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  joinCodeButton: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    minWidth: '80%',
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  joinCodeButtonText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  inviteCard: {
    width: '100%',
    marginTop: 10,
    padding: 24,
  },
  previewBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 20,
    borderRadius: 16,
    marginBottom: 32,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  previewLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  previewText: {
    color: colors.textMuted,
    fontSize: 16,
    fontStyle: 'italic',
    lineHeight: 24,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  codeLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 8,
  },
  codeText: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 4,
  },
  copyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareSlotTouch: {
    width: '100%',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    borderRadius: 16,
  },
  shareGradient: {
    paddingVertical: 18,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  shareText: {
    color: "#F2E9E6",
    fontSize: 17,
    fontWeight: '700',
  },
  skipLink: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 15,
    fontFamily: 'Lato-Italic',
    textDecorationLine: 'underline',
  },
  // Preferences step styles
  prefSubtitle: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    fontFamily: 'Lato-Italic',
    lineHeight: 24,
  },
  prefSection: {
    marginBottom: 36,
  },
  prefLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 6,
    opacity: 0.8,
  },
  prefHint: {
    color: colors.textMuted,
    fontSize: 15,
    marginBottom: 20,
    opacity: 0.7,
    fontFamily: 'Lato-Italic',
  },
  heatGrid: {
    gap: 12,
  },
  heatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    gap: 16,
  },
  heatIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  heatDesc: {
    fontSize: 15,
    fontStyle: 'italic',
  },
  toneGrid: {
    gap: 12,
  },
  toneOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    gap: 16,
  },
  toneName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  tonePreview: {
    fontSize: 15,
    fontStyle: 'italic',
    opacity: 0.6,
  },

  // Your Story card styles
  storySubtitle: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    fontFamily: 'Lato-Italic',
    lineHeight: 24,
  },
  storyCard: {
    marginBottom: 24,
  },
  storyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyCardTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  storyFieldColumn: {
    gap: 22,
  },
  storyFieldGroup: {
    flex: 1,
  },
  storyFieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 10,
    opacity: 0.8,
  },
  storyInput: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    color: colors.text,
    fontSize: 20,
    fontWeight: '500',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 16,
    marginBottom: 18,
  },
  dateText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  calculationText: {
    color: colors.textMuted,
    fontSize: 15,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 6,
  },
  primaryButtonTouch: {
    marginTop: 24,
    borderRadius: 40,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  celebrationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },

  // Cloud auth modal
  cloudAuthOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  cloudAuthCard: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  cloudAuthTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  cloudAuthBody: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  cloudAuthInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  cloudAuthBtns: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cloudAuthBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

