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
import { useAuth } from "../context/AuthContext";
import SeasonSelector from "../components/SeasonSelector";
import EnergyMatcher from "../components/EnergyMatcher";
import { NicknameEngine, SEASONS } from "../services/PolishEngine";
import CloudEngine from "../services/storage/CloudEngine";
import CoupleKeyService from "../services/security/CoupleKeyService";
import StorageRouter from "../services/storage/StorageRouter";
import { getSupabaseOrThrow } from "../config/supabase";

const { width } = Dimensions.get("window");

export default function OnboardingScreen({ navigation }) {
  const { actions } = useAppContext();
  const { colors, isDark } = useTheme();
  const { updateRelationshipStartDate } = useContent();
  const { user } = useAuth();
  
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Steps: 0 (Intro), 1 (Alignment), 2 (Preferences), 3 (Pairing)
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

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

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
        // No active session — redirect to SyncSetup for magic-link sign-in
        // instead of attempting signInAnonymously (which is disabled on this Supabase project
        // and triggers auth state change microtasks that cause render crashes).
        if (__DEV__) console.log("🔑 [invite] Step 3: No session — redirecting to SyncSetup for sign-in");
        navigation?.navigate?.("SyncSetup");
        setIsGenerating(false);
        return;
      }

      if (__DEV__) console.log("🔑 [invite] Step 4: CloudEngine.initialize");
      await CloudEngine.initialize({ supabaseSessionPresent: true });
      if (__DEV__) console.log("🔑 [invite] Step 4b: setSupabaseSession");
      await StorageRouter.setSupabaseSession(session);

      // 2. Generate Invite Code via CloudEngine
      if (__DEV__) console.log("🔑 [invite] Step 5: getDevicePublicKeyB64");
      const myPublicKeyB64 = await CoupleKeyService.getDevicePublicKeyB64();
      if (__DEV__) console.log("🔑 [invite] Step 5b: createCouple");
      const coupleId = await CloudEngine.createCouple(myPublicKeyB64);
      if (__DEV__) console.log("🔑 [invite] Step 6: coupleId =", coupleId);
      
      setInviteCode(coupleId);
      if (__DEV__) console.log("🔑 [invite] Step 6b: setActiveCoupleId");
      await StorageRouter.setActiveCoupleId(coupleId);
      if (__DEV__) console.log("🔑 [invite] ✅ Complete!");
    } catch (error) {
      const msg = String(error?.message || "");
      console.error("🔑 [invite] ❌ Error:", error?.name, msg, error?.stack?.slice(0, 500));
      if (msg.toLowerCase().includes("cloud pairing is not signed in yet")) {
        navigation?.navigate?.("SyncSetup");
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

  const renderAlignment = () => (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={styles.content}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[TYPOGRAPHY.display, styles.title]}>Alignment</Text>
        
        <View style={styles.madLibsContainer}>
          <Text style={styles.madLibsText}>I am</Text>
          <TextInput
            style={styles.madLibsInput}
            placeholder="Your Name"
            placeholderTextColor={colors.text + '40'}
            value={myName}
            onChangeText={setMyName}
            accessibilityLabel="Your name"
            accessibilityHint="Enter your first name"
          />
          <Text style={styles.madLibsText}>and I am building a life with</Text>
          <TextInput
            style={styles.madLibsInput}
            placeholder="Partner's Name"
            placeholderTextColor={colors.text + '40'}
            value={partnerName}
            onChangeText={setPartnerName}
            accessibilityLabel="Partner's name"
            accessibilityHint="Enter your partner's first name"
          />
        </View>

        <View style={styles.dateSelector}>
          <Text style={[TYPOGRAPHY.h2, styles.question]}>How long has your story been unfolding?</Text>
          
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
    { level: 1, emoji: '😊', name: 'Heart Connection' },
    { level: 2, emoji: '💕', name: 'Spark & Attraction' },
    { level: 3, emoji: '🔥', name: 'Intimate Connection' },
    { level: 4, emoji: '🌶️', name: 'Adventurous Exploration' },
    { level: 5, emoji: '🔥🔥', name: 'Unrestrained Passion' },
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
          {step === 1 ? renderAlignment() : step === 2 ? renderPreferences() : renderPairing()}
        </Animated.View>
      )}
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
    marginVertical: 20,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    marginBottom: 16,
  },
  dateText: {
    color: colors.text,
    fontSize: 18,
    marginRight: 10,
  },
  calculationText: {
    color: colors.textMuted,
    fontSize: 16,
    fontStyle: 'italic',
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

  // Mad Libs Styles
  madLibsContainer: {
    marginBottom: 40,
    marginTop: 20,
    gap: 8,
  },
  madLibsText: {
    fontFamily: Platform.select({ ios: 'Playfair Display', default: 'serif' }),
    fontSize: 28,
    color: colors.text,
    lineHeight: 38,
  },
  madLibsInput: {
    fontFamily: Platform.select({ ios: 'Playfair Display', default: 'serif' }),
    fontSize: 28,
    color: colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 4,
    minWidth: 120,
    fontStyle: 'italic',
  },
  celebrationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  }
});

