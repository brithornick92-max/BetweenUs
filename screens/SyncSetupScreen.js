// screens/SyncSetupScreen.js — Cloud Sync
// Velvet Glass & Apple Editorial High-End Updates Integrated.
// Palette: Deep Crimson, Obsidian, Liquid Silver (Strictly No Gold).

import React, { useEffect, useState, useMemo } from 'react';
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
  StatusBar,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Icon from '../components/Icon';
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';
import { useEntitlements } from '../context/EntitlementsContext';
import { useTheme } from '../context/ThemeContext';
import { cloudSyncStorage } from '../utils/storage';
import StorageRouter from '../services/storage/StorageRouter';
import SupabaseAuthService from '../services/supabase/SupabaseAuthService';

const { width } = Dimensions.get('window');

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

export default function SyncSetupScreen({ navigation }) {
  const { isPremiumEffective: isPremium } = useEntitlements();
  const { colors, isDark } = useTheme();
  
  // ── High-End Color Logic (No Gold) ──────────────────────────────────────────
  const theme = useMemo(() => ({
    crimson: '#D2121A',
    silver: isDark ? '#E5E5E7' : '#8E8E93',
    obsidian: '#0A0A0C',
    glass: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    inputBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
  }), [isDark]);

  const styles = useMemo(() => createStyles(colors, isDark, theme), [colors, isDark, theme]);

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
      const session = await refreshSession();
      if (!active) return;
      setSyncEnabled(!!status?.enabled);
      setSessionEmail(session?.user?.email || null);
    };
    load();
    return () => { active = false; };
  }, []);

  const handleAuthAction = async () => {
    selection();
    if (authMode === 'magic') {
      await handleSendMagicLink();
    } else {
      await handlePasswordAuth();
    }
  };

  const handleSendMagicLink = async () => {
    if (!supabaseAvailable) {
      Alert.alert('Sync Unavailable', "Sync isn’t enabled in this build.");
      return;
    }
    if (!email || !email.includes('@')) {
      Alert.alert('Email Required', 'Please enter a valid email address.');
      return;
    }

    try {
      setLoading(true);
      await SupabaseAuthService.sendMagicLink(email.trim());
      impact(ImpactFeedbackStyle.Medium);
      Alert.alert('Check Your Inbox', 'We sent a secure link to your email.');
    } catch (error) {
      Alert.alert('Request Failed', error?.message || 'Unable to send magic link.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    navigation.navigate('ResetPassword', {
      initialEmail: email.trim(),
      returnTo: 'SyncSetup',
    });
  };

  const handlePasswordAuth = async () => {
    if (!supabaseAvailable) return;
    if (!email || !email.includes('@')) {
      Alert.alert('Email Required', 'Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 8) {
      Alert.alert('Security Check', 'Password must be at least 8 characters.');
      return;
    }

    try {
      setLoading(true);
      let session;
      if (isSignUp) {
        session = await SupabaseAuthService.signUp(email.trim(), password);
        if (!session) {
          Alert.alert('Verify Email', 'Please check your email to confirm your account.');
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
        impact(ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      Alert.alert('Authentication Error', error?.message || 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleEnableSync = async () => {
    if (!isPremium) {
      Alert.alert('Premium Feature', 'Cloud sync is exclusive to our premium members.');
      return;
    }
    const session = await refreshSession();
    if (!session) {
      Alert.alert('Sign In Required', 'Please sign in to your account before enabling sync.');
      return;
    }

    await cloudSyncStorage.setSyncStatus({ enabled: true, email: session?.user?.email || null });
    await StorageRouter.configureSync({ isPremium, syncEnabled: true, supabaseSessionPresent: true });
    setSyncEnabled(true);
    impact(ImpactFeedbackStyle.Heavy);
  };

  const handleDisableSync = async () => {
    await cloudSyncStorage.setSyncStatus({ enabled: false });
    await StorageRouter.configureSync({ isPremium, syncEnabled: false, supabaseSessionPresent: false });
    setSyncEnabled(false);
    impact(ImpactFeedbackStyle.Light);
  };

  const handleSignOut = async () => {
    try {
      await SupabaseAuthService.signOut();
    } catch (e) {
      if (__DEV__) console.warn('[SyncSetup] signOut error (proceeding with local cleanup):', e?.message);
    }
    await handleDisableSync();
    setSessionEmail(null);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
      <LinearGradient
        colors={isDark ? [theme.obsidian, '#1A0205', theme.obsidian] : ['#FFFFFF', '#F9F4F4', '#FFFFFF']}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Crimson Ambient Glow */}
      <GlowOrb color={theme.crimson} size={450} top={-150} left={width - 200} opacity={0.08} />
      <FilmGrain opacity={0.035} />

      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Apple Editorial Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Icon name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.headerEye, { color: theme.crimson }]}>Security & Continuity</Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Cloud Sync</Text>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Sync Status Card (Velvet Glass) */}
            <BlurView intensity={isDark ? 20 : 40} tint={isDark ? "dark" : "light"} style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <View style={[styles.statusIconCircle, { backgroundColor: syncEnabled ? '#D2121A20' : '#8E8E9320' }]}>
                  <Icon 
                    name={syncEnabled ? "cloud-done" : "cloud-offline"} 
                    size={24} 
                    color={syncEnabled ? theme.crimson : colors.textMuted} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusLabel, { color: colors.text }]}>
                    {syncEnabled ? 'Vault Synchronized' : 'Local Storage'}
                  </Text>
                  <Text style={[styles.statusSubtext, { color: colors.textMuted }]}>
                    {sessionEmail ? `Linked to ${sessionEmail}` : 'Sign in to enable encrypted backup'}
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={syncEnabled ? handleDisableSync : handleEnableSync}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={syncEnabled ? [theme.crimson, '#900C0F'] : ['#444', '#222']}
                    style={styles.statusToggle}
                  >
                    <Text style={styles.statusToggleText}>{syncEnabled ? 'ON' : 'OFF'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </BlurView>

            {/* Auth Access Card */}
            <View style={styles.formCard}>
              <Text style={[styles.formTitle, { color: colors.text }]}>Account Access</Text>
              
              {/* Apple Segmented Control Style Toggle */}
              <View style={styles.segmentedWrapper}>
                <TouchableOpacity 
                  style={[styles.segment, authMode === 'password' && styles.segmentActive]} 
                  onPress={() => { selection(); setAuthMode('password'); }}
                >
                  <Text style={[styles.segmentText, authMode === 'password' && styles.segmentTextActive]}>Password</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.segment, authMode === 'magic' && styles.segmentActive]} 
                  onPress={() => { selection(); setAuthMode('magic'); }}
                >
                  <Text style={[styles.segmentText, authMode === 'magic' && styles.segmentTextActive]}>Magic Link</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Email Address"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                {authMode === 'password' && (
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="Password"
                    placeholderTextColor={colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                )}
              </View>

              <TouchableOpacity 
                style={styles.mainActionBtn} 
                onPress={handleAuthAction}
                disabled={loading}
              >
                <LinearGradient
                  colors={[theme.crimson, '#900C0F']}
                  style={styles.mainActionGrad}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.mainActionText}>
                      {authMode === 'magic' ? 'Send Secure Link' : (isSignUp ? 'Create Account' : 'Sign In')}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {authMode === 'password' && !isSignUp && (
                <TouchableOpacity
                  style={styles.textLink}
                  onPress={handleForgotPassword}
                  disabled={loading}
                >
                  <Text style={[styles.textLinkTxt, styles.forgotText, { color: theme.crimson }]}>Email me a recovery code.</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={styles.textLink} 
                onPress={() => setIsSignUp(!isSignUp)}
              >
                <Text style={[styles.textLinkTxt, { color: colors.textMuted }]}>
                  {isSignUp ? 'Back to secure sign in' : "New here? Establish a vault account"}
                </Text>
              </TouchableOpacity>
            </View>

            {sessionEmail && (
              <TouchableOpacity 
                style={styles.signOutBtn} 
                onPress={handleSignOut}
                activeOpacity={0.7}
              >
                <Icon name="log-out-outline" size={18} color={theme.crimson} />
                <Text style={styles.signOutText}>Sign Out of Vault</Text>
              </TouchableOpacity>
            )}

            {/* Security Guarantee Footer */}
            <View style={styles.footerTeaser}>
              <Icon name="shield-checkmark" size={26} color={theme.crimson} />
              <Text style={[styles.footerTitle, { color: colors.text }]}>Zero-Knowledge Architecture</Text>
              <Text style={[styles.footerBody, { color: colors.textMuted }]}>
                Only your linked devices hold the keys to your data. We never see your private notes, plans, or history.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (colors, isDark, theme) => StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 60 },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerEye: {
    fontFamily: SYSTEM_FONT,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1.2,
  },

  // Status Card (Velvet Glass)
  statusCard: {
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
    padding: 22,
    marginBottom: 28,
    overflow: 'hidden',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statusIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusLabel: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  statusSubtext: { fontSize: 13, marginTop: 2, opacity: 0.8 },
  statusToggle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    minWidth: 54,
    alignItems: 'center',
  },
  statusToggleText: { color: '#FFF', fontSize: 10, fontWeight: '900' },

  // Form Card
  formCard: { gap: 20 },
  formTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.6 },
  segmentedWrapper: {
    flexDirection: 'row',
    padding: 5,
    borderRadius: 16,
    height: 48,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  segmentActive: {
    backgroundColor: isDark ? '#FFF' : '#000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  segmentText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  segmentTextActive: { color: isDark ? '#000' : '#FFF' },

  inputGroup: { gap: 14 },
  input: {
    height: 58,
    borderRadius: 20,
    paddingHorizontal: 18,
    fontSize: 16,
    fontFamily: SYSTEM_FONT,
    backgroundColor: theme.inputBg,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
  },

  mainActionBtn: {
    borderRadius: 22,
    height: 60,
    overflow: 'hidden',
    marginTop: 10,
    ...Platform.select({
      ios: { shadowColor: '#D2121A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 15 },
      android: { elevation: 8 },
    }),
  },
  mainActionGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mainActionText: { color: '#FFF', fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },

  textLink: { alignSelf: 'center', padding: 10 },
  textLinkTxt: { fontSize: 14, fontWeight: '600' },
  forgotText: { fontWeight: '700' },

  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 30,
    padding: 12,
  },
  signOutText: { color: '#D2121A', fontSize: 15, fontWeight: '700' },

  footerTeaser: {
    marginTop: 45,
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 14,
  },
  footerTitle: { fontSize: 17, fontWeight: '800' },
  footerBody: { textAlign: 'center', fontSize: 14, lineHeight: 22, opacity: 0.6 },
});
