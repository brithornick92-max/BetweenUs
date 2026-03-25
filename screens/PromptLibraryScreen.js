/**
 * PromptLibraryScreen — Editorial Catalog of Closeness
 * Sexy Red Intimacy & Apple Editorial Updates Integrated.
 * High-fidelity browsing for curated reflections.
 */

import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
} from "react-native";
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from '../components/Icon';
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';

import { useTheme } from "../context/ThemeContext";
import { useContent } from "../context/ContentContext";
import { useEntitlements } from '../context/EntitlementsContext';
import { useAuth } from '../context/AuthContext';
import { promptStorage } from "../utils/storage";
import { PremiumFeature } from '../utils/featureFlags';
import { withAlpha } from "../utils/theme";
import PreferenceEngine from '../services/PreferenceEngine';
import PromptAllocator from '../services/PromptAllocator';
import FilmGrain from '../components/FilmGrain';
import { SoftBoundaries } from '../services/PolishEngine';
import { getFilteredPromptsWithProfile } from '../utils/contentLoader';

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

const CATEGORIES = [
  { id: "all", label: "All", icon: "grid-outline" },
  { id: "romance", label: "Romance", icon: "heart-outline" },
  { id: "emotional", label: "Emotional", icon: "leaf-outline" },
  { id: "playful", label: "Playful", icon: "sparkles-outline" },
  { id: "physical", label: "Physical", icon: "hand-right-outline" },
  { id: "fantasy", label: "Fantasy", icon: "moon-outline" },
  { id: "memory", label: "Memory", icon: "camera-outline" },
  { id: "future", label: "Future", icon: "planet-outline" },
  { id: "sensory", label: "Sensory", icon: "eye-outline" },
  { id: "visual", label: "Visual", icon: "color-palette-outline" },
  { id: "kinky", label: "Kinky", icon: "flame-outline" },
  { id: "location", label: "Location", icon: "map-outline" },
  { id: "seasonal", label: "Seasonal", icon: "sunny-outline" },
];

const HEAT_LABELS = { 1: 'Emotional', 2: 'Flirty', 3: 'Sensual', 4: 'Steamy', 5: 'Explicit' };
const HEAT_BADGE_COLORS = { 1: '#FF85C2', 2: '#FF1493', 3: '#FF006E', 4: '#F00049', 5: '#D2121A' };

const DURATION_FILTERS = [
  { id: "all", label: "All Stages" },
  { id: "new", label: "New" },
  { id: "developing", label: "Developing" },
  { id: "established", label: "Established" },
  { id: "mature", label: "Mature" },
  { id: "long_term", label: "Long-term" },
  { id: "universal", label: "Universal" },
];

/** Load the full bundled prompt catalog */
const loadAllBundledPrompts = () => {
  try {
    const bundled = require("../content/prompts.json");
    return Array.isArray(bundled?.items) ? bundled.items : [];
  } catch {
    return [];
  }
};

