import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../components/Icon';
import { impact, ImpactFeedbackStyle } from '../utils/haptics';
import { useAuth } from '../context/AuthContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useContent } from '../context/ContentContext';
import { getDailyContentDateKey } from '../utils/dailyContentDate';
import { useTheme } from '../context/ThemeContext';
import { SPACING, BORDER_RADIUS } from '../utils/theme';
import EditorialScreenScaffold from '../components/EditorialScreenScaffold';
import { HEAT_LEVEL_ACCENTS, HEAT_LEVEL_GRADIENTS } from '../config/constants';

const HEAT_CARD_TEXT = '#FFFFFF';
const HEAT_CARD_SUBTEXT = 'rgba(255,255,255,0.82)';
const FREE_BADGE_TEXT = '#07110A';

export default function HeatLevelScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium } = useEntitlements();
  const { loadTodayPrompt, usageStatus, loadContentProfile } = useContent();
  const { userProfile, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const HEAT_LEVELS = [
    {
      level: 1,
      name: 'Emotional Connection',
      description: 'Emotional closeness, non-sexual',
      icon: 'spa-outline',
      color: HEAT_LEVEL_ACCENTS[1],
      gradient: HEAT_LEVEL_GRADIENTS[1],
      free: true,
    },
    {
      level: 2,
      name: 'Flirty & Romantic',
      description: 'Flirty attraction, romantic tension',
      icon: 'sparkles-outline',
      color: HEAT_LEVEL_ACCENTS[2],
      gradient: HEAT_LEVEL_GRADIENTS[2],
      free: true,
    },
    {
      level: 3,
      name: 'Sensual',
      description: 'Sensual, relationship-focused sex',
      icon: 'heart-outline',
      color: HEAT_LEVEL_ACCENTS[3],
      gradient: HEAT_LEVEL_GRADIENTS[3],
      free: true,
    },
    {
      level: 4,
      name: 'Steamy',
      description: 'Suggestive, adventurous, and heated',
      icon: 'water-outline',
      color: HEAT_LEVEL_ACCENTS[4],
      gradient: HEAT_LEVEL_GRADIENTS[4],
      free: true,
    },
    {
      level: 5,
      name: 'Explicit',
      description: 'Intensely passionate, graphic, explicit',
      icon: 'flame-outline',
      color: HEAT_LEVEL_ACCENTS[5],
      gradient: HEAT_LEVEL_GRADIENTS[5],
      free: true,
    },
  ];

  const handleSelectHeatLevel = async (level) => {
    try {
      setLoading(true);
      impact(ImpactFeedbackStyle.Light);

      // Persist the heat level as their preference
      const updatedProfile = updateProfile
        ? await updateProfile({ heatLevelPreference: level })
        : null;

      if (updateProfile) {
        if (loadContentProfile) {
          await loadContentProfile(updatedProfile || { heatLevelPreference: level });
        }
      }

      // Load today's prompt using the just-saved profile so boundaries/heat apply immediately.
      const prompt = await loadTodayPrompt(level, {
        profileOverride: updatedProfile || { ...(userProfile || {}), heatLevelPreference: level },
      });
      
      if (prompt) {
        navigation.navigate('PromptAnswer', {
          prompt: {
            ...prompt,
            dateKey: prompt.dateKey || getDailyContentDateKey(),
          },
        });
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderHeatLevel = (heatLevel) => {
    const isDisabled = loading;

    return (
      <TouchableOpacity
        key={heatLevel.level}
        style={[
          styles.heatLevelCard,
          isDisabled && styles.disabledCard,
        ]}
        onPress={() => handleSelectHeatLevel(heatLevel.level)}
        disabled={isDisabled}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={heatLevel.gradient || ['#5E1940', '#4C1030']}
          style={styles.heatLevelGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.heatLevelContent}>
            <View style={styles.heatLevelHeader}>
              <View style={styles.heatLevelIcon}>
                <Icon
                  name={heatLevel.icon}
                  size={32}
                  color={HEAT_CARD_TEXT}
                />
              </View>
            </View>

            <Text style={styles.heatLevelNumber}>Level {heatLevel.level}</Text>
            <Text style={styles.heatLevelName}>{heatLevel.name}</Text>
            <Text style={styles.heatLevelDescription}>
              {heatLevel.description}
            </Text>

            {heatLevel.free && (
              <View style={styles.freeBadge}>
                <Text style={styles.freeBadgeText}>FREE</Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <EditorialScreenScaffold
      navigation={navigation}
      headerTitle="Set the Mood"
      heroTitle="Set the Mood"
      heroSubtitle="How deep do you want to go today?"
      scroll={false}
    >
        {/* Usage Status */}
        {usageStatus && !isPremium && (
          <View style={styles.usageStatus}>
            <Icon
              name="information-circle-outline"
              size={16}
              color={colors.primary}
            />
            <Text style={styles.usageText}>
              Choose a level to open today's moment.
            </Text>
          </View>
        )}

        {/* Heat Levels */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {HEAT_LEVELS.map(renderHeatLevel)}
        </ScrollView>
    </EditorialScreenScaffold>
  );
}

const createStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
  },
  usageStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  usageText: {
    color: colors.primary,
    fontSize: 14,
    marginLeft: SPACING.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  heatLevelCard: {
    marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  disabledCard: {
    opacity: 0.6,
  },
  heatLevelGradient: {
    padding: SPACING.xl,
  },
  heatLevelContent: {
    alignItems: 'center',
  },
  heatLevelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    width: '100%',
    justifyContent: 'center',
    position: 'relative',
  },
  heatLevelIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#A89060',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatLevelNumber: {
    color: HEAT_CARD_TEXT,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  heatLevelName: {
    color: HEAT_CARD_TEXT,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  heatLevelDescription: {
    color: HEAT_CARD_SUBTEXT,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  freeBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: '#34C759',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 8,
  },
  freeBadgeText: {
    color: FREE_BADGE_TEXT,
    fontSize: 10,
    fontWeight: '700',
  },
  premiumCTA: {
    marginTop: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    width: '100%',
  },
  premiumCTAGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  premiumCTAText: {
    color: HEAT_CARD_TEXT,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
});
