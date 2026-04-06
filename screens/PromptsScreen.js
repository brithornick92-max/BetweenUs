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
import { SPACING, withAlpha } from "../utils/theme";
import { useTheme } from "../context/ThemeContext";
import { useEntitlements } from "../context/EntitlementsContext";
import { useAuth } from "../context/AuthContext";
import PreferenceEngine from "../services/PreferenceEngine";
import PromptCardDeck from "../components/PromptCardDeck";
import { SoftBoundaries } from "../services/PolishEngine";
import { getFilteredPromptsWithProfile, FALLBACK_PROMPT } from "../utils/contentLoader";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

const HEAT_LEVELS = [
  { value: 1, label: "1", color: "#FF85C2" }, // Soft Orchid Pink
  { value: 2, label: "2", color: "#FF1493" }, // Deep Pink
  { value: 3, label: "3", color: "#FF006E" }, // Vivid Magenta-Red
  { value: 4, label: "4", color: "#F00049" }, // Carmine
  { value: 5, label: "5", color: "#D2121A" }, // Deep Red
];

const loadAllBundledPrompts = () => {
  try {
    const bundled = require("../content/prompts.json");
    return Array.isArray(bundled?.items) ? bundled.items : [];
  } catch {
    return [];
  }
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

const resolveSelectableMaxHeat = (profile, selectedHeat) => {
  const requestedHeat = typeof selectedHeat === 'number' ? selectedHeat : 1;
  const caps = [requestedHeat];
  if (profile?.boundaries?.hideSpicy) caps.push(3);
  else if (typeof profile?.boundaries?.maxHeatOverride === 'number') caps.push(profile.boundaries.maxHeatOverride);
  if (typeof profile?.maxHeat === 'number') caps.push(profile.maxHeat);
  return Math.min(...caps);
};

const clampHeatSelection = (profile, selectedHeat) => {
  const requestedHeat = typeof selectedHeat === 'number' ? selectedHeat : 1;
  const normalizedHeat = Math.min(Math.max(requestedHeat, 1), 5);
  return Math.max(1, resolveSelectableMaxHeat(profile, normalizedHeat));
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
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const { userProfile } = useAuth();

  const [selectedHeat, setSelectedHeat] = useState(null);
  const [selectedTone, setSelectedTone] = useState('warm');
  const [contentProfile, setContentProfile] = useState(null);
  const [rawBoundaries, setRawBoundaries] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deckVersion, setDeckVersion] = useState(0);

  const t = useMemo(() => ({
    background: '#0A0A0A',
    primary: '#FF2D55',
    surface: '#1C1C1E',
    text: '#FFFFFF',
    subtext: 'rgba(255,255,255,0.4)',
    border: 'rgba(255,255,255,0.1)',
  }), []);

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
          if (!isPremium && heat >= 4) heat = 3;
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
    }, [userProfile, isPremium])
  );

  const toneCopy = TONE_PROMPT_COPY[selectedTone] || TONE_PROMPT_COPY.warm;
  const maxSelectableHeat = useMemo(
    () => clampHeatSelection(contentProfile, userProfile?.heatLevelPreference || 5),
    [contentProfile, userProfile?.heatLevelPreference]
  );

  const loadPrompts = useCallback(async () => {
    if (selectedHeat === null) return;
    setLoading(true);
    try {
      const allPrompts = ALL_BUNDLED.map(normalizePrompt);
      setPrompts(allPrompts);
    } catch {
      setPrompts([]);
    } finally {
      setLoading(false);
    }
  }, [selectedHeat]);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const deckPrompts = useMemo(() => {
    const heat = selectedHeat ?? 1;
    const selectableMaxHeat = resolveSelectableMaxHeat(contentProfile, heat);
    const profileBase = contentProfile
      ? getFilteredPromptsWithProfile({
          ...contentProfile,
          maxHeat: selectableMaxHeat,
        }).map(normalizePrompt)
      : applyRawBoundaryFilter(prompts, rawBoundaries);
    const byHeat = profileBase.filter((p) => (p.heat || 1) === heat);
    if (!contentProfile) return shuffleArray(byHeat);
    return PreferenceEngine.filterPrompts(byHeat, {
      ...contentProfile,
      maxHeat: selectableMaxHeat,
    });
  }, [prompts, selectedHeat, contentProfile, rawBoundaries]);

  const handlePromptSelect = useCallback((prompt) => {
    if (!isPremium && (prompt.heat || 1) >= 4) {
      showPaywall?.(PremiumFeature.UNLIMITED_PROMPTS);
      return;
    }
    navigation.navigate("PromptAnswer", {
      prompt: { ...prompt, dateKey: new Date().toISOString().split("T")[0] },
    });
  }, [isPremium, showPaywall, navigation]);

  const handleHeatSelect = useCallback((heat) => {
    if (!isPremium && heat >= 4) {
      showPaywall?.(PremiumFeature.HEAT_LEVELS_4_5);
      return;
    }
    setSelectedHeat(heat);
    selection();
  }, [isPremium, showPaywall]);

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
        <StatusBar barStyle="light-content" />

        <SafeAreaView style={styles.safe} edges={["top"]}>
          {/* Editorial Header */}
          <Animated.View entering={FadeInDown.duration(800).delay(200)} style={styles.header}>
            <Text style={[styles.headerLabel, { color: HEAT_LEVELS[(selectedHeat || 1) - 1].color }]}>
              {isPremium
                ? `${deckPrompts.length} PROMPTS READY`
                : `${deckPrompts.length} OF ${TOTAL_PROMPT_COUNT} PREVIEWS`}
            </Text>
            <Text style={[styles.headerTitle, { color: t.text }]}>Draw a card</Text>
            <Text style={[styles.headerSubtitle, { color: t.subtext }]}>{toneCopy.subtitle}</Text>
          </Animated.View>

          {/* Tactile Heat Selector */}
          <Animated.View entering={FadeIn.duration(800).delay(500)} style={styles.heatSection}>
            <Text style={[styles.sectionLabel, { color: t.subtext }]}>HEAT LEVEL</Text>
            <View style={styles.heatRow}>
              {HEAT_LEVELS.map(({ value, label, color: heatColor }) => {
                const active = selectedHeat === value;
                const locked = !isPremium && value >= 4;
                const aboveMax = value > maxSelectableHeat;

                const bgColor = active ? heatColor : 'rgba(255,255,255,0.03)';
                const borderColor = active ? heatColor : aboveMax ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.1)';
                const textColor = active ? '#FFFFFF' : withAlpha(heatColor, aboveMax ? 0.15 : 0.4);

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
                    >
                      <Text style={[styles.heatLabel, { color: textColor }]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                    {locked && !aboveMax && (
                      <View style={[
                        styles.lockBadge,
                        {
                          backgroundColor: active ? '#000' : t.background,
                          borderColor: active ? '#FFF' : withAlpha(heatColor, 0.4)
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
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 24,
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
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1.5,
  },
  headerSubtitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    opacity: 0.9,
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
});
