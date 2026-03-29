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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { impact, ImpactFeedbackStyle } from '../utils/haptics';
import * as Notifications from 'expo-notifications';
import { useTheme } from '../context/ThemeContext';
import { storage, STORAGE_KEYS } from '../utils/storage';
import PushNotificationService from '../services/PushNotificationService';
import { supabase } from '../config/supabase';
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

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    loadNotificationState();
  }, []);

  const saveNotificationSettings = async (overrides = {}) => {
    const nextSettings = {
      notificationsEnabled,
      ...overrides,
    };
    await storage.set(STORAGE_KEYS.NOTIFICATION_SETTINGS, nextSettings);
    return nextSettings;
  };

  const loadNotificationState = async () => {
    try {
      const [settings, permissionState] = await Promise.all([
        storage.get(STORAGE_KEYS.NOTIFICATION_SETTINGS, {}),
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
          Turn partner notifications on or off for this device.
        </Text>

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
  container: { flex: 1 },
