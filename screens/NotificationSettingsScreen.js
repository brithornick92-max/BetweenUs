/**
 * NotificationSettingsScreen — Personal touch-point configuration
 * Sexy Red Intimacy & Apple Editorial Updates Integrated.
 * * High-fidelity control center for stay-in-sync notifications.
 * ✅ Full original logic preserved.
 */

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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';
import * as Notifications from 'expo-notifications';
import { useTheme } from '../context/ThemeContext';
import { storage, STORAGE_KEYS } from '../utils/storage';
import { SPACING, withAlpha } from '../utils/theme';

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

  // Original State Logic
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
      const settings = await storage.get(STORAGE_KEYS.NOTIFICATION_SETTINGS, {});
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
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        setNotificationsEnabled(true);
        impact(ImpactFeedbackStyle.Medium);
      } else {
        Alert.alert(
          'Permission Required',
          'Please enable notifications in your device settings to stay connected with your partner.',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Notifications.openSettingsAsync() },
          ]
        );
      }
    } else {
      setNotificationsEnabled(false);
      impact(ImpactFeedbackStyle.Light);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      impact(ImpactFeedbackStyle.Medium);

      const settings = {
        dailyPromptReminder,
        partnerActivity,
        weeklyRecap,
        milestones,
      };

      await storage.set(STORAGE_KEYS.NOTIFICATION_SETTINGS, settings);
      impact(ImpactFeedbackStyle.Success);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Update Failed', 'We could not save your notification preferences.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderSettingRow = (title, description, value, onValueChange, isLast = false) => (
    <View style={[styles.settingRow, !isLast && { borderBottomColor: t.border, borderBottomWidth: 1 }]}>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingTitle, { color: t.text }]}>{title}</Text>
        <Text style={[styles.settingDescription, { color: t.subtext }]}>
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={!notificationsEnabled}
        trackColor={{ false: t.border, true: t.primary }}
        thumbColor={Platform.OS === 'ios' ? undefined : (value ? t.primary : '#F4F3F4')}
        ios_backgroundColor={t.border}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="chevron-back" size={28} color={t.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: t.text }]}>Communications</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.iconHero, { backgroundColor: withAlpha(t.primary, 0.1) }]}>
          <Icon name="notifications-outline" size={42} color={t.primary} />
        </View>

        <Text style={[styles.title, { color: t.text }]}>Stay Connected</Text>
        <Text style={[styles.subtitle, { color: t.subtext }]}>
          Choose the moments you want to be invited back into your shared space.
        </Text>

        <View style={[styles.masterToggle, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: t.text }]}>Push Notifications</Text>
            <Text style={[styles.settingDescription, { color: t.subtext }]}>
              Enable the bridge between you and your partner.
            </Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleToggleNotifications}
            trackColor={{ false: t.border, true: t.primary }}
            ios_backgroundColor={t.border}
          />
        </View>

        <View style={[styles.settingsCard, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.sectionTitle, { color: t.primary }]}>PREFERENCES</Text>

          {renderSettingRow(
            'Daily Reflections',
            'A gentle nudge for your daily shared prompt.',
            dailyPromptReminder,
            (v) => { setDailyPromptReminder(v); selection(); }
          )}

          {renderSettingRow(
            'Partner Activity',
            'Know the moment your partner shares a thought.',
            partnerActivity,
            (v) => { setPartnerActivity(v); selection(); }
          )}

          {renderSettingRow(
            'Weekly Highlights',
            'A curated summary of your connection growth.',
            weeklyRecap,
            (v) => { setWeeklyRecap(v); selection(); }
          )}

          {renderSettingRow(
            'Shared Milestones',
            'Celebrate anniversaries and new discoveries.',
            milestones,
            (v) => { setMilestones(v); selection(); },
            true
          )}
        </View>

        {!notificationsEnabled && (
          <View style={[styles.infoCard, { backgroundColor: withAlpha(t.primary, 0.05), borderColor: withAlpha(t.primary, 0.2) }]}>
            <Icon name="information-circle-outline" size={20} color={t.primary} />
            <Text style={[styles.infoText, { color: t.subtext }]}>
              Enable global notifications above to customize these intimate touchpoints.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: t.primary }]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.9}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[styles.saveButtonText, { color: "#FFFFFF" }]}>Apply Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const createStyles = (t, isDark) => StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
  },
  backButton: { width: 44, height: 44, justifyContent: 'center' },
  headerTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 42,
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 60 },
  iconHero: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontFamily: SYSTEM_FONT,
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  masterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
  },
  settingsCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
  },
  sectionTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
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
  saveButton: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
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
