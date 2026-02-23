/**
 * YearReflectionScreen — End-of-Year Narrative (Premium)
 * 
 * Not stats. Not graphs.
 * A short narrative, written warm and human.
 * Emotionally memorable — shareable between partners, not publicly.
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  TouchableOpacity,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { SPACING, BORDER_RADIUS } from '../utils/theme';
import { YearReflection } from '../services/PolishEngine';

const SECTION_ICONS = {
  opening: 'book-open-variant',
  moments: 'thought-bubble-outline',
  prompts: 'chat-outline',
  dates: 'heart-multiple-outline',
  loveNotes: 'email-heart-outline',
  season: 'leaf',
  closing: 'star-four-points-outline',
};

function FadeSection({ children, delay = 0 }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 1000,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
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
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const text = reflection.sections.map(s => s.text).join('\n\n');
    try {
      await Share.share({
        message: `Our ${year} — Between Us\n\n${text}`,
      });
    } catch (e) { /* share cancelled or failed */ }
  };

  if (!isPremium) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.premiumGate}>
          <MaterialCommunityIcons name="diamond-stone" size={40} color={colors.primary} />
          <Text style={[styles.gateTitle, { color: colors.text }]}>Year Reflection</Text>
          <Text style={[styles.gateSub, { color: colors.textMuted }]}>
            A premium feature that creates a warm,{'\n'}written reflection of your year together.
          </Text>
          <TouchableOpacity
            style={[styles.gateBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('Paywall')}
          >
            <Text style={[styles.gateBtnText, { color: '#FFFFFF' }]}>Unlock Premium</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
          <MaterialCommunityIcons name="share-variant-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <FadeSection delay={0}>
          <Text style={[styles.yearLabel, { color: colors.primary }]}>
            {year}
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>
            Your Year Together
          </Text>
        </FadeSection>

        {loading ? (
          <FadeSection delay={200}>
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
              Gathering your memories...
            </Text>
          </FadeSection>
        ) : reflection?.sections.map((section, i) => (
          <FadeSection key={section.type} delay={400 + i * 300}>
            <View style={styles.sectionRow}>
              <View style={[styles.sectionDot, { backgroundColor: colors.primary + '30' }]}>
                <MaterialCommunityIcons
                  name={SECTION_ICONS[section.type] || 'circle-small'}
                  size={16}
                  color={colors.primary}
                />
              </View>
              <Text style={[styles.sectionText, { color: colors.text }]}>
                {section.text}
              </Text>
            </View>
          </FadeSection>
        ))}

        <FadeSection delay={reflection ? 400 + reflection.sections.length * 300 : 1000}>
          <View style={[styles.endMark, { borderColor: colors.border }]}>
            <MaterialCommunityIcons name="heart" size={16} color={colors.primary + '40'} />
          </View>
        </FadeSection>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 56,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: SPACING.screen + 8,
    paddingTop: SPACING.xl,
  },
  yearLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  title: {
    fontFamily: Platform.select({
      ios: 'Playfair Display',
      android: 'PlayfairDisplay_300Light',
      default: 'serif',
    }),
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: -0.5,
    marginBottom: SPACING.xxl + 8,
    lineHeight: 40,
  },
  loadingText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: SPACING.xxl,
  },
  sectionRow: {
    flexDirection: 'row',
    marginBottom: SPACING.xl + 4,
    gap: SPACING.md,
  },
  sectionDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  sectionText: {
    flex: 1,
    fontSize: 17,
    lineHeight: 28,
    fontFamily: 'Inter_400Regular',
  },
  endMark: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    borderTopWidth: 1,
    marginTop: SPACING.lg,
  },

  // Premium gate
  premiumGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  gateTitle: {
    fontFamily: Platform.select({
      ios: 'Playfair Display',
      android: 'PlayfairDisplay_300Light',
      default: 'serif',
    }),
    fontSize: 24,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  gateSub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.xl,
  },
  gateBtn: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md + 2,
    borderRadius: BORDER_RADIUS.full,
  },
  gateBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.5,
  },
});
