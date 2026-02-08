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
import * as Notifications from 'expo-notifications';
import { useTheme } from '../context/ThemeContext';
import { storage, STORAGE_KEYS } from '../utils/storage';

const NotificationSettingsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [dailyPromptReminder, setDailyPromptReminder] = useState(true);
  const [partnerActivity, setPartnerActivity] = useState(true);
  const [weeklyRecap, setWeeklyRecap] = useState(true);
  const [milestones, setMilestones] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
    checkNotificationPermissions();
  }, []);

  const checkNotificationPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setNotificationsEnabled(status === 'granted');
  };

  const loadSettings = async () => {
    try {
      const settings = await storage.get(STORAGE_KEYS.NOTIFICATION_SETTINGS);
      if (settings) {
        setDailyPromptReminder(settings.dailyPromptReminder ?? true);
        setPartnerActivity(settings.partnerActivity ?? true);
        setWeeklyRecap(settings.weeklyRecap ?? true);
        setMilestones(settings.milestones ?? true);
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  };

  const handleToggleNotifications = async (value) => {
    if (value) {
      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        setNotificationsEnabled(true);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Success);
      } else {
        Alert.alert(
          'Permission Denied',
          'Please enable notifications in your device settings to receive reminders.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Notifications.openSettingsAsync() },
          ]
        );
      }
    } else {
      setNotificationsEnabled(false);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const settings = {
        dailyPromptReminder,
        partnerActivity,
        weeklyRecap,
        milestones,
      };

      await storage.set(STORAGE_KEYS.NOTIFICATION_SETTINGS, settings);

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Success);
      Alert.alert('Success', 'Notification settings updated!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Failed to save notification settings:', error);
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
        disabled={disabled || !notificationsEnabled}
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="notifications" size={48} color={colors.primary} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>Stay Connected</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Choose which notifications you'd like to receive
          </Text>

          {/* Master Toggle */}
          <View style={[styles.masterToggle, { backgroundColor: colors.card }]}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>
                Enable Notifications
              </Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                Allow Between Us to send you notifications
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: colors.border, true: colors.primary + '80' }}
              thumbColor={notificationsEnabled ? colors.primary : '#f4f3f4'}
              ios_backgroundColor={colors.border}
            />
          </View>

          {/* Notification Types */}
          <View style={[styles.settingsCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Notification Types
            </Text>

            {renderSettingRow(
              'Daily Prompt Reminder',
              'Get reminded to answer your daily prompt',
              dailyPromptReminder,
              (value) => {
                setDailyPromptReminder(value);
                Haptics.selectionAsync();
              }
            )}

            {renderSettingRow(
              'Partner Activity',
              'Know when your partner answers a prompt',
              partnerActivity,
              (value) => {
                setPartnerActivity(value);
                Haptics.selectionAsync();
              }
            )}

            {renderSettingRow(
              'Weekly Recap',
              'Get a summary of your week together',
              weeklyRecap,
              (value) => {
                setWeeklyRecap(value);
                Haptics.selectionAsync();
              }
            )}

            {renderSettingRow(
              'Milestones & Celebrations',
              'Celebrate anniversaries and achievements',
              milestones,
              (value) => {
                setMilestones(value);
                Haptics.selectionAsync();
              }
            )}
          </View>

          {/* Info Card */}
          {!notificationsEnabled && (
            <View style={[styles.infoCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
              <Ionicons name="information-circle" size={20} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Enable notifications above to customize your notification preferences.
              </Text>
            </View>
          )}

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={styles.saveButtonText}>
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
  masterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
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
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
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

export default NotificationSettingsScreen;
