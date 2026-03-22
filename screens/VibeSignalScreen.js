/**
 * VibeSignalScreen — Emotional real-time sync
 * Sexy Red Intimacy & Apple Editorial Updates Integrated.
 * Sync your energy in real-time with high-end tactile feedback.
 */

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
  ActivityIndicator,
} from 'react-native';
import Icon from '../components/Icon';
import { impact, notification, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { useAppContext } from '../context/AppContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useTheme } from '../context/ThemeContext';
import { SPACING, withAlpha } from '../utils/theme';
import { vibeStorage } from '../utils/storage';
import { MomentSignalSender } from '../services/ConnectionEngine';
import { NicknameEngine } from '../services/PolishEngine';

const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });

// ------------------------------------------------------------------
// 1. VIBE CONFIGURATION (Sexy Red & iOS Systems)
// ------------------------------------------------------------------
const VIBES = [
  { id: 'passionate',  name: 'Passionate', icon: 'flame-outline',    color: '#C3113D' }, // Primary sexy red
  { id: 'tender',      name: 'Tender',     icon: 'heart-outline',    color: '#FF6B98' },
  { id: 'serene',      name: 'Serene',     icon: 'leaf-outline',     color: '#32ADE6' },
  { id: 'adventurous', name: 'Playful',    icon: 'sparkles-outline', color: '#FF9500' },
  { id: 'mysterious',  name: 'Mysterious', icon: 'moon-outline',     color: '#5856D6' },
  { id: 'luxurious',   name: 'Grounded',   icon: 'infinite-outline', color: '#AF52DE' },
];

// Vibe intensity mapping for the energy chart
const VIBE_INTENSITY = {
  passionate: 90, adventurous: 80, luxurious: 70,
  mysterious: 60, tender: 50,  serene: 30,
};

