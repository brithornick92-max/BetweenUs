import { SPACING, withAlpha } from "../utils/theme";
/**
 * PromptsScreen.js -- High-end card-draw experience
 * True Red (#D2121A) & Clean Native Apple Backgrounds.
 * FIXED: "Sleeping Neon" unselected pill states.
 * UPDATED: Premium Editorial Boundary Hint Pill.
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
  ImpactFeedbackStyle,
} from "../utils/haptics";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { FadeIn, FadeInDown, useSharedValue, useAnimatedStyle, withSequence, withTiming, interpolate } from "react-native-reanimated";
import { PremiumFeature } from '../utils/featureFlags';
import { useTheme } from "../context/ThemeContext";
import { useEntitlements } from "../context/EntitlementsContext";
import { useAuth } from "../context/AuthContext";
import * as PreferenceEngine from "../services/PreferenceEngine";
import { CONTENT_TYPES, buildPremiumPromptLibrary, buildWeeklySet } from "../services/WeeklyContentSetService";
import PromptCardDeck from "../components/PromptCardDeck";
import { SoftBoundaries } from "../services/PolishEngine";
import { DataLayer } from "../services/localfirst";
import { FALLBACK_PROMPT } from "../utils/contentLoader";
import { getRecentlyCompletedPromptIds } from "../utils/promptHistory";
import { STORAGE_KEYS, promptStorage, savedPromptStorage, storage } from "../utils/storage";
import { LinearGradient } from 'expo-linear-gradient';
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SCREEN_W = SCREEN_WIDTH;
const PROMPT_DECK_FRAME_H = Math.min(SCREEN_HEIGHT * 0.62, 536);
const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

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
    subtitle: 'Just for the two of you.',
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
  if (heat == null || heat === '') return fallback;
  const numeric = Number(heat);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(5, Math.max(1, Math.floor(numeric)));
};

const resolveExplicitMaxHeat = (profile) => {
  const boundaries = profile?.boundaries || {};
  const caps = [5];

  const chosenHeat = normalizeHeatLevel(
    profile?.heatLevelPreference ?? profile?.heatLevel,
    null
  );
  if (chosenHeat != null) {
    caps.push(chosenHeat);
  }

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

function interleavePromptsByHeat(items) {
  const buckets = new Map();
  const heatOrder = [1, 2, 3, 4, 5];

  heatOrder.forEach((heat) => buckets.set(heat, []));
  items.forEach((item) => {
    const heat = normalizeHeatLevel(item?.heat, 1);
    if (!buckets.has(heat)) buckets.set(heat, []);
    buckets.get(heat).push(item);
  });

  const interleaved = [];
  let added = true;
  while (added) {
    added = false;
    for (const heat of heatOrder) {
      const bucket = buckets.get(heat);
      if (bucket?.length) {
        interleaved.push(bucket.shift());
        added = true;
      }
    }
  }

  return interleaved;
}

function getCardIdentity(item) {
  return item?.id ?? item?.promptId ?? item?.title ?? item?.text ?? null;
}

function shuffleArray(arr, avoidFirstItem = arr[0]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  if (a.length > 1 && getCardIdentity(a[0]) === getCardIdentity(avoidFirstItem)) {
    const swapIndex = a.findIndex((item) => getCardIdentity(item) !== getCardIdentity(avoidFirstItem));
    if (swapIndex > 0) {
      [a[0], a[swapIndex]] = [a[swapIndex], a[0]];
    }
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

async function getPremiumPromptLibraryStartedAt(userId) {
  const key = `${STORAGE_KEYS.PREMIUM_PROMPT_LIBRARY_STARTED_AT}:${userId || 'anonymous'}`;
  const cached = await storage.get(key, null);
  if (cached) return cached;

  const startedAt = new Date().toISOString();
  await storage.set(key, startedAt);
  return startedAt;
}

async function getLocalPromptAnswerRows() {
  const byDate = await promptStorage.getAll();

  return Object.entries(byDate || {}).flatMap(([dateKey, answersByPrompt]) =>
    Object.values(answersByPrompt || {}).map((answer) => ({
      ...answer,
      dateKey: answer?.dateKey || dateKey,
    }))
  );
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
  const [shuffleNonce, setShuffleNonce] = useState(0);
  const [promptDeckIndex, setPromptDeckIndex] = useState(0);
  const [shuffledDeckPrompts, setShuffledDeckPrompts] = useState(null);
  const [savedLaterPrompts, setSavedLaterPrompts] = useState([]);
  const shuffleAnim = useSharedValue(0);

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
          const [profile, bounds, savedPrompts] = await Promise.all([
            PreferenceEngine.getContentProfile(userProfile || {}),
            SoftBoundaries.getAll(),
            savedPromptStorage.getAll(),
          ]);
          if (!active) return;
          let heat = profile?.heatLevel || userProfile?.heatLevelPreference || 5;
          heat = isPremium ? null : clampHeatSelection(profile, heat);
          setContentProfile(profile);
          setRawBoundaries(bounds);
          setSelectedHeat(heat);
          setSelectedTone(profile?.tone || 'warm');
          setSavedLaterPrompts(savedPrompts);
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
    }, [isPremium, userProfile])
  );

  const toneCopy = TONE_PROMPT_COPY[selectedTone] || TONE_PROMPT_COPY.warm;
  const loadPrompts = useCallback(async () => {
    setLoading(true);
    try {
      const allPrompts = ALL_BUNDLED.map(normalizePrompt);
      const [dataLayerPromptAnswers, localPromptAnswers] = await Promise.all([
        DataLayer.getPromptAnswers?.({ limit: 1000 }).catch(() => []),
        getLocalPromptAnswerRows().catch(() => []),
      ]);
      const recentPromptAnswers = [
        ...(dataLayerPromptAnswers || []),
        ...(localPromptAnswers || []),
      ];
      const recentlyCompletedPromptIds = getRecentlyCompletedPromptIds(recentPromptAnswers);

      // Apply user boundaries (heat limits, hidden categories, paused items)
      const boundaryFiltered = contentProfile 
        ? allPrompts.filter(p => {
            const heat = p.heat || 1;
            if (recentlyCompletedPromptIds.has(p.id)) return false;
            if (heat > resolveExplicitMaxHeat(contentProfile)) return false;
            if (contentProfile.boundaries?.hiddenCategories?.includes(p.category)) return false;
            if (contentProfile.boundaries?.pausedEntries?.includes(p.id)) return false;
            return true;
          })
        : applyRawBoundaryFilter(allPrompts, rawBoundaries)
          .filter((prompt) => !recentlyCompletedPromptIds.has(prompt?.id));

      // Build personalized weekly set (handles both free rotating and premium growing library)
      const weeklySet = buildWeeklySet(boundaryFiltered, {
        contentType: CONTENT_TYPES.PROMPTS,
        userId: user?.uid || user?.id || 'anonymous',
        isPremium,
        userSettings: contentProfile || userProfile || {},
        userCreatedAt: userProfile?.created_at || userProfile?.createdAt || user?.metadata?.creationTime,
        date: new Date(),
      });

      setWeeklyPromptSet(weeklySet);

      const promptPool = isPremium
        ? buildPremiumPromptLibrary(boundaryFiltered, {
            userId: user?.uid || user?.id || 'anonymous',
            userSettings: contentProfile
              ? { ...contentProfile, maxHeat: resolveExplicitMaxHeat(contentProfile) }
              : userProfile || {},
            userCreatedAt: await getPremiumPromptLibraryStartedAt(user?.uid || user?.id || userProfile?.id),
            date: new Date(),
          })
        : boundaryFiltered;

      setPrompts(promptPool);
    } catch {
      setPrompts([]);
      setWeeklyPromptSet(null);
    } finally {
      setLoading(false);
    }
  }, [contentProfile, isPremium, user?.id, user?.metadata?.creationTime, user?.uid, userProfile, rawBoundaries]);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  useFocusEffect(
    useCallback(() => {
      loadPrompts();
    }, [loadPrompts])
  );

  const freeWeeklyPromptDeck = useMemo(() => {
    const weeklyItems = weeklyPromptSet?.items || [];
    if (isPremium || !weeklyItems.length) return null;

    // Free users see ONLY their weekly rotating set (not cumulative)
    return weeklyItems.map((item) => normalizePrompt({
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

  const baseDeckPrompts = useMemo(() => {
    let finalDeck = [];
    
    if (!isPremium && freeWeeklyPromptDeck?.length) {
      // Free users: Use ONLY the rotating weekly set
      finalDeck = [...freeWeeklyPromptDeck];
    } else if (isPremium) {
      // Premium users draw from the full balanced 1-5 starter pool.
      const basePrompts = contentProfile ? prompts : applyRawBoundaryFilter(prompts, rawBoundaries);
      const allPrompts = basePrompts.map(normalizePrompt);

      if (!contentProfile) {
        finalDeck = interleavePromptsByHeat(allPrompts);
      } else {
        // Personalize: preferred content first, then rest shuffled
        const personalized = PreferenceEngine.filterPrompts(allPrompts, {
          ...contentProfile,
          maxHeat: resolveExplicitMaxHeat(contentProfile),
        });

        const personalizedIds = new Set(personalized.map((prompt) => String(prompt?.id)));
        const remaining = allPrompts.filter((prompt) => !personalizedIds.has(String(prompt?.id)));

        finalDeck = interleavePromptsByHeat([...personalized, ...remaining]);
      }
    }

    return finalDeck;
  }, [prompts, contentProfile, rawBoundaries, isPremium, freeWeeklyPromptDeck]);

  useEffect(() => {
    setShuffledDeckPrompts(null);
    setPromptDeckIndex(0);
  }, [baseDeckPrompts]);

  const deckPrompts = shuffledDeckPrompts || baseDeckPrompts;
  const freeDeckPromptIds = useMemo(
    () => new Set(deckPrompts.map((prompt) => String(prompt?.id || prompt?.promptId || ''))),
    [deckPrompts]
  );

  const deckCountLabel = useMemo(() => {
    return 'Spark a Conversation';
  }, []);

  const freeDeckDone = !isPremium && deckPrompts.length > 0 && promptDeckIndex >= deckPrompts.length;

  const handlePromptReveal = useCallback(() => {
    // Revealing/browsing a card is free. The free prompt quota is consumed only
    // when the user saves their first answer for that prompt.
  }, []);

  const handlePromptSelect = useCallback((prompt) => {
    if (prompt?.isLockedPreview || prompt?.requiresPremium) {
      impact(ImpactFeedbackStyle.Medium);
      showPaywall?.(PremiumFeature.UNLIMITED_PROMPTS);
      return;
    }

    const promptKey = String(prompt?.id || prompt?.promptId || '');
    if (!isPremium && (!promptKey || !freeDeckPromptIds.has(promptKey))) {
      impact(ImpactFeedbackStyle.Medium);
      showPaywall?.(PremiumFeature.UNLIMITED_PROMPTS);
      return;
    }

    navigation.navigate("PromptAnswer", {
      prompt: { ...prompt, dateKey: new Date().toISOString().split("T")[0] },
    });
  }, [freeDeckPromptIds, isPremium, navigation, showPaywall]);

  const handleSavePromptForLater = useCallback(async (prompt) => {
    if (prompt?.isLockedPreview || prompt?.requiresPremium) {
      impact(ImpactFeedbackStyle.Medium);
      showPaywall?.(PremiumFeature.UNLIMITED_PROMPTS);
      return;
    }

    try {
      await savedPromptStorage.save(prompt);
      setSavedLaterPrompts(await savedPromptStorage.getAll());
      impact(ImpactFeedbackStyle.Light);
      Alert.alert("Saved for later", "You'll be able to come back to this prompt.");
    } catch {
      Alert.alert("Couldn't save this prompt", "Please try again.");
    }
  }, [showPaywall]);

  const handleDeleteSavedPrompt = useCallback((prompt) => {
    const promptId = prompt?.promptId || prompt?.id;
    if (!promptId) return;

    Alert.alert(
      "Remove saved prompt?",
      "This will remove it from Saved for later.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await savedPromptStorage.remove(promptId);
            setSavedLaterPrompts(await savedPromptStorage.getAll());
            impact(ImpactFeedbackStyle.Light);
          },
        },
      ]
    );
  }, []);

  const refreshBoundaryProfile = useCallback(async () => {
    const [profile, bounds] = await Promise.all([
      PreferenceEngine.getContentProfile(userProfile || {}),
      SoftBoundaries.getAll(),
    ]);
    setContentProfile(profile);
    setRawBoundaries(bounds);
    setShuffledDeckPrompts(null);
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

  const handleShuffle = useCallback(() => {
    if (freeDeckDone) return;

    setShuffleNonce((value) => value + 1);

    // 1. Visual shake animation
    shuffleAnim.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(-1, { duration: 120 }),
      withTiming(1, { duration: 120 }),
      withTiming(0, { duration: 120 })
    );

    // 2. Soft haptic taps simulating cards shuffling
    impact(ImpactFeedbackStyle.Medium);
    setTimeout(() => impact(ImpactFeedbackStyle.Light), 50);
    setTimeout(() => impact(ImpactFeedbackStyle.Light), 100);
    setTimeout(() => impact(ImpactFeedbackStyle.Medium), 150);

    // 3. Swap the deck as the card stack settles
    setTimeout(() => {
      setShuffledDeckPrompts(shuffleArray(baseDeckPrompts, deckPrompts[promptDeckIndex]));
      setPromptDeckIndex(0);
    }, 420);
  }, [baseDeckPrompts, deckPrompts, freeDeckDone, promptDeckIndex, shuffleAnim]);

  const deckStyle = useAnimatedStyle(() => {
    const shuffleX = interpolate(shuffleAnim.value, [-1, 0, 1], [-15, 0, 15]);
    const shuffleRotate = interpolate(shuffleAnim.value, [-1, 0, 1], [-4, 0, 4]);
    return { transform: [{ translateX: shuffleX }, { rotate: shuffleRotate + 'deg' }] };
  });

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
        <GlowOrb color={t.primary} size={460} top={-180} left={SCREEN_W - 220} opacity={isDark ? 0.12 : 0.06} />
        <GlowOrb color={t.accent || '#D4AA7E'} size={260} top={620} left={-80} opacity={isDark ? 0.075 : 0.04} />
        <FilmGrain opacity={0.065} />

        <SafeAreaView style={styles.safe} edges={["top"]}>
          {/* Editorial Header */}
          <Animated.View entering={FadeInDown.duration(800).delay(200)} style={styles.header}>
            <Text style={[styles.headerLabel, { color: t.primary }]}>
              {deckCountLabel}
            </Text>
            <Text style={[styles.headerTitle, { color: t.text }]}>Draw a card</Text>
          </Animated.View>

          {/* Shuffle Button */}
          <Animated.View entering={FadeIn.duration(800).delay(500)} style={styles.shuffleSection}>
            <TouchableOpacity
              style={[styles.shuffleButton, { 
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                borderColor: t.border,
                opacity: freeDeckDone ? 0.45 : 1,
              }]}
              onPress={handleShuffle}
              disabled={freeDeckDone}
              activeOpacity={0.7}
            >
              <Icon name="shuffle-outline" size={16} color={t.primary} />
              <Text style={[styles.shuffleText, { color: t.text }]}>Shuffle Deck</Text>
            </TouchableOpacity>
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
          ) : freeDeckDone ? (
            <View style={styles.centered}>
              <Icon name="checkmark-circle-outline" size={48} color={withAlpha(t.text, 0.16)} />
              <Text style={[styles.emptyText, { color: t.subtext }]}>This week's draw is complete.</Text>
            </View>
          ) : (
            <Animated.ScrollView
              style={[styles.deckWrapper, deckStyle]}
              contentContainerStyle={[styles.deckScrollContent, { paddingBottom: tabBarHeight + 24 }]}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.promptDeckFrame}>
                <PromptCardDeck
                  prompts={deckPrompts}
                  onSelect={handlePromptSelect}
                  onSkip={() => impact(ImpactFeedbackStyle.Light)}
                  onLongPress={handlePromptBoundaryAction}
                  onReveal={handlePromptReveal}
                  onIndexChange={setPromptDeckIndex}
                  onSaveForLater={handleSavePromptForLater}
                  shuffleNonce={shuffleNonce}
                  allowLoop={isPremium}
                />
              </View>
              
              {/* Refined Velvet Glass / Editorial Boundary Hint Pill */}
              <Animated.View 
                entering={FadeInDown.duration(600).delay(200)}
                style={[
                  styles.boundaryHintRow, 
                  { 
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    borderColor: t.border
                  }
                ]}
              >
                <Icon name="eye-off-outline" size={14} color={t.subtext} />
                <Text style={[styles.boundaryHintText, { color: t.subtext }]}>
                  Long-press to hide
                </Text>
              </Animated.View>

              {savedLaterPrompts.length ? (
                <View style={styles.savedLaterSection}>
                  <Text style={[styles.savedLaterLabel, { color: t.subtext }]}>Saved for later</Text>
                  <View style={styles.savedLaterList}>
                    {savedLaterPrompts.slice(0, 8).map((prompt) => (
                      <TouchableOpacity
                        key={prompt.promptId || prompt.id}
                        style={[
                          styles.savedLaterChip,
                          {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.035)',
                            borderColor: t.border,
                          },
                        ]}
                        onPress={() => handlePromptSelect(prompt)}
                        activeOpacity={0.75}
                      >
                        <Icon name="bookmark-outline" size={13} color={t.primary} />
                        <Text style={[styles.savedLaterText, { color: t.text }]} numberOfLines={2}>
                          {prompt.text || 'Saved prompt'}
                        </Text>
                        <TouchableOpacity
                          style={[styles.savedLaterDeleteButton, { borderColor: t.border }]}
                          onPress={() => handleDeleteSavedPrompt(prompt)}
                          activeOpacity={0.75}
                          accessibilityRole="button"
                          accessibilityLabel="Remove saved prompt"
                        >
                          <Icon name="trash-outline" size={15} color={t.subtext} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null}
            </Animated.ScrollView>
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
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    letterSpacing: 0,
    marginTop: 6,
    maxWidth: 300,
  },
  shuffleSection: {
    paddingHorizontal: 32,
    marginTop: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  shuffleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transform: [{ translateY: 16 }],
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  shuffleText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  deckWrapper: {
    flex: 1,
  },
  deckScrollContent: {
    flexGrow: 1,
  },
  promptDeckFrame: {
    height: PROMPT_DECK_FRAME_H,
  },
  boundaryHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 8,
    marginTop: -8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100, // Velvet Glass Pill Shape
    borderWidth: 1,
    // Apple Editorial shadow profiling
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  boundaryHintText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  savedLaterSection: {
    marginTop: 16,
  },
  savedLaterLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    paddingHorizontal: SPACING.xl,
    marginBottom: 10,
  },
  savedLaterList: {
    gap: 10,
    paddingHorizontal: SPACING.xl,
  },
  savedLaterChip: {
    width: '100%',
    minHeight: 64,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  savedLaterText: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  savedLaterDeleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
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
