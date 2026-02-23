import { useState, useEffect } from 'react';
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
import { useContent } from '../context/ContentContext';
import { useEntitlements } from '../context/EntitlementsContext';

const HEAT_LEVELS = [
  {
    level: 1,
    emoji: '😊',
    title: 'Heart Connection',
    description: 'Pure emotional intimacy, non-sexual — building friendship and trust',
  },
  {
    level: 2,
    emoji: '💕',
    title: 'Spark & Attraction',
    description: 'Flirty attraction, romance, and deeper emotional intimacy',
  },
  {
    level: 3,
    emoji: '🔥',
    title: 'Intimate Connection',
    description: 'Moderately sexual, relationship-focused desire and attraction',
  },
  {
    level: 4,
    emoji: '🌶️',
    title: 'Adventurous Exploration',
    description: 'Playfully sexual, suggestive, and adventurous topics',
  },
  {
    level: 5,
    emoji: '🔥🔥',
    title: 'Unrestrained Passion',
    description: 'Intensely passionate, deeply intimate explorations',
  },
];

const HeatLevelSettingsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { userProfile, updateProfile } = useAuth();
  const { loadContentProfile } = useContent();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const [selectedLevel, setSelectedLevel] = useState(3);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (userProfile?.heatLevelPreference) {
      setSelectedLevel(userProfile.heatLevelPreference);
    }
  }, [userProfile]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await updateProfile({
        heatLevelPreference: selectedLevel,
      });

      // Refresh the content profile so all screens pick up the new heat level
      if (loadContentProfile) {
        await loadContentProfile();
      }

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Success);
      Alert.alert('Success', 'Heat level updated successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Failed to update heat level:', error);
      Alert.alert('Error', 'Failed to update heat level. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLevelSelect = (level) => {
    if (level >= 4 && !isPremium) {
      showPaywall('heatLevels4to5');
      return;
    }
    setSelectedLevel(level);
    Haptics.selectionAsync();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Heat Level</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
            <Text style={styles.iconEmoji}>🌡️</Text>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>Choose Your Comfort Level</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Select the type of prompts you'd like to see. You can change this anytime.
          </Text>

          {/* Heat Level Options */}
          <View style={styles.levelsContainer}>
            {HEAT_LEVELS.map((heatLevel) => (
              <TouchableOpacity
                key={heatLevel.level}
                style={[
                  styles.levelCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: selectedLevel === heatLevel.level ? colors.primary : 'transparent',
                    borderWidth: selectedLevel === heatLevel.level ? 2 : 1,
                  },
                ]}
                onPress={() => handleLevelSelect(heatLevel.level)}
                activeOpacity={0.7}
              >
                <View style={styles.levelHeader}>
                  <Text style={styles.levelEmoji}>{heatLevel.emoji}</Text>
                  <View style={styles.levelInfo}>
                    <Text style={[styles.levelTitle, { color: colors.text }]}>
                      Heat {heatLevel.level}: {heatLevel.title}
                    </Text>
                    <Text style={[styles.levelDescription, { color: colors.textSecondary }]}>
                      {heatLevel.description}
                    </Text>
                  </View>
                  {heatLevel.level >= 4 && !isPremium ? (
                    <Ionicons name="lock-closed" size={20} color={colors.textSecondary} />
                  ) : selectedLevel === heatLevel.level ? (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Info Card */}
          <View style={[styles.infoCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
            <Ionicons name="information-circle" size={20} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Your heat level controls which prompts you'll see. Higher levels include all lower level prompts plus more intimate topics.
            </Text>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={[styles.saveButtonText, { color: '#FFFFFF' }]}>
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
  iconEmoji: {
    fontSize: 40,
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
  levelsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  levelCard: {
    padding: 16,
    borderRadius: 12,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  levelEmoji: {
    fontSize: 32,
  },
  levelInfo: {
    flex: 1,
  },
  levelTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  levelDescription: {
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

export default HeatLevelSettingsScreen;
