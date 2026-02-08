import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
// NOTE: uiPersonalization module not yet implemented — stubbed to prevent crash
const uiPersonalization = {
  getPersonalizedLayout: async () => ({ sections: [], preferences: {} }),
  trackInteraction: async () => {},
};
import achievementEngine from '../utils/achievementEngine';
import challengeSystem from '../utils/challengeSystem';
import AchievementBadge from './AchievementBadge';
import ProgressTracker from './ProgressTracker';
import ChallengeCard from './ChallengeCard';
import StreakIndicator from './StreakIndicator';
import LeaderboardWidget from './LeaderboardWidget';
import RewardAnimation from './RewardAnimation';
import Card from './Card';
import { COLORS, SPACING, TYPOGRAPHY } from '../utils/theme';

/**
 * Adaptive Home Screen Component
 * 
 * Dynamically adapts layout and content based on user behavior and preferences.
 * Integrates all personalization systems for an intelligent home experience.
 */
export default function AdaptiveHomeScreen({ navigation }) {
  const { user } = useAuth();
  const [personalizedUI, setPersonalizedUI] = useState(null);
  const [achievements, setAchievements] = useState(null);
  const [challenges, setChallenges] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [rewardData, setRewardData] = useState(null);

  useEffect(() => {
    if (user?.uid) {
      loadPersonalization();
    }
  }, [user]);

  const loadPersonalization = async () => {
    try {
      setLoading(true);

      // Load personalized UI configuration
      const uiConfig = await uiPersonalization.getPersonalizedUI(user.uid);
      setPersonalizedUI(uiConfig);

      // Load achievements
      const achievementData = await achievementEngine.checkAchievements(user.uid);
      setAchievements(achievementData);

      // Check for newly unlocked achievements
      if (achievementData.newlyUnlocked.length > 0) {
        const newAchievement = achievementData.newlyUnlocked[0];
        setRewardData({
          type: 'achievement',
          title: 'Achievement Unlocked!',
          message: newAchievement.name,
          points: newAchievement.reward.points,
          icon: newAchievement.icon
        });
        setShowReward(true);
      }

      // Load challenges
      const challengeData = await challengeSystem.generateChallenges(user.uid, {
        maxChallenges: 3
      });
      setChallenges(challengeData);

    } catch (error) {
      console.error('Failed to load personalization:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPersonalization();
    setRefreshing(false);
  };

  const handleShortcutPress = (shortcut) => {
    if (shortcut.screen && navigation) {
      navigation.navigate(shortcut.screen);
    }
  };

  const handleAchievementPress = (achievement) => {
    // Navigate to achievements screen or show details
    console.log('Achievement pressed:', achievement.id);
  };

  const handleChallengePress = (challenge) => {
    // Navigate to challenge details
    console.log('Challenge pressed:', challenge.id);
  };

  if (loading || !personalizedUI) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading your personalized experience...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { layout, shortcuts, widgets, theme: uiTheme } = personalizedUI;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { padding: layout.spacing.padding }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.blushRose}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.greeting, { fontSize: layout.fontSize.title }]}>
            Welcome Back! 👋
          </Text>
          <Text style={[styles.subGreeting, { fontSize: layout.fontSize.base }]}>
            Your personalized dashboard
          </Text>
        </View>

        {/* Smart Shortcuts */}
        {shortcuts && shortcuts.length > 0 && (
          <View style={[styles.section, { marginBottom: layout.spacing.gap }]}>
            <Text style={[styles.sectionTitle, { fontSize: layout.fontSize.heading }]}>
              Quick Actions
            </Text>
            <View style={styles.shortcutsGrid}>
              {shortcuts.map((shortcut, index) => (
                <Card
                  key={index}
                  variant="glass"
                  padding="sm"
                  onPress={() => handleShortcutPress(shortcut)}
                  style={styles.shortcutCard}
                >
                  <Text style={styles.shortcutIcon}>{shortcut.icon}</Text>
                  <Text style={styles.shortcutLabel}>{shortcut.label}</Text>
                </Card>
              ))}
            </View>
          </View>
        )}

        {/* Dynamic Widgets */}
        {widgets && widgets.map((widget, index) => {
          switch (widget.type) {
            case 'streak_indicator':
              return (
                <View key={index} style={[styles.section, { marginBottom: layout.spacing.gap }]}>
                  <StreakIndicator
                    currentStreak={widget.data.streak || 0}
                    longestStreak={widget.data.streak || 0}
                    compact={layout.type === 'compact'}
                  />
                </View>
              );

            case 'achievement_badge':
              return achievements && achievements.newlyUnlocked.length > 0 ? (
                <View key={index} style={[styles.section, { marginBottom: layout.spacing.gap }]}>
                  <Text style={[styles.sectionTitle, { fontSize: layout.fontSize.heading }]}>
                    Recent Achievements
                  </Text>
                  {achievements.newlyUnlocked.slice(0, 3).map((achievement, idx) => (
                    <AchievementBadge
                      key={idx}
                      achievement={achievement}
                      size={layout.type === 'compact' ? 'small' : 'medium'}
                      onPress={() => handleAchievementPress(achievement)}
                    />
                  ))}
                </View>
              ) : null;

            case 'challenge_card':
              return challenges && challenges.challenges.length > 0 ? (
                <View key={index} style={[styles.section, { marginBottom: layout.spacing.gap }]}>
                  <Text style={[styles.sectionTitle, { fontSize: layout.fontSize.heading }]}>
                    Active Challenges
                  </Text>
                  {challenges.challenges.slice(0, 2).map((challenge, idx) => (
                    <ChallengeCard
                      key={idx}
                      challenge={challenge}
                      compact={layout.type === 'compact'}
                      onPress={() => handleChallengePress(challenge)}
                    />
                  ))}
                </View>
              ) : null;

            case 'progress_tracker':
              return achievements ? (
                <View key={index} style={[styles.section, { marginBottom: layout.spacing.gap }]}>
                  <ProgressTracker
                    title="Achievement Progress"
                    progress={achievements.stats.completionPercentage / 100}
                    current={achievements.stats.unlockedCount}
                    target={achievements.stats.totalAchievements}
                    unit="achievements"
                    animated={true}
                  />
                </View>
              ) : null;

            case 'leaderboard':
              return (
                <View key={index} style={[styles.section, { marginBottom: layout.spacing.gap }]}>
                  <LeaderboardWidget
                    leaderboard={[]}
                    userRank={null}
                    compact={layout.type === 'compact'}
                  />
                </View>
              );

            default:
              return null;
          }
        })}

        {/* Achievement Stats Summary */}
        {achievements && (
          <View style={[styles.section, { marginBottom: layout.spacing.gap }]}>
            <Card variant="glass" padding="md">
              <Text style={[styles.sectionTitle, { fontSize: layout.fontSize.heading }]}>
                Your Stats
              </Text>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{achievements.stats.totalPoints}</Text>
                  <Text style={styles.statLabel}>Total Points</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{achievements.stats.unlockedCount}</Text>
                  <Text style={styles.statLabel}>Achievements</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {Math.round(achievements.stats.completionPercentage)}%
                  </Text>
                  <Text style={styles.statLabel}>Complete</Text>
                </View>
              </View>
            </Card>
          </View>
        )}
      </ScrollView>

      {/* Reward Animation */}
      {rewardData && (
        <RewardAnimation
          visible={showReward}
          type={rewardData.type}
          title={rewardData.title}
          message={rewardData.message}
          points={rewardData.points}
          icon={rewardData.icon}
          onComplete={() => setShowReward(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.charcoal
  },
  scrollView: {
    flex: 1
  },
  content: {
    paddingBottom: SPACING.xl
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    ...TYPOGRAPHY.body,
    color: COLORS.softGray
  },
  header: {
    marginBottom: SPACING.xl
  },
  greeting: {
    ...TYPOGRAPHY.h1,
    color: COLORS.cream,
    fontWeight: '700',
    marginBottom: SPACING.xs
  },
  subGreeting: {
    ...TYPOGRAPHY.body,
    color: COLORS.softGray
  },
  section: {
    marginBottom: SPACING.lg
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.cream,
    fontWeight: '600',
    marginBottom: SPACING.md
  },
  shortcutsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm
  },
  shortcutCard: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: SPACING.md
  },
  shortcutIcon: {
    fontSize: 32,
    marginBottom: SPACING.xs
  },
  shortcutLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.cream,
    textAlign: 'center'
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: SPACING.md
  },
  statItem: {
    alignItems: 'center'
  },
  statValue: {
    ...TYPOGRAPHY.h2,
    color: COLORS.blushRose,
    fontWeight: '700',
    marginBottom: SPACING.xs
  },
  statLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.softGray
  }
});
