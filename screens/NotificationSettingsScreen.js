/**
 * NotificationSettingsScreen — Personal touch-point configuration
 * Sexy Red Intimacy & Apple Editorial Updates Integrated.
 * * High-fidelity control center for stay-in-sync notifications.
 * OK: Full original logic preserved.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Alert,
  Platform,
  TouchableOpacity,
} from 'react-native';
import Icon from '../components/Icon';
import { impact, ImpactFeedbackStyle } from '../utils/haptics';
import * as Notifications from 'expo-notifications';
import { useTheme } from '../context/ThemeContext';
import { settingsStorage } from '../utils/storage';
import PushNotificationService from '../services/PushNotificationService';
import { supabase } from '../config/supabase';
import { withAlpha } from '../utils/theme';
import EditorialScreenScaffold from '../components/EditorialScreenScaffold';

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

const NotificationSettingsScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();

  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    background: colors.background, 
    surface: isDark ? '#131016' : '#FFFFFF',
    surfaceSecondary: isDark ? '#1C1520' : '#F2F2F7',
    primary: colors.primary || '#D2121A', // Sexy Red
    text: colors.text,
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [testAlertSending, setTestAlertSending] = useState(false);

  useEffect(() => {
    loadNotificationState();
  }, []);

  const saveNotificationSettings = async (overrides = {}) => {
    const nextSettings = {
      notificationsEnabled,
      ...overrides,
    };
    await settingsStorage.setNotificationSettings(nextSettings);
    return nextSettings;
  };

  const loadNotificationState = async () => {
    try {
      const [settings, permissionState] = await Promise.all([
        settingsStorage.getNotificationSettings(),
        Notifications.getPermissionsAsync(),
      ]);

      const permissionGranted = permissionState?.status === 'granted';
      const masterEnabled = settings?.notificationsEnabled ?? permissionGranted;

      setNotificationsEnabled(permissionGranted && masterEnabled);
    } catch (error) {
      if (__DEV__) console.error('Failed to load notification settings:', error);
    }
  };

  const handleToggleNotifications = async (value) => {
    if (value) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        await PushNotificationService.initialize(supabase, { requestPermissions: false });
        setNotificationsEnabled(true);
        await saveNotificationSettings({ notificationsEnabled: true });
        impact(ImpactFeedbackStyle.Medium);
      } else {
        Alert.alert(
          'Permission Required',
          'Please enable notifications in your device settings if you want reminders and partner activity alerts on this device.',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Notifications.openSettingsAsync() },
          ]
        );
      }
    } else {
      await PushNotificationService.removeToken(supabase);
      await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
      setNotificationsEnabled(false);
      await saveNotificationSettings({ notificationsEnabled: false });
      impact(ImpactFeedbackStyle.Light);
    }
  };

  const handleSendTestAlert = async () => {
    if (testAlertSending) return;
    setTestAlertSending(true);

    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Notifications Off', 'Enable push notifications first, then send a test alert.');
        return;
      }

      await PushNotificationService.initialize(supabase, { requestPermissions: false });
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Between Us',
          body: 'Alerts are working on this device.',
          data: { route: 'home', type: 'test_alert' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes?.TIME_INTERVAL || 'timeInterval',
          seconds: 3,
          channelId: 'default',
        },
      });

      Alert.alert('Test Alert Scheduled', 'You should receive a notification on this phone in a few seconds.');
    } catch (error) {
      if (__DEV__) console.error('Failed to send test notification:', error);
      Alert.alert('Test Alert Failed', 'We could not schedule a test alert on this device.');
    } finally {
      setTestAlertSending(false);
    }
  };

  return (
    <EditorialScreenScaffold
      navigation={navigation}
      headerTitle="Communications"
      heroIcon="notifications-outline"
      heroTitle="Stay Connected"
      heroSubtitle="Turn partner notifications on or off for this device."
    >
        <View style={[styles.masterToggle, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: t.text }]}>Push Notifications</Text>
            <Text style={[styles.settingDescription, { color: t.subtext }]}>
              Allow reminders and partner activity alerts on this device.
            </Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleToggleNotifications}
            trackColor={{ false: t.border, true: t.primary }}
            ios_backgroundColor={t.border}
          />
        </View>

        <View style={[styles.infoCard, { backgroundColor: withAlpha(t.primary, 0.05), borderColor: withAlpha(t.primary, 0.2) }]}> 
          <Icon name="shield-checkmark-outline" size={20} color={t.primary} />
          <Text style={[styles.infoText, { color: t.subtext }]}> 
            This switch controls whether this device stays registered for partner alerts and reminders.
          </Text>
        </View>

        {!notificationsEnabled && (
          <View style={[styles.infoCard, { backgroundColor: withAlpha(t.primary, 0.05), borderColor: withAlpha(t.primary, 0.2) }]}>
            <Icon name="information-circle-outline" size={20} color={t.primary} />
            <Text style={[styles.infoText, { color: t.subtext }]}>
              Enable notifications above to manage reminders and partner activity alerts.
            </Text>
          </View>
        )}

        {notificationsEnabled && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSendTestAlert}
            disabled={testAlertSending}
            style={[
              styles.testButton,
              {
                backgroundColor: testAlertSending ? withAlpha(t.primary, 0.55) : t.primary,
              },
            ]}
          >
            <Icon name="notifications-outline" size={18} color="#FFFFFF" />
            <Text style={styles.testButtonText}>
              {testAlertSending ? 'Scheduling...' : 'Send Test Alert'}
            </Text>
          </TouchableOpacity>
        )}
    </EditorialScreenScaffold>
  );
};

const createStyles = (t, isDark) => StyleSheet.create({
  masterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    borderRadius: 24,
    marginBottom: 24,
    borderWidth: 1,
  },
  settingInfo: {
    flex: 1,
    marginRight: 24,
  },
  settingTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  settingDescription: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 32,
    gap: 12,
  },
  infoText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
    fontWeight: '500',
  },
  testButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
    marginBottom: 24,
  },
  testButtonText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  saveButton: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    marginBottom: 16,
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#D2121A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  saveButtonText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: -0.2,
  },
});

export default NotificationSettingsScreen;
