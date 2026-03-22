// components/YearReflectionCard.jsx
// Aligned with Editorial V3 — Sexy Red & Apple Light Gray Edition
// High-end, unabridged code with Velvet Glass & Chromatic Lume.

import React, { useMemo, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Platform, 
  Animated, 
  Dimensions 
} from 'react-native';
import { BlurView } from 'expo-blur';
import Icon from './Icon';
import { useTheme } from '../context/ThemeContext';
import { SPACING, withAlpha } from '../utils/theme';
import GlowOrb from './GlowOrb'; 
import FilmGrain from './FilmGrain'; 

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });
const SERIF_FONT = Platform.select({ ios: "Georgia", android: "serif" });

export default function YearReflectionCard({ onPress }) {
  const { colors, isDark } = useTheme();
  const breatheAnim = useRef(new Animated.Value(0)).current;

  // ─── SEXY RED & LIGHT GRAY THEME MAP ───
  const t = useMemo(() => ({
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    primary: '#D2121A', // SEXY RED
    accent: isDark ? 'rgba(255, 255, 255, 0.7)' : '#F2F2F7', // Editorial Light Gray/White
    text: colors.text,
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    borderGlass: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  }), [colors, isDark]);

  useEffect(() => {
    // Elegant, slow-burn breathing for the "Lume" effect
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1, duration: 5000, useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 0, duration: 5000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const orbOpacity = breatheAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isDark ? 0.15 : 0.08, isDark ? 0.28 : 0.15]
  });

  const orbScale = breatheAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15]
  });

  return (
    <View style={styles.outerContainer}>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={onPress}
      >
        <BlurView 
          intensity={isDark ? 45 : 90} 
          tint={isDark ? "dark" : "light"} 
          style={[
            styles.card, 
            { backgroundColor: withAlpha(t.surface, isDark ? 0.7 : 0.5), borderColor: t.borderGlass }
          ]}
        >
          {/* ─── CHROMATIC LUME ORBS (RED & WHITE) ─── */}
          <Animated.View style={[styles.orbWrapper, { opacity: orbOpacity, transform: [{ scale: orbScale }] }]}>
            <GlowOrb 
              color={t.primary} 
              size={240} 
              top={-90} 
              left={SCREEN_WIDTH - 160} 
            />
            <GlowOrb 
              color={t.accent} 
              size={180} 
              top={100} 
              left={-30} 
            />
          </Animated.View>

          <FilmGrain opacity={0.25} />

          <View style={styles.content}>
            <View style={[styles.iconBox, { backgroundColor: withAlpha(t.primary, 0.1) }]}>
              <Icon name="book-sharp" size={24} color={t.primary} />
            </View>

            <View style={styles.textWrap}>
              <Text style={[styles.kicker, { color: t.primary }]}>PREMIUM NARRATIVE</Text>
              <Text style={[styles.title, { color: t.text }]}>Year Reflection</Text>
              <Text style={[styles.subtitle, { color: t.subtext }]}>
                A curated journey through 2026.
              </Text>
            </View>

            <View style={styles.chevronWrap}>
              <Icon name="chevron-forward" size={16} color={t.subtext} />
            </View>
          </View>
        </BlurView>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    marginVertical: SPACING.md,
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 32, // Professional Editorial Squircle
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
      },
      android: { elevation: 5 },
    }),
  },
  orbWrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 26,
    paddingHorizontal: 22,
    zIndex: 2,
  },
  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 18,
  },
  textWrap: {
    flex: 1,
  },
  kicker: {
    fontFamily: SYSTEM_FONT,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    fontFamily: SERIF_FONT,
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  chevronWrap: {
    paddingLeft: 12,
  }
});
