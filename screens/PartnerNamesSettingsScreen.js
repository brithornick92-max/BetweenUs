import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import Input from '../components/Input';

/**
 * Partner Names Settings Screen
 * Allows users to customize how they see themselves and their partner in the app
 */
const PartnerNamesSettingsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { userProfile, updateProfile } = useAuth();
  const [myName, setMyName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (userProfile?.partnerNames) {
      setMyName(userProfile.partnerNames.myName || '');
      setPartnerName(userProfile.partnerNames.partnerName || '');
    }
  }, [userProfile]);

  const handleSave = async () => {
    if (!myName.trim() || !partnerName.trim()) {
      Alert.alert('Names Required', 'Please enter both names');
      return;
    }

    try {
      setIsSaving(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await updateProfile({
        partnerNames: {
          myName: myName.trim(),
          partnerName: partnerName.trim(),
        },
      });

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Success);
      Alert.alert('Success', 'Partner names updated successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Failed to update partner names:', error);
      Alert.alert('Error', 'Failed to update names. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Partner Names</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="people" size={48} color={colors.primary} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>Customize Your Names</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            These names will appear in prompts and throughout the app
          </Text>

          {/* My Name Input */}
          <View style={styles.inputSection}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>My Name</Text>
            <Input
              value={myName}
              onChangeText={setMyName}
              placeholder="e.g. Sarah, Alex, Me"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          {/* Partner Name Input */}
          <View style={styles.inputSection}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>My Partner's Name</Text>
            <Input
              value={partnerName}
              onChangeText={setPartnerName}
              placeholder="e.g. John, Emma, Partner"
              autoCorrect={false}
              returnKeyType="done"
            />
          </View>

          {/* Examples */}
          <View style={[styles.examplesCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.examplesTitle, { color: colors.text }]}>Examples</Text>
            <View style={styles.exampleRow}>
              <Ionicons name="chatbubble-ellipses" size={16} color={colors.primary} />
              <Text style={[styles.exampleText, { color: colors.textSecondary }]}>
                "What does {myName || 'My Name'} love most about {partnerName || 'Partner Name'}?"
              </Text>
            </View>
            <View style={styles.exampleRow}>
              <Ionicons name="heart" size={16} color={colors.primary} />
              <Text style={[styles.exampleText, { color: colors.textSecondary }]}>
                "{myName || 'My Name'} and {partnerName || 'Partner Name'}'s favorite memory"
              </Text>
            </View>
          </View>

          {/* Info Card */}
          <View style={[styles.infoCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
            <Ionicons name="information-circle" size={20} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              You can change these names anytime. They're just for personalization and won't affect your account.
            </Text>
          </View>

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
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  examplesCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  examplesTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 12,
  },
  exampleText: {
    fontSize: 14,
    flex: 1,
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

export default PartnerNamesSettingsScreen;
