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
import CloseScreenHeader, { CLOSE_HEADER_STYLES } from '../components/CloseScreenHeader';
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { settingsStorage } from '../utils/storage';
import {
  APP_LOCK_MODES,
  buildAppLockAuthOptions,
  getBiometricLabel,
  isDeviceAuthAvailable,
  normalizeAppLockMode,
} from '../utils/appLockAuth';

const { width: SCREEN_W } = Dimensions.get('window');
const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });

const PrivacySecuritySettingsScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const { signOutLocal, signOutGlobal, busy } = useAuth();
  const { actions } = useAppContext();
  
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
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [deviceAuthAvailable, setDeviceAuthAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('');
  const [appLockMode, setAppLockMode] = useState(APP_LOCK_MODES.DEVICE);
  const [autoLockTime, setAutoLockTime] = useState(5); // minutes
  const [hidePreview, setHidePreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    checkBiometrics();
    loadSettings();
  }, []);

  const checkBiometrics = async () => {
    try {
      const [compatible, enrolled, enrolledLevel] = await Promise.all([
        LocalAuthentication.hasHardwareAsync().catch(() => false),
        LocalAuthentication.isEnrolledAsync().catch(() => false),
        LocalAuthentication.getEnrolledLevelAsync().catch(() => LocalAuthentication.SecurityLevel.NONE),
      ]);
      const available = compatible && enrolled;
      
      setBiometricsAvailable(available);
      setDeviceAuthAvailable(isDeviceAuthAvailable(enrolledLevel, LocalAuthentication, available));

      if (available) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        setBiometricType(getBiometricLabel(types, LocalAuthentication));
      }
    } catch (error) {
      if (__DEV__) console.error('Failed to check biometrics:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const settings = await settingsStorage.getPrivacySettings();
      if (settings) {
        setAppLockEnabled(settings.appLockEnabled ?? false);
        const nextMode = normalizeAppLockMode(settings.appLockMode || (settings.biometricsEnabled ? APP_LOCK_MODES.BIOMETRIC : APP_LOCK_MODES.DEVICE));
        setAppLockMode(nextMode);
        setAutoLockTime(settings.autoLockTime ?? 5);
        setHidePreview(settings.hidePreview ?? false);
      }
    } catch (error) {
      if (__DEV__) console.error('Failed to load privacy settings:', error);
    }
  };

  const handleToggleAppLock = async (value) => {
    if (value && deviceAuthAvailable) {
      const modeToUse = appLockMode === APP_LOCK_MODES.BIOMETRIC && !biometricsAvailable
        ? APP_LOCK_MODES.DEVICE
        : appLockMode;
      const result = await LocalAuthentication.authenticateAsync({
        ...buildAppLockAuthOptions({
          mode: modeToUse,
          promptMessage: 'Authenticate to enable app lock',
        }),
      });

      if (result.success) {
        setAppLockEnabled(true);
        setAppLockMode(modeToUse);
        notification(NotificationFeedbackType.Success);
      } else {
        Alert.alert('Authentication Failed', 'Please try again.');
      }
    } else if (value && !deviceAuthAvailable) {
      Alert.alert(
        'Device Lock Not Available',
        'Set up a device passcode, Face ID, or Touch ID in your device settings to use Vault Lock.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => LocalAuthentication.openSettingsAsync?.() },
        ]
      );
    } else {
      setAppLockEnabled(false);
      impact(ImpactFeedbackStyle.Light);
    }
  };

  const handleSelectLockMode = async (mode) => {
    const nextMode = normalizeAppLockMode(mode);
    if (nextMode === appLockMode) return;

    if (nextMode === APP_LOCK_MODES.BIOMETRIC && !biometricsAvailable) {
      Alert.alert(
        'Biometrics Not Available',
        'Set up Face ID or Touch ID in your device settings before choosing biometric-only unlock.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => LocalAuthentication.openSettingsAsync?.() },
        ]
      );
      return;
    }

    if (appLockEnabled) {
      const result = await LocalAuthentication.authenticateAsync({
        ...buildAppLockAuthOptions({
          mode: nextMode,
          promptMessage: nextMode === APP_LOCK_MODES.BIOMETRIC
            ? `Authenticate with ${biometricType || 'Biometrics'}`
            : 'Authenticate with device passcode or biometrics',
        }),
      });

      if (!result.success) {
        Alert.alert('Authentication Failed', 'Please try again.');
        return;
      }
    }

    setAppLockMode(nextMode);
    selection();
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      impact(ImpactFeedbackStyle.Medium);
      const savedLockMode = appLockMode === APP_LOCK_MODES.BIOMETRIC && !biometricsAvailable
        ? APP_LOCK_MODES.DEVICE
        : appLockMode;

      const settings = {
        appLockEnabled,
        biometricsEnabled: savedLockMode === APP_LOCK_MODES.BIOMETRIC,
        appLockMode: savedLockMode,
        autoLockTime,
        hidePreview,
      };

      await settingsStorage.setPrivacySettings(settings);
      await settingsStorage.setAppLockEnabled(appLockEnabled);
      
      if (actions?.setAppLockSettings) {
        await actions.setAppLockSettings({
          enabled: appLockEnabled,
          mode: savedLockMode,
          autoLockTime,
          hidePreview,
        });
      } else if (actions?.setAppLockEnabled) {
        actions.setAppLockEnabled(appLockEnabled);
      }

      notification(NotificationFeedbackType.Success);
      Alert.alert('Success', 'Privacy settings updated!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      if (__DEV__) console.error('Failed to save privacy settings:', error);
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
        accessibilityLabel={title}
        accessibilityState={{ checked: value, disabled }}
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
        <CloseScreenHeader
          title="Privacy & Security"
          subtitle="DATA PROTECTION"
          titleColor={colors.text}
          subtitleColor={colors.primary}
          closeColor={colors.text}
          onClose={() => { selection(); navigation.goBack(); }}
        />

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* Editorial Header Block */}
          <Animated.View entering={FadeIn.duration(800)} style={styles.introSection}>
            <View style={styles.iconContainer}>
              <Icon name="shield-checkmark" size={42} color={theme.crimson} />
            </View>
            <Text style={[styles.intro, { color: colors.textMuted }]}>
              Manage app lock, sessions, export, and deletion controls for your account.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(800)}>
            {/* App Lock Section (Velvet Glass Card) */}
            <BlurView intensity={isDark ? 30 : 50} tint={isDark ? "dark" : "light"} style={[styles.settingsCard, { borderColor: theme.glassBorder }]}>
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Vault Lock</Text>
              </View>

              {renderSettingRow(
                'Enable Vault Lock',
                deviceAuthAvailable
                  ? 'Require device authentication to open the app'
                  : 'Set up a device passcode, Face ID, or Touch ID first',
                appLockEnabled,
                handleToggleAppLock,
                !deviceAuthAvailable,
                !appLockEnabled
              )}

              {appLockEnabled && (
                <View style={[styles.modeGroup, { borderTopColor: theme.glassBorder }]}>
                  <Text style={[styles.modeLabel, { color: colors.textMuted || 'gray' }]}>UNLOCK METHOD</Text>
                  <View style={styles.modeButtons}>
                    <TouchableOpacity
                      style={[
                        styles.modeButton,
                        { borderColor: theme.glassBorder, backgroundColor: appLockMode === APP_LOCK_MODES.DEVICE ? theme.crimson + '18' : 'transparent' },
                      ]}
                      onPress={() => handleSelectLockMode(APP_LOCK_MODES.DEVICE)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityState={{ selected: appLockMode === APP_LOCK_MODES.DEVICE }}
                      accessibilityLabel={`Use passcode or ${biometricType || 'biometrics'} for Vault Lock`}
                    >
                      <Icon name="keypad-outline" size={18} color={appLockMode === APP_LOCK_MODES.DEVICE ? theme.crimson : colors.textMuted || 'gray'} />
                      <Text style={[styles.modeButtonText, { color: colors.text }]}>Passcode or {biometricType || 'Biometrics'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.modeButton,
                        { borderColor: theme.glassBorder, backgroundColor: appLockMode === APP_LOCK_MODES.BIOMETRIC ? theme.crimson + '18' : 'transparent', opacity: biometricsAvailable ? 1 : 0.45 },
                      ]}
                      onPress={() => handleSelectLockMode(APP_LOCK_MODES.BIOMETRIC)}
                      activeOpacity={0.85}
                      disabled={!biometricsAvailable}
                      accessibilityRole="button"
                      accessibilityState={{ selected: appLockMode === APP_LOCK_MODES.BIOMETRIC, disabled: !biometricsAvailable }}
                      accessibilityLabel={`Use ${biometricType || 'biometrics'} only for Vault Lock`}
                    >
                      <Icon name={biometricType === 'Face ID' ? 'face-recognition' : 'fingerprint'} size={18} color={appLockMode === APP_LOCK_MODES.BIOMETRIC ? theme.crimson : colors.textMuted || 'gray'} />
                      <Text style={[styles.modeButtonText, { color: colors.text }]}>{biometricType || 'Biometrics'} Only</Text>
                    </TouchableOpacity>
                  </View>
                </View>
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
                          } catch (_error) {
                            Alert.alert('Error', 'Failed to sign out. Please try again.');
                          }
                        },
                      },
                    ]
                  );
                }}
                disabled={busy}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Sign out this device"
                accessibilityState={{ disabled: busy }}
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
                          } catch (_error) {
                            Alert.alert('Error', 'Failed to sign out. Please try again.');
                          }
                        },
                      },
                    ]
                  );
                }}
                disabled={busy}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Revoke all sessions"
                accessibilityState={{ disabled: busy }}
              >
                <View style={styles.actionInfo}>
                  <Text style={[styles.actionTitle, { color: theme.crimson }]}>Revoke All Sessions</Text>
                  <Text style={[styles.actionDescription, { color: colors.textMuted || 'gray' }]}>Request sign-out on all sessions</Text>
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
                  <Text style={[styles.infoTitle, { color: colors.text }]}>Protected Sync</Text>
                  <Text style={[styles.infoText, { color: colors.textMuted || 'gray' }]}>
                    Synced data lives in one Supabase-backed space, with device cache used only for speed and offline recovery.
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
                    Sign in on a new device to restore account data and cloud-synced shared data after sync completes.
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
                accessibilityRole="button"
                accessibilityLabel="Export my data"
              >
                <View style={styles.actionInfo}>
                  <Text style={[styles.actionTitle, { color: colors.text }]}>Export My Data</Text>
                  <Text style={[styles.actionDescription, { color: colors.textMuted || 'gray' }]}>Export supported account data</Text>
                </View>
                <Icon name="download-outline" size={20} color={colors.textMuted || 'gray'} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => navigation.navigate('DeleteAccount')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Delete account"
              >
                <View style={styles.actionInfo}>
                  <Text style={[styles.actionTitle, { color: theme.crimson }]}>Delete Account</Text>
                  <Text style={[styles.actionDescription, { color: colors.textMuted || 'gray' }]}>Delete your account through the deletion flow</Text>
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
          accessibilityRole="button"
          accessibilityLabel="Save privacy configuration"
          accessibilityState={{ disabled: isSaving, busy: isSaving }}
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
  
  navHeader: CLOSE_HEADER_STYLES.header,
  backButton: CLOSE_HEADER_STYLES.closeButton,

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
    fontFamily: SYSTEM_FONT,
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
  modeGroup: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 18,
    marginTop: 2,
  },
  modeLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  modeButtons: {
    gap: 10,
  },
  modeButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modeButtonText: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.1,
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