// ------------------------------------------------------------------
// 2. INLINE COMPONENTS (VibeCard)
// ------------------------------------------------------------------
const VibeCard = ({ vibe, isSelected, onPress, styles, t }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim  = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: isSelected ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.spring(scaleAnim, {
        toValue: isSelected ? 0.95 : 1,
        friction: 9,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isSelected]);

  const backgroundColor = fadeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [t.surface, vibe.color],
  });

  const textColor = fadeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [t.text, '#FFFFFF'],
  });

  return (
    <Animated.View style={[styles.vibeCardWrapper, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        style={styles.vibeTouchableArea}
      >
        <Animated.View style={[styles.vibeCard, { backgroundColor, borderColor: isSelected ? vibe.color : t.border }]}>
          <View style={[styles.vibeIconContainer, { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : withAlpha(vibe.color, 0.1) }]}>
            <Icon name={vibe.icon} size={28} color={isSelected ? '#FFFFFF' : vibe.color} />
          </View>
          <Animated.Text style={[styles.vibeCardLabel, { color: textColor }]}>
            {vibe.name.toUpperCase()}
          </Animated.Text>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ------------------------------------------------------------------
// 3. MAIN SCREEN COMPONENT
// ------------------------------------------------------------------
export default function VibeSignalScreen({ navigation }) {
  const { colors, isDark } = useTheme();

  // SEXY RED x APPLE EDITORIAL THEME MAP
  const t = useMemo(() => ({
    background:       colors.background,
    surface:          isDark ? '#131016' : '#FFFFFF',
    surfaceSecondary: isDark ? '#1C1520'  : '#F2F2F7',
    primary:          colors.primary || '#C3113D',
    text:             colors.text,
    subtext:          isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60,60,67,0.6)',
    border:           isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);
  const { state } = useAppContext();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const partnerLabel = state.partnerLabel || 'Partner';

  const [activeVibeId,      setActiveVibeId]      = useState('passionate');
  const handleVibeSelect = (vibe) => {
    setActiveVibeId(vibe.id);
    impact(ImpactFeedbackStyle.Medium);
    vibeStorage.addVibeEntry(vibe, state.userId).catch(() => {});
  };
  const [userInitial,       setUserInitial]        = useState('');
  const [weeklyData,        setWeeklyData]         = useState(null);
  const [heartbeatSending,  setHeartbeatSending]   = useState(false);
  const [heartbeatSent,     setHeartbeatSent]      = useState(false);
  const [heartbeatError,    setHeartbeatError]     = useState(null);

  const entranceFade       = useRef(new Animated.Value(0)).current;
  const entranceSlide      = useRef(new Animated.Value(20)).current;
  const heartbeatFadeAnim  = useRef(new Animated.Value(0)).current;
  const heartbeatScaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entranceFade,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(entranceSlide, { toValue: 0, friction: 9,   useNativeDriver: true }),
    ]).start();

    // Load user's own nickname initial
    NicknameEngine.getConfig().then(cfg => {
      const name = cfg?.myNickname?.trim();
      if (name) setUserInitial(name.charAt(0).toUpperCase());
    }).catch(() => {});

    // Real vibe history for the chart
    vibeStorage.getRecentVibes(7).then(vibes => {
      if (!vibes || vibes.length === 0) { setWeeklyData(null); return; }
      const buckets = [[], [], [], [], [], [], []];
      for (const v of vibes) {
        const dow    = new Date(v.timestamp).getDay();
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

  const handleSendHeartbeat = async () => {
    if (heartbeatSending) return;
    setHeartbeatSending(true);
    setHeartbeatError(null);

    impact(ImpactFeedbackStyle.Heavy);
    notification(NotificationFeedbackType.Success);
    setHeartbeatSent(true);
    heartbeatScaleAnim.setValue(0.95);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(heartbeatFadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(2500),
        Animated.timing(heartbeatFadeAnim,  { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.spring(heartbeatScaleAnim, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
    ]).start(() => {
      setHeartbeatSent(false);
      setHeartbeatSending(false);
    });

    // Double haptic for high-end feel
    setTimeout(() => impact(ImpactFeedbackStyle.Heavy).catch?.(() => {}), 300);

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

  // ── Paywall Gate ──────────────────────────────────────────────────
  if (!isPremium) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: t.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.paywallContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.paywallBack}>
            <Icon name="chevron-back" size={28} color={t.text} />
          </TouchableOpacity>
          <View style={[styles.iconHero, { backgroundColor: withAlpha(t.primary, 0.12) }]}>
            <Icon name="pulse-outline" size={42} color={t.primary} />
          </View>
          <Text style={styles.paywallTitle}>Vibe Signals</Text>
          <Text style={styles.paywallDescription}>
            Share your emotional state and feel your partner's heartbeat through high-end synchronized signals.
          </Text>
          <TouchableOpacity
            onPress={() => showPaywall?.('vibeSync')}
            style={[styles.primaryButton, { backgroundColor: t.primary }]}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryButtonText}>Unlock Pro Sync</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main Screen ───────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <Animated.View style={{ opacity: entranceFade, transform: [{ translateY: entranceSlide }] }}>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Icon name="chevron-back" size={28} color={t.text} />
              </TouchableOpacity>
              {isPremium && (
                <View style={[styles.premiumBadge, { backgroundColor: withAlpha(t.primary, 0.15) }]}>
                  <Icon name="star-four-points" size={12} color={t.primary} />
                  <Text style={[styles.premiumBadgeText, { color: t.primary }]}>PREMIUM</Text>
                </View>
              )}
            </View>
            <View style={styles.headerEditorial}>
              <Text style={[styles.headerTitle, { color: t.text }]}>Vibe Signal</Text>
              <Text style={[styles.headerSubtitle, { color: t.subtext }]}>Real-time intimacy bridge.</Text>
            </View>
          </View>

          {/* Vibe Grid */}
          <View style={styles.vibeGridContainer}>
            {VIBES.map((vibe) => (
              <VibeCard
                key={vibe.id}
                vibe={vibe}
                isSelected={activeVibeId === vibe.id}
                onPress={() => handleVibeSelect(vibe)}
                styles={styles}
                t={t}
              />
            ))}
          </View>

          {/* Insights Dashboard */}
          <View style={styles.widgetSection}>
            <Text style={[styles.sectionTitle, { color: t.text }]}>Relationship Flux</Text>
            <View style={styles.gridRow}>

              {/* Live Sync Widget */}
              <View style={[styles.widgetCard, { backgroundColor: t.surface, borderColor: t.border }]}>
                <View style={styles.widgetHeader}>
                  <View style={styles.liveIndicator}>
                    <View style={styles.liveDot} />
                  </View>
                  <Text style={[styles.widgetTitle, { color: t.subtext }]}>Live Sync</Text>
                </View>
                <View style={styles.widgetBodyCentered}>
                  <View style={styles.avatarGroup}>
                    <View style={[styles.avatar, { backgroundColor: '#FFFFFF', borderColor: t.surface }]}>
                      <Text style={{ color: '#000000', fontWeight: '800', fontSize: 18 }}>{userInitial || '?'}</Text>
                    </View>
                    <View style={[styles.avatar, { backgroundColor: t.primary, borderColor: t.surface, marginLeft: -12 }]}>
                      <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 18 }}>{partnerLabel.charAt(0).toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={[styles.widgetStatus, { color: t.text }]}>Connected</Text>
                </View>
              </View>

              {/* Energy / Flux History Widget */}
              <View style={[styles.widgetCard, { backgroundColor: t.surface, borderColor: t.border }]}>
                <View style={styles.widgetHeader}>
                  <Icon name="analytics-outline" size={14} color={t.subtext} />
                  <Text style={[styles.widgetTitle, { color: t.subtext }]}>Flux History</Text>
                </View>
                <View style={styles.chartArea}>
                  {['M','T','W','T','F','S','S'].map((day, i) => {
                    const val = weeklyData?.[i] ?? 0;
                    const maxH = 56;
                    const barH = val > 0 ? Math.max(Math.round((val / 100) * maxH), 6) : 3;
                    const isActive = val > 0;
                    return (
                      <View key={i} style={styles.chartColumn}>
                        <View style={styles.chartTrack}>
                          <View
                            style={[
                              styles.chartBar,
                              {
                                height: barH,
                                backgroundColor: val > 70 ? t.primary : isActive ? withAlpha(t.primary, 0.35) : t.surfaceSecondary,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.chartDayLabel, { color: isActive ? t.text : t.subtext }]}>{day}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

            </View>
          </View>

          {/* Core Action */}
          <View style={styles.actionContainer}>
            {heartbeatSent ? (
              <Animated.View
                style={[
                  styles.successContainer,
                  {
                    opacity:   heartbeatFadeAnim,
                    transform: [{ scale: heartbeatScaleAnim }],
                    backgroundColor: t.surface,
                    borderColor:     t.border,
                  },
                ]}
              >
                <Icon name="check-circle" size={24} color={t.primary} />
                <View style={styles.successTextContainer}>
                  <Text style={[styles.successTitle, { color: t.text }]}>Sent to {partnerLabel}</Text>
                  <Text style={[styles.successSubtitle, { color: t.subtext }]} numberOfLines={1}>
                    {heartbeatError || "They'll feel it momentarily"}
                  </Text>
                </View>
              </Animated.View>
            ) : (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: t.primary, opacity: heartbeatSending ? 0.7 : 1 }]}
                onPress={handleSendHeartbeat}
                disabled={heartbeatSending}
                activeOpacity={0.9}
              >
                {heartbeatSending ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Icon name="heart" size={20} color="#FFF" />
                    <Text style={styles.primaryButtonText}>Send Heartbeat</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            <Text style={[styles.actionHint, { color: t.subtext }]}>
              Sends a high-end tactile pulse to {partnerLabel}.
            </Text>
          </View>

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ------------------------------------------------------------------
// 4. STYLES — Sexy Red x Apple Editorial
// ------------------------------------------------------------------
const createStyles = (t, isDark) => StyleSheet.create({
  container:     { flex: 1 },
  scrollContent: { paddingBottom: 120 },

  // Header
  header: {
    paddingHorizontal: 24,
    paddingTop:  Platform.OS === 'android' ? 20 : 12,
    marginBottom: 32,
  },
  headerTopRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   12,
    marginLeft:     -8,
  },
  backButton: { padding: 8 },
  premiumBadge: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingHorizontal: 10,
    paddingVertical:    5,
    borderRadius: 20,
    gap: 4,
  },
  premiumBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  headerEditorial:  { paddingRight: SPACING.xl },
  headerTitle: {
    fontFamily:   SYSTEM_FONT,
    fontSize:     36,
    fontWeight:   '900',
    letterSpacing: -1,
    lineHeight:   42,
    marginBottom:  4,
  },
  headerSubtitle: { fontFamily: SYSTEM_FONT, fontSize: 16, fontWeight: '500' },

  // Vibe Grid
  vibeGridContainer: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           12,
    paddingHorizontal: 24,
    marginBottom:  40,
  },
  vibeCardWrapper: {
    width: '48%',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 10 },
      android: { elevation: 2 },
    }),
  },
  vibeTouchableArea: { width: '100%' },
  vibeCard: {
    borderRadius: 24,
    padding:      20,
    alignItems:   'center',
    justifyContent: 'center',
    aspectRatio:  1,
    borderWidth:  1,
  },
  vibeIconContainer: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  vibeCardLabel: { fontFamily: SYSTEM_FONT, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },

  // Widgets
  widgetSection: { paddingHorizontal: 24, marginBottom: 40 },
  sectionTitle:  { fontFamily: SYSTEM_FONT, fontSize: 20, fontWeight: '800', marginBottom: 16, letterSpacing: -0.3 },
  gridRow:       { flexDirection: 'row', gap: 12 },
  widgetCard: {
    flex: 1,
    borderRadius: 24,
    padding:      20,
    borderWidth:  1,
    minHeight:    140,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 12 },
      android: { elevation: 2 },
    }),
  },
  widgetHeader:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  widgetTitle:       { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  liveIndicator: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  liveDot:           { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34C759' },
  widgetBodyCentered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarGroup:       { flexDirection: 'row', marginBottom: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  widgetStatus: { fontSize: 14, fontWeight: '700' },
  chartArea:        { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  chartColumn:      { flex: 1, alignItems: 'center' },
  chartTrack:       { height: 56, justifyContent: 'flex-end' },
  chartBar:         { width: 5, borderRadius: 3 },
  chartDayLabel:    { fontSize: 9, fontWeight: '700', marginTop: 4 },

  // Action
  actionContainer: {
    paddingHorizontal: 24,
    alignItems:        'center',
    paddingTop:        SPACING.xl,
    paddingBottom:     16,
  },
  primaryButton: {
    height:         56,
    borderRadius:   28,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            10,
    width:          '100%',
    ...Platform.select({
      ios:     { shadowColor: '#C3113D', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12 },
      android: { elevation: 4 },
    }),
  },
  primaryButtonText: {
    color:         '#FFF',
    fontFamily:    SYSTEM_FONT,
    fontSize:      16,
    fontWeight:    '800',
    textTransform: 'uppercase',
    letterSpacing: -0.2,
  },
  successContainer: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: SPACING.lg,
    height:         56,
    borderRadius:   28,
    gap:            12,
    width:          '100%',
    borderWidth:    1,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0 : 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  successTextContainer: { flex: 1 },
  successTitle:         { fontSize: 15, fontWeight: '600' },
  successSubtitle:      { fontSize: 13 },
  actionHint:           { fontSize: 12, fontWeight: '600', marginTop: 12, textAlign: 'center' },

  // Paywall
  paywallContent:  { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  paywallBack:     { position: 'absolute', top: 20, left: 20 },
  iconHero:        { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  paywallTitle: {
    fontFamily:    SYSTEM_FONT,
    fontSize:      32,
    fontWeight:    '800',
    textAlign:     'center',
    color:         t.text,
    marginBottom:  12,
    letterSpacing: -0.5,
  },
  paywallDescription: {
    fontFamily:  SYSTEM_FONT,
    fontSize:    16,
    fontWeight:  '500',
    textAlign:   'center',
    color:       t.subtext,
    lineHeight:  24,
    marginBottom: 40,
  },
});
