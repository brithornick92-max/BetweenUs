// File: screens/PromptLibraryScreen.js

import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
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

const CATEGORIES = [
  { id: "all", label: "All", icon: "view-grid" },
  { id: "emotional", label: "Emotional", icon: "heart" },
  { id: "physical", label: "Physical", icon: "hand-heart" },
  { id: "fun", label: "Fun", icon: "party-popper" },
  { id: "deep", label: "Deep", icon: "thought-bubble" },
  { id: "fantasy", label: "Fantasy", icon: "star" },
  { id: "roleplay", label: "Role-play", icon: "drama-masks" },
];

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
  const { colors } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();

  // ContentContext could expose different methods in your app.
  // We’ll safely support whichever exists.
  const content = useContent?.() || {};
  const loadTodayPrompt = content?.loadTodayPrompt; // used for refresh flow (your existing)
  const getFilteredPrompts =
    content?.getFilteredPrompts || content?.contentLoader?.getFilteredPrompts;

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedHeat, setSelectedHeat] = useState(1);

  const [prompts, setPrompts] = useState([]); // raw loaded list
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

  // -----------------------
  // Load prompts (local + fallback)
  // -----------------------
  const loadPrompts = useCallback(async () => {
    setLoading(true);
    try {
      // ✅ If your ContentContext supports filtering locally, use it.
      if (typeof getFilteredPrompts === "function") {
        const filters = {
          minHeatLevel: selectedHeat,
          maxHeatLevel: selectedHeat,
          categories: selectedCategory === "all" ? [] : [selectedCategory],
        };

        const local = getFilteredPrompts(filters);
        setPrompts(Array.isArray(local) ? local.map(normalizePrompt) : []);
        return;
      }

      // Otherwise fallback to placeholder list (your current mock)
      const mockPrompts = [
        {
          id: "mock_1",
          text: "What's one thing you love about our relationship?",
          category: "emotional",
          heat: 1,
        },
        {
          id: "mock_2",
          text: "Describe a perfect date night with your partner.",
          category: "fun",
          heat: 2,
        },
      ];

      setPrompts(mockPrompts.map(normalizePrompt));
    } catch (error) {
      console.error("Error loading prompts:", error);
      setPrompts([]);
    } finally {
      setLoading(false);
    }
  }, [getFilteredPrompts, selectedCategory, selectedHeat]);

  useEffect(() => {
    loadPrompts();
    loadFavorites();
  }, [loadPrompts, loadFavorites]);

  // -----------------------
  // Derived filtered list (extra safety in case prompts are preloaded)
  // -----------------------
  const filteredPrompts = useMemo(() => {
    const list = Array.isArray(prompts) ? prompts : [];
    return list
      .map(normalizePrompt)
      .filter((p) => {
        if (!p) return false;

        const heat = typeof p.heat === "number" ? p.heat : 1;
        if (heat !== selectedHeat) return false;

        if (selectedCategory !== "all") {
          const cat = typeof p.category === "string" ? p.category : "general";
          if (cat !== selectedCategory) return false;
        }
        return true;
      });
  }, [prompts, selectedCategory, selectedHeat]);

  // -----------------------
  // Favorite toggle
  // -----------------------
  const toggleFavorite = useCallback(
    async (promptId) => {
      if (!promptId) return;

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

      // Optional: block heat 5 for non-premium
      if (!isPremium && safePrompt.heat === 5) {
        Alert.alert(
          "Premium Feature",
          "Heat level 5 prompts are available with Premium.",
          [
            { text: "Maybe Later", style: "cancel" },
            { text: "Upgrade", onPress: () => navigation.navigate("Paywall") },
          ]
        );
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
          color={isSelected ? "#FFF" : colors.text}
        />
        <Text
          style={[
            styles.categoryLabel,
            { color: isSelected ? "#FFF" : colors.text },
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
          const locked = !isPremium && heat === 5;

          return (
            <TouchableOpacity
              key={heat}
              style={[
                styles.heatButton,
                {
                  backgroundColor: isSelected ? colors.primary : colors.card,
                  borderColor: isSelected ? colors.primary : colors.border,
                  opacity: locked ? 0.55 : 1,
                },
              ]}
              onPress={() => {
                if (locked) {
                  Alert.alert(
                    "Premium Feature",
                    "Heat level 5 is available with Premium.",
                    [
                      { text: "Maybe Later", style: "cancel" },
                      {
                        text: "Upgrade",
                        onPress: () => navigation.navigate("Paywall"),
                      },
                    ]
                  );
                  return;
                }
                setSelectedHeat(heat);
                Haptics.selectionAsync();
              }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text
                  style={[
                    styles.heatButtonText,
                    { color: isSelected ? "#FFF" : colors.text },
                  ]}
                >
                  {heat}
                </Text>
                {locked ? (
                  <MaterialCommunityIcons
                    name="lock"
                    size={14}
                    color={isSelected ? "#FFF" : colors.textSecondary}
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
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        onPress={() => handlePromptSelect(safeItem)}
        activeOpacity={0.8}
      >
        <View style={styles.promptCardHeader}>
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: `${colors.primary}20` },
            ]}
          >
            <Text style={[styles.categoryBadgeText, { color: colors.primary }]}>
              {(safeItem.category || "general").toString()}
            </Text>
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
            {Array.from({ length: safeItem.heat || 1 }).map((_, i) => (
              <MaterialCommunityIcons
                key={`${safeItem.id}_fire_${i}`}
                name="fire"
                size={14}
                color={colors.primary}
              />
            ))}
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
            No prompts found
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

        {/* Category Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryScrollContent}
        >
          {CATEGORIES.map(renderCategoryChip)}
        </ScrollView>

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
});
