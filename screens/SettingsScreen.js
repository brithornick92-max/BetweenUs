/**
 * BETWEEN US - SETTINGS ENGINE (EDITORIAL V3)
 * High-End Apple Editorial Layout + Sexy Red (#D2121A) Intimacy
 */

import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  Dimensions,
  Linking,
  Platform,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Animated as RNAnimated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import naclUtil from 'tweetnacl-util';
import ReAnimated, { 
  FadeInDown, 
  FadeInRight, 
  FadeIn, 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
} from 'react-native-reanimated';

// Context & Services
import { useAuth } from '../context/AuthContext';
import { useEntitlements, clearCouplePremiumCache } from '../context/EntitlementsContext';
import { useContent } from '../context/ContentContext';
import { useTheme } from '../context/ThemeContext';

// Utilities & Components
import { impact, notification, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { PremiumFeature } from '../utils/featureFlags';
import { SPACING, withAlpha } from '../utils/theme';
import { SUPPORT_EMAIL } from '../config/constants';
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';
import { cloudSyncStorage, STORAGE_KEYS, storage } from '../utils/storage';
import CrashReporting from '../services/CrashReporting';
import RevenueCatService from '../services/RevenueCatService';
import CoupleKeyService from '../services/security/CoupleKeyService';
import CoupleService from '../services/supabase/CoupleService';
import SupabaseAuthService from '../services/supabase/SupabaseAuthService';
import StorageRouter from '../services/storage/StorageRouter';
import CloudEngine from '../services/storage/CloudEngine';
import SeasonSelector from '../components/SeasonSelector';
import EnergyMatcher from '../components/EnergyMatcher';
import SoftBoundariesPanel from '../components/SoftBoundariesPanel';
import { getMyDisplayName, getPartnerDisplayName } from '../utils/profileNames';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });
const SERIF_FONT = Platform.select({ ios: "Georgia", android: "serif" }); // Elegant editorial fallback

// ════════════════════════════════════════════════════════
//  INTERNAL HIGH-END COMPONENTS (The "Editorial" Toolkit)
// ════════════════════════════════════════════════════════

const EditorialSection = ({ title, children, t, delay = 0 }) => (
  <ReAnimated.View 
    entering={FadeInDown.delay(delay).duration(700).springify().damping(15)}
    style={styles.sectionContainer}
  >
    {title && <Text style={[styles.sectionLabel, { color: t.primary }]}>{title.toUpperCase()}</Text>}
    <View style={[styles.sectionCard, { backgroundColor: t.surface, borderColor: t.borderGlass }]}>
      {children}
    </View>
  </ReAnimated.View>
);

const EditorialRow = ({ icon, title, subtitle, onPress, t, isLast, iconColor, rightElement }) => {
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  const handlePressIn = () => { scale.value = withSpring(0.96, { damping: 12 }); };
  const handlePressOut = () => { scale.value = withSpring(1, { damping: 12 }); };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityLabel={title}
      accessibilityRole="button"
      onPress={() => {
        impact(ImpactFeedbackStyle.Light);
        onPress?.();
      }}
    >
      <ReAnimated.View style={[styles.rowWrapper, animatedStyle]}>
        <View style={styles.rowMain}>
          <View style={[styles.iconContainer, { backgroundColor: withAlpha(iconColor || t.primary, 0.12) }]}>
            <Icon name={icon} size={22} color={iconColor || t.primary} />
          </View>
          <View style={styles.rowTextContent}>
            <Text style={[styles.rowTitle, { color: t.text }]}>{title}</Text>
            {subtitle && <Text style={[styles.rowSubtitle, { color: t.subtext }]}>{subtitle}</Text>}
          </View>
          {rightElement ? rightElement : (
            <Icon name="chevron-forward" size={20} color={t.border} />
          )}
        </View>
        {!isLast && <View style={[styles.rowDivider, { backgroundColor: t.borderGlass }]} />}
      </ReAnimated.View>
    </TouchableOpacity>
  );
};

// ════════════════════════════════════════════════════════
//  MAIN SCREEN COMPONENT
// ════════════════════════════════════════════════════════

