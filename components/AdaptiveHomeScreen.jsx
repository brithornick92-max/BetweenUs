import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  RefreshControl,
  TouchableOpacity,
  Platform,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import { SPACING } from '../utils/theme';
import ConnectionMemory from '../utils/connectionMemory';
import achievementEngine from '../utils/achievementEngine';
import challengeSystem from '../utils/challengeSystem';
import { selection } from '../utils/haptics';

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
        ? { padding: SPACING.md, gap: SPACING.lg }
        : { padding: SPACING.xl, gap: SPACING.xl },
      fontSize: isCompact
        ? { title: 28, heading: 13, base: 15 }
        : { title: 34, heading: 13, base: 16 },
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
      { type: 'streak_indicator', data: { streak: 0 } },
      { type: 'achievement_badge', data: {} },
      { type: 'challenge_card', data: {} },
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
import PreferenceEngine from '../services/PreferenceEngine';

/**
 * Adaptive Home Screen Component
 * * Dynamically adapts layout and content based on user behavior and preferences.
 * Integrates personalization systems for an intimate, curated home experience.
 */
export default function AdaptiveHomeScreen({ navigation }) {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const { data: dataLayer } = useData();
  
  // STRICT Apple Editorial Theme Map
  const t = useMemo(() => ({
    background: isDark ? '#000000' : '#F2F2F7', 
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    surfaceSecondary: isDark ? '#2C2C2E' : '#E5E5EA',
    primary: colors.primary,
    accent: colors.accent || '#FF2D55',
    text: isDark ? '#FFFFFF' : '#000000',
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  const [personalizedUI, setPersonalizedUI] = useState(null);
  const [milestones, setMilestones] = useState(null);
  const [invitations, setInvitations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [rewardData, setRewardData] = useState(null);
  const [smartGreeting, setSmartGreeting] = useState('Welcome Back 💛');
  const [smartSubGreeting, setSmartSubGreeting] = useState('Your evening awaits.');

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
      if (milestoneData.newlyUnlocked && milestoneData.newlyUnlocked.length > 0) {
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
    selection();
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
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Finding something meaningful…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { layout, shortcuts, widgets } = personalizedUI;
  const safeShortcuts = Array.isArray(shortcuts) ? shortcuts : [];
  const safeWidgets = Array.isArray(widgets) ? widgets : [];
  const safeNewlyUnlocked = Array.isArray(milestones?.newlyUnlocked) ? milestones.newlyUnlocked : [];
  const safeInvitations = Array.isArray(invitations?.challenges) ? invitations.challenges : [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: layout.spacing.padding } // Apply dynamic padding
        ]}
        showsVerticalScrollIndicator={false}
        bounces={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={t.primary}
          />
        }
      >
        {/* Flush-Left Editorial Header */}
        <View style={styles.header}>
          <Text style={[styles.greeting, { fontSize: layout.fontSize.title }]}>
            {smartGreeting}
          </Text>
          <Text style={[styles.subGreeting, { fontSize: layout.fontSize.base }]}>
            {smartSubGreeting}
          </Text>
        </View>

        {/* Smart Shortcuts (Apple Widget Style) */}
        {safeShortcuts.length > 0 && (
          <View style={[styles.section, { marginBottom: layout.spacing.gap }]}>
            <Text style={[styles.sectionTitle, { fontSize: layout.fontSize.heading }]}>
              QUICK ACTIONS
            </Text>
            <View style={styles.shortcutsGrid}>
              {safeShortcuts.map((shortcut, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.shortcutCard}
                  onPress={() => handleShortcutPress(shortcut)}
                  activeOpacity={0.75}
                >
                  <View style={styles.shortcutIconWrap}>
                    <Text style={styles.shortcutIcon}>{shortcut.icon}</Text>
                  </View>
                  <Text style={styles.shortcutLabel}>{shortcut.label}</Text>
                </TouchableOpacity>
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
                    RECENT MILESTONES
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
                    INVITATIONS
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

            default:
              return null;
          }
        })}

        {/* Journey Summary Widget */}
        {milestones && (
          <View style={[styles.section, { marginBottom: layout.spacing.gap }]}>
            <Text style={[styles.sectionTitle, { fontSize: layout.fontSize.heading }]}>
              YOUR JOURNEY
            </Text>
            <View style={styles.widgetCard}>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{milestones.stats.totalPoints}</Text>
                  <Text style={styles.statLabel}>Reflections</Text>
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
            </View>
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

// ------------------------------------------------------------------
// STYLES - Pure Apple Editorial 
// ------------------------------------------------------------------
const createStyles = (t, isDark) => {
  const systemFont = Platform.select({ ios: "System", android: "Roboto" });

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.background,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      paddingBottom: 160, // Critical padding to clear bottom tabs safely
      paddingTop: SPACING.md,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: t.background,
    },
    loadingText: {
      fontSize: 16,
      fontWeight: '500',
      fontStyle: 'italic',
      color: t.subtext,
    },

    // ── Header ──
    header: {
      marginBottom: SPACING.xxl,
      alignItems: 'flex-start',
    },
    greeting: {
      fontFamily: systemFont,
      fontWeight: "800",
      color: t.text,
      letterSpacing: -0.5,
      marginBottom: 4,
    },
    subGreeting: {
      fontWeight: "500",
      color: t.subtext,
    },

    // ── Sections ──
    section: {
      marginBottom: SPACING.xl,
    },
    sectionTitle: {
      fontFamily: systemFont,
      fontWeight: "700",
      color: t.subtext,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginBottom: SPACING.sm,
      paddingLeft: 4,
    },

    // ── 2-Column Shortcut Widgets ──
    shortcutsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 12,
    },
    shortcutCard: {
      width: '48%',
      backgroundColor: t.surface,
      borderRadius: 24,
      paddingVertical: SPACING.xl,
      paddingHorizontal: SPACING.lg,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'flex-start',
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0 : 0.04, shadowRadius: 8 },
        android: { elevation: 2 },
      }),
    },
    shortcutIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    shortcutIcon: {
      fontSize: 22,
    },
    shortcutLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: t.text,
      letterSpacing: -0.2,
    },

    // ── Standard Widget Card ──
    widgetCard: {
      backgroundColor: t.surface,
      borderRadius: 24,
      padding: SPACING.xl,
      borderWidth: 1,
      borderColor: t.border,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 12 },
        android: { elevation: 3 },
      }),
    },

    // ── Stats Grid ──
    statsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    statItem: {
      alignItems: 'flex-start',
      flex: 1,
    },
    statValue: {
      fontFamily: systemFont,
      fontSize: 28,
      fontWeight: "800",
      color: t.primary,
      marginBottom: 2,
      letterSpacing: -0.5,
    },
    statLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: t.subtext,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
  });
};
