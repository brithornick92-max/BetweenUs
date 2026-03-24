import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../components/Icon';
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import naclUtil from 'tweetnacl-util';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import CloudEngine from '../services/storage/CloudEngine';
import StorageRouter from '../services/storage/StorageRouter';
import CoupleKeyService from '../services/security/CoupleKeyService';
import CoupleService from '../services/supabase/CoupleService';
import SupabaseAuthService from '../services/supabase/SupabaseAuthService';
import { STORAGE_KEYS, storage, cloudSyncStorage } from '../utils/storage';
import { TYPOGRAPHY, SPACING, BORDER_RADIUS, SYSTEM_FONT } from '../utils/theme';

/**
 * JoinWithCodeScreen — lets the receiving partner enter an invite code
 * to join their partner's couple and derive the shared
 * encryption key via X25519 key exchange.
 */
export default function JoinWithCodeScreen({ navigation }) {
  const { colors } = useTheme();
  const { user, updateProfile } = useAuth();

  const [code, setCode] = useState('');
  const [showCloudAuth, setShowCloudAuth] = useState(false);
  const [cloudAuthPw, setCloudAuthPw] = useState('');
  const [cloudAuthBusy, setCloudAuthBusy] = useState(false);
  const [phase, setPhase] = useState('input'); // input | joining | done | error
  const [statusMsg, setStatusMsg] = useState('');
  const inputRef = useRef(null);
  const cloudAuthResolve = useRef(null);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const ensureCloudSession = async () => {
    const session = await SupabaseAuthService.getSession().catch((error) => {
      if (String(error?.message || '').includes('Supabase is not configured')) {
        setStatusMsg("Sync isn't available in this build.");
        return null;
      }
      return null;
    });

    if (session) {
      await StorageRouter.setSupabaseSession(session);
      return session;
    }

    const email = user?.email;
    if (!email) {
      setStatusMsg('Account sign-in required. Open Cloud Sync to finish setup.');
      return null;
    }

    return new Promise((resolve) => {
      cloudAuthResolve.current = resolve;
      setCloudAuthPw('');
      setShowCloudAuth(true);
    });
  };

  const handleCloudAuthDone = async () => {
    const email = user?.email;
    const password = cloudAuthPw;

    if (!email) {
      setShowCloudAuth(false);
      cloudAuthResolve.current?.(null);
      cloudAuthResolve.current = null;
      navigation.navigate('SyncSetup');
      return;
    }

    if (!password || password.length < 6) {
      Alert.alert('Invalid password', 'Password must be at least 6 characters.');
      return;
    }

    setCloudAuthBusy(true);
    try {
      let session = null;

      try {
        session = await SupabaseAuthService.signInWithPassword(email, password);
      } catch (_) {
        session = null;
      }

      if (!session) {
        session = await SupabaseAuthService.signUp(email, password);
        if (!session) {
          try {
            session = await SupabaseAuthService.signInWithPassword(email, password);
          } catch (_) {
            session = null;
          }
        }
      }

      if (session) {
        await StorageRouter.setSupabaseSession(session);
        const syncStatus = await cloudSyncStorage.getSyncStatus();
        await cloudSyncStorage.setSyncStatus({
          ...syncStatus,
          email: session.user?.email || email,
        });
      }

      setShowCloudAuth(false);
      cloudAuthResolve.current?.(session);
      cloudAuthResolve.current = null;
    } catch (error) {
      Alert.alert('Sign-in failed', error?.message || 'Please try again.');
    } finally {
      setCloudAuthBusy(false);
    }
  };

  const handleCloudAuthCancel = () => {
    setShowCloudAuth(false);
    cloudAuthResolve.current?.(null);
    cloudAuthResolve.current = null;
  };

  const handleJoin = async () => {
    Keyboard.dismiss();
    const trimmed = code.trim();
    if (!trimmed) {
      Alert.alert('Enter a code', 'Paste or type the invite code your partner shared.');
      return;
    }

    setPhase('joining');
    setStatusMsg('Connecting...');

    try {
      const session = await ensureCloudSession();

      if (!session) {
        setPhase('error');
        return;
      }

      await CloudEngine.initialize({ supabaseSessionPresent: true });
      await StorageRouter.setSupabaseSession(session);

      // Generate our device keypair
      const myPublicKeyB64 = await CoupleKeyService.getDevicePublicKeyB64();

      // Redeem the invite code via CoupleService (hashes code → calls redeem_partner_code RPC)
      const { coupleId, partnerId } = await CoupleService.redeemInviteCode(trimmed);

      // Upload our public key to the couple membership
      await CloudEngine.joinCouple(coupleId, myPublicKeyB64).catch(() => {
        // May fail if redeem_partner_code already inserted our membership — that's fine
      });

      // Store couple ID locally
      await StorageRouter.setActiveCoupleId(coupleId);
      if (user?.uid) {
        await StorageRouter.updateUserDocument(user.uid, { coupleId });
        await updateProfile?.({ coupleId });
      }
      await storage.set(STORAGE_KEYS.COUPLE_ID, coupleId);

      // Try to get the inviter's public key for key exchange
      const inviterPubKeyB64 = await CloudEngine.getPartnerPublicKey(coupleId);
      if (inviterPubKeyB64) {
        const inviterPubKey = naclUtil.decodeBase64(inviterPubKeyB64);
        const coupleKey = await CoupleKeyService.deriveFromKeyExchange(inviterPubKey);
        await CoupleKeyService.storeCoupleKey(coupleId, coupleKey);
      }

      notification(NotificationFeedbackType.Success);
      setPhase('done');
      setStatusMsg('Linked successfully!');

      Alert.alert(
        'You\'re linked! 💕',
        'You and your partner are now connected on Between Us.',
        [{ text: 'Let\'s go!', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      notification(NotificationFeedbackType.Error);
      const msg = String(error?.message || '');
      if (msg.includes('Supabase is not configured')) {
        setStatusMsg("Sync isn't available in this build.");
      } else if (msg.includes('duplicate key') || msg.includes('already exists')) {
        setStatusMsg("You're already linked to this partner.");
        setPhase('done');
        setTimeout(() => navigation.goBack(), 1200);
        return;
      } else {
        setStatusMsg(msg || 'Unable to join. Check the code and try again.');
      }
      setPhase('error');
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        pointerEvents="none"
        colors={[colors.background, colors.background]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Icon name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Join Partner</Text>
          <View style={styles.headerSpacer} />
        </View>

        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.card}>
            {/* Icon */}
            <View style={styles.iconWrap}>
              <Icon
                name={phase === 'done' ? 'heart-outline' : 'infinite-outline'}
                size={36}
                color={phase === 'done' ? colors.primary : colors.textMuted}
              />
            </View>

            <Text style={styles.title}>
              {phase === 'done' ? 'You\'re linked!' : 'Enter Invite Code'}
            </Text>
            <Text style={styles.subtitle}>
              {phase === 'done'
                ? 'Your private space is ready.'
                : 'Paste the code your partner shared with you.'}
            </Text>

            {phase !== 'done' && (
              <TextInput
                ref={inputRef}
                style={styles.codeInput}
                placeholder="Paste invite code here"
                placeholderTextColor={colors.textMuted}
                value={code}
                onChangeText={setCode}
                autoCapitalize="none"
                autoCorrect={false}
                editable={phase === 'input' || phase === 'error'}
                returnKeyType="go"
                onSubmitEditing={handleJoin}
                accessibilityLabel="Invite code"
                accessibilityHint="Enter the invite code from your partner"
              />
            )}

            {statusMsg ? (
              <View style={styles.statusRow}>
                <Icon
                  name={
                    phase === 'done'
                      ? 'check-circle'
                      : phase === 'error'
                      ? 'alert-circle'
                      : 'loading'
                  }
                  size={18}
                  color={
                    phase === 'done'
                      ? colors.primary
                      : phase === 'error'
                      ? '#C8605A'
                      : colors.textMuted
                  }
                />
                <Text
                  style={[
                    styles.statusText,
                    phase === 'error' && { color: '#C8605A' },
                    phase === 'done' && { color: colors.primary },
                  ]}
                >
                  {statusMsg}
                </Text>
              </View>
            ) : null}

            {(phase === 'input' || phase === 'error') && (
              <TouchableOpacity
                style={[styles.joinButton, !code.trim() && styles.joinButtonDisabled]}
                onPress={handleJoin}
                disabled={!code.trim()}
                activeOpacity={0.9}
              >
                <Text style={styles.joinButtonText}>Link Up</Text>
              </TouchableOpacity>
            )}

            {phase === 'joining' && (
              <ActivityIndicator
                style={{ marginTop: SPACING.lg }}
                color={colors.primary}
                size="large"
              />
            )}
          </View>

          <Text style={styles.note}>
            Your encryption keys never leave this device.
          </Text>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal visible={showCloudAuth} transparent animationType="fade" onRequestClose={handleCloudAuthCancel}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalBadge}>
              <Icon name="shield-checkmark-outline" size={22} color={colors.primary} />
            </View>
            <Text style={styles.modalTitle}>Secure Cloud Sign-In</Text>
            <Text style={styles.modalBody}>Enter the password for {user?.email || 'your account'} to join with this invite code.</Text>
            <TextInput
              style={styles.modalInput}
              value={cloudAuthPw}
              onChangeText={setCloudAuthPw}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!cloudAuthBusy}
              returnKeyType="done"
              onSubmitEditing={handleCloudAuthDone}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={handleCloudAuthCancel}
                disabled={cloudAuthBusy}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary, cloudAuthBusy && styles.joinButtonDisabled]}
                onPress={handleCloudAuthDone}
                disabled={cloudAuthBusy}
              >
                {cloudAuthBusy ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>Continue</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    safeArea: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontFamily: SYSTEM_FONT,
      fontSize: 36,
      fontWeight: '900',
      letterSpacing: -1,
      lineHeight: 42,
      flex: 1,
      textAlign: 'center',
      color: colors.text,
    },
    headerSpacer: { width: 40 },
    body: {
      flex: 1,
      paddingHorizontal: SPACING.xl,
      justifyContent: 'center',
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.xl,
      padding: SPACING.xl,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.lg,
    },
    title: {
      ...TYPOGRAPHY.h2,
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: SPACING.sm,
    },
    subtitle: {
      ...TYPOGRAPHY.body,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: SPACING.lg,
      lineHeight: 22,
    },
    codeInput: {
      width: '100%',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      color: colors.text,
      fontSize: 16,
      textAlign: 'center',
      fontWeight: '500',
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: SPACING.md,
      gap: 8,
    },
    statusText: {
      ...TYPOGRAPHY.body,
      color: colors.textMuted,
      fontSize: 14,
    },
    joinButton: {
      marginTop: SPACING.lg,
      backgroundColor: colors.primary,
      paddingVertical: 16,
      paddingHorizontal: 40,
      borderRadius: 40,
      alignItems: 'center',
      width: '100%',
    },
    joinButtonDisabled: {
      opacity: 0.4,
    },
    joinButtonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    note: {
      ...TYPOGRAPHY.body,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: SPACING.lg,
      fontSize: 13,
      opacity: 0.6,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      padding: SPACING.xl,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.xl,
      alignItems: 'center',
    },
    modalBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.md,
    },
    modalTitle: {
      ...TYPOGRAPHY.h2,
      color: colors.text,
      fontSize: 20,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: SPACING.sm,
    },
    modalBody: {
      ...TYPOGRAPHY.body,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: SPACING.lg,
      lineHeight: 22,
    },
    modalInput: {
      width: '100%',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      color: colors.text,
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
      borderRadius: 40,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalButtonPrimary: {
      backgroundColor: colors.primary,
    },
    modalButtonSecondary: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalButtonPrimaryText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    modalButtonSecondaryText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
  });