export default function SettingsScreen({ navigation }) {
  // ─── HOOKS & CONTEXT ───
  const { user, userProfile, signOutLocal, updateProfile } = useAuth();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const { colors, themeMode, setThemeMode, isDark } = useTheme();
  const { getRelationshipDurationText, updateRelationshipStartDate, loadContentProfile } = useContent();
  const scrollY = useRef(new RNAnimated.Value(0)).current;

  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    background: colors.background,
    surface: isDark ? '#1C1C1E' : '#FFFFFF', // Apple pure surfaces
    surfaceSecondary: isDark ? '#2C2C2E' : '#F2F2F7',
    accent: colors.accent || '#D4AF37', // Premium Gold
    primary: colors.primary || '#D2121A', // SEXY RED
    text: colors.text,
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    borderGlass: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    danger: colors.primary || '#D2121A', // Sexy red
  }), [colors, isDark]);

  // ─── STATE ───
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ enabled: false });
  const [paired, setPaired] = useState(false);
  const [inviteCode, setInviteCode] = useState(null);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);

  const [selectedDate, setSelectedDate] = useState(
    userProfile?.relationshipStartDate ? new Date(userProfile.relationshipStartDate) : new Date()
  );

  // ─── DERIVED VALUES ───
  const displayName = useMemo(
    () => getMyDisplayName(userProfile, null, user?.displayName || 'You') || 'You',
    [userProfile, user]
  );
  const partnerName = useMemo(
    () => getPartnerDisplayName(userProfile, null, 'Partner'),
    [userProfile]
  );
  const initial = useMemo(() => displayName.charAt(0).toUpperCase(), [displayName]);
  const appVersion = Constants.expoConfig?.version || '1.0.0';

  // ─── REFRESH LOGIC ───
  const refreshSyncStatus = useCallback(async () => {
    try {
      const status = await cloudSyncStorage.getSyncStatus();
      setSyncStatus(status || { enabled: false });
      
      let coupleId = await storage.get(STORAGE_KEYS.COUPLE_ID, null);
      try {
        const remoteCouple = await CoupleService.getMyCouple();
        const remoteCoupleId = remoteCouple?.couple_id || null;

        if (remoteCoupleId) {
          coupleId = remoteCoupleId;
          await storage.set(STORAGE_KEYS.COUPLE_ID, remoteCoupleId);
          await StorageRouter.setActiveCoupleId(remoteCoupleId);
        } else if (coupleId) {
          const staleCoupleId = coupleId;
          coupleId = null;
          await storage.remove(STORAGE_KEYS.COUPLE_ID);
          await storage.remove(STORAGE_KEYS.COUPLE_ROLE);
          await storage.remove(STORAGE_KEYS.PARTNER_PROFILE);
          await storage.remove(STORAGE_KEYS.LAST_PARTNER_ACTIVITY);
          try {
            await CoupleKeyService.clearCoupleKey(staleCoupleId);
          } catch (_) {}
        }
      } catch (_) {
        // Keep local state when the server cannot be reached.
      }

      setPaired(!!coupleId);
    } catch (err) {
      setPaired(false);
      CrashReporting.captureException(err, { context: 'settings_refresh' });
    }
  }, []);

  useEffect(() => {
    refreshSyncStatus();
    const unsubscribe = navigation.addListener('focus', refreshSyncStatus);
    return unsubscribe;
  }, [navigation, refreshSyncStatus]);

  // ─── PARTNER LINKING LOGIC ───
  useEffect(() => {
    if (!inviteCode) return;
    let active = true;
    const poll = setInterval(async () => {
      try {
        const couple = await CoupleService.getMyCouple();
        if (couple?.couple_id && active) {
          const coupleId = couple.couple_id;
          await storage.set(STORAGE_KEYS.COUPLE_ID, coupleId);
          await StorageRouter.setActiveCoupleId(coupleId);

          const myPublicKeyB64 = await CoupleKeyService.getDevicePublicKeyB64();
          await CloudEngine.joinCouple(coupleId, myPublicKeyB64);

          const partnerPubKeyB64 = await CloudEngine.getPartnerPublicKey(coupleId);
          if (!partnerPubKeyB64) {
            return;
          }

          const partnerPubKey = naclUtil.decodeBase64(partnerPubKeyB64);
          const coupleKey = await CoupleKeyService.deriveFromKeyExchange(partnerPubKey);
          await CoupleKeyService.storeCoupleKey(coupleId, coupleKey);

          // Update auth profile so EntitlementsContext picks up the new coupleId
          // and can sync premium status between partners immediately.
          await updateProfile?.({ coupleId });

          clearInterval(poll);
          setInviteCode(null);
          notification(NotificationFeedbackType.Success);
          Alert.alert('Linked! 💕', 'You are now connected with your partner.');
          refreshSyncStatus();
        }
      } catch (_) {}
    }, 3000);
    return () => { active = false; clearInterval(poll); };
  }, [inviteCode, refreshSyncStatus]);

  // ─── HANDLERS ───
  const handleDatePickerDismiss = useCallback(() => {
    setShowDatePicker(false);
    updateRelationshipStartDate(selectedDate.toISOString());
    notification(NotificationFeedbackType.Success);
  }, [selectedDate, updateRelationshipStartDate]);

  const handleSignOut = () => {
    impact(ImpactFeedbackStyle.Medium);
    Alert.alert('Sign Out', 'Your session will be ended. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOutLocal() },
    ]);
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

    // Fall back to anonymous sign-in
    const retrySession = await SupabaseAuthService.signInAnonymously().catch(() => null);
    if (retrySession) {
      await StorageRouter.setSupabaseSession(retrySession);
      return retrySession;
    }

    Alert.alert(
      'Sign in required',
      'Your cloud session has expired. Open Cloud Sync to sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Cloud Sync', onPress: () => navigation.navigate('SyncSetup') },
      ]
    );
    return null;
  }, [navigation]);

  const generateInviteCode = async () => {
    if (codeLoading) return;
    setCodeLoading(true);
    try {
      const session = await ensureInviteSession();
      if (!session) return;

      const result = await CoupleService.generateInviteCode();
      setInviteCode(result.code);
      impact(ImpactFeedbackStyle.Medium);
    } catch (error) {
      const message = String(error?.message || 'Unable to generate an invite code.');
      if (message.includes('Not authenticated')) {
        Alert.alert(
          'Sign in required',
          'Your cloud session has expired. Open Cloud Sync to sign in again, then try again.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Cloud Sync', onPress: () => navigation.navigate('SyncSetup') },
          ]
        );
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setCodeLoading(false);
    }
  };

  const handleUnlink = async () => {
    try {
      // Remove server-side membership so a new invite code can be generated
      try {
        await CoupleService.unlinkFromCouple();
      } catch (serverErr) {
        if (__DEV__) console.warn('Server unlink failed (continuing):', serverErr.message);
      }

      const coupleId = await storage.get(STORAGE_KEYS.COUPLE_ID, null);
      if (coupleId) {
        await CoupleKeyService.clearCoupleKey(coupleId);
        await storage.remove(STORAGE_KEYS.COUPLE_ID);
        await updateProfile?.({ coupleId: null });
      }
      await storage.remove(STORAGE_KEYS.COUPLE_ROLE);
      await storage.remove(STORAGE_KEYS.PARTNER_PROFILE);
      await clearCouplePremiumCache();
      setPaired(false);
      setShowUnlinkConfirm(false);
      notification(NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert('Error', 'Could not unlink at this time.');
    }
  };

  const handleUnlinkAndReconnect = async () => {
    try {
      try {
        await CoupleService.unlinkFromCouple();
      } catch (serverErr) {
        if (__DEV__) console.warn('Server unlink failed (continuing):', serverErr.message);
      }

      const coupleId = await storage.get(STORAGE_KEYS.COUPLE_ID, null);
      if (coupleId) {
        await CoupleKeyService.clearCoupleKey(coupleId);
        await storage.remove(STORAGE_KEYS.COUPLE_ID);
        await updateProfile?.({ coupleId: null });
      }
      await storage.remove(STORAGE_KEYS.COUPLE_ROLE);
      await storage.remove(STORAGE_KEYS.PARTNER_PROFILE);
      await clearCouplePremiumCache();
      setPaired(false);
      setShowUnlinkConfirm(false);
      notification(NotificationFeedbackType.Success);
      navigation.navigate('PairingQRCode');
    } catch (err) {
      Alert.alert('Error', 'Could not unlink at this time.');
    }
  };

  // ─── ANIMATION VALUES ───
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const headerScale = scrollY.interpolate({
    inputRange: [-100, 0],
    outputRange: [1.1, 1],
    extrapolate: 'clamp',
  });

  // ════════════════════════════════════
  //  RENDER ENGINE
  // ════════════════════════════════════
  return (
    <View style={[styles.root, { backgroundColor: t.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      
      {/* Deep velvet background gradient with a hint of dark crimson in dark mode */}
      <LinearGradient
        colors={isDark 
          ? [t.background, '#120206', '#0A0003', t.background] 
          : [t.background, t.surfaceSecondary, t.background]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      
      <FilmGrain />
      <GlowOrb color="#D2121A" size={500} top={-200} left={SCREEN_WIDTH - 200} opacity={isDark ? 0.2 : 0.08} />
      <GlowOrb color="#8E8E93" size={300} top={SCREEN_HEIGHT * 0.7} left={-100} opacity={isDark ? 0.12 : 0.07} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <RNAnimated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          onScroll={RNAnimated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        >
          {/* ═══ EDITORIAL HEADER ═══ */}
          <RNAnimated.View style={[styles.header, { opacity: headerOpacity, transform: [{ scale: headerScale }] }]}>
            <ReAnimated.Text entering={FadeInRight.delay(200)} style={[styles.headerSubtitle, { color: t.primary }]}>
              PREFERENCES & ACCOUNT
            </ReAnimated.Text>
            <View style={styles.headerRow}>
              <ReAnimated.Text entering={FadeInDown.delay(300)} style={[styles.headerTitle, { color: t.text }]}>
                Settings
              </ReAnimated.Text>
              <ReAnimated.View entering={FadeIn.delay(500)}>
                <View style={[styles.headerAvatar, { backgroundColor: t.surfaceSecondary, borderColor: t.borderGlass }]}>
                  <Text style={[styles.avatarText, { color: t.primary }]}>{initial}</Text>
                </View>
              </ReAnimated.View>
            </View>
          </RNAnimated.View>

          {/* ═══ USER HIGHLIGHT CARD ═══ */}
          <ReAnimated.View entering={FadeInDown.delay(400).duration(800)} style={styles.cardContainer}>
            <TouchableOpacity 
              activeOpacity={0.9}
              style={[
                styles.editorialCard, 
                { backgroundColor: t.surface, borderColor: t.borderGlass },
                !isDark && styles.lightShadow
              ]}
              accessibilityLabel="Edit profile names"
              accessibilityRole="button"
              onPress={() => navigation.navigate('PartnerNamesSettings')}
            >
              <View style={styles.cardContent}>
                <Text style={[styles.cardTag, { color: t.subtext }]}>ACTIVE PROFILE</Text>
                <Text style={[styles.cardTitle, { color: t.text }]}>{displayName}</Text>
                <Text style={[styles.cardEmail, { color: t.subtext }]}>{user?.email}</Text>
              </View>
              {isPremium && (
                <View style={[styles.premiumPill, { backgroundColor: t.primary }]}>
                  <Icon name="sparkles-outline" size={10} color="#FFF" />
                  <Text style={styles.premiumText}>PRO</Text>
                </View>
              )}
            </TouchableOpacity>
          </ReAnimated.View>

          {/* ═══ PARTNER CONNECTION ═══ */}
          <EditorialSection title="Connection" t={t} delay={500}>
            {!paired ? (
              <View style={styles.promoContent}>
                <View style={[styles.promoIconFrame, { backgroundColor: withAlpha(t.primary, 0.12) }]}>
                  <Icon name="heart-outline" size={32} color={t.primary} />
                </View>
                <Text style={[styles.promoTitle, { color: t.text }]}>Connect With Your Partner</Text>
                <Text style={[styles.promoBody, { color: t.subtext }]}>
                  Pair with your partner for a shared space. Premium adds cloud sync, shared planning, and live couple features.
                </Text>
                
                {inviteCode ? (
                  <ReAnimated.View entering={FadeIn.duration(400)} style={[styles.codeDisplay, { backgroundColor: t.surfaceSecondary }]}>
                    <Text style={[styles.codeText, { color: t.text }]}>{inviteCode}</Text>
                    <TouchableOpacity onPress={() => Clipboard.setStringAsync(inviteCode)} style={styles.copyBtn} accessibilityLabel="Copy invite code" accessibilityRole="button">
                      <Icon name="copy-outline" size={20} color={t.primary} />
                    </TouchableOpacity>
                  </ReAnimated.View>
                ) : (
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: t.primary }, codeLoading && styles.actionBtnDisabled]}
                    onPress={generateInviteCode}
                    disabled={codeLoading}
                    accessibilityLabel="Generate invite code"
                    accessibilityRole="button"
                  >
                    {codeLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.actionBtnText}>Generate Invite Code</Text>
                    )}
                  </TouchableOpacity>
                )}
                
                {!inviteCode && (
                  <>
                    <TouchableOpacity 
                      style={[styles.actionBtn, styles.qrActionBtn, { borderColor: t.primary }]}
                      onPress={() => navigation.navigate('PairingQRCode')}
                      accessibilityLabel="Generate QR code"
                      accessibilityRole="button"
                    >
                      <Icon name="qr-code-outline" size={18} color={t.primary} />
                      <Text style={[styles.actionBtnText, { color: t.primary }]}>Generate QR Code</Text>
                    </TouchableOpacity>
                    <View style={styles.orDividerRow}>
                      <View style={[styles.orDividerLine, { backgroundColor: t.border }]} />
                      <Text style={[styles.orDividerText, { color: t.subtext }]}>OR</Text>
                      <View style={[styles.orDividerLine, { backgroundColor: t.border }]} />
                    </View>
                    <View style={styles.scanOptionsRow}>
                      <TouchableOpacity
                        style={[styles.scanOptionBtn, { borderColor: t.border }]}
                        onPress={() => navigation.navigate('PairingScan')}
                        accessibilityLabel="Scan partner's QR code"
                        accessibilityRole="button"
                      >
                        <Icon name="scan-outline" size={16} color={t.subtext} />
                        <Text style={[styles.scanOptionText, { color: t.subtext }]}>Scan Their QR</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.scanOptionBtn, { borderColor: t.border }]}
                        onPress={() => navigation.navigate('JoinWithCode')}
                        accessibilityLabel="Join with invite code"
                        accessibilityRole="button"
                      >
                        <Icon name="keypad-outline" size={16} color={t.subtext} />
                        <Text style={[styles.scanOptionText, { color: t.subtext }]}>I Have a Code</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            ) : (
              <EditorialRow 
                icon="infinite-outline" 
                title="Partner Linked" 
                subtitle={`Connected to ${partnerName}`}
                onPress={() => setShowUnlinkConfirm(true)}
                t={t}
                isLast
              />
            )}
          </EditorialSection>

          {/* ═══ RELATIONSHIP ENGINE ═══ */}
          <EditorialSection title="Relationship" t={t} delay={600}>
            <EditorialRow 
              icon="calendar-outline" 
              title="Anniversary" 
              subtitle={getRelationshipDurationText()}
              onPress={() => setShowDatePicker(true)}
              t={t}
            />
            <EditorialRow 
              icon="person-circle-outline" 
              title="Identity" 
              subtitle="How you appear to each other"
              onPress={() => navigation.navigate('PartnerNamesSettings')}
              t={t}
              isLast
            />
          </EditorialSection>

          {/* ═══ EXPERIENCE CUSTOMIZATION ═══ */}
          <EditorialSection title="Experience" t={t} delay={700}>
            <EditorialRow 
              icon="flame-outline" 
              title="Heat Level" 
              subtitle="Content intensity preferences"
              iconColor={t.primary}
              onPress={() => navigation.navigate('HeatLevelSettings')}
              t={t}
            />
            <EditorialRow 
              icon="notifications-outline" 
              title="Notifications" 
              subtitle="Ritual & prompt reminders"
              onPress={() => navigation.navigate('NotificationSettings')}
              t={t}
            />
            <EditorialRow 
              icon="color-palette-outline" 
              title="Appearance" 
              subtitle={`${themeMode.charAt(0).toUpperCase() + themeMode.slice(1)} Mode`}
              onPress={() => {
                const modes = ['light', 'dark', 'auto'];
                const next = modes[(modes.indexOf(themeMode) + 1) % 3];
                setThemeMode(next);
                notification(NotificationFeedbackType.Success);
              }}
              t={t}
              isLast
            />
          </EditorialSection>

          {/* ═══ SEASONAL & BOUNDARY PANELS ═══ */}
          <View style={styles.panelSpacer}>
            <SeasonSelector onSeasonChange={() => loadContentProfile?.()} />
          </View>

          <View style={styles.panelSpacer}>
            <EnergyMatcher />
          </View>
          
          <View style={styles.panelSpacer}>
            <SoftBoundariesPanel onBoundaryChange={() => loadContentProfile?.()} />
          </View>

          {/* ═══ SUPPORT & SECURITY ═══ */}
          <EditorialSection title="Safety & Support" t={t} delay={800}>
            <EditorialRow 
              icon="shield-checkmark-outline" 
              title="Privacy Policy" 
              onPress={() => navigation.navigate('PrivacyPolicy')}
              t={t}
            />
            <EditorialRow 
              icon="document-text-outline" 
              title="Terms of Service" 
              onPress={() => navigation.navigate('Terms')}
              t={t}
            />
            <EditorialRow 
              icon="help-circle-outline" 
              title="FAQ" 
              onPress={() => navigation.navigate('FAQ')}
              t={t}
            />
            <EditorialRow 
              icon="document-attach-outline" 
              title="EULA" 
              onPress={() => navigation.navigate('EULA')}
              t={t}
            />
            <EditorialRow 
              icon="mail-outline" 
              title="Support Center" 
              onPress={async () => {
                const url = `mailto:${SUPPORT_EMAIL}`;
                const canOpen = await Linking.canOpenURL(url).catch(() => false);
                if (canOpen) {
                  Linking.openURL(url).catch(() => null);
                } else {
                  Alert.alert('No Mail App', `Please email us at ${SUPPORT_EMAIL}`);
                }
              }}
              t={t}
              isLast
            />
          </EditorialSection>

          {/* ═══ ACCOUNT DESTRUCTION ═══ */}
          <EditorialSection title="Account" t={t} delay={900}>
            <EditorialRow 
              icon="log-out-outline" 
              title="Sign Out" 
              onPress={handleSignOut}
              t={t}
            />
            <EditorialRow 
              icon="trash-outline" 
              title="Delete Account" 
              iconColor={t.danger}
              onPress={() => navigation.navigate('DeleteAccount')}
              t={t}
              isLast
            />
          </EditorialSection>

          {/* ═══ EDITORIAL FOOTER ═══ */}
          <View style={styles.footer}>
            <Text style={[styles.footerBrand, { color: t.subtext }]}>BETWEEN US</Text>
            <TouchableOpacity
              onLongPress={async () => {
                const rcId = RevenueCatService.currentUserId;
                if (rcId) {
                  await Clipboard.setStringAsync(rcId);
                  Alert.alert('Copied', `User ID copied:\n${rcId}`);
                } else {
                  Alert.alert('Not Available', 'RevenueCat user ID not set yet.');
                }
              }}
              activeOpacity={0.7}
              delayLongPress={800}
            >
              <Text style={[styles.footerVersion, { color: t.subtext }]}>Version {appVersion}</Text>
            </TouchableOpacity>
            <View style={[styles.footerDivider, { backgroundColor: t.borderGlass }]} />
            <Text style={[styles.footerLegal, { color: t.subtext }]}>
              Handcrafted for romance, worldwide.
            </Text>
          </View>

        </RNAnimated.ScrollView>
      </SafeAreaView>

      {/* ─── DATE PICKER MODAL ─── */}
      <Modal visible={showDatePicker} transparent animationType="slide">
        <TouchableOpacity
          style={styles.datePickerOverlay}
          activeOpacity={1}
          onPress={handleDatePickerDismiss}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={[styles.datePickerContainer, { backgroundColor: t.surface }]}>
              <View style={[styles.datePickerHeader, { borderBottomColor: t.borderGlass }]}>
                <Text style={[styles.datePickerTitle, { color: t.subtext }]}>Anniversary</Text>
                <TouchableOpacity onPress={handleDatePickerDismiss}>
                  <Text style={[styles.datePickerDone, { color: t.primary }]}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="spinner"
                onChange={(event, date) => {
                  if (date) setSelectedDate(date);
                }}
                textColor={t.text}
                style={styles.datePickerWidget}
              />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ─── UNLINK MODAL ─── */}
      <Modal visible={showUnlinkConfirm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ReAnimated.View entering={FadeInDown} style={[styles.modalCard, { backgroundColor: t.surface }]}>
            <Text style={[styles.modalTitle, { color: t.text }]}>Unlink Partner?</Text>
            <Text style={[styles.modalBody, { color: t.subtext }]}>
              This will stop all shared syncing. Your private data remains safe.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: t.surfaceSecondary }]} onPress={() => setShowUnlinkConfirm(false)}>
                <Text style={{ color: t.text, fontFamily: SYSTEM_FONT, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.btnDestructive]} onPress={handleUnlink}>
                <Text style={{ color: '#FFFFFF', fontFamily: SYSTEM_FONT, fontWeight: '700' }}>Unlink</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.reconnectBtn, { backgroundColor: t.primary }]}
              onPress={handleUnlinkAndReconnect}
            >
              <Icon name="qr-code-outline" size={16} color="#FFFFFF" />
              <Text style={styles.reconnectBtnText}>{'Unlink & Invite New Partner'}</Text>
            </TouchableOpacity>
          </ReAnimated.View>
        </View>
      </Modal>
    </View>
  );
}

