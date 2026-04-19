/**
 * BETWEEN US - INTIMACY POSITIONS ENGINE
 * Matches HomeScreen.js — Crisp solid widgets, native typography, heavy shadows.
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
  StatusBar,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

// Context & Services
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useAuth } from '../context/AuthContext';
import { getPartnerDisplayName } from '../utils/profileNames';

// Utilities & Components
import { SPACING } from '../utils/theme';
import Icon from '../components/Icon';
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';
import IntimacyPositionCard from '../components/IntimacyPositionCard';
import positionsData from '../content/intimacy-positions.json';
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const systemFont = Platform.select({ ios: "System", android: "Roboto" });

// Calculate weeks since intimacy positions launch
const LAUNCH_DATE = new Date('2026-04-18');
function getCurrentWeek() {
  const now = new Date();
  return Math.floor((now - LAUNCH_DATE) / (7 * 24 * 60 * 60 * 1000));
}

export default function IntimacyPositionsScreen() {
  const { colors, isDark } = useTheme();
  const { isPremiumEffective, showPaywall } = useEntitlements();
  const { userProfile } = useAuth();
  const navigation = useNavigation();
  
  const [selectedIndex, setSelectedIndex] = useState(0);

  // ─── THEME MAP ───
  const t = useMemo(() => ({
    background: colors.background,
    surface: colors.surface || (isDark ? '#1C1C1E' : '#FFFFFF'), 
    surfaceSecondary: colors.surface2 || (isDark ? '#2C2C2E' : '#F2F2F7'),
    primary: colors.primary || '#D2121A', // Sexy Red
    accent: colors.accent || '#D4AA7E',
    text: colors.text,
    subtext: colors.textMuted || (isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)'),
    border: colors.border || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
  }), [colors, isDark]);

  const currentWeek = getCurrentWeek();
  const partnerLabel = getPartnerDisplayName(userProfile, null, 'your partner');

  const availablePositions = useMemo(() => {
    return positionsData.items.filter(
      (p) => p.id.startsWith('ip') && !p.id.includes('-q') && (p.releaseWeek ?? 0) <= currentWeek
    );
  }, [currentWeek]);

  const position = availablePositions[selectedIndex];

  // ─── ANIMATIONS ───
  const headerAnim = useRef(new Animated.Value(0)).current;
  const pickerAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(pickerAnim, { toValue: 1, friction: 9, tension: 60, useNativeDriver: true }),
      Animated.spring(cardAnim, { toValue: 1, friction: 9, tension: 60, useNativeDriver: true }),
    ]).start();
  }, [headerAnim, pickerAnim, cardAnim]);

  // ─── HANDLERS ───
  const handleBack = useCallback(() => {
    impact(ImpactFeedbackStyle.Light);
    navigation.goBack();
  }, [navigation]);

  const handlePaywall = useCallback(() => {
    impact(ImpactFeedbackStyle.Medium);
    showPaywall?.('HEAT_LEVELS_4_5');
  }, [showPaywall]);

  // ════════════════════════════════════
  //  LOCKED STATE RENDER
  // ════════════════════════════════════
  if (!isPremiumEffective) {
    return (
      <View style={[styles.root, { backgroundColor: t.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <LinearGradient
          colors={isDark 
            ? [t.background, '#120206', '#0A0003', t.background] 
            : [t.background, t.surfaceSecondary, t.background]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        <FilmGrain />
        <GlowOrb color={t.primary} size={500} top={-200} left={SCREEN_WIDTH - 200} opacity={isDark ? 0.2 : 0.08} />
        <GlowOrb color="#8E8E93" size={300} top={SCREEN_HEIGHT * 0.7} left={-100} delay={1500} opacity={isDark ? 0.12 : 0.07} />

        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.navHeader}>
            <TouchableOpacity onPress={handleBack} hitSlop={16} style={styles.iconButton}>
              <Icon name="arrow-back" size={24} color={t.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.lockedWrap}>
            <Animated.View style={{
              opacity: cardAnim,
              transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
            }}>
              <View style={[styles.heroCardWrap, { backgroundColor: t.surface, borderColor: t.border, ...getShadow(isDark) }]}>
                <View style={styles.eyebrowRow}>
                  <Icon name="star-outline" size={14} color={t.accent} />
                  <Text style={[styles.eyebrow, { color: t.accent }]}>PREMIUM</Text>
                </View>
                
                <Text style={[styles.promptText, { color: t.text }]}>
                  Unlock Intimacy
                </Text>
                
                <View style={[styles.answerBubble, { backgroundColor: t.surfaceSecondary, borderColor: t.border }]}>
                  <Text style={[styles.answerText, { color: t.text }]}>
                    Discover beautifully illustrated, high-end intimacy positions designed for deep connection. New releases added every week.
                  </Text>
                </View>

                <TouchableOpacity 
                  style={[styles.cta, { backgroundColor: t.text }]} 
                  onPress={handlePaywall} 
                  activeOpacity={0.85}
                >
                  <Text style={[styles.ctaLabel, { color: isDark ? '#000000' : '#FFFFFF' }]}>Unlock Premium</Text>
                  <Icon name="arrow-forward-outline" size={20} color={isDark ? "#000000" : "#FFFFFF"} />
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ════════════════════════════════════
  //  UNLOCKED STATE RENDER
  // ════════════════════════════════════
  return (
    <View style={[styles.root, { backgroundColor: t.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <LinearGradient
        colors={isDark 
          ? [t.background, '#120206', '#0A0003', t.background] 
          : [t.background, t.surfaceSecondary, t.background]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <FilmGrain />
      <GlowOrb color={t.primary} size={500} top={-200} left={SCREEN_WIDTH - 200} opacity={isDark ? 0.2 : 0.08} />
      <GlowOrb color="#8E8E93" size={300} top={SCREEN_HEIGHT * 0.7} left={-100} delay={1500} opacity={isDark ? 0.12 : 0.07} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        
        {/* ── Header ── */}
        <Animated.View
          style={[styles.header, {
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }],
          }]}
        >
          <View style={styles.headerLeft}>
            <Text style={[styles.headerGreetingSub, { color: t.primary }]}>
              WEEKLY RELEASES
            </Text>
            <Text style={[styles.headerName, { color: t.text }]} numberOfLines={1}>Intimacy</Text>
            <Text style={[styles.headerToneLine, { color: t.subtext }]}>
              A closer space for you and {partnerLabel}.
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={handleBack}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.vibeButton, { backgroundColor: t.surface, borderColor: t.border, ...getShadow(isDark) }]}
            >
              <Icon name="close" size={24} color={t.text} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ── Position Picker (Pills) ── */}
          <Animated.View style={{
            opacity: pickerAnim,
            transform: [{ translateY: pickerAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
          }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pickerRow}
              style={styles.pickerScroll}
            >
              {availablePositions.map((p, i) => {
                const active = i === selectedIndex;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => {
                      selection();
                      setSelectedIndex(i);
                    }}
                    activeOpacity={0.7}
                    style={[
                      styles.pickerPill,
                      {
                        backgroundColor: active ? t.primary : t.surfaceSecondary,
                        borderColor: active ? t.primary : t.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pickerText,
                        { color: active ? '#FFFFFF' : t.text },
                      ]}
                    >
                      {p.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>

          {/* ── Position Card ── */}
          <View style={styles.cardContainer}>
            {position && (
              <Animated.View style={{
                opacity: cardAnim,
                transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
              }}>
                <IntimacyPositionCard
                  key={position.id} 
                  position={position}
                  t={t}
                  isDark={isDark}
                />
              </Animated.View>
            )}
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const getShadow = (isDark) => Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: isDark ? 0.4 : 0.08, shadowRadius: 24 },
  android: { elevation: 6 },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { paddingBottom: 160 },
  
  navHeader: {
    paddingHorizontal: SPACING.screen,
    paddingTop: 12,
    paddingBottom: 4,
    flexDirection: 'row',
  },
  iconButton: {
    padding: 8,
    marginLeft: -8,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.screen,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  headerLeft: { flex: 1 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerGreetingSub: {
    fontFamily: systemFont,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  headerName: {
    fontFamily: systemFont,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  headerToneLine: {
    fontFamily: systemFont,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  vibeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Picker ──
  pickerScroll: {
    flexGrow: 0,
    marginBottom: SPACING.xl,
  },
  pickerRow: {
    paddingHorizontal: SPACING.screen,
    gap: 8,
  },
  pickerPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20, 
    borderWidth: 1,
  },
  pickerText: {
    fontFamily: systemFont,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  cardContainer: {
    paddingHorizontal: SPACING.screen,
  },

  // ── Hero Card (Locked State) ──
  lockedWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.screen,
    paddingBottom: 60,
  },
  heroCardWrap: { 
    borderRadius: 24, 
    borderWidth: 1,
    padding: SPACING.xl,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  eyebrow: {
    fontFamily: systemFont,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  promptText: {
    fontFamily: systemFont,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    letterSpacing: -0.5,
    marginBottom: SPACING.xl,
  },
  answerBubble: {
    borderRadius: 20,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  answerText: {
    fontFamily: systemFont,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '400',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56, 
    borderRadius: 28,
    gap: 8,
  },
  ctaLabel: {
    fontFamily: systemFont,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
});
