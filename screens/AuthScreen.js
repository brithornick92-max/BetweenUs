// File: screens/AuthScreen.js

import React, { useMemo, useState } from 'react';
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
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../utils/theme';

export default function AuthScreen() {
  const { signIn, signUp, loading } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [focused, setFocused] = useState(null); // 'email' | 'password' | 'displayName' | 'confirmPassword' | null

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const focusStyle = useMemo(
    () => (key) =>
      focused === key
        ? {
            borderColor: '#D41D6D',
            shadowColor: '#D41D6D',
            shadowOpacity: 0.35,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          }
        : {},
    [focused]
  );

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
      Alert.alert('Error', error?.message ?? 'Something went wrong');
    }
  };

  const toggleMode = async () => {
    await Haptics.selectionAsync();
    setIsSignUp((v) => !v);
    setFocused(null);
    setEmail('');
    setPassword('');
    setDisplayName('');
    setConfirmPassword('');
  };

  return (
    <LinearGradient colors={['#2D0B22', '#2D0B22']} style={styles.container} locations={[0, 1]}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.topSpacer} />

            {/* Header */}
            <View style={styles.header}>
              <MaterialCommunityIcons name="heart" size={48} color="#9B6B7B" style={styles.heartIcon} />
              <Text style={styles.title}>Between Us</Text>
              <Text style={styles.subtitle}>A PRIVATE SANCTUARY</Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {isSignUp && (
                <View style={[styles.inputContainer, focusStyle('displayName')]}>
                  <MaterialCommunityIcons
                    name="account"
                    size={20}
                    color="#9B6B7B"
                    style={styles.inputIcon}
                    pointerEvents="none"
                  />
                  <View style={styles.inputFieldColumn}>
                    <Text style={styles.inputLabel}>YOUR NAME</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Your name"
                      placeholderTextColor="rgba(255,255,255,0.2)"
                      value={displayName}
                      onChangeText={setDisplayName}
                      autoCapitalize="words"
                      returnKeyType="next"
                      textContentType="name"
                      autoComplete="name"
                      onFocus={() => setFocused('displayName')}
                      onBlur={() => setFocused(null)}
                    />
                  </View>
                </View>
              )}

              <View style={[styles.inputContainer, focusStyle('email')]}>
                <MaterialCommunityIcons
                  name="email"
                  size={20}
                  color="#9B6B7B"
                  style={styles.inputIcon}
                  pointerEvents="none"
                />
                <View style={styles.inputFieldColumn}>
                  <Text style={styles.inputLabel}>EMAIL</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="name@example.com"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    // ✅ IMPORTANT: do NOT use oneTimeCode here (causes focus loss)
                    textContentType="emailAddress"
                    autoComplete="email"
                    importantForAutofill="no"
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                  />
                </View>
              </View>

              <View style={[styles.inputContainer, focusStyle('password')]}>
                <MaterialCommunityIcons
                  name="lock"
                  size={20}
                  color="#9B6B7B"
                  style={styles.inputIcon}
                  pointerEvents="none"
                />
                <View style={styles.inputFieldColumn}>
                  <Text style={styles.inputLabel}>PASSWORD</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    returnKeyType={isSignUp ? 'next' : 'done'}
                    onSubmitEditing={isSignUp ? undefined : handleAuth}
                    // ✅ IMPORTANT: do NOT use oneTimeCode here (causes focus loss)
                    textContentType="password"
                    autoComplete={Platform.OS === 'ios' ? 'password' : 'off'}
                    importantForAutofill="no"
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                  />
                </View>
              </View>

              {isSignUp && (
                <View style={[styles.inputContainer, focusStyle('confirmPassword')]}>
                  <MaterialCommunityIcons
                    name="lock-check"
                    size={20}
                    color="#9B6B7B"
                    style={styles.inputIcon}
                    pointerEvents="none"
                  />
                  <View style={styles.inputFieldColumn}>
                    <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor="rgba(255,255,255,0.2)"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry
                      returnKeyType="done"
                      onSubmitEditing={handleAuth}
                      textContentType="password"
                      autoComplete={Platform.OS === 'ios' ? 'password' : 'off'}
                      importantForAutofill="no"
                      onFocus={() => setFocused('confirmPassword')}
                      onBlur={() => setFocused(null)}
                    />
                  </View>
                </View>
              )}

              <View style={styles.buttonShadow}>
                <LinearGradient
                  colors={['#E8E8E8', '#A9A9A9', '#C0C0C0']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.authButtonGradient}
                >
                  <TouchableOpacity
                    style={styles.authButtonTouchable}
                    onPress={handleAuth}
                    disabled={loading}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.authButtonText}>
                      {loading ? 'Please wait…' : isSignUp ? 'Create Account' : 'Sign In'}
                    </Text>
                  </TouchableOpacity>
                </LinearGradient>
              </View>

              <TouchableOpacity style={styles.toggleButton} onPress={toggleMode} disabled={loading}>
                <Text style={styles.toggleText}>
                  {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Security */}
            <View style={styles.securityBadge}>
              <MaterialCommunityIcons name="shield-check" size={16} color={COLORS?.mutedGold ?? '#C6A65B'} />
              <Text style={styles.securityText}>Your intimate responses are encrypted and private</Text>
            </View>

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  kav: { flex: 1 },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 30,
    alignItems: 'center',
  },

  topSpacer: { height: 44 },
  bottomSpacer: { height: 36 },

  header: {
    alignItems: 'center',
    marginBottom: 18,
  },
  heartIcon: { marginBottom: 18 },
  title: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 40,
    fontWeight: '700',
    color: '#F5F5F5',
    letterSpacing: -1,
    marginTop: 10,
  },
  subtitle: {
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
    fontSize: 12,
    color: 'rgba(192, 192, 192, 0.7)',
    marginTop: 10,
    marginBottom: 18,
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },

  form: {
    width: '100%',
    marginBottom: 14,
  },

  inputFieldColumn: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    minWidth: 0,
  },
  inputLabel: {
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    height: 62,
  },
  inputIcon: { marginRight: 12 },

  // Important: input height smaller than container so caret positioning is stable
  input: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    backgroundColor: 'transparent',
    height: 40,
    paddingVertical: 0,
  },

  buttonShadow: {
    shadowColor: '#C0C0C0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
    marginTop: 10,
  },
  authButtonGradient: {
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  authButtonTouchable: {
    height: 56,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  authButtonText: {
    color: '#1a0614',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  toggleButton: {
    marginTop: 18,
    alignItems: 'center',
  },
  toggleText: {
    color: COLORS?.roseGold ?? '#D4AF37',
    fontSize: 14,
    fontWeight: '600',
  },

  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    paddingHorizontal: 12,
  },
  securityText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    textAlign: 'center',
    marginLeft: 6,
    lineHeight: 18,
  },
});
