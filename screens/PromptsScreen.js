// screens/PromptsScreen.js — Card-game prompt experience
// Swipeable card deck: draw, flip, swipe-right to reflect. Quiet & intimate.

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SPACING, BORDER_RADIUS } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useAuth } from '../context/AuthContext';
import PreferenceEngine from '../services/PreferenceEngine';
import PromptCardDeck from '../components/PromptCardDeck';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FONTS = {
  serif: Platform.select({
    ios: 'DMSerifDisplay-Regular',
    android: 'DMSerifDisplay_400Regular',
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

const CAT_COLORS = {
  romance:   ['#D4607A', '#9A2E5E'],
  playful:   ['#F09A5A', '#D96B2A'],
  physical:  ['#9B72CF', '#6B3FA0'],
  fantasy:   ['#C84B5A', '#8B1A2A'],
  sensory:   ['#C49A6C', '#8A6540'],
  emotional: ['#7B6DAF', '#504880'],
  future:    ['#5BA8D4', '#2E6E9A'],
  memory:    ['#5FAA7A', '#337A50'],
  visual:    ['#D4A830', '#A07820'],
};

const CAT_ICONS = {
  romance:   'heart',
  playful:   'star-four-points',
  physical:  'fire',
  fantasy:   'lightning-bolt',
  sensory:   'weather-night',
  emotional: 'chat-outline',
  future:    'telescope',
  memory:    'camera-outline',
  visual:    'eye-outline',
};

const HEAT_LEVELS = [
  { value: 1, label: 'Emotional', color: '#B07EFF' },
  { value: 2, label: 'Flirty', color: '#FF7EB8' },
  { value: 3, label: 'Sensual', color: '#FF7080' },
  { value: 4, label: 'Steamy', color: '#FF8534' },
  { value: 5, label: 'Explicit', color: '#FF2D2D' },
];

const CATEGORIES = [
  { id: 'all',       label: 'All' },
  { id: 'romance',   label: 'Romantic' },
  { id: 'playful',   label: 'Playful' },
  { id: 'physical',  label: 'Intimate' },
  { id: 'fantasy',   label: 'Spicy' },
  { id: 'sensory',   label: 'Cozy' },
  { id: 'emotional', label: 'Deep Talk' },
  { id: 'future',    label: 'Dreams' },
  { id: 'memory',    label: 'Appreciation' },
  { id: 'visual',    label: 'Curiosity' },
];

const GUARANTEED_CATEGORIES = CATEGORIES.filter(c => c.id !== 'all').map(c => c.id);

const loadAllBundledPrompts = () => {
  try {
    const bundled = require('../content/prompts.json');
    return Array.isArray(bundled?.items) ? bundled.items : [];
  } catch {
    return [];
  }
};

// Pre-compute prompt counts per heat level for teaser display
const ALL_BUNDLED = loadAllBundledPrompts();
const HEAT_COUNTS = HEAT_LEVELS.reduce((acc, { value }) => {
  acc[value] = ALL_BUNDLED.filter(p => (p.heat || 1) === value).length;
  return acc;
}, {});
const TOTAL_PROMPT_COUNT = ALL_BUNDLED.length;

const FALLBACK_PROMPT = {
  id: 'fallback_prompt',
  text: "What is one small thing you can do today to feel closer?",
  category: 'emotional',
  heat: 1,
};

// One teaser prompt per locked heat level so free users can preview what's behind the paywall
const getPreviewPrompt = (allPrompts, heat) => {
  const match = allPrompts.find(p => (p.heat || 1) === heat);
  return match ? { ...match, isPreview: true } : null;
};

const normalizePrompt = (p) => {
  if (!p || typeof p !== 'object') return FALLBACK_PROMPT;
  const text = typeof p.text === 'string' ? p.text : '';
  if (!text.trim()) return { ...FALLBACK_PROMPT, ...p };
  return {
    ...p,
    heat: typeof p.heat === 'number' ? p.heat : 1,
    category: typeof p.category === 'string' ? p.category : 'general',
  };
};

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function PromptsScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const { userProfile } = useAuth();

  const [selectedHeat, setSelectedHeat] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contentProfile, setContentProfile] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const profile = await PreferenceEngine.getContentProfile(userProfile || {});
        setContentProfile(profile);
        setSelectedHeat(profile?.heatLevel || userProfile?.heatLevelPreference || 5);
      } catch {
        setSelectedHeat(1);
      }
    })();
  }, [userProfile]);

  const loadPrompts = useCallback(async () => {
    if (selectedHeat === null) return;
    setLoading(true);
    try {
      // Always load ALL prompts — filtering by heat level happens in deckPrompts
      const allPrompts = loadAllBundledPrompts().map(normalizePrompt);
      setPrompts(allPrompts);
    } catch {
      setPrompts([]);
    } finally {
      setLoading(false);
    }
  }, [selectedHeat]);

  useEffect(() => { loadPrompts(); }, [loadPrompts]);

  const deckPrompts = useMemo(() => {
    const heat = selectedHeat ?? 1;
    const isLocked = !isPremium && heat >= 4;

    if (isLocked) {
      // Free users see one preview prompt for locked levels
      const preview = getPreviewPrompt(prompts, heat);
      return preview ? [preview] : [];
    }

    // Exact heat-level match
    let byHeat = prompts.filter((p) => (p.heat || 1) === heat);
    return shuffleArray(byHeat);
  }, [prompts, selectedHeat, isPremium]);

  const handlePromptSelect = useCallback((prompt) => {
    if (!isPremium && (prompt.isPreview || (prompt.heat || 1) >= 4)) {
      showPaywall?.('unlimitedPrompts');
      return;
    }
    navigation.navigate('PromptAnswer', { prompt: { ...prompt, dateKey: new Date().toISOString().split('T')[0] } });
  }, [isPremium, showPaywall, navigation]);

  const handleHeatSelect = useCallback((heat) => {
    setSelectedHeat(heat);
    Haptics.selectionAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

        <SafeAreaView style={styles.safe} edges={['top']}>
          <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
            <Text style={[styles.headerEye, { color: colors.primary + 'AA' }]}>
              {isPremium ? deckPrompts.length + ' cards in your deck' : deckPrompts.length + ' of ' + TOTAL_PROMPT_COUNT + ' cards'}
            </Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Draw a card
            </Text>
          </Animated.View>

          {!isPremium && (
            <Animated.View entering={FadeIn.duration(600).delay(100)}>
              <TouchableOpacity
                style={[styles.upsell, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '25' }]}
                onPress={() => showPaywall?.('unlimitedPrompts')}
                activeOpacity={0.85}
              >
                <View style={styles.upsellLeft}>
                  <View style={styles.upsellHeaderRow}>
                    <Text style={[styles.upsellTitle, { color: colors.text }]}>
                      {TOTAL_PROMPT_COUNT - deckPrompts.length} more to explore
                    </Text>
                    <MaterialCommunityIcons name="star-outline" size={14} color={colors.primary} />
                  </View>
                  {/* Progress bar */}
                  <View style={[styles.progressBar, { backgroundColor: colors.border + '40' }]}>
                    <View style={[
                      styles.progressFill,
                      { width: Math.max(4, (deckPrompts.length / TOTAL_PROMPT_COUNT) * 100) + '%', backgroundColor: colors.primary },
                    ]} />
                  </View>
                  <Text style={[styles.upsellBody, { color: colors.textMuted }]}>
                    You've seen {deckPrompts.length} out of {TOTAL_PROMPT_COUNT} prompts across 5 heat levels
                  </Text>
                </View>
                <LinearGradient
                  colors={[colors.primary, colors.primary + 'BB']}
                  style={styles.upsellBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <MaterialCommunityIcons name="lock-open-variant-outline" size={16} color="#FFF" />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Heat level selector — visible to all, teaser for free */}
          <Animated.View entering={FadeIn.duration(600).delay(200)} style={{ zIndex: 10 }}>
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>HEAT LEVEL</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {HEAT_LEVELS.map(({ value, label, color: heatColor }) => {
                  const active = selectedHeat === value;
                  const locked = !isPremium && value >= 4;
                  const count = HEAT_COUNTS[value] || 0;
                  return (
                    <TouchableOpacity
                      key={value}
                      style={[
                        styles.heatChip,
                        {
                          backgroundColor: active ? heatColor : 'transparent',
                          borderColor: active ? heatColor : locked ? heatColor + '60' : colors.border,
                        },
                      ]}
                      onPress={() => handleHeatSelect(value)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.heatChipInner}>
                        <Text style={[styles.heatLabel, { color: active ? '#FFF' : locked ? heatColor : colors.text }]}>
                          {label}
                        </Text>
                        {locked && <MaterialCommunityIcons name="lock-outline" size={11} color={locked && active ? '#FFF' : heatColor} style={{ marginLeft: 3 }} />}
                      </View>
                      {!isPremium && (
                        <Text style={[styles.heatCount, { color: active ? '#FFFFFFAA' : colors.textMuted + '80' }]}>
                          {count} cards
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>


          </Animated.View>

          {loading ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : deckPrompts.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="cards-outline" size={44} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No cards match — try a different heat level
              </Text>
            </View>
          ) : (
            <PromptCardDeck
              prompts={deckPrompts}
              onSelect={handlePromptSelect}
              onSkip={() => {}}
            />
          )}
        </SafeAreaView>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  header: {
    paddingHorizontal: SPACING.screen,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    gap: 4,
  },
  headerEye: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: FONTS.serif,
    fontSize: 34,
    fontWeight: '400',
    letterSpacing: -0.3,
    lineHeight: 42,
  },

  upsell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginHorizontal: SPACING.screen,
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  upsellLeft: { flex: 1, gap: 6 },
  upsellHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  upsellTitle: { fontFamily: FONTS.bodyBold, fontSize: 15 },
  upsellBody: { fontFamily: FONTS.body, fontSize: 12, lineHeight: 17 },
  upsellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBar: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  section: {
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.screen,
    gap: SPACING.xs,
  },
  sectionLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 2,
  },
  chipRow: {
    gap: SPACING.xs,
    paddingVertical: 2,
  },

  heatChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    alignItems: 'center',
  },
  heatChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heatLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  heatCount: {
    fontFamily: FONTS.body,
    fontSize: 9,
    letterSpacing: 0.3,
    marginTop: 1,
  },

  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    gap: 4,
  },
  catLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 0.1,
  },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 15,
    textAlign: 'center',
  },
});
