/**
 * VibeSignalScreen — Emotional real-time sync
 * Sexy Red Intimacy & Apple Editorial Updates Integrated.
 * Sync your energy in real-time with high-end tactile feedback.
 */

import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
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
import { impact, ImpactFeedbackStyle } from '../utils/haptics';
import LiveVibeSync from '../components/LiveVibeSync';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useTheme } from '../context/ThemeContext';
import { useTogetherPresence } from '../hooks/useTogetherPresence';
import { PremiumFeature } from '../utils/featureFlags';
import { SPACING, withAlpha } from '../utils/theme';
import { vibeStorage } from '../utils/storage';
import { NicknameEngine } from '../services/PolishEngine';
import { getPartnerDisplayName } from '../utils/profileNames';

const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });

// ------------------------------------------------------------------
// 1. VIBE CONFIGURATION (Sexy Red & iOS Systems)
// ------------------------------------------------------------------
const VIBES = [
  { id: 'passionate',  name: 'Passionate', icon: 'flame-outline',    color: '#D2121A' }, // Primary sexy red
  { id: 'tender',      name: 'Tender',     icon: 'heart-outline',    color: '#FF6B98' },
  { id: 'serene',      name: 'Serene',     icon: 'leaf-outline',     color: '#32ADE6' },
  { id: 'adventurous', name: 'Playful',    icon: 'sparkles-outline', color: '#FF9500' },
  { id: 'mysterious',  name: 'Mysterious', icon: 'moon-outline',     color: '#5856D6' },
  { id: 'luxurious',   name: 'Grounded',   icon: 'infinite-outline', color: '#AF52DE' },
];

