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
  Linking,
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
import {
  CONNECTION_REMINDER_DAY_OPTIONS,
  CONNECTION_REMINDER_FREQUENCIES,
  CONNECTION_REMINDER_MONTH_DAY_OPTIONS,
  CONNECTION_REMINDER_TEMPLATES,
  CONNECTION_REMINDER_TIME_PRESETS,
  CONNECTION_REMINDER_TYPES,
  cancelConnectionReminders,
  normalizeConnectionReminderSettings,
  scheduleConnectionReminders,
} from '../services/ConnectionReminderService';

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });
const REMINDER_ORDER = [
  CONNECTION_REMINDER_TYPES.PROMPT,
  CONNECTION_REMINDER_TYPES.DAILY_QUIZ,
  CONNECTION_REMINDER_TYPES.DATE_IDEA,
  CONNECTION_REMINDER_TYPES.INTIMACY,
  CONNECTION_REMINDER_TYPES.JOURNAL,
  CONNECTION_REMINDER_TYPES.MEMORY,
];

function formatTimeLabel(time) {
  return CONNECTION_REMINDER_TIME_PRESETS.find((item) => item.id === time)?.label || time;
}

function formatReminderSummary(reminder) {
  if (!reminder?.enabled) return 'Off';
  const frequency = CONNECTION_REMINDER_FREQUENCIES.find((item) => item.id === reminder.frequency)?.label || 'Weekly';
  const day = CONNECTION_REMINDER_DAY_OPTIONS.find((item) => item.id === reminder.dayOfWeek)?.label;
  const monthDay = CONNECTION_REMINDER_MONTH_DAY_OPTIONS.find((item) => item.id === reminder.dayOfMonth)?.label || `${reminder.dayOfMonth || 1}`;
  const time = formatTimeLabel(reminder.time);

  if (reminder.frequency === 'daily') return `${frequency} at ${time}`;
  if (reminder.frequency === 'monthly') return `${frequency} on the ${monthDay} at ${time}`;
  return `${frequency}${day ? ` on ${day}` : ''} at ${time}`;
}

