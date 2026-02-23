// components/SurpriseTonight.jsx — Low-frequency serendipity card
// Max 1-2x per month. Only evenings. Never pushy.

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { SPACING, BORDER_RADIUS } from '../utils/theme';
import { SerendipityTrigger } from '../services/ConnectionEngine';
import PreferenceEngine from '../services/PreferenceEngine';

const FONTS = {
  serif: Platform.select({
    ios: 'Playfair Display',
    android: 'PlayfairDisplay_300Light',
    default: 'serif',
  }),
  body: Platform.select({
    ios: 'Inter',
    android: 'Inter_400Regular',
    default: 'sans-serif',
  }),
  bodyBold: Platform.select({
    ios: 'Inter-SemiBold',
    android: 'Inter_600SemiBold',
    default: 'sans-serif',
  }),
};

export default function SurpriseTonight({ onOpen, navigation }) {
  const { colors } = useTheme();
  const { isPremiumEffective: isPremium } = useEntitlements();
  const [visible, setVisible] = useState(false);
  const [surpriseType, setSurpriseType] = useState(null);
  const glowAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    checkSurprise();
  }, []);

  const checkSurprise = async () => {
    const shouldShow = await SerendipityTrigger.shouldShow();
    if (shouldShow) {
      // Bias surprise type by season/energy preferences
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

      // Gentle glow animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.6, duration: 2000, useNativeDriver: true }),
        ])
      ).start();
    }
  };

  const handleOpen = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setVisible(false);

    // Navigate based on surprise type
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
        // Navigate to Memory Vault / Journal
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
            backgroundColor: colors.primary + '12',
            borderColor: colors.primary + '30',
          },
        ]}
        onPress={handleOpen}
        activeOpacity={0.85}
      >
        <View style={styles.content}>
          <Text style={[styles.sparkle]}>✨</Text>
          <Text style={[styles.title, { color: colors.text }]}>
            Something for tonight
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            A little surprise, just for you two
          </Text>
        </View>
        <View style={[styles.openButton, { backgroundColor: colors.primary + '20' }]}>
          <Text style={[styles.openText, { color: colors.primary }]}>Open</Text>
          <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primary} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  sparkle: {
    fontSize: 20,
    marginBottom: 4,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 18,
    fontWeight: '300',
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 13,
    fontStyle: 'italic',
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    gap: 6,
    marginLeft: SPACING.md,
  },
  openText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
  },
});
