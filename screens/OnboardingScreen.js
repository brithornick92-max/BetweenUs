// screens/OnboardingScreen.js
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
  Platform,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import ReAnimated, { FadeInDown } from 'react-native-reanimated';
import DateTimePicker from "@react-native-community/datetimepicker";
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
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
import CoupleKeyService from "../services/security/CoupleKeyService";
import CoupleService from "../services/supabase/CoupleService";
import StorageRouter from "../services/storage/StorageRouter";
import SupabaseAuthService from "../services/supabase/SupabaseAuthService";
import { STORAGE_KEYS, storage } from "../utils/storage";
import { getSupabaseOrThrow } from "../config/supabase";

const { width } = Dimensions.get("window");

export default function OnboardingScreen({ navigation }) {
  const { actions } = useAppContext();
  const { colors, isDark } = useTheme();
  const { updateRelationshipStartDate } = useContent();
  const { user } = useAuth();
  
  // STRICT Apple Editorial Theme Map
  const t = useMemo(() => ({
    background: isDark ? '#000000' : '#F2F2F7', 
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    surfaceSecondary: isDark ? '#2C2C2E' : '#E5E5EA',
    primary: colors.primary,
    accent: colors.accent || '#D4AA7E',
    text: isDark ? '#FFFFFF' : '#000000',
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

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
  const [selectedHeatLevel, setSelectedHeatLevel] = useState(5);
  const [selectedTone, setSelectedTone] = useState('warm');
  
  // Invitation state
  const [inviteCode, setInviteCode] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

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
          // Complete onboarding immediately — don't wait for Alert button
          try {
            await actions.completeOnboarding();
          } catch (err) {
            if (__DEV__) console.error('completeOnboarding failed:', err);
            // Retry dispatch directly as fallback
            try {
              await storage.set(STORAGE_KEYS.ONBOARDING_COMPLETED, true);
            } catch (_) {}
          }
          Alert.alert(
            'You\'re linked! 💕',
            'Your partner has joined. You\'re now connected on Between Us.'
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
  };

  useEffect(() => {
    if (step !== 0) {
      fadeAnim.setValue(0);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      ]).start();
    }
  }, [step]);

  const daysCounting = useMemo(() => {
    const diffTime = Math.abs(new Date() - anniversaryDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays.toLocaleString();
  }, [anniversaryDate]);

  /**
   * Ensure a Supabase session exists, using anonymous sign-in as fallback.
   */
  const ensureSupabaseSession = async () => {
    const supabase = getSupabaseOrThrow();
    const { data: { session: existing } } = await supabase.auth.getSession();
    if (existing) return existing;

    // Fall back to anonymous sign-in
    const session = await SupabaseAuthService.signInAnonymously();
    if (session) {
      await StorageRouter.setSupabaseSession(session);
      return session;
    }

    return null;
  };

  const handleGenerateInvitation = async () => {
    setIsGenerating(true);
    notification(NotificationFeedbackType.Success);

    try {
      // 1. Save Profile info
      if (__DEV__) console.log("🔑 [invite] Step 1: updateProfile");
      await actions.updateProfile({
        partnerNames: {
          myName: myName.trim(),
          partnerName: partnerName.trim(),
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
      if (!result?.code) throw new Error('No invite code returned');
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
          <Text style={styles.title}>Your Story</Text>
          <Text style={styles.storySubtitle}>Tell us a little about the connection you're building together.</Text>
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
            accessibilityLabel="Continue to preferences"
          >
            <Text style={[styles.primaryButtonText, { color: t.surface }]}>Continue</Text>
          </TouchableOpacity>
        </ReAnimated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const HEAT_LABELS = [
    { level: 1, icon: 'heart-outline',        color: '#FF85C2', name: 'Emotional',   description: 'Intimacy & trust' },
    { level: 2, icon: 'heart-outline',        color: '#FF1493', name: 'Romantic',    description: 'Flirty & tender' },
    { level: 3, icon: 'flame-outline',         color: '#FF006E', name: 'Sensual',     description: 'Desire & closeness' },
    { level: 4, icon: 'flame-outline',         color: '#F00049', name: 'Steamy',      description: 'Adventurous & heated' },
    { level: 5, icon: 'flame-outline',         color: '#D2121A', name: 'Explicit',    description: 'Intensely passionate' },
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
        body: 'Tonight\'s prompt. Cleaner language, less noise, straight to the feeling.',
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
        <Text style={styles.prefSubtitle}>These shape what the app suggests. Change anytime in Settings.</Text>

        {/* Season Selector */}
        <View style={styles.prefSection}>
          <SeasonSelector onSeasonChange={(id) => setSelectedSeason(id)} />
        </View>

        {/* Heat Level */}
        <View style={styles.prefSection}>
          <Text style={styles.groupLabel}>COMFORT LEVEL</Text>
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
              } catch (e) {
                console.warn('Error saving onboarding preferences:', e);
              }
              transitionTo(3);
            }}
          >
            <Text style={[styles.primaryButtonText, { color: t.surface }]}>Continue</Text>
          </TouchableOpacity>
        </ReAnimated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderPairing = () => (
    <View style={styles.content}>
      <ReAnimated.View entering={FadeInDown.delay(100).duration(800).springify()}>
        <Text style={styles.title}>Pairing</Text>
      </ReAnimated.View>
      
      <View style={styles.pairingContainer}>
        <ReAnimated.View entering={FadeInDown.delay(200).duration(800).springify()}>
          <Icon 
            name="infinite-outline" 
            size={48} 
            color={t.primary} 
            style={{ marginBottom: 24, alignSelf: 'center' }} 
          />
          <Text style={styles.pairingSubtitle}>Reach across the digital void.</Text>
          <Text style={styles.pairingBody}>
            Invite your partner to connect their app to yours. Your shared memory starts here.
          </Text>
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
                <Text style={[styles.primaryButtonText, { color: t.surface }]}>Generate Invitation</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.joinCodeButton}
              onPress={() => navigation.navigate('JoinWithCode')}
              activeOpacity={0.7}
            >
              <Text style={styles.joinCodeButtonText}>I have a code</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={async () => {
                await actions.completeOnboarding();
              }}
              style={{ marginTop: 40 }}
              activeOpacity={0.6}
            >
              <Text style={styles.skipLink}>I'll link later</Text>
            </TouchableOpacity>
          </ReAnimated.View>
        ) : (
          <ReAnimated.View entering={FadeInDown.duration(600).springify()} style={{ width: '100%' }}>
            
            <View style={styles.groupCard}>
              <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>MESSAGE PREVIEW</Text>
                <Text style={styles.previewText}>
                  "I am inviting you to connect on Between Us. Use my code to join our private space."
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
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />

      {step === 0 ? renderIntro() : (
        <Animated.View style={[styles.stepWrapper, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {step === 1 ? renderYourStory() : step === 2 ? renderPreferences() : renderPairing()}
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
      marginBottom: SPACING.xxl,
      fontWeight: '500',
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
