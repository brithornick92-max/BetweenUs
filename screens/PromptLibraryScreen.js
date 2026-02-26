// File: screens/PromptLibraryScreen.js

import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useTheme } from "../context/ThemeContext";
import { useContent } from "../context/ContentContext";
import { useEntitlements } from '../context/EntitlementsContext';
import { promptStorage } from "../utils/storage";
import { TYPOGRAPHY, SPACING, BORDER_RADIUS } from "../utils/theme";
import PreferenceEngine from '../services/PreferenceEngine';
import PromptAllocator from '../services/PromptAllocator';

const CATEGORIES = [
  { id: "all", label: "All", icon: "view-grid" },
  { id: "romance", label: "Romance", icon: "heart" },
  { id: "emotional", label: "Emotional", icon: "hand-heart" },
  { id: "playful", label: "Playful", icon: "party-popper" },
  { id: "physical", label: "Physical", icon: "hand-wave" },
  { id: "fantasy", label: "Fantasy", icon: "star" },
  { id: "memory", label: "Memory", icon: "camera" },
  { id: "future", label: "Future", icon: "crystal-ball" },
  { id: "sensory", label: "Sensory", icon: "eye" },
  { id: "visual", label: "Visual", icon: "palette" },
  { id: "kinky", label: "Kinky", icon: "drama-masks" },
  { id: "location", label: "Location", icon: "map-marker" },
  { id: "seasonal", label: "Seasonal", icon: "weather-sunny" },
];

const HEAT_LABELS = { 1: 'Emotional', 2: 'Flirty', 3: 'Sensual', 4: 'Steamy', 5: 'Explicit' };
const HEAT_BADGE_COLORS = { 1: '#B07EFF', 2: '#FF7EB8', 3: '#FF7080', 4: '#FF8534', 5: '#FF2D2D' };

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

