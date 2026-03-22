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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { impact, notification, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { useAppContext } from '../context/AppContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useTheme } from '../context/ThemeContext';
import { SPACING, BORDER_RADIUS } from '../utils/theme';
import { vibeStorage } from '../utils/storage';
import { MomentSignalSender } from '../services/ConnectionEngine';


// ------------------------------------------------------------------
// 1. VIBE CONFIGURATION (Vibrant iOS System Colors)
// ------------------------------------------------------------------
const VIBES = [
  { id: 'passionate', name: 'Passionate', icon: 'fire', color: '#FF3B30' },
  { id: 'tender', name: 'Tender', icon: 'heart-outline', color: '#FF2D55' },
  { id: 'serene', name: 'Serene', icon: 'water', color: '#5AC8FA' },
  { id: 'adventurous', name: 'Adventurous', icon: 'compass-outline', color: '#FF9500' },
  { id: 'mysterious', name: 'Mysterious', icon: 'weather-night', color: '#5856D6' },
  { id: 'luxurious', name: 'Luxurious', icon: 'diamond-stone', color: '#AF52DE' },
];

// ------------------------------------------------------------------
// 2. INLINE COMPONENTS (VibeCard & VibeSignal)
// ------------------------------------------------------------------
const VibeCard = ({ vibe, isSelected, onPress, styles, colors, isDark }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: isSelected ? 1 : 0,
        duration: 250,
        useNativeDriver: false, // Must be false for color interpolation
      }),
      Animated.spring(scaleAnim, {
        toValue: isSelected ? 0.95 : 1, // Slightly deeper press effect
        friction: 8,
        tension: 50,
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
      toValue: isSelected ? 0.95 : 1,
      friction: 8,
      tension: 50,
      useNativeDriver: true,
    }).start();
  };

  // High-End Apple HomeKit Color Logic
  const backgroundColor = fadeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isDark ? vibe.color + '1A' : vibe.color + '15', vibe.color] // 1A/15 are opacity hex codes
  });

  const iconCircleBg = fadeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isDark ? 'rgba(0,0,0,0.2)' : '#FFFFFF', 'rgba(255,255,255,0.25)']
  });

  const textColor = fadeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.text, '#FFFFFF']
  });

  const borderColor = isSelected ? 'transparent' : (isDark ? vibe.color + '30' : vibe.color + '25');

  return (
    <Animated.View 
      style={[
        styles.vibeCardWrapper, 
        { 
          transform: [{ scale: scaleAnim }],
          shadowColor: isDark ? '#000000' : vibe.color, // Colored glow in light mode
        }
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        style={styles.vibeTouchableArea}
      >
        <Animated.View 
          style={[
            styles.vibeCard, 
            { 
              backgroundColor,
              borderColor,
              borderWidth: 1.5,
            }
          ]}
        >
          <Animated.View style={[styles.vibeIconContainer, { backgroundColor: iconCircleBg }]}>
            <MaterialCommunityIcons name={vibe.icon} size={26} color={isSelected ? '#FFFFFF' : vibe.color} />
          </Animated.View>
          <Animated.Text style={[styles.vibeCardLabel, { color: textColor }]}>
            {vibe.name}
          </Animated.Text>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const VibeSignal = ({ onVibeChange, styles, colors, isDark }) => {
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
          colors={colors}
          isDark={isDark}
        />
      ))}
    </View>
  );
};

