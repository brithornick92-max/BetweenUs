import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';
import SupabaseAuthService from '../services/supabase/SupabaseAuthService';
import StorageRouter from '../services/storage/StorageRouter';
import { cloudSyncStorage } from '../utils/storage';
import { TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../utils/theme';

export default function AuthCallbackScreen({ navigation }) {
  const { colors, gradients } = useTheme();
  const { isPremiumEffective: isPremium } = useEntitlements();
  const [status, setStatus] = useState('Checking sign-in status...');
  const [hasSession, setHasSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;

    const handleCallback = async () => {
      let sessionFound = false;
      try {
        const session = await SupabaseAuthService.getSession();
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
        setStatus(session ? 'Signed in. Redirecting…' : 'No session found.');
      } catch (error) {
        if (!active) return;
        if (String(error?.message || '').includes('Supabase is not configured')) {
          setStatus("Sync isn't available in this build.");
        } else {
          setStatus('Unable to complete sign-in.');
        }
        setHasSession(false);
      } finally {
        if (!active) return;
        setChecking(false);
        if (sessionFound) {
          // small delay to let state settle
          setTimeout(() => {
            navigation.navigate('SyncSetup');
          }, 500);
        }
      }
    };

    handleCallback();

    return () => {
      active = false;
    };
  }, [isPremium, navigation, retryKey]);

  const handleRetry = () => {
    setChecking(true);
    setHasSession(null);
    setStatus('Checking sign-in status...');
    setRetryKey((k) => k + 1);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* IMPORTANT: prevent background layer from stealing touches */}
      <LinearGradient
        pointerEvents="none"
        colors={gradients?.secondary || gradients?.background || [colors.background, colors.background]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.card}>
          {checking && <ActivityIndicator color={colors.primary} />}
          <Text style={[styles.title, { color: colors.text }]}>{status}</Text>

          {hasSession === false && (
            <TouchableOpacity style={styles.primaryButton} onPress={handleRetry} activeOpacity={0.9}>
              <Text style={styles.primaryButtonText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
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
    paddingHorizontal: SPACING.xl,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#151118',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  title: {
    ...TYPOGRAPHY.body,
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: SPACING.lg,
    backgroundColor: '#A89060',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  primaryButtonText: {
    color: '#0B0B0B',
    fontWeight: '700',
  },
});
