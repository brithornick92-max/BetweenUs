import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import { SPACING, TYPOGRAPHY } from '../utils/theme';
import ConnectionMemory from '../utils/connectionMemory';
import achievementEngine from '../utils/achievementEngine';
import challengeSystem from '../utils/challengeSystem';

// Build personalized UI from real behavioral signals
const uiPersonalization = {
  getPersonalizedUI: async () => {
    const avgSession = await ConnectionMemory.getAverageSessionLength();
    const dims = await ConnectionMemory.getPreferredDimensions(2);
    const affinities = (await ConnectionMemory.getSnapshot()).featureAffinities || {};

    // Layout density adapts to session length: short sessions → compact
    const isCompact = avgSession != null && avgSession < 120; // < 2 min
    const layout = {
      type: isCompact ? 'compact' : 'comfortable',
      spacing: isCompact
        ? { padding: SPACING.md, gap: SPACING.sm }
        : { padding: SPACING.xl, gap: SPACING.lg },
      fontSize: isCompact
        ? { title: 24, heading: 16, base: 14 }
        : { title: 28, heading: 18, base: 16 },
    };

    // Smart shortcuts: surface the features the couple uses most
    const sortedFeatures = Object.entries(affinities)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4);

    const FEATURE_META = {
      prompts:  { icon: '💬', label: 'Prompts',    screen: 'PromptsScreen' },
      journal:  { icon: '📝', label: 'Journal',    screen: 'JournalEntry' },
      dates:    { icon: '🗓️', label: 'Date Night', screen: 'DateScreen' },
      rituals:  { icon: '🌙', label: 'Rituals',    screen: 'NightRitualScreen' },
      lovenote: { icon: '💌', label: 'Love Notes', screen: 'LoveNotesScreen' },
      checkin:  { icon: '🌡️', label: 'Check-in',   screen: 'CheckInScreen' },
      memories: { icon: '📸', label: 'Memories',   screen: 'MemoriesScreen' },
    };

    const shortcuts = sortedFeatures
      .map(([name]) => FEATURE_META[name])
      .filter(Boolean);

    // Widgets: always show connection + milestones; add invitations if user engages frequently
    const widgets = [
      { type: 'nights_connected', data: { streak: 0 } },
      { type: 'quiet_milestone', data: {} },
      { type: 'invitation_card', data: {} },
    ];

    if (avgSession != null && avgSession > 300) {
      // Engaged user — add progress tracker
      widgets.push({ type: 'progress_tracker', data: {} });
    }

    return { layout, shortcuts, widgets, theme: {} };
  },
  trackInteraction: async (feature) => {
    await ConnectionMemory.recordFeatureUse(feature);
  },
};
import QuietMilestone from './QuietMilestone';
import StoryProgress from './StoryProgress';
import InvitationCard from './InvitationCard';
import NightsConnected from './NightsConnected';
import GentleCelebration from './GentleCelebration';
import Card from './Card';
import PreferenceEngine from '../services/PreferenceEngine';

/**
 * Adaptive Home Screen Component
 * 
 * Dynamically adapts layout and content based on user behavior and preferences.
 * Integrates personalization systems for an intimate, curated home experience.
 */
