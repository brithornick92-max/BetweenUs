import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Alert,
  TouchableOpacity,
  Linking,
  ScrollView,
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
  CONNECTION_REMINDER_TYPES,
  cancelConnectionReminders,
  formatConnectionReminderTime,
  normalizeConnectionReminderTime,
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

const TIME_HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const TIME_MINUTES = Array.from({ length: 60 }, (_, index) => index);
const TIME_PERIODS = ['AM', 'PM'];
const TIME_OPTION_HEIGHT = 40;

function getTimePickerParts(value) {
  const normalized = normalizeConnectionReminderTime(value);
  const [hourValue, minuteValue] = normalized.split(':').map(Number);
  return {
    hour: hourValue % 12 || 12,
    minute: minuteValue,
    period: hourValue >= 12 ? 'PM' : 'AM',
  };
}

function buildTimeValue({ hour, minute, period }) {
  let hour24 = Number(hour) % 12;
  if (period === 'PM') hour24 += 12;
  return `${String(hour24).padStart(2, '0')}:${String(Number(minute)).padStart(2, '0')}`;
}

function formatReminderSummary(reminder) {
  if (!reminder?.enabled) return 'Off';
  const frequency = CONNECTION_REMINDER_FREQUENCIES.find((item) => item.id === reminder.frequency)?.label || 'Weekly';
  const day = CONNECTION_REMINDER_DAY_OPTIONS.find((item) => item.id === reminder.dayOfWeek)?.label;
  const monthDay = CONNECTION_REMINDER_MONTH_DAY_OPTIONS.find((item) => item.id === reminder.dayOfMonth)?.label || `${reminder.dayOfMonth || 1}`;
  const time = formatConnectionReminderTime(reminder.time);

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

function TimePickerColumn({ values, selectedValue, onSelect, disabled, t, accentColor, styles, formatLabel }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    const index = values.findIndex((value) => value === selectedValue);
    if (index < 0) return;

    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, (index - 1) * TIME_OPTION_HEIGHT),
        animated: false,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [selectedValue, values]);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.timeColumn}
      contentContainerStyle={styles.timeColumnContent}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      {values.map((value) => {
        const active = selectedValue === value;
        return (
          <TouchableOpacity
            key={value}
            activeOpacity={0.78}
            onPress={() => onSelect(value)}
            disabled={disabled}
            style={[
              styles.timeOption,
              {
                backgroundColor: active ? withAlpha(accentColor, 0.14) : 'transparent',
                borderColor: active ? withAlpha(accentColor, 0.36) : 'transparent',
              },
            ]}
          >
            <Text style={[styles.timeOptionText, { color: active ? accentColor : t.text }]}>
              {formatLabel(value)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function ExactTimePicker({ value, onChange, disabled, t, accentColor, styles }) {
  const [expanded, setExpanded] = useState(false);
  const [draftTime, setDraftTime] = useState(() => normalizeConnectionReminderTime(value));
  const parts = getTimePickerParts(draftTime);

  useEffect(() => {
    if (!expanded) {
      setDraftTime(normalizeConnectionReminderTime(value));
    }
  }, [expanded, value]);

  const changePart = (patch) => {
    setDraftTime(buildTimeValue({ ...parts, ...patch }));
  };

  const openPicker = () => {
    if (disabled) return;
    setDraftTime(normalizeConnectionReminderTime(value));
    setExpanded(true);
    impact(ImpactFeedbackStyle.Light);
  };

  const saveTime = () => {
    const nextTime = normalizeConnectionReminderTime(draftTime);
    if (nextTime !== normalizeConnectionReminderTime(value)) {
      onChange(nextTime);
    } else {
      impact(ImpactFeedbackStyle.Light);
    }
    setExpanded(false);
  };

  return (
    <View style={[styles.timePicker, { backgroundColor: t.surfaceSecondary, borderColor: withAlpha(accentColor, 0.22) }]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={openPicker}
        disabled={disabled}
        style={styles.timePickerTrigger}
        accessibilityRole="button"
        accessibilityLabel={`Set reminder time, currently ${formatConnectionReminderTime(value)}`}
      >
        <View style={[styles.timePickerIcon, { backgroundColor: withAlpha(accentColor, 0.12) }]}>
          <Icon name="time-outline" size={16} color={accentColor} />
        </View>
        <Text style={[styles.timePickerLabel, { color: t.text }]}>Time</Text>
        <Text style={[styles.timePickerValue, { color: accentColor }]}>
          {formatConnectionReminderTime(value)}
        </Text>
        <Icon name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} color={t.subtext} />
      </TouchableOpacity>

      {expanded ? (
        <>
          <View style={styles.timeWheelRow}>
            <TimePickerColumn
              values={TIME_HOURS}
              selectedValue={parts.hour}
              onSelect={(hour) => changePart({ hour })}
              disabled={disabled}
              t={t}
              accentColor={accentColor}
              styles={styles}
              formatLabel={(hour) => String(hour)}
            />
            <TimePickerColumn
              values={TIME_MINUTES}
              selectedValue={parts.minute}
              onSelect={(minute) => changePart({ minute })}
              disabled={disabled}
              t={t}
              accentColor={accentColor}
              styles={styles}
              formatLabel={(minute) => String(minute).padStart(2, '0')}
            />
            <TimePickerColumn
              values={TIME_PERIODS}
              selectedValue={parts.period}
              onSelect={(period) => changePart({ period })}
              disabled={disabled}
              t={t}
              accentColor={accentColor}
              styles={styles}
              formatLabel={(period) => period}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.84}
            onPress={saveTime}
            style={[styles.timeDoneButton, { backgroundColor: accentColor }]}
            accessibilityRole="button"
            accessibilityLabel="Save reminder time"
          >
            <Icon name="checkmark-outline" size={18} color="#FFFFFF" />
            <Text style={styles.timeDoneText}>Done</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </View>
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

          <ExactTimePicker
            value={reminder.time}
            onChange={(time) => onChange(type, { time })}
            disabled={disabled}
            t={t}
            accentColor={accentColor}
            styles={styles}
          />
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
  timePicker: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  timePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: 44,
    paddingHorizontal: SPACING.xs,
  },
  timePickerIcon: {
    width: 28,
    height: 28,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePickerLabel: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  timePickerValue: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  timeWheelRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  timeColumn: {
    flex: 1,
    maxHeight: 148,
    borderRadius: BORDER_RADIUS.lg,
  },
  timeColumnContent: {
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  timeOption: {
    minHeight: 36,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeOptionText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  timeDoneButton: {
    minHeight: 44,
    borderRadius: BORDER_RADIUS.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  timeDoneText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
});

export default NotificationSettingsScreen;
