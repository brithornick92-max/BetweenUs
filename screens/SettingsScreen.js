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
  Switch,
  Alert,
  Modal,
  Dimensions,
  Linking,
  Platform,
  StatusBar,
  Animated as RNAnimated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
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
import { useEntitlements } from '../context/EntitlementsContext';
import { useContent } from '../context/ContentContext';
import { useAppContext } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';

// Utilities & Components
import { impact, notification, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { SPACING, withAlpha } from '../utils/theme';
import { dateOnlyToLocalDate } from '../utils/dateOnly';
import { KEEPSAKE_CATEGORY_COLORS, SUPPORT_EMAIL } from '../config/constants';
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';
import { cloudSyncStorage, settingsStorage, STORAGE_KEYS, storage } from '../utils/storage';
import CrashReporting from '../services/CrashReporting';
import RevenueCatService from '../services/RevenueCatService';
import { getVerifiedCoupleState } from '../services/couple/CouplePresenceService';
import StorageRouter from '../services/storage/StorageRouter';
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

const DEFAULT_KEEPSAKE_SETTINGS = {
  prompts: true,
  memories: true,
  dates: true,
  positions: true,
};

const normalizeKeepsakeSettings = (settings) => ({
  prompts: settings?.prompts ?? DEFAULT_KEEPSAKE_SETTINGS.prompts,
  memories: settings?.memories ?? DEFAULT_KEEPSAKE_SETTINGS.memories,
  dates: settings?.dates ?? DEFAULT_KEEPSAKE_SETTINGS.dates,
  positions: settings?.positions ?? DEFAULT_KEEPSAKE_SETTINGS.positions,
});

const EditorialToggleRow = ({ icon, title, subtitle, value, onValueChange, t, isLast, iconColor }) => (
  <View style={styles.rowWrapper}>
    <View style={styles.rowMain}>
      <View style={[styles.iconContainer, { backgroundColor: withAlpha(iconColor || t.primary, 0.12) }]}>
        <Icon name={icon} size={22} color={iconColor || t.primary} />
      </View>
      <View style={styles.rowTextContent}>
        <Text style={[styles.rowTitle, { color: t.text }]}>{title}</Text>
        {subtitle && <Text style={[styles.rowSubtitle, { color: t.subtext }]}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: t.border, true: iconColor || t.primary }}
        ios_backgroundColor={t.border}
        accessibilityLabel={title}
        accessibilityState={{ checked: value }}
      />
    </View>
    {!isLast && <View style={[styles.rowDivider, { backgroundColor: t.borderGlass }]} />}
  </View>
);

// ════════════════════════════════════════════════════════
//  MAIN SCREEN COMPONENT
// ════════════════════════════════════════════════════════

