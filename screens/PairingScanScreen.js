import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import naclUtil from 'tweetnacl-util';
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useAuth } from '../context/AuthContext';
import SupabaseAuthService from '../services/supabase/SupabaseAuthService';
import CloudEngine from '../services/storage/CloudEngine';
import StorageRouter from '../services/storage/StorageRouter';
import CoupleKeyService from '../services/security/CoupleKeyService';
import { parsePairingPayload } from '../services/security/PairingPayload';
import { STORAGE_KEYS, storage, cloudSyncStorage } from '../utils/storage';
import { TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../utils/theme';

/**
 * Scanner flow (X25519 key exchange):
 *
 * 1. Scan QR code containing { coupleId, publicKey } (inviter's public key).
 * 2. Generate own X25519 keypair (or reuse existing).
 * 3. Join couple in Supabase, uploading OUR public key to couple_members.
 * 4. Derive shared secret via box.before(inviterPubKey, mySecretKey) + HKDF.
 * 5. Store the couple symmetric key locally.
 *
 * Because box.before is commutative (both sides compute the same shared secret),
 * the inviter will derive the identical couple key when they read our public key.
 */
export default function PairingScanScreen({ navigation }) {
  const { theme } = useTheme();
  const { isPremiumEffective: isPremium } = useEntitlements();
  const { user, updateProfile } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [status, setStatus] = useState('Scan your partner\'s QR code.');
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    if (!permission) requestPermission();
    return () => { activeRef.current = false; };
  }, [permission, requestPermission]);

  const handleScan = async ({ data }) => {
    if (scanned) return;
    setScanned(true);

    try {
      const syncStatus = await cloudSyncStorage.getSyncStatus();
      if (!isPremium || !syncStatus?.enabled) {
        setStatus('Enable Sync to link partners.');
        return;
      }

      const session = await SupabaseAuthService.getSession();
      if (!session) {
        setStatus('Sign in to enable sync.');
        return;
      }

      // Step 1: Parse QR payload (contains inviter's PUBLIC key, not secret)
      const parsed = parsePairingPayload(data);
      if (!parsed.ok) throw new Error(parsed.error);
      const { coupleId, publicKey: inviterPublicKeyB64 } = parsed.payload;

      // Step 2: Get or create our device keypair
      const myPublicKeyB64 = await CoupleKeyService.getDevicePublicKeyB64();

      // Step 3: Join couple (uploads OUR public key to couple_members)
      await CloudEngine.joinCouple(coupleId, myPublicKeyB64);

      // Step 4: Derive couple key via X25519 ECDH + HKDF
      const inviterPubKey = naclUtil.decodeBase64(inviterPublicKeyB64);
      const coupleKey = await CoupleKeyService.deriveFromKeyExchange(inviterPubKey);

      // Step 5: Store the couple key
      await CoupleKeyService.storeCoupleKey(coupleId, coupleKey);

      await StorageRouter.setActiveCoupleId(coupleId);
      if (user?.uid) {
        await StorageRouter.updateUserDocument(user.uid, { coupleId });
        await updateProfile?.({ coupleId });
      }
      await storage.set(STORAGE_KEYS.COUPLE_ID, coupleId);

      setStatus('Paired successfully!');
      setTimeout(() => {
        if (activeRef.current) navigation.navigate('SyncSetup');
      }, 500);
    } catch (error) {
      if (String(error?.message || '').includes('Supabase is not configured')) {
        setStatus("Sync isn't available in this build.");
      } else {
        setStatus(error?.message || 'Unable to pair. Try again.');
      }
    }
  };

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.cameraOverlay} />
        <SafeAreaView style={styles.safeArea}>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Requesting camera permission...</Text>
        </SafeAreaView>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.cameraOverlay} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.card}>
            <Text style={[styles.title, { color: theme.colors.text }]}>Camera Access</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>We need camera access to scan the QR code.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={requestPermission} activeOpacity={0.9}>
              <Text style={styles.primaryButtonText}>Enable Camera</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <CameraView
        style={StyleSheet.absoluteFill}
        onBarcodeScanned={scanned ? undefined : handleScan}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />
      <View style={styles.cameraOverlay} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.overlay}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Scan QR Code</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{status}</Text>
          {scanned && (
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setScanned(false)}>
              <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>Scan Again</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: SPACING.xl, justifyContent: 'center' },
  card: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  title: { ...TYPOGRAPHY.h2, fontSize: 20, fontWeight: '700' },
  subtitle: { ...TYPOGRAPHY.body, marginTop: SPACING.sm, textAlign: 'center' },
  primaryButton: {
    marginTop: SPACING.lg,
    backgroundColor: '#D4AF37',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  primaryButtonText: { color: '#0B0B0B', fontWeight: '700' },
  secondaryButton: {
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  secondaryButtonText: { fontWeight: '600' },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
});
