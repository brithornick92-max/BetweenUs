import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../utils/theme';

export default function AuthScreen() {
  const { signIn, signUp, loading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleAuth = async () => {
    try {
      if (!email.trim() || !password.trim()) {
        Alert.alert('Error', 'Please fill in all fields');
        return;
      }

      if (isSignUp) {
        if (!displayName.trim()) {
          Alert.alert('Error', 'Please enter your name');
          return;
        }
        if (password !== confirmPassword) {
          Alert.alert('Error', 'Passwords do not match');
          return;
        }
        if (password.length < 6) {
          Alert.alert('Error', 'Password must be at least 6 characters');
          return;
        }

        await signUp(email.trim(), password, displayName.trim());
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Alert.alert('Success', 'Account created successfully!');
      } else {
        await signIn(email.trim(), password);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert('Error', error.message);
    }
  };

  const toggleMode = async () => {
    await Haptics.selectionAsync();
    setIsSignUp(!isSignUp);
    setEmail('');
    setPassword('');
    setDisplayName('');
    setConfirmPassword('');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.warmCharcoal, COLORS.deepPlum + '30', COLORS.warmCharcoal]}
        style={StyleSheet.absoluteFill}
        locations={[0, 0.5, 1]}
      />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={styles.header}>
              <MaterialCommunityIcons
                name="heart"
                size={48}
                color={COLORS.blushRose}
              />
              <Text style={styles.title}>Between Us</Text>
              <Text style={styles.subtitle}>
                {isSignUp ? 'Create your account' : 'Welcome back'}
              </Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {isSignUp && (
                <View style={styles.inputContainer}>
                  <MaterialCommunityIcons
                    name="account"
                    size={20}
                    color={COLORS.blushRose}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Your name"
                    placeholderTextColor={COLORS.softCream + '60'}
                    value={displayName}
                    onChangeText={setDisplayName}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
              )}

              <View style={styles.inputContainer}>
                <MaterialCommunityIcons
                  name="email"
                  size={20}
                  color={COLORS.blushRose}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor={COLORS.softCream + '60'}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputContainer}>
                <MaterialCommunityIcons
                  name="lock"
                  size={20}
                  color={COLORS.blushRose}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={COLORS.softCream + '60'}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  returnKeyType={isSignUp ? 'next' : 'done'}
                  onSubmitEditing={isSignUp ? undefined : handleAuth}
                />
              </View>

              {isSignUp && (
                <View style={styles.inputContainer}>
                  <MaterialCommunityIcons
                    name="lock-check"
                    size={20}
                    color={COLORS.blushRose}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm password"
                    placeholderTextColor={COLORS.softCream + '60'}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    returnKeyType="done"
                    onSubmitEditing={handleAuth}
                  />
                </View>
              )}

              <TouchableOpacity
                style={styles.authButton}
                onPress={handleAuth}
                disabled={loading}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={[COLORS.blushRose, COLORS.mutedGold]}
                  style={styles.authButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {loading ? (
                    <MaterialCommunityIcons
                      name="loading"
                      size={20}
                      color="#FFF"
                    />
                  ) : (
                    <Text style={styles.authButtonText}>
                      {isSignUp ? 'Create Account' : 'Sign In'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggleButton}
                onPress={toggleMode}
                activeOpacity={0.8}
              >
                <Text style={styles.toggleText}>
                  {isSignUp
                    ? 'Already have an account? Sign in'
                    : "Don't have an account? Sign up"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Privacy Note */}
            <View style={styles.privacyNote}>
              <MaterialCommunityIcons
                name="shield-check"
                size={16}
                color={COLORS.mutedGold}
              />
              <Text style={styles.privacyText}>
                Your intimate responses are encrypted and private
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  title: {
    ...TYPOGRAPHY.display,
    fontSize: 32,
    color: COLORS.softCream,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 16,
    color: COLORS.softCream + '80',
    textAlign: 'center',
  },
  form: {
    marginBottom: SPACING.xl,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    height: 56,
    color: COLORS.softCream,
    fontSize: 16,
  },
  authButton: {
    marginTop: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  authButtonGradient: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleButton: {
    marginTop: SPACING.lg,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  toggleText: {
    color: COLORS.blushRose,
    fontSize: 14,
    fontWeight: '500',
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  privacyText: {
    color: COLORS.softCream + '60',
    fontSize: 12,
    marginLeft: SPACING.xs,
    textAlign: 'center',
  },
});