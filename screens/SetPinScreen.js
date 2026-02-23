import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';

const PIN_KEY = 'betweenus_app_lock_pin_v1';
const PIN_SERVICE = 'betweenus_app_lock';

function sanitizePin(input) {
  // keep digits only, max 4
  return (input || '').replace(/[^\d]/g, '').slice(0, 4);
}

const SetPinScreen = ({ navigation }) => {
  const { colors } = useTheme();  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  // Raw values: don’t aggressively rewrite on every keystroke
  const [pinRaw, setPinRaw] = useState('');
  const [confirmPinRaw, setConfirmPinRaw] = useState('');

  // Sanitized values used for validation/saving
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [saving, setSaving] = useState(false);

  // Sanitize asynchronously (prevents iOS secureTextEntry/number-pad “flash” issues)
  useEffect(() => {
    const next = sanitizePin(pinRaw);
    if (next !== pin) setPin(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinRaw]);

  useEffect(() => {
    const next = sanitizePin(confirmPinRaw);
    if (next !== confirmPin) setConfirmPin(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmPinRaw]);

  const handleSave = async () => {
    if (pin.length !== 4 || confirmPin.length !== 4) {
      Alert.alert('PIN must be 4 digits', 'Please enter a 4-digit PIN.');
      return;
    }
    if (pin !== confirmPin) {
      Alert.alert('PINs do not match', 'Please re-enter your PIN.');
      return;
    }

    try {
      setSaving(true);
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        pin
      );
      await SecureStore.setItemAsync(PIN_KEY, hash, { keychainService: PIN_SERVICE });
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert('PIN saved', 'Your app lock PIN is set.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to save PIN. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    try {
      setSaving(true);
      await SecureStore.deleteItemAsync(PIN_KEY, { keychainService: PIN_SERVICE });
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert('PIN cleared', 'App lock PIN removed.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to clear PIN.');
    } finally {
      setSaving(false);
    }
  };

  if (!isPremium) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Set App Lock PIN</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
          <Ionicons name="lock-closed" size={56} color={colors.primary} style={{ marginBottom: 16 }} />
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '600', marginBottom: 8, textAlign: 'center' }}>Premium Feature</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: 'center', marginBottom: 24, lineHeight: 22 }}>
            App Lock PIN is a premium security feature. Upgrade to protect your private space with biometric and PIN authentication.
          </Text>
          <TouchableOpacity
            onPress={() => showPaywall('vaultAndBiometric')}
            style={{ backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Upgrade to Premium"
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Upgrade to Premium</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Set App Lock PIN</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <Text style={[styles.label, { color: colors.text }]}>Enter 4-digit PIN</Text>
        <TextInput
          value={pinRaw}
          onChangeText={setPinRaw}
          keyboardType="number-pad"
          secureTextEntry
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="••••"
          placeholderTextColor={colors.textSecondary}
          editable={!saving}
          // Stability / iOS PIN UX
          blurOnSubmit={false}
          autoCorrect={false}
          autoCapitalize="none"
          // iOS: helps prevent autofill/focus jumps
          textContentType="oneTimeCode"
          autoComplete="off"
          importantForAutofill="no"
          // This avoids selection weirdness with secure inputs on some iOS versions
          caretHidden={false}
          accessibilityLabel="Enter 4-digit PIN"
          accessibilityHint="Enter a 4-digit number to lock the app"
        />

        <Text style={[styles.label, { color: colors.text }]}>Confirm PIN</Text>
        <TextInput
          value={confirmPinRaw}
          onChangeText={setConfirmPinRaw}
          keyboardType="number-pad"
          secureTextEntry
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="••••"
          placeholderTextColor={colors.textSecondary}
          editable={!saving}
          blurOnSubmit={false}
          autoCorrect={false}
          autoCapitalize="none"
          textContentType="oneTimeCode"
          autoComplete="off"
          importantForAutofill="no"
          caretHidden={false}
          accessibilityLabel="Confirm PIN"
          accessibilityHint="Re-enter your 4-digit PIN to confirm"
        />

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Save PIN"
          accessibilityState={{ disabled: saving }}
        >
          <Text style={styles.primaryButtonText}>Save PIN</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: colors.border }]}
          onPress={handleClear}
          disabled={saving}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Clear PIN"
          accessibilityState={{ disabled: saving }}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Clear PIN</Text>
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 18,
    marginBottom: 16,
  },
  primaryButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontWeight: '600',
  },
});

export default SetPinScreen;
