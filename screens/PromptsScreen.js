import { SPACING, withAlpha } from "../utils/theme";
/**
 * PromptsScreen.js -- High-end card-draw experience
 * True Red (#D2121A) & Clean Native Apple Backgrounds.
 * FIXED: "Sleeping Neon" unselected pill states.
 */

import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar,
  Dimensions,
  Alert,
} from "react-native";
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from '../components/Icon';
import {
  impact,
  selection,
  ImpactFeedbackStyle,
} from "../utils/haptics";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { PremiumFeature } from '../utils/featureFlags';
import { useTheme } from "../context/ThemeContext";
import { useEntitlements } from "../context/EntitlementsContext";
import { useAuth } from "../context/AuthContext";
import * as PreferenceEngine from "../services/PreferenceEngine";
import contentAccessService from "../services/ContentAccessService";
import { CONTENT_TYPES, buildWeeklySet } from "../services/WeeklyContentSetService";
import PromptCardDeck from "../components/PromptCardDeck";
import { SoftBoundaries } from "../services/PolishEngine";
import { FALLBACK_PROMPT } from "../utils/contentLoader";
import { LinearGradient } from 'expo-linear-gradient';
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SCREEN_W = SCREEN_WIDTH;
const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

const HEAT_LEVELS = [
  { value: 1, label: "1", color: "#FF85C2" }, // Soft Orchid Pink
  { value: 2, label: "2", color: "#FF1493" }, // Deep Pink
  { value: 3, label: "3", color: "#FF006E" }, // Vivid Magenta-Red
  { value: 4, label: "4", color: "#F00049" }, // Carmine
  { value: 5, label: "5", color: "#D2121A" }, // Deep Red
];

const loadAllBundledPrompts = () => {
  const bundled = require("../content/prompts.json");

  if (Array.isArray(bundled)) {
    return bundled;
  }

  if (Array.isArray(bundled?.items)) {
    return bundled.items;
  }

  if (Array.isArray(bundled?.prompts)) {
    return bundled.prompts;
  }

  if (Array.isArray(bundled?.default)) {
    return bundled.default;
  }

  if (Array.isArray(bundled?.default?.items)) {
    return bundled.default.items;
  }

  if (Array.isArray(bundled?.default?.prompts)) {
    return bundled.default.prompts;
  }

  return [];
};

const ALL_BUNDLED = loadAllBundledPrompts();
const TOTAL_PROMPT_COUNT = ALL_BUNDLED.length;

const normalizePrompt = (p) => {
  if (!p || typeof p !== "object") return FALLBACK_PROMPT;
  const text = typeof p.text === "string" ? p.text : "";
  if (!text.trim()) return { ...FALLBACK_PROMPT, ...p };
  return {
    ...p,
    heat: typeof p.heat === "number" ? p.heat : 1,
    category: typeof p.category === "string" ? p.category : "general",
  };
};

const TONE_PROMPT_COPY = {
  warm: {
    subtitle: 'Gentle reflections for the two of you.',
    empty: 'Nothing here fits this intensity right now. Try something softer or switch the mood.',
  },
  playful: {
    subtitle: 'Light sparks, bold questions, and a little mischief.',
    empty: 'No sparks in this lane yet. Try another heat level and keep it moving.',
  },
  intimate: {
    subtitle: 'Closer questions for quieter, deeper moments.',
    empty: 'Nothing matching this intensity surfaced. Try a softer or more sensual lane.',
  },
  minimal: {
    subtitle: 'Clean prompts, less noise, direct connection.',
    empty: 'No clean matches at this intensity. Try another level.',
  },
};

const normalizeHeatLevel = (heat, fallback = 5) => {
  const numeric = Number(heat);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(5, Math.max(1, Math.floor(numeric)));
};

const resolveExplicitMaxHeat = (profile) => {
  const boundaries = profile?.boundaries || {};
  const caps = [5];

  if (boundaries.hideSpicy === true) {
    caps.push(3);
  }

  if (
    typeof boundaries.maxHeatOverride === 'number' &&
    boundaries.maxHeatOverride >= 1 &&
    boundaries.maxHeatOverride <= 5
  ) {
    caps.push(boundaries.maxHeatOverride);
  }

  return Math.min(...caps.map((heat) => normalizeHeatLevel(heat)));
};

const clampHeatSelection = (profile, selectedHeat) => {
  const normalizedHeat = normalizeHeatLevel(selectedHeat, 1);
  return Math.min(normalizedHeat, resolveExplicitMaxHeat(profile));
};



