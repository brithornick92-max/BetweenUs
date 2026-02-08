import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { useTheme } from '../context/ThemeContext';

const PIN_KEY = 'betweenus_app_lock_pin_v1';
const PIN_SERVICE = 'betweenus_app_lock';

const SetPinScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (pin.length !== 4 || confirmPin.length !== 4) {
      Alert.alert('PIN must be 4 digits', 'Please enter a 4‑digit PIN.');
      return;
    }
    if (pin !== confirmPin) {
      Alert.alert('PINs do not match', 'Please re‑enter your PIN.');
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Set App Lock PIN</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.label, { color: colors.text }]}>Enter 4‑digit PIN</Text>
        <TextInput
          value={pin}
          onChangeText={(v) => setPin(v.replace(/[^0-9]/g, '').slice(0, 4))}
          keyboardType="number-pad"
          secureTextEntry
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="••••"
          placeholderTextColor={colors.textSecondary}
          editable={!saving}
        />

        <Text style={[styles.label, { color: colors.text }]}>Confirm PIN</Text>
        <TextInput
          value={confirmPin}
          onChangeText={(v) => setConfirmPin(v.replace(/[^0-9]/g, '').slice(0, 4))}
          keyboardType="number-pad"
          secureTextEntry
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="••••"
          placeholderTextColor={colors.textSecondary}
          editable={!saving}
        />

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Save PIN</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: colors.border }]}
          onPress={handleClear}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Clear PIN</Text>
        </TouchableOpacity>
      </View>
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
    color: '#0B0B0B',
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
