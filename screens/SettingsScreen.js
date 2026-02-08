import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useContent } from '../context/ContentContext';
import { useTheme } from '../context/ThemeContext';
import { useAppContext } from '../context/AppContext';
import { TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../utils/theme';
import { cloudSyncStorage, STORAGE_KEYS, storage } from '../utils/storage';
import SupabaseAuthService from '../services/supabase/SupabaseAuthService';
import CoupleKeyService from '../services/security/CoupleKeyService';

export default function SettingsScreen({ navigation }) {
  const { user, userProfile, signOut } = useAuth();
  const { isPremiumEffective: isPremium, premiumSource } = useEntitlements();
  const { theme, themeMode, setTheme } = useTheme();
  const { state } = useAppContext();
  const { getRelationshipDurationText, updateRelationshipStartDate } = useContent();
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ enabled: false });
  const [syncEmail, setSyncEmail] = useState(null);
  const [paired, setPaired] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [lastSyncError, setLastSyncError] = useState(null);
  const [premiumUsage, setPremiumUsage] = useState(null);
  const [selectedDate, setSelectedDate] = useState(
    userProfile?.relationshipStartDate ? new Date(userProfile.relationshipStartDate) : new Date()
  );

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
      const coupleId = await storage.get(STORAGE_KEYS.COUPLE_ID);
      if (coupleId) {
        const key = await CoupleKeyService.getCoupleKey(coupleId);
        setPaired(!!key);
      } else {
        setPaired(false);
      }
    } catch (error) {
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
      return () => {
        active = false;
      };
    }

    const load = async () => {
      if (!active) return;
      await refreshSyncStatus();
    };

    load();
    const unsubscribe = navigation.addListener('focus', load);

    return () => {
      active = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [isPremium, navigation, refreshSyncStatus]);

  useEffect(() => {
    let active = true;
    if (!__DEV__) return () => {};

    const loadUsage = async () => {
      try {
        const { premiumGatekeeper } = await import('../utils/premiumFeatures');
        const stats = await premiumGatekeeper.getFeatureUsageStats();
        if (active) setPremiumUsage(stats);
      } catch {
        if (active) setPremiumUsage(null);
      }
    };

    loadUsage();
    return () => {
      active = false;
    };
  }, []);

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  const handleThemeChange = async (newTheme) => {
    await Haptics.selectionAsync();
    await setTheme(newTheme);
  };

  const handleDateChange = (event, date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (date) {
      setSelectedDate(date);
      handleSaveRelationshipDate(date);
    }
  };

  const handleSaveRelationshipDate = async (date) => {
    try {
      await updateRelationshipStartDate(date.toISOString());
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Success);
      Alert.alert('Success', 'Relationship start date updated successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update relationship date. Please try again.');
    }
  };

  const showDatePickerModal = () => {
    setShowDatePicker(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderSettingItem = ({ icon, title, subtitle, onPress, rightElement, disabled = false }) => (
    <TouchableOpacity
      style={[styles.settingItem, disabled && styles.disabledItem]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <View style={styles.settingLeft}>
        <View style={[styles.settingIcon, { backgroundColor: theme.colors.blushRose + '20' }]}>
          <MaterialCommunityIcons name={icon} size={24} color={theme.colors.blushRose} />
        </View>
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      {rightElement || (
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color={theme.colors.textSecondary}
        />
      )}
    </TouchableOpacity>
  );

  const renderThemeOption = (mode, label, icon) => (
    <TouchableOpacity
      key={mode}
      style={[
        styles.themeOption,
        {
          backgroundColor: themeMode === mode ? theme.colors.blushRose + '20' : 'transparent',
          borderColor: themeMode === mode ? theme.colors.blushRose : theme.colors.border,
        },
      ]}
      onPress={() => handleThemeChange(mode)}
      activeOpacity={0.8}
    >
      <MaterialCommunityIcons
        name={icon}
        size={24}
        color={themeMode === mode ? theme.colors.blushRose : theme.colors.textSecondary}
      />
      <Text
        style={[
          styles.themeLabel,
          {
            color: themeMode === mode ? theme.colors.blushRose : theme.colors.text,
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <LinearGradient
        colors={theme.gradients.secondary}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={theme.colors.text}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Settings</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Debug Section (Development Only) */}
          {__DEV__ && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.warning }]}>
                🔧 Developer Tools
              </Text>
              <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
                {renderSettingItem({
                  icon: 'bug',
                  title: 'RevenueCat Debug',
                  subtitle: 'Check entitlement keys & configuration',
                  onPress: () => navigation.navigate('RevenueCatDebug'),
                  rightElement: (
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color={theme.colors.textSecondary}
                    />
                  ),
                })}

                <View style={styles.statusRow}>
                  <Text style={[styles.statusLabel, { color: theme.colors.textSecondary }]}>
                    Premium usage
                  </Text>
                  <Text style={[styles.statusValue, { color: theme.colors.text }]}>
                    {premiumUsage?.totalFeatureAccess ?? 0}
                  </Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={[styles.statusLabel, { color: theme.colors.textSecondary }]}>
                    Most used
                  </Text>
                  <Text style={[styles.statusValue, { color: theme.colors.text }]}>
                    {premiumUsage?.mostUsedFeature || '—'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Profile Section */}
          <View style={styles.section}>
            <View style={[styles.profileCard, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.profileInfo}>
                <View style={[styles.profileAvatar, { backgroundColor: theme.colors.blushRose }]}>
                  <Text style={styles.profileInitial}>
                    {userProfile?.displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                  </Text>
                </View>
                <View style={styles.profileText}>
                  <Text style={[styles.profileName, { color: theme.colors.text }]}>
                    {userProfile?.displayName || 'User'}
                  </Text>
                  <Text style={[styles.profileEmail, { color: theme.colors.textSecondary }]}>
                    {user?.email}
                  </Text>
                  {isPremium && (
                    <View style={styles.premiumBadge}>
                      <MaterialCommunityIcons name="crown" size={16} color="#0B0B0B" />
                      <Text style={styles.premiumText}>Premium</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Relationship Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Relationship</Text>
            <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
              {renderSettingItem({
                icon: 'calendar-heart',
                title: 'Anniversary Date',
                subtitle: getRelationshipDurationText(),
                onPress: showDatePickerModal,
                rightElement: (
                  <MaterialCommunityIcons
                    name="calendar-edit"
                    size={20}
                    color={theme.colors.blushRose}
                  />
                ),
              })}

              {renderSettingItem({
                icon: 'account-edit',
                title: 'Partner Names',
                subtitle: 'Customize how you see each other',
                onPress: () => navigation.navigate('PartnerNamesSettings'),
              })}

              {renderSettingItem({
                icon: 'fire',
                title: 'Heat Level Preferences',
                subtitle: 'Choose your comfort level',
                onPress: () => navigation.navigate('HeatLevelSettings'),
              })}
              
              <Text style={[styles.relationshipNote, { color: theme.colors.textSecondary }]}>
                Setting your anniversary helps us personalize prompts for your relationship stage
              </Text>
            </View>
          </View>

          {/* Theme Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Appearance</Text>
            <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                Choose your preferred theme
              </Text>
              <View style={styles.themeOptions}>
                {renderThemeOption('light', 'Light', 'white-balance-sunny')}
                {renderThemeOption('dark', 'Dark', 'moon-waning-crescent')}
                {renderThemeOption('system', 'System', 'cellphone')}
              </View>
            </View>
          </View>

          {/* Premium Section */}
          {!isPremium && (
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.premiumCTA}
                onPress={() => navigation.navigate('Paywall')}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={['#D4AF37', '#F7E7CE']}
                  style={styles.premiumCTAGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <MaterialCommunityIcons name="crown" size={24} color="#0B0B0B" />
                  <Text style={styles.premiumCTAText}>Upgrade to Premium</Text>
                  <MaterialCommunityIcons name="arrow-right" size={20} color="#0B0B0B" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* Sync & Partner */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Sync & Partner</Text>
            <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.statusRow}>
                <Text style={[styles.statusLabel, { color: theme.colors.textSecondary }]}>Premium</Text>
                <Text style={[styles.statusValue, { color: theme.colors.text }]}>
                  {isPremium ? '✅' : '❌'}
                </Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={[styles.statusLabel, { color: theme.colors.textSecondary }]}>Signed in</Text>
                <Text style={[styles.statusValue, { color: theme.colors.text }]}>
                  {syncEmail ? `✅ ${syncEmail}` : '❌'}
                </Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={[styles.statusLabel, { color: theme.colors.textSecondary }]}>Sync enabled</Text>
                <Text style={[styles.statusValue, { color: theme.colors.text }]}>
                  {syncStatus?.enabled ? '✅' : '❌'}
                </Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={[styles.statusLabel, { color: theme.colors.textSecondary }]}>Partner linked</Text>
                <Text style={[styles.statusValue, { color: theme.colors.text }]}>
                  {paired ? '✅' : '❌'}
                </Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={[styles.statusLabel, { color: theme.colors.textSecondary }]}>Last sync</Text>
                <Text style={[styles.statusValue, { color: theme.colors.text }]}>
                  {lastSyncTime ? new Date(lastSyncTime).toLocaleString() : '—'}
                </Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={[styles.statusLabel, { color: theme.colors.textSecondary }]}>Last error</Text>
                <Text style={[styles.statusValue, { color: theme.colors.text }]}>
                  {lastSyncError || '—'}
                </Text>
              </View>

              {!isPremium && (
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: '#D4AF37' }]}
                  onPress={() => navigation.navigate('Paywall')}
                  activeOpacity={0.9}
                >
                  <Text style={styles.primaryButtonText}>Upgrade to Premium</Text>
                </TouchableOpacity>
              )}

              {isPremium && !syncEmail && (
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: '#D4AF37' }]}
                  onPress={() => navigation.navigate('SyncSetup')}
                  activeOpacity={0.9}
                >
                  <Text style={styles.primaryButtonText}>Sign in to enable sync</Text>
                </TouchableOpacity>
              )}

              {isPremium && syncEmail && syncStatus?.enabled && !paired && (
                <View style={styles.pairButtons}>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => navigation.navigate('PairingQRCode')}
                    activeOpacity={0.9}
                  >
                    <MaterialCommunityIcons name="qrcode" size={18} color={theme.colors.text} />
                    <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>
                      Show QR code
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => navigation.navigate('PairingScan')}
                    activeOpacity={0.9}
                  >
                    <MaterialCommunityIcons name="camera" size={18} color={theme.colors.text} />
                    <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>
                      Scan partner QR
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {isPremium && syncEmail && syncStatus?.enabled && paired && (
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => navigation.navigate('SyncSetup')}
                  activeOpacity={0.9}
                >
                  <MaterialCommunityIcons name="cloud-sync" size={18} color={theme.colors.text} />
                  <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>
                    View sync status
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Help & Support */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Help & Support</Text>
            <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
              {renderSettingItem({
                icon: 'help-circle',
                title: 'Help & FAQ',
                subtitle: 'Get answers to common questions',
                onPress: () => navigation.navigate('FAQ'),
              })}

              {renderSettingItem({
                icon: 'email',
                title: 'Contact Support',
                subtitle: 'brittanyapps@outlook.com',
                onPress: () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  Alert.alert(
                    'Contact Support',
                    'Email us at:\nbrittanyapps@outlook.com\n\nResponse time: 24-48 hours',
                    [
                      { text: 'OK', style: 'default' }
                    ]
                  );
                },
              })}
            </View>
          </View>

          {/* Legal & Privacy */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Legal & Privacy</Text>
            <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
              {renderSettingItem({
                icon: 'file-document',
                title: 'Terms of Service',
                subtitle: 'Read our terms and conditions',
                onPress: () => navigation.navigate('Terms'),
              })}

              {renderSettingItem({
                icon: 'shield-lock',
                title: 'Privacy Policy',
                subtitle: 'How we protect your data',
                onPress: () => navigation.navigate('PrivacyPolicy'),
              })}
            </View>
          </View>

          {/* Account Management */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Account</Text>
            <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
              {renderSettingItem({
                icon: 'download',
                title: 'Export My Data',
                subtitle: 'Download all your journal entries',
                onPress: () => navigation.navigate('ExportData'),
              })}

              {renderSettingItem({
                icon: 'delete-forever',
                title: 'Delete Account',
                subtitle: 'Permanently delete your account and data',
                onPress: () => navigation.navigate('DeleteAccount'),
              })}
            </View>
          </View>

          {/* Settings Items */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>General</Text>
            <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
              {renderSettingItem({
                icon: 'bell',
                title: 'Notifications',
                subtitle: 'Manage notification preferences',
                onPress: () => navigation.navigate('NotificationSettings'),
              })}

              {renderSettingItem({
                icon: 'alarm',
                title: 'Ritual Reminders',
                subtitle: isPremium ? 'Schedule connection reminders' : 'Premium feature',
                onPress: () => {
                  if (!isPremium) {
                    navigation.navigate('Paywall');
                    return;
                  }
                  navigation.navigate('RitualReminders');
                },
              })}

              {renderSettingItem({
                icon: 'shield-check',
                title: 'Privacy & Security',
                subtitle: 'App lock, biometrics, data encryption',
                onPress: () => navigation.navigate('PrivacySecuritySettings'),
              })}

              {renderSettingItem({
                icon: 'information',
                title: 'About',
                subtitle: 'Version 1.0.0',
                onPress: () => {
                  Alert.alert('Between Us', 'Version 1.0.0\n\nBuilt with love for couples who are thriving.');
                },
              })}
            </View>
          </View>

          {/* Sign Out */}
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.signOutButton, { borderColor: theme.colors.error }]}
              onPress={handleSignOut}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="logout" size={20} color={theme.colors.error} />
              <Text style={[styles.signOutText, { color: theme.colors.error }]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        
        {/* Date Picker */}
        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            maximumDate={new Date()}
            minimumDate={new Date(1950, 0, 1)}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.h1,
    fontSize: 24,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h2,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: SPACING.md,
  },
  sectionSubtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    marginBottom: SPACING.lg,
  },
  sectionCard: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  statusLabel: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
  },
  statusValue: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0B0B0B',
    fontWeight: '700',
  },
  pairButtons: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
  },
  secondaryButtonText: {
    fontWeight: '600',
  },
  profileCard: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.lg,
  },
  profileInitial: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    ...TYPOGRAPHY.h2,
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  profileEmail: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    marginBottom: SPACING.sm,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D4AF37',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    alignSelf: 'flex-start',
  },
  premiumText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0B0B0B',
    marginLeft: 4,
  },
  themeOptions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
  },
  themeLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: SPACING.xs,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
  },
  disabledItem: {
    opacity: 0.5,
  },
  premiumCTA: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  premiumCTAGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  premiumCTAText: {
    color: '#0B0B0B',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '500',
  },
  relationshipNote: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
});
