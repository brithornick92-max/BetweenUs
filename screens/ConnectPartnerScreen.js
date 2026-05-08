import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  Alert,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import Icon from '../components/Icon';
import CloseScreenHeader, { CLOSE_HEADER_STYLES } from '../components/CloseScreenHeader';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { notification, NotificationFeedbackType, impact, ImpactFeedbackStyle } from '../utils/haptics';
import CoupleService from '../services/supabase/CoupleService';
import StorageRouter from '../services/storage/StorageRouter';
import { joinWithInviteCode } from '../services/linking/CoupleLinkingService';
import { STORAGE_KEYS, storage } from '../utils/storage';
import { SPACING, SYSTEM_FONT, withAlpha } from '../utils/theme';
import { SupabaseAuthService } from '../services/supabase/SupabaseAuthService';


function formatInviteCodeForEntry(value) {
  const cleaned = String(value || '').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 8);
  if (cleaned.length > 4) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  }
  return cleaned;
}

export default function ConnectPartnerScreen({ navigation, route }) {
  const { colors, isDark } = useTheme();
  const { user, updateProfile } = useAuth();
  const { actions } = useAppContext();

  const [myCode, setMyCode] = useState(null);
  const [partnerCode, setPartnerCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(true);
  const [joinStatus, setJoinStatus] = useState('');
  const [joinPhase, setJoinPhase] = useState('idle');

  const activeRef = useRef(true);
  const appliedRouteCodeRef = useRef(null);

  useEffect(() => {
    const routeCode = formatInviteCodeForEntry(route?.params?.code);
    if (!routeCode || appliedRouteCodeRef.current === routeCode) return;

    appliedRouteCodeRef.current = routeCode;
    setPartnerCode(routeCode);
    setJoinPhase('idle');
    setJoinStatus('Invite code ready.');
  }, [route?.params?.code]);

  const t = {
    background: colors.background || '#070509',
    surface: isDark ? '#131016' : '#FFFFFF',
    surfaceSecondary: isDark ? '#1C1520' : '#F2F2F7',
    primary: colors.primary || '#D2121A',
    text: colors.text || '#F2E9E6',
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  };

  const ensureInviteSession = useCallback(async () => {
    const session = await SupabaseAuthService.getSession().catch((error) => {
      if (String(error?.message || '').includes('Supabase is not configured')) {
        Alert.alert('Sync unavailable', "Invite codes aren't available in this build.");
        return null;
      }
      throw error;
    });

    if (session) {
      await StorageRouter.setSupabaseSession(session);
      return session;
    }

    Alert.alert(
      'Sign in required',
      'Please sign in before creating or accepting an invite.',
      [{ text: 'OK', style: 'cancel' }]
    );
    return null;
  }, []);

  const generateCode = useCallback(async () => {
    if (!activeRef.current) return;
    setCodeLoading(true);
    setMyCode(null);
    try {
      const session = await ensureInviteSession();
      if (!session) return;

      const result = await CoupleService.generateInviteCode();
      if (activeRef.current) {
        setMyCode(result.code);
      }
    } catch (err) {
      const message = String(err?.message || '');
      if (activeRef.current && (message === 'You are already in a couple' || message.includes('Leave your current couple'))) {
        setJoinStatus('You are already connected. Disconnect before creating a new invite.');
      } else if (activeRef.current) {
        setJoinStatus("We couldn't create an invite. Please try again.");
      }
      if (message !== 'You are already in a couple' && __DEV__) {
        if (__DEV__) console.warn('Code gen failed:', message);
      }
    } finally {
      if (activeRef.current) setCodeLoading(false);
    }
  }, [ensureInviteSession]);

  useEffect(() => {
    activeRef.current = true;
    generateCode();
    return () => {
      activeRef.current = false;
    };
  }, [generateCode]);

  // Poll for partner joining after code is shown
  useEffect(() => {
    if (!myCode) return;
    let localActive = true;
    let timer = null;

    const doPoll = async () => {
      try {
        const couple = await CoupleService.getMyCouple();
        if (couple?.couple_id && localActive) {
          const coupleId = couple.couple_id;
          await storage.set(STORAGE_KEYS.COUPLE_ID, coupleId);
          await StorageRouter.setActiveCoupleId(coupleId);
          await updateProfile?.({ coupleId });
          await actions.joinCouple(coupleId);

          if (localActive) {
            notification(NotificationFeedbackType.Success);
            setJoinPhase('done');
            Alert.alert('You\'re linked!', 'You and your partner are now connected.', [
              { text: 'Start', onPress: () => navigation.goBack() }
            ]);
          }
          return;
        }
      } catch {
        // silently fail polling
      }
      if (localActive) timer = setTimeout(doPoll, 3000);
    };

    doPoll();
    return () => {
      localActive = false;
      if (timer) clearTimeout(timer);
    };
  }, [actions, myCode, navigation, updateProfile]);

  const handleCopyCode = async () => {
    if (!myCode) return;
    await Clipboard.setStringAsync(myCode);
    impact(ImpactFeedbackStyle.Light);
    setJoinStatus('Code copied!');
    setTimeout(() => {
      if (activeRef.current && joinStatus === 'Code copied!') setJoinStatus('');
    }, 2000);
  };

  const handleJoin = async () => {
    if (joinPhase === 'joining') return;
    Keyboard.dismiss();
    const trimmed = partnerCode.replace(/-/g, '').trim().toUpperCase();
    if (!trimmed) {
      Alert.alert('Enter a code', 'Paste or type the code your partner shared.');
      return;
    }

    setJoinPhase('joining');
    setJoinStatus('Connecting...');

    try {
      const result = await joinWithInviteCode({
        code: trimmed,
        userId: user?.id ?? user?.uid,
        updateProfile,
        onStatus: setJoinStatus,
      });

      if (!result) {
        setJoinPhase('error');
        return;
      }

      notification(NotificationFeedbackType.Success);
      setJoinPhase('done');
      setJoinStatus('Linked successfully!');
      await actions.joinCouple(result.coupleId);

      Alert.alert(
        'You\'re linked!',
        'You and your partner are now connected on Between Us.',
        [{ text: 'Let\'s go!', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      notification(NotificationFeedbackType.Error);
      setJoinPhase('error');
      setJoinStatus(error?.message || 'Unable to join. Check the code and try again.');
    }
  };

  const formatCode = (raw) => {
    if (!raw) return '';
    if (raw.length === 8 && !raw.includes('-')) {
      return raw.slice(0, 4) + '-' + raw.slice(4);
    }
    return raw;
  };

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <LinearGradient
        colors={isDark ? ['#120206', t.background, t.background] : [t.surfaceSecondary, t.background, t.background]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <CloseScreenHeader
          title="Connect Partner"
          subtitle="PARTNER LINKING"
          titleColor={t.text}
          subtitleColor={t.primary}
          closeColor={t.text}
          onClose={() => navigation.goBack()}
        />

        <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: withAlpha(t.primary, 0.12) }]}>
              <Icon name={joinPhase === 'done' ? "heart-outline" : "link-outline"} size={36} color={t.primary} />
            </View>

            <Text style={[styles.title, { color: t.text }]}>Connect with Partner</Text>

            <View style={[styles.codeSection, { backgroundColor: t.surfaceSecondary }]}>
              <Text style={[styles.codeLabel, { color: t.subtext }]}>YOUR INVITE CODE</Text>
              {codeLoading ? (
                <ActivityIndicator color={t.primary} size="small" style={{ marginVertical: 10 }} />
              ) : (
                <Text style={[styles.codeDisplay, { color: t.text }]}>{formatCode(myCode)}</Text>
              )}

              <View style={styles.codeActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: t.border }]}
                  onPress={handleCopyCode}
                  disabled={!myCode}
                  accessibilityRole="button"
                  accessibilityLabel="Copy invite code"
                  accessibilityState={{ disabled: !myCode }}
                >
                  <Icon name="copy-outline" size={16} color={t.text} />
                  <Text style={[styles.actionText, { color: t.text }]}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: t.border }]}
                  onPress={generateCode}
                  accessibilityRole="button"
                  accessibilityLabel="Generate new invite code"
                >
                  <Icon name="refresh-outline" size={16} color={t.text} />
                  <Text style={[styles.actionText, { color: t.text }]}>New</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.dividerRow}>
              <View style={[styles.divider, { backgroundColor: t.border }]} />
              <Text style={[styles.dividerText, { color: t.subtext }]}>OR ENTER THEIRS</Text>
              <View style={[styles.divider, { backgroundColor: t.border }]} />
            </View>

            <View style={styles.inputSection}>
              <TextInput
                style={[
                  styles.codeInput,
                  {
                    backgroundColor: t.background,
                    borderColor: joinPhase === 'error' ? '#C8605A' : (partnerCode ? t.primary : t.border),
                    color: t.text
                  }
                ]}
                placeholder="e.g. 7K4P-9M9X"
                placeholderTextColor={t.subtext}
                value={partnerCode}
                onChangeText={(val) => {
                  let cleansed = val.replace(/[^A-Z0-9]/gi, '').toUpperCase();
                  if (cleansed.length > 4) {
                    cleansed = cleansed.slice(0, 4) + '-' + cleansed.slice(4);
                  }
                  setPartnerCode(cleansed);
                  if (joinPhase === 'error') setJoinPhase('idle');
                }}
                maxLength={9}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={joinPhase === 'idle' || joinPhase === 'error'}
                returnKeyType="go"
                onSubmitEditing={handleJoin}
                accessibilityLabel="Partner invite code"
                accessibilityHint="Enter your partner's invite code to link accounts."
              />

              {(joinStatus !== '' || joinPhase === 'error') && (
                <Text style={[
                  styles.statusText,
                  { color: joinPhase === 'error' ? '#C8605A' : t.primary }
                ]}>
                  {joinStatus}
                </Text>
              )}

              <TouchableOpacity
                style={[
                  styles.joinButton,
                  { backgroundColor: t.primary },
                  (!partnerCode || joinPhase === 'joining') && { opacity: 0.5 }
                ]}
                onPress={handleJoin}
                disabled={!partnerCode || joinPhase === 'joining'}
                accessibilityRole="button"
                accessibilityLabel="Link with partner"
                accessibilityState={{ disabled: !partnerCode || joinPhase === 'joining', busy: joinPhase === 'joining' }}
              >
                {joinPhase === 'joining' ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.joinButtonText}>Link Up</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.footerStatus, { color: t.subtext }]}>
            Secured by Supabase Auth + HTTPS
          </Text>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: CLOSE_HEADER_STYLES.header,
  backButton: CLOSE_HEADER_STYLES.closeButton,
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 40 },
  card: {
    borderRadius: 32, padding: SPACING.xl, alignItems: 'center', borderWidth: 1, width: '100%',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.2, shadowRadius: 40 },
      android: { elevation: 10 },
    }),
  },
  iconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg },
  title: { fontFamily: SYSTEM_FONT, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginBottom: SPACING.xl },
  codeSection: { width: '100%', padding: SPACING.lg, borderRadius: 20, alignItems: 'center', marginBottom: SPACING.lg },
  codeLabel: { fontFamily: SYSTEM_FONT, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  codeDisplay: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 32, fontWeight: '800', letterSpacing: 4, marginBottom: 16 },
  codeActions: { flexDirection: 'row', gap: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, gap: 6 },
  actionText: { fontFamily: SYSTEM_FONT, fontSize: 13, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginVertical: SPACING.md },
  divider: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontFamily: SYSTEM_FONT, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginHorizontal: 12 },
  inputSection: { width: '100%', marginTop: SPACING.sm },
  codeInput: {
    width: '100%', borderWidth: 1, borderRadius: 16, paddingHorizontal: SPACING.lg, paddingVertical: 18,
    fontSize: 20, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', textAlign: 'center', fontWeight: '700', letterSpacing: 2, marginBottom: 8
  },
  statusText: { fontFamily: SYSTEM_FONT, fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  joinButton: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  joinButtonText: { color: '#FFFFFF', fontFamily: SYSTEM_FONT, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  footerStatus: { marginTop: 32, alignSelf: 'center', fontFamily: SYSTEM_FONT, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, opacity: 0.6 },
});
