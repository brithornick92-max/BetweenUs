import React, { useState } from 'react';
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
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../utils/theme';

const HEAT_LEVELS = [
  {
    level: 1,
    name: 'Heart Connection',
    description: 'Pure emotional intimacy, non-sexual',
    icon: 'heart',
    color: COLORS.success,
    gradient: ['#4CAF50', '#66BB6A'],
    free: true,
  },
  {
    level: 2,
    name: 'Spark & Attraction',
    description: 'Flirty attraction, romantic tension',
    icon: 'heart-pulse',
    color: COLORS.blushRose,
    gradient: [COLORS.blushRose, '#FF8A95'],
    free: true,
  },
  {
    level: 3,
    name: 'Intimate Connection',
    description: 'Moderately sexual, relationship-focused',
    icon: 'fire',
    color: COLORS.mutedGold,
    gradient: [COLORS.mutedGold, '#FFD54F'],
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

export default function HeatLevelScreen({ navigation }) {
  const { isPremiumEffective: isPremium, showPaywall, canConsumePrompt } = useEntitlements();
  const { loadTodayPrompt, usageStatus } = useContent();
  const [loading, setLoading] = useState(false);

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
          'Daily Limit Reached',
          'Free users get 1 prompt per day. Upgrade to premium for unlimited access.',
          [
            { text: 'Maybe Later', style: 'cancel' },
            { text: 'Upgrade to Premium', onPress: () => navigation.navigate('Paywall') }
          ]
        );
        return;
      }

      // Load today's prompt for this heat level
      const prompt = await loadTodayPrompt(level);
      
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
          colors={isLocked ? ['#666', '#888'] : heatLevel.gradient}
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
                  color="#FFF"
                />
              </View>
              
              {isLocked && (
                <View style={styles.premiumBadge}>
                  <MaterialCommunityIcons name="crown" size={16} color="#0B0B0B" />
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
        colors={[COLORS.warmCharcoal, COLORS.deepPlum + '30', COLORS.warmCharcoal]}
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
              color={COLORS.softCream}
            />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Choose Heat Level</Text>
            <Text style={styles.headerSubtitle}>
              Select your comfort level for today's connection
            </Text>
          </View>
        </View>

        {/* Usage Status */}
        {usageStatus && !isPremium && (
          <View style={styles.usageStatus}>
            <MaterialCommunityIcons
              name="information"
              size={16}
              color={COLORS.mutedGold}
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
                colors={['#D4AF37', '#F7E7CE']}
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

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: SPACING.md,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    ...TYPOGRAPHY.h1,
    fontSize: 24,
    color: COLORS.softCream,
    marginBottom: 4,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    color: COLORS.softCream + '80',
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
    color: COLORS.mutedGold,
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
    backgroundColor: '#D4AF37',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatLevelNumber: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  heatLevelName: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  heatLevelDescription: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  freeBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 8,
  },
  freeBadgeText: {
    color: '#FFF',
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
    color: '#0B0B0B',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
});
