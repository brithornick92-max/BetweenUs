import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Modal,
  Share,
  TextInput,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { useAuth } from '../context/AuthContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useContent } from '../context/ContentContext';
import { useTheme } from '../context/ThemeContext';
import { useAppContext } from '../context/AppContext';
import { TYPOGRAPHY, SPACING, BORDER_RADIUS, COLORS } from '../utils/theme';
import { cloudSyncStorage, STORAGE_KEYS, storage } from '../utils/storage';
import SupabaseAuthService from '../services/supabase/SupabaseAuthService';
import { useSubscription } from '../context/SubscriptionContext';
import RevenueCatService from '../services/RevenueCatService';
import CoupleKeyService from '../services/security/CoupleKeyService';
import CoupleService from '../services/supabase/CoupleService';
import NicknameSettings from '../components/NicknameSettings';
import SeasonSelector from '../components/SeasonSelector';
import SoftBoundariesPanel from '../components/SoftBoundariesPanel';
import RelationshipClimate from '../components/RelationshipClimate';
import { SettingRow, SettingsSection as Section } from '../components/SettingsSection';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// SettingRow and Section (as SettingsSection) are now imported from ../components/SettingsSection

export default function SettingsScreen({ navigation }) {
  const { user, userProfile, signOut, signOutLocal, signOutGlobal, updateProfile } = useAuth();
  const { isPremiumEffective: isPremium, premiumSource, showPaywall } = useEntitlements();
  const { offerings } = useSubscription();
  const { colors, themeMode, setThemeMode } = useTheme();
  const DEV_TOOLS_ALLOWED = __DEV__;

  const { state, actions } = useAppContext();
  const { getRelationshipDurationText, updateRelationshipStartDate, loadContentProfile } = useContent();

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ enabled: false });
  const [syncEmail, setSyncEmail] = useState(null);
  const [paired, setPaired] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [lastSyncError, setLastSyncError] = useState(null);
  const [inviteCode, setInviteCode] = useState(null);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const [enteredCode, setEnteredCode] = useState('');
  const [codeExpiresAt, setCodeExpiresAt] = useState(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [premiumUsage, setPremiumUsage] = useState(null);
  const [selectedDate, setSelectedDate] = useState(
    userProfile?.relationshipStartDate ? new Date(userProfile.relationshipStartDate) : new Date()
  );

  // ─── Sync helpers ───
  const refreshSyncStatus = useCallback(async () => {
    try {
      const status = await cloudSyncStorage.getSyncStatus();
      const lastSync = await cloudSyncStorage.getLastSyncTime();
      const queue = await cloudSyncStorage.getSyncQueue();
      const lastError = Array.isArray(queue)
        ? queue.map((item) => item?.lastError).filter(Boolean).slice(-1)[0] || null
        : null;
      const session = await SupabaseAuthService.getSession().catch(() => null);
      setSyncStatus(status || { enabled: false });
      setSyncEmail(session?.user?.email || null);
      setLastSyncTime(lastSync || null);
      setLastSyncError(lastError);
      const coupleId = await storage.get(STORAGE_KEYS.COUPLE_ID, null);
      if (coupleId) {
        const key = await CoupleKeyService.getCoupleKey(coupleId);
        setPaired(!!key);
      } else {
        setPaired(false);
      }
    } catch {
      setSyncStatus({ enabled: false });
      setSyncEmail(null);
      setPaired(false);
      setLastSyncTime(null);
      setLastSyncError(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (!isPremium) {
      setSyncStatus({ enabled: false });
      setSyncEmail(null);
      return () => { active = false; };
    }
    const load = async () => { if (active) await refreshSyncStatus(); };
    load();
    const unsubscribe = navigation.addListener('focus', load);
    return () => { active = false; if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [isPremium, navigation, refreshSyncStatus]);

  // ─── Partner linking handlers ───
  const handleUnlink = async () => {
    try {
      setShowUnlinkConfirm(false);
      const coupleId = await storage.get(STORAGE_KEYS.COUPLE_ID, null);
      if (coupleId) {
        await CoupleKeyService.clearCoupleKey(coupleId);
        await storage.remove(STORAGE_KEYS.COUPLE_ID);
        if (user?.uid) await updateProfile?.({ coupleId: null });
      }
      setPaired(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Something went wrong', 'We couldn\'t unlink your partner right now. Please try again in a moment.');
    }
  };

  const generateInviteCode = async () => {
    if (codeLoading) return;
    if (!user) {
      Alert.alert('Sign In Required', 'You need to sign in before generating a partner code.', [{ text: 'OK' }]);
      return;
    }
    try {
      setCodeLoading(true);
      const result = await CoupleService.generateInviteCode();
      setInviteCode(result.code);
      setCodeExpiresAt(result.expiresAt);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      const msg = error?.message || 'We couldn\'t generate a code right now. Give it another try in a moment.';
      Alert.alert('Something went wrong', msg);
    } finally {
      setCodeLoading(false);
    }
  };

  const copyCode = async () => {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Copied', 'Code copied to clipboard.');
  };

  const shareCode = async () => {
    if (!inviteCode) return;
    try {
      await Share.share({ message: `Join me on Between Us! Use my invite code: ${inviteCode}` });
    } catch (e) { /* share cancelled or failed */ }
  };

  const handleCodeEntry = () => { setShowCodeEntry(true); setInviteCode(null); };

  const submitEnteredCode = async () => {
    if (enteredCode.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter a 6-character code.');
      return;
    }
    if (!user) {
      Alert.alert('Sign In Required', 'You need to sign in before linking with a partner.');
      return;
    }
    try {
      setCodeLoading(true);
      const result = await CoupleService.redeemInviteCode(enteredCode);
      if (result?.coupleId) await storage.set(STORAGE_KEYS.COUPLE_ID, result.coupleId);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const linkedPartnerName = userProfile?.partnerNames?.partnerName || 'your partner';
      Alert.alert('Success!', `You are now linked with ${linkedPartnerName}`, [{
        text: 'OK',
        onPress: () => { setShowCodeEntry(false); setEnteredCode(''); refreshSyncStatus(); },
      }]);
    } catch (error) {
      const msg = error?.message || 'We couldn\'t complete the link. The code may have expired — ask your partner for a fresh one.';
      Alert.alert('Something went wrong', msg);
    } finally {
      setCodeLoading(false);
    }
  };

  const cancelCodeEntry = () => { setShowCodeEntry(false); setEnteredCode(''); };

  // ─── Date handlers ───
  const handleDateChange = (event, date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) { setSelectedDate(date); handleSaveRelationshipDate(date); }
  };

  const handleSaveRelationshipDate = async (date) => {
    try {
      await updateRelationshipStartDate(date.toISOString());
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', 'Your relationship date has been updated.');
    } catch {
      Alert.alert('Something went wrong', 'We couldn\'t save your date right now. Please try again.');
    }
  };

  const showDatePickerModal = () => {
    setShowDatePicker(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // ─── Dev tools ───
  useEffect(() => {
    let active = true;
    if (!__DEV__) return () => {};
    const loadUsage = async () => {
      try {
        const { premiumGatekeeper } = await import('../utils/premiumFeatures');
        const stats = await premiumGatekeeper.getFeatureUsageStats();
        if (active) setPremiumUsage(stats);
      } catch { if (active) setPremiumUsage(null); }
    };
    loadUsage();
    return () => { active = false; };
  }, []);

  const devTapCount = useRef(0);
  const devTapTimer = useRef(null);
  const [showDevTools, setShowDevTools] = useState(false);

  useEffect(() => () => { if (devTapTimer.current) clearTimeout(devTapTimer.current); }, []);

  const handleVersionTap = () => {
    devTapCount.current += 1;
    if (devTapTimer.current) clearTimeout(devTapTimer.current);
    devTapTimer.current = setTimeout(() => { devTapCount.current = 0; }, 2000);
    if (devTapCount.current >= 7 && DEV_TOOLS_ALLOWED) {
      setShowDevTools(prev => !prev);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      devTapCount.current = 0;
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Choose how to sign out:', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'This device only',
        onPress: async () => {
          try {
            await signOutLocal();
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch { Alert.alert('Something went wrong', 'We couldn\'t sign you out. Please try again.'); }
        },
      },
    ]);
  };

  // ─── Derived values ───
  const displayName = userProfile?.displayName || user?.displayName || 'You';
  const initial = displayName.charAt(0).toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U';
  const partnerName = userProfile?.partnerNames?.partnerName || 'Partner';
  const appVersion = Constants.expoConfig?.version || Constants.manifest?.version || '1.0.0';

  // ════════════════════════════════════
  //  R E N D E R
  // ════════════════════════════════════
  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ═══ TOP: Profile header area ═══ */}
          <View style={s.profileArea}>
            <TouchableOpacity
              style={s.profileCard}
              onPress={() => {
                Alert.alert('Account', null, [
                  { text: 'Edit Names & Preferences', onPress: () => navigation.navigate('PartnerNamesSettings') },
                  { text: 'Delete All My Data', style: 'destructive', onPress: () => navigation.navigate('DeleteAccount') },
                  { text: 'Cancel', style: 'cancel' },
                ]);
              }}
              activeOpacity={0.7}
            >
              {/* Avatar */}
              <View style={[s.avatar, { backgroundColor: colors.primary }]}>
                <View style={[s.avatarGlow, { backgroundColor: colors.primaryGlow }]} />
                <Text style={s.avatarLetter}>{initial}</Text>
              </View>

              {/* Name + email */}
              <View style={s.profileInfo}>
                <View style={s.nameRow}>
                  <Text style={[s.profileName, { color: colors.text }]} numberOfLines={1}>{displayName}</Text>
                  {isPremium && (
                    <View style={[s.proBadge, { backgroundColor: colors.primary + '1A' }]}>
                      <MaterialCommunityIcons name="crown" size={10} color={colors.primary} />
                      <Text style={[s.proBadgeText, { color: colors.primary }]}>PRO</Text>
                    </View>
                  )}
                </View>
                <Text style={[s.profileEmail, { color: colors.textMuted }]} numberOfLines={1}>{user?.email || 'Not signed in'}</Text>
              </View>

              <View style={[s.chevronCircle, { backgroundColor: colors.border }]}>
                <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textMuted} />
              </View>
            </TouchableOpacity>
          </View>

          {/* ═══ PARTNER LINKING ═══ */}
          <Section title="Partner" colors={colors}>
            {!isPremium ? (
              <View style={s.partnerContent}>
                <View style={s.partnerHeaderRow}>
                  <View style={[s.rowIcon, { backgroundColor: colors.primary + '14' }]}>
                    <MaterialCommunityIcons name="lock-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.partnerTitle, { color: colors.text }]}>Partner Linking</Text>
                    <Text style={[s.partnerBody, { color: colors.textMuted }]}>
                      Share prompts, memories, and plans together — securely and privately.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[s.ctaBtn, { backgroundColor: colors.primary }]}
                  onPress={() => showPaywall?.('partnerLinking')}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="crown-outline" size={16} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={s.ctaBtnText}>Upgrade to Premium</Text>
                </TouchableOpacity>
              </View>
            ) : paired ? (
              <View style={s.partnerContent}>
                <View style={s.linkedRow}>
                  <View style={[s.linkedDot, { backgroundColor: colors.success }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.partnerTitle, { color: colors.text }]}>Connected with {partnerName}</Text>
                    <Text style={[s.partnerBody, { color: colors.textMuted }]}>
                      Journals, prompts, and plans are shared securely.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[s.outlineBtn, { borderColor: colors.border }]}
                  onPress={() => setShowUnlinkConfirm(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.outlineBtnText, { color: colors.textMuted }]}>Unlink partner</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.partnerContent}>
                <Text style={[s.partnerTitle, { color: colors.text }]}>You're not linked yet</Text>
                <Text style={[s.partnerBody, { color: colors.textMuted, marginBottom: 16 }]}>
                  Link with your partner to share prompts, memories, and plans.
                </Text>

                {inviteCode ? (
                  <View style={s.codeBlock}>
                    <Text style={[s.codeLabelSmall, { color: colors.textMuted }]}>Your invite code</Text>
                    <View style={[s.codeBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Text style={[s.codeText, { color: colors.text }]}>{inviteCode}</Text>
                    </View>
                    <Text style={[s.codeHelper, { color: colors.textMuted }]}>
                      Share this with your partner.{codeExpiresAt ? ' Expires in 15 min.' : ''}
                    </Text>
                    <View style={s.codeActions}>
                      <TouchableOpacity onPress={copyCode} style={s.codeActionBtn}>
                        <MaterialCommunityIcons name="content-copy" size={14} color={colors.primary} />
                        <Text style={[s.codeActionText, { color: colors.primary }]}>Copy</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={shareCode} style={s.codeActionBtn}>
                        <MaterialCommunityIcons name="share-variant" size={14} color={colors.primary} />
                        <Text style={[s.codeActionText, { color: colors.primary }]}>Share</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : showCodeEntry ? (
                  <View style={s.codeBlock}>
                    <Text style={[s.codeLabelSmall, { color: colors.textMuted }]}>Enter partner's code</Text>
                    <View style={[s.codeInputBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <TextInput
                        style={[s.codeInput, { color: colors.text }]}
                        value={enteredCode}
                        onChangeText={(t) => setEnteredCode(t.toUpperCase().slice(0, 6))}
                        placeholder="ABC123"
                        placeholderTextColor={colors.textMuted}
                        maxLength={6}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        autoFocus
                      />
                    </View>
                    <View style={s.codeBtnRow}>
                      <TouchableOpacity style={[s.halfBtn, { borderColor: colors.border }]} onPress={cancelCodeEntry}>
                        <Text style={[s.halfBtnText, { color: colors.textMuted }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.halfBtn, s.halfBtnFill, { backgroundColor: colors.primary }]} onPress={submitEnteredCode}>
                        {codeLoading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={[s.halfBtnText, { color: '#FFF' }]}>Submit</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={s.pairBtns}>
                    <TouchableOpacity
                      style={[s.ctaBtn, { backgroundColor: colors.primary, opacity: codeLoading ? 0.6 : 1 }]}
                      onPress={generateInviteCode}
                      activeOpacity={0.8}
                      disabled={codeLoading}
                    >
                      {codeLoading
                        ? <ActivityIndicator size="small" color="#FFF" />
                        : <Text style={s.ctaBtnText}>Generate partner code</Text>
                      }
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.outlineBtn, { borderColor: colors.border }]}
                      onPress={handleCodeEntry}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.outlineBtnText, { color: colors.text }]}>I have a code</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </Section>

          {/* ═══ RELATIONSHIP ═══ */}
          <Section title="Relationship" colors={colors}>
            <SettingRow
              icon="calendar-heart"
              title="Anniversary Date"
              subtitle={getRelationshipDurationText()}
              onPress={showDatePickerModal}
              colors={colors}
            />
            <SettingRow
              icon="account-edit"
              title="Partner Names"
              subtitle="Customize how you see each other"
              onPress={() => navigation.navigate('PartnerNamesSettings')}
              colors={colors}
              isLast
            />
          </Section>

          {/* ═══ PREFERENCES ═══ */}
          <Section title="Preferences" colors={colors}>
            <SettingRow
              icon="fire"
              iconColor="#E8734A"
              title="Heat Level"
              subtitle="Choose your comfort level"
              onPress={() => navigation.navigate('HeatLevelSettings')}
              colors={colors}
            />
            <SettingRow
              icon="bell-outline"
              title="Notifications"
              subtitle="Ritual reminders & moments"
              onPress={() => navigation.navigate('NotificationSettings')}
              colors={colors}
              isLast
            />
          </Section>

          {/* ═══ APPEARANCE ═══ */}
          <Section title="Appearance" colors={colors}>
            <View style={s.themeRow}>
              {[
                { key: 'light', icon: 'white-balance-sunny', label: 'Light' },
                { key: 'dark', icon: 'weather-night', label: 'Dark' },
                { key: 'auto', icon: 'theme-light-dark', label: 'Auto' },
              ].map(({ key, icon, label }) => {
                const active = themeMode === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      s.themeChip,
                      { borderColor: active ? colors.primary : colors.border },
                      active && { backgroundColor: colors.primary + '18' },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setThemeMode(key);
                    }}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name={icon} size={18} color={active ? colors.primary : colors.textMuted} />
                    <Text style={[s.themeChipText, { color: active ? colors.primary : colors.textMuted }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          {/* ═══ YOUR SEASON ═══ */}
          <Section title="Your Season" colors={colors}>
            <SeasonSelector onSeasonChange={() => loadContentProfile?.().catch(() => {})} />
          </Section>

          {/* ═══ BOUNDARIES ═══ */}
          <Section title="Boundaries" colors={colors}>
            <SoftBoundariesPanel onBoundaryChange={() => loadContentProfile?.().catch(() => {})} />
          </Section>

          {/* ═══ PREMIUM ═══ */}
          <Section title="Premium" colors={colors}>
            <SettingRow
              icon="crown-outline"
              iconColor={colors.accent}
              title={isPremium ? 'Your Premium Plan' : 'Discover the full experience'}
              subtitle={
                isPremium
                  ? premiumSource === 'partner' ? 'Active via partner'
                  : premiumSource === 'self' ? 'Active via your subscription'
                  : 'Active'
                  : 'Unlock all features'
              }
              onPress={() => navigation.navigate('Premium')}
              colors={colors}
              isLast
            />
          </Section>

          {/* ═══ YEAR REFLECTION (premium) ═══ */}
          {isPremium && (
            <Section title="Year Reflection" colors={colors}>
              <SettingRow
                icon="book-open-variant"
                title="Year Reflection"
                subtitle="A warm look back at your year together"
                onPress={() => navigation.navigate('YearReflection')}
                colors={colors}
                isLast
              />
            </Section>
          )}

          {/* ═══ SUPPORT & LEGAL ═══ */}
          <Section title="Support" colors={colors}>
            <SettingRow icon="help-circle-outline" title="Help & FAQ" onPress={() => navigation.navigate('FAQ')} colors={colors} />
            <SettingRow
              icon="email-outline"
              title="Contact Us"
              subtitle="brittanyapps@outlook.com"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                Alert.alert('Contact Support', 'Email us at:\nbrittanyapps@outlook.com\n\nWe typically respond within 24–48 hours.', [{ text: 'OK' }]);
              }}
              colors={colors}
            />
            <SettingRow
              icon="shield-check-outline"
              title="Privacy & Security"
              onPress={() => navigation.navigate('PrivacySecuritySettings')}
              colors={colors}
              isLast
            />
          </Section>

          <Section title="Legal" colors={colors}>
            <SettingRow icon="file-document-outline" title="Terms of Service" onPress={() => navigation.navigate('Terms')} colors={colors} />
            <SettingRow icon="shield-lock-outline" title="Privacy Policy" onPress={() => navigation.navigate('PrivacyPolicy')} colors={colors} isLast />
          </Section>

          {/* ═══ SIGN OUT ═══ */}
          <View style={s.signOutWrap}>
            <TouchableOpacity
              style={[s.signOutBtn, { borderColor: colors.border }]}
              onPress={handleSignOut}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="logout" size={16} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={[s.signOutText, { color: colors.primary }]}>Sign Out</Text>
            </TouchableOpacity>
          </View>

          {/* ═══ DEV TOOLS (hidden) ═══ */}
          {showDevTools && DEV_TOOLS_ALLOWED && (
            <Section title="Developer" colors={colors}>
              <SettingRow icon="bug" title="RevenueCat Debug" onPress={() => navigation.navigate('RevenueCatDebug')} colors={colors} isLast />
            </Section>
          )}

          {/* ═══ VERSION ═══ */}
          <TouchableOpacity onPress={handleVersionTap} activeOpacity={0.7} style={s.versionArea}>
            <Text style={[s.versionText, { color: colors.textMuted }]}>Between Us · v{appVersion}</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* ─── Date Picker ─── */}
        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            maximumDate={new Date()}
            minimumDate={new Date(1950, 0, 1)}
            textColor={colors.text}
            themeVariant={themeMode === 'auto' ? undefined : themeMode}
          />
        )}

        {/* ─── Unlink Confirmation Modal ─── */}
        <Modal visible={showUnlinkConfirm} transparent animationType="fade" onRequestClose={() => setShowUnlinkConfirm(false)}>
          <View style={s.modalOverlay}>
            <View style={[s.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[s.modalIcon, { backgroundColor: colors.danger + '18' }]}>
                <MaterialCommunityIcons name="link-variant-off" size={24} color={colors.danger} />
              </View>
              <Text style={[s.modalTitle, { color: colors.text }]}>Unlink from partner?</Text>
              <Text style={[s.modalBody, { color: colors.textMuted }]}>
                This will stop sharing journals, prompts, and plans. Your existing entries stay saved privately.
              </Text>
              <View style={s.modalBtns}>
                <TouchableOpacity style={[s.modalBtn, { backgroundColor: colors.background }]} onPress={() => setShowUnlinkConfirm(false)}>
                  <Text style={[s.modalBtnText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.modalBtn, { backgroundColor: colors.danger + '18' }]} onPress={handleUnlink}>
                  <Text style={[s.modalBtnText, { color: colors.danger }]}>Unlink</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

// ════════════════════════════════════════════════════════
//  S T Y L E S
// ════════════════════════════════════════════════════════
const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingBottom: 32,
  },

  // ─── Profile area ───
  profileArea: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.sm,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    opacity: 0.45,
  },
  avatarLetter: {
    fontSize: 22,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileName: {
    fontFamily: Platform.select({ ios: 'DMSerifDisplay-Regular', android: 'DMSerifDisplay_400Regular', default: 'serif' }),
    fontSize: 24,
    letterSpacing: -0.3,
  },
  profileEmail: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 2,
    opacity: 0.65,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 3,
  },
  proBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 0.8,
  },
  chevronCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
  },

  // ─── Sections ───
  sectionWrap: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
    marginLeft: 4,
  },
  sectionCard: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    ...Platform.select({
      ios: {
        shadowColor: '#060410',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 14,
      },
      android: { elevation: 3 },
    }),
  },

  // ─── Row items ───
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    position: 'relative',
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md - 4,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
  },
  rowSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 2,
    opacity: 0.65,
  },
  rowDivider: {
    position: 'absolute',
    bottom: 0,
    left: 48,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },

  // ─── Partner / linking ───
  partnerContent: {
    paddingVertical: SPACING.sm,
  },
  partnerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  partnerTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    marginBottom: 4,
  },
  partnerBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.7,
  },
  linkedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  linkedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  pairBtns: {
    gap: 10,
  },
  ctaBtn: {
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  outlineBtn: {
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },

  // ─── Invite code ───
  codeBlock: {
    alignItems: 'center',
  },
  codeLabelSmall: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginBottom: 8,
  },
  codeBox: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
  },
  codeText: {
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }),
    fontSize: 24,
    letterSpacing: 4,
  },
  codeHelper: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  codeActions: {
    flexDirection: 'row',
    gap: SPACING.xl,
  },
  codeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  codeActionText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  },
  codeInputBox: {
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 2,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  codeInput: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    letterSpacing: 4,
    textAlign: 'center',
  },
  codeBtnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  halfBtn: {
    flex: 1,
    height: 44,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  halfBtnFill: {
    borderWidth: 0,
  },
  halfBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },

  // ─── Theme ───
  themeRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: SPACING.sm,
  },
  themeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
  },
  themeChipText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    letterSpacing: 0.2,
  },

  // ─── Sign out ───
  signOutWrap: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  signOutText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
  },

  // ─── Version ───
  versionArea: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  versionText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    opacity: 0.3,
  },

  // ─── Modal ───
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalCard: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#060410',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 28,
      },
      android: { elevation: 10 },
    }),
  },
  modalIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  modalBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
});
