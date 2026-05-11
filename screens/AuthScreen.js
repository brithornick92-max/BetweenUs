import React, { useCallback, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from 'expo-blur';
import Icon from '../components/Icon';
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { SPACING } from '../utils/theme';

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });
const SERIF_FONT = Platform.select({ ios: "Georgia", android: "serif" });

const INTRO_POINTS = [
  {
    icon: "people-outline",
    title: "Made for couples",
    body: "Create one shared private space for you and your partner.",
  },
  {
    icon: "infinite-outline",
    title: "Pair with your partner",
    body: "Invite them when you are ready so prompts, plans, and memories stay connected between you.",
  },
  {
    icon: "lock-closed-outline",
    title: "Account required for pairing",
    body: "Sign-in keeps each person connected to the right partner and protects synced content across devices.",
  },
];

const APP_PREVIEW_POINTS = [
  {
    icon: "chatbubbles-outline",
    title: "Couple prompts",
    body: "Answer thoughtful questions, reveal responses, and build a private rhythm of checking in.",
  },
  {
    icon: "sparkles-outline",
    title: "Date ideas and plans",
    body: "Find date-night ideas, save favorites, and keep track of the experiences you try together.",
  },
  {
    icon: "calendar-outline",
    title: "Shared calendar",
    body: "Plan date nights, anniversaries, reminders, and the rituals you want to protect together.",
  },
  {
    icon: "book-outline",
    title: "Journal",
    body: "Write private or shared reflections, save meaningful answers, and revisit what you are learning.",
  },
  {
    icon: "flame-outline",
    title: "Sex positions",
    body: "Explore sex positions by heat level and save the ones you both want to revisit.",
  },
  {
    icon: "images-outline",
    title: "Memories and keepsakes",
    body: "Save photos, notes, milestones, and little moments you want to come back to.",
  },
];

