// screens/VibeSignalScreen.js
import React, { useRef, useEffect, useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Text,
  TouchableOpacity,
  Animated,
  Platform,
  StatusBar,
} from 'react-native';
import Icon from '../components/Icon';
import { impact, notification, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { useAppContext } from '../context/AppContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useTheme } from '../context/ThemeContext';
import { SPACING } from '../utils/theme';
import { vibeStorage } from '../utils/storage';
import { MomentSignalSender } from '../services/ConnectionEngine';

// ------------------------------------------------------------------
// 1. VIBE CONFIGURATION (Vibrant iOS System Colors)
// ------------------------------------------------------------------
const VIBES = [
  { id: 'passionate', name: 'Passionate', icon: 'fire', color: '#D90429' }, // Sexy, deep crimson red
  { id: 'tender', name: 'Tender', icon: 'heart', color: '#C3113D' },
  { id: 'serene', name: 'Serene', icon: 'water', color: '#32ADE6' }, // iOS Cyan
  { id: 'adventurous', name: 'Adventurous', icon: 'compass', color: '#FF9500' }, // iOS Orange
  { id: 'mysterious', name: 'Mysterious', icon: 'weather-night', color: '#5856D6' }, // iOS Purple
  { id: 'luxurious', name: 'Luxurious', icon: 'diamond-stone', color: '#AF52DE' }, // iOS Indigo
];

// ------------------------------------------------------------------
// 2. INLINE COMPONENTS (VibeCard & VibeSignal)
// ------------------------------------------------------------------
const VibeCard = ({ vibe, isSelected, onPress, styles, t }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: isSelected ? 1 : 0,
        duration: 200,
        useNativeDriver: false, // Required for color interpolation
      }),
      Animated.spring(scaleAnim, {
        toValue: isSelected ? 0.96 : 1,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      })
    ]).start();
  }, [isSelected, fadeAnim, scaleAnim]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: isSelected ? 0.96 : 1,
      friction: 8,
      tension: 60,
      useNativeDriver: true,
    }).start();
  };

  // Pure Apple Editorial Color Interpolations
  const backgroundColor = fadeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [t.surface, vibe.color] 
  });

  const iconCircleBg = fadeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [t.surfaceSecondary, 'rgba(255,255,255,0.25)']
  });

  const textColor = fadeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [t.text, '#FFFFFF']
  });

  return (
    <Animated.View style={[styles.vibeCardWrapper, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        style={styles.vibeTouchableArea}
      >
        <Animated.View style={[styles.vibeCard, { backgroundColor }]}>
          <Animated.View style={[styles.vibeIconContainer, { backgroundColor: iconCircleBg }]}>
            <Icon name={vibe.icon} size={28} color={isSelected ? '#FFFFFF' : vibe.color} />
          </Animated.View>
          <Animated.Text style={[styles.vibeCardLabel, { color: textColor }]}>
            {vibe.name}
          </Animated.Text>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const VibeSignal = ({ onVibeChange, styles, t }) => {
  const [activeVibeId, setActiveVibeId] = useState('serene'); 

  const handleSelectVibe = (vibe) => {
    if (activeVibeId === vibe.id) return;
    impact(ImpactFeedbackStyle.Light);
    setActiveVibeId(vibe.id);
    if (onVibeChange) onVibeChange(vibe, false);
  };

  return (
    <View style={styles.vibeGridContainer}>
      {VIBES.map((vibe) => (
        <VibeCard
          key={vibe.id}
          vibe={vibe}
          isSelected={activeVibeId === vibe.id}
          onPress={() => handleSelectVibe(vibe)}
          styles={styles}
          t={t}
        />
      ))}
    </View>
  );
};

// ------------------------------------------------------------------
// 3. MAIN SCREEN COMPONENT
// ------------------------------------------------------------------
export default function VibeSignalScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  
  // STRICT Apple Editorial Theme Map (Grouped Inset Backgrounds)
  const t = useMemo(() => ({
    background: isDark ? '#000000' : '#F2F2F7', 
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    surfaceSecondary: isDark ? '#2C2C2E' : '#F2F2F7',
    accent: colors.primary || '#C3113D',
    primary: colors.primary,
    text: isDark ? '#FFFFFF' : '#000000',
    subtext: isDark ? '#EBEBF599' : '#3C3C4399',
    border: isDark ? '#38383A' : '#E5E5EA',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);
  const { state } = useAppContext();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const partnerLabel = state.partnerLabel || 'Partner';
  
  // Clean, fast entrance animations
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(20)).current;

  // Real vibe history for the chart
  const [weeklyData, setWeeklyData] = useState(null);

  // Heartbeat signal state
  const [heartbeatSent, setHeartbeatSent] = useState(false);
  const [heartbeatSending, setHeartbeatSending] = useState(false);
  const [heartbeatError, setHeartbeatError] = useState(null);
  const heartbeatFadeAnim = useRef(new Animated.Value(0)).current;
  const heartbeatScaleAnim = useRef(new Animated.Value(0.95)).current;

  const VIBE_INTENSITY = {
    passionate: 90, adventurous: 80, luxurious: 70,
    mysterious: 60, tender: 50, serene: 30,
  };

  useEffect(() => {
    vibeStorage.getRecentVibes(7).then(vibes => {
      if (!vibes || vibes.length === 0) { setWeeklyData(null); return; }
      const buckets = [[], [], [], [], [], [], []];
      for (const v of vibes) {
        const dow = new Date(v.timestamp).getDay();
        const vibeId = v.vibe?.id || v.vibe?.name?.toLowerCase() || '';
        buckets[dow].push(VIBE_INTENSITY[vibeId] ?? 50);
      }
      const orderedDays = [1, 2, 3, 4, 5, 6, 0]; 
      const data = orderedDays.map(d => {
        if (buckets[d].length === 0) return 0;
        return Math.round(buckets[d].reduce((a, b) => a + b, 0) / buckets[d].length);
      });
      setWeeklyData(data);
    }).catch(() => setWeeklyData(null));
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnimation, {
        toValue: 0,
        tension: 60,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnimation, slideAnimation]);

  const handleVibeChange = async (vibe, isAnniversaryVibe) => {
    impact(ImpactFeedbackStyle.Medium);
  };

  const handleBackPress = async () => {
    impact(ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const handleSendHeartbeat = async () => {
    if (heartbeatSending) return;
    setHeartbeatSending(true);
    setHeartbeatError(null);

    notification(NotificationFeedbackType.Success);
    setHeartbeatSent(true);
    heartbeatScaleAnim.setValue(0.95);
    
    Animated.parallel([
      Animated.sequence([
        Animated.timing(heartbeatFadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(2500),
        Animated.timing(heartbeatFadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.spring(heartbeatScaleAnim, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
    ]).start(() => {
      setHeartbeatSent(false);
      setHeartbeatSending(false);
    });

    setTimeout(() => impact(ImpactFeedbackStyle.Heavy).catch(() => {}), 300);

    try {
      const result = await MomentSignalSender.send('thinking');
      if (!result.sent) {
        setHeartbeatError(result.error || 'Wait before sending again');
      } else if (result.error) {
        setHeartbeatError('Sent locally — syncing soon');
      }
    } catch (err) {
      setHeartbeatError('Sent locally — syncing soon');
    }
  };

  const renderHeader = () => (
    <Animated.View style={[styles.header, { opacity: fadeAnimation, transform: [{ translateY: slideAnimation }] }]}>
      <View style={styles.headerTopRow}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton} activeOpacity={0.7}>
          <Icon name="chevron-left" size={32} color={t.text} />
        </TouchableOpacity>
        {isPremium && (
          <View style={styles.premiumBadge}>
            <Icon name="star-four-points" size={12} color={t.primary} />
            <Text style={styles.premiumBadgeText}>PREMIUM</Text>
          </View>
        )}
      </View>
      <View style={styles.headerEditorial}>
        <Text style={styles.headerTitle}>Vibe Signal</Text>
        <Text style={styles.headerSubtitle}>Sync your energy in real time.</Text>
      </View>
    </Animated.View>
  );

  const renderWidgets = () => {
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const hasData = weeklyData && weeklyData.some(v => v > 0);

    return (
      <Animated.View style={[styles.widgetSection, { opacity: fadeAnimation, transform: [{ translateY: slideAnimation }] }]}>
        <Text style={styles.sectionTitle}>Insights</Text>
        <View style={styles.gridContainer}>
          
          {/* Live Sync Widget */}
          <View style={styles.widgetCard}>
            <View style={styles.widgetHeader}>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
              </View>
              <Text style={styles.widgetTitle}>Live Sync</Text>
            </View>
            <View style={styles.widgetBodyCentered}>
              <View style={styles.avatarGroup}>
                <View style={[styles.avatar, styles.avatarLeft]}>
                  <Text style={styles.avatarInitial}>Y</Text>
                </View>
                <View style={[styles.avatar, styles.avatarRight]}>
                  <Text style={[styles.avatarInitial, { color: t.surface }]}>
                    {partnerLabel.charAt(0).toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.widgetSubtitle}>Connected</Text>
            </View>
          </View>

          {/* Energy Flow Widget */}
          <View style={styles.widgetCard}>
            <View style={styles.widgetHeader}>
              <Icon name="chart-bar" size={16} color={t.subtext} />
              <Text style={styles.widgetTitle}>Energy Flow</Text>
            </View>
            <View style={styles.widgetBodyChart}>
              {hasData ? (
                <View style={styles.chartContainer}>
                  {weeklyData.map((value, index) => {
                    const isActive = value > 0;
                    return (
                      <View key={index} style={styles.chartColumn}>
                        <View style={styles.chartBarTrack}>
                          <Animated.View 
                            style={[
                              styles.chartBarFill, 
                              { 
                                height: isActive ? `${Math.max(value, 15)}%` : '0%',
                                backgroundColor: value > 70 ? t.primary : t.surfaceSecondary
                              }
                            ]} 
                          />
                        </View>
                        <Text style={[styles.chartDayLabel, isActive && { color: t.text }]}>{days[index]}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyChartState}>
                  <Text style={styles.emptyChartText}>No Data</Text>
                </View>
              )}
            </View>
          </View>

        </View>
      </Animated.View>
    );
  };

  const renderAction = () => (
    <Animated.View style={[styles.actionSection, { opacity: fadeAnimation, transform: [{ translateY: slideAnimation }] }]}>
      {heartbeatSent ? (
        <Animated.View style={[styles.successContainer, { opacity: heartbeatFadeAnim, transform: [{ scale: heartbeatScaleAnim }] }]}>
          <Icon name="check-circle" size={24} color={t.primary} />
          <View style={styles.successTextContainer}>
            <Text style={styles.successTitle}>Sent to {partnerLabel}</Text>
            <Text style={styles.successSubtitle} numberOfLines={1}>{heartbeatError || "They'll feel it momentarily"}</Text>
          </View>
        </Animated.View>
      ) : (
        <TouchableOpacity 
          style={[styles.primaryButton, heartbeatSending && { opacity: 0.7 }]}
          onPress={handleSendHeartbeat}
          disabled={heartbeatSending}
          activeOpacity={0.8}
        >
          {heartbeatSending ? (
            <Icon name="loading" size={20} color={t.surface} />
          ) : (
            <Icon name="waveform" size={20} color={t.surface} />
          )}
          <Text style={styles.primaryButtonText}>
            {heartbeatSending ? 'Sending...' : 'Send Heartbeat'}
          </Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  if (!isPremium) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <View style={styles.paywallContainer}>
          <TouchableOpacity onPress={handleBackPress} style={[styles.backButton, styles.paywallBackButton]} activeOpacity={0.7}>
            <Icon name="chevron-left" size={32} color={t.text} />
          </TouchableOpacity>
          <View style={styles.paywallContent}>
            <View style={styles.paywallIconContainer}>
              <Icon name="waveform" size={48} color={t.primary} />
            </View>
            <Text style={styles.paywallTitle}>Unlock Deep Sync</Text>
            <Text style={styles.paywallDescription}>
              Share your emotional state and feel your partner's energy through beautiful, synchronized mood signals.
            </Text>
            <TouchableOpacity onPress={showPaywall} style={styles.paywallButton} activeOpacity={0.8}>
              <Text style={styles.paywallButtonText}>Discover Premium</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true} // Re-enabled bounces for authentic iOS feel
      >
        {renderHeader()}
        
        <Animated.View style={[styles.vibeSignalWrapper, { opacity: fadeAnimation, transform: [{ translateY: slideAnimation }] }]}>
          <VibeSignal 
            onVibeChange={handleVibeChange} 
            styles={styles} 
            t={t} 
          />
        </Animated.View>
        
        {renderWidgets()}
        <View style={styles.spacer} />
        {renderAction()}
      </ScrollView>
    </SafeAreaView>
  );
}

// ------------------------------------------------------------------
// 4. COMBINED STYLES - Pure Apple Editorial 
// ------------------------------------------------------------------
const createStyles = (t, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 160, // Padding increased to clear bottom tab bars safely!
    justifyContent: 'flex-start',
  },
  spacer: {
    flex: 1, 
  },
  
  // Header
  header: {
    paddingHorizontal: SPACING.xl,
    paddingTop: Platform.OS === 'android' ? SPACING.xl : SPACING.sm,
    paddingBottom: SPACING.md,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    marginLeft: -8, 
  },
  backButton: {
    padding: 8,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: t.primary,
  },
  headerEditorial: {
    paddingRight: SPACING.xl, 
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: t.text,
    letterSpacing: 0.3,
    marginBottom: 4,
    fontFamily: Platform.select({ ios: "System", android: "Roboto" }),
  },
  headerSubtitle: {
    fontSize: 15,
    color: t.subtext,
    fontWeight: '500',
  },

  // Colored Vibe Component Styles (2-Column Grid)
  vibeSignalWrapper: {
    marginBottom: SPACING.xl,
  },
  vibeGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
  },
  vibeCardWrapper: {
    width: '48%', 
    marginBottom: 4,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0 : 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },
  vibeTouchableArea: {
    width: '100%',
  },
  vibeCard: {
    borderRadius: 24, // iOS Squircle
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: 1, 
  },
  vibeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  vibeCardLabel: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    textAlign: 'center',
  },

  // Widget Dashboard
  widgetSection: {
    paddingHorizontal: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: t.text,
    letterSpacing: -0.5,
    marginBottom: SPACING.md,
  },
  gridContainer: {
    flexDirection: 'row',
    gap: 12, 
    justifyContent: 'space-between',
  },
  widgetCard: {
    flex: 1,
    aspectRatio: 1, 
    backgroundColor: t.surface,
    borderRadius: 24,
    padding: SPACING.md,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0 : 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  widgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  widgetTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: t.subtext,
    letterSpacing: -0.2,
  },
  liveIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(52, 199, 89, 0.2)', // Apple Green Alpha
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759', // Pure Apple Green
  },
  widgetBodyCentered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  avatarLeft: { 
    zIndex: 2,
    backgroundColor: t.surfaceSecondary,
    borderColor: t.surface,
  },
  avatarRight: { 
    marginLeft: -16, 
    zIndex: 1,
    backgroundColor: t.primary,
    borderColor: t.surface,
  },
  avatarInitial: { 
    fontSize: 16, 
    fontWeight: '700',
    color: t.text,
  },
  widgetSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: t.text,
  },
  
  // Chart Details
  widgetBodyChart: { flex: 1 },
  chartContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 4,
  },
  chartColumn: { alignItems: 'center', flex: 1 },
  chartBarTrack: {
    width: 6,
    height: '100%',
    backgroundColor: t.surfaceSecondary,
    borderRadius: 3,
    justifyContent: 'flex-end',
    marginBottom: 4,
    overflow: 'hidden',
  },
  chartBarFill: { width: '100%', borderRadius: 3 },
  chartDayLabel: { fontSize: 10, fontWeight: '700', color: t.subtext },
  emptyChartState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyChartText: { fontSize: 12, color: t.subtext, fontWeight: '500' },

  // Action / Bottom Bar
  actionSection: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
  },
  primaryButton: {
    backgroundColor: t.text, // Solid, high contrast Apple Action Button
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 28,
    gap: 8,
  },
  primaryButtonText: {
    color: t.surface,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.surface,
    paddingHorizontal: SPACING.lg,
    height: 56,
    borderRadius: 28,
    gap: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0 : 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  successTextContainer: { flex: 1 },
  successTitle: { fontSize: 15, fontWeight: '600', color: t.text },
  successSubtitle: { fontSize: 13, color: t.subtext },

  // Paywall
  paywallContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  paywallBackButton: { position: 'absolute', top: 60, left: 20 },
  paywallContent: { alignItems: 'center', paddingHorizontal: SPACING.xxl },
  paywallIconContainer: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: t.primary + '15',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  paywallTitle: {
    fontSize: 32, fontWeight: '800', color: t.text,
    textAlign: 'center', marginBottom: SPACING.md, letterSpacing: -0.5,
  },
  paywallDescription: {
    fontSize: 16, color: t.subtext, textAlign: 'center',
    lineHeight: 24, marginBottom: SPACING.xxxl,
  },
  paywallButton: {
    backgroundColor: t.text,
    paddingVertical: 18, paddingHorizontal: 40,
    borderRadius: 30, width: '100%', alignItems: 'center',
  },
  paywallButtonText: { color: t.surface, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
});
