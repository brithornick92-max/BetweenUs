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
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

// Context & Services
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useAuth } from '../context/AuthContext';
import { getPartnerDisplayName } from '../utils/profileNames';

// Utilities & Components
import { SPACING } from '../utils/theme';
import Icon from '../components/Icon';
import IntimacyPositionCard from '../components/IntimacyPositionCard';
import positionsData from '../content/intimacy-positions.json';
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';
import EditorialScreenScaffold from '../components/EditorialScreenScaffold';

const systemFont = Platform.select({ ios: "System", android: "Roboto" });
const serifFont = Platform.select({ ios: 'Georgia', android: 'serif' });

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
    borderGlass: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
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
      <EditorialScreenScaffold
        navigation={navigation}
        headerTitle=""
        scroll={false}
        onBack={handleBack}
      >
          <View style={styles.lockedWrap}>
            <Animated.View
              style={{
                opacity: headerAnim,
                transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }],
              }}
            >
              <View style={styles.headerBlock}>
                <Text style={[styles.headerEyebrow, { color: t.primary }]}>INTIMACY</Text>
                <Text style={[styles.headerTitle, { color: t.text }]}>Unlock Intimacy</Text>
              </View>
            </Animated.View>
            <Animated.View style={{
              opacity: cardAnim,
              transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
            }}>
              <View style={styles.cardContainer}>
                <View style={[styles.editorialCard, styles.editorialCardColumn, { backgroundColor: t.surface, borderColor: t.borderGlass }, !isDark && styles.lightShadow]}>
                  <View style={styles.cardContent}>
                    <Text style={[styles.cardTag, { color: t.subtext }]}>PREMIUM ACCESS</Text>
                    <Text style={[styles.cardTitle, { color: t.text }]}>Unlock Intimacy</Text>
                    <Text style={[styles.cardEmail, { color: t.subtext }]}>A closer space for you and {partnerLabel}.</Text>
                  </View>

                  <View style={[styles.answerBubble, { backgroundColor: t.surfaceSecondary, borderColor: t.border }] }>
                    <Text style={[styles.answerText, { color: t.text }]}>Discover beautifully illustrated, high-end intimacy positions designed for deep connection. New releases added every week.</Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.cta, { backgroundColor: t.text }]}
                    onPress={handlePaywall}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.ctaLabel, { color: isDark ? '#000000' : '#FFFFFF' }]}>Unlock Premium</Text>
                    <Icon name="arrow-forward-outline" size={20} color={isDark ? '#000000' : '#FFFFFF'} />
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          </View>
      </EditorialScreenScaffold>
    );
  }

  // ════════════════════════════════════
  //  UNLOCKED STATE RENDER
  // ════════════════════════════════════
  return (
    <EditorialScreenScaffold
      navigation={navigation}
      headerTitle=""
      scroll={false}
      onBack={handleBack}
    >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Animated.View
            style={{
              opacity: headerAnim,
              transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }],
            }}
          >
            <View style={styles.headerBlock}>
              <Text style={[styles.headerEyebrow, { color: t.primary }]}>WEEKLY RELEASES</Text>
              <Text style={[styles.headerTitle, { color: t.text }]}>Intimacy</Text>
            </View>
          </Animated.View>

          <Animated.View
            style={{
              opacity: pickerAnim,
              transform: [{ translateY: pickerAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
            }}
          >
            <View style={styles.cardContainer}>
              <View style={[styles.editorialCard, styles.editorialCardColumn, styles.positionCardShell, { backgroundColor: t.surface, borderColor: t.borderGlass }, !isDark && styles.lightShadow]}>
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTag, { color: t.subtext }]}>ACTIVE COLLECTION</Text>
                  <Text style={[styles.cardTitle, { color: t.text }]}>Curated positions for deeper connection</Text>
                  <Text style={[styles.cardEmail, { color: t.subtext }]}>A closer space for you and {partnerLabel}.</Text>
                </View>

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

                {position && (
                  <Animated.View
                    style={{
                      opacity: cardAnim,
                      transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
                    }}
                  >
                    <IntimacyPositionCard
                      key={position.id}
                      position={position}
                      t={t}
                      isDark={isDark}
                    />
                  </Animated.View>
                )}
              </View>
            </View>
          </Animated.View>

        </ScrollView>
    </EditorialScreenScaffold>
  );
}

const getShadow = (isDark) => Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: isDark ? 0.4 : 0.08, shadowRadius: 24 },
  android: { elevation: 6 },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingBottom: 160 },
  headerBlock: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  headerEyebrow: {
    fontFamily: systemFont,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: systemFont,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 42,
  },
  cardContainer: {
    paddingHorizontal: 0,
    marginVertical: SPACING.md,
  },
  editorialCard: {
    borderRadius: 28,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  editorialCardColumn: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  positionCardShell: {
    paddingBottom: SPACING.xl,
  },
  lightShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
  },
  cardContent: {
    width: '100%',
    marginBottom: SPACING.lg,
  },
  cardTag: {
    fontFamily: systemFont,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  cardTitle: {
    fontFamily: systemFont,
    fontWeight: '800',
    fontSize: 24,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  cardEmail: {
    fontFamily: systemFont,
    fontWeight: '500',
    fontSize: 14,
  },
  // ── Picker ──
  pickerScroll: {
    flexGrow: 0,
    marginBottom: SPACING.xl,
  },
  pickerRow: {
    paddingHorizontal: 0,
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
  // ── Hero Card (Locked State) ──
  lockedWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 60,
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
