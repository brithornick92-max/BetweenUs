import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useContent } from '../context/ContentContext';
import { useTheme } from '../context/ThemeContext';
import { SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../utils/theme';

export default function HeatLevelScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall, canConsumePrompt } = useEntitlements();
  const { loadTodayPrompt, usageStatus, loadContentProfile } = useContent();
  const { updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const HEAT_LEVELS = [
    {
      level: 1,
      name: 'Heart Connection',
      description: 'Pure emotional intimacy, non-sexual',
      icon: 'heart',
      color: colors.success,
      gradient: ['#4CAF50', '#66BB6A'],
      free: true,
    },
    {
      level: 2,
      name: 'Spark & Attraction',
      description: 'Flirty attraction, romantic tension',
      icon: 'heart-pulse',
      color: colors.primary,
      gradient: [colors.primary, '#FF8A95'],
      free: true,
    },
    {
      level: 3,
      name: 'Intimate Connection',
      description: 'Moderately sexual, relationship-focused',
      icon: 'fire',
      color: colors.accent,
      gradient: [colors.accent, '#FFD54F'],
      free: true,
    },
    {
      level: 4,
      name: 'Adventurous Exploration',
      description: 'Mostly sexual, kinky, adventurous',
      icon: 'fire-circle',
      color: '#FF6B35',
      gradient: ['#FF6B35', '#FF8F65'],
      premium: true,
    },
    {
      level: 5,
      name: 'Unrestrained Passion',
      description: 'Highly sexual, graphic, intense',
      icon: 'fire-alert',
      color: '#E53E3E',
      gradient: ['#E53E3E', '#FC8181'],
      premium: true,
    },
  ];

  const handleSelectHeatLevel = async (level) => {
    try {
      setLoading(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Check if premium required
      if (level >= 4 && !isPremium) {
        Alert.alert(
          'Premium Required',
          `Heat levels 4 and 5 require premium access. Upgrade to explore deeper intimacy.`,
          [
            { text: 'Maybe Later', style: 'cancel' },
            { text: 'Upgrade to Premium', onPress: () => navigation.navigate('Paywall') }
          ]
        );
        return;
      }

      // Check daily limits for free users
      if (!isPremium && usageStatus?.remaining?.prompts === 0) {
        Alert.alert(
          'Premium Feature',
          'Free users can preview 3 read-only prompts. Upgrade to premium for unlimited prompts and responses.',
          [
            { text: 'Maybe Later', style: 'cancel' },
            { text: 'Upgrade to Premium', onPress: () => navigation.navigate('Paywall') }
          ]
        );
        return;
      }

      // Load today's prompt for this heat level
      const prompt = await loadTodayPrompt(level);

      // Persist the heat level as their preference
      if (updateProfile) {
        updateProfile({ heatLevelPreference: level }).catch(() => {});
      }
      // Refresh the content profile so other screens pick up the change
      if (loadContentProfile) {
        loadContentProfile().catch(() => {});
      }
      
      if (prompt) {
        navigation.navigate('PromptAnswer', {
          prompt: {
            ...prompt,
            dateKey: new Date().toISOString().split('T')[0],
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
    const isLocked = heatLevel.premium && !isPremium;
    const isDisabled = loading || (isLocked && heatLevel.level >= 4);

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
          colors={isLocked ? ['#666', '#888'] : (heatLevel.gradient || ['#6B2D5B', '#4A1942'])}
          style={styles.heatLevelGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.heatLevelContent}>
            <View style={styles.heatLevelHeader}>
              <View style={styles.heatLevelIcon}>
                <MaterialCommunityIcons
                  name={isLocked ? 'lock' : heatLevel.icon}
                  size={32}
                  color={colors.text}
                />
              </View>
              
              {isLocked && (
                <View style={styles.premiumBadge}>
                  <MaterialCommunityIcons name="crown" size={16} color={colors.text} />
                </View>
              )}
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
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.background, colors.surface2 || colors.background, colors.background]}
        style={StyleSheet.absoluteFill}
        locations={[0, 0.5, 1]}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Set the Mood</Text>
            <Text style={styles.headerSubtitle}>
              How deep do you want to go tonight?
            </Text>
          </View>
        </View>

        {/* Usage Status */}
        {usageStatus && !isPremium && (
          <View style={styles.usageStatus}>
            <MaterialCommunityIcons
              name="information"
              size={16}
              color={colors.primary}
            />
            <Text style={styles.usageText}>
              {usageStatus.remaining.prompts} prompt{usageStatus.remaining.prompts !== 1 ? 's' : ''} remaining today
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

          {/* Premium CTA */}
          {!isPremium && (
            <TouchableOpacity
              style={styles.premiumCTA}
              onPress={() => navigation.navigate('Paywall')}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#A89060', '#C8A870']}
                style={styles.premiumCTAGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <MaterialCommunityIcons name="crown" size={24} color="#0B0B0B" />
                <Text style={styles.premiumCTAText}>
                  Upgrade to Premium for unlimited access
                </Text>
                <MaterialCommunityIcons name="arrow-right" size={20} color="#0B0B0B" />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2 || 'rgba(255,255,255,0.05)',
    marginRight: SPACING.md,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    ...TYPOGRAPHY.h1,
    fontSize: 24,
    color: colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    color: colors.textSecondary,
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
    backgroundColor: 'rgba(255,255,255,0.2)',
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
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  heatLevelName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  heatLevelDescription: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  freeBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: colors.success,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 8,
  },
  freeBadgeText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  premiumCTA: {
    marginTop: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
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
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
});
