import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useContent } from '../context/ContentContext';
import { useEntitlements } from '../context/EntitlementsContext';

import { BlurView } from 'expo-blur';
import { TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../utils/theme';

const HEAT_LEVELS = [
  {
    level: 1,
    icon: 'spa-outline',
    color: '#F7A8B8',
    title: 'Emotional Connection',
    description: 'Emotional intimacy, non-sexual — building friendship and trust',
  },
  {
    level: 2,
    icon: 'star-four-points-outline',
    color: '#F27A9B',
    title: 'Flirty & Romantic',
    description: 'Flirty attraction, romance, and deeper emotional intimacy',
  },
  {
    level: 3,
    icon: 'cards-heart-outline',
    color: '#E84A7B',
    title: 'Sensual',
    description: 'Sensual, relationship-focused desire and attraction',
  },
  {
    level: 4,
    icon: 'water-outline',
    color: '#E23A68',
    title: 'Steamy',
    description: 'Suggestive, adventurous, and heated topics',
  },
  {
    level: 5,
    icon: 'fire',
    color: '#B81438',
    title: 'Explicit',
    description: 'Intensely passionate, graphic, explicit explorations',
  },
];

const HeatLevelSettingsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = createStyles(colors, false);
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

  const handleLevelSelect = (level) => {
    if (level >= 4 && !isPremium) {
      showPaywall('heatLevels4to5');
      return;
    }
    
    if (level === selectedLevel) return;

    setSelectedLevel(level);
    selection();
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        heatLevelPreference: selectedLevel,
      });

      if (loadContentProfile) {
        await loadContentProfile();
      }
      
      navigation.goBack();
    } catch (error) {
      console.error('Failed to update heat level:', error);
      Alert.alert('Error', 'Failed to update preferences. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top + 8 : 24 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: colors.surface2 }]}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={[styles.content, { paddingBottom: Math.max(insets.bottom + 20, 60) }]}>
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
            <MaterialCommunityIcons name="fire" size={36} color={colors.primary} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>Heat Level</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Set your comfort zone. Higher levels include all content from the levels below.
          </Text>

          {/* Heat Level Options */}
          <View style={styles.levelsContainer}>
            {HEAT_LEVELS.map((heatLevel) => {
              const isSelected = selectedLevel === heatLevel.level;
              const isLocked = heatLevel.level >= 4 && !isPremium;

              return (
                <TouchableOpacity
                  key={heatLevel.level}
                  style={[
                    styles.levelCard,
                    {
                      backgroundColor: isSelected ? heatLevel.color + '12' : colors.card,
                      borderColor: isSelected ? heatLevel.color : colors.border,
                      borderWidth: (isLocked || !isSelected) ? 1 : 1.5,
                      opacity: isLocked ? 0.6 : 1,
                    },
                  ]}
                  onPress={() => handleLevelSelect(heatLevel.level)}
                  activeOpacity={0.8}
                >
                  <View style={styles.levelHeader}>
                    <View style={[styles.levelIconWrap, { backgroundColor: heatLevel.color + (isSelected ? '25' : '15') }]}>
                      <MaterialCommunityIcons name={heatLevel.icon} size={20} color={heatLevel.color} />
                    </View>
                    <View style={styles.levelInfo}>
                      <View style={styles.levelTitleRow}>
                        <Text style={[styles.levelTitle, { color: isSelected ? heatLevel.color : colors.text }]}>
                          {heatLevel.title}
                        </Text>
                        {(isSelected || isLocked) && (
                          <View style={styles.rightIconContainer}>
                            {isLocked ? (
                              <Ionicons name="lock-closed" size={16} color={colors.textSecondary} />
                            ) : isSelected ? (
                              <Ionicons name="checkmark-circle" size={20} color={heatLevel.color} />
                            ) : null}
                          </View>
                        )}
                      </View>
                      <Text style={[styles.levelDescription, { color: colors.textSecondary }]}>
                        {heatLevel.description}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={[styles.saveButtonText, { color: colors.text }]}>
              {isSaving ? 'Updating...' : 'Save Comfort Level'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const createStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
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
    marginBottom: 16,
    marginTop: -10, // Bring content up slightly
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
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
    borderRadius: 14,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  rightIconContainer: {
    alignSelf: 'center',
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  levelIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    gap: 12,
  },
  infoIconParams: {
    marginTop: 2,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HeatLevelSettingsScreen;
