import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../components/Icon';
import { useTheme } from '../context/ThemeContext';
import SupabaseAuthService from '../services/supabase/SupabaseAuthService';
import StorageRouter from '../services/storage/StorageRouter';
import { SPACING, withAlpha } from '../utils/theme';

const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });
const SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif' });

export default function ResetPasswordScreen({ navigation, route }) {
  const { colors, isDark } = useTheme();
  const initialEmail = String(route?.params?.initialEmail || '').trim();
  const returnTo = route?.params?.returnTo || 'Auth';

  const [step, setStep] = useState(0);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const t = useMemo(() => ({
    background: colors.background,
    surfaceSecondary: isDark ? '#2C2C2E' : '#F2F2F7',
    primary: colors.primary || '#D2121A',
    text: colors.text,
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  const handleSendCode = useCallback(async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      Alert.alert('Email required', 'Enter the email on your account first.');
      return;
    }

    try {
      setSubmitting(true);
      await SupabaseAuthService.requestRecoveryCode(trimmedEmail);
      setEmail(trimmedEmail);
      setStep(1);
      Alert.alert('Check your inbox', 'If that email is on your account, a 6-digit recovery code is on the way.');
    } catch (error) {
      const raw = String(error?.message || '');
      const friendly = raw.includes('wait a minute')
        ? 'Please wait a minute before requesting another code.'
        : 'Unable to send a recovery code right now.';
      Alert.alert('Recovery unavailable', friendly);
    } finally {
      setSubmitting(false);
    }
  }, [email]);

  const handleVerifyCode = useCallback(async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedCode = code.replace(/\s+/g, '');

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      Alert.alert('Email required', 'Enter the email on your account first.');
      setStep(0);
      return;
    }
    if (!/^\d{6}$/.test(trimmedCode)) {
      Alert.alert('Code required', 'Enter the 6-digit code from your email.');
      return;
    }
    if (!password || password.length < 8) {
      Alert.alert('Too short', 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    try {
      setSubmitting(true);
      await SupabaseAuthService.verifyRecoveryCode({
        email: trimmedEmail,
        code: trimmedCode,
        password,
      });

      const postResetWarnings = [];

      try {
        await StorageRouter.updatePasswordForEmail(trimmedEmail, password);
      } catch (storageError) {
        postResetWarnings.push('This device could not update its local sign-in cache. If prompted, sign in again manually.');
      }

      try {
        await SupabaseAuthService.storeCredentials(trimmedEmail, password);
      } catch (credentialError) {
        postResetWarnings.push('This device could not save your refreshed cloud credentials. If prompted, sign in again manually.');
      }

      const successMessage = postResetWarnings.length
        ? `Your password has been reset. ${postResetWarnings.join(' ')}`
        : 'Your password has been reset.';

      Alert.alert('Password updated', successMessage, [
        {
          text: 'Continue',
          onPress: () => navigation.reset({
            index: 0,
            routes: [{ name: returnTo, params: { recoveryEmail: trimmedEmail } }],
          }),
        },
      ]);
    } catch (error) {
      const raw = String(error?.message || '');
      let friendly = 'Unable to verify that code right now.';
      if (raw.includes('invalid or expired')) friendly = 'That recovery code is invalid or expired.';
      else if (raw.includes('Too many attempts')) friendly = 'Too many attempts. Request a new recovery code.';
      else if (raw.includes('at least 8 characters')) friendly = 'Password must be at least 8 characters.';
      Alert.alert('Reset failed', friendly);
    } finally {
      setSubmitting(false);
    }
  }, [code, confirmPassword, email, navigation, password, returnTo]);

  const handleUseDifferentEmail = useCallback(() => {
    setStep(0);
    setCode('');
    setPassword('');
    setConfirmPassword('');
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      <LinearGradient
        colors={isDark ? [t.background, '#120206', '#0A0003', t.background] : [t.background, t.surfaceSecondary, t.background]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <View style={[styles.iconWrap, { backgroundColor: withAlpha(t.primary, 0.1) }]}>
                <Icon name="mail-open-outline" size={30} color={t.primary} />
              </View>
              <Text style={styles.title}>Recovery code</Text>
              <Text style={styles.subtitle}>
                {step === 0
                  ? 'We will email you a 6-digit code.'
                  : 'Enter the code from your email and choose a new password.'}
              </Text>
            </View>

            <View style={styles.stepRow}>
              <View style={[styles.stepPill, step === 0 && styles.stepPillActive, { borderColor: withAlpha(t.primary, step === 0 ? 0.5 : 0.18) }]}>
                <Text style={[styles.stepText, { color: step === 0 ? t.primary : t.subtext }]}>1. Email</Text>
              </View>
              <View style={[styles.stepPill, step === 1 && styles.stepPillActive, { borderColor: withAlpha(t.primary, step === 1 ? 0.5 : 0.18) }]}>
                <Text style={[styles.stepText, { color: step === 1 ? t.primary : t.subtext }]}>2. Code + password</Text>
              </View>
            </View>

            <View style={styles.form}>
              {step === 0 ? (
                <>
                  <View style={styles.inputContainer}>
                    <Icon name="mail-outline" size={20} color={t.subtext} style={styles.inputIcon} />
                    <TextInput
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
                      returnKeyType="done"
                      onSubmitEditing={handleSendCode}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: t.primary }]}
                    onPress={handleSendCode}
                    disabled={submitting}
                    accessibilityRole="button"
                    accessibilityLabel="Email me a recovery code"
                  >
                    <Text style={styles.primaryButtonText}>{submitting ? 'Sending...' : 'Email me a recovery code.'}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.emailSummary}>
                    <Text style={styles.emailSummaryLabel}>Code sent to</Text>
                    <Text style={styles.emailSummaryValue}>{email}</Text>
                    <TouchableOpacity onPress={handleUseDifferentEmail} accessibilityRole="button" accessibilityLabel="Use a different email">
                      <Text style={[styles.inlineLink, { color: t.primary }]}>Use a different email</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inputContainer}>
                    <Icon name="keypad-outline" size={20} color={t.subtext} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="6-digit code"
                      placeholderTextColor={t.subtext}
                      value={code}
                      onChangeText={(value) => setCode(value.replace(/[^0-9]/g, '').slice(0, 6))}
                      keyboardType="number-pad"
                      textContentType="oneTimeCode"
                      autoComplete="one-time-code"
                      returnKeyType="next"
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Icon name="lock-closed-outline" size={20} color={t.subtext} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="New password"
                      placeholderTextColor={t.subtext}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      textContentType="newPassword"
                      autoComplete="password-new"
                      returnKeyType="next"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword((value) => !value)}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <Icon name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={t.subtext} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inputContainer}>
                    <Icon name="shield-checkmark-outline" size={20} color={t.subtext} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Confirm new password"
                      placeholderTextColor={t.subtext}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                      textContentType="newPassword"
                      autoComplete="password-new"
                      returnKeyType="done"
                      onSubmitEditing={handleVerifyCode}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword((value) => !value)}
                      accessibilityRole="button"
                      accessibilityLabel={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      <Icon name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={t.subtext} />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: t.primary }]}
                    onPress={handleVerifyCode}
                    disabled={submitting}
                    accessibilityRole="button"
                    accessibilityLabel="Verify code and reset password"
                  >
                    <Text style={styles.primaryButtonText}>{submitting ? 'Verifying...' : 'Verify code and reset password'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={handleSendCode}
                    disabled={submitting}
                    accessibilityRole="button"
                    accessibilityLabel="Email me another recovery code"
                  >
                    <Text style={[styles.secondaryButtonText, { color: t.primary }]}>Email me another recovery code.</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Text style={[styles.backButtonText, { color: t.subtext }]}>Back</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (t, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.background,
  },
  safeArea: {
    flex: 1,
  },
  kav: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontFamily: SERIF_FONT,
    fontSize: 36,
    color: t.text,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: SPACING.sm,
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    color: t.subtext,
    textAlign: 'center',
    lineHeight: 22,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: SPACING.xl,
  },
  stepPill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
  },
  stepPillActive: {
    backgroundColor: withAlpha(t.primary, 0.08),
  },
  stepText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '700',
  },
  form: {
    width: '100%',
  },
  emailSummary: {
    padding: SPACING.lg,
    borderRadius: 18,
    marginBottom: SPACING.md,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    borderWidth: 1,
    borderColor: t.border,
  },
  emailSummaryLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '700',
    color: t.subtext,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  emailSummaryValue: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '600',
    color: t.text,
    marginBottom: 6,
  },
  inlineLink: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.surfaceSecondary,
    borderRadius: 16,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
    height: 56,
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
    fontSize: 17,
    fontWeight: '500',
    paddingVertical: 0,
  },
  primaryButton: {
    marginTop: SPACING.lg,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
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
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: SYSTEM_FONT,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  secondaryButton: {
    marginTop: SPACING.md,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  secondaryButtonText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: '600',
  },
  backButton: {
    marginTop: SPACING.xl,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  backButtonText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: '600',
  },
});