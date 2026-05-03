import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Alert,
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
import { REMINDER_CATEGORY_COLORS } from '../config/constants';
import {
  BORDER_RADIUS,
  SPACING,
  SYSTEM_FONT,
  TYPOGRAPHY,
  getShadows,
  withAlpha,
} from '../utils/theme';
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

const REMINDER_ORDER = [
  CONNECTION_REMINDER_TYPES.PROMPT,
  CONNECTION_REMINDER_TYPES.DAILY_QUIZ,
  CONNECTION_REMINDER_TYPES.DATE_IDEA,
  CONNECTION_REMINDER_TYPES.INTIMACY,
  CONNECTION_REMINDER_TYPES.JOURNAL,
  CONNECTION_REMINDER_TYPES.MEMORY,
];

const REMINDER_ACCENT_COLORS = {
  [CONNECTION_REMINDER_TYPES.PROMPT]: REMINDER_CATEGORY_COLORS.prompt,
  [CONNECTION_REMINDER_TYPES.DAILY_QUIZ]: REMINDER_CATEGORY_COLORS.quiz,
  [CONNECTION_REMINDER_TYPES.DATE_IDEA]: REMINDER_CATEGORY_COLORS.date,
  [CONNECTION_REMINDER_TYPES.INTIMACY]: REMINDER_CATEGORY_COLORS.intimacy,
  [CONNECTION_REMINDER_TYPES.JOURNAL]: REMINDER_CATEGORY_COLORS.journal,
  [CONNECTION_REMINDER_TYPES.MEMORY]: REMINDER_CATEGORY_COLORS.memory,
};

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
          backgroundColor: active ? withAlpha(accentColor, 0.14) : t.surfaceSecondary,
          borderColor: active ? withAlpha(accentColor, 0.36) : t.border,
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
  const accentColor = REMINDER_ACCENT_COLORS[type] || t.primary;
  const active = !!reminder?.enabled;
  const showDayPicker = active && (reminder.frequency === 'weekly' || reminder.frequency === 'biweekly');
  const showMonthDayPicker = active && reminder.frequency === 'monthly';

  return (
    <View
      style={[
        styles.reminderCard,
        {
          borderColor: active ? withAlpha(accentColor, 0.34) : t.border,
          opacity: disabled ? 0.62 : 1,
        },
      ]}
    >
      <View style={styles.reminderHeader}>
        <View style={[styles.reminderIcon, { backgroundColor: withAlpha(accentColor, 0.12) }]}>
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
  const { colors } = useTheme();

  const t = useMemo(() => ({
    surface: colors.surface,
    surfaceSecondary: colors.surface2 || colors.surface,
    surfaceGlass: colors.surfaceGlass || colors.surface,
    primary: colors.primary,
    text: colors.text,
    subtext: colors.textMuted || colors.textSecondary,
    border: colors.borderGlass || colors.border,
  }), [colors]);

  const shadows = useMemo(() => getShadows(colors), [colors]);
  const styles = useMemo(() => createStyles(t, shadows), [t, shadows]);

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
      headerTitle="Reminders"
      headerSubtitle="PRIVATE NUDGES"
      screenAccentColor={t.primary}
      contentContainerStyle={styles.content}
    >
        <Text style={[styles.sectionTitle, styles.firstSectionTitle]}>DEVICE ALERTS</Text>
        <View style={styles.masterToggle}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: t.text }]}>Push Notifications</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleToggleNotifications}
            trackColor={{ false: t.border, true: t.primary }}
            ios_backgroundColor={t.border}
          />
        </View>

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

        <Text style={styles.sectionTitle}>CONNECTION REMINDERS</Text>

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

const createStyles = (t, shadows) => StyleSheet.create({
  content: {
    paddingTop: SPACING.sm,
  },
  sectionTitle: {
    ...TYPOGRAPHY.label,
    color: t.subtext,
    marginBottom: SPACING.md,
    marginTop: SPACING.section,
    paddingLeft: SPACING.xs,
  },
  firstSectionTitle: {
    marginTop: 0,
  },
  masterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xxl,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
    ...shadows.small,
  },
  settingInfo: {
    flex: 1,
    marginRight: SPACING.lg,
  },
  settingTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  testButton: {
    minHeight: 56,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  testButtonText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  reminderList: {
    gap: SPACING.md,
    marginBottom: SPACING.xxl,
  },
  reminderCard: {
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    backgroundColor: t.surface,
    padding: SPACING.lg,
    gap: SPACING.md,
    ...shadows.small,
  },
  reminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  reminderIcon: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderTitleBlock: {
    flex: 1,
    gap: SPACING.xs,
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
  reminderControls: {
    gap: SPACING.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    minHeight: 36,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
});

export default NotificationSettingsScreen;
