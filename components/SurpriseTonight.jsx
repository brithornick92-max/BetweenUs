// components/SurpriseTonight.jsx — Low-frequency serendipity card
// Max 1-2x per month. Only evenings. Never pushy.
// Sexy Red Intimacy & Apple Editorial Updates Integrated.

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import Icon from './Icon';
import { impact, ImpactFeedbackStyle } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { SPACING, withAlpha } from '../utils/theme';
import { SerendipityTrigger } from '../services/ConnectionEngine';
import PreferenceEngine from '../services/PreferenceEngine';

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });
const SERIF_FONT = Platform.select({ ios: "Georgia", android: "serif" });

export default function SurpriseTonight({ onOpen, navigation }) {
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium } = useEntitlements();
  const [visible, setVisible] = useState(false);
  const [surpriseType, setSurpriseType] = useState(null);
  
  const glowAnim = useRef(new Animated.Value(0.7)).current;

  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    primary: colors.primary || '#C3113D', // Sexy Red
    text: colors.text,
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  useEffect(() => {
    checkSurprise();
  }, []);

  const checkSurprise = async () => {
    const shouldShow = await SerendipityTrigger.shouldShow();
    if (shouldShow) {
      let type;
      try {
        const profile = await PreferenceEngine.getContentProfile();
        type = SerendipityTrigger.getPreferenceAwareType(profile);
      } catch {
        type = SerendipityTrigger.getRandomType();
      }
      setSurpriseType(type);
      setVisible(true);
      await SerendipityTrigger.recordShown();

      // High-end breathing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { 
            toValue: 1, 
            duration: 2500, 
            useNativeDriver: true 
          }),
          Animated.timing(glowAnim, { 
            toValue: 0.7, 
            duration: 2500, 
            useNativeDriver: true 
          }),
        ])
      ).start();
    }
  };

  const handleOpen = async () => {
    impact(ImpactFeedbackStyle.Medium);
    setVisible(false);

    switch (surpriseType) {
      case 'prompt':
        navigation?.navigate('PromptLibrary');
        break;
      case 'date':
        navigation?.navigate('DatePlans');
        break;
      case 'loveNote':
        navigation?.navigate('ComposeLoveNote');
        break;
      case 'memory':
        navigation?.navigate('JournalEntry');
        break;
      default:
        break;
    }

    onOpen?.(surpriseType);
  };

  if (!isPremium || !visible) return null;

  return (
    <Animated.View style={[styles.container, { opacity: glowAnim }]}>
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: isDark ? withAlpha(t.primary, 0.08) : '#FFFFFF',
            borderColor: withAlpha(t.primary, 0.2),
          },
        ]}
        onPress={handleOpen}
        activeOpacity={0.9}
      >
        <View style={styles.content}>
          <View style={[styles.iconContainer, { backgroundColor: withAlpha(t.primary, 0.12) }]}>
            <Icon name="sparkles-outline" size={20} color={t.primary} />
          </View>
          <View style={styles.textWrap}>
            <Text style={[styles.title, { color: t.text }]}>
              Something for tonight
            </Text>
            <Text style={[styles.subtitle, { color: t.subtext }]}>
              A little surprise, just for you two
            </Text>
          </View>
        </View>

        <View style={[styles.openButton, { backgroundColor: t.primary }]}>
          <Text style={styles.openText}>Open</Text>
          <Icon name="arrow-forward" size={14} color="#FFFFFF" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.md,
    paddingHorizontal: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderRadius: 24, // Deep Apple Squircle
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: SERIF_FONT,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20, // Pill shape
    gap: 6,
    marginLeft: SPACING.md,
  },
  openText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    textTransform: 'uppercase',
  },
});