// Safe fallback prompt (never missing .text)
const FALLBACK_PROMPT = {
  id: "fallback_prompt",
  text: "What’s one small thing you can do today to feel closer?",
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

const TONE_LIBRARY_COPY = {
  warm: {
    subtitle: 'A softer catalog for closeness and comfort.',
    empty: 'No warm matches here yet. Try another category or soften the heat.',
  },
  playful: {
    subtitle: 'Bolder prompts, lighter energy, more spark.',
    empty: 'Nothing playful matched. Switch categories or turn the heat a notch.',
  },
  intimate: {
    subtitle: 'Curated for deeper tension and honest closeness.',
    empty: 'No intimate matches here. Try a neighboring heat level or category.',
  },
  minimal: {
    subtitle: 'Cleaner prompts with less noise and more directness.',
    empty: 'No minimal matches found. Try a simpler filter mix.',
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

export default function PromptLibraryScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const { userProfile } = useAuth();

  const content = useContent?.() || {};
  const loadTodayPrompt = content?.loadTodayPrompt;

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedHeat, setSelectedHeat] = useState(1);
  const [selectedDuration, setSelectedDuration] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTone, setSelectedTone] = useState('warm');
  const [contentProfile, setContentProfile] = useState(null);

  const [prompts, setPrompts] = useState([]);
  const [allPromptsCount, setAllPromptsCount] = useState(0);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);

  // ─── OLED Editorial Palette ───
  const t = useMemo(() => ({
    background: '#0A0A0A',
    surface: '#1C1C1E',
    primary: '#FF2D55',
    text: '#FFFFFF',
    subtext: 'rgba(255,255,255,0.4)',
    border: 'rgba(255,255,255,0.1)',
  }), []);

  const loadFavorites = useCallback(async () => {
    try {
      const saved = await promptStorage.getAnswer("favorites", "list");
      setFavorites(Array.isArray(saved?.favorites) ? saved.favorites : []);
    } catch (error) {
      console.error("Error loading favorites:", error);
      setFavorites([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        try {
          const profile = await PreferenceEngine.getContentProfile(userProfile || {});
          if (!active) return;
          setContentProfile(profile);
          if (profile?.heatLevel) setSelectedHeat(profile.heatLevel);
          setSelectedTone(profile?.tone || 'warm');
        } catch {
          if (!active) return;
          setContentProfile(null);
          setSelectedTone('warm');
        }
      })();

      return () => {
        active = false;
      };
    }, [userProfile])
  );

  const toneCopy = TONE_LIBRARY_COPY[selectedTone] || TONE_LIBRARY_COPY.warm;

  const loadPrompts = useCallback(async () => {
    setLoading(true);
    try {
      const allPrompts = loadAllBundledPrompts();
      setAllPromptsCount(allPrompts.length);
      setPrompts(allPrompts.map(normalizePrompt));
    } catch (error) {
      console.error("Error loading prompts:", error);
      setPrompts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrompts();
    loadFavorites();
  }, [loadPrompts, loadFavorites]);

  const filteredPrompts = useMemo(() => {
    const selectableMaxHeat = resolveSelectableMaxHeat(contentProfile, selectedHeat);
    const list = contentProfile
      ? getFilteredPromptsWithProfile({
          ...contentProfile,
          maxHeat: selectableMaxHeat,
        }).map(normalizePrompt)
      : Array.isArray(prompts) ? prompts : [];
    const isLocked = !isPremium && selectedHeat >= 4;

    if (isLocked) {
      const match = list.map(normalizePrompt).find(p => (typeof p.heat === 'number' ? p.heat : 1) === selectedHeat);
      return match ? [{ ...match, isPreview: true }] : [];
    }

    const base = list
      .map(normalizePrompt)
      .filter((p) => {
        if (!p) return false;
        const heat = typeof p.heat === "number" ? p.heat : 1;
        if (heat !== selectedHeat) return false;
        if (selectedCategory !== "all") {
          const cat = typeof p.category === "string" ? p.category : "general";
          if (cat !== selectedCategory) return false;
        }
        if (isPremium && selectedDuration !== "all") {
          const durations = Array.isArray(p.relationshipDuration) ? p.relationshipDuration : [];
          if (!durations.includes(selectedDuration) && !durations.includes("universal")) return false;
        }
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const text = (p.text || "").toLowerCase();
          const cat = (p.category || "").toLowerCase();
          if (!text.includes(query) && !cat.includes(query)) return false;
        }
        return true;
      });
    const browsable = PromptAllocator.excludeUsed(base);
    const rankingProfile = contentProfile
      ? { ...contentProfile, maxHeat: selectableMaxHeat }
      : null;
    const ranked = rankingProfile
      ? PreferenceEngine.filterPrompts(browsable, rankingProfile)
      : browsable;
    return PromptAllocator.tagAnswered(ranked);
  }, [prompts, selectedCategory, selectedHeat, selectedDuration, searchQuery, isPremium, contentProfile]);

  const toggleFavorite = useCallback(async (promptId) => {
    if (!promptId) return;
    if (!isPremium) {
      showPaywall?.(PremiumFeature.UNLIMITED_PROMPTS);
      return;
    }
    selection();
    const newFavorites = favorites.includes(promptId)
      ? favorites.filter((id) => id !== promptId)
      : [...favorites, promptId];
    setFavorites(newFavorites);
    try {
      await promptStorage.setAnswer("favorites", "list", {
        favorites: newFavorites,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Error saving favorites:", error);
    }
  }, [favorites, isPremium, showPaywall]);

  const handlePromptSelect = useCallback((prompt) => {
    const safePrompt = normalizePrompt(prompt);
    if (!isPremium && (safePrompt.isPreview || (safePrompt.heat || 1) >= 4)) {
      showPaywall?.(PremiumFeature.UNLIMITED_PROMPTS);
      return;
    }
    impact(ImpactFeedbackStyle.Light);
    navigation.navigate("PromptAnswer", {
      prompt: { ...safePrompt, dateKey: new Date().toISOString().split("T")[0] },
    });
  }, [isPremium, navigation, showPaywall]);

  const handleRefreshPrompt = useCallback(async () => {
    impact(ImpactFeedbackStyle.Medium);
    if (!isPremium) {
      Alert.alert(
        "There's more waiting for you",
        "There are so many more prompts waiting for you.",
        [
          { text: "Maybe Later", style: "cancel" },
          { text: "Discover more", onPress: () => showPaywall?.(PremiumFeature.PROMPT_REFRESH) },
        ]
      );
      return;
    }
    if (typeof loadTodayPrompt !== "function") {
      await loadPrompts();
      return;
    }
    try {
      await loadTodayPrompt(selectedHeat);
      Alert.alert("Success", "New prompt loaded!");
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to load new prompt. Please try again.");
    }
  }, [isPremium, loadTodayPrompt, loadPrompts, navigation, selectedHeat, showPaywall]);

  const refreshBoundaryProfile = useCallback(async () => {
    const profile = await PreferenceEngine.getContentProfile(userProfile || {});
    setContentProfile(profile);
  }, [userProfile]);

  const handleBoundaryAction = useCallback((prompt) => {
    if (!prompt?.id) return;

    Alert.alert(
      'Boundary Options',
      'Choose how you want this prompt handled.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Hide This Prompt',
          onPress: async () => {
            await SoftBoundaries.pauseEntry(prompt.id);
            await refreshBoundaryProfile();
          },
        },
        {
          text: 'Hide This Category',
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

  const renderCategoryChip = (cat) => {
    const active = selectedCategory === cat.id;
    return (
      <TouchableOpacity
        key={cat.id}
        style={[styles.categoryChip, { backgroundColor: active ? t.primary : t.surface, borderColor: active ? t.primary : t.border }]}
        onPress={() => { setSelectedCategory(cat.id); selection(); }}
        activeOpacity={0.7}
      >
        <Icon name={cat.icon} size={16} color={active ? "#FFF" : t.text} />
        <Text style={[styles.categoryLabel, { color: active ? "#FFF" : t.text }]}>{cat.label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar barStyle="light-content" />
      <FilmGrain opacity={0.03} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>

        {/* Editorial Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.8}>
            <Icon name="chevron-back" size={28} color={t.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerSub, { color: HEAT_BADGE_COLORS[selectedHeat] }]}>CATALOG</Text>
            <Text style={[styles.headerTitle, { color: t.text }]}>Library</Text>
            <Text style={[styles.headerTone, { color: t.subtext }]}>{toneCopy.subtitle}</Text>
          </View>
          <TouchableOpacity onPress={handleRefreshPrompt} style={styles.refreshButton} activeOpacity={0.8}>
            <Icon name="sync-outline" size={22} color={t.subtext} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[2]}>

          {/* Search Bar (premium) */}
          {isPremium && (
            <View style={[styles.searchWrapper, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Icon name="search-outline" size={18} color={t.subtext} />
              <TextInput
                style={[styles.searchInput, { color: t.text }]}
                placeholder="Search reflections..."
                placeholderTextColor={t.subtext}
                value={searchQuery}
                onChangeText={setSearchQuery}
                selectionColor={t.primary}
                returnKeyType="search"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")} activeOpacity={0.7}>
                  <Icon name="close-circle" size={18} color={t.subtext} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Premium Counts */}
          {isPremium && allPromptsCount > 0 && (
            <View style={styles.statsRow}>
              <View style={[styles.statBadge, { backgroundColor: withAlpha(t.primary, 0.1) }]}>
                <Text style={[styles.statText, { color: t.primary }]}>{allPromptsCount} UNLOCKED</Text>
              </View>
              <Text style={[styles.statMatch, { color: t.subtext }]}>{filteredPrompts.length} MATCHES</Text>
            </View>
          )}

          {/* Filter Sticky Header */}
          <View style={{ backgroundColor: t.background, paddingBottom: 16 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              {CATEGORIES.map(renderCategoryChip)}
            </ScrollView>
          </View>

          {/* Relationship Duration Filter (premium only) */}
          {isPremium && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterScroll, { marginBottom: 8 }]}>
              {DURATION_FILTERS.map((d) => {
                const isSelected = selectedDuration === d.id;
                return (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.categoryChip, { backgroundColor: isSelected ? (colors.accent || t.primary) : t.surface, borderColor: isSelected ? (colors.accent || t.primary) : t.border }]}
                    onPress={() => { setSelectedDuration(d.id); selection(); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.categoryLabel, { color: isSelected ? "#FFF" : t.text }]}>{d.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Heat Selector */}
          <View style={styles.heatSection}>
            <Text style={[styles.sectionTitle, { color: t.subtext }]}>HEAT INTENSITY</Text>
            <View style={styles.heatRow}>
              {[1, 2, 3, 4, 5].map((h) => {
                const active = selectedHeat === h;
                const locked = !isPremium && h >= 4;
                const userMaxHeat = userProfile?.heatLevelPreference ?? 5;
                const aboveMax = h > userMaxHeat;
                const heatColor = HEAT_BADGE_COLORS[h];
                return (
                  <TouchableOpacity
                    key={h}
                    style={[styles.heatBtn, {
                      backgroundColor: active ? heatColor : 'rgba(255,255,255,0.03)',
                      borderColor: active ? heatColor : aboveMax ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.1)',
                      opacity: aboveMax ? 0.3 : 1,
                      ...(active ? {
                        shadowColor: heatColor,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.5,
                        shadowRadius: 10,
                        elevation: 8,
                      } : {}),
                    }]}
                    onPress={() => {
                      if (aboveMax) return;
                      if (!isPremium && h >= 4) {
                        showPaywall?.(PremiumFeature.HEAT_LEVELS_4_5);
                        return;
                      }
                      setSelectedHeat(h);
                      selection();
                    }}
                    activeOpacity={aboveMax ? 1 : 0.7}
                    disabled={aboveMax}
                  >
                    <Text style={[styles.heatBtnText, { color: active ? '#FFF' : withAlpha(heatColor, aboveMax ? 0.15 : 0.5) }]}>
                      {HEAT_LABELS[h].toUpperCase()}
                    </Text>
                    {locked && !aboveMax && <Icon name="lock-closed" size={10} color={active ? '#FFF' : withAlpha(heatColor, 0.4)} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Free upsell banner */}
          {!isPremium && (
            <TouchableOpacity
              style={[styles.upsellBanner, { backgroundColor: withAlpha(t.primary, 0.08), borderColor: withAlpha(t.primary, 0.25) }]}
              onPress={() => showPaywall?.(PremiumFeature.UNLIMITED_PROMPTS)}
              activeOpacity={0.8}
            >
              <Icon name="lock-open-outline" size={20} color={t.primary} />
              <View style={styles.upsellBannerText}>
                <Text style={[styles.upsellTitle, { color: t.text }]}>Unlock All 600+ Prompts</Text>
                <Text style={[styles.upsellSubtitle, { color: t.subtext }]}>All heat levels, categories & search — go Premium</Text>
              </View>
              <Icon name="chevron-forward" size={20} color={t.primary} />
            </TouchableOpacity>
          )}

          {/* Prompt Feed */}
          {loading ? (
            <ActivityIndicator color={t.primary} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.promptList}>
              <View style={[styles.boundaryHintBanner, { backgroundColor: withAlpha(t.primary, 0.06), borderColor: withAlpha(t.primary, 0.16) }]}> 
                <Icon name="hand-left-outline" size={15} color={t.primary} />
                <Text style={[styles.boundaryHintText, { color: t.subtext }]}>Long-press any prompt to hide it or mute that category.</Text>
              </View>
              {filteredPrompts.map((item, index) => {
                const safe = normalizePrompt(item);
                const isFav = favorites.includes(safe.id);
                return (
                  <TouchableOpacity
                    key={safe.id || `prompt_${index}`}
                    style={[styles.promptCard, { backgroundColor: t.surface, borderColor: t.border }, item.answered && { opacity: 0.5 }]}
                    onPress={() => handlePromptSelect(safe)}
                    onLongPress={() => handleBoundaryAction(safe)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.cardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[styles.cardHeatBadge, { backgroundColor: withAlpha(HEAT_BADGE_COLORS[safe.heat], 0.12) }]}>
                          <Text style={[styles.cardHeatText, { color: HEAT_BADGE_COLORS[safe.heat] }]}>
                            {(HEAT_LABELS[safe.heat] || 'Emotional').toUpperCase()}
                          </Text>
                        </View>
                        {item.answered && (
                          <Icon name="checkmark-circle-outline" size={16} color={'#34C759'} />
                        )}
                      </View>
                      <TouchableOpacity onPress={() => toggleFavorite(safe.id)} style={styles.favoriteButton} activeOpacity={0.8}>
                        <Icon name="heart-outline" size={22} color={isFav ? t.primary : t.subtext} />
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.cardText, { color: t.text }]}>{safe.text}</Text>

                    {item.answered && (
                      <View style={styles.answeredTag}>
                        <Icon name="checkmark-circle-outline" size={14} color={t.primary} />
                        <Text style={[styles.answeredText, { color: t.primary }]}>REFLECTED</Text>
                      </View>
                    )}

                    {safe.isPreview && (
                      <View style={[styles.previewOverlay, { backgroundColor: withAlpha(t.background, 0.85) }]}>
                        <Icon name="lock-closed-outline" size={20} color={t.primary} />
                        <Text style={[styles.previewText, { color: t.primary }]}>PREMIUM</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}

              {!filteredPrompts.length && !loading && (
                <View style={styles.emptyState}>
                  <Icon name="search-outline" size={48} color={t.border} />
                  <Text style={[styles.emptyText, { color: t.subtext }]}>{toneCopy.empty}</Text>
                </View>
              )}
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {!isPremium && (
          <TouchableOpacity
            style={[styles.premiumFab, { backgroundColor: t.primary }]}
            onPress={() => showPaywall?.(PremiumFeature.UNLIMITED_PROMPTS)}
            activeOpacity={0.8}
          >
            <Icon name="sparkles-outline" size={18} color="#FFF" />
            <Text style={styles.premiumFabText}>UNLOCK 600+ PROMPTS</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 80,
  },
  headerCenter: { alignItems: 'center' },
  headerSub: {
    fontFamily: SYSTEM_FONT,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
  headerTone: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  backButton: { width: 44, height: 44, justifyContent: 'center' },
  refreshButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: '500',
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  statBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  statMatch: { fontSize: 11, fontWeight: '700' },

  filterScroll: { paddingHorizontal: 24, gap: 8 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 19,
    borderWidth: 1,
    gap: 8,
  },
  categoryLabel: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },

  heatSection: { paddingHorizontal: 24, marginVertical: 24 },
  sectionTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 16 },
  heatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heatBtn: {
    flex: 1,
    minWidth: '30%',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  heatBtnText: { fontSize: 12, fontWeight: '800' },

  upsellBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  upsellBannerText: { flex: 1 },
  upsellTitle: { fontSize: 15, fontWeight: '700' },
  upsellSubtitle: { fontSize: 13, marginTop: 2 },

  promptList: { paddingHorizontal: 24, gap: 16 },
  boundaryHintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  boundaryHintText: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  promptCard: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardHeatBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  cardHeatText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  cardText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  favoriteButton: { padding: 4 },
  answeredTag: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  answeredText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  previewOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  previewText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },

  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyText: { marginTop: 16, fontWeight: '600', fontSize: 15 },

  premiumFab: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 24,
    borderRadius: 28,
    gap: 12,
    shadowColor: '#D2121A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  premiumFabText: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
});
