/**
 * YearReflectionScreen — End-of-Year Narrative (Premium)
 * * Not stats. Not graphs.
 * A short narrative, written warm and human.
 * Emotionally memorable — shareable between partners, not publicly.
 */

import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  TouchableOpacity,
  Share,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { SPACING, BORDER_RADIUS, withAlpha } from '../utils/theme';
import { YearReflection } from '../services/PolishEngine';
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';

const SECTION_ICONS = {
  opening: 'book-open-variant',
  moments: 'thought-bubble-outline',
  prompts: 'chat-outline',
  dates: 'heart-multiple-outline',
  loveNotes: 'email-heart-outline',
  season: 'leaf',
  closing: 'star-four-points-outline',
};

// Upgraded to native Apple spring physics
function FadeSection({ children, delay = 0 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 50,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, delay]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

export default function YearReflectionScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium } = useEntitlements();
  const [reflection, setReflection] = useState(null);
  const [loading, setLoading] = useState(true);
  const year = new Date().getFullYear();

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

  useEffect(() => {
    (async () => {
      // Try cached first
      let data = await YearReflection.getCached(year);
      if (!data) {
        data = await YearReflection.generate(year);
        await YearReflection.cache(data);
      }
      setReflection(data);
      setLoading(false);
    })();
  }, []);

  const handleShare = async () => {
    if (!reflection) return;
    impact(ImpactFeedbackStyle.Medium);
    const text = reflection.sections.map(s => s.text).join('\n\n');
    try {
      await Share.share({
        message: `Our ${year} — Between Us\n\n${text}`,
      });
    } catch (e) { /* share cancelled or failed */ }
  };

  const handleBack = () => {
    impact(ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  if (!isPremium) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
        <LinearGradient
          colors={isDark ? [t.background, '#0F0A1A', '#0D081A', t.background] : [t.background, '#EBEBF5', t.background]}
          style={StyleSheet.absoluteFillObject}
        />

        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.navButton} activeOpacity={0.7}>
            <MaterialCommunityIcons name="chevron-left" size={32} color={t.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.premiumGate}>
          <View style={styles.paywallIconContainer}>
            <MaterialCommunityIcons name="book-open-variant" size={48} color={t.primary} />
          </View>
          <Text style={styles.gateTitle}>Year Reflection</Text>
          <Text style={styles.gateSub}>
            A premium feature that creates a warm, written reflection of your year together.
          </Text>
          <TouchableOpacity
            style={styles.paywallButton}
            onPress={() => {
              selection();
              navigation.navigate('Paywall');
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.paywallButtonText}>Discover Premium</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />

      {/* Subtle Velvet Gradient underneath the native Apple surfaces */}
      <LinearGradient
        colors={isDark ? [t.background, '#0F0A1A', '#0D081A', t.background] : [t.background, '#EBEBF5', t.background]}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <GlowOrb color={withAlpha(t.primary, 0.15)} size={400} top={-100} left={-100} />
      <FilmGrain />

      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.navButton} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-left" size={32} color={t.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShare} style={styles.navButton} activeOpacity={0.7}>
          <MaterialCommunityIcons name="export-variant" size={24} color={t.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.articleCard}>
          <FadeSection delay={0}>
            <Text style={styles.yearLabel}>{year}</Text>
            <Text style={styles.title}>Your Year Together</Text>
          </FadeSection>

          {loading ? (
            <FadeSection delay={200}>
              <Text style={styles.loadingText}>
                Gathering your memories...
              </Text>
            </FadeSection>
          ) : reflection?.sections.map((section, i) => (
            <FadeSection key={section.type} delay={300 + i * 150}>
              <View style={styles.sectionRow}>
                <View style={styles.sectionIconColumn}>
                  <View style={[styles.sectionDot, { backgroundColor: t.primary + '15' }]}>
                    <MaterialCommunityIcons
                      name={SECTION_ICONS[section.type] || 'circle-small'}
                      size={20}
                      color={t.primary}
                    />
                  </View>
                </View>
                <Text style={styles.sectionText}>
                  {section.text}
                </Text>
              </View>
            </FadeSection>
          ))}

          <FadeSection delay={reflection ? 300 + reflection.sections.length * 150 : 1000}>
            <View style={styles.endMark}>
              <MaterialCommunityIcons name="heart" size={16} color={t.primary} />
            </View>
          </FadeSection>
        </View>
      </ScrollView>
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
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      height: 56,
      zIndex: 10,
    },
    navButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.border,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0 : 0.08, shadowRadius: 10 },
        android: { elevation: 2 },
      }),
    },
    scroll: {
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.md,
      paddingBottom: 160, // Critical padding to clear bottom tabs
    },

    // ── Editorial Article Card ──
    articleCard: {
      backgroundColor: t.surface,
      borderRadius: 32,
      padding: SPACING.xl,
      borderWidth: 1,
      borderColor: t.border,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: isDark ? 0 : 0.08, shadowRadius: 24 },
        android: { elevation: 4 },
      }),
    },
    yearLabel: {
      fontSize: 12,
      fontFamily: systemFont,
      fontWeight: '800',
      letterSpacing: 2.5,
      textTransform: 'uppercase',
      color: t.primary,
      marginBottom: SPACING.sm,
    },
    title: {
      fontFamily: systemFont,
      fontSize: 34,
      fontWeight: '800',
      letterSpacing: 0.3,
      color: t.text,
      marginBottom: SPACING.xxl,
      lineHeight: 40,
    },
    loadingText: {
      fontSize: 16,
      fontStyle: 'italic',
      color: t.subtext,
      marginTop: SPACING.xl,
      fontWeight: '500',
    },

    // ── Narrative Sections ──
    sectionRow: {
      flexDirection: 'row',
      marginBottom: SPACING.xl,
    },
    sectionIconColumn: {
      marginRight: SPACING.md,
      alignItems: 'center',
    },
    sectionDot: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    sectionText: {
      flex: 1,
      fontSize: 17, // Native iOS body size
      lineHeight: 28,
      fontFamily: systemFont,
      fontWeight: '400',
      color: t.text,
      letterSpacing: -0.2,
    },
    endMark: {
      alignItems: 'center',
      paddingTop: SPACING.xl,
      paddingBottom: SPACING.md,
      borderTopWidth: 1,
      borderTopColor: t.border,
      marginTop: SPACING.md,
    },

    // ── Premium Gate (Paywall) ──
    premiumGate: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.xxl,
      marginTop: -40,
    },
    paywallIconContainer: {
      width: 80, 
      height: 80, 
      borderRadius: 40,
      backgroundColor: t.primary + '15',
      alignItems: 'center', 
      justifyContent: 'center',
      marginBottom: SPACING.lg,
    },
    gateTitle: {
      fontFamily: systemFont,
      fontSize: 30,
      fontWeight: '800',
      color: t.text,
      textAlign: 'center',
      marginBottom: SPACING.md,
      letterSpacing: -0.5,
    },
    gateSub: {
      fontSize: 16,
      color: t.subtext,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: SPACING.xxxl,
      paddingHorizontal: SPACING.md,
    },
    paywallButton: {
      backgroundColor: t.text, // Solid, high contrast Apple Action Button
      paddingVertical: 18,
      paddingHorizontal: 40,
      borderRadius: 30,
      width: '100%',
      alignItems: 'center',
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0 : 0.15, shadowRadius: 10 },
        android: { elevation: 3 },
      }),
    },
    paywallButtonText: {
      color: t.surface,
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
  });
};
