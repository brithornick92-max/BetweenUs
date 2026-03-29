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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Icon from '../components/Icon';
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { SPACING, withAlpha } from '../utils/theme';

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });
const SERIF_FONT = Platform.select({ ios: "Georgia", android: "serif" });

export default function AuthScreen() {
  const auth = useAuth();
  const signIn = auth?.signIn;
  const signUp = auth?.signUp;
  const loading = !!auth?.busy;
  const { colors, isDark } = useTheme();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
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

  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    background: colors.background,
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    surfaceSecondary: isDark ? '#2C2C2E' : '#F2F2F7',
    primary: colors.primary || '#D2121A', // Sexy Red
    text: colors.text,
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  const handleAuth = useCallback(async () => {
    if (submitting) return;
    try {
      setSubmitting(true);
      if (!signIn || !signUp) {
        Alert.alert("Auth not ready", "Please wait a moment and try again.");
        return;
      }
      if (!email.trim() || !password.trim()) {
        impact(ImpactFeedbackStyle.Light);
        Alert.alert("Missing fields", "Please enter your email and password.");
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
        impact(ImpactFeedbackStyle.Medium);
        await signUp(email.trim(), password, displayName.trim());
      } else {
        impact(ImpactFeedbackStyle.Medium);
        await signIn(email.trim(), password);
      }
    } catch (error) {
      impact(ImpactFeedbackStyle.Heavy);
      // Sanitize error: don't expose raw Supabase messages that may contain PII
      const raw = error?.message ?? '';
      let friendly = 'Something went wrong. Please try again.';
      if (raw.includes('Invalid login')) friendly = 'Incorrect email or password.';
      else if (raw.includes('already registered') || raw.includes('already been registered')) friendly = 'This email is already registered. Try signing in instead.';
      else if (raw.includes('rate limit') || raw.includes('too many')) friendly = 'Too many attempts. Please wait a moment and try again.';
      else if (raw.includes('network') || raw.includes('Network')) friendly = 'Network error. Check your connection and try again.';
      else if (raw.includes('Email not confirmed')) friendly = 'Please check your email and confirm your account first.';
      Alert.alert("Error", friendly);
    } finally {
      setSubmitting(false);
    }
  }, [signIn, signUp, email, password, displayName, confirmPassword, isSignUp, ageConfirmed, termsAccepted, submitting]);

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

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
      
      {/* Deep velvet background gradient with a hint of dark crimson in dark mode */}
      <LinearGradient
        colors={isDark 
          ? [t.background, '#120206', '#0A0003', t.background] 
          : [t.background, t.surfaceSecondary, t.background]}
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
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            bounces={false}
          >
            {/* ─── Header ─── */}
            <View style={styles.header}>
              <View style={[styles.heartGlow, { backgroundColor: withAlpha(t.primary, 0.1) }]}>
                <Icon name="heart-outline" size={32} color={t.primary} />
              </View>
              <Text style={styles.title}>Between Us</Text>
              <View style={styles.divider} />
              <Text style={styles.subtitle}>
                {isSignUp ? "Where closeness deepens" : "Welcome back, love"}
              </Text>
            </View>

            {/* ─── Form ─── */}
            <View style={styles.form}>
              {isSignUp && (
                <View style={styles.inputContainer}>
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
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                    blurOnSubmit={false}
                  />
                </View>
              )}

              <View style={styles.inputContainer}>
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
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <Icon
                  name="lock-closed-outline"
                  size={20}
                  color={t.subtext}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={t.subtext}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  textContentType="password"
                  autoComplete="password"
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
              </View>

              {isSignUp && (
                <View style={styles.inputContainer}>
                  <Icon
                    name="shield-checkmark-outline"
                    size={20}
                    color={t.subtext}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    ref={confirmRef}
                    style={styles.input}
                    placeholder="Confirm password"
                    placeholderTextColor={t.subtext}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    textContentType="oneTimeCode"
                    autoComplete="off"
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
                </View>
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
                style={[styles.authButton, { backgroundColor: t.primary }]}
                onPress={handleAuth}
                disabled={loading || submitting}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={isSignUp ? "Create Account" : "Sign In"}
                accessibilityState={{ disabled: loading || submitting, busy: loading || submitting }}
              >
                <Text style={styles.authButtonText}>
                  {loading ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggleButton}
                onPress={toggleMode}
                disabled={loading}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
                accessibilityState={{ disabled: loading }}
              >
                <Text style={[styles.toggleText, { color: t.primary }]}>
                  {isSignUp
                    ? "Already have an account? Sign in"
                    : "Don't have an account? Sign up"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ─── Security Badge ─── */}
            <View style={styles.securityBadge}>
              <Icon name="lock-closed-outline" size={14} color={t.subtext} />
              <Text style={styles.securityText}>
                Your intimate responses are encrypted and private
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

  header: {
    alignItems: "center",
    marginBottom: SPACING.xxxl,
  },

  heartGlow: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
  },

  title: {
    fontFamily: SERIF_FONT,
    fontSize: 44,
    color: t.text,
    letterSpacing: -0.5,
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
    fontSize: 16,
    color: t.subtext,
    textAlign: "center",
    fontWeight: "500",
    letterSpacing: -0.2,
  },

  form: {
    width: "100%",
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: t.surfaceSecondary,
    borderRadius: 16,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
    height: 56, // Tall Apple touch target
    borderWidth: 1,
    borderColor: t.border,
  },

  inputIcon: {
    marginRight: 12,
  },

  input: {
    flex: 1,
    color: t.text,
    fontFamily: SYSTEM_FONT,
    fontSize: 17, // Native iOS size
    fontWeight: "500",
    paddingVertical: 0,
  },

  authButton: {
    marginTop: SPACING.lg,
    height: 56,
    borderRadius: 28, // Perfect Pill
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: t.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: isDark ? 0.4 : 0.2,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },

  authButtonText: {
    color: '#FFFFFF', // High contrast over primary red
    fontFamily: SYSTEM_FONT,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
  },

  toggleButton: {
    marginTop: SPACING.xl,
    alignItems: "center",
    paddingVertical: SPACING.sm,
  },

  toggleText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },

  securityBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
  },

  securityText: {
    fontFamily: SYSTEM_FONT,
    color: t.subtext,
    fontSize: 13,
    fontWeight: "500",
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
    fontSize: 14,
    lineHeight: 20,
    marginTop: 1,
  },

  linkText: {
    color: t.primary,
    fontWeight: "600",
  },
});
