// screens/PrivacySecuritySettingsScreen.js
// Velvet Glass & Apple Editorial High-End Updates Integrated.
// Palette: Deep Crimson, Obsidian, Liquid Silver (Strictly No Gold).

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Platform,
  StatusBar,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Icon from '../components/Icon';
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { PremiumFeature } from '../utils/featureFlags';
import { storage, STORAGE_KEYS } from '../utils/storage';

const { width: SCREEN_W } = Dimensions.get('window');
const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });

const PrivacySecuritySettingsScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const { signOutLocal, signOutGlobal, busy } = useAuth();
  const { actions } = useAppContext();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  
  // High-End Color Logic (No Gold)
  const theme = useMemo(() => ({
    crimson: '#D2121A',
    silver: isDark ? '#E5E5E7' : '#8E8E93',
    obsidian: '#0A0A0C',
    glass: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
    glassBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
  }), [isDark]);

  const styles = useMemo(() => createStyles(colors, isDark, theme), [colors, isDark, theme]);

  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('');
  const [autoLockTime, setAutoLockTime] = useState(5); // minutes
  const [hidePreview, setHidePreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    checkBiometrics();
    loadSettings();
  }, []);

  const checkBiometrics = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const available = compatible && enrolled;
      
      setBiometricsAvailable(available);

      if (available) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('Face ID');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('Touch ID');
        } else {
          setBiometricType('Biometrics');
        }
      }
    } catch (error) {
      console.error('Failed to check biometrics:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const settings = await storage.get(STORAGE_KEYS.PRIVACY_SETTINGS, {});
      if (settings) {
        setAppLockEnabled(settings.appLockEnabled ?? false);
        setBiometricsEnabled(settings.biometricsEnabled ?? false);
        setAutoLockTime(settings.autoLockTime ?? 5);
        setHidePreview(settings.hidePreview ?? false);
      }
    } catch (error) {
      console.error('Failed to load privacy settings:', error);
    }
  };

  const handleToggleAppLock = async (value) => {
    if (value && !isPremium) {
      showPaywall(PremiumFeature.VAULT_AND_BIOMETRIC);
      return;
    }
    if (value && biometricsAvailable) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable app lock',
        fallbackLabel: 'Use passcode',
      });

      if (result.success) {
        setAppLockEnabled(true);
        impact(ImpactFeedbackStyle.Success);
      } else {
        Alert.alert('Authentication Failed', 'Please try again.');
      }
    } else if (value && !biometricsAvailable) {
      Alert.alert(
        'Biometrics Not Available',
        'Please set up Face ID or Touch ID in your device settings to use app lock.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => LocalAuthentication.openSettingsAsync?.() },
        ]
      );
    } else {
      setAppLockEnabled(false);
      setBiometricsEnabled(false);
      impact(ImpactFeedbackStyle.Light);
    }
  };

  const handleToggleBiometrics = async (value) => {
    if (value) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Authenticate with ${biometricType}`,
        fallbackLabel: 'Use passcode',
      });

      if (result.success) {
        setBiometricsEnabled(true);
        impact(ImpactFeedbackStyle.Success);
      }
    } else {
      setBiometricsEnabled(false);
      impact(ImpactFeedbackStyle.Light);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      impact(ImpactFeedbackStyle.Medium);

      const settings = {
        appLockEnabled,
        biometricsEnabled,
        autoLockTime,
        hidePreview,
      };

      await storage.set(STORAGE_KEYS.PRIVACY_SETTINGS, settings);
      await storage.set(STORAGE_KEYS.APP_LOCK_ENABLED, appLockEnabled);
      
      if (actions?.setAppLockEnabled) {
        actions.setAppLockEnabled(appLockEnabled);
      }

      impact(ImpactFeedbackStyle.Success);
      Alert.alert('Success', 'Privacy settings updated!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Failed to save privacy settings:', error);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderSettingRow = (title, description, value, onValueChange, disabled = false, isLast = false) => (
    <View style={[styles.settingRow, !isLast && { borderBottomColor: theme.glassBorder }]}>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.settingDescription, { color: colors.textMuted || 'gray' }]}>
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: theme.glassBorder, true: theme.crimson + '80' }}
        thumbColor={value ? theme.crimson : (isDark ? '#E5E5E7' : '#FFFFFF')}
        ios_backgroundColor={theme.glassBorder}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
      <LinearGradient
        colors={isDark ? [theme.obsidian, '#1A0205', theme.obsidian] : ['#FFFFFF', '#F9F4F4', '#FFFFFF']}
        style={StyleSheet.absoluteFillObject}
      />
      <GlowOrb color={theme.crimson} size={400} top={-100} left={SCREEN_W - 250} opacity={0.08} />
      <GlowOrb color={theme.silver} size={300} top={600} left={-100} opacity={isDark ? 0.04 : 0.08} />
      <FilmGrain opacity={0.035} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Navigation */}
        <View style={styles.navHeader}>
          <TouchableOpacity
            onPress={() => { selection(); navigation.goBack(); }}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Icon name="chevron-back" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* Editorial Header Block */}
          <Animated.View entering={FadeIn.duration(800)} style={styles.introSection}>
            <View style={styles.iconContainer}>
              <Icon name="shield-checkmark" size={42} color={theme.crimson} />
            </View>
            <Text style={[styles.headerEye, { color: theme.crimson }]}>DATA PROTECTION</Text>
            <Text style={[styles.title, { color: colors.text }]}>Privacy & Security</Text>
            <Text style={[styles.intro, { color: colors.textMuted }]}>
              Control how your personal information is protected and who has access to your sanctuary.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(800)}>
            {/* App Lock Section (Velvet Glass Card) */}
            <BlurView intensity={isDark ? 30 : 50} tint={isDark ? "dark" : "light"} style={[styles.settingsCard, { borderColor: theme.glassBorder }]}>
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Vault Lock</Text>
                {!isPremium && (
                  <View style={[styles.premiumBadge, { backgroundColor: theme.crimson + '15' }]}>
                    <Icon name="lock-closed" size={10} color={theme.crimson} style={{ marginRight: 4 }} />
                    <Text style={[styles.premiumBadgeText, { color: theme.crimson }]}>PREMIUM</Text>
                  </View>
                )}
              </View>

              {renderSettingRow(
                'Enable Vault Lock',
                biometricsAvailable 
                  ? `Require ${biometricType} to open the app`
                  : 'Biometrics not available on this device',
                appLockEnabled,
                handleToggleAppLock,
                !biometricsAvailable,
                !(appLockEnabled && biometricsAvailable) && !appLockEnabled
              )}

              {appLockEnabled && biometricsAvailable && renderSettingRow(
                `Use ${biometricType}`,
                `Unlock with ${biometricType} instead of passcode`,
                biometricsEnabled,
                handleToggleBiometrics,
                false,
                !appLockEnabled
              )}

              {appLockEnabled && (
                <TouchableOpacity
                  style={[styles.actionRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.glassBorder }]}
                  onPress={() => navigation.navigate('SetPin')}
                  activeOpacity={0.7}
                >
                  <View style={styles.actionInfo}>
                    <Text style={[styles.actionTitle, { color: colors.text }]}>Set Fallback PIN</Text>
                    <Text style={[styles.actionDescription, { color: colors.textMuted || 'gray' }]}>Optional backup if biometrics fail</Text>
                  </View>
                  <Icon name="chevron-forward" size={20} color={colors.textMuted || 'gray'} />
                </TouchableOpacity>
              )}
            </BlurView>

            {/* Privacy Section */}
            <BlurView intensity={isDark ? 30 : 50} tint={isDark ? "dark" : "light"} style={[styles.settingsCard, { borderColor: theme.glassBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>App Switcher</Text>
              {renderSettingRow(
                'Hide App Preview',
                'Blur app content when switching between apps',
                hidePreview,
                (value) => { setHidePreview(value); selection(); },
                false,
                true
              )}
            </BlurView>

            {/* Session Security */}
            <BlurView intensity={isDark ? 30 : 50} tint={isDark ? "dark" : "light"} style={[styles.settingsCard, { borderColor: theme.glassBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Session Security</Text>

              <TouchableOpacity
                style={[styles.actionRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.glassBorder }]}
                onPress={() => {
                  Alert.alert(
                    'Sign Out This Device',
                    'This will sign you out of Between Us on this device only. Your other devices will stay logged in.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Sign Out',
                        onPress: async () => {
                          try {
                            impact(ImpactFeedbackStyle.Medium);
                            await signOutLocal();
                          } catch (error) {
                            Alert.alert('Error', 'Failed to sign out. Please try again.');
                          }
                        },
                      },
                    ]
                  );
                }}
                disabled={busy}
                activeOpacity={0.7}
              >
                <View style={styles.actionInfo}>
                  <Text style={[styles.actionTitle, { color: colors.text }]}>Sign Out (This Device)</Text>
                  <Text style={[styles.actionDescription, { color: colors.textMuted || 'gray' }]}>Keep other devices signed in</Text>
                </View>
                <Icon name="log-out-outline" size={20} color={colors.textMuted || 'gray'} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  Alert.alert(
                    'Sign Out Everywhere',
                    'This will sign you out of Between Us on ALL devices. Other sessions will be forced out when their access token expires.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Sign Out Everywhere',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            notification(NotificationFeedbackType.Warning);
                            await signOutGlobal();
                          } catch (error) {
                            Alert.alert('Error', 'Failed to sign out. Please try again.');
                          }
                        },
                      },
                    ]
                  );
                }}
                disabled={busy}
                activeOpacity={0.7}
              >
                <View style={styles.actionInfo}>
                  <Text style={[styles.actionTitle, { color: theme.crimson }]}>Revoke All Sessions</Text>
                  <Text style={[styles.actionDescription, { color: colors.textMuted || 'gray' }]}>Sign out everywhere immediately</Text>
                </View>
                <Icon name="shield-outline" size={20} color={theme.crimson} />
              </TouchableOpacity>
            </BlurView>

            {/* Information Cards (Velvet Layout) */}
            <View style={styles.infoGroup}>
              <View style={[styles.infoCard, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}>
                <View style={[styles.infoIconWrap, { backgroundColor: theme.crimson + '15' }]}>
                  <Icon name="lock-closed" size={20} color={theme.crimson} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={[styles.infoTitle, { color: colors.text }]}>End-to-End Encryption</Text>
                  <Text style={[styles.infoText, { color: colors.textMuted || 'gray' }]}>
                    Synced data is encrypted in transit and protected at rest. Sensitive shared content is encrypted before sync. One shared space. Nothing public. Ever.
                  </Text>
                </View>
              </View>

              <View style={[styles.infoCard, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}>
                <View style={[styles.infoIconWrap, { backgroundColor: theme.silver + '20' }]}>
                  <Icon name="phone-portrait-outline" size={20} color={colors.text} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={[styles.infoTitle, { color: colors.text }]}>Device Continuity</Text>
                  <Text style={[styles.infoText, { color: colors.textMuted || 'gray' }]}>
                    Sign in on a new device to automatically restore your account, couple link, and cloud-synced shared data.
                  </Text>
                </View>
              </View>
            </View>

            {/* Data Management */}
            <BlurView intensity={isDark ? 30 : 50} tint={isDark ? "dark" : "light"} style={[styles.settingsCard, { borderColor: theme.glassBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Data Management</Text>

              <TouchableOpacity
                style={[styles.actionRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.glassBorder }]}
                onPress={() => navigation.navigate('ExportData')}
                activeOpacity={0.7}
              >
                <View style={styles.actionInfo}>
                  <Text style={[styles.actionTitle, { color: colors.text }]}>Export My Data</Text>
                  <Text style={[styles.actionDescription, { color: colors.textMuted || 'gray' }]}>Download all your journal entries</Text>
                </View>
                <Icon name="download-outline" size={20} color={colors.textMuted || 'gray'} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => navigation.navigate('DeleteAccount')}
                activeOpacity={0.7}
              >
                <View style={styles.actionInfo}>
                  <Text style={[styles.actionTitle, { color: theme.crimson }]}>Delete Account</Text>
                  <Text style={[styles.actionDescription, { color: colors.textMuted || 'gray' }]}>Permanently delete your account and data</Text>
                </View>
                <Icon name="trash-outline" size={20} color={theme.crimson} />
              </TouchableOpacity>
            </BlurView>
          </Animated.View>

          <View style={{ height: 120 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Floating Save Button */}
      <BlurView intensity={isDark ? 40 : 60} tint={isDark ? "dark" : "light"} style={[styles.bottomBar, { borderColor: theme.glassBorder }]}>
        <TouchableOpacity 
          style={styles.saveBtn} 
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.9}
        >
          <LinearGradient colors={[theme.crimson, '#900C0F']} style={styles.saveBtnGrad}>
            {isSaving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.saveBtnText}>Save Configuration</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </BlurView>
    </View>
  );
};

const createStyles = (colors, isDark, theme) => StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  
  navHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  backButton: { 
    width: 44, 
    height: 44, 
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: theme.glass,
  },

  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16 },

  introSection: { marginBottom: 32 },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: theme.crimson + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  headerEye: {
    fontFamily: Platform.select({ ios: 'Lato-Bold', android: 'Lato_700Bold' }),
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontFamily: SYSTEM_FONT,
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1.5,
    marginBottom: 12,
  },
  intro: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    opacity: 0.8,
  },

  settingsCard: {
    borderRadius: 28,
    borderWidth: 1.5,
    padding: 24,
    marginBottom: 20,
    overflow: 'hidden',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingInfo: { flex: 1, paddingRight: 20 },
  settingTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  settingDescription: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
  },
  actionInfo: { flex: 1, paddingRight: 20 },
  actionTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  actionDescription: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },

  infoGroup: { gap: 12, marginBottom: 20 },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1.5,
    gap: 16,
  },
  infoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: { flex: 1 },
  infoTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  infoText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingHorizontal: 24,
    borderTopWidth: 1.5,
  },
  saveBtn: {
    height: 60,
    borderRadius: 22,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: theme.crimson, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  saveBtnGrad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontFamily: SYSTEM_FONT,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
});

export default PrivacySecuritySettingsScreen;