function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Synchronous boundary filter used when contentProfile is unavailable
function applyRawBoundaryFilter(items, bounds) {
  if (!bounds) return items;
  return items.filter((p) => {
    if (!p) return false;
    const heat = p.heat || 1;
    if (bounds.hideSpicy && heat >= 4) return false;
    if (bounds.maxHeatOverride != null && heat > bounds.maxHeatOverride) return false;
    if (bounds.hiddenCategories?.includes(p.category)) return false;
    if (bounds.pausedEntries?.includes(p.id)) return false;
    return true;
  });
}

export default function PromptsScreen({ navigation }) {
  const tabBarHeight = useBottomTabBarHeight();
  const { isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const { user, userProfile } = useAuth();

  const [selectedHeat, setSelectedHeat] = useState(null);
  const [weeklyPromptSet, setWeeklyPromptSet] = useState(null);
  const [selectedTone, setSelectedTone] = useState('warm');
  const [contentProfile, setContentProfile] = useState(null);
  const [rawBoundaries, setRawBoundaries] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deckVersion, setDeckVersion] = useState(0);

  const t = useMemo(() => isDark ? {
    background: '#0A0A0A',
    primary: '#FF2D55',
    surface: '#1C1C1E',
    text: '#FFFFFF',
    subtext: 'rgba(255,255,255,0.4)',
    border: 'rgba(255,255,255,0.1)',
  } : {
    background: '#F2F2F7',
    primary: '#D2121A',
    surface: '#FFFFFF',
    text: '#1C1C1E',
    subtext: 'rgba(0,0,0,0.4)',
    border: 'rgba(0,0,0,0.1)',
  }, [isDark]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        try {
          const [profile, bounds] = await Promise.all([
            PreferenceEngine.getContentProfile(userProfile || {}),
            SoftBoundaries.getAll(),
          ]);
          if (!active) return;
          let heat = profile?.heatLevel || userProfile?.heatLevelPreference || 5;
          heat = clampHeatSelection(profile, heat);
          setContentProfile(profile);
          setRawBoundaries(bounds);
          setSelectedHeat(heat);
          setSelectedTone(profile?.tone || 'warm');
        } catch {
          if (!active) return;
          setContentProfile(null);
          SoftBoundaries.getAll().then(b => { if (active) setRawBoundaries(b); }).catch(() => {});
          setSelectedHeat(1);
          setSelectedTone('warm');
        }
      })();

      return () => {
        active = false;
      };
    }, [userProfile])
  );

  const toneCopy = TONE_PROMPT_COPY[selectedTone] || TONE_PROMPT_COPY.warm;
  const maxSelectableHeat = useMemo(
    () => resolveExplicitMaxHeat(contentProfile),
    [contentProfile]
  );

  const loadPrompts = useCallback(async () => {
    if (selectedHeat === null) return;
    setLoading(true);
    try {
      const allPrompts = ALL_BUNDLED.map(normalizePrompt);

      const access = await contentAccessService.getAccessiblePrompts(allPrompts, {
        userId: user?.uid,
        isPremium,
        userSettings: contentProfile || userProfile || {},
        includeAll: true,
      });

      const accessiblePrompts = access.prompts || [];
      setPrompts(accessiblePrompts);

      const weeklySet = buildWeeklySet(accessiblePrompts, {
        contentType: CONTENT_TYPES.PROMPTS,
        userId: user?.uid || user?.id || 'anonymous',
        isPremium,
        userSettings: contentProfile || userProfile || {},
        date: new Date(),
      });

      setWeeklyPromptSet(weeklySet);
    } catch {
      setPrompts([]);
      setWeeklyPromptSet(null);
    } finally {
      setLoading(false);
    }
  }, [contentProfile, isPremium, selectedHeat, user?.uid, userProfile]);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const freeWeeklyPromptDeck = useMemo(() => {
    if (isPremium || !weeklyPromptSet?.items?.length) return null;

    return weeklyPromptSet.items.map((item) => normalizePrompt({
      ...item,
      text: item.text || item.prompt || item.previewText || item.title || 'Premium prompt',
      category: item.category || 'premium',
      heat: item.heat || item.heatLevel || item.level || 1,
      weeklySetMeta: item.weeklySetMeta,
      isLockedPreview: item.isLockedPreview,
      requiresPremium: item.requiresPremium,
      upgradeCopy: weeklyPromptSet.upgradeCopy,
    }));
  }, [isPremium, weeklyPromptSet]);

  const deckPrompts = useMemo(() => {
    if (!isPremium && freeWeeklyPromptDeck?.length) {
      return freeWeeklyPromptDeck;
    }

    const heat = selectedHeat ?? 1;
    const basePrompts = contentProfile ? prompts : applyRawBoundaryFilter(prompts, rawBoundaries);
    const byHeat = basePrompts.map(normalizePrompt).filter((p) => (p.heat || 1) === heat);

    if (!contentProfile) return shuffleArray(byHeat);

    const personalized = PreferenceEngine.filterPrompts(byHeat, {
      ...contentProfile,
      maxHeat: heat,
    });

    const personalizedIds = new Set(personalized.map((prompt) => String(prompt?.id)));
    const remaining = byHeat.filter((prompt) => !personalizedIds.has(String(prompt?.id)));

    return [...personalized, ...shuffleArray(remaining)];
  }, [prompts, selectedHeat, contentProfile, rawBoundaries, isPremium, freeWeeklyPromptDeck]);

  const handlePromptSelect = useCallback((prompt) => {
    if (prompt?.isLockedPreview || prompt?.requiresPremium) {
      impact(ImpactFeedbackStyle.Medium);
      showPaywall?.(PremiumFeature.UNLIMITED_PROMPTS);
      return;
    }

    navigation.navigate("PromptAnswer", {
      prompt: { ...prompt, dateKey: new Date().toISOString().split("T")[0] },
    });
  }, [navigation, showPaywall]);

  const handleHeatSelect = useCallback((heat) => {
    setSelectedHeat(heat);
    selection();
  }, []);

  const refreshBoundaryProfile = useCallback(async () => {
    const profile = await PreferenceEngine.getContentProfile(userProfile || {});
    setContentProfile(profile);
    setDeckVersion((value) => value + 1);
  }, [userProfile]);

  const handlePromptBoundaryAction = useCallback((prompt) => {
    if (!prompt?.id) return;

    Alert.alert(
      "Boundary Options",
      "Choose how you want this prompt handled.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Hide This Prompt",
          onPress: async () => {
            await SoftBoundaries.pauseEntry(prompt.id);
            await refreshBoundaryProfile();
          },
        },
        {
          text: "Hide This Category",
          onPress: async () => {
            if (prompt.category) {
              await SoftBoundaries.hideCategory(prompt.category);
              await refreshBoundaryProfile();
            }
          },
        },
      ]
    );
  }, [refreshBoundaryProfile]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.root, { backgroundColor: t.background }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <LinearGradient
          colors={isDark ? [t.background, '#120206', '#0A0003', t.background] : [t.background, t.surface2 || '#F2F2F7', t.background]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        <GlowOrb color={t.primary} size={460} top={-180} left={SCREEN_W - 220} opacity={isDark ? 0.18 : 0.08} />
        <GlowOrb color={t.accent || '#D4AA7E'} size={260} top={620} left={-80} opacity={isDark ? 0.12 : 0.05} />
        <FilmGrain opacity={0.1} />

        <SafeAreaView style={styles.safe} edges={["top"]}>
          {/* Editorial Header */}
          <Animated.View entering={FadeInDown.duration(800).delay(200)} style={styles.header}>
            <Text style={[styles.headerLabel, { color: HEAT_LEVELS[(selectedHeat || 1) - 1].color }]}>
              {isPremium
                ? `${deckPrompts.length} PROMPTS READY`
                : `${weeklyPromptSet?.unlocked?.length || 0} FREE + ${weeklyPromptSet?.lockedPreviews?.length || 0} PREMIUM`}
            </Text>
            <Text style={[styles.headerTitle, { color: t.text }]}>Draw a card</Text>
            <Text style={[styles.headerSubtitle, { color: t.subtext }]}>{toneCopy.subtitle}</Text>
            {!isPremium && (
              <View style={[styles.weeklyDropBanner, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
                <Icon name="calendar-outline" size={14} color={t.subtext} />
                <Text style={[styles.weeklyDropText, { color: t.subtext }]}>
                  +5 new prompts every Monday • Premium gets +10
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Tactile Heat Selector */}
          <Animated.View entering={FadeIn.duration(800).delay(500)} style={styles.heatSection}>
            <Text style={[styles.sectionLabel, { color: t.subtext }]}>HEAT LEVEL</Text>
            <View style={styles.heatRow}>
              {HEAT_LEVELS.map(({ value, label, color: heatColor }) => {
                const active = selectedHeat === value;
                const locked = false;
                const aboveMax = value > maxSelectableHeat;

                const bgColor = active ? heatColor : isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
                const borderColor = active ? heatColor : locked ? heatColor + '30' : aboveMax ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)') : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)');
                const textColor = active ? '#FFFFFF' : withAlpha(heatColor, aboveMax ? 0.15 : locked ? 0.45 : 0.55);

                return (
                  <View key={value} style={[styles.chipWrapper, aboveMax && { opacity: 0.3 }]}>
                    <TouchableOpacity
                      style={[
                        styles.heatChip,
                        {
                          backgroundColor: bgColor,
                          borderColor: borderColor,
                          ...(active && Platform.OS === 'ios' ? {
                            shadowColor: heatColor,
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.6,
                            shadowRadius: 12,
                            elevation: 10,
                          } : {})
                        },
                      ]}
                      onPress={() => !aboveMax && handleHeatSelect(value)}
                      activeOpacity={aboveMax ? 1 : 0.8}
                      disabled={aboveMax}
                      accessibilityRole="button"
                      accessibilityLabel={`Heat level ${label}${active ? ', selected' : ''}${aboveMax ? ', unavailable' : ''}`}
                      accessibilityState={{ selected: active, disabled: aboveMax }}
                    >
                      <Text style={[styles.heatLabel, { color: textColor }]}>
                        {label}
                      </Text>
                      {locked && !aboveMax && (
                        <Text style={[styles.heatPremiumTag, { color: withAlpha(heatColor, 0.6) }]}>FULL</Text>
                      )}
                    </TouchableOpacity>
                    {locked && !aboveMax && (
                      <View style={[
                        styles.lockBadge,
                        {
                          backgroundColor: active ? (isDark ? '#000' : '#FFF') : t.background,
                          borderColor: active ? (isDark ? '#FFF' : '#000') : withAlpha(heatColor, 0.4)
                        }
                      ]}>
                        <Icon name="lock-closed" size={10} color={active ? '#FFF' : withAlpha(heatColor, 0.6)} />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </Animated.View>

          {/* Interaction Area */}
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={t.primary} />
            </View>
          ) : deckPrompts.length === 0 ? (
            <View style={styles.centered}>
              <Icon name="copy-outline" size={48} color={withAlpha(t.text, 0.1)} />
              <Text style={[styles.emptyText, { color: t.subtext }]}>{toneCopy.empty}</Text>
            </View>
          ) : (
            <View style={[styles.deckWrapper, { paddingBottom: tabBarHeight }]}>
              <PromptCardDeck
                key={deckVersion}
                prompts={deckPrompts}
                onSelect={handlePromptSelect}
                onSkip={() => impact(ImpactFeedbackStyle.Light)}
                onLongPress={handlePromptBoundaryAction}
              />
              {!isPremium && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => showPaywall?.(PremiumFeature.UNLIMITED_PROMPTS)}
                  style={[styles.premiumTeaserBanner, { backgroundColor: isDark ? 'rgba(210,18,26,0.12)' : 'rgba(210,18,26,0.07)', borderColor: 'rgba(210,18,26,0.2)' }]}
                >
                  <Icon name="flame" size={16} color="#D2121A" />
                  <Text style={[styles.premiumTeaserText, { color: isDark ? '#FF6B6B' : '#D2121A' }]}>
                    {weeklyPromptSet?.upgradeCopy?.body || 'Free preview refreshes weekly. Premium opens the full prompt library.'}
                  </Text>
                  <Icon name="chevron-forward" size={14} color="#D2121A" />
                </TouchableOpacity>
              )}
              <View style={styles.boundaryHintRow}>
                <Icon name="hand-left-outline" size={14} color={t.subtext} />
                <Text style={[styles.boundaryHintText, { color: t.subtext }]}>Long-press a card to hide it or mute its category.</Text>
              </View>
            </View>
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
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  headerLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 42,
  },
  headerSubtitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
  },
  heatSection: {
    paddingHorizontal: 32,
    marginBottom: 40,
  },
  sectionLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2.5,
    textAlign: 'center',
    marginBottom: 20,
  },
  heatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  chipWrapper: {
    flex: 1,
    position: 'relative',
  },
  heatChip: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 22,
    fontWeight: "800",
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  heatPremiumTag: {
    fontFamily: SYSTEM_FONT,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
    marginTop: 2,
  },
  lockBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  deckWrapper: {
    flex: 1,
  },
  boundaryHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 24,
  },
  boundaryHintText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  premiumTeaserBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 24,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  premiumTeaserText: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  weeklyDropBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  weeklyDropText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
