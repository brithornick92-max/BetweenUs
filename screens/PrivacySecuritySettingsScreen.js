import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { storage, STORAGE_KEYS } from '../utils/storage';

const PrivacySecuritySettingsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { signOutLocal, signOutGlobal, busy } = useAuth();
  const { actions } = useAppContext();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
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
      showPaywall('vaultAndBiometric');
      return;
    }
    if (value && biometricsAvailable) {
      // Test biometric authentication
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable app lock',
        fallbackLabel: 'Use passcode',
      });

      if (result.success) {
        setAppLockEnabled(true);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Success);
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
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Success);
      }
    } else {
      setBiometricsEnabled(false);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const settings = {
        appLockEnabled,
        biometricsEnabled,
        autoLockTime,
        hidePreview,
      };

      await storage.set(STORAGE_KEYS.PRIVACY_SETTINGS, settings);

      // Also persist appLockEnabled to the key AppContext reads on boot
      await storage.set(STORAGE_KEYS.APP_LOCK_ENABLED, appLockEnabled);
      // Immediately update AppContext so the lock takes effect without restart
      if (actions?.setAppLockEnabled) {
        actions.setAppLockEnabled(appLockEnabled);
      }

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Success);
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

  const renderSettingRow = (title, description, value, onValueChange, disabled = false) => (
    <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary + '80' }}
        thumbColor={value ? colors.primary : '#f4f3f4'}
        ios_backgroundColor={colors.border}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Privacy & Security</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="shield-checkmark" size={48} color={colors.primary} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>Keep Your Data Safe</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Control how your personal information is protected
          </Text>

          {/* App Lock Section */}
          <View style={[styles.settingsCard, { backgroundColor: colors.card }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>App Lock</Text>
              {!isPremium && (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                  <Ionicons name="lock-closed" size={12} color={colors.primary} style={{ marginRight: 4 }} />
                  <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '600' }}>PREMIUM</Text>
                </View>
              )}
            </View>

            {renderSettingRow(
              'Enable App Lock',
              biometricsAvailable 
                ? `Require ${biometricType} to open the app`
                : 'Biometrics not available on this device',
              appLockEnabled,
              handleToggleAppLock,
              !biometricsAvailable
            )}

            {appLockEnabled && biometricsAvailable && renderSettingRow(
              `Use ${biometricType}`,
              `Unlock with ${biometricType} instead of passcode`,
              biometricsEnabled,
              handleToggleBiometrics
            )}

            {appLockEnabled && (
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => navigation.navigate('SetPin')}
                activeOpacity={0.7}
              >
                <View style={styles.actionInfo}>
                  <Text style={[styles.actionTitle, { color: colors.text }]}>
                    Set App Lock PIN
                  </Text>
                  <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
                    Optional fallback if biometrics aren’t available
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Privacy Section */}
          <View style={[styles.settingsCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Privacy</Text>

            {renderSettingRow(
              'Hide App Preview',
              'Blur app content when switching apps',
              hidePreview,
              (value) => {
                setHidePreview(value);
                Haptics.selectionAsync();
              }
            )}
          </View>

          {/* Privacy Info (accurate, trust-building copy) */}
          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <Ionicons name="lock-closed" size={24} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoTitle, { color: colors.text }]}>Your data is encrypted and private</Text>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Only you and your partner can see your shared space.{"\n\n"}
                All data is encrypted in transit (HTTPS/TLS) and at rest on our servers. Access is controlled by row-level security — even with a valid login, users can only see data from their own couple.{"\n\n"}
                Photos are stored in a private bucket. Viewing requires a short-lived signed URL that expires automatically.{"\n\n"}
                One shared space. Nothing public. Ever.
              </Text>
            </View>
          </View>

          {/* Session Security */}
          <View style={[styles.settingsCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Session Security</Text>

            <TouchableOpacity
              style={styles.actionRow}
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
                          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
                <Text style={[styles.actionTitle, { color: colors.text }]}>
                  Sign out (this device)
                </Text>
                <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
                  Keep other devices signed in
                </Text>
              </View>
              <Ionicons name="log-out-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => {
                Alert.alert(
                  'Sign Out Everywhere',
                  'This will sign you out of Between Us on ALL devices. Other sessions will be forced out when their access token expires.\n\nRecommended if you lost your phone or suspect unauthorized access.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Sign Out Everywhere',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
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
                <Text style={[styles.actionTitle, { color: colors.error || '#FF4444' }]}>
                  Sign out everywhere
                </Text>
                <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
                  Revokes all sessions on every device
                </Text>
              </View>
              <Ionicons name="shield-outline" size={20} color={colors.error || '#FF4444'} />
            </TouchableOpacity>
          </View>

          {/* New Phone / Lost Phone Info */}
          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <Ionicons name="phone-portrait-outline" size={24} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoTitle, { color: colors.text }]}>New phone?</Text>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Just sign in with your email and password to restore your shared space — your couple link, calendar events, shared moments, and premium access will all be there.
              </Text>
            </View>
          </View>

          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <Ionicons name="warning-outline" size={24} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoTitle, { color: colors.text }]}>Lost your phone?</Text>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Sign in on another device and use "Sign out everywhere" above to protect your account. All other sessions will be revoked.
              </Text>
            </View>
          </View>

          {/* Partner Linking Info */}
          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <Ionicons name="heart-outline" size={24} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoTitle, { color: colors.text }]}>Partner Linking</Text>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Invite-only. Temporary code. Only your partner can join.{"\n\n"}
                Codes expire in 15 minutes, are single-use, and are never stored in plain text. Your couple container is created securely on the server and survives new phones automatically.
              </Text>
            </View>
          </View>

          {/* Data Management */}
          <View style={[styles.settingsCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Data Management</Text>

            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => navigation.navigate('ExportData')}
              activeOpacity={0.7}
            >
              <View style={styles.actionInfo}>
                <Text style={[styles.actionTitle, { color: colors.text }]}>
                  Export My Data
                </Text>
                <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
                  Download all your journal entries
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => navigation.navigate('DeleteAccount')}
              activeOpacity={0.7}
            >
              <View style={styles.actionInfo}>
                <Text style={[styles.actionTitle, { color: colors.error }]}>
                  Delete Account
                </Text>
                <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
                  Permanently delete your account and data
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={[styles.saveButtonText, { color: '#FFFFFF' }]}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  settingsCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    gap: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PrivacySecuritySettingsScreen;
