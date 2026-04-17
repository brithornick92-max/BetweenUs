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
import { useEntitlements } from '../context/EntitlementsContext';
import { SPACING, withAlpha } from '../utils/theme';
import ConnectionMemory from '../utils/connectionMemory';
import achievementEngine from '../utils/achievementEngine';
import challengeSystem from '../utils/challengeSystem';
import { selection } from '../utils/haptics';

// Components
import QuietMilestone from './QuietMilestone';
import StoryProgress from './StoryProgress';
import InvitationCard from './InvitationCard';
import NightsConnected from './NightsConnected';
import GentleCelebration from './GentleCelebration';
import PreferenceEngine from '../services/PreferenceEngine';
import Icon from './Icon';

import { useAppContext } from '../context/AppContext';
import { getMyDisplayName, getPartnerDisplayName } from '../utils/profileNames';

// Build personalized UI from real behavioral signals
const uiPersonalization = {
  getPersonalizedUI: async () => {
    const avgSession = await ConnectionMemory.getAverageSessionLength();
    const affinities = (await ConnectionMemory.getSnapshot()).featureAffinities || {};

    const isCompact = avgSession != null && avgSession < 120;
    const layout = {
      type: isCompact ? 'compact' : 'comfortable',
      spacing: isCompact
        ? { padding: SPACING.lg, gap: SPACING.lg }
        : { padding: SPACING.xl, gap: SPACING.xl },
      fontSize: isCompact
        ? { title: 28, heading: 12, base: 15 }
        : { title: 34, heading: 12, base: 16 },
    };

    const sortedFeatures = Object.entries(affinities)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4);

    const FEATURE_META = {
      prompts:  { icon: 'chatbubbles-outline', label: 'Prompts',    screen: 'PromptsScreen' },
      journal:  { icon: 'book-outline',        label: 'Journal',    screen: 'JournalHome' },
      dates:    { icon: 'calendar-outline',    label: 'Date Night', screen: 'DateScreen' },
    rituals:  { icon: 'moon-outline',        label: 'Rituals',    screen: 'NightRitualScreen', premium: true },
    lovenote: { icon: 'heart-outline',       label: 'Love Notes', screen: 'LoveNotesInbox', premium: true },
      checkin:  { icon: 'pulse-outline',       label: 'Check-in',   screen: 'CheckInScreen' },
      memories: { icon: 'archive-outline',     label: 'Saved',      screen: 'SavedMoments' },
  intimacy: { icon: 'flame-outline',       label: 'Intimacy',   screen: 'IntimacyPositions', premium: true },
    };

    const shortcuts = sortedFeatures
      .map(([name]) => FEATURE_META[name])
      .filter(Boolean);

    if (shortcuts.length === 0) {
      shortcuts.push(FEATURE_META.prompts, FEATURE_META.journal, FEATURE_META.rituals, FEATURE_META.lovenote);
    }

    const widgets = [
      { type: 'streak_indicator', data: { streak: 0 } },
      { type: 'achievement_badge', data: {} },
      { type: 'challenge_card', data: {} },
    ];

    if (avgSession != null && avgSession > 300) {
      widgets.push({ type: 'progress_tracker', data: {} });
    }

    return { layout, shortcuts, widgets };
  },
};

/**
 * Adaptive Home Screen Component
 * Sexy Red Intimacy & Apple Editorial Updates Integrated.
 */
