import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEntitlements } from '../context/EntitlementsContext';
import { useTheme } from '../context/ThemeContext';
import { cloudSyncStorage } from '../utils/storage';
import StorageRouter from '../services/storage/StorageRouter';
import SupabaseAuthService from '../services/supabase/SupabaseAuthService';
import { TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../utils/theme';

export default function SyncSetupScreen({ navigation }) {
  const { isPremiumEffective: isPremium } = useEntitlements();
  const theme = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState('password'); // 'password' | 'magic'
  const [isSignUp, setIsSignUp] = useState(false);
  const [sessionEmail, setSessionEmail] = useState(null);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supabaseAvailable, setSupabaseAvailable] = useState(true);

  const refreshSession = async () => {
    const session = await SupabaseAuthService.getSession().catch((error) => {
      if (String(error?.message || '').includes('Supabase is not configured')) {
        setSupabaseAvailable(false);
        return null;
      }
      return null;
    });
    setSessionEmail(session?.user?.email || null);
    return session;
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      const status = await cloudSyncStorage.getSyncStatus();
      const session = await SupabaseAuthService.getSession().catch((error) => {
        if (String(error?.message || '').includes('Supabase is not configured')) {
          setSupabaseAvailable(false);
          return null;
        }
        return null;
      });
      if (!active) return;
      setSyncEnabled(!!status?.enabled);
      setSessionEmail(session?.user?.email || null);
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const handleSendMagicLink = async () => {
    if (!supabaseAvailable) {
      Alert.alert('Sync unavailable', "Sync isn’t available in this build.");
      return;
    }
    if (!email || !email.includes('@')) {
      Alert.alert('Enter email', 'Please enter a valid email to continue.');
      return;
    }

    try {
      setLoading(true);
      await SupabaseAuthService.sendMagicLink(email.trim());
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert('Check your email', 'Open the link in your email to finish signing in.');
    } catch (error) {
      if (String(error?.message || '').includes('Supabase is not configured')) {
        setSupabaseAvailable(false);
        Alert.alert('Sync unavailable', "Sync isn’t available in this build.");
      } else {
        Alert.alert('Sign-in failed', error?.message || 'Unable to send magic link.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordAuth = async () => {
    if (!supabaseAvailable) {
      Alert.alert('Sync unavailable', "Sync isn't available in this build.");
      return;
    }
    if (!email || !email.includes('@')) {
      Alert.alert('Enter email', 'Please enter a valid email to continue.');
      return;
    }
    if (!password || password.length < 6) {
      Alert.alert('Password required', 'Please enter a password (at least 6 characters).');
      return;
    }

    try {
      setLoading(true);
      let session;
      if (isSignUp) {
        session = await SupabaseAuthService.signUp(email.trim(), password);
        if (!session) {
          // Some Supabase projects require email confirmation even for password sign-up
          Alert.alert('Check your email', 'Please confirm your email address, then come back and sign in.');
          setIsSignUp(false);
          return;
        }
      } else {
        session = await SupabaseAuthService.signInWithPassword(email.trim(), password);
      }

      if (session) {
        await StorageRouter.setSupabaseSession(session);
        await StorageRouter.configureSync({
          isPremium: !!isPremium,
          syncEnabled,
          supabaseSessionPresent: true,
        });
        setSessionEmail(session.user?.email || null);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert('Signed in', 'Your sync account is ready.');
      }
    } catch (error) {
      const msg = error?.message || 'Unable to sign in.';
      if (msg.includes('Invalid login credentials')) {
        Alert.alert('Sign-in failed', 'Incorrect email or password. If you don\'t have an account yet, tap "Create account" below.');
      } else if (msg.includes('User already registered')) {
        Alert.alert('Account exists', 'This email already has an account. Switch to sign-in mode.');
        setIsSignUp(false);
      } else {
        Alert.alert('Sign-in failed', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCheckSession = async () => {
    try {
      setLoading(true);
      const session = await refreshSession();
      if (session) {
        Alert.alert('Signed in', 'Your sync account is ready.');
      } else {
        Alert.alert('Not signed in', 'We could not find an active session yet.');
      }
    } catch (error) {
      if (String(error?.message || '').includes('Supabase is not configured')) {
        setSupabaseAvailable(false);
        Alert.alert('Sync unavailable', "Sync isn’t available in this build.");
      } else {
        Alert.alert('Error', 'Unable to refresh session.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEnableSync = async () => {
    if (!isPremium) {
      Alert.alert('Premium required', 'Cloud sync is available for premium couples.');
      return;
    }
    if (!supabaseAvailable) {
      Alert.alert('Sync unavailable', "Sync isn’t available in this build.");
      return;
    }

    const session = await refreshSession();
    if (!session) {
      Alert.alert('Sign in first', 'Please sign in with your email before enabling sync.');
      return;
    }

    await cloudSyncStorage.setSyncStatus({ enabled: true, email: session?.user?.email || null });
    await StorageRouter.configureSync({
      isPremium,
      syncEnabled: true,
      supabaseSessionPresent: true,
    });
    setSyncEnabled(true);
    Alert.alert('Sync enabled', 'Your data will sync when you are connected.');
  };

  const handleDisableSync = async () => {
    await cloudSyncStorage.setSyncStatus({ enabled: false });
    await StorageRouter.configureSync({
      isPremium,
      syncEnabled: false,
      supabaseSessionPresent: false,
    });
    setSyncEnabled(false);
    Alert.alert('Sync disabled', 'Cloud sync is now turned off.');
  };

  const handleSignOut = async () => {
    try {
      await SupabaseAuthService.signOut();
    } catch (error) {
      // ignore sign out errors
    }
    await handleDisableSync();
    setSessionEmail(null);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      {/* IMPORTANT: prevent background layer from stealing touches */}
      <LinearGradient
        pointerEvents="none"
        colors={theme.gradients.secondary || theme.gradients.background || [theme.colors.background, theme.colors.background]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Cloud Sync</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Enable Secure Sync</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Sync is optional and only available to premium couples.
          </Text>

          {!supabaseAvailable && (
            <Text style={[styles.notice, { color: theme.colors.warning }]}>
              Sync isn’t available in this build.
            </Text>
          )}
          {/* Auth mode toggle */}
          <View style={styles.authToggleRow}>
            <TouchableOpacity
              style={[styles.authToggle, authMode === 'password' && styles.authToggleActive]}
              onPress={() => setAuthMode('password')}
              activeOpacity={0.8}
            >
              <Text style={[styles.authToggleText, authMode === 'password' && styles.authToggleTextActive]}>
                Email & Password
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.authToggle, authMode === 'magic' && styles.authToggleActive]}
              onPress={() => setAuthMode('magic')}
              activeOpacity={0.8}
            >
              <Text style={[styles.authToggleText, authMode === 'magic' && styles.authToggleTextActive]}>
                Magic Link
              </Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
            placeholder="Email"
            placeholderTextColor={theme.colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading && supabaseAvailable}
            autoCorrect={false}
            blurOnSubmit={false}
            returnKeyType={authMode === 'password' ? 'next' : 'done'}
            textContentType="emailAddress"
            autoComplete="email"
          />

          {authMode === 'password' && (
            <TextInput
              style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="Password (min 6 characters)"
              placeholderTextColor={theme.colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              secureTextEntry
              editable={!loading && supabaseAvailable}
              autoCorrect={false}
              blurOnSubmit
              returnKeyType="done"
              textContentType="password"
              autoComplete="password"
            />
          )}

          {authMode === 'password' ? (
            <>
              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handlePasswordAuth}
                disabled={loading || !supabaseAvailable}
                activeOpacity={0.9}
              >
                <Text style={styles.primaryButtonText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggleLink}
                onPress={() => setIsSignUp(!isSignUp)}
                activeOpacity={0.8}
              >
                <Text style={[styles.toggleLinkText, { color: theme.colors.textSecondary }]}>
                  {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleSendMagicLink}
                disabled={loading || !supabaseAvailable}
                activeOpacity={0.9}
              >
                <Text style={styles.primaryButtonText}>Send Magic Link</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryButton, loading && styles.buttonDisabled]}
                onPress={handleCheckSession}
                disabled={loading || !supabaseAvailable}
                activeOpacity={0.9}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>
                  I clicked the link
                </Text>
              </TouchableOpacity>
            </>
          )}

          <View style={styles.statusRow}>
            <MaterialCommunityIcons
              name={sessionEmail ? 'check-circle' : 'alert-circle'}
              size={20}
              color={sessionEmail ? theme.colors.success : theme.colors.textSecondary}
            />
            <Text style={[styles.statusText, { color: theme.colors.textSecondary }]}>
              {sessionEmail ? `Signed in as ${sessionEmail}` : 'Not signed in'}
            </Text>
          </View>

          <View style={styles.divider} />

          {syncEnabled ? (
            <TouchableOpacity style={styles.dangerButton} onPress={handleDisableSync} activeOpacity={0.9}>
              <Text style={styles.dangerButtonText}>Disable Sync</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.primaryButton} onPress={handleEnableSync} activeOpacity={0.9}>
              <Text style={styles.primaryButtonText}>Enable Sync</Text>
            </TouchableOpacity>
          )}

          {sessionEmail && (
            <TouchableOpacity style={styles.secondaryButton} onPress={handleSignOut} activeOpacity={0.9}>
              <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>Sign Out</Text>
            </TouchableOpacity>
          )}
        </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
  },
  scrollContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.h1,
    fontSize: 22,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  card: {
    backgroundColor: '#151118',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
  },
  title: {
    ...TYPOGRAPHY.h2,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    marginBottom: SPACING.lg,
  },
  input: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  primaryButton: {
    backgroundColor: '#A89060',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  primaryButtonText: {
    color: '#0B0B0B',
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  secondaryButtonText: {
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  notice: {
    ...TYPOGRAPHY.body,
    marginBottom: SPACING.md,
  },
  statusText: {
    marginLeft: SPACING.sm,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: SPACING.md,
  },
  dangerButton: {
    backgroundColor: '#5E1B1B',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  dangerButtonText: {
    color: '#C8A870',
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  authToggleRow: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  authToggle: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  authToggleActive: {
    backgroundColor: 'rgba(168,144,96,0.25)',
  },
  authToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  authToggleTextActive: {
    color: '#A89060',
  },
  toggleLink: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  toggleLinkText: {
    fontSize: 13,
  },
});