export default function AdaptiveHomeScreen({ navigation }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { data: dataLayer } = useData();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [personalizedUI, setPersonalizedUI] = useState(null);
  const [milestones, setMilestones] = useState(null);
  const [invitations, setInvitations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [rewardData, setRewardData] = useState(null);
  const [smartGreeting, setSmartGreeting] = useState('Welcome Back 💛');
  const [smartSubGreeting, setSmartSubGreeting] = useState('Your evening awaits');

  useEffect(() => {
    if (user?.uid) {
      loadPersonalization();
    }
  }, [user]);

  // Load preference-aware greetings
  useEffect(() => {
    (async () => {
      try {
        const profile = await PreferenceEngine.getContentProfile({});
        const greeting = await PreferenceEngine.getSmartGreeting(profile);

        // Season-aware greeting emoji/title
        const seasonGreetings = {
          busy: 'A quick moment for you 💫',
          cozy: 'Welcome Back 🕯️',
          growth: 'Ready to grow together 🌱',
          adventure: 'Something new awaits ✨',
          rest: 'Take it slow tonight 🌙',
        };
        const seasonId = profile?.season?.id || 'cozy';
        setSmartGreeting(seasonGreetings[seasonId] || 'Welcome Back 💛');
        if (greeting) setSmartSubGreeting(greeting);
      } catch {
        // Keep defaults
      }
    })();
  }, []);

  const loadPersonalization = async () => {
    try {
      setLoading(true);

      // Load personalized UI configuration
      const uiConfig = await uiPersonalization.getPersonalizedUI(user.uid);
      setPersonalizedUI(uiConfig);

      // Load milestones
      const milestoneData = await achievementEngine.checkAchievements(user.uid, dataLayer);
      setMilestones(milestoneData);

      // Check for newly discovered milestones
      if (milestoneData.newlyUnlocked.length > 0) {
        const newMilestone = milestoneData.newlyUnlocked[0];
        setRewardData({
          type: 'milestone',
          title: 'A quiet milestone',
          message: newMilestone.name,
          icon: newMilestone.icon
        });
        setShowReward(true);
      }

      // Load invitations
      const invitationData = await challengeSystem.generateChallenges(user.uid, {
        count: 3,
      }, dataLayer);
      setInvitations(invitationData);

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

  const handleMilestonePress = (milestone) => {
    if (__DEV__) console.log('Milestone pressed:', milestone.id);
  };

  const handleInvitationPress = (invitation) => {
    if (__DEV__) console.log('Invitation pressed:', invitation.id);
  };

  if (loading || !personalizedUI) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Finding something meaningful…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { layout, shortcuts, widgets, theme: uiTheme } = personalizedUI;
  const safeShortcuts = Array.isArray(shortcuts) ? shortcuts : [];
  const safeWidgets = Array.isArray(widgets) ? widgets : [];
  const safeNewlyUnlocked = Array.isArray(milestones?.newlyUnlocked) ? milestones.newlyUnlocked : [];
  const safeInvitations = Array.isArray(invitations?.challenges) ? invitations.challenges : [];

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
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.greeting, { fontSize: layout.fontSize.title }]}>
            {smartGreeting}
          </Text>
          <Text style={[styles.subGreeting, { fontSize: layout.fontSize.base }]}>
            {smartSubGreeting}
          </Text>
        </View>

        {/* Smart Shortcuts */}
        {safeShortcuts.length > 0 && (
          <View style={[styles.section, { marginBottom: layout.spacing.gap }]}>
            <Text style={[styles.sectionTitle, { fontSize: layout.fontSize.heading }]}>
              Quick Actions
            </Text>
            <View style={styles.shortcutsGrid}>
              {safeShortcuts.map((shortcut, index) => (
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
        {safeWidgets.map((widget, index) => {
          switch (widget.type) {
            case 'streak_indicator':
              return (
                <View key={index} style={[styles.section, { marginBottom: layout.spacing.gap }]}>
                  <NightsConnected
                    currentStreak={widget.data.streak || 0}
                    longestStreak={widget.data.streak || 0}
                    compact={layout.type === 'compact'}
                  />
                </View>
              );

            case 'achievement_badge':
              return safeNewlyUnlocked.length > 0 ? (
                <View key={index} style={[styles.section, { marginBottom: layout.spacing.gap }]}>
                  <Text style={[styles.sectionTitle, { fontSize: layout.fontSize.heading }]}>
                    Recent Milestones
                  </Text>
                  {safeNewlyUnlocked.slice(0, 3).map((milestone, idx) => (
                    <QuietMilestone
                      key={idx}
                      achievement={milestone}
                      size={layout.type === 'compact' ? 'small' : 'medium'}
                      onPress={() => handleMilestonePress(milestone)}
                    />
                  ))}
                </View>
              ) : null;

            case 'challenge_card':
              return safeInvitations.length > 0 ? (
                <View key={index} style={[styles.section, { marginBottom: layout.spacing.gap }]}>
                  <Text style={[styles.sectionTitle, { fontSize: layout.fontSize.heading }]}>
                    Invitations to Connect
                  </Text>
                  {safeInvitations.slice(0, 2).map((invitation, idx) => (
                    <InvitationCard
                      key={idx}
                      challenge={invitation}
                      compact={layout.type === 'compact'}
                      onPress={() => handleInvitationPress(invitation)}
                    />
                  ))}
                </View>
              ) : null;

            case 'progress_tracker':
              return milestones ? (
                <View key={index} style={[styles.section, { marginBottom: layout.spacing.gap }]}>
                  <StoryProgress
                    title="Your story so far"
                    progress={milestones.stats.completionPercentage / 100}
                    current={milestones.stats.unlockedCount}
                    target={milestones.stats.totalAchievements}
                    unit="moments discovered"
                    animated={true}
                  />
                </View>
              ) : null;

            case 'leaderboard':
              // Leaderboard removed per brand guardrails — Between Us never compares couples
              return null;

            default:
              return null;
          }
        })}

        {/* Journey Summary */}
        {milestones && (
          <View style={[styles.section, { marginBottom: layout.spacing.gap }]}>
            <Card variant="glass" padding="md">
              <Text style={[styles.sectionTitle, { fontSize: layout.fontSize.heading }]}>
                Your Journey
              </Text>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{milestones.stats.totalPoints}</Text>
                  <Text style={styles.statLabel}>Moments shared</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{milestones.stats.unlockedCount}</Text>
                  <Text style={styles.statLabel}>Moments</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {Math.round(milestones.stats.completionPercentage)}%
                  </Text>
                  <Text style={styles.statLabel}>Discovered</Text>
                </View>
              </View>
            </Card>
          </View>
        )}
      </ScrollView>

      {/* Reward Animation */}
      {rewardData && (
        <GentleCelebration
          visible={showReward}
          type={rewardData.type}
          title={rewardData.title}
          message={rewardData.message}
          icon={rewardData.icon}
          onComplete={() => setShowReward(false)}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: SPACING.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    ...TYPOGRAPHY.body,
    color: colors.textMuted,
  },
  header: {
    marginBottom: SPACING.xl,
  },
  greeting: {
    ...TYPOGRAPHY.h1,
    color: colors.text,
    fontWeight: "300",
    marginBottom: SPACING.xs,
  },
  subGreeting: {
    ...TYPOGRAPHY.body,
    color: colors.textMuted,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: colors.text,
    fontWeight: "600",
    marginBottom: SPACING.md,
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
    color: colors.text,
    textAlign: "center",
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
    color: colors.primary,
    fontWeight: "600",
    marginBottom: SPACING.xs,
  },
  statLabel: {
    ...TYPOGRAPHY.caption,
    color: colors.textMuted,
  },
});
