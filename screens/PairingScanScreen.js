/**
 * PairingScanScreen — Secure Partner Bridge (Receiver)
 * Sexy Red Intimacy & Apple Editorial Updates Integrated.
 * * Handles secure QR scanning and X25519 shared secret derivation.
 */

import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Platform, 
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { BlurView } from 'expo-blur';
import naclUtil from 'tweetnacl-util';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import SupabaseAuthService from '../services/supabase/SupabaseAuthService';
import StorageRouter from '../services/storage/StorageRouter';
import CloudEngine from '../services/storage/CloudEngine';
import CoupleKeyService from '../services/security/CoupleKeyService';
import { parsePairingPayload } from '../services/security/PairingPayload';
import CoupleService from '../services/supabase/CoupleService';
import { STORAGE_KEYS, storage } from '../utils/storage';
import { SPACING, withAlpha } from '../utils/theme';
import Icon from '../components/Icon';

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

export default function PairingScanScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { user, updateProfile } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [status, setStatus] = useState("Position your partner's code in view.");
  const activeRef = useRef(true);

  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    background: colors.background || '#070509', 
    surface: isDark ? '#131016' : '#FFFFFF',
    primary: colors.primary || '#D2121A', // Sexy Red
    text: colors.text || '#F2E9E6',
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  useEffect(() => {
    activeRef.current = true;
    if (!permission) requestPermission();
    return () => { activeRef.current = false; };
  }, [permission, requestPermission]);

  const ensureCloudSession = useCallback(async () => {
    const session = await SupabaseAuthService.getSession().catch((error) => {
      if (String(error?.message || '').includes('Supabase is not configured')) {
        setStatus("Sync isn't available in this build.");
        return null;
      }
      return null;
    });

    if (session) {
      await StorageRouter.setSupabaseSession(session);
      return session;
    }

    // Fall back to anonymous sign-in
    const retrySession = await SupabaseAuthService.signInAnonymously().catch(() => null);
    if (retrySession) {
      await StorageRouter.setSupabaseSession(retrySession);
      return retrySession;
    }

    setStatus('Cloud session expired. Please sign in again via Cloud Sync.');
    return null;
  }, []);

  const handleScan = async ({ data }) => {
    if (scanned) return;
    setScanned(true);

    try {
      const session = await ensureCloudSession();
      if (!session) {
        setScanned(false);
        return;
      }

      await CloudEngine.initialize({ supabaseSessionPresent: true });

      const parsed = parsePairingPayload(data);
      if (!parsed.ok) throw new Error(parsed.error);
      const { pairingCode, publicKey: inviterPublicKeyB64 } = parsed.payload;

      setStatus('Establishing secure bridge...');
      
      const myPublicKeyB64 = await CoupleKeyService.getDevicePublicKeyB64();
      const { coupleId } = await CoupleService.redeemPairingCode(pairingCode, myPublicKeyB64);

      const inviterPubKey = naclUtil.decodeBase64(inviterPublicKeyB64);
      const coupleKey = await CoupleKeyService.deriveFromKeyExchange(inviterPubKey);

      await CoupleKeyService.storeCoupleKey(coupleId, coupleKey);
      await StorageRouter.setActiveCoupleId(coupleId);
      
      if (user?.uid) {
        await StorageRouter.updateUserDocument(user.uid, { coupleId });
        await updateProfile?.({ coupleId });
      }
      await storage.set(STORAGE_KEYS.COUPLE_ID, coupleId);

      setStatus('Successfully paired.');
      setTimeout(() => {
        if (!activeRef.current) return;
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('Settings');
        }
      }, 1000);
    } catch (error) {
      const msg = String(error?.message || '');
      if (msg.includes('expired') || msg.includes('Invalid') || msg.includes('already-used')) {
        setStatus('This code has expired. Ask your partner to tap "Try Again" for a new one.');
      } else if (msg.includes('already in a couple')) {
        setStatus('You are already linked. Unlink first from Settings.');
      } else {
        setStatus(msg || 'Unable to read link. Try again.');
      }
      setScanned(false);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={[styles.container, { backgroundColor: t.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: withAlpha(t.primary, 0.12) }]}>
              <Icon name="camera-outline" size={32} color={t.primary} />
            </View>
            <Text style={[styles.title, { color: t.text }]}>Camera Access</Text>
            <Text style={[styles.subtitle, { color: t.subtext }]}>
              We need permission to scan the secure QR link from your partner.
            </Text>
            <TouchableOpacity 
              style={[styles.primaryButton, { backgroundColor: t.primary }]} 
              onPress={requestPermission}
            >
              <Text style={styles.primaryButtonText}>Enable Camera</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      <StatusBar barStyle="light-content" />
      
      <CameraView
        style={StyleSheet.absoluteFill}
        onBarcodeScanned={scanned ? undefined : handleScan}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Editorial Viewfinder Overlay */}
      <View style={styles.viewfinderOverlay}>
        <View style={styles.vignetteTop} />
        <View style={styles.viewfinderRow}>
          <View style={styles.vignetteSide} />
          <View style={[styles.viewfinder, { borderColor: scanned ? t.primary : '#FFF' }]}>
            {scanned && <ActivityIndicator color={t.primary} size="large" />}
          </View>
          <View style={styles.vignetteSide} />
        </View>
        <View style={styles.vignetteBottom} />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <BlurView intensity={20} tint="dark" style={styles.blurBack}>
            <Icon name="chevron-back" size={28} color="#FFF" />
          </BlurView>
        </TouchableOpacity>

        <View style={styles.statusContainer}>
          <BlurView intensity={30} tint="dark" style={styles.statusBlur}>
            <Icon 
              name={scanned ? "sync-outline" : "scan-outline"} 
              size={18} 
              color={scanned ? t.primary : "#FFF"} 
            />
            <Text style={styles.statusText}>{status}</Text>
          </BlurView>
          
          {scanned && !status.includes('Success') && (
            <TouchableOpacity 
              style={styles.retryBtn} 
              onPress={() => setScanned(false)}
            >
              <Text style={{ color: t.primary, fontWeight: '800' }}>RETRY</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.footerBranding}>
          <Icon name="shield-checkmark" size={12} color="rgba(255,255,255,0.4)" />
          <Text style={styles.brandingText}>SECURE KEY EXCHANGE</Text>
        </View>
      </SafeAreaView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 24,
    zIndex: 20,
  },
  blurBack: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  card: {
    marginHorizontal: 32,
    marginTop: '40%',
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: { 
    fontFamily: SYSTEM_FONT,
    fontSize: 24, 
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: { 
    fontFamily: SYSTEM_FONT,
    fontSize: 16, 
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  primaryButton: {
    height: 56,
    borderRadius: 28,
    paddingHorizontal: 32,
    justifyContent: 'center',
    width: '100%',
  },
  primaryButtonText: { 
    color: '#FFFFFF', 
    fontFamily: SYSTEM_FONT,
    fontSize: 16, 
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  viewfinderOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  vignetteTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  viewfinderRow: { flexDirection: 'row', height: 260 },
  vignetteSide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  viewfinder: {
    width: 260,
    borderWidth: 2,
    borderRadius: 40,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vignetteBottom: { flex: 2, backgroundColor: 'rgba(0,0,0,0.6)' },
  statusContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 16,
  },
  statusBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statusText: {
    color: '#FFF',
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '700',
  },
  retryBtn: {
    padding: 10,
  },
  footerBranding: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
  },
  brandingText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  modalCard: {
    backgroundColor: '#131016',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: SPACING.xl,
    alignItems: 'center',
  },
  modalBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(210,18,26,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    color: '#F2E9E6',
    fontFamily: SYSTEM_FONT,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  modalBody: {
    color: 'rgba(242,233,230,0.7)',
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  modalInput: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#F2E9E6',
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    marginBottom: SPACING.lg,
  },
  modalActions: {
    width: '100%',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  modalButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#D2121A',
  },
  modalButtonSecondary: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalButtonDisabled: {
    opacity: 0.72,
  },
  modalButtonPrimaryText: {
    color: '#FFFFFF',
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  modalButtonSecondaryText: {
    color: '#F2E9E6',
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: '700',
  }
});
