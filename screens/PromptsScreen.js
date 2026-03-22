// screens/PromptsScreen.js — Card-game prompt experience
// Swipeable card deck: draw, flip, swipe-right to reflect. Quiet & intimate.

import React, { useMemo, useState, useEffect, useCallback } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from '../components/Icon';
import {
  impact,
  selection,
  ImpactFeedbackStyle,
} from "../utils/haptics";
import { LinearGradient } from "expo-linear-gradient";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { SPACING, BORDER_RADIUS, withAlpha } from "../utils/theme";
import { useTheme } from "../context/ThemeContext";
import { useEntitlements } from "../context/EntitlementsContext";
import { useAuth } from "../context/AuthContext";
import PreferenceEngine from "../services/PreferenceEngine";
import PromptCardDeck from "../components/PromptCardDeck";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const FONTS = {
  serif: Platform.select({
    ios: "DMSerifDisplay-Regular",
    android: "DMSerifDisplay_400Regular",
    default: "serif",
  }),
  body: Platform.select({
    ios: "Lato-Regular",
    android: "Lato_400Regular",
    default: "sans-serif",
  }),
  bodyBold: Platform.select({
    ios: "Lato-Bold",
    android: "Lato_700Bold",
    default: "sans-serif",
  }),
};

const HEAT_LEVELS = [
  { value: 1, label: "1", color: "#F7A8B8" }, 
  { value: 2, label: "2", color: "#F27A9B" }, 
  { value: 3, label: "3", color: "#E84A7B" }, 
  { value: 4, label: "4", color: "#E23A68" }, 
  { value: 5, label: "5", color: "#B81438" }, 
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

const FALLBACK_PROMPT = {
  id: "fallback_prompt",
  text: "What is one small thing you can do today to feel closer?",
  category: "emotional",
  heat: 1,
};

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

  useEffect(() => {
    (async () => {
      try {
        const profile = await PreferenceEngine.getContentProfile(userProfile || {});
        let heat = profile?.heatLevel || userProfile?.heatLevelPreference || 1;
        if (!isPremium && heat >= 4) heat = 3;
        setSelectedHeat(heat);
      } catch {
        setSelectedHeat(1);
      }
    })();
  }, [userProfile, isPremium]);

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
    let byHeat = prompts.filter((p) => (p.heat || 1) === heat);
    return shuffleArray(byHeat);
  }, [prompts, selectedHeat]);

  const handlePromptSelect = useCallback((prompt) => {
    if (!isPremium && (prompt.heat || 1) >= 4) {
      showPaywall?.("unlimitedPrompts");
      return;
    }
    navigation.navigate("PromptAnswer", {
      prompt: { ...prompt, dateKey: new Date().toISOString().split("T")[0] },
    });
  }, [isPremium, showPaywall, navigation]);

  const handleHeatSelect = useCallback((heat) => {
    if (!isPremium && heat >= 4) {
      showPaywall?.("premiumHeatLevel");
      return;
    }
    setSelectedHeat(heat);
    selection();
  }, [isPremium, showPaywall]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />

        {/* Quiet Ambient Glow spotlight */}
        <LinearGradient
          colors={[
            isDark ? withAlpha(colors.primary, 0.12) : withAlpha(colors.primary, 0.08), 
            colors.background
          ]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <SafeAreaView style={styles.safe} edges={["top"]}>
          {/* Editorial Header */}
          <Animated.View entering={FadeInDown.duration(800).delay(200)} style={styles.header}>
            <Text style={[styles.headerLabel, { color: colors.primary }]}>
              {isPremium 
                ? `${deckPrompts.length} CARDS IN DECK` 
                : `${deckPrompts.length} OF ${TOTAL_PROMPT_COUNT} CARDS`}
            </Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Draw a card</Text>
          </Animated.View>

          {/* Premium Progress / Discovery Tracker */}
          {!isPremium && (
            <Animated.View entering={FadeIn.duration(800).delay(400)}>
              <TouchableOpacity
                style={[styles.progressCard, { backgroundColor: colors.surfaceGlass, borderColor: colors.borderGlass }]}
                onPress={() => showPaywall?.("unlimitedPrompts")}
                activeOpacity={0.9}
              >
                <View style={styles.progressHeader}>
                  <Text style={[styles.progressTitle, { color: colors.text }]}>
                    {TOTAL_PROMPT_COUNT - deckPrompts.length} more to discover
                  </Text>
                  <Icon name="star-four-points-outline" size={16} color={colors.primary} />
                </View>
                
                <View style={[styles.progressBar, { backgroundColor: withAlpha(colors.text, 0.05) }]}>
                  <LinearGradient
                    colors={[colors.primary, '#A00D31']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={[styles.progressFill, { width: `${Math.max(5, (deckPrompts.length / TOTAL_PROMPT_COUNT) * 100)}%` }]}
                  />
                </View>
                <Text style={[styles.progressSubtitle, { color: colors.textMuted }]}>
                  Unlock the full deck across all 5 heat levels
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Tactile Heat Selector (Intensity) */}
          <Animated.View entering={FadeIn.duration(800).delay(500)} style={styles.heatSection}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>INTENSITY</Text>
            <View style={styles.heatRow}>
              {HEAT_LEVELS.map(({ value, label, color: heatColor }) => {
                const active = selectedHeat === value;
                const locked = !isPremium && value >= 4;
                return (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.heatChip,
                      {
                        backgroundColor: active ? heatColor : withAlpha(heatColor, 0.12),
                        borderColor: active ? heatColor : withAlpha(heatColor, 0.25),
                      },
                    ]}
                    onPress={() => handleHeatSelect(value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.heatLabel, { color: active ? "#FFF" : colors.text }]}>
                      {label}
                    </Text>
                    {locked && (
                      <Icon name="lock" size={10} color={colors.textMuted} style={styles.lockIcon} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>

          {/* Main Card Deck Content Area */}
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : deckPrompts.length === 0 ? (
            <View style={styles.centered}>
              <Icon name="cards-variant" size={48} color={withAlpha(colors.text, 0.1)} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No cards match this level</Text>
            </View>
          ) : (
            <View style={styles.deckWrapper}>
              <PromptCardDeck
                prompts={deckPrompts}
                onSelect={handlePromptSelect}
                onSkip={() => {
                  impact(ImpactFeedbackStyle.Light);
                }}
              />
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
  
  // Header Architecture
  header: {
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 24,
  },
  headerLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 2.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: FONTS.serif,
    fontSize: 34,
    letterSpacing: -0.8,
    lineHeight: 42,
  },

  // Discovery / Progress Card
  progressCard: {
    marginHorizontal: 24,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
      },
      android: { elevation: 2 }
    })
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    letterSpacing: 0.2,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginBottom: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 12,
    opacity: 0.7,
  },

  // Heat Selector (Intensity Chips)
  heatSection: {
    paddingHorizontal: 32,
    marginBottom: 32,
  },
  sectionLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 16,
    opacity: 0.6,
  },
  heatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heatChip: {
    width: 58,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heatLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 18,
  },
  lockIcon: {
    position: 'absolute',
    bottom: 4,
    right: 4,
  },

  // Deck Interaction Area
  deckWrapper: {
    flex: 1,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    opacity: 0.6,
  },
});
