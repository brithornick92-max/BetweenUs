// components/SurpriseTonight.jsx — Low-frequency serendipity card
// Max 1-2x per month. Only evenings. Never pushy.
// Reveal Mechanism + Apple Editorial & Velvet Glass Integration.

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Icon from './Icon';
import { impact, ImpactFeedbackStyle } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { SPACING, withAlpha } from '../utils/theme';
import { SerendipityTrigger } from '../services/ConnectionEngine';

// Required for LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });
const SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif' });

const MISSIONS = [
  "Tonight, no phones after 9 PM. Just eye contact and conversation.",
  "A 30-second hug before you go to bed. Don't let go first.",
  "Whisper one thing you're grateful for about them tonight.",
  "Surprise them with their favorite drink or snack while they relax.",
  "Write them one sentence about a moment you never want to forget.",
  "Ask them: what's something you've been wanting to tell me?",
];

export default function SurpriseTonight() {
  const { isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const [visible, setVisible] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [mission, setMission] = useState('');

  const breatheAnim = useRef(new Animated.Value(0)).current;
  const revealAnim = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;
  const breatheLoop = useRef(null);

  const t = useMemo(() => ({
    surface: isDark ? 'rgba(44, 44, 46, 0.8)' : 'rgba(255, 255, 255, 0.9)',
    p1: '#FF85C2', // Soft Orchid
    p3: '#FF006E', // Vivid Magenta
    p5: '#D2121A', // Sexy Red
    text: isDark ? '#FFFFFF' : '#1D1D1F',
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
  }), [isDark]);

  useEffect(() => {
    checkSurprise();
    return () => breatheLoop.current?.stop();
  }, []);

  const checkSurprise = async () => {
    const shouldShow = await SerendipityTrigger.shouldShow();
    if (!shouldShow) return;

    setMission(MISSIONS[Math.floor(Math.random() * MISSIONS.length)]);
    setVisible(true);
    await SerendipityTrigger.recordShown();

    breatheLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1, duration: 3500, useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 0, duration: 3500, useNativeDriver: true }),
      ])
    );
    breatheLoop.current.start();
  };

  const handlePressIn = () => {
    if (isRevealed) return;
    Animated.spring(pressAnim, { toValue: 0.96, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    if (isRevealed) return;
    Animated.spring(pressAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  };

  const handleReveal = () => {
    if (isRevealed) return;

    impact(ImpactFeedbackStyle.Heavy);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsRevealed(true);

    Animated.timing(revealAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  };

  if (!visible) return null;

  const glowScale = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] });
  const contentOpacity = revealAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });

  // Free users see a locked teaser that drives the paywall
  if (!isPremium) {
    return (
      <Animated.View style={[styles.wrapper]}>
        <TouchableOpacity
          onPress={() => showPaywall?.('surpriseMe')}
          activeOpacity={0.85}
        >
          <BlurView
            intensity={isDark ? 50 : 90}
            tint={isDark ? 'dark' : 'light'}
            style={styles.card}
          >
            <View style={[styles.bloom, { backgroundColor: t.p3, opacity: 0.08 }]} />
            <View style={[styles.bloomSecondary, { backgroundColor: t.p1, opacity: 0.05 }]} />
            <View style={styles.initialContent}>
              <View style={[styles.iconBox, { backgroundColor: withAlpha(t.p5, 0.1) }]}>
                <Icon name="gift-outline" size={24} color={t.p5} />
              </View>
              <View style={styles.textWrap}>
                <Text style={[styles.title, { color: t.text }]}>Tonight's Surprise</Text>
                <Text style={[styles.subtitle, { color: t.subtext }]}>A small mission for the two of you — unlock premium</Text>
              </View>
              <View style={[styles.iconBox, { backgroundColor: withAlpha(t.p5, 0.08) }]}>
                <Icon name="lock-closed-outline" size={18} color={t.p5} />
              </View>
            </View>
          </BlurView>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale: pressAnim }] }]}>
      <TouchableOpacity
        onPress={handleReveal}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        disabled={isRevealed}
      >
        <BlurView
          intensity={isDark ? 50 : 90}
          tint={isDark ? 'dark' : 'light'}
          style={[styles.card, isRevealed && styles.cardExpanded]}
        >
          {/* Chromatic Velvet Bloom */}
          <Animated.View
            style={[
              styles.bloom,
              {
                backgroundColor: isRevealed ? t.p5 : t.p3,
                opacity: isRevealed ? 0.15 : 0.08,
                transform: [{ scale: glowScale }],
              },
            ]}
          />
          <View style={[styles.bloomSecondary, { backgroundColor: t.p1, opacity: 0.05 }]} />

          {!isRevealed ? (
            <View style={styles.initialContent}>
              <View style={[styles.iconBox, { backgroundColor: withAlpha(t.p5, 0.1) }]}>
                <Icon name="gift-outline" size={24} color={t.p5} />
              </View>
              <View style={styles.textWrap}>
                <Text style={[styles.title, { color: t.text }]}>Tonight's Surprise</Text>
                <Text style={[styles.subtitle, { color: t.subtext }]}>
                  Tap to unwrap a small mission
                </Text>
              </View>
            </View>
          ) : (
            <Animated.View style={[styles.revealedContent, { opacity: contentOpacity }]}>
              <Text style={[styles.missionLabel, { color: t.p3 }]}>YOUR MISSION</Text>
              <Text style={[styles.missionText, { color: t.text }]}>{mission}</Text>
              <View style={styles.bottomBar}>
                <Icon name="checkmark-circle" size={16} color={t.p5} />
                <Text style={[styles.acceptedText, { color: t.subtext }]}>Challenge Accepted</Text>
              </View>
            </Animated.View>
          )}
        </BlurView>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    marginVertical: SPACING.md,
  },
  card: {
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
      },
      android: { elevation: 6 },
    }),
  },
  cardExpanded: {
    minHeight: 180,
    justifyContent: 'center',
  },
  bloom: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  bloomSecondary: {
    position: 'absolute',
    bottom: -40,
    left: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  initialContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontFamily: SERIF_FONT,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  revealedContent: {
    alignItems: 'center',
  },
  missionLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 12,
  },
  missionText: {
    fontFamily: SERIF_FONT,
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  acceptedText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
