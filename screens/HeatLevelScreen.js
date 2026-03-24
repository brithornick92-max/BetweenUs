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
import Icon from '../components/Icon';
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { useAuth } from '../context/AuthContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useContent } from '../context/ContentContext';
import { useTheme } from '../context/ThemeContext';
import { PremiumFeature } from '../utils/featureFlags';
import { SPACING, TYPOGRAPHY, BORDER_RADIUS, SYSTEM_FONT } from '../utils/theme';

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
      name: 'Emotional Connection',
      description: 'Emotional intimacy, non-sexual',
      icon: 'spa-outline',
      color: '#F7A8B8',
      gradient: ['#F7A8B8', '#D68898'],
      free: true,
    },
    {
      level: 2,
      name: 'Flirty & Romantic',
      description: 'Flirty attraction, romantic tension',
      icon: 'sparkles-outline',
      color: '#F27A9B',
      gradient: ['#F27A9B', '#C85A7B'],
      free: true,
    },
    {
      level: 3,
      name: 'Sensual',
      description: 'Sensual, relationship-focused intimacy',
      icon: 'heart-outline',
      color: '#E84A7B',
      gradient: ['#E84A7B', '#A83A5A'],
      free: true,
    },
    {
      level: 4,
      name: 'Steamy',
      description: 'Suggestive, adventurous, and heated',
      icon: 'water-outline',
      color: '#E23A68',
      gradient: ['#E23A68', '#A42045'],
      premium: true,
    },
    {
      level: 5,
      name: 'Explicit',
      description: 'Intensely passionate, graphic, explicit',
      icon: 'flame-outline',
      color: '#B81438',
      gradient: ['#B81438', '#6A081A'],
      premium: true,
    },
  ];

  const handleSelectHeatLevel = async (level) => {
    try {
      setLoading(true);
      impact(ImpactFeedbackStyle.Light);

      // Check if premium required
      if (level >= 4 && !isPremium) {
        Alert.alert(
          'Part of the deeper experience',
          `Heat levels 4 and 5 are part of the full experience. Discover deeper intimacy.`,
          [
            { text: 'Maybe Later', style: 'cancel' },
            { text: 'Discover more', onPress: () => showPaywall(PremiumFeature.HEAT_LEVELS_4_5) }
          ]
        );
        return;
      }

      // Check daily limits for free users
      if (!isPremium && usageStatus?.remaining?.prompts === 0) {
        Alert.alert(
          'There\'s more waiting for you',
          'Free users can answer 1 guided prompt per day. Discover the full experience for unlimited prompts and deeper connection.',
          [
            { text: 'Maybe Later', style: 'cancel' },
            { text: 'Discover more', onPress: () => showPaywall(PremiumFeature.UNLIMITED_PROMPTS) }
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
          colors={isLocked ? ['#1C1520', '#241C28'] : (heatLevel.gradient || ['#5E1940', '#4C1030'])}
          style={styles.heatLevelGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.heatLevelContent}>
            <View style={styles.heatLevelHeader}>
              <View style={styles.heatLevelIcon}>
                <Icon
                  name={isLocked ? 'lock-closed-outline' : heatLevel.icon}
                  size={32}
                  color={colors.text}
                />
              </View>
              
              {isLocked && (
                <View style={styles.premiumBadge}>
                  <Icon name="ribbon-outline" size={16} color={colors.text} />
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
            <Icon
              name="arrow-back-outline"
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
            <Icon
              name="information-circle-outline"
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
              onPress={() => showPaywall(PremiumFeature.UNLIMITED_PROMPTS)}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#A89060', '#7A1E4E']}
                style={styles.premiumCTAGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Icon name="ribbon-outline" size={24} color={colors.surface} />
                <Text style={[styles.premiumCTAText, { color: "#070509" }]}>
                  Discover the full experience
                </Text>
                <Icon name="arrow-forward-outline" size={20} color={colors.surface} />
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
    fontFamily: SYSTEM_FONT,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 42,
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
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    backgroundColor: '#34C759',
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
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
});
