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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { BORDER_RADIUS } from '../utils/theme';

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

  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  // Canonical luxury palette
  const C = useMemo(() => ({
    bg: colors.background,
    card: colors.surface,
    accent: colors.primary,
    accentHover: colors.primary,
    accentMuted: colors.primary + "CC",
    cream: colors.text,
    creamSoft: colors.text + "CC",
    creamFaint: colors.textMuted,
    inputBg: colors.surface,
    inputBorder: colors.border,
    inputBorderFocus: colors.primary,
    sectionLabel: colors.textMuted,
  }), [colors]);

  const styles = useMemo(() => createStyles(C, colors), [C, colors]);

  const handleAuth = useCallback(async () => {
    try {
      if (!signIn || !signUp) {
        Alert.alert("Auth not ready", "Please wait a moment and try again.");
        return;
      }
      if (!email.trim() || !password.trim()) {
        Alert.alert("Missing fields", "Please enter your email and password.");
        return;
      }
      if (isSignUp) {
        if (!displayName.trim()) {
          Alert.alert("Missing name", "Please enter your name.");
          return;
        }
        if (password !== confirmPassword) {
          Alert.alert("Mismatch", "Passwords do not match.");
          return;
        }
        if (password.length < 6) {
          Alert.alert("Too short", "Password must be at least 6 characters.");
          return;
        }
        await signUp(email.trim(), password, displayName.trim());
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        Alert.alert("Welcome", "Your account has been created.");
      } else {
        await signIn(email.trim(), password);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    } catch (error) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      Alert.alert("Error", error?.message ?? "Something went wrong.");
    }
  }, [signIn, signUp, email, password, displayName, confirmPassword, isSignUp]);

  const toggleMode = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setIsSignUp((v) => !v);
    setEmail("");
    setPassword("");
    setDisplayName("");
    setConfirmPassword("");
  }, []);

  return (
    <View
      style={styles.container}
    >
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
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.heartGlow}>
                <MaterialCommunityIcons name="heart" size={40} color={C.accent} />
              </View>
              <Text style={styles.title}>Between Us</Text>
              <View style={styles.divider} />
              <Text style={styles.subtitle}>
                {isSignUp ? "Where closeness deepens" : "Welcome back, love"}
              </Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {isSignUp && (
                <View style={styles.inputContainer}>
                  <MaterialCommunityIcons
                    name="account-outline"
                    size={20}
                    color={C.creamFaint}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Your name"
                    placeholderTextColor={C.creamFaint}
                    value={displayName}
                    onChangeText={setDisplayName}
                    autoCapitalize="words"
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                    blurOnSubmit={false}
                    accessibilityLabel="Your name"
                    accessibilityHint="Enter your display name"
                  />
                </View>
              )}

              <View style={styles.inputContainer}>
                <MaterialCommunityIcons
                  name="email-outline"
                  size={20}
                  color={C.creamFaint}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={emailRef}
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor={C.creamFaint}
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
                  accessibilityLabel="Email address"
                  accessibilityHint="Enter your email to sign in or create an account"
                />
              </View>

              <View style={styles.inputContainer}>
                <MaterialCommunityIcons
                  name="lock-outline"
                  size={20}
                  color={C.creamFaint}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={C.creamFaint}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  textContentType="password"
                  autoComplete="password"
                  returnKeyType={isSignUp ? "next" : "done"}
                  onSubmitEditing={isSignUp ? () => confirmRef.current?.focus() : handleAuth}
                  blurOnSubmit={!isSignUp}
                  accessibilityLabel="Password"
                />
              </View>

              {isSignUp && (
                <View style={styles.inputContainer}>
                  <MaterialCommunityIcons
                    name="lock-check-outline"
                    size={20}
                    color={C.creamFaint}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    ref={confirmRef}
                    style={styles.input}
                    placeholder="Confirm password"
                    placeholderTextColor={C.creamFaint}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    textContentType="oneTimeCode"
                    autoComplete="off"
                    returnKeyType="done"
                    onSubmitEditing={handleAuth}                    accessibilityLabel="Confirm password"                  />
                </View>
              )}

              {/* CTA Button */}
              <TouchableOpacity
                style={styles.authButton}
                onPress={handleAuth}
                disabled={loading}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={loading ? "Please wait" : isSignUp ? "Create Account" : "Sign In"}
                accessibilityState={{ disabled: loading }}
              >
                <View
                  style={styles.authButtonGradient}
                >
                  <Text style={styles.authButtonText}>
                    {loading ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggleButton}
                onPress={toggleMode}
                disabled={loading}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={isSignUp ? "Switch to sign in" : "Switch to sign up"}
              >
                <Text style={styles.toggleText}>
                  {isSignUp
                    ? "Already have an account? Sign in"
                    : "Don't have an account? Sign up"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Security badge */}
            <View style={styles.securityBadge}>
              <MaterialCommunityIcons name="shield-check" size={14} color={C.sectionLabel} />
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

const createStyles = (C, colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  kav: { flex: 1 },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 32,
  },

  header: {
    alignItems: "center",
    marginBottom: 36,
  },

  heartGlow: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  title: {
    fontFamily: Platform.select({
      ios: "DMSerifDisplay-Regular",
      android: "DMSerifDisplay_400Regular",
    }),
    fontSize: 38,
    color: C.cream,
    letterSpacing: -0.5,
  },

  divider: {
    width: 40,
    height: 1.5,
    backgroundColor: C.accent,
    marginVertical: 14,
    borderRadius: 1,
    opacity: 0.6,
  },

  subtitle: {
    fontSize: 15,
    color: C.creamSoft,
    textAlign: "center",
    fontWeight: "400",
    letterSpacing: 0.3,
  },

  form: {
    width: "100%",
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.inputBg,
    borderRadius: 14,
    marginBottom: 14,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: C.inputBorder,
  },

  inputIcon: {
    marginRight: 12,
  },

  input: {
    flex: 1,
    color: C.cream,
    fontSize: 16,
    paddingVertical: 0,
  },

  authButton: {
    marginTop: 20,
    borderRadius: 14,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: C.accent,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },

  authButtonGradient: {
    height: 52,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accent,
  },

  authButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.3,
  },

  toggleButton: {
    marginTop: 20,
    alignItems: "center",
    paddingVertical: 8,
  },

  toggleText: {
    color: C.accent,
    paddingVertical: 8,
  },

  toggleText: {
    color: C.accentHover,
    fontSize: 14,
    fontWeight: "500",
  },

  securityBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 32,
    opacity: 0.7,
  },

  securityText: {
    color: C.creamSoft,
    fontSize: 11,
    marginLeft: 6,
    textAlign: "center",
  },
});
