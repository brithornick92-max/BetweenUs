/**
 * PairingQRCodeScreen — Secure Partner Bridge
 * Sexy Red Intimacy & Apple Editorial Updates Integrated.
 * * Inviter flow utilizing X25519 key exchange.
 */

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  Platform, 
  StatusBar 
} from 'react-native';
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
import { SPACING, withAlpha } from '../utils/theme';
import Icon from '../components/Icon';

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

export default function PairingQRCodeScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium } = useEntitlements();
  const { user, updateProfile } = useAuth();

  const [qrPayload, setQrPayload] = useState(null);
  const [status, setStatus] = useState('Preparing secure link...');
  const [phase, setPhase] = useState('init'); 
  const activeRef = useRef(true);

  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    background: colors.background || '#070509', 
    surface: isDark ? '#131016' : '#FFFFFF',
    surfaceSecondary: isDark ? '#1C1520' : '#F2F2F7',
    primary: colors.primary || '#C3113D', // Sexy Red
    text: colors.text || '#F2E9E6',
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

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

        const myPublicKeyB64 = await CoupleKeyService.getDevicePublicKeyB64();
        const coupleId = await CloudEngine.createCouple(myPublicKeyB64);

        await StorageRouter.setActiveCoupleId(coupleId);
        if (user?.uid) {
          await StorageRouter.updateUserDocument(user.uid, { coupleId });
          await updateProfile?.({ coupleId });
        }
        await storage.set(STORAGE_KEYS.COUPLE_ID, coupleId);

        const payload = makePairingPayload({ coupleId, publicKey: myPublicKeyB64 });

        if (!activeRef.current) return;
        setQrPayload(JSON.stringify(payload));
        setStatus('Ready to scan');
        setPhase('waiting');

        const partnerPubKeyB64 = await CloudEngine.waitForPartnerPublicKey(coupleId, 180_000, 3_000);
        if (!activeRef.current) return;

        if (!partnerPubKeyB64) {
          setStatus("Link timed out. Please try again.");
          setPhase('error');
          return;
        }

        const partnerPubKey = naclUtil.decodeBase64(partnerPubKeyB64);
        const coupleKey = await CoupleKeyService.deriveFromKeyExchange(partnerPubKey);
        await CoupleKeyService.storeCoupleKey(coupleId, coupleKey);

        if (!activeRef.current) return;
        setStatus('Connected successfully!');
        setPhase('done');
        setTimeout(() => {
          if (activeRef.current) navigation.navigate('SyncSetup');
        }, 1200);
      } catch (error) {
        if (!activeRef.current) return;
        setStatus('Connection failed.');
        setPhase('error');
      }
    };

    prepare();
    return () => { activeRef.current = false; };
  }, [isPremium]);

  const handleGoToSync = () => navigation.navigate('SyncSetup');

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar barStyle="light-content" />
      <LinearGradient 
        colors={['#120206', t.background, t.background]} 
        style={StyleSheet.absoluteFill} 
      />
      
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
            {phase === 'waiting' ? "Show this code to your partner's device." : status}
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
            
            {phase === 'waiting' && (
              <View style={styles.scanningOverlay}>
                <ActivityIndicator color={t.primary} />
                <Text style={[styles.waitingLabel, { color: t.primary }]}>WAITING...</Text>
              </View>
            )}
          </View>

          {phase === 'error' && (
            <TouchableOpacity 
              style={[styles.primaryButton, { backgroundColor: t.primary }]} 
              onPress={handleGoToSync}
            >
              <Text style={styles.primaryButtonText}>Sync Settings</Text>
              <Icon name="settings-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          <View style={styles.securityNotice}>
            <Icon name="shield-checkmark-outline" size={14} color={t.subtext} />
            <Text style={[styles.noticeText, { color: t.subtext }]}>
              E2EE pairing. Keys stay on-device.
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
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
  }
});
