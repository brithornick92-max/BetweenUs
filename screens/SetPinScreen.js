/**
 * SetPinScreen — Device passcode handoff
 *
 * Between Us uses the operating system app-lock prompt. We do not store a
 * separate local PIN secret, so this screen only routes users to device settings.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import Icon from '../components/Icon';
import { impact, ImpactFeedbackStyle } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import { withAlpha } from '../utils/theme';
import EditorialScreenScaffold from '../components/EditorialScreenScaffold';

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

const SetPinScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();

  const t = useMemo(() => ({
    surface: isDark ? '#131016' : '#FFFFFF',
    primary: colors.primary || '#D2121A',
    text: colors.text,
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t), [t]);

  const openDeviceSettings = () => {
    impact(ImpactFeedbackStyle.Medium);
    LocalAuthentication.openSettingsAsync?.();
  };

  return (
    <EditorialScreenScaffold
      navigation={navigation}
      headerTitle="Device Passcode"
      scroll={false}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.infoCard, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: withAlpha(t.primary, 0.12) }]}>
            <Icon name="lock-closed-outline" size={34} color={t.primary} />
          </View>
          <Text style={[styles.title, { color: t.text }]}>Use your device lock</Text>
          <Text style={[styles.body, { color: t.subtext }]}>
            Between Us unlocks with the passcode, Face ID, or Touch ID already configured on this device.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: t.primary }]}
          onPress={openDeviceSettings}
          activeOpacity={0.9}
        >
          <Icon name="settings-outline" size={20} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Open Device Settings</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={[styles.secondaryButtonText, { color: t.subtext }]}>Back to Privacy Settings</Text>
        </TouchableOpacity>
      </ScrollView>
    </EditorialScreenScaffold>
  );
};

const createStyles = (t) => StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 60 },
  infoCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 24,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontFamily: SYSTEM_FONT,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '800',
  },
});

export default SetPinScreen;
