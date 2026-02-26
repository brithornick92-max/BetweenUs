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
  Platform,
  Share,
  TextInput,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppContext } from "../context/AppContext";
import { useContent } from "../context/ContentContext";
import { useTheme } from "../context/ThemeContext";
import { TYPOGRAPHY, COLORS } from "../utils/theme";
import HeartbeatEntry from "../components/HeartbeatEntry";
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
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

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
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={styles.content}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[TYPOGRAPHY.display, styles.title]}>Your Story</Text>
        <Text style={styles.storySubtitle}>Tell us a little about your relationship</Text>

        {/* Names Card */}
        <View style={styles.storyCard}>
          <View style={styles.storyCardHeader}>
            <MaterialCommunityIcons name="account-heart-outline" size={20} color={colors.primary} />
            <Text style={styles.storyCardTitle}>Who's in this love story?</Text>
          </View>

          <View style={styles.storyFieldRow}>
            <View style={styles.storyFieldGroup}>
              <Text style={styles.storyFieldLabel}>YOUR NAME</Text>
              <TextInput
                style={styles.storyInput}
                placeholder="e.g. Alex"
                placeholderTextColor={colors.text + '40'}
                value={myName}
                onChangeText={setMyName}
                accessibilityLabel="Your name"
                accessibilityHint="Enter your first name"
              />
            </View>
            <View style={styles.storyFieldDivider}>
              <MaterialCommunityIcons name="heart" size={16} color={colors.primary + '60'} />
            </View>
            <View style={styles.storyFieldGroup}>
              <Text style={styles.storyFieldLabel}>PARTNER'S NAME</Text>
              <TextInput
                style={styles.storyInput}
                placeholder="e.g. Jordan"
                placeholderTextColor={colors.text + '40'}
                value={partnerName}
                onChangeText={setPartnerName}
                accessibilityLabel="Partner's name"
                accessibilityHint="Enter your partner's first name"
              />
            </View>
          </View>
        </View>

        {/* Date Card */}
        <View style={styles.storyCard}>
          <View style={styles.storyCardHeader}>
            <MaterialCommunityIcons name="calendar-heart" size={20} color={colors.primary} />
            <Text style={styles.storyCardTitle}>When did it all begin?</Text>
          </View>
          
          <TouchableOpacity 
            onPress={() => {
              setPendingDate(anniversaryDate);
              setShowDatePicker(true);
            }}
            style={styles.dateDisplay}
            accessibilityRole="button"
            accessibilityLabel={`Anniversary date: ${anniversaryDate.toLocaleDateString('en-US')}`}
            accessibilityHint="Tap to change your relationship start date"
          >
            <Text style={styles.dateText}>
              {anniversaryDate.toLocaleDateString('en-US')}
            </Text>
          </TouchableOpacity>

          <Text style={styles.calculationText}>
            <Text style={{ color: colors.primary }}>{daysCounting}</Text> days and counting
          </Text>

          {Platform.OS === 'android' && showDatePicker && (
            <View style={styles.datePickerContainer}>
          
          {/* Simple Celebration Animation triggered when days > 0 */}
          {daysCounting !== '0' && (
            <Animated.View 
              entering={Animated.FadeIn.duration(500)}
              style={styles.celebrationContainer}
            >
              <MaterialCommunityIcons name="heart" size={24} color={colors.primary} />
            </Animated.View>
          )}
              <DateTimePicker
                value={anniversaryDate}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) setAnniversaryDate(date);
                }}
                textColor={colors.text}
              />
            </View>
          )}

          {Platform.OS === 'ios' && (
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
          )}
        </View>

        <TouchableOpacity 
          style={styles.primaryButton} 
          onPress={() => {
            Keyboard.dismiss();
            transitionTo(2);
          }}
          disabled={showDatePicker}
          accessibilityRole="button"
          accessibilityLabel="Continue to preferences"
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const HEAT_LABELS = [
    { level: 1, emoji: '😊', name: 'Emotional Connection' },
    { level: 2, emoji: '💕', name: 'Flirty & Romantic' },
    { level: 3, emoji: '🔥', name: 'Sensual' },
    { level: 4, emoji: '🌶️', name: 'Steamy' },
    { level: 5, emoji: '🔥🔥', name: 'Explicit' },
  ];

  const TONE_OPTIONS = NicknameEngine.TONE_OPTIONS;

  // Step 2: Preferences (season, heat, tone)
  const renderPreferences = () => (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
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
          <Text style={styles.prefHint}>Choose what kind of prompts you want to see</Text>
          <View style={styles.heatGrid}>
            {HEAT_LABELS.map((h) => (
              <TouchableOpacity
                key={h.level}
                style={[
                  styles.heatOption,
                  { borderColor: selectedHeatLevel === h.level ? colors.primary : colors.border },
                  selectedHeatLevel === h.level && { backgroundColor: colors.primary + '15' },
                ]}
                onPress={() => {
                  setSelectedHeatLevel(h.level);
                  Haptics.selectionAsync();
                }}
              >
                <Text style={styles.heatEmoji}>{h.emoji}</Text>
                <Text style={[styles.heatName, { color: selectedHeatLevel === h.level ? colors.text : colors.textMuted }]}>
                  {h.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Tone */}
        <View style={styles.prefSection}>
          <Text style={styles.prefLabel}>APP TONE</Text>
          <Text style={styles.prefHint}>How should the app talk to you?</Text>
          <View style={styles.toneGrid}>
            {TONE_OPTIONS.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.toneOption,
                  { borderColor: selectedTone === t.id ? colors.primary : colors.border },
                  selectedTone === t.id && { backgroundColor: colors.primary + '15' },
                ]}
                onPress={() => {
                  setSelectedTone(t.id);
                  Haptics.selectionAsync();
                }}
              >
                <MaterialCommunityIcons
                  name={t.icon}
                  size={20}
                  color={selectedTone === t.id ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.toneName, { color: selectedTone === t.id ? colors.text : colors.textMuted }]}>
                  {t.label}
                </Text>
                <Text style={[styles.tonePreview, { color: colors.textMuted }]} numberOfLines={1}>
                  {t.preview}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity 
          style={styles.primaryButton} 
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
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderPairing = () => (
    <View style={styles.content}>
      <Text style={[TYPOGRAPHY.display, styles.title]}>Pairing</Text>
      
      <View style={styles.pairingContainer}>
        <Text style={[TYPOGRAPHY.h2, styles.pairingSubtitle]}>Reach across the digital void.</Text>
        
        {!inviteCode ? (
          <View style={{ width: '100%', alignItems: 'center' }}>
            <TouchableOpacity 
              style={styles.generateInviteButton}
              onPress={handleGenerateInvitation}
              disabled={isGenerating}
              accessibilityRole="button"
              accessibilityLabel="Generate invitation"
              accessibilityHint="Creates a code to invite your partner"
              accessibilityState={{ disabled: isGenerating }}
            >
              {isGenerating ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.generateInviteButtonText}>Generate Invitation</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.joinCodeButton}
              onPress={() => navigation.navigate('JoinWithCode')}
              accessibilityRole="button"
              accessibilityLabel="I have an invite code"
              accessibilityHint="Enter an invite code from your partner"
            >
              <Feather name="log-in" size={18} color={colors.primary} />
              <Text style={styles.joinCodeButtonText}>I have a code</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={async () => {
                await actions.completeOnboarding();
              }}
              style={{ marginTop: 24 }}
            >
              <Text style={styles.skipLink}>I'll link later</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.inviteCard}>
            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>PREVIEW</Text>

              <Text style={styles.previewText}>
                "{myName || "Partner"} is inviting you to connect on Between Us..."
              </Text>
            </View>

            <TouchableOpacity 
              style={styles.inviteRow} 
              onPress={() => {
                Clipboard.setStringAsync(inviteCode);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Invite code: ${inviteCode}. Tap to copy.`}
            >
              <Text style={styles.codeLabel}>INVITE CODE</Text>
              <Text style={styles.codeText}>{inviteCode}</Text>
              <Feather name="copy" size={16} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareSlot} onPress={handleShare} accessibilityRole="button" accessibilityLabel="Send invitation to partner">
              <LinearGradient
                colors={[colors.primary, colors.primary + "CC"]}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                style={styles.shareGradient}
              >
                <Text style={styles.shareText}>Send Invitation</Text>
                <Feather name="share-2" size={18} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={async () => {
                await actions.completeOnboarding();
              }}
              style={{ marginTop: 24 }}
            >
              <Text style={styles.skipLink}>I'll send it later</Text>
            </TouchableOpacity>
          </View>
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
          behavior={Platform.OS === "ios" ? "padding" : undefined}
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
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Text style={{ color: '#FFF', fontWeight: '700' }}>Continue</Text>}
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
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
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
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
  generateInviteButton: {
    marginTop: 40,
    backgroundColor: colors.primary,
    minHeight: 64,
    minWidth: '90%',
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateInviteButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  joinCodeButton: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary + '40',
    minWidth: '80%',
  },
  joinCodeButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  pairingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pairingSubtitle: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 20,
    fontStyle: 'italic',
  },
  inviteCard: {
    width: '100%',
    marginTop: 40,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewBox: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  previewLabel: {
    color: colors.primary,
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 8,
  },
  previewText: {
    color: colors.textMuted,
    fontSize: 14,
    fontStyle: 'italic',
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  codeLabel: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1,
    marginRight: 12,
  },
  codeText: {
    color: colors.text,
    fontSize: 16,
    flex: 1,
    fontWeight: '700',
  },
  shareSlot: {
    width: '100%',
  },
  shareGradient: {
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareText: {
    color: "#FFFFFF",
    fontWeight: '700',
    marginRight: 10,
  },
  skipLink: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  // Preferences step styles
  prefSubtitle: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 30,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  prefSection: {
    marginBottom: 28,
  },
  prefLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  prefHint: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 14,
    opacity: 0.7,
  },
  heatGrid: {
    gap: 10,
  },
  heatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  heatEmoji: {
    fontSize: 24,
    width: 36,
    textAlign: 'center',
  },
  heatName: {
    fontSize: 15,
    fontWeight: '500',
  },
  toneGrid: {
    gap: 10,
  },
  toneOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  toneName: {
    fontSize: 15,
    fontWeight: '600',
    minWidth: 70,
  },
  tonePreview: {
    flex: 1,
    fontSize: 13,
    fontStyle: 'italic',
    opacity: 0.6,
  },

  // Your Story card styles
  storySubtitle: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 28,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  storyCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  storyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  storyCardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  storyFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storyFieldGroup: {
    flex: 1,
  },
  storyFieldDivider: {
    paddingTop: 18,
    alignItems: 'center',
  },
  storyFieldLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  storyInput: {
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 17,
    fontWeight: '500',
    borderWidth: 1,
    borderColor: colors.border,
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