// Color representing the partner in the Flux History chart
const PARTNER_COLOR = '#FF6B98';

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
        accessibilityRole="button"
        accessibilityLabel={`${vibe.name} vibe${isSelected ? ', selected' : ''}`}
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
    primary:          colors.primary || '#D2121A',
    text:             colors.text,
    subtext:          isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60,60,67,0.6)',
    border:           isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);
  const { state } = useAppContext();
  const { userProfile } = useAuth();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const partnerLabel = getPartnerDisplayName(userProfile, state?.userProfile, 'Partner');
  const { isTogetherNow } = useTogetherPresence();

  const [activeVibeId, setActiveVibeId] = useState('passionate');
  const [userInitial,  setUserInitial]  = useState('');
  // { mine: number[7], partner: number[7] } — pulse count per day (Mon–Sun)
  const [fluxData,     setFluxData]     = useState(null);

  const loadFluxData = useCallback(() => {
    Promise.all([
      vibeStorage.getRecentVibes(7),
      vibeStorage.getRecentPartnerVibes(7),
    ]).then(([myVibes, partnerVibes]) => {
      if ((!myVibes || myVibes.length === 0) && (!partnerVibes || partnerVibes.length === 0)) {
        setFluxData(null);
        return;
      }
      const orderedDays = [1, 2, 3, 4, 5, 6, 0]; // Mon–Sun
      const countByDay = (vibes) => {
        const buckets = [0, 0, 0, 0, 0, 0, 0];
        for (const v of (vibes || [])) {
          const dow = new Date(v.timestamp).getDay();
          buckets[dow]++;
        }
        return orderedDays.map(d => buckets[d]);
      };
      setFluxData({ mine: countByDay(myVibes), partner: countByDay(partnerVibes) });
    }).catch(() => setFluxData(null));
  }, []);

  const handleVibeSelect = useCallback((vibe) => {
    setActiveVibeId(vibe.id);
    impact(ImpactFeedbackStyle.Medium);
    vibeStorage.addVibeEntry(vibe, state.userId)
      .then(() => loadFluxData())
      .catch(() => {});
  }, [state.userId, loadFluxData]);

  const entranceFade  = useRef(new Animated.Value(0)).current;
  const entranceSlide = useRef(new Animated.Value(20)).current;

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

    loadFluxData();
  }, [loadFluxData]);

  // Re-load chart whenever a new partner vibe arrives via realtime
  const partnerVibe = state?.partnerVibe;
  useEffect(() => {
    if (partnerVibe) loadFluxData();
  }, [partnerVibe, loadFluxData]);

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
            Share your emotional state and send your partner a tactile pulse through high-end synchronized signals.
          </Text>
          <TouchableOpacity
            onPress={() => showPaywall?.(PremiumFeature.VIBE_SIGNAL)}
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
                  <Icon name="sparkles-outline" size={12} color={t.primary} />
                  <Text style={[styles.premiumBadgeText, { color: t.primary }]}>PREMIUM</Text>
                </View>
              )}
            </View>
            <View style={styles.headerEditorial}>
              <Text style={[styles.headerTitle, { color: t.text }]}>Vibe Signal</Text>
              <Text style={[styles.headerSubtitle, { color: t.subtext }]}>Shared mood, synced when connected.</Text>
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
                    <View style={[styles.liveDot, { backgroundColor: isTogetherNow ? '#34C759' : t.subtext }]} />
                  </View>
                  <Text style={[styles.widgetTitle, { color: t.subtext }]}>Live Sync</Text>
                </View>
                <View style={styles.widgetBodyCentered}>
                  <View style={styles.avatarGroup}>
                    <View style={[styles.avatar, { backgroundColor: '#FFFFFF', borderColor: t.surface }]}>
                      <Text style={{ color: '#000000', fontWeight: '800', fontSize: 18 }}>{userInitial || '?'}</Text>
                    </View>
                    <View style={[styles.avatar, { backgroundColor: isTogetherNow ? t.primary : t.border, borderColor: t.surface, marginLeft: -12 }]}>
                      <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 18 }}>{partnerLabel.charAt(0).toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={[styles.widgetStatus, { color: isTogetherNow ? t.text : t.subtext }]}>
                    {isTogetherNow ? 'Together now' : 'Not online'}
                  </Text>
                </View>
              </View>

              {/* Energy / Flux History Widget */}
              <View style={[styles.widgetCard, { backgroundColor: t.surface, borderColor: t.border }]}>
                <View style={styles.widgetHeader}>
                  <Icon name="bar-chart-outline" size={14} color={t.subtext} />
                  <Text style={[styles.widgetTitle, { color: t.subtext }]}>Flux History</Text>
                </View>
                {/* Legend */}
                <View style={styles.chartLegend}>
                  <View style={styles.chartLegendItem}>
                    <View style={[styles.chartLegendDot, { backgroundColor: t.primary }]} />
                    <Text style={[styles.chartLegendLabel, { color: t.subtext }]}>You</Text>
                  </View>
                  <View style={styles.chartLegendItem}>
                    <View style={[styles.chartLegendDot, { backgroundColor: PARTNER_COLOR }]} />
                    <Text style={[styles.chartLegendLabel, { color: t.subtext }]}>{partnerLabel}</Text>
                  </View>
                </View>
                <View style={styles.chartArea}>
                  {(() => {
                    const allCounts = (fluxData?.mine || []).concat(fluxData?.partner || []);
                    const maxCount = Math.max(1, ...allCounts);
                    const maxH = 44;
                    return ['M','T','W','T','F','S','S'].map((day, i) => {
                      const myVal      = fluxData?.mine?.[i] ?? 0;
                      const partnerVal = fluxData?.partner?.[i] ?? 0;
                      const myH        = myVal > 0      ? Math.max(Math.round((myVal / maxCount) * maxH), 5)      : 2;
                      const partnerH   = partnerVal > 0 ? Math.max(Math.round((partnerVal / maxCount) * maxH), 5) : 2;
                      const hasAny     = myVal > 0 || partnerVal > 0;
                      return (
                        <View key={i} style={styles.chartColumn}>
                          <View style={styles.chartTrack}>
                            <View style={styles.chartDualBars}>
                              <View style={[styles.chartBar, { height: myH,      backgroundColor: myVal > 0      ? t.primary      : t.surfaceSecondary }]} />
                              <View style={[styles.chartBar, { height: partnerH, backgroundColor: partnerVal > 0 ? PARTNER_COLOR : t.surfaceSecondary }]} />
                            </View>
                          </View>
                          <Text style={[styles.chartDayLabel, { color: hasAny ? t.text : t.subtext }]}>{day}</Text>
                        </View>
                      );
                    });
                  })()}
                </View>
              </View>

            </View>
          </View>

          <LiveVibeSync partnerLabel={partnerLabel} />

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
  chartTrack:       { height: 44, justifyContent: 'flex-end' },
  chartDualBars:    { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  chartBar:         { width: 5, borderRadius: 3 },
  chartDayLabel:    { fontSize: 9, fontWeight: '700', marginTop: 4 },
  chartLegend:      { flexDirection: 'row', gap: 10, marginBottom: 10 },
  chartLegendItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chartLegendDot:   { width: 6, height: 6, borderRadius: 3 },
  chartLegendLabel: { fontSize: 9, fontWeight: '700' },
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
  primaryButton: {
    width:          '100%',
    paddingVertical: 18,
    borderRadius:   28,
    alignItems:     'center',
    justifyContent: 'center',
    shadowOffset:   { width: 0, height: 8 },
    shadowOpacity:  0.3,
    shadowRadius:   16,
    elevation:      6,
  },
  primaryButtonText: {
    fontFamily:    SYSTEM_FONT,
    fontSize:      16,
    fontWeight:    '800',
    color:         '#FFFFFF',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
