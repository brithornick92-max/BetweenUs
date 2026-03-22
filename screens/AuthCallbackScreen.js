/**
 * AuthCallbackScreen — High-end authentication bridge
 * Sexy Red Intimacy & Apple Editorial Updates Integrated.
 * * Handles tokens from deep-link URL fragments for Supabase Auth.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  TouchableOpacity, 
  Linking, 
  Platform, 
  StatusBar 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';
import SupabaseAuthService from '../services/supabase/SupabaseAuthService';
import { getSupabaseOrThrow } from '../config/supabase';
import StorageRouter from '../services/storage/StorageRouter';
import { cloudSyncStorage } from '../utils/storage';
import { SPACING, withAlpha } from '../utils/theme';
import Icon from '../components/Icon';

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

/**
 * Extract access_token + refresh_token from a deep-link URL fragment.
 */
function extractTokensFromUrl(url) {
  if (!url) return null;
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return null;
  const fragment = url.substring(hashIndex + 1);
  const params = new URLSearchParams(fragment);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) return { access_token, refresh_token };
  return null;
}

export default function AuthCallbackScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium } = useEntitlements();
  
  const [status, setStatus] = useState('Signing you in...');
  const [hasSession, setHasSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    background: colors.background || '#070509', 
    surface: isDark ? '#131016' : '#FFFFFF',
    primary: colors.primary || '#C3113D', // Sexy Red
    text: colors.text || '#F2E9E6',
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  useEffect(() => {
    let active = true;

    const handleCallback = async () => {
      let sessionFound = false;
      try {
        const initialUrl = await Linking.getInitialURL();
        const tokens = extractTokensFromUrl(initialUrl);

        let session = null;

        if (tokens) {
          const supabase = getSupabaseOrThrow();
          const { data, error: setErr } = await supabase.auth.setSession({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
          });
          if (setErr) console.warn('AuthCallback: setSession error:', setErr.message);
          session = data?.session || null;
        }

        if (!session) {
          session = await SupabaseAuthService.getSession();
        }

        const syncStatus = await cloudSyncStorage.getSyncStatus();
        const syncEnabled = !!syncStatus?.enabled && !!isPremium;

        if (!active) return;

        await StorageRouter.setSupabaseSession(session);
        await StorageRouter.configureSync({
          isPremium: !!isPremium,
          syncEnabled,
          supabaseSessionPresent: !!session,
        });

        sessionFound = !!session;
        setHasSession(sessionFound);
        setStatus(session ? 'Identity verified.' : 'The link may have expired.');
      } catch (error) {
        if (!active) return;
        setStatus('Unable to complete sign-in.');
        setHasSession(false);
      } finally {
        if (!active) return;
        setChecking(false);
        if (sessionFound) {
          setTimeout(() => {
            navigation.navigate('SyncSetup');
          }, 800);
        }
      }
    };

    handleCallback();
    return () => { active = false; };
  }, [isPremium, navigation, retryKey]);

  const handleRetry = () => {
    setChecking(true);
    setHasSession(null);
    setStatus('Checking verification...');
    setRetryKey((k) => k + 1);
  };

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar barStyle="light-content" />
      
      {/* Immersive Midnight Vignette */}
      <LinearGradient
        pointerEvents="none"
        colors={['#120206', t.background, t.background]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: withAlpha(t.primary, 0.12) }]}>
            <Icon 
              name={hasSession === false ? "alert-circle-outline" : "finger-print-outline"} 
              size={32} 
              color={t.primary} 
            />
          </View>

          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: t.text }]}>
              {checking ? 'Authenticating' : (hasSession ? 'Success' : 'Verification Failed')}
            </Text>
            <Text style={[styles.subtitle, { color: t.subtext }]}>{status}</Text>
          </View>

          {checking ? (
            <ActivityIndicator color={t.primary} style={styles.loader} />
          ) : (
            hasSession === false && (
              <TouchableOpacity 
                style={[styles.primaryButton, { backgroundColor: t.primary }]} 
                onPress={handleRetry} 
                activeOpacity={0.9}
              >
                <Text style={styles.primaryButtonText}>Retry Link</Text>
                <Icon name="refresh-outline" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            )
          )}

          {hasSession && (
             <View style={[styles.indicator, { backgroundColor: t.primary }]} />
          )}
        </View>
        
        <Text style={[styles.footerText, { color: t.subtext }]}>
          Securely connecting your shared space.
        </Text>
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
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 32, // Deep Apple Squircle
    padding: SPACING.xxl,
    alignItems: 'center',
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.2,
        shadowRadius: 40,
      },
      android: { elevation: 8 },
    }),
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontFamily: SYSTEM_FONT,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
  loader: {
    marginTop: 8,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 28, // Pill shape
    paddingHorizontal: 32,
    gap: 10,
    minWidth: 180,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
    textTransform: 'uppercase',
  },
  footerText: {
    position: 'absolute',
    bottom: 50,
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    opacity: 0.8,
  },
  indicator: {
    marginTop: 12,
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.6,
  }
});
