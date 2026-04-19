/**
 * PairingQRCodeScreen — Secure Partner Bridge
 * Sexy Red Intimacy & Apple Editorial Updates Integrated.
 * * Inviter flow utilizing X25519 key exchange.
 */

import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  Modal,
  Platform, 
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import naclUtil from 'tweetnacl-util';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { clearCouplePremiumCache } from '../context/EntitlementsContext';
import SupabaseAuthService from '../services/supabase/SupabaseAuthService';
import StorageRouter from '../services/storage/StorageRouter';
import CloudEngine from '../services/storage/CloudEngine';
import CoupleKeyService from '../services/security/CoupleKeyService';
import { makePairingPayload } from '../services/security/PairingPayload';
import CoupleService from '../services/supabase/CoupleService';
import { STORAGE_KEYS, storage } from '../utils/storage';
import { SPACING, withAlpha } from '../utils/theme';
import Icon from '../components/Icon';

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

export default function PairingQRCodeScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { user, updateProfile } = useAuth();

  const [qrPayload, setQrPayload] = useState(null);
  const [status, setStatus] = useState('Preparing secure link...');
  const [phase, setPhase] = useState('init');
  const [repairingExistingCouple, setRepairingExistingCouple] = useState(false);
  const [showPairedGuard, setShowPairedGuard] = useState(false);
  const [unlinkError, setUnlinkError] = useState(false);
  const [successModal, setSuccessModal] = useState(null); // null | { isRepair: bool }
  const activeRef = useRef(true);
  const preparingRef = useRef(false);
  const pairedGuardResolveRef = useRef(null);

  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    background: colors.background || '#070509', 
    surface: isDark ? '#131016' : '#FFFFFF',
    surfaceSecondary: isDark ? '#1C1520' : '#F2F2F7',
    primary: colors.primary || '#D2121A', // Sexy Red
    text: colors.text || '#F2E9E6',
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const ensureCloudSession = useCallback(async () => {
    // 1. Use existing session if available
    const existing = await SupabaseAuthService.getSession().catch((error) => {
      if (String(error?.message || '').includes('Supabase is not configured')) {
        setStatus("Sync isn't available in this build.");
        setPhase('error');
        return null;
      }
      throw error;
    });

    if (existing) {
      await StorageRouter.setSupabaseSession(existing);
      return existing;
    }

    // 2. Fall back to anonymous sign-in
    setStatus('Creating secure session...');
    const session = await SupabaseAuthService.signInAnonymously();
    if (session) {
      await StorageRouter.setSupabaseSession(session);
    }
    return session;
  }, []);

  const prepare = useCallback(async () => {
    if (preparingRef.current) return;
    preparingRef.current = true;
    try {
      if (!activeRef.current) return;

      // Guard: warn if already paired (non-repair) to prevent accidental re-pair
      const existingCouple = await storage.get(STORAGE_KEYS.COUPLE_ID, null);
      if (existingCouple) {
        const proceed = await new Promise((resolve) => {
          pairedGuardResolveRef.current = resolve;
          setShowPairedGuard(true);
        });
        if (!proceed || !activeRef.current) {
          preparingRef.current = false;
          if (navigation.canGoBack()) navigation.goBack();
          else navigation.navigate('Settings');
          return;
        }
      }

      setQrPayload(null);
      setStatus('Preparing secure link...');
      setPhase('init');

      const session = await ensureCloudSession();
      if (!session || !activeRef.current) {
        return;
      }

      await CloudEngine.initialize({ supabaseSessionPresent: true });

      const myPublicKeyB64 = await CoupleKeyService.getDevicePublicKeyB64();
      const storedCoupleId = await storage.get(STORAGE_KEYS.COUPLE_ID, null);
      let coupleId = storedCoupleId || null;
      let isRepairFlow = false;

      if (!coupleId) {
        const membership = await CoupleService.getMyCouple().catch(() => null);
        coupleId = membership?.couple_id || null;
      }

      if (coupleId) {
        isRepairFlow = true;
        setRepairingExistingCouple(true);
        await CloudEngine.joinCouple(coupleId, myPublicKeyB64);
        await StorageRouter.setActiveCoupleId(coupleId);
        await storage.set(STORAGE_KEYS.COUPLE_ID, coupleId);
        setStatus('Preparing repair code...');
      } else {
        setRepairingExistingCouple(false);
        coupleId = await CloudEngine.createCouple(myPublicKeyB64);

        await StorageRouter.setActiveCoupleId(coupleId);
        if (user?.uid) {
          await StorageRouter.updateUserDocument(user.uid, { coupleId });
          await updateProfile?.({ coupleId });
        }
        await storage.set(STORAGE_KEYS.COUPLE_ID, coupleId);
      }

      const { code: pairingCode } = await CoupleService.generatePairingCode(coupleId);
      const payload = makePairingPayload({ pairingCode, publicKey: myPublicKeyB64 });

      if (!activeRef.current) return;
      setQrPayload(JSON.stringify(payload));
  setStatus(isRepairFlow ? 'Repair code ready' : 'Ready to scan');
      setPhase('waiting');

      const partnerPubKeyB64 = await CloudEngine.waitForPartnerPublicKey(coupleId, 600_000, 3_000);
      if (!activeRef.current) return;

      if (!partnerPubKeyB64) {
        setStatus('Link timed out. Please try again.');
        setPhase('error');
        return;
      }

      const partnerPubKey = naclUtil.decodeBase64(partnerPubKeyB64);
      const coupleKey = await CoupleKeyService.deriveFromKeyExchange(partnerPubKey);
      await CoupleKeyService.storeCoupleKey(coupleId, coupleKey);

      if (!activeRef.current) return;
      setStatus(isRepairFlow ? 'Secure pairing repaired.' : 'Connected successfully!');
      setPhase('done');
      setTimeout(() => {
        if (!activeRef.current) return;
        setSuccessModal({ isRepair: isRepairFlow });
      }, 50);
    } catch (error) {
      if (!activeRef.current) return;
      setStatus(error?.message || 'Connection failed. Please try again.');
      setPhase('error');
    } finally {
      preparingRef.current = false;
    }
  }, [ensureCloudSession, navigation, updateProfile, user?.uid]);

  useEffect(() => {
    activeRef.current = true;
    prepare();
    return () => { activeRef.current = false; };
  }, [prepare]);

  const handlePrimaryAction = () => {
    if (phase === 'error') {
      prepare();
      return;
    }
    navigation.navigate('SyncSetup');
  };

  const handleUnlink = async () => {
    if (repairingExistingCouple) {
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate('Settings');
      return;
    }

    // Show in-app modal instead of native Alert
    const proceed = await new Promise((resolve) => {
      pairedGuardResolveRef.current = resolve;
      setUnlinkError(false);
      setShowPairedGuard('unlink');
    });
    if (!proceed) return;

    try {
      await CoupleService.unlinkFromCouple();
      const coupleId = await storage.get(STORAGE_KEYS.COUPLE_ID, null);
      if (coupleId) {
        await CoupleKeyService.clearCoupleKey(coupleId);
        await storage.remove(STORAGE_KEYS.COUPLE_ID);
        await updateProfile?.({ coupleId: null });
      }
      await storage.remove(STORAGE_KEYS.COUPLE_ROLE);
      await storage.remove(STORAGE_KEYS.PARTNER_PROFILE);
      await clearCouplePremiumCache();
    } catch (e) {
      setUnlinkError(true);
      setShowPairedGuard('unlink-error');
      return;
    }
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Settings');
  };

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <LinearGradient 
        colors={isDark ? ['#120206', t.background, t.background] : [t.surfaceSecondary, t.background, t.background]} 
        style={StyleSheet.absoluteFill} 
      />

      {/* ─── SUCCESS MODAL ─── */}
      <Modal visible={!!successModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: t.surface }]}>
            <View style={[styles.modalIconWrap, { backgroundColor: withAlpha(t.primary, 0.12) }]}>
              <Icon name="checkmark-circle-outline" size={28} color={t.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: t.text }]}>
              {successModal?.isRepair ? 'Secure Pairing Restored' : 'Pairing Complete'}
            </Text>
            <Text style={[styles.modalBody, { color: t.subtext }]}>
              {successModal?.isRepair
                ? 'This device has restored the shared encryption key. Your partner should see the same success confirmation now.'
                : 'Your private space is now linked on both devices.'}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: t.primary }]}
                onPress={() => {
                  setSuccessModal(null);
                  if (navigation.canGoBack()) navigation.goBack();
                  else navigation.navigate('Settings');
                }}
              >
                <Text style={{ color: '#FFF', fontFamily: SYSTEM_FONT, fontWeight: '700' }}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── ALREADY-PAIRED / UNLINK GUARD MODAL ─── */}}
      <Modal visible={!!showPairedGuard} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: t.surface }]}>
            <View style={[styles.modalIconWrap, { backgroundColor: withAlpha(t.primary, 0.12) }]}>
              <Icon name={showPairedGuard === 'unlink-error' ? 'alert-circle-outline' : 'warning-outline'} size={28} color={t.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: t.text }]}>
              {showPairedGuard === 'unlink' ? 'Unpair from partner?' : showPairedGuard === 'unlink-error' ? 'Unpair failed' : 'Already paired'}
            </Text>
            <Text style={[styles.modalBody, { color: t.subtext }]}>
              {showPairedGuard === 'unlink'
                ? 'This will disconnect both of you. Shared data will no longer be accessible.'
                : showPairedGuard === 'unlink-error'
                ? 'Could not unpair at this time. Please check your connection and try again.'
                : 'You\u2019re currently connected to a partner. Generating a new code will replace your existing pairing for both of you.'}
            </Text>
            {showPairedGuard === 'unlink-error' ? (
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: t.surfaceSecondary }]}
                  onPress={() => setShowPairedGuard(false)}
                >
                  <Text style={{ color: t.text, fontFamily: SYSTEM_FONT, fontWeight: '600' }}>OK</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: t.surfaceSecondary }]}
                  onPress={() => { setShowPairedGuard(false); pairedGuardResolveRef.current?.(false); }}
                >
                  <Text style={{ color: t.text, fontFamily: SYSTEM_FONT, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnDestructive]}
                  onPress={() => { setShowPairedGuard(false); pairedGuardResolveRef.current?.(true); }}
                >
                  <Text style={{ color: '#FFF', fontFamily: SYSTEM_FONT, fontWeight: '700' }}>
                    {showPairedGuard === 'unlink' ? 'Unpair' : 'Continue'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <SafeAreaView style={styles.safeArea}>
        {/* Navigation */}
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Icon name="chevron-back" size={28} color={t.text} />
        </TouchableOpacity>

        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: withAlpha(t.primary, 0.12) }]}>
            <Icon 
              name={phase === 'done' ? "checkmark-circle-outline" : "qr-code-outline"} 
              size={32} 
              color={t.primary} 
            />
          </View>

          <Text style={[styles.title, { color: t.text }]}>Pairing Invitation</Text>
          <Text style={[styles.subtitle, { color: t.subtext }]}>
            {phase === 'waiting'
              ? (repairingExistingCouple
                  ? "Show this repair code to your partner's device so they can restore secure pairing."
                  : "Show this code to your partner's device.")
              : status}
          </Text>

          <View style={[styles.qrContainer, { backgroundColor: '#FFFFFF', borderColor: t.primary }]}>
            {qrPayload ? (
              <QRCode 
                value={qrPayload} 
                size={220} 
                backgroundColor="#FFFFFF" 
                color="#000000" 
              />
            ) : (
              <ActivityIndicator size="large" color={t.primary} />
            )}
          </View>

          {phase === 'waiting' && (
            <View style={styles.waitingRow}>
              <ActivityIndicator color={t.primary} size="small" />
              <Text style={[styles.waitingLabel, { color: t.primary }]}>WAITING FOR SCAN...</Text>
            </View>
          )}

          {phase === 'waiting' && (
            <TouchableOpacity style={styles.unlinkBtn} onPress={handleUnlink}>
              <Icon name="close-circle-outline" size={14} color={t.subtext} />
              <Text style={[styles.unlinkBtnText, { color: t.subtext }]}>
                {repairingExistingCouple ? 'Close' : 'Cancel & Go Back'}
              </Text>
            </TouchableOpacity>
          )}

          {phase === 'error' && (
            <TouchableOpacity 
              style={[styles.primaryButton, { backgroundColor: t.primary }]} 
              onPress={handlePrimaryAction}
            >
              <Text style={styles.primaryButtonText}>{status.includes('Sync') ? 'Sync Settings' : 'Try Again'}</Text>
              <Icon name={status.includes('Sync') ? 'settings-outline' : 'refresh-outline'} size={18} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {phase === 'error' && (
            <TouchableOpacity style={styles.unlinkBtn} onPress={handleUnlink}>
              <Icon name="unlink-outline" size={14} color={t.subtext} />
              <Text style={[styles.unlinkBtnText, { color: t.subtext }]}>
                {repairingExistingCouple ? 'Close' : 'Unlink & Go Back'}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.securityNotice}>
            <Icon name="shield-checkmark-outline" size={14} color={t.subtext} />
            <Text style={[styles.noticeText, { color: t.subtext }]}>
              Encrypted pairing. Keys are created on-device.
            </Text>
          </View>
        </View>

        <Text style={[styles.footerStatus, { color: t.subtext }]}>
          Phase: {phase.toUpperCase()}
        </Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: 32, justifyContent: 'center' },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 24,
    zIndex: 10,
  },
  card: {
    borderRadius: 32, // High-end Squircle
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
      android: { elevation: 10 },
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
    paddingHorizontal: 10,
  },
  qrContainer: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  scanningOverlay: {
    display: 'none', // no longer used
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  waitingLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  primaryButton: {
    marginTop: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 28,
    paddingHorizontal: 24,
    gap: 10,
    minWidth: 200,
  },
  primaryButtonText: { 
    color: '#FFFFFF', 
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: -0.2,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
  },
  unlinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    padding: 8,
  },
  unlinkBtnText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '600',
  },
  noticeText: { 
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '600',
  },
  footerStatus: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    opacity: 0.6,
  },
  // ─── Guard modal ───
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  modalCard: {
    borderRadius: 28,
    padding: SPACING.xxl,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.35, shadowRadius: 40 },
      android: { elevation: 12 },
    }),
  },
  modalIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 10,
    textAlign: 'center',
  },
  modalBody: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnDestructive: {
    backgroundColor: '#D2121A',
  },
});
