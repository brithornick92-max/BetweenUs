/**
 * SetPinScreen — Privacy & Security configuration
 * Sexy Red Intimacy & Apple Editorial Updates Integrated.
 * * High-fidelity control center for application-level locking.
 * ✅ Full original logic preserved: SHA-256 hashing, SecureStore, & Async sanitization.
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Icon from '../components/Icon';
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';
import * as SecureStore from 'expo-secure-store';
import { generatePinSalt, hashPin, PIN_HASH_VERSION } from '../utils/pinHash';
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { PremiumFeature } from '../utils/featureFlags';
import { SPACING, withAlpha } from '../utils/theme';
import EditorialScreenScaffold from '../components/EditorialScreenScaffold';

const PIN_KEY = 'betweenus_app_lock_pin_v1';
const PIN_SALT_KEY = 'betweenus_app_lock_salt_v1';
const PIN_VERSION_KEY = 'betweenus_app_lock_pin_version';
const PIN_SERVICE = 'betweenus_app_lock';
const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

function sanitizePin(input) {
  return (input || '').replace(/[^\d]/g, '').slice(0, 4);
}

const SetPinScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();

  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    background: colors.background, 
    surface: isDark ? '#131016' : '#FFFFFF',
    surfaceSecondary: isDark ? '#1C1520' : '#F2F2F7',
    primary: colors.primary || '#D2121A', 
    text: colors.text,
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  const [pinRaw, setPinRaw] = useState('');
  const [confirmPinRaw, setConfirmPinRaw] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next = sanitizePin(pinRaw);
    if (next !== pin) setPin(next);
  }, [pinRaw, pin]);

  useEffect(() => {
    const next = sanitizePin(confirmPinRaw);
    if (next !== confirmPin) setConfirmPin(next);
  }, [confirmPinRaw, confirmPin]);

  const handleSave = async () => {
    if (pin.length !== 4 || confirmPin.length !== 4) {
      Alert.alert('Invalid Entry', 'Please enter a complete 4-digit PIN.');
      return;
    }
    if (pin !== confirmPin) {
      Alert.alert('Mismatch', 'The entered PINs do not match.');
      return;
    }

    try {
      setSaving(true);
      const salt = await generatePinSalt();
      const { hash } = hashPin(pin, salt);
      await SecureStore.setItemAsync(PIN_SALT_KEY, salt, { keychainService: PIN_SERVICE });
      await SecureStore.setItemAsync(PIN_KEY, hash, { keychainService: PIN_SERVICE });
      await SecureStore.setItemAsync(PIN_VERSION_KEY, String(PIN_HASH_VERSION), { keychainService: PIN_SERVICE });
      impact(ImpactFeedbackStyle.Medium);
      Alert.alert('Security Set', 'Your app lock is now active.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to secure your space. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    try {
      setSaving(true);
      await SecureStore.deleteItemAsync(PIN_KEY, { keychainService: PIN_SERVICE });
      await SecureStore.deleteItemAsync(PIN_SALT_KEY, { keychainService: PIN_SERVICE });
      await SecureStore.deleteItemAsync(PIN_VERSION_KEY, { keychainService: PIN_SERVICE });
      impact(ImpactFeedbackStyle.Light);
      Alert.alert('Lock Removed', 'Your app lock has been cleared.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to clear the security key.');
    } finally {
      setSaving(false);
    }
  };

  // ─── PREMIUM PAYWALL STATE ───
  if (!isPremium) {
    return (
      <EditorialScreenScaffold
        navigation={navigation}
        headerTitle="Vault Protection"
        heroIcon="lock-closed-outline"
        heroTitle="Secure Your World"
        heroSubtitle="App Lock is a pro security feature. Protect your intimacy with localized PIN and biometric authentication."
        scroll={false}
      >
        <View style={styles.paywallContent}>
          <TouchableOpacity
            onPress={() => showPaywall(PremiumFeature.VAULT_AND_BIOMETRIC)}
            style={[styles.primaryButton, { backgroundColor: t.primary }]}
            activeOpacity={0.9}
          >
            <Icon name="sparkles-outline" size={18} color="#FFF" />
            <Text style={styles.primaryButtonText}>Unlock Pro Experience</Text>
          </TouchableOpacity>
        </View>
      </EditorialScreenScaffold>
    );
  }

  // ─── ACTIVE SETTING STATE ───
  return (
    <EditorialScreenScaffold
      navigation={navigation}
      headerTitle="App Lock"
      keyboardAvoiding
      scroll={false}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          
          <View style={[styles.formCard, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.label, { color: t.primary }]}>NEW PIN</Text>
            <TextInput
              value={pinRaw}
              onChangeText={setPinRaw}
              keyboardType="number-pad"
              secureTextEntry
              style={[styles.input, { color: t.text, borderColor: t.border }]}
              placeholder="••••"
              placeholderTextColor={withAlpha(t.text, 0.2)}
              editable={!saving}
              blurOnSubmit={false}
              autoCorrect={false}
              autoCapitalize="none"
              textContentType="oneTimeCode"
              autoComplete="off"
              importantForAutofill="no"
              selectionColor={t.primary}
            />

            <Text style={[styles.label, { color: t.primary, marginTop: 12 }]}>CONFIRM PIN</Text>
            <TextInput
              value={confirmPinRaw}
              onChangeText={setConfirmPinRaw}
              keyboardType="number-pad"
              secureTextEntry
              style={[styles.input, { color: t.text, borderColor: t.border }]}
              placeholder="••••"
              placeholderTextColor={withAlpha(t.text, 0.2)}
              editable={!saving}
              blurOnSubmit={false}
              autoCorrect={false}
              autoCapitalize="none"
              textContentType="oneTimeCode"
              autoComplete="off"
              importantForAutofill="no"
              selectionColor={t.primary}
            />
          </View>

          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: t.primary }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.9}
            >
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Enable Protection</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClear}
              disabled={saving}
              activeOpacity={0.7}
            >
              <Text style={[styles.clearButtonText, { color: t.subtext }]}>Deactivate Lock</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.securityBadge}>
            <Icon name="shield-checkmark-outline" size={14} color={t.subtext} />
            <Text style={[styles.securityText, { color: t.subtext }]}>E2EE LOCAL STORAGE</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </EditorialScreenScaffold>
  );
};

const createStyles = (t, isDark) => StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 60 },
  paywallContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  formCard: {
    padding: 24,
    borderRadius: 24, // High-end Apple Squircle
    borderWidth: 1,
    marginBottom: 24,
  },
  label: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  input: {
    fontFamily: SYSTEM_FONT,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    fontSize: 20,
    letterSpacing: 8,
    fontWeight: '700',
    marginBottom: 12,
  },
  actionContainer: { gap: 12 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 28,
    gap: 10,
    ...Platform.select({
      ios: { shadowColor: '#D2121A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: -0.2,
  },
  clearButton: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    gap: 6,
  },
  securityText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  }
});

export default SetPinScreen;