export default function SettingsScreen({ navigation }) {
  // ─── HOOKS & CONTEXT ───
  const { user, userProfile, signOutLocal, updateProfile } = useAuth();
  const { isPremiumEffective: isPremium } = useEntitlements();
  const { colors, themeMode, setThemeMode, isDark } = useTheme();
  const { actions: appActions } = useAppContext();
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
  const [paired, setPaired] = useState(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [keepsakeSettings, setKeepsakeSettings] = useState(DEFAULT_KEEPSAKE_SETTINGS);
  const unlinkInFlightRef = useRef(false);
  const connectionMutationRef = useRef(0);

  const [selectedDate, setSelectedDate] = useState(
    () => {
      const today = new Date();
      const nextDate = dateOnlyToLocalDate(userProfile?.relationshipStartDate);
      return nextDate && nextDate <= today ? nextDate : today;
    }
  );

  useEffect(() => {
    const today = new Date();
    const nextDate = dateOnlyToLocalDate(userProfile?.relationshipStartDate);
    if (nextDate) setSelectedDate(nextDate <= today ? nextDate : today);
  }, [userProfile?.relationshipStartDate]);

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
    if (unlinkInFlightRef.current) return;
    const mutationVersion = connectionMutationRef.current;
    try {
      await cloudSyncStorage.getSyncStatus();

      // Use the double-confirmed verification helper so a single transient remote
      // miss does not silently clear local couple state.
      const verified = await getVerifiedCoupleState({
        currentCoupleId: await storage.get(STORAGE_KEYS.COUPLE_ID, null),
        userId: user?.id,
        updateProfile,
        requireRemoteCheck: true,
        confirmMiss: true,
      });

      if (verified.coupleId) {
        await StorageRouter.setActiveCoupleId(verified.coupleId);
      }

      if (unlinkInFlightRef.current || mutationVersion !== connectionMutationRef.current) return;
      setPaired(!!verified.coupleId);
    } catch (err) {
      // Do not force setPaired(false) on a transient refresh failure — the user
      // may still be linked and flipping paired state incorrectly would be misleading.
      CrashReporting.captureException(err, { context: 'settings_refresh' });
    }
  }, [user?.id, updateProfile]);

  useEffect(() => {
    refreshSyncStatus();
    const unsubscribe = navigation.addListener('focus', refreshSyncStatus);
    return unsubscribe;
  }, [navigation, refreshSyncStatus]);

  useEffect(() => {
    let active = true;

    settingsStorage.getKeepsakeSettings().then((saved) => {
      if (active) {
        setKeepsakeSettings(normalizeKeepsakeSettings(saved));
      }
    }).catch(() => {});

    return () => {
      active = false;
    };
  }, []);


  // ─── HANDLERS ───
  const handleDatePickerDismiss = useCallback(async () => {
    const today = new Date();
    const dateToSave = selectedDate > today ? today : selectedDate;

    setShowDatePicker(false);
    setSelectedDate(dateToSave);

    try {
      await updateRelationshipStartDate(dateToSave);
      notification(NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Invalid Date', error?.message || 'Please choose today or an earlier anniversary date.');
    }
  }, [selectedDate, updateRelationshipStartDate]);

  const handleSignOut = () => {
    impact(ImpactFeedbackStyle.Medium);
    Alert.alert('Sign Out', 'Your session will be ended. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        try {
          await signOutLocal();
        } catch (error) {
          if (__DEV__) console.error('[SettingsScreen] signOutLocal error:', error);
          Alert.alert('Error', 'Failed to sign out. Please try again.');
        }
      }},
    ]);
  };

  const handleKeepsakeToggle = useCallback(async (key, value) => {
    impact(ImpactFeedbackStyle.Light);
    const next = {
      ...keepsakeSettings,
      [key]: value,
    };
    setKeepsakeSettings(next);
    await settingsStorage.setKeepsakeSettings(next);
  }, [keepsakeSettings]);


  const handleUnlink = async () => {
    if (unlinkInFlightRef.current) return;
    unlinkInFlightRef.current = true;
    connectionMutationRef.current += 1;
    setIsUnlinking(true);
    try {
      await appActions.leaveCouple({
        onProfileCleared: updateProfile,
      });
      setPaired(false);
      setShowUnlinkConfirm(false);
      Alert.alert('Unpaired', 'You have been unpaired successfully.');
    } catch (err) {
      if (__DEV__) console.warn('Unlink failed:', err?.message || err);
      CrashReporting.captureException(err, { context: 'settings_unlink_partner' });
      Alert.alert(
        'Could not unpair',
        "We couldn't complete the unpair request right now, so your connection was left unchanged. Please try again."
      );
    } finally {
      unlinkInFlightRef.current = false;
      setIsUnlinking(false);
    }
  };

  const handleUnlinkAndReconnect = async () => {
    if (unlinkInFlightRef.current) return;
    unlinkInFlightRef.current = true;
    connectionMutationRef.current += 1;
    setIsUnlinking(true);
    try {
      await appActions.leaveCouple({
        onProfileCleared: updateProfile,
      });
      setPaired(false);
      setShowUnlinkConfirm(false);
      Alert.alert(
        'Unpaired',
        'You have been unpaired. You can now connect with a different partner.'
      );
      navigation.navigate('ConnectPartner');
    } catch (err) {
      if (__DEV__) console.warn('Unlink and reconnect failed:', err?.message || err);
      CrashReporting.captureException(err, { context: 'settings_unlink_and_reconnect' });
      Alert.alert(
        'Could not unpair',
        "We couldn't complete the unpair request, so your connection was left unchanged. Please try again."
      );
    } finally {
      unlinkInFlightRef.current = false;
      setIsUnlinking(false);
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
            <View
              style={[
                styles.editorialCard, 
                { backgroundColor: t.surface, borderColor: t.borderGlass },
                !isDark && styles.lightShadow
              ]}
              accessibilityLabel="Active profile"
            >
              <View style={styles.cardContent}>
                <Text style={[styles.cardTag, { color: t.subtext }]}>ACTIVE PROFILE</Text>
                <Text style={[styles.cardTitle, { color: t.text }]}>{displayName}</Text>
                <Text style={[styles.cardEmail, { color: t.subtext }]}>{user?.email}</Text>
              </View>
              {isPremium && (
                <View style={[styles.premiumPill, { backgroundColor: t.primary }]}>
                  <Icon name="sparkles-outline" size={10} color="#FFF" />
                  <Text style={styles.premiumText}>PREMIUM</Text>
                </View>
              )}
            </View>
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
                  Pair with your partner for a shared space. Free already includes shared prompts, notes, calendar, and keepsakes. Premium adds more prompts, dates, sex positions, the Vibe Signal screen, and the full Keepsake archive.
                </Text>
                
                <TouchableOpacity 
                  style={[styles.actionBtn, { backgroundColor: t.primary }]}
                  onPress={() => navigation.navigate('ConnectPartner')}
                  accessibilityLabel="Connect with partner"
                  accessibilityRole="button"
                >
                  <Text style={styles.actionBtnText}>Connect with Partner</Text>
                </TouchableOpacity>
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
            />
            <EditorialRow
              icon="heart-circle-outline"
              title="Couple Profile"
              subtitle="Your shared preferences and connection style"
              onPress={() => navigation.navigate('RelationshipProfile')}
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

          <EditorialSection title="Keepsake" t={t} delay={725}>
            <View style={styles.keepsakeHelperRow}>
              <View style={[styles.iconContainer, { backgroundColor: withAlpha(t.primary, 0.12) }]}>
                <Icon name="options-outline" size={22} color={t.primary} />
              </View>
              <Text style={[styles.keepsakeHelperText, { color: t.subtext }]}>
                Turn off any category you do not want collected in Keepsake.
              </Text>
            </View>
            <View style={[styles.rowDivider, styles.keepsakeHelperDivider, { backgroundColor: t.borderGlass }]} />
            <EditorialToggleRow
              icon="chatbubbles-outline"
              title="Prompt"
              subtitle="Show shared reflections in Keepsake"
              value={keepsakeSettings.prompts}
              onValueChange={(value) => handleKeepsakeToggle('prompts', value)}
              t={t}
              iconColor={KEEPSAKE_CATEGORY_COLORS.prompt}
            />
            <EditorialToggleRow
              icon="images-outline"
              title="Memory"
              subtitle="Show saved photos, videos, and notes"
              value={keepsakeSettings.memories}
              onValueChange={(value) => handleKeepsakeToggle('memories', value)}
              t={t}
              iconColor={KEEPSAKE_CATEGORY_COLORS.memory}
            />
            <EditorialToggleRow
              icon="calendar-outline"
              title="Date"
              subtitle="Show date nights you marked as tried"
              value={keepsakeSettings.dates}
              onValueChange={(value) => handleKeepsakeToggle('dates', value)}
              t={t}
              iconColor={KEEPSAKE_CATEGORY_COLORS.date}
            />
            <EditorialToggleRow
              icon="checkmark-circle-outline"
              title="Sex Position"
              subtitle="Show sex positions marked as tried"
              value={keepsakeSettings.positions}
              onValueChange={(value) => handleKeepsakeToggle('positions', value)}
              t={t}
              iconColor={KEEPSAKE_CATEGORY_COLORS.position}
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
              icon="lock-closed-outline"
              title="Privacy & Security"
              subtitle="App lock, sessions, export, and deletion"
              onPress={() => navigation.navigate('PrivacySecuritySettings')}
              t={t}
            />
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
              accessibilityRole="button"
              accessibilityLabel={`Version ${appVersion}`}
              accessibilityHint="Long press to copy your RevenueCat user ID."
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
                <TouchableOpacity
                  onPress={handleDatePickerDismiss}
                  accessibilityRole="button"
                  accessibilityLabel="Done selecting anniversary"
                >
                  <Text style={[styles.datePickerDone, { color: t.primary }]}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                onChange={(event, date) => {
                  if (!date) return;
                  setSelectedDate(date > new Date() ? new Date() : date);
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
              This will stop shared syncing between you and your partner. Content created after unlinking will belong only to the account that creates it.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: t.surfaceSecondary }, isUnlinking && styles.actionBtnDisabled]}
                onPress={() => setShowUnlinkConfirm(false)}
                disabled={isUnlinking}
                accessibilityRole="button"
                accessibilityLabel="Cancel unlink partner"
                accessibilityState={{ disabled: isUnlinking }}
              >
                <Text style={{ color: t.text, fontFamily: SYSTEM_FONT, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.btnDestructive, isUnlinking && styles.actionBtnDisabled]}
                onPress={handleUnlink}
                disabled={isUnlinking}
                accessibilityRole="button"
                accessibilityLabel="Unlink partner"
                accessibilityState={{ disabled: isUnlinking, busy: isUnlinking }}
              >
                <Text style={{ color: '#FFFFFF', fontFamily: SYSTEM_FONT, fontWeight: '700' }}>
                  {isUnlinking ? 'Unlinking...' : 'Unlink'}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.reconnectBtn, { backgroundColor: t.primary }, isUnlinking && styles.actionBtnDisabled]}
              onPress={handleUnlinkAndReconnect}
              disabled={isUnlinking}
              accessibilityRole="button"
              accessibilityLabel="Unlink and invite new partner"
              accessibilityState={{ disabled: isUnlinking, busy: isUnlinking }}
            >
              <Icon name="link-outline" size={16} color="#FFFFFF" />
              <Text style={styles.reconnectBtnText}>
                {isUnlinking ? 'Unlinking...' : 'Unlink & Invite New Partner'}
              </Text>
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
  keepsakeHelperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  keepsakeHelperText: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 18,
  },
  keepsakeHelperDivider: {
    marginLeft: 68,
  },
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
