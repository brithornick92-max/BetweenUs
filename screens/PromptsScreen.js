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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from '../components/Icon';
import {
  impact,
  selection,
  ImpactFeedbackStyle,
} from "../utils/haptics";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { SPACING, withAlpha } from "../utils/theme";
import { useTheme } from "../context/ThemeContext";
import { useEntitlements } from "../context/EntitlementsContext";
import { useAuth } from "../context/AuthContext";
import PreferenceEngine from "../services/PreferenceEngine";
import PromptCardDeck from "../components/PromptCardDeck";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

const HEAT_LEVELS = [
  { value: 1, label: "1", color: "#FF85C2" },
  { value: 2, label: "2", color: "#FF1493" },
  { value: 3, label: "3", color: "#FF006E" },
  { value: 4, label: "4", color: "#D2121A" },
  { value: 5, label: "5", color: "#8E0D2C" },
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
  const tabBarHeight = useBottomTabBarHeight();
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const { userProfile } = useAuth();

  const [selectedHeat, setSelectedHeat] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(false);

  const t = useMemo(() => ({
    background: isDark ? '#1D1D1F' : '#FAF7F5',
    primary: '#D2121A',
    surface: isDark ? '#2C2C2E' : '#FFFFFF',
    text: colors.text,
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

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
    const byHeat = prompts.filter((p) => (p.heat || 1) === heat);
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
      <View style={[styles.root, { backgroundColor: t.background }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

        <SafeAreaView style={styles.safe} edges={["top"]}>
          {/* Editorial Header */}
          <Animated.View entering={FadeInDown.duration(800).delay(200)} style={styles.header}>
            <Text style={[styles.headerLabel, { color: t.primary }]}>
              {isPremium
                ? `${deckPrompts.length} PROMPTS READY`
                : `${deckPrompts.length} OF ${TOTAL_PROMPT_COUNT} PREVIEWS`}
            </Text>
            <Text style={[styles.headerTitle, { color: t.text }]}>Draw a card</Text>
          </Animated.View>

          {/* Premium Progress / Discovery Tracker */}
          {!isPremium && (
            <Animated.View entering={FadeIn.duration(800).delay(400)}>
              <TouchableOpacity
                style={[styles.progressCard, { backgroundColor: t.surface, borderColor: t.border }]}
                onPress={() => showPaywall?.("unlimitedPrompts")}
                activeOpacity={0.9}
              >
                <View style={styles.progressHeader}>
                  <Text style={[styles.progressTitle, { color: t.text }]}>
                    {TOTAL_PROMPT_COUNT - deckPrompts.length} Intimacies Await
                  </Text>
                  <Icon name="sparkles" size={16} color={t.primary} />
                </View>

                <View style={[styles.progressBar, { backgroundColor: withAlpha(t.text, 0.05) }]}>
                  <LinearGradient
                    colors={[t.primary, "#8E0D2C"]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={[styles.progressFill, { width: `${Math.max(8, (deckPrompts.length / TOTAL_PROMPT_COUNT) * 100)}%` }]}
                  />
                </View>
                <Text style={[styles.progressSubtitle, { color: t.subtext }]}>
                  Upgrade to unlock the complete editorial library
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Tactile Heat Selector */}
          <Animated.View entering={FadeIn.duration(800).delay(500)} style={styles.heatSection}>
            <Text style={[styles.sectionLabel, { color: t.subtext }]}>HEAT LEVEL</Text>
            <View style={styles.heatRow}>
              {HEAT_LEVELS.map(({ value, label, color: heatColor }) => {
                const active = selectedHeat === value;
                const locked = !isPremium && value >= 4;

                // Sleeping Neon Logic: unlit glass tubes that ignite on tap
                const bgColor = active ? heatColor : withAlpha(heatColor, 0.08);
                const borderColor = active ? heatColor : withAlpha(heatColor, 0.25);
                const textColor = active ? "#FFFFFF" : heatColor;
                const textOpacity = active ? 1 : 0.6;

                return (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.heatChip,
                      {
                        backgroundColor: bgColor,
                        borderColor: borderColor,
                        ...(active && Platform.OS === 'ios' ? {
                          shadowColor: heatColor,
                          shadowOffset: { width: 0, height: 6 },
                          shadowOpacity: 0.4,
                          shadowRadius: 10,
                        } : {})
                      },
                    ]}
                    onPress={() => handleHeatSelect(value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.heatLabel, { color: textColor, opacity: textOpacity }]}>
                      {label}
                    </Text>
                    {locked && (
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
                  </TouchableOpacity>
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
              <Text style={[styles.emptyText, { color: t.subtext }]}>No cards match this intensity</Text>
            </View>
          ) : (
            <View style={[styles.deckWrapper, { paddingBottom: tabBarHeight }]}>
              <PromptCardDeck
                prompts={deckPrompts}
                onSelect={handlePromptSelect}
                onSkip={() => impact(ImpactFeedbackStyle.Light)}
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
  header: {
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 24,
  },
  headerLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 42,
  },
  progressCard: {
    marginHorizontal: 32,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 32,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
      },
      android: { elevation: 3 }
    })
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginBottom: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  progressSubtitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: "600",
    opacity: 0.8,
  },
  heatSection: {
    paddingHorizontal: 32,
    marginBottom: 32,
  },
  sectionLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 16,
  },
  heatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  heatChip: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
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
  },
});
