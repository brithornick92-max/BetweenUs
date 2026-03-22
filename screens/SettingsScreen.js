/**
 * BETWEEN US - SETTINGS ENGINE (EDITORIAL V3)
 * High-End Apple Editorial Implementation
 * Length: 1000+ Lines equivalent architectural depth
 */

import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Share,
  TextInput,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StatusBar,
  Animated as RNAnimated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import ReAnimated, { 
  FadeInDown, 
  FadeInRight, 
  FadeIn, 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';

// Context & Services
import { useAuth } from '../context/AuthContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useContent } from '../context/ContentContext';
import { useTheme } from '../context/ThemeContext';
import { useAppContext } from '../context/AppContext';
import { useSubscription } from '../context/SubscriptionContext';

// Utilities & Components
import { impact, notification, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { SPACING, BORDER_RADIUS, withAlpha } from '../utils/theme';
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';
import { cloudSyncStorage, STORAGE_KEYS, storage } from '../utils/storage';
import SupabaseAuthService from '../services/supabase/SupabaseAuthService';
import CrashReporting from '../services/CrashReporting';
import CoupleKeyService from '../services/security/CoupleKeyService';
import CoupleService from '../services/supabase/CoupleService';
import StorageRouter from '../services/storage/StorageRouter';
import SeasonSelector from '../components/SeasonSelector';
import SoftBoundariesPanel from '../components/SoftBoundariesPanel';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ════════════════════════════════════════════════════════
//  INTERNAL HIGH-END COMPONENTS (The "Editorial" Toolkit)
// ════════════════════════════════════════════════════════

/**
 * EditorialSection
 * Mimics the iOS Inset Grouped List style with generous vertical rhythm.
 */
const EditorialSection = ({ title, children, colors, delay = 0 }) => (
  <ReAnimated.View 
    entering={FadeInDown.delay(delay).duration(700).springify().damping(15)}
    style={styles.sectionContainer}
  >
    {title && <Text style={[styles.sectionLabel, { color: colors.primary }]}>{title.toUpperCase()}</Text>}
    <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.borderGlass }]}>
      {children}
    </View>
  </ReAnimated.View>
);

/**
 * EditorialRow
 * A high-fidelity row component with haptic feedback and dynamic scaling.
 */
const EditorialRow = ({ icon, title, subtitle, onPress, colors, isLast, iconColor, rightElement }) => {
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  const handlePressIn = () => { scale.value = withSpring(0.98); };
  const handlePressOut = () => { scale.value = withSpring(1); };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={() => {
        impact(ImpactFeedbackStyle.Light);
        onPress?.();
      }}
    >
      <ReAnimated.View style={[styles.rowWrapper, animatedStyle]}>
        <View style={styles.rowMain}>
          <View style={[styles.iconContainer, { backgroundColor: withAlpha(iconColor || colors.primary, 0.1) }]}>
            <MaterialCommunityIcons name={icon} size={22} color={iconColor || colors.primary} />
          </View>
          <View style={styles.rowTextContent}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
            {subtitle && <Text style={[styles.rowSubtitle, { color: colors.textMuted }]}>{subtitle}</Text>}
          </View>
          {rightElement ? rightElement : (
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.border} />
          )}
        </View>
        {!isLast && <View style={[styles.rowDivider, { backgroundColor: colors.borderGlass }]} />}
      </ReAnimated.View>
    </TouchableOpacity>
  );
};

// ════════════════════════════════════════════════════════
//  MAIN SCREEN COMPONENT
// ════════════════════════════════════════════════════════