// ════════════════════════════════════════════════════════
//  HIGH-END DESIGN SYSTEM (STYLES)
// ════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scrollContent: { paddingBottom: 160 }, // Secure clearance for glass tab bar

  // Editorial Header
  header: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  headerSubtitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 42,
  },
  headerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  avatarText: { 
    fontFamily: SYSTEM_FONT, 
    fontWeight: '800', 
    fontSize: 20 
  },

  // Highlight Card
  cardContainer: {
    paddingHorizontal: SPACING.screen,
    marginVertical: SPACING.md,
  },
  editorialCard: {
    borderRadius: 28, // Deep Squircle
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  lightShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
  },
  cardContent: { flex: 1 },
  cardTag: { 
    fontFamily: SYSTEM_FONT, 
    fontWeight: '800', 
    fontSize: 11, 
    letterSpacing: 1.5, 
    marginBottom: 6 
  },
  cardTitle: { 
    fontFamily: SYSTEM_FONT, 
    fontWeight: '800', 
    fontSize: 24, 
    letterSpacing: -0.3,
    marginBottom: 4 
  },
  cardEmail: { 
    fontFamily: SYSTEM_FONT, 
    fontWeight: '500', 
    fontSize: 14 
  },
  premiumPill: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  premiumText: { 
    color: '#FFF', 
    fontFamily: SYSTEM_FONT, 
    fontWeight: '800', 
    fontSize: 10, 
    letterSpacing: 1 
  },

  // Sections & Rows
  sectionContainer: {
    marginTop: 35,
    paddingHorizontal: SPACING.screen,
  },
  sectionLabel: {
    fontFamily: SYSTEM_FONT,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: SPACING.md,
    paddingLeft: SPACING.xs,
  },
  sectionCard: {
    borderRadius: 24, // Squircles
    borderWidth: 1,
    overflow: 'hidden',
  },
  rowWrapper: {
    paddingHorizontal: SPACING.lg,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  rowTextContent: { flex: 1 },
  rowTitle: { 
    fontFamily: SYSTEM_FONT, 
    fontWeight: '600', 
    fontSize: 16, 
    letterSpacing: -0.2 
  },
  rowSubtitle: { 
    fontFamily: SYSTEM_FONT, 
    fontWeight: '400', 
    fontSize: 13, 
    marginTop: 2 
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 52,
  },

  // Promo Card Styles
  promoContent: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  promoIconFrame: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  promoTitle: { 
    fontFamily: SERIF_FONT, 
    fontSize: 26, 
    letterSpacing: -0.2,
    marginBottom: SPACING.sm 
  },
  promoBody: { 
    fontFamily: SYSTEM_FONT, 
    fontWeight: '400',
    fontSize: 15, 
    textAlign: 'center', 
    lineHeight: 22, 
    marginBottom: 24,
    paddingHorizontal: 10 
  },
  actionBtn: {
    width: '100%',
    height: 56, // Apple standard height
    borderRadius: 28, // Pill shape
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnDisabled: {
    opacity: 0.75,
  },
  actionBtnText: { 
    color: '#FFF', 
    fontFamily: SYSTEM_FONT, 
    fontWeight: '700', 
    fontSize: 16,
    letterSpacing: -0.2 
  },
  secondaryBtn: { 
    marginTop: SPACING.lg,
    padding: SPACING.sm, 
  },
  secondaryBtnText: { 
    fontFamily: SYSTEM_FONT, 
    fontWeight: '600', 
    fontSize: 14 
  },
  qrActionBtn: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  orDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.md,
    width: '100%',
  },
  orDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  orDividerText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginHorizontal: 10,
  },
  scanOptionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    width: '100%',
  },
  scanOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  scanOptionText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '600',
  },
  reconnectBtn: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 56,
    borderRadius: 28,
    gap: 8,
  },
  reconnectBtnText: {
    color: '#FFFFFF',
    fontFamily: SYSTEM_FONT,
    fontWeight: '700',
    fontSize: 14,
  },
  codeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: 16,
    gap: 16,
  },
  codeText: { 
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }), 
    fontSize: 22, 
    letterSpacing: 4, 
    fontWeight: '700' 
  },

  // Misc Layout
  panelSpacer: { 
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.screen, 
  },
  footer: {
    marginTop: 60,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  footerBrand: { 
    fontFamily: SYSTEM_FONT, 
    fontWeight: '800', 
    fontSize: 12, 
    letterSpacing: 4, 
    marginBottom: 8 
  },
  footerVersion: { 
    fontFamily: SYSTEM_FONT, 
    fontWeight: '500', 
    fontSize: 12, 
    marginBottom: 16 
  },
  footerDivider: { 
    height: 1, 
    width: 40, 
    marginBottom: 16 
  },
  footerLegal: { 
    fontFamily: SYSTEM_FONT, 
    fontWeight: '400', 
    fontSize: 12, 
    textAlign: 'center', 
  },

  // Date Picker Modal
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  datePickerContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  datePickerTitle: {
    fontFamily: SYSTEM_FONT,
    fontWeight: '600',
    fontSize: 16,
  },
  datePickerDone: {
    fontFamily: SYSTEM_FONT,
    fontWeight: '700',
    fontSize: 17,
  },
  datePickerWidget: {
    width: '100%',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  modalCard: {
    borderRadius: 28,
    padding: SPACING.xxl,
    alignItems: 'center',
  },
  cloudAuthCard: {
    maxWidth: 420,
  },
  cloudAuthBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: { 
    fontFamily: SYSTEM_FONT, 
    fontWeight: '800', 
    fontSize: 22, 
    letterSpacing: -0.3,
    marginBottom: SPACING.sm 
  },
  modalBody: { 
    fontFamily: SYSTEM_FONT, 
    fontWeight: '400', 
    fontSize: 16, 
    textAlign: 'center', 
    lineHeight: 24, 
    marginBottom: SPACING.xxl 
  },
  cloudAuthBody: {
    marginBottom: SPACING.lg,
  },
  cloudAuthInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    marginBottom: SPACING.xl,
  },
  modalActions: { 
    flexDirection: 'row', 
    gap: 12,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    height: 56, // Tall Apple Action Button
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnDisabled: {
    opacity: 0.72,
  },
  cloudAuthSubmit: {
    backgroundColor: '#D2121A',
  },
  btnDestructive: { backgroundColor: '#D2121A' },
});