export default function AdaptiveHomeScreen({ navigation }) {
  const { user, userProfile } = useAuth();
  const { state } = useAppContext();
  const { colors, isDark } = useTheme();
  const { data: dataLayer } = useData();
  const { isPremiumEffective, showPaywall } = useEntitlements();
  
  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    background: colors.background, 
    surface: isDark ? '#131016' : '#FFFFFF',
    surfaceSecondary: isDark ? '#1C1520' : '#F2F2F7',
    primary: colors.primary || '#D2121A', // Sexy Red
    text: colors.text,
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
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
  const [smartGreeting, setSmartGreeting] = useState('Welcome Back');
  const [smartSubGreeting, setSmartSubGreeting] = useState('Your evening awaits.');

  const preferredName = getMyDisplayName(userProfile, state?.userProfile, user?.displayName || null);
  const partnerLabel = getPartnerDisplayName(userProfile, state?.userProfile, 'your partner');

  useEffect(() => {
    if (user?.uid) {
      loadPersonalization();
    }
  }, [user]);

  useEffect(() => {
    (async () => {
      try {
        const profile = await PreferenceEngine.getContentProfile({});
        const greeting = await PreferenceEngine.getSmartGreeting(profile);

        const seasonGreetings = {
          busy: 'A quick moment 💫',
          cozy: 'Welcome Back 🕯️',
          growth: 'Growing together 🌱',
          adventure: 'Something new awaits ✨',
          rest: 'Take it slow tonight 🌙',
        };
        const seasonId = profile?.season?.id || 'cozy';
        setSmartGreeting(seasonGreetings[seasonId] || 'Welcome Back');
        if (greeting) setSmartSubGreeting(greeting);
      } catch (e) {}
    })();
  }, []);

  const loadPersonalization = async () => {
    try {
      setLoading(true);
      const uiConfig = await uiPersonalization.getPersonalizedUI(user.uid);
      setPersonalizedUI(uiConfig);

      const milestoneData = await achievementEngine.checkAchievements(user.uid, dataLayer);
      setMilestones(milestoneData);

      if (milestoneData.newlyUnlocked?.length > 0) {
        const newMilestone = milestoneData.newlyUnlocked[0];
        setRewardData({
          type: 'milestone',
          title: 'A quiet milestone',
          message: newMilestone.name,
          icon: newMilestone.icon || 'sparkles-outline'
        });
        setShowReward(true);
      }

      const invitationData = await challengeSystem.generateChallenges(user.uid, { count: 3 }, dataLayer);
      setInvitations(invitationData);
    } catch (error) {
      if (__DEV__) console.error('Failed to load personalization:', error);
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
    if (shortcut.premium && !isPremiumEffective) {
      showPaywall?.();
      return;
    }
    if (shortcut.screen && navigation) {
      navigation.navigate(shortcut.screen);
    }
  };

  if (loading || !personalizedUI) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: t.subtext }]}>Finding something meaningful…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { layout, shortcuts, widgets } = personalizedUI;
  const safeNewlyUnlocked = milestones?.newlyUnlocked || [];
  const safeInvitations = invitations?.challenges || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: layout.spacing.padding }
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />
        }
      >
        {/* Editorial Header */}
        <View style={styles.header}>
          <Text style={[styles.greeting, { fontSize: layout.fontSize.title, color: t.text }]}>
            {smartGreeting}
          </Text>
          <Text style={[styles.subGreeting, { fontSize: layout.fontSize.base, color: t.subtext }]}>
            {smartSubGreeting}
          </Text>
        </View>

        {/* Quick Actions Grid */}
        <View style={[styles.section, { marginBottom: layout.spacing.gap }]}>
          <Text style={[styles.sectionTitle, { fontSize: layout.fontSize.heading, color: t.subtext }]}>
            Quick Actions
          </Text>
          <View style={styles.shortcutsGrid}>
            {shortcuts.map((shortcut) => (
              <TouchableOpacity
                key={shortcut.screen}
                style={[styles.shortcutCard, { backgroundColor: t.surface, borderColor: t.border }]}
                onPress={() => handleShortcutPress(shortcut)}
                activeOpacity={0.9}
              >
                <View style={[styles.shortcutIconWrap, { backgroundColor: withAlpha(t.primary, 0.12) }]}>
                  <Icon name={shortcut.icon} size={22} color={t.primary} />
                </View>
                <Text style={[styles.shortcutLabel, { color: t.text }]}>{shortcut.label}</Text>
                {shortcut.premium && !isPremiumEffective && (
                  <View style={styles.lockBadge}>
                    <Icon name="lock-closed-outline" size={12} color={t.subtext} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Dynamic Widget Stack */}
        {widgets.map((widget, index) => {
          switch (widget.type) {
            case 'streak_indicator':
              return (
                <View key={index} style={{ marginBottom: layout.spacing.gap }}>
                  <NightsConnected currentStreak={widget.data.streak || 0} compact={layout.type === 'compact'} />
                </View>
              );

            case 'achievement_badge':
              return safeNewlyUnlocked.length > 0 ? (
                <View key={index} style={{ marginBottom: layout.spacing.gap }}>
                  <Text style={[styles.sectionTitle, { fontSize: layout.fontSize.heading, color: t.subtext }]}>
                    Recent Milestones
                  </Text>
                  {safeNewlyUnlocked.slice(0, 2).map((m) => (
                    <QuietMilestone key={m.id} achievement={m} size={layout.type === 'compact' ? 'small' : 'medium'} />
                  ))}
                </View>
              ) : null;

            case 'challenge_card':
              return safeInvitations.length > 0 ? (
                <View key={index} style={{ marginBottom: layout.spacing.gap }}>
                  <Text style={[styles.sectionTitle, { fontSize: layout.fontSize.heading, color: t.subtext }]}>
                    Invitations
                  </Text>
                  {safeInvitations.slice(0, 1).map((inv) => (
                    <InvitationCard key={inv.id || inv.title} challenge={inv} compact={layout.type === 'compact'} />
                  ))}
                </View>
              ) : null;

            case 'progress_tracker':
              return milestones ? (
                <View key={index} style={{ marginBottom: layout.spacing.gap }}>
                  <StoryProgress
                    title="Our story so far"
                    progress={milestones.stats.completionPercentage / 100}
                    current={milestones.stats.unlockedCount}
                    target={milestones.stats.totalAchievements}
                    unit="moments"
                  />
                </View>
              ) : null;

            default:
              return null;
          }
        })}

        {/* Journey Summary Widget */}
        {milestones && (
          <View style={{ marginBottom: layout.spacing.gap }}>
            <Text style={[styles.sectionTitle, { fontSize: layout.fontSize.heading, color: t.subtext }]}>
              Your Journey
            </Text>
            <View style={[styles.widgetCard, { backgroundColor: t.surface, borderColor: t.border }]}>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: t.primary }]}>{milestones.stats.totalPoints}</Text>
                  <Text style={[styles.statLabel, { color: t.subtext }]}>Reflections</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: t.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: t.primary }]}>{milestones.stats.unlockedCount}</Text>
                  <Text style={[styles.statLabel, { color: t.subtext }]}>Moments</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: t.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: t.primary }]}>
                    {Math.round(milestones.stats.completionPercentage)}%
                  </Text>
                  <Text style={[styles.statLabel, { color: t.subtext }]}>Grown</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {rewardData && (
        <GentleCelebration
          visible={showReward}
          title={rewardData.title}
          message={rewardData.message}
          icon={rewardData.icon}
          onComplete={() => setShowReward(false)}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (t, isDark) => {
  const systemFont = Platform.select({ ios: "System", android: "Roboto" });
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.background },
    scrollView: { flex: 1 },
    content: { paddingBottom: 120, paddingTop: SPACING.md },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
    loadingText: { fontSize: 16, fontWeight: '500', fontStyle: 'italic' },
    header: { marginBottom: SPACING.xxl, alignItems: 'flex-start', paddingHorizontal: 4 },
    greeting: { fontFamily: systemFont, fontWeight: "800", letterSpacing: -0.8, marginBottom: 4 },
    subGreeting: { fontWeight: "500", lineHeight: 22 },
    section: { marginBottom: SPACING.xl },
    sectionTitle: { fontFamily: systemFont, fontWeight: "800", letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: SPACING.sm, paddingLeft: 4 },
    shortcutsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
    shortcutCard: {
      width: '48%',
      borderRadius: 24,
      paddingVertical: SPACING.xl,
      paddingHorizontal: SPACING.lg,
      borderWidth: 1,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: isDark ? 0.2 : 0.04, shadowRadius: 10 },
        android: { elevation: 2 },
      }),
    },
    shortcutIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    shortcutLabel: { fontSize: 15, fontWeight: "800", letterSpacing: -0.2 },
    lockBadge: { position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
    widgetCard: { borderRadius: 24, padding: SPACING.xl, borderWidth: 1 },
    statsGrid: { flexDirection: 'row', alignItems: 'center' },
    statItem: { alignItems: 'center', flex: 1 },
    statValue: { fontFamily: systemFont, fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
    statLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
    statDivider: { width: 1, height: 30, marginHorizontal: 10 }
  });
};
