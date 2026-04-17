/**
 * IntimacyPositionsScreen — Browse premium intimacy positions
 * Weekly release schedule: 10 at launch (week 0), then 1/week.
 * Premium-gated with paywall upsell for free users.
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { SPACING, withAlpha } from '../utils/theme';
import Icon from '../components/Icon';
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';
import IntimacyPositionCard from '../components/IntimacyPositionCard';
import { getIllustrationForBodyType } from '../assets/intimacy-illustrations';
import positionsData from '../content/intimacy-positions.json';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Calculate weeks since intimacy positions launch (April 17, 2026)
const LAUNCH_DATE = new Date('2026-04-17');
function getCurrentWeek() {
  const now = new Date();
  return Math.floor((now - LAUNCH_DATE) / (7 * 24 * 60 * 60 * 1000));
}

export default function IntimacyPositionsScreen() {
  const { colors, isDark } = useTheme();
  const { isPremiumEffective } = useEntitlements();
  const navigation = useNavigation();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const currentWeek = getCurrentWeek();

  const availablePositions = useMemo(() => {
    return positionsData.items.filter(
      (p) => p.id.startsWith('ip') && !p.id.includes('-q') && (p.releaseWeek ?? 0) <= currentWeek
    );
  }, [currentWeek]);

  const position = availablePositions[selectedIndex];

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const handlePaywall = useCallback(() => {
    navigation.navigate('Paywall', { source: 'intimacy_positions' });
  }, [navigation]);

  const t = useMemo(() => ({
    background: colors.background,
    bg: isDark ? '#0D0B10' : colors.background,
    surfaceSecondary: colors.surface2,
    surface: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    text: colors.text,
    subtext: colors.textSecondary,
    muted: colors.textMuted,
    primary: colors.primary || '#D2121A',
  }), [colors, isDark]);

  if (!isPremiumEffective) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={isDark
            ? [t.background, '#120206', '#0A0003', t.background]
            : [t.background, t.surfaceSecondary || t.background, t.background]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        <GlowOrb color={t.primary} size={500} top={-200} left={SCREEN_W - 200} opacity={isDark ? 0.2 : 0.08} />
        <GlowOrb color={isDark ? '#FFFFFF' : '#F2F2F7'} size={300} top={SCREEN_H * 0.7} left={-100} delay={1500} opacity={isDark ? 0.1 : 0.05} />
        <FilmGrain />

        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} hitSlop={16}>
              <Icon name="arrow-back" size={24} color={t.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.lockedWrap}>
            <Icon name="flame-outline" size={48} color={t.primary} />
            <Text style={[styles.lockedTitle, { color: t.text }]}>Intimacy Building</Text>
            <Text style={[styles.lockedBody, { color: t.subtext }]}>
              Unlock beautifully illustrated intimacy positions with weekly new releases.
            </Text>
            <TouchableOpacity style={[styles.unlockBtn, { backgroundColor: t.primary }]} onPress={handlePaywall} activeOpacity={0.85}>
              <Text style={styles.unlockBtnText}>Unlock Premium</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark
          ? [t.background, '#120206', '#0A0003', t.background]
          : [t.background, t.surfaceSecondary || t.background, t.background]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <GlowOrb color={t.primary} size={500} top={-200} left={SCREEN_W - 200} opacity={isDark ? 0.2 : 0.08} />
      <GlowOrb color={isDark ? '#FFFFFF' : '#F2F2F7'} size={300} top={SCREEN_H * 0.7} left={-100} delay={1500} opacity={isDark ? 0.1 : 0.05} />
      <FilmGrain />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} hitSlop={16}>
            <Icon name="arrow-back" size={24} color={t.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: t.text }]}>Intimacy Building</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Position picker */}
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
                onPress={() => setSelectedIndex(i)}
                activeOpacity={0.75}
                style={[
                  styles.pickerPill,
                  {
                    backgroundColor: active ? withAlpha(t.primary, 0.15) : t.surface,
                    borderColor: active ? withAlpha(t.primary, 0.3) : t.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.pickerText,
                    { color: active ? t.primary : t.muted },
                  ]}
                  numberOfLines={1}
                >
                  {p.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Position detail */}
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {position && (
            <IntimacyPositionCard
              position={position}
              getIllustrationForBodyType={getIllustrationForBodyType}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.screen,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  pickerScroll: {
    flexGrow: 0,
    marginBottom: SPACING.md,
  },
  pickerRow: {
    paddingHorizontal: SPACING.screen,
    gap: 8,
  },
  pickerPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  pickerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    paddingBottom: 60,
  },
  // Locked state
  lockedWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.screen * 2,
    gap: 16,
  },
  lockedTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  lockedBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  unlockBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
    marginTop: 8,
  },
  unlockBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
