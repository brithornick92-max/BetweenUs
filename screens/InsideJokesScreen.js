/**
 * BETWEEN US - INSIDE JOKES ENGINE (EDITORIAL V3)
 * High-End Apple Editorial Layout + Sexy Red (#D2121A)
 * Accessed from HomeScreen or Settings.
 * Shows the full list of nicknames, jokes, rituals, and shared references.
 */

import React, { useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import ReAnimated, { FadeInDown, FadeIn } from 'react-native-reanimated';

import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { PremiumFeature } from '../utils/featureFlags';

import Icon from '../components/Icon';
import InsideJokes from '../components/InsideJokes';
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';
import { impact, ImpactFeedbackStyle } from '../utils/haptics';
import { SPACING } from '../utils/theme';

const { width: SCREEN_W, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });

export default function InsideJokesScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();

  const themeMap = useMemo(
    () => ({
      background: colors.background,
      surface: colors.surface || (isDark ? '#1C1C1E' : '#FFFFFF'),
      surfaceSecondary: colors.surface2 || (isDark ? '#2C2C2E' : '#F2F2F7'),
      primary: colors.primary || '#D2121A',
      accent: colors.accent || '#D4AA7E',
      text: colors.text,
      subtext:
        colors.textMuted ||
        (isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)'),
      border: colors.border || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
    }),
    [colors, isDark]
  );

  const styles = useMemo(() => createStyles(themeMap, isDark), [themeMap, isDark]);

  useEffect(() => {
    impact(ImpactFeedbackStyle.Light);
  }, []);

  const handleBack = useCallback(() => {
    impact(ImpactFeedbackStyle.Light);
    navigation.goBack();
  }, [navigation]);

  const handlePaywall = useCallback(() => {
    impact(ImpactFeedbackStyle.Medium);
    showPaywall?.(PremiumFeature.INSIDE_JOKES);
  }, [showPaywall]);

  if (!isPremium) {
    return (
      <View style={[styles.root, { backgroundColor: themeMap.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <LinearGradient
          colors={
            isDark
              ? [themeMap.background, '#120206', '#0A0003', themeMap.background]
              : [themeMap.background, themeMap.surfaceSecondary, themeMap.background]
          }
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        <FilmGrain />
        <GlowOrb color={themeMap.primary} size={500} top={-200} left={SCREEN_W - 200} opacity={isDark ? 0.2 : 0.08} />
        <GlowOrb
          color={isDark ? '#FFFFFF' : '#F2F2F7'}
          size={300}
          top={SCREEN_HEIGHT * 0.7}
          left={-100}
          delay={1500}
          opacity={isDark ? 0.1 : 0.05}
        />

        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.navHeader}>
            <TouchableOpacity onPress={handleBack} hitSlop={16} style={styles.iconButton}>
              <Icon name="arrow-back" size={24} color={themeMap.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.lockedWrap}>
            <ReAnimated.View entering={FadeInDown.duration(800).springify().damping(18)}>
              <View
                style={[
                  styles.heroCardWrap,
                  { backgroundColor: themeMap.surface, borderColor: themeMap.border, ...getShadow(isDark) },
                ]}
              >
                <View style={styles.eyebrowRow}>
                  <Icon name="star-outline" size={14} color={themeMap.accent} />
                  <Text style={[styles.eyebrow, { color: themeMap.accent }]}>PREMIUM</Text>
                </View>

                <Text style={[styles.promptText, { color: themeMap.text }]}>Private Language</Text>

                <View
                  style={[
                    styles.answerBubble,
                    { backgroundColor: themeMap.surfaceSecondary, borderColor: themeMap.border },
                  ]}
                >
                  <Text style={[styles.answerText, { color: themeMap.text }]}>
                    A dedicated vault for the words only you two understand-nicknames, internal references, and the jokes that define your world.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.cta, { backgroundColor: themeMap.text }]}
                  onPress={handlePaywall}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.ctaLabel, { color: isDark ? '#000000' : '#FFFFFF' }]}>Unlock Premium</Text>
                  <Icon name="arrow-forward-outline" size={20} color={isDark ? '#000000' : '#FFFFFF'} />
                </TouchableOpacity>
              </View>
            </ReAnimated.View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: themeMap.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <LinearGradient
        colors={
          isDark
            ? [themeMap.background, '#120206', '#0A0003', themeMap.background]
            : [themeMap.background, themeMap.surfaceSecondary, themeMap.background]
        }
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <FilmGrain />
      <GlowOrb color={themeMap.primary} size={500} top={-200} left={SCREEN_W - 200} opacity={isDark ? 0.2 : 0.08} />
      <GlowOrb
        color={isDark ? '#FFFFFF' : '#F2F2F7'}
        size={300}
        top={SCREEN_HEIGHT * 0.7}
        left={-100}
        delay={1500}
        opacity={isDark ? 0.1 : 0.05}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.navHeader}>
          <TouchableOpacity onPress={handleBack} hitSlop={16} style={styles.iconButton}>
            <Icon name="arrow-back" size={24} color={themeMap.text} />
          </TouchableOpacity>
        </View>

        <ReAnimated.View entering={FadeIn.duration(500)} style={styles.editorialHeader}>
          <Text style={[styles.headerSubtitle, { color: themeMap.primary }]}>PRIVATE VAULT</Text>
          <Text style={[styles.headerTitle, { color: themeMap.text }]}>Private Language</Text>
        </ReAnimated.View>

        <ReAnimated.View entering={FadeInDown.delay(100).duration(800).springify().damping(18)} style={{ flex: 1 }}>
          <InsideJokes compact={false} />
        </ReAnimated.View>
      </SafeAreaView>
    </View>
  );
}

const getShadow = (isDark) =>
  Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.4 : 0.08,
      shadowRadius: 24,
    },
    android: { elevation: 6 },
  });

const createStyles = (themeMap) =>
  StyleSheet.create({
    root: { flex: 1 },
    safeArea: { flex: 1 },
    navHeader: {
      paddingHorizontal: SPACING.screen || 24,
      paddingTop: 12,
      paddingBottom: 4,
      flexDirection: 'row',
      zIndex: 10,
    },
    iconButton: {
      padding: 8,
      marginLeft: -8,
    },
    editorialHeader: {
      paddingHorizontal: SPACING.screen || 24,
      paddingTop: SPACING.md || 16,
      paddingBottom: SPACING.lg || 24,
    },
    headerSubtitle: {
      fontFamily: SYSTEM_FONT,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 2,
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    headerTitle: {
      fontFamily: SYSTEM_FONT,
      fontSize: 34,
      fontWeight: '800',
      letterSpacing: -0.5,
      lineHeight: 40,
    },
    lockedWrap: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: SPACING.screen || 24,
      paddingBottom: 60,
    },
    heroCardWrap: {
      borderRadius: 24,
      borderWidth: 1,
      padding: SPACING.xl || 24,
    },
    eyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: SPACING.sm || 8,
    },
    eyebrow: {
      fontFamily: SYSTEM_FONT,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    promptText: {
      fontFamily: SYSTEM_FONT,
      fontSize: 26,
      fontWeight: '800',
      lineHeight: 32,
      letterSpacing: -0.5,
      marginBottom: SPACING.lg || 24,
    },
    answerBubble: {
      borderRadius: 20,
      borderWidth: 1,
      padding: SPACING.lg || 24,
      marginBottom: SPACING.xl || 32,
    },
    answerText: {
      fontFamily: SYSTEM_FONT,
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
      fontFamily: SYSTEM_FONT,
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
  });
