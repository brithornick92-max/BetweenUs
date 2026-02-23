import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import naclUtil from 'tweetnacl-util';
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useAuth } from '../context/AuthContext';
import SupabaseAuthService from '../services/supabase/SupabaseAuthService';
import StorageRouter from '../services/storage/StorageRouter';
import CloudEngine from '../services/storage/CloudEngine';
import CoupleKeyService from '../services/security/CoupleKeyService';
import { makePairingPayload } from '../services/security/PairingPayload';
import { cloudSyncStorage, STORAGE_KEYS, storage } from '../utils/storage';
import { TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../utils/theme';

/**
 * Inviter flow (X25519 key exchange):
 *
 * 1. Generate device X25519 keypair (or reuse existing).
 * 2. Create couple in Supabase, store our public key in couple_members.
 * 3. Embed { coupleId, publicKey } in QR code (never the secret key).
 * 4. Wait for partner to scan + upload their public key.
 * 5. Derive shared secret via box.before(partnerPub, mySecret) + HKDF.
 * 6. Store the couple symmetric key locally.
 */
export default function PairingQRCodeScreen({ navigation }) {
  const theme = useTheme();
  const { isPremiumEffective: isPremium } = useEntitlements();
  const { user, updateProfile } = useAuth();

  const [qrPayload, setQrPayload] = useState(null);
  const [status, setStatus] = useState('Preparing QR code...');
  const [phase, setPhase] = useState('init'); // init | showing_qr | waiting | done | error
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;

    const prepare = async () => {
      try {
        const syncStatus = await cloudSyncStorage.getSyncStatus();
        if (!isPremium || !syncStatus?.enabled) {
          setStatus('Enable Sync to link partners.');
          setPhase('error');
          return;
        }

        const session = await SupabaseAuthService.getSession();
        if (!session) {
          setStatus('Sign in to enable sync.');
          setPhase('error');
          return;
        }

        // Step 1: Get or create our device keypair
        const myPublicKeyB64 = await CoupleKeyService.getDevicePublicKeyB64();

        // Step 2: Create couple (stores our public key in couple_members)
        const coupleId = await CloudEngine.createCouple(myPublicKeyB64);

        await StorageRouter.setActiveCoupleId(coupleId);
        if (user?.uid) {
          await StorageRouter.updateUserDocument(user.uid, { coupleId });
          await updateProfile?.({ coupleId });
        }
        await storage.set(STORAGE_KEYS.COUPLE_ID, coupleId);

        // Step 3: Build QR payload with PUBLIC key only
        const payload = makePairingPayload({ coupleId, publicKey: myPublicKeyB64 });

        if (!activeRef.current) return;
        setQrPayload(JSON.stringify(payload));
        setStatus('Let your partner scan this QR code.');
        setPhase('showing_qr');

        // Step 4: Wait for partner to upload their public key
        setStatus('Waiting for partner to scan...');
        setPhase('waiting');

        const partnerPubKeyB64 = await CloudEngine.waitForPartnerPublicKey(coupleId, 180_000, 3_000);
        if (!activeRef.current) return;

        if (!partnerPubKeyB64) {
          setStatus("Partner didn't scan in time. Try again.");
          setPhase('error');
          return;
        }

        // Step 5: Derive couple key via X25519 ECDH + HKDF
        const partnerPubKey = naclUtil.decodeBase64(partnerPubKeyB64);
        const coupleKey = await CoupleKeyService.deriveFromKeyExchange(partnerPubKey);

        // Step 6: Store the couple key
        await CoupleKeyService.storeCoupleKey(coupleId, coupleKey);

        if (!activeRef.current) return;
        setStatus('Paired successfully!');
        setPhase('done');
        setTimeout(() => {
          if (activeRef.current) navigation.navigate('SyncSetup');
        }, 800);
      } catch (error) {
        if (!activeRef.current) return;
        if (String(error?.message || '').includes('Supabase is not configured')) {
          setStatus("Sync isn't available in this build.");
        } else {
          setStatus('Unable to generate QR code.');
        }
        setPhase('error');
      }
    };

    prepare();

    return () => {
      activeRef.current = false;
    };
  }, [isPremium]);

  const handleGoToSync = () => navigation.navigate('SyncSetup');

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <LinearGradient colors={theme.gradients.secondary || theme.gradients.background || [theme.colors.background, theme.colors.background]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.card}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Link Partner</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{status}</Text>

          {qrPayload && (
            <View style={styles.qrWrap}>
              <QRCode value={qrPayload} size={220} backgroundColor="transparent" color={theme.colors.text} />
            </View>
          )}

          {phase === 'waiting' && (
            <ActivityIndicator style={{ marginTop: SPACING.lg }} color={theme.colors.primary} />
          )}

          {phase === 'error' && (
            <TouchableOpacity style={styles.primaryButton} onPress={handleGoToSync} activeOpacity={0.9}>
              <Text style={styles.primaryButtonText}>Open Sync Settings</Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.notice, { color: theme.colors.textSecondary }]}>
            QR-only pairing. Your encryption keys never leave this device.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: SPACING.xl, justifyContent: 'center' },
  card: {
    backgroundColor: '#151118',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  title: { ...TYPOGRAPHY.h2, fontSize: 20, fontWeight: '700' },
  subtitle: { ...TYPOGRAPHY.body, marginTop: SPACING.sm, textAlign: 'center' },
  qrWrap: { marginTop: SPACING.lg, padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg },
  primaryButton: {
    marginTop: SPACING.lg,
    backgroundColor: '#A89060',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  primaryButtonText: { color: '#0B0B0B', fontWeight: '700' },
  notice: { ...TYPOGRAPHY.body, marginTop: SPACING.md },
});