export default function SettingsScreen({ navigation }) {
  // ─── HOOKS & CONTEXT ───
  const { user, userProfile, signOutGlobal, updateProfile } = useAuth();
  const { isPremiumEffective: isPremium, premiumSource, showPaywall } = useEntitlements();
  const { colors, themeMode, setThemeMode } = useTheme();
  const { getRelationshipDurationText, updateRelationshipStartDate, loadContentProfile } = useContent();
  const scrollY = useRef(new RNAnimated.Value(0)).current;

  // ─── STATE ───
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ enabled: false });
  const [paired, setPaired] = useState(false);
  const [inviteCode, setInviteCode] = useState(null);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const [enteredCode, setEnteredCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const [showCloudAuthModal, setShowCloudAuthModal] = useState(false);
  const [cloudAuthPassword, setCloudAuthPassword] = useState('');
  const [cloudAuthLoading, setCloudAuthLoading] = useState(false);
  const cloudAuthResolveRef = useRef(null);

  const [selectedDate, setSelectedDate] = useState(
    userProfile?.relationshipStartDate ? new Date(userProfile.relationshipStartDate) : new Date()
  );

  // ─── DERIVED VALUES ───
  const displayName = useMemo(() => userProfile?.displayName || user?.displayName || 'You', [userProfile, user]);
  const initial = useMemo(() => displayName.charAt(0).toUpperCase(), [displayName]);
  const appVersion = Constants.expoConfig?.version || '1.0.0';

  // ─── REFRESH LOGIC ───
  const refreshSyncStatus = useCallback(async () => {
    try {
      const status = await cloudSyncStorage.getSyncStatus();
      setSyncStatus(status || { enabled: false });
      
      let coupleId = await storage.get(STORAGE_KEYS.COUPLE_ID, null);
      if (coupleId) {
        const key = await CoupleKeyService.getCoupleKey(coupleId);
        setPaired(!!key);
      } else {
        setPaired(false);
      }
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
          clearInterval(poll);
          await storage.set(STORAGE_KEYS.COUPLE_ID, couple.couple_id);
          await StorageRouter.setActiveCoupleId(couple.couple_id);
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
  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Your session will be ended. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOutGlobal() },
    ]);
  };

  const generateInviteCode = async () => {
    if (codeLoading) return;
    setCodeLoading(true);
    try {
      const result = await CoupleService.generateInviteCode();
      setInviteCode(result.code);
      impact(ImpactFeedbackStyle.Medium);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setCodeLoading(false);
    }
  };

  const handleUnlink = async () => {
    try {
      const coupleId = await storage.get(STORAGE_KEYS.COUPLE_ID, null);
      if (coupleId) {
        await CoupleKeyService.clearCoupleKey(coupleId);
        await storage.remove(STORAGE_KEYS.COUPLE_ID);
        await updateProfile?.({ coupleId: null });
      }
      setPaired(false);
      setShowUnlinkConfirm(false);
      notification(NotificationFeedbackType.Success);
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
    outputRange: [1.2, 1],
    extrapolate: 'clamp',
  });

  // ════════════════════════════════════
  //  RENDER ENGINE
  // ════════════════════════════════════
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={themeMode === 'dark' ? 'light-content' : 'dark-content'} />
      <FilmGrain />
      
      {/* Background Ambience */}
      <GlowOrb color={colors.primary} size={500} top={-200} left={-150} opacity={0.08} />
      <GlowOrb color={colors.accent} size={300} top={SCREEN_HEIGHT * 0.4} left={SCREEN_WIDTH - 100} opacity={0.05} />

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
            <ReAnimated.Text entering={FadeInRight.delay(200)} style={[styles.headerSubtitle, { color: colors.primary }]}>
              PREFERENCES & ACCOUNT
            </ReAnimated.Text>
            <View style={styles.headerRow}>
              <ReAnimated.Text entering={FadeInDown.delay(300)} style={[styles.headerTitle, { color: colors.text }]}>
                Settings
              </ReAnimated.Text>
              <ReAnimated.View entering={FadeIn.delay(500)}>
                <TouchableOpacity 
                  style={[styles.headerAvatar, { backgroundColor: colors.surface2 }]}
                  onPress={() => navigation.navigate('PartnerNamesSettings')}
                >
                  <Text style={[styles.avatarText, { color: colors.primary }]}>{initial}</Text>
                </TouchableOpacity>
              </ReAnimated.View>
            </View>
          </RNAnimated.View>

          {/* ═══ USER HIGHLIGHT CARD ═══ */}
          <ReAnimated.View entering={FadeInDown.delay(400).duration(800)} style={styles.cardContainer}>
            <TouchableOpacity 
              activeOpacity={0.9}
              style={[styles.editorialCard, { backgroundColor: colors.surface, borderColor: colors.borderGlass }]}
              onPress={() => navigation.navigate('PartnerNamesSettings')}
            >
              <View style={styles.cardContent}>
                <Text style={[styles.cardTag, { color: colors.textMuted }]}>ACTIVE PROFILE</Text>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{displayName}</Text>
                <Text style={[styles.cardEmail, { color: colors.textMuted }]}>{user?.email}</Text>
              </View>
              <View style={[styles.chevronBadge, { backgroundColor: colors.background }]}>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.primary} />
              </View>
              
              {isPremium && (
                <View style={[styles.premiumPill, { backgroundColor: colors.primary }]}>
                  <MaterialCommunityIcons name="crown" size={12} color="#FFF" />
                  <Text style={styles.premiumText}>PRO</Text>
                </View>
              )}
            </TouchableOpacity>
          </ReAnimated.View>

          {/* ═══ PARTNER CONNECTION ═══ */}
          <EditorialSection title="Connection" colors={colors} delay={500}>
            {!paired ? (
              <View style={styles.promoContent}>
                <View style={styles.promoIconFrame}>
                  <MaterialCommunityIcons name="heart-flash" size={32} color={colors.primary} />
                </View>
                <Text style={[styles.promoTitle, { color: colors.text }]}>Unlock Shared Rituals</Text>
                <Text style={[styles.promoBody, { color: colors.textMuted }]}>
                  Pair with your partner to sync journals, shared memories, and relationship climate data in real-time.
                </Text>
                
                {inviteCode ? (
                  <ReAnimated.View entering={FadeIn.duration(400)} style={styles.codeDisplay}>
                    <Text style={[styles.codeText, { color: colors.text }]}>{inviteCode}</Text>
                    <TouchableOpacity onPress={() => Clipboard.setStringAsync(inviteCode)} style={styles.copyBtn}>
                      <MaterialCommunityIcons name="content-copy" size={16} color={colors.primary} />
                    </TouchableOpacity>
                  </ReAnimated.View>
                ) : (
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                    onPress={() => isPremium ? generateInviteCode() : showPaywall?.('partner')}
                  >
                    <Text style={styles.actionBtnText}>{isPremium ? 'Generate Invite Code' : 'Upgrade to Pair'}</Text>
                  </TouchableOpacity>
                )}
                
                {!inviteCode && (
                  <TouchableOpacity 
                    style={styles.secondaryBtn}
                    onPress={() => setShowCodeEntry(true)}
                  >
                    <Text style={[styles.secondaryBtnText, { color: colors.textMuted }]}>I have a code</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <EditorialRow 
                icon="link-variant" 
                title="Partner Linked" 
                subtitle={`Connected to ${userProfile?.partnerNames?.partnerName || 'Partner'}`}
                onPress={() => setShowUnlinkConfirm(true)}
                colors={colors}
                isLast
              />
            )}
          </EditorialSection>

          {/* ═══ RELATIONSHIP ENGINE ═══ */}
          <EditorialSection title="Relationship" colors={colors} delay={600}>
            <EditorialRow 
              icon="calendar-heart" 
              title="Anniversary" 
              subtitle={getRelationshipDurationText()}
              onPress={() => setShowDatePicker(true)}
              colors={colors}
            />
            <EditorialRow 
              icon="account-edit-outline" 
              title="Identity" 
              subtitle="How you appear to each other"
              onPress={() => navigation.navigate('PartnerNamesSettings')}
              colors={colors}
              isLast
            />
          </EditorialSection>

          {/* ═══ EXPERIENCE CUSTOMIZATION ═══ */}
          <EditorialSection title="Experience" colors={colors} delay={700}>
            <EditorialRow 
              icon="fire" 
              title="Heat Level" 
              subtitle="Content intensity preferences"
              iconColor="#FF6B6B"
              onPress={() => navigation.navigate('HeatLevelSettings')}
              colors={colors}
            />
            <EditorialRow 
              icon="bell-badge-outline" 
              title="Notifications" 
              subtitle="Ritual & prompt reminders"
              onPress={() => navigation.navigate('NotificationSettings')}
              colors={colors}
            />
            <EditorialRow 
              icon="palette-outline" 
              title="Appearance" 
              subtitle={`${themeMode.charAt(0).toUpperCase() + themeMode.slice(1)} Mode`}
              onPress={() => {
                const modes = ['light', 'dark', 'auto'];
                const next = modes[(modes.indexOf(themeMode) + 1) % 3];
                setThemeMode(next);
                notification(NotificationFeedbackType.Success);
              }}
              colors={colors}
              isLast
            />
          </EditorialSection>

          {/* ═══ SEASONAL & BOUNDARY PANELS ═══ */}
          <View style={styles.panelSpacer}>
            <SeasonSelector onSeasonChange={() => loadContentProfile?.()} />
          </View>
          
          <View style={styles.panelSpacer}>
            <SoftBoundariesPanel onBoundaryChange={() => loadContentProfile?.()} />
          </View>

          {/* ═══ SUPPORT & SECURITY ═══ */}
          <EditorialSection title="Safety & Support" colors={colors} delay={800}>
            <EditorialRow 
              icon="shield-check-outline" 
              title="Privacy Policy" 
              onPress={() => navigation.navigate('PrivacyPolicy')}
              colors={colors}
            />
            <EditorialRow 
              icon="help-circle-outline" 
              title="Support Center" 
              onPress={() => Linking.openURL('mailto:brittanyapps@outlook.com')}
              colors={colors}
              isLast
            />
          </EditorialSection>

          {/* ═══ ACCOUNT DESTRUCTION ═══ */}
          <EditorialSection title="Account" colors={colors} delay={900}>
            <EditorialRow 
              icon="logout" 
              title="Sign Out" 
              onPress={handleSignOut}
              colors={colors}
            />
            <EditorialRow 
              icon="trash-can-outline" 
              title="Delete Account" 
              iconColor="#FF3B30"
              onPress={() => navigation.navigate('DeleteAccount')}
              colors={colors}
              isLast
            />
          </EditorialSection>

          {/* ═══ EDITORIAL FOOTER ═══ */}
          <View style={styles.footer}>
            <Text style={[styles.footerBrand, { color: colors.textMuted }]}>BETWEEN US</Text>
            <Text style={[styles.footerVersion, { color: colors.textMuted }]}>Version {appVersion} Build 2026.1</Text>
            <View style={[styles.footerDivider, { backgroundColor: colors.borderGlass }]} />
            <Text style={[styles.footerLegal, { color: colors.textMuted }]}>
              Built with care for couples worldwide.
            </Text>
          </View>

          <View style={{ height: 100 }} />
        </RNAnimated.ScrollView>
      </SafeAreaView>

      {/* ─── DATE PICKER MODAL ─── */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="spinner"
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (date) {
              setSelectedDate(date);
              updateRelationshipStartDate(date.toISOString());
              notification(NotificationFeedbackType.Success);
            }
          }}
          textColor={colors.text}
        />
      )}

      {/* ─── UNLINK MODAL ─── */}
      <Modal visible={showUnlinkConfirm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ReAnimated.View entering={FadeInDown} style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Unlink Partner?</Text>
            <Text style={[styles.modalBody, { color: colors.textMuted }]}>
              This will stop all shared syncing. Your private data remains safe.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtn} onPress={() => setShowUnlinkConfirm(false)}>
                <Text style={{ color: colors.textMuted, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.btnDestructive]} onPress={handleUnlink}>
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Unlink</Text>
              </TouchableOpacity>
            </View>
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
  scrollContent: { paddingBottom: 120 },

  // Editorial Header
  header: {
    paddingHorizontal: 28,
    paddingTop: 30,
    paddingBottom: 15,
  },
  headerSubtitle: {
    fontFamily: 'Lato_700Bold',
    fontSize: 11,
    letterSpacing: 2.5,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'DMSerifDisplay-Regular',
    fontSize: 44,
    letterSpacing: -1.2,
  },
  headerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: { elevation: 6 }
    })
  },
  avatarText: { fontFamily: 'Lato_700Bold', fontSize: 22 },

  // Highlight Card
  cardContainer: {
    paddingHorizontal: 24,
    marginVertical: 15,
  },
  editorialCard: {
    borderRadius: 30,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.08,
        shadowRadius: 30,
      },
      android: { elevation: 4 }
    })
  },
  cardContent: { flex: 1 },
  cardTag: { fontFamily: 'Lato_700Bold', fontSize: 10, letterSpacing: 1.5, marginBottom: 6 },
  cardTitle: { fontFamily: 'Lato_700Bold', fontSize: 24, marginBottom: 4 },
  cardEmail: { fontFamily: 'Lato_400Regular', fontSize: 14, opacity: 0.7 },
  chevronBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumPill: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  premiumText: { color: '#FFF', fontFamily: 'Lato_900Black', fontSize: 10, letterSpacing: 1 },

  // Sections & Rows
  sectionContainer: {
    marginTop: 35,
    paddingHorizontal: 24,
  },
  sectionLabel: {
    fontFamily: 'Lato_700Bold',
    fontSize: 12,
    letterSpacing: 1.8,
    marginBottom: 12,
    marginLeft: 6,
  },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  rowWrapper: {
    paddingHorizontal: 20,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  rowTextContent: { flex: 1 },
  rowTitle: { fontFamily: 'Lato_700Bold', fontSize: 16 },
  rowSubtitle: { fontFamily: 'Lato_400Regular', fontSize: 13, marginTop: 2 },
  rowDivider: {
    height: 1,
    marginLeft: 56,
  },

  // Promo Card Styles
  promoContent: {
    padding: 24,
    alignItems: 'center',
  },
  promoIconFrame: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  promoTitle: { fontFamily: 'DMSerifDisplay-Regular', fontSize: 26, marginBottom: 12 },
  promoBody: { 
    fontFamily: 'Lato_400Regular', 
    fontSize: 15, 
    textAlign: 'center', 
    lineHeight: 22, 
    marginBottom: 24,
    paddingHorizontal: 10 
  },
  actionBtn: {
    width: '100%',
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: { color: '#FFF', fontFamily: 'Lato_700Bold', fontSize: 16 },
  secondaryBtn: { marginTop: 16 },
  secondaryBtnText: { fontFamily: 'Lato_700Bold', fontSize: 14 },
  codeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 16,
    borderRadius: 14,
    gap: 12,
  },
  codeText: { fontFamily: 'monospace', fontSize: 20, letterSpacing: 4, fontWeight: '700' },

  // Misc Layout
  panelSpacer: { marginTop: 25 },
  footer: {
    marginTop: 60,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  footerBrand: { fontFamily: 'Lato_900Black', fontSize: 13, letterSpacing: 4, marginBottom: 8 },
  footerVersion: { fontFamily: 'Lato_400Regular', fontSize: 12, opacity: 0.5, marginBottom: 15 },
  footerDivider: { height: 1, width: 40, marginBottom: 15 },
  footerLegal: { fontFamily: 'Lato_400Regular', fontSize: 12, textAlign: 'center', opacity: 0.4 },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 30,
  },
  modalCard: {
    borderRadius: 28,
    padding: 30,
    alignItems: 'center',
  },
  modalTitle: { fontFamily: 'Lato_700Bold', fontSize: 22, marginBottom: 12 },
  modalBody: { fontFamily: 'Lato_400Regular', fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 25 },
  modalActions: { flexDirection: 'row', gap: 15 },
  modalBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  btnDestructive: { backgroundColor: '#FF3B30' },
});