export default function PromptLibraryScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();

  // ContentContext could expose different methods in your app.
  // We’ll safely support whichever exists.
  const content = useContent?.() || {};
  const loadTodayPrompt = content?.loadTodayPrompt; // used for refresh flow (your existing)
  const getFilteredPrompts =
    content?.getFilteredPrompts || content?.contentLoader?.getFilteredPrompts;

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedHeat, setSelectedHeat] = useState(1);
  const [selectedDuration, setSelectedDuration] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [prompts, setPrompts] = useState([]); // raw loaded list
  const [allPromptsCount, setAllPromptsCount] = useState(0);
  const [favorites, setFavorites] = useState([]);

  const [loading, setLoading] = useState(false);

  // -----------------------
  // Load favorites
  // -----------------------
  const loadFavorites = useCallback(async () => {
    try {
      const saved = await promptStorage.getAnswer("favorites", "list");
      setFavorites(Array.isArray(saved?.favorites) ? saved.favorites : []);
    } catch (error) {
      console.error("Error loading favorites:", error);
      setFavorites([]);
    }
  }, []);

  // Load user's preferred heat level as default
  useEffect(() => {
    (async () => {
      try {
        const profile = await PreferenceEngine.getContentProfile();
        if (profile?.heatLevel) setSelectedHeat(profile.heatLevel);
      } catch (e) { /* fallback to default heat */ }
    })();
  }, []);

  // -----------------------
  // Load prompts (local + fallback)
  // -----------------------
  const loadPrompts = useCallback(async () => {
    setLoading(true);
    try {
      // Always load ALL prompts — heat gating handled in filteredPrompts
      const allPrompts = loadAllBundledPrompts();
      setAllPromptsCount(allPrompts.length);
      setPrompts(allPrompts.map(normalizePrompt));
    } catch (error) {
      console.error("Error loading prompts:", error);
      setPrompts([]);
    } finally {
      setLoading(false);
    }
  }, [isPremium]);

  useEffect(() => {
    loadPrompts();
    loadFavorites();
  }, [loadPrompts, loadFavorites]);

  // -----------------------
  // Derived filtered list (extra safety in case prompts are preloaded)
  // -----------------------
  const filteredPrompts = useMemo(() => {
    const list = Array.isArray(prompts) ? prompts : [];
    const isLocked = !isPremium && selectedHeat >= 4;

    // For locked levels, show exactly 1 preview prompt
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

        // Relationship duration filter (premium only)
        if (isPremium && selectedDuration !== "all") {
          const durations = Array.isArray(p.relationshipDuration) ? p.relationshipDuration : [];
          if (!durations.includes(selectedDuration) && !durations.includes("universal")) {
            return false;
          }
        }

        // Search filter
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const text = (p.text || "").toLowerCase();
          const cat = (p.category || "").toLowerCase();
          if (!text.includes(query) && !cat.includes(query)) {
            return false;
          }
        }

        return true;
      });
    // Remove today's daily prompt + already-answered, then tag the rest
    return PromptAllocator.tagAnswered(PromptAllocator.excludeUsed(base));
  }, [prompts, selectedCategory, selectedHeat, selectedDuration, searchQuery, isPremium]);

  // -----------------------
  // Favorite toggle
  // -----------------------
  const toggleFavorite = useCallback(
    async (promptId) => {
      if (!promptId) return;
      if (!isPremium) {
        showPaywall?.('unlimitedPrompts');
        return;
      }

      await Haptics.selectionAsync();

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
    },
    [favorites]
  );

  // -----------------------
  // Select prompt
  // -----------------------
  const handlePromptSelect = useCallback(
    async (prompt) => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const safePrompt = normalizePrompt(prompt);

      // Block heat 4-5 for non-premium (preview prompts trigger paywall)
      if (!isPremium && (safePrompt.isPreview || (safePrompt.heat || 1) >= 4)) {
        showPaywall?.('unlimitedPrompts');
        return;
      }

      const today = new Date().toISOString().split("T")[0];

      navigation.navigate("PromptAnswer", {
        prompt: { ...safePrompt, dateKey: today },
      });
    },
    [isPremium, navigation]
  );

  // -----------------------
  // Refresh prompt (your flow)
  // -----------------------
  const handleRefreshPrompt = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!isPremium) {
      Alert.alert(
        "Premium Feature",
        "Prompt refresh is available with Premium. Upgrade to explore unlimited prompts.",
        [
          { text: "Maybe Later", style: "cancel" },
          { text: "Upgrade", onPress: () => navigation.navigate("Paywall") },
        ]
      );
      return;
    }

    if (typeof loadTodayPrompt !== "function") {
      Alert.alert(
        "Not Available",
        "Prompt refresh isn’t wired up yet in ContentContext."
      );
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
  }, [isPremium, loadTodayPrompt, navigation, selectedHeat]);

  // -----------------------
  // UI pieces
  // -----------------------
  const renderCategoryChip = (category) => {
    const isSelected = selectedCategory === category.id;

    return (
      <TouchableOpacity
        key={category.id}
        style={[
          styles.categoryChip,
          {
            backgroundColor: isSelected ? colors.primary : colors.card,
            borderColor: isSelected ? colors.primary : colors.border,
          },
        ]}
        onPress={() => {
          setSelectedCategory(category.id);
          Haptics.selectionAsync();
        }}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name={category.icon}
          size={18}
          color={isSelected ? colors.surface : colors.text}
        />
        <Text
          style={[
            styles.categoryLabel,
            { color: isSelected ? colors.surface : colors.text },
          ]}
        >
          {category.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderHeatSelector = () => (
    <View style={styles.heatSelector}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Heat Level
      </Text>

      <View style={styles.heatButtons}>
        {[1, 2, 3, 4, 5].map((heat) => {
          const isSelected = selectedHeat === heat;
          const locked = !isPremium && heat >= 4;

          return (
            <TouchableOpacity
              key={heat}
              style={[
                styles.heatButton,
                {
                  backgroundColor: isSelected ? (HEAT_BADGE_COLORS[heat] || colors.primary) : colors.card,
                  borderColor: isSelected ? (HEAT_BADGE_COLORS[heat] || colors.primary) : locked ? (HEAT_BADGE_COLORS[heat] || colors.primary) + '60' : colors.border,
                },
              ]}
              onPress={() => {
                setSelectedHeat(heat);
                Haptics.selectionAsync();
              }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text
                  style={[
                    styles.heatButtonText,
                    { color: isSelected ? colors.surface : locked ? (HEAT_BADGE_COLORS[heat] || colors.text) : colors.text },
                  ]}
                >
                  {HEAT_LABELS[heat]}
                </Text>
                {locked ? (
                  <MaterialCommunityIcons
                    name="lock"
                    size={14}
                    color={isSelected ? colors.surface : (HEAT_BADGE_COLORS[heat] || colors.textSecondary)}
                  />
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderPromptCard = ({ item }) => {
    // ✅ prevents crash if FlatList passes undefined
    const safeItem = normalizePrompt(item);

    const isFavorite = favorites.includes(safeItem.id);

    return (
      <TouchableOpacity
        style={[
          styles.promptCard,
          { backgroundColor: isDark ? '#0C0810' : colors.card, borderColor: isDark ? 'rgba(196,86,122,0.06)' : colors.border },
          item.answered && { opacity: 0.55 },
        ]}
        onPress={() => handlePromptSelect(safeItem)}
        activeOpacity={0.8}
      >
        <View style={styles.promptCardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={[
                styles.categoryBadge,
                { backgroundColor: `${HEAT_BADGE_COLORS[safeItem.heat] || '#B07EFF'}20` },
              ]}
            >
              <Text style={[styles.categoryBadgeText, { color: HEAT_BADGE_COLORS[safeItem.heat] || '#B07EFF' }]}>
                {HEAT_LABELS[safeItem.heat] || 'Emotional'}
              </Text>
            </View>
            {item.answered && (
              <MaterialCommunityIcons name="check-circle" size={16} color={colors.success || '#4CAF50'} />
            )}
          </View>

          <TouchableOpacity
            onPress={() => toggleFavorite(safeItem.id)}
            style={styles.favoriteButton}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={isFavorite ? "heart" : "heart-outline"}
              size={24}
              color={isFavorite ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <Text style={[styles.promptText, { color: colors.text }]}>
          {safeItem.text}
        </Text>

        <View style={styles.promptCardFooter}>
          <View style={styles.heatIndicator}>
            <Text style={{ fontSize: 12, color: HEAT_BADGE_COLORS[safeItem.heat] || colors.textSecondary, fontWeight: '600' }}>
              {HEAT_LABELS[safeItem.heat] || 'Emotional'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const EmptyState = () => (
    <View style={styles.emptyState}>
      {loading ? (
        <>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Loading prompts...
          </Text>
        </>
      ) : (
        <>
          <MaterialCommunityIcons
            name="text-box-search"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No prompts match that — try a different heat level
          </Text>
        </>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={colors.gradients?.secondary || [colors.background, colors.background]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Prompt Library
          </Text>

          <TouchableOpacity
            onPress={handleRefreshPrompt}
            style={styles.refreshButton}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="refresh" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Premium prompt count badge */}
        {isPremium && allPromptsCount > 0 && (
          <View style={[styles.premiumBadgeBanner, { backgroundColor: `${colors.primary}15` }]}>
            <MaterialCommunityIcons name="diamond-stone" size={18} color={colors.primary} />
            <Text style={[styles.premiumBadgeText, { color: colors.primary }]}>
              {allPromptsCount} prompts unlocked
            </Text>
            <Text style={[styles.premiumBadgeSubtext, { color: colors.textSecondary }]}>
              {filteredPrompts.length} matching filters
            </Text>
          </View>
        )}

        {/* Free user upsell banner */}
        {!isPremium && (
          <TouchableOpacity
            style={[styles.upsellBanner, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` }]}
            onPress={() => showPaywall?.('unlimitedPrompts')}
            activeOpacity={0.8}
          >
            <View style={styles.upsellBannerContent}>
              <MaterialCommunityIcons name="lock-open-variant" size={22} color={colors.primary} />
              <View style={styles.upsellBannerText}>
                <Text style={[styles.upsellTitle, { color: colors.text }]}>
                  Unlock All 632 Prompts
                </Text>
                <Text style={[styles.upsellSubtitle, { color: colors.textSecondary }]}>
                  All heat levels, categories & search — go Premium
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={colors.primary} />
            </View>
          </TouchableOpacity>
        )}

        {/* Search bar (premium) */}
        {isPremium && (
          <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search prompts…"
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")} activeOpacity={0.7}>
                <MaterialCommunityIcons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Category Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryScrollContent}
        >
          {CATEGORIES.map(renderCategoryChip)}
        </ScrollView>

        {/* Relationship Duration Filter (premium only) */}
        {isPremium && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryScrollContent}
          >
            {DURATION_FILTERS.map((d) => {
              const isSelected = selectedDuration === d.id;
              return (
                <TouchableOpacity
                  key={d.id}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: isSelected ? colors.accent || colors.primary : colors.card,
                      borderColor: isSelected ? colors.accent || colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    setSelectedDuration(d.id);
                    Haptics.selectionAsync();
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.categoryLabel,
                      { color: isSelected ? colors.surface : colors.text },
                    ]}
                  >
                    {d.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Heat Level Selector */}
        {renderHeatSelector()}

        {/* Prompts List */}
        <FlatList
          data={filteredPrompts}
          renderItem={renderPromptCard}
          keyExtractor={(item, index) => item?.id?.toString?.() || `prompt_${index}`}
          contentContainerStyle={styles.promptsList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState />}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backButton: { padding: SPACING.sm },
  headerTitle: {
    ...TYPOGRAPHY.h1,
    fontSize: 20,
    fontWeight: "700",
  },
  refreshButton: { padding: SPACING.sm },

  categoryScroll: {
    maxHeight: 50,
    marginBottom: SPACING.lg,
  },
  categoryScrollContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    gap: SPACING.xs,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: "600",
  },

  heatSelector: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h2,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: SPACING.sm,
  },
  heatButtons: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  heatButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heatButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },

  promptsList: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },

  promptCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  promptCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  categoryBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  favoriteButton: {
    padding: SPACING.xs,
  },
  promptText: {
    ...TYPOGRAPHY.body,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: SPACING.md,
  },
  promptCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heatIndicator: {
    flexDirection: "row",
    gap: 2,
  },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.xxl * 2,
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    fontSize: 16,
    marginTop: SPACING.md,
  },

  // Premium badge banner
  premiumBadgeBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
  },
  premiumBadgeText: {
    fontSize: 14,
    fontWeight: "700",
  },
  premiumBadgeSubtext: {
    fontSize: 12,
    marginLeft: "auto",
  },

  // Upsell banner
  upsellBanner: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
  },
  upsellBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  upsellBannerText: {
    flex: 1,
  },
  upsellTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  upsellSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },

  // Search bar
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 4,
  },
});
