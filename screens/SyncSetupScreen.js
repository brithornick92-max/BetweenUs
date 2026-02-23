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

          <TextInput
            style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
            placeholder="Email"
            placeholderTextColor={theme.colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading && supabaseAvailable}
            // Keyboard stability helpers
            autoCorrect={false}
            blurOnSubmit={false}
            returnKeyType="done"
            textContentType="emailAddress"
            autoComplete="email"
          />

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
});