function ReminderChip({ label, active, onPress, disabled, t, accentColor, styles }) {
  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.chip,
        {
          backgroundColor: active ? withAlpha(accentColor, 0.16) : t.surfaceSecondary,
          borderColor: active ? withAlpha(accentColor, 0.4) : t.border,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? accentColor : t.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ConnectionReminderCard({ type, reminder, disabled, t, styles, onChange }) {
  const template = CONNECTION_REMINDER_TEMPLATES[type];
  const accentColor = template.accentColor;
  const active = !!reminder?.enabled;
  const showDayPicker = active && (reminder.frequency === 'weekly' || reminder.frequency === 'biweekly');
  const showMonthDayPicker = active && reminder.frequency === 'monthly';

  return (
    <View
      style={[
        styles.reminderCard,
        {
          backgroundColor: t.surface,
          borderColor: active ? withAlpha(accentColor, 0.36) : t.border,
          opacity: disabled ? 0.62 : 1,
        },
      ]}
    >
      <View style={styles.reminderHeader}>
        <View style={[styles.reminderIcon, { backgroundColor: withAlpha(accentColor, 0.14) }]}>
          <Icon name={template.icon} size={22} color={accentColor} />
        </View>
        <View style={styles.reminderTitleBlock}>
          <Text style={[styles.reminderLabel, { color: t.text }]}>{template.label}</Text>
          <Text style={[styles.reminderSummary, { color: t.subtext }]}>{formatReminderSummary(reminder)}</Text>
        </View>
        <Switch
          value={active}
          onValueChange={(value) => onChange(type, { enabled: value })}
          disabled={disabled}
          trackColor={{ false: t.border, true: accentColor }}
          ios_backgroundColor={t.border}
        />
      </View>

      <View style={[styles.notificationPreview, { backgroundColor: withAlpha(accentColor, 0.07) }]}>
        <Text style={[styles.previewTitle, { color: t.text }]}>{template.title}</Text>
        <Text style={[styles.previewBody, { color: t.subtext }]}>{template.body}</Text>
      </View>

      {active ? (
        <View style={styles.reminderControls}>
          <View style={styles.chipRow}>
            {CONNECTION_REMINDER_FREQUENCIES.map((item) => (
              <ReminderChip
                key={item.id}
                label={item.label}
                active={reminder.frequency === item.id}
                onPress={() => onChange(type, { frequency: item.id })}
                disabled={disabled}
                t={t}
                accentColor={accentColor}
                styles={styles}
              />
            ))}
          </View>

          {showDayPicker ? (
            <View style={styles.chipRow}>
              {CONNECTION_REMINDER_DAY_OPTIONS.map((item) => (
                <ReminderChip
                  key={item.id}
                  label={item.label}
                  active={reminder.dayOfWeek === item.id}
                  onPress={() => onChange(type, { dayOfWeek: item.id })}
                  disabled={disabled}
                  t={t}
                  accentColor={accentColor}
                  styles={styles}
                />
              ))}
            </View>
          ) : null}

          {showMonthDayPicker ? (
            <View style={styles.chipRow}>
              {CONNECTION_REMINDER_MONTH_DAY_OPTIONS.map((item) => (
                <ReminderChip
                  key={item.id}
                  label={item.label}
                  active={reminder.dayOfMonth === item.id}
                  onPress={() => onChange(type, { dayOfMonth: item.id })}
                  disabled={disabled}
                  t={t}
                  accentColor={accentColor}
                  styles={styles}
                />
              ))}
            </View>
          ) : null}

          <View style={styles.chipRow}>
            {CONNECTION_REMINDER_TIME_PRESETS.map((item) => (
              <ReminderChip
                key={item.id}
                label={item.label}
                active={reminder.time === item.id}
                onPress={() => onChange(type, { time: item.id })}
                disabled={disabled}
                t={t}
                accentColor={accentColor}
                styles={styles}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

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
  const [notificationSettings, setNotificationSettings] = useState({});
  const [connectionReminders, setConnectionReminders] = useState(() => normalizeConnectionReminderSettings({}));

  useEffect(() => {
    loadNotificationState();
  }, []);

  const saveNotificationSettings = async (overrides = {}) => {
    const nextSettings = {
      ...(notificationSettings || {}),
      notificationsEnabled,
      connectionReminders,
      ...overrides,
    };
    await settingsStorage.setNotificationSettings(nextSettings);
    setNotificationSettings(nextSettings);
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

      setNotificationSettings(settings || {});
      setNotificationsEnabled(permissionGranted && masterEnabled);
      setConnectionReminders(normalizeConnectionReminderSettings(settings?.connectionReminders));
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
        await scheduleConnectionReminders();
        impact(ImpactFeedbackStyle.Medium);
      } else {
        Alert.alert(
          'Permission Required',
          'Please enable notifications in your device settings if you want reminders and partner activity alerts on this device.',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings?.() },
          ]
        );
      }
    } else {
      await PushNotificationService.removeToken(supabase);
      await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
      await cancelConnectionReminders();
      setNotificationsEnabled(false);
      await saveNotificationSettings({ notificationsEnabled: false });
      impact(ImpactFeedbackStyle.Light);
    }
  };

  const handleChangeReminder = async (type, patch) => {
    const nextReminders = normalizeConnectionReminderSettings({
      ...connectionReminders,
      [type]: {
        ...(connectionReminders?.[type] || {}),
        ...patch,
      },
    });

    setConnectionReminders(nextReminders);
    await saveNotificationSettings({ connectionReminders: nextReminders });

    if (notificationsEnabled) {
      await scheduleConnectionReminders();
    }
    impact(ImpactFeedbackStyle.Light);
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
      heroSubtitle="Choose the gentle reminders this device receives."
    >
        <View style={[styles.masterToggle, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: t.text }]}>Push Notifications</Text>
            <Text style={[styles.settingDescription, { color: t.subtext }]}>
              Allow partner activity alerts and connection reminders on this device.
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

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionLabel, { color: t.primary }]}>CONNECTION REMINDERS</Text>
          <Text style={[styles.sectionCopy, { color: t.subtext }]}>
            Warm, private nudges for prompts, dates, memories, and closeness.
          </Text>
        </View>

        <View style={styles.reminderList}>
          {REMINDER_ORDER.map((type) => (
            <ConnectionReminderCard
              key={type}
              type={type}
              reminder={connectionReminders[type]}
              disabled={!notificationsEnabled}
              t={t}
              styles={styles}
              onChange={handleChangeReminder}
            />
          ))}
        </View>
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
  sectionHeader: {
    marginTop: 8,
    marginBottom: 14,
  },
  sectionLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  sectionCopy: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  reminderList: {
    gap: 14,
    marginBottom: 28,
  },
  reminderCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  reminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reminderIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderTitleBlock: {
    flex: 1,
    gap: 4,
  },
  reminderLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  reminderSummary: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  notificationPreview: {
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  previewTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  previewBody: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  reminderControls: {
    gap: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 36,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
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
