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
  const { theme } = useTheme();
  const { isPremiumEffective: isPremium } = useEntitlements();
  const [status, setStatus] = useState('Checking sign-in status...');
  const [hasSession, setHasSession] = useState(null);
  const [checking, setChecking] = useState(true);

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
  }, [isPremium, navigation]);

  const handleRetry = () => {
    setChecking(true);
    setHasSession(null);
    setStatus('Checking sign-in status...');
    navigation.replace('AuthCallback');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <LinearGradient colors={theme.gradients.secondary} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.card}>
          {checking && <ActivityIndicator color={theme.colors.blushRose} />}
          <Text style={[styles.title, { color: theme.colors.text }]}>{status}</Text>
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
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    backgroundColor: '#D4AF37',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  primaryButtonText: {
    color: '#0B0B0B',
    fontWeight: '700',
  },
});