export default function AuthScreen() {
  const auth = useAuth();
  const signIn = auth?.signIn;
  const signUp = auth?.signUp;
  const loading = !!auth?.busy;
  const { colors, isDark } = useTheme();
  const route = useRoute();
  const recoveryEmail = String(route?.params?.recoveryEmail || '').trim();

  const [isSignUp, setIsSignUp] = useState(false);
  const [authVisible, setAuthVisible] = useState(!!recoveryEmail);
  const [email, setEmail] = useState(recoveryEmail);
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navigation = useNavigation();

  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  // ─── VELVET GLASS x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    background: colors.background,
    surface: isDark ? 'rgba(28, 28, 30, 0.7)' : 'rgba(255, 255, 255, 0.8)',
    surfaceSecondary: isDark ? 'rgba(44, 44, 46, 0.6)' : 'rgba(242, 242, 247, 0.7)',
    primary: colors.primary || '#D2121A', // Sexy Red
    text: colors.text,
    subtext: isDark ? 'rgba(235, 235, 245, 0.5)' : 'rgba(60, 60, 67, 0.5)',
    border: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);
  const headerSubtitle = authVisible
    ? isSignUp ? "Create your shared space" : "Welcome back"
    : "A private app for couples";
  const scrollContentStyle = authVisible
    ? styles.scrollContent
    : styles.onboardingScrollContent;

  const handleAuth = useCallback(async () => {
    if (submitting) return;
    
    // Validate before setting submitting state
    if (!signIn || !signUp) {
      Alert.alert("Auth not ready", "Please wait a moment and try again.");
      return;
    }
    if (!email.trim() || !password.trim()) {
      impact(ImpactFeedbackStyle.Light);
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      impact(ImpactFeedbackStyle.Light);
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }
    if (isSignUp) {
      if (!displayName.trim()) {
        impact(ImpactFeedbackStyle.Light);
        Alert.alert("Missing name", "Please enter your name.");
        return;
      }
      if (password !== confirmPassword) {
        impact(ImpactFeedbackStyle.Light);
        Alert.alert("Mismatch", "Passwords do not match.");
        return;
      }
      if (password.length < 8) {
        impact(ImpactFeedbackStyle.Light);
        Alert.alert("Too short", "Password must be at least 8 characters.");
        return;
      }
      if (!ageConfirmed) {
        impact(ImpactFeedbackStyle.Light);
        Alert.alert("Age Confirmation Required", "You must confirm you are 18 or older to use Between Us.");
        return;
      }
      if (!termsAccepted) {
        impact(ImpactFeedbackStyle.Light);
        Alert.alert("Terms Required", "Please accept the Terms of Service and Privacy Policy to continue.");
        return;
      }
    }
    
    // Only set submitting after validation passes
    try {
      setSubmitting(true);
      if (isSignUp) {
        impact(ImpactFeedbackStyle.Medium);
        await signUp(trimmedEmail, password, displayName.trim());
      } else {
        impact(ImpactFeedbackStyle.Medium);
        await signIn(trimmedEmail, password);
      }
    } catch (error) {
      impact(ImpactFeedbackStyle.Heavy);
      // Sanitize error: don't expose raw Supabase messages that may contain PII
      const raw = error?.message ?? '';
      if (__DEV__) console.error('[AuthScreen] Auth error:', raw);
      let friendly = 'Something went wrong. Please try again.';
      if (raw.includes('Supabase is not configured')) friendly = 'Server connection not configured. Please contact support.';
      else if (raw.includes('Invalid login') || raw.includes('Invalid password') || raw.includes('User not found') || raw.includes('Invalid credentials')) friendly = 'Incorrect email or password.';
      else if (raw.includes('already registered') || raw.includes('already been registered')) friendly = 'This email is already registered. Try signing in instead.';
      else if (raw.includes('rate limit') || raw.includes('too many')) friendly = 'Too many attempts. Please wait a moment and try again.';
      else if (raw.includes('network') || raw.includes('Network') || raw.includes('fetch')) friendly = 'Network error. Check your connection and try again.';
      else if (raw.includes('timed out')) friendly = 'Sign in timed out. Check your connection and try again.';
      else if (raw.includes('Email not confirmed') || raw.includes('Email confirmation required')) friendly = 'Please check your email and confirm your account before signing in.';
      Alert.alert("Error", friendly);
    } finally {
      setSubmitting(false);
    }
  }, [signIn, signUp, email, password, displayName, confirmPassword, isSignUp, ageConfirmed, termsAccepted, submitting]);

  const startAuth = useCallback((mode) => {
    selection().catch(() => {});
    setIsSignUp(mode === "signup");
    setPassword("");
    setDisplayName("");
    setConfirmPassword("");
    setAgeConfirmed(false);
    setTermsAccepted(false);
    setAuthVisible(true);
  }, []);

  const returnToIntro = useCallback(() => {
    Keyboard.dismiss();
    selection().catch(() => {});
    setAuthVisible(false);
  }, []);

  const toggleMode = useCallback(() => {
    selection().catch(() => {});
    setIsSignUp((v) => !v);
    setEmail("");
    setPassword("");
    setDisplayName("");
    setConfirmPassword("");
    setAgeConfirmed(false);
    setTermsAccepted(false);
  }, []);

  const handleForgotPassword = useCallback(async () => {
    navigation.navigate('ResetPassword', {
      initialEmail: email.trim(),
      returnTo: 'Auth',
    });
  }, [email, navigation]);

  // Velvet Glass Input Wrapper
  const InputWrapper = useCallback(({ children }) => {
    if (Platform.OS === 'ios') {
      return (
        <BlurView intensity={isDark ? 25 : 45} tint={isDark ? "dark" : "light"} style={styles.inputContainer}>
          {children}
        </BlurView>
      );
    }
    return <View style={[styles.inputContainer, { backgroundColor: t.surfaceSecondary }]}>{children}</View>;
  }, [isDark, styles.inputContainer, t.surfaceSecondary]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
      
      {/* Deep velvet background gradient with a hint of dark crimson in dark mode */}
      <LinearGradient
        colors={isDark 
          ? [t.background, '#1A0207', '#0A0003', t.background] 
          : [t.background, '#FFF5F5', t.background]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={scrollContentStyle}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            bounces={true}
          >
            {!authVisible ? (
              <>
                <View style={styles.screenHeader}>
                  <Text style={[styles.screenEyebrow, { color: t.primary }]}>BETWEEN US</Text>
                  <Text style={styles.screenTitle}>{headerSubtitle}</Text>
                  <Text style={styles.screenDescription}>
                    Between Us is for couples who want a private place to connect, plan time together, and keep the moments that matter.
                  </Text>
                </View>

                <Text style={styles.groupLabel}>HOW IT WORKS</Text>
                <View style={[styles.groupCard, { backgroundColor: t.surface, borderColor: t.border }]}>
                  {INTRO_POINTS.map((item, index) => (
                    <View key={item.title}>
                      <View style={styles.listRow}>
                        <View style={[styles.iconWrap, { backgroundColor: isDark ? 'rgba(210, 18, 26, 0.18)' : 'rgba(210, 18, 26, 0.08)' }]}>
                          <Icon name={item.icon} size={20} color={t.primary} />
                        </View>
                        <View style={styles.rowText}>
                          <Text style={styles.rowTitle}>{item.title}</Text>
                          <Text style={styles.rowBody}>{item.body}</Text>
                        </View>
                      </View>
                      {index < INTRO_POINTS.length - 1 && (
                        <View style={[styles.rowDivider, { backgroundColor: t.border }]} />
                      )}
                    </View>
                  ))}
                </View>

                <Text style={styles.groupLabel}>INSIDE THE APP</Text>
                <View style={[styles.groupCard, { backgroundColor: t.surface, borderColor: t.border }]}>
                  {APP_PREVIEW_POINTS.map((item, index) => (
                    <View key={item.title}>
                      <View style={styles.listRow}>
                        <View style={[styles.iconWrap, { backgroundColor: isDark ? 'rgba(210, 18, 26, 0.18)' : 'rgba(210, 18, 26, 0.08)' }]}>
                          <Icon name={item.icon} size={20} color={t.primary} />
                        </View>
                        <View style={styles.rowText}>
                          <Text style={styles.rowTitle}>{item.title}</Text>
                          <Text style={styles.rowBody}>{item.body}</Text>
                        </View>
                      </View>
                      {index < APP_PREVIEW_POINTS.length - 1 && (
                        <View style={[styles.rowDivider, { backgroundColor: t.border }]} />
                      )}
                    </View>
                  ))}
                </View>

                <Text style={styles.groupLabel}>ACCOUNT</Text>
                <View style={[styles.groupCard, { backgroundColor: t.surface, borderColor: t.border }]}>
                  <View style={styles.listRow}>
                    <View style={[styles.iconWrap, { backgroundColor: isDark ? 'rgba(210, 18, 26, 0.18)' : 'rgba(210, 18, 26, 0.08)' }]}>
                      <Icon name="mail-outline" size={20} color={t.primary} />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle}>Private sync, not marketing</Text>
                      <Text style={styles.rowBody}>
                        Your account is for sign-in, partner pairing, and private sync. It is not used for marketing emails.
                      </Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.authButton, styles.onboardingPrimaryButton, { backgroundColor: t.primary }]}
                  onPress={() => startAuth("signup")}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel="Create Account"
                >
                  <Text style={styles.authButtonText}>Create Account</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.introSignInButton}
                  onPress={() => startAuth("signin")}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Sign In"
                >
                  <Text style={styles.toggleLabel}>
                    Already have an account?
                    <Text style={[styles.toggleAction, { color: t.primary }]}> Sign In</Text>
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* ─── Header ─── */}
                <View style={styles.header}>
                  <View style={[styles.heartGlow, { shadowColor: t.primary }]}>
                    <Icon name="heart" size={32} color={t.primary} />
                  </View>
                  <Text style={styles.title}>Between Us</Text>
                  <View style={styles.divider} />
                  <Text style={styles.subtitle}>{headerSubtitle}</Text>
                </View>

                {isSignUp && !recoveryEmail && (
                  <TouchableOpacity
                    style={styles.backToIntroButton}
                    onPress={returnToIntro}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Back to app introduction"
                  >
                    <Icon name="chevron-back-outline" size={18} color={t.subtext} />
                    <Text style={styles.backToIntroText}>Why Between Us?</Text>
                  </TouchableOpacity>
                )}

                {/* ─── Form ─── */}
                <View style={styles.form}>
              {isSignUp && (
                <InputWrapper>
                  <Icon
                    name="person-outline"
                    size={20}
                    color={t.subtext}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Your name"
                    placeholderTextColor={t.subtext}
                    value={displayName}
                    onChangeText={setDisplayName}
                    autoCapitalize="words"
                    maxLength={50}
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                    blurOnSubmit={false}
                  />
                </InputWrapper>
              )}

              <InputWrapper>
                <Icon
                  name="mail-outline"
                  size={20}
                  color={t.subtext}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={emailRef}
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor={t.subtext}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  autoComplete="email"
                  maxLength={254}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </InputWrapper>

              <InputWrapper>
                <Icon
                  name="lock-closed-outline"
                  size={20}
                  color={t.subtext}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={passwordRef}
                  style={[styles.input, { fontFamily: undefined }]}
                  placeholder="Password"
                  placeholderTextColor={t.subtext}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  textContentType="password"
                  autoComplete="password"
                  maxLength={128}
                  returnKeyType={isSignUp ? "next" : "done"}
                  onSubmitEditing={isSignUp ? () => confirmRef.current?.focus() : handleAuth}
                  blurOnSubmit={!isSignUp}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(v => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={t.subtext}
                  />
                </TouchableOpacity>
              </InputWrapper>

              {isSignUp && (
                <InputWrapper>
                  <Icon
                    name="shield-checkmark-outline"
                    size={20}
                    color={t.subtext}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    ref={confirmRef}
                    style={[styles.input, { fontFamily: undefined }]}
                    placeholder="Confirm password"
                    placeholderTextColor={t.subtext}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    textContentType="newPassword"
                    autoComplete="password-new"
                    returnKeyType="done"
                    onSubmitEditing={handleAuth}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(v => !v)}
                    accessibilityRole="button"
                    accessibilityLabel={showConfirmPassword ? "Hide password" : "Show password"}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon
                      name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color={t.subtext}
                    />
                  </TouchableOpacity>
                </InputWrapper>
              )}

              {/* ─── Legal Checks ─── */}
              {isSignUp && (
                <View style={styles.legalChecks}>
                  <TouchableOpacity
                    style={styles.checkRow}
                    onPress={() => { selection(); setAgeConfirmed(v => !v); }}
                    activeOpacity={0.7}
                    accessibilityRole="checkbox"
                    accessibilityLabel="I confirm I am 18 years or older"
                    accessibilityState={{ checked: ageConfirmed }}
                  >
                    <Icon
                      name={ageConfirmed ? "checkmark-circle" : "ellipse-outline"}
                      size={22}
                      color={ageConfirmed ? t.primary : t.subtext}
                    />
                    <Text style={styles.checkText}>I confirm I am 18 years or older</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.checkRow}
                    onPress={() => { selection(); setTermsAccepted(v => !v); }}
                    activeOpacity={0.7}
                    accessibilityRole="checkbox"
                    accessibilityLabel="I agree to the Terms of Service and Privacy Policy"
                    accessibilityState={{ checked: termsAccepted }}
                  >
                    <Icon
                      name={termsAccepted ? "checkmark-circle" : "ellipse-outline"}
                      size={22}
                      color={termsAccepted ? t.primary : t.subtext}
                    />
                    <Text style={styles.checkText}>
                      I agree to the{" "}
                      <Text style={styles.linkText} onPress={() => navigation.navigate("Terms")} accessibilityRole="link">Terms of Service</Text>
                      {" "}and{" "}
                      <Text style={styles.linkText} onPress={() => navigation.navigate("PrivacyPolicy")} accessibilityRole="link">Privacy Policy</Text>
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ─── CTA Button ─── */}
              <TouchableOpacity
                style={[styles.authButton, { backgroundColor: t.primary }, (loading || submitting) && { opacity: 0.7 }]}
                onPress={handleAuth}
                disabled={loading || submitting}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel={isSignUp ? "Create Account" : "Sign In"}
                accessibilityState={{ disabled: loading || submitting, busy: loading || submitting }}
              >
                {(loading || submitting) ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.authButtonText}>{isSignUp ? "Creating account..." : "Signing in..."}</Text>
                  </View>
                ) : (
                  <Text style={styles.authButtonText}>
                    {isSignUp ? "Create Account" : "Sign In"}
                  </Text>
                )}
              </TouchableOpacity>

              {!isSignUp && (
                <TouchableOpacity
                  style={styles.forgotButton}
                  onPress={handleForgotPassword}
                  disabled={loading || submitting}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Forgot password"
                  accessibilityState={{ disabled: loading || submitting }}
                >
                  <Text style={[styles.forgotText, { color: t.primary }]}>Email me a recovery code.</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.toggleButton}
                onPress={toggleMode}
                disabled={loading}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
                accessibilityState={{ disabled: loading }}
              >
                <Text style={styles.toggleLabel}>
                  {isSignUp ? "Joined us before?" : "New to Between Us?"}
                  <Text style={[styles.toggleAction, { color: t.primary }]}> {isSignUp ? "Sign In" : "Create Account"}</Text>
                </Text>
              </TouchableOpacity>
                </View>
              </>
            )}

            {/* ─── Security Badge ─── */}
            <View style={styles.securityBadge}>
              <Icon name="lock-closed" size={14} color={t.subtext} />
              <Text style={styles.securityText}>
                Secure sign-in connection
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (t, isDark) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: t.background 
  },
  safeArea: { flex: 1 },
  kav: { flex: 1 },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxxl,
  },

  onboardingScrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: Platform.OS === "android" ? 60 : 40,
    paddingBottom: 48,
  },

  header: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl,
    alignItems: 'center',
  },

  heartGlow: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: isDark ? 'rgba(210, 18, 26, 0.15)' : 'rgba(210, 18, 26, 0.05)',
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },

  title: {
    fontFamily: SERIF_FONT,
    fontSize: 40,
    color: t.text,
    letterSpacing: 0,
    textAlign: 'center',
  },

  divider: {
    width: 40,
    height: 2,
    backgroundColor: t.primary,
    marginVertical: SPACING.md,
    borderRadius: 1,
    opacity: 0.8,
  },

  subtitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    color: t.subtext,
    textAlign: "center",
    fontWeight: "400",
    letterSpacing: 0,
    textTransform: 'uppercase',
  },

  form: {
    width: "100%",
  },

  screenHeader: {
    paddingBottom: SPACING.xl,
  },

  screenEyebrow: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0,
    marginBottom: SPACING.sm,
  },

  screenTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "900",
    color: t.text,
    letterSpacing: 0,
  },

  screenDescription: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    lineHeight: 21,
    color: t.subtext,
    fontWeight: "600",
    marginTop: SPACING.sm,
  },

  groupLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: "800",
    color: t.subtext,
    textTransform: "uppercase",
    letterSpacing: 0,
    marginBottom: SPACING.sm,
    paddingLeft: SPACING.xs,
  },

  groupCard: {
    borderWidth: 1,
    borderRadius: 20,
    marginBottom: SPACING.xl,
    overflow: "hidden",
  },

  listRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: SPACING.lg,
    gap: 16,
  },

  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  rowText: {
    flex: 1,
  },

  rowTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    color: t.text,
    fontWeight: "700",
    letterSpacing: 0,
    marginBottom: 3,
  },

  rowBody: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    lineHeight: 20,
    color: t.subtext,
    fontWeight: "500",
  },

  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 66,
  },

  introSignInButton: {
    alignItems: "center",
    paddingVertical: SPACING.lg,
  },

  backToIntroButton: {
    flexDirection: "row",
    alignSelf: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginTop: -SPACING.md,
    marginBottom: SPACING.lg,
    gap: 4,
  },

  backToIntroText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    color: t.subtext,
    fontWeight: "700",
  },

  onboardingPrimaryButton: {
    marginTop: 0,
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18, // High-end Apple Editorial rounded corners
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
    height: 60, // Enhanced touch target
    borderWidth: 1,
    borderColor: t.border,
    overflow: 'hidden',
  },

  inputIcon: {
    marginRight: 12,
    opacity: 0.8,
  },

  input: {
    flex: 1,
    color: t.text,
    fontFamily: SYSTEM_FONT,
    fontSize: 17, // Native iOS size
    fontWeight: "500",
    paddingVertical: 0,
    height: '100%',
  },

  authButton: {
    marginTop: SPACING.lg,
    height: 60,
    borderRadius: 30, // Perfect Pill
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: t.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: isDark ? 0.5 : 0.3,
        shadowRadius: 15,
      },
      android: { elevation: 8 },
    }),
  },

  authButtonText: {
    color: '#FFFFFF', // High contrast over primary red
    fontFamily: SYSTEM_FONT,
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: 0,
  },

  toggleButton: {
    marginTop: SPACING.xl,
    alignItems: "center",
    paddingVertical: SPACING.sm,
  },

  forgotButton: {
    marginTop: SPACING.lg,
    alignItems: 'center',
  },

  forgotText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0,
  },

  toggleLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    color: t.subtext,
    letterSpacing: 0,
  },

  toggleAction: {
    fontWeight: "700",
  },

  securityBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
    opacity: 0.6,
  },

  securityText: {
    fontFamily: SYSTEM_FONT,
    color: t.subtext,
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 6,
    textAlign: "center",
  },

  legalChecks: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    gap: 12,
  },

  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingRight: SPACING.xl,
    gap: 10,
  },

  checkText: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    color: t.subtext,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },

  linkText: {
    color: t.primary,
    fontWeight: "700",
  },
});