// ------------------------------------------------------------------
// 3. MAIN SCREEN COMPONENT
// ------------------------------------------------------------------
const VibeSignalScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
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
        duration: 500,
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
          <MaterialCommunityIcons name="chevron-left" size={32} color={colors.text} />
        </TouchableOpacity>
        {isPremium && (
          <View style={styles.premiumBadge}>
            <MaterialCommunityIcons name="star-four-points" size={12} color={colors.primary} />
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
          
          <View style={styles.widgetCard}>
            <View style={styles.widgetHeader}>
              <View style={styles.liveIndicator}>
                <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
              </View>
              <Text style={styles.widgetTitle}>Live Sync</Text>
            </View>
            <View style={styles.widgetBodyCentered}>
              <View style={styles.avatarGroup}>
                <View style={[styles.avatar, styles.avatarLeft, { backgroundColor: colors.surface, borderColor: colors.background }]}>
                  <Text style={[styles.avatarInitial, { color: colors.text }]}>Y</Text>
                </View>
                <View style={[styles.avatar, styles.avatarRight, { backgroundColor: colors.primary, borderColor: colors.background }]}>
                  <Text style={[styles.avatarInitial, { color: '#FFFFFF' }]}>
                    {partnerLabel.charAt(0).toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.widgetSubtitle}>Connected</Text>
            </View>
          </View>

          <View style={styles.widgetCard}>
            <View style={styles.widgetHeader}>
              <MaterialCommunityIcons name="chart-bar" size={16} color={colors.text + '80'} />
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
                                backgroundColor: value > 70 ? colors.primary : colors.text + '40'
                              }
                            ]} 
                          />
                        </View>
                        <Text style={[styles.chartDayLabel, isActive && { color: colors.text }]}>{days[index]}</Text>
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
          <MaterialCommunityIcons name="check-circle" size={24} color={colors.primary} />
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
            <MaterialCommunityIcons name="loading" size={20} color={isDark ? '#000' : '#fff'} />
          ) : (
            <MaterialCommunityIcons name="waveform" size={20} color={isDark ? '#000' : '#fff'} />
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
            <MaterialCommunityIcons name="chevron-left" size={32} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.paywallContent}>
            <View style={styles.paywallIconContainer}>
              <MaterialCommunityIcons name="waveform" size={48} color={colors.primary} />
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
        bounces={false}
      >
        {renderHeader()}
        
        <Animated.View style={[styles.vibeSignalWrapper, { opacity: fadeAnimation, transform: [{ translateY: slideAnimation }] }]}>
          <VibeSignal 
            onVibeChange={handleVibeChange} 
            styles={styles} 
            colors={colors} 
            isDark={isDark} 
          />
        </Animated.View>
        
        {renderWidgets()}
        <View style={styles.spacer} />
        {renderAction()}
      </ScrollView>
    </SafeAreaView>
  );
};

// ------------------------------------------------------------------
// 4. COMBINED STYLES 
// ------------------------------------------------------------------
const createStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: SPACING.xl,
    justifyContent: 'flex-start',
  },
  spacer: {
    flex: 1, 
  },
  
  // Header
  header: {
    paddingHorizontal: SPACING.xl,
    paddingTop: Platform.OS === 'android' ? SPACING.xl : SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    marginLeft: -8, 
  },
  backButton: {
    padding: 8,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.full,
    gap: 4,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.primary,
  },
  headerEditorial: {
    paddingRight: SPACING.xl, 
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.3,
    marginBottom: 4,
    fontFamily: Platform.select({ ios: "System", android: "Roboto" }),
  },
  headerSubtitle: {
    fontSize: 15,
    color: colors.text + '99',
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
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: isDark ? 0.3 : 0.15,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  vibeTouchableArea: {
    width: '100%',
  },
  vibeCard: {
    borderRadius: 24,
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: 1, 
  },
  vibeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  vibeCardLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    textAlign: 'center',
  },

  // Widget Dashboard
  widgetSection: {
    paddingHorizontal: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
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
    backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
    borderRadius: 22,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    ...Platform.select({
      ios: {
        shadowColor: isDark ? '#000' : '#8A8A8E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.3 : 0.08,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
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
    color: colors.text + '99',
    letterSpacing: -0.2,
  },
  liveIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  avatarLeft: { zIndex: 2 },
  avatarRight: { marginLeft: -16, zIndex: 1 },
  avatarInitial: { fontSize: 16, fontWeight: '700' },
  widgetSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
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
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    borderRadius: 3,
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  chartBarFill: { width: '100%', borderRadius: 3 },
  chartDayLabel: { fontSize: 9, fontWeight: '700', color: colors.text + '50' },
  emptyChartState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyChartText: { fontSize: 11, color: colors.text + '60', fontWeight: '500' },

  // Action / Bottom Bar
  actionSection: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
  },
  primaryButton: {
    backgroundColor: colors.text,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: 27,
    gap: 8,
  },
  primaryButtonText: {
    color: isDark ? '#000000' : '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: SPACING.lg,
    height: 54,
    borderRadius: 27,
    gap: 12,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
  },
  successTextContainer: { flex: 1 },
  successTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  successSubtitle: { fontSize: 12, color: colors.text + '90' },

  // Paywall
  paywallContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  paywallBackButton: { position: 'absolute', top: 60, left: 20 },
  paywallContent: { alignItems: 'center', paddingHorizontal: SPACING.xxl },
  paywallIconContainer: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primary + '15',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  paywallTitle: {
    fontSize: 30, fontWeight: '800', color: colors.text,
    textAlign: 'center', marginBottom: SPACING.md, letterSpacing: -0.5,
  },
  paywallDescription: {
    fontSize: 15, color: colors.text + '99', textAlign: 'center',
    lineHeight: 22, marginBottom: SPACING.xxxl,
  },
  paywallButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16, paddingHorizontal: 40,
    borderRadius: 30, width: '100%', alignItems: 'center',
  },
  paywallButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
});

export default VibeSignalScreen;
