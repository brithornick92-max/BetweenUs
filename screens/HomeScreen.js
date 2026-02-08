// File: screens/HomeScreen.js

import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Platform,
  TouchableOpacity,
  Animated,
  Dimensions,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";

import { useAppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useEntitlements } from "../context/EntitlementsContext";
import { useContent } from "../context/ContentContext";
import { useMemoryContext } from "../context/MemoryContext";
import { useRitualContext } from "../context/RitualContext";
import { useTheme } from "../context/ThemeContext";
import { promptStorage } from "../utils/storage";
import { TYPOGRAPHY, SPACING, BORDER_RADIUS, COLORS } from "../utils/theme";
import { VIBE_COLORS } from "../components/VibeSignal";

const { width } = Dimensions.get("window");

// ✅ True local YYYY-MM-DD (prevents UTC date flip issues)
function dayKeyLocal(date = new Date()) {
  const d = date instanceof Date ? date : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ✅ Always-safe prompt
const FALLBACK_PROMPT = {
  id: "fallback_prompt",
  text: "Choose your heat level to get started...",
  category: "romance",
  heat: 1,
};

function normalizePrompt(p) {
  if (!p || typeof p !== "object") return FALLBACK_PROMPT;

  const id = p.id ? String(p.id) : FALLBACK_PROMPT.id;
  const text = typeof p.text === "string" ? p.text : "";
  const safeText = text.trim() ? text : FALLBACK_PROMPT.text;

  return {
    ...p,
    id,
    text: safeText,
    heat: typeof p.heat === "number" ? p.heat : 1,
    category: typeof p.category === "string" ? p.category : "romance",
  };
}

// Animated Status Indicator
function StatusIndicator({
  active,
  label,
  delay = 0,
  onPress,
  textColor,
  dotColor,
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [delay, fadeAnim, scaleAnim]);

  const handlePress = async () => {
    if (onPress) {
      await Haptics.selectionAsync();
      onPress();
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={onPress ? 0.8 : 1}
      disabled={!onPress}
    >
      <Animated.View
        style={[
          styles.statusPill,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
          onPress && styles.interactiveStatusPill,
        ]}
      >
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor:
                dotColor || (active ? COLORS.success : COLORS.error),
            },
          ]}
        />
        <Text style={[styles.statusLabel, { color: textColor }]}>{label}</Text>
        {onPress && (
          <MaterialCommunityIcons
            name="chevron-right"
            size={14}
            color={COLORS.charcoal}
            style={styles.statusChevron}
          />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }) {
  const { state } = useAppContext();
  const { user } = useAuth();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const { todayPrompt, loadTodayPrompt, loading: contentLoading } = useContent();
  const { theme, isDark } = useTheme();
  const { state: memoryStateRaw } = useMemoryContext();
  const { state: ritualStateRaw } = useRitualContext();

  const memoryState = memoryStateRaw || { memories: [] };
  const ritualState = ritualStateRaw || { streak: 0 };

  const t = useMemo(() => {
    return {
      background: theme.colors.background,
      surface: theme.colors.surface,
      surfaceSecondary: theme.colors.surfaceSecondary,
      text: theme.colors.text,
      textSecondary: theme.colors.textSecondary,
      border: theme.colors.border,
      blushRose: theme.colors.blushRose,
      mutedGold: theme.colors.mutedGold,
      success: theme.colors.success,
      gradients: theme.gradients,
    };
  }, [theme]);

  const todayKey = useMemo(() => dayKeyLocal(new Date()), []);

  // ✅ ALWAYS safe prompt object with .text
  const prompt = useMemo(() => normalizePrompt(todayPrompt), [todayPrompt]);

  // If Firebase hasn’t loaded yet, treat as not-ready
  const promptReady = !!todayPrompt?.id && typeof todayPrompt?.text === "string" && !!todayPrompt.text.trim();

  const [myAnswer, setMyAnswer] = useState("");
  const [partnerAnswer, setPartnerAnswer] = useState("");

  const bothAnswered = !!myAnswer.trim() && !!partnerAnswer.trim();
  const canReveal = !!myAnswer.trim();
  const partnerLabel = state?.partnerLabel || "Partner";

  const getPartnerVibeColor = () => {
    if (!state?.partnerVibe) return COLORS.success;
    const vibeColor = VIBE_COLORS?.[String(state.partnerVibe).toUpperCase()];
    return vibeColor?.primary || COLORS.success;
  };

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerScale = scrollY.interpolate({
    inputRange: [-100, 0, 100],
    outputRange: [1.1, 1, 0.95],
    extrapolate: "clamp",
  });

  const premiumPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isPremium) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(premiumPulse, {
            toValue: 1.05,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(premiumPulse, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isPremium, premiumPulse]);

  // Load today's prompt on mount
  useEffect(() => {
    const initializePrompt = async () => {
      if (user && !todayPrompt && typeof loadTodayPrompt === "function") {
        try {
          await loadTodayPrompt(1);
        } catch (error) {
          console.error("Error loading initial prompt:", error);
        }
      }
    };

    initializePrompt();
  }, [user, todayPrompt, loadTodayPrompt]);

  // Load local answers for today
  useEffect(() => {
    (async () => {
      if (!promptReady) return;

      try {
        const [mine, theirs] = await Promise.all([
          promptStorage.getAnswer(todayKey, prompt.id),
          promptStorage.getAnswer(todayKey, `partner_${prompt.id}`),
        ]);

        setMyAnswer(mine?.answer || "");
        setPartnerAnswer(theirs?.answer || "");
      } catch (error) {
        console.error("Error loading answers:", error);
      }
    })();
  }, [todayKey, prompt.id, promptReady]);

  const handleOpenAnswer = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (!promptReady) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert("Prompt Not Available", "Please wait for today's prompt to load.");
      return;
    }

    navigation.navigate("PromptAnswer", {
      prompt: { ...prompt, dateKey: todayKey }, // ✅ safe prompt always has .text
    });
  };

  const openReveal = async () => {
    if (!myAnswer.trim()) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return Alert.alert("Answer First", "Share your thoughts first, then you can reveal.");
    }

    if (!promptReady) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return Alert.alert("Prompt Not Available", "Please wait for today's prompt to load.");
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    navigation.navigate("Reveal", {
      prompt: { id: prompt.id, text: prompt.text, dateKey: todayKey },
      userAnswer: { answer: myAnswer },
      partnerAnswer: partnerAnswer || null,
      bothAnswered,
    });
  };

  const handlePremiumFeature = async (featureName, navigationTarget, params = {}) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isPremium) {
      navigation.navigate(navigationTarget, params);
    } else {
      Alert.alert(
        "Premium Feature",
        `${featureName} is available with Premium. Unlock deeper intimacy and enhanced connection features.`,
        [
          { text: "Maybe Later", style: "cancel" },
          { text: "Upgrade to Premium", onPress: () => navigation.navigate("Paywall") },
        ]
      );
    }
  };

  const renderPremiumBadge = () => {
    if (!isPremium) return null;

    return (
      <Animated.View
        style={[styles.premiumBadge, { transform: [{ scale: premiumPulse }] }]}
      >
        <BlurView intensity={20} style={styles.premiumBadgeBlur}>
          <LinearGradient
            colors={["#D4AF37", "#F7E7CE"]}
            style={styles.premiumBadgeGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <MaterialCommunityIcons name="crown" size={16} color="#0B0B0B" />
            <Text style={styles.premiumBadgeText}>PREMIUM</Text>
          </LinearGradient>
        </BlurView>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      {/* Subtle Atmospheric Background */}
      <LinearGradient
        colors={
          isDark
            ? [COLORS.warmCharcoal, COLORS.deepPlum + "30", COLORS.warmCharcoal]
            : [
                COLORS.softCream,
                COLORS.blushRose + "10",
                COLORS.mutedGold + "05",
                COLORS.softCream,
              ]
        }
        style={StyleSheet.absoluteFill}
        locations={isDark ? [0, 0.5, 1] : [0, 0.3, 0.7, 1]}
      />

      <SafeAreaView style={styles.safeArea}>
        <Animated.ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        >
          {/* Elegant Masthead */}
          <Animated.View
            style={[styles.masthead, { transform: [{ scale: headerScale }] }]}
          >
            <View style={styles.mastheadContent}>
              <View style={styles.brandSection}>
                <Text style={[styles.dateStamp, { color: t.mutedGold }]}>
                  {new Date()
                    .toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })
                    .toUpperCase()}
                </Text>

                <Text style={[styles.mastheadTitle, { color: t.text }]}>
                  Between Us
                </Text>

                <Text style={[styles.mastheadSubtitle, { color: t.blushRose }]}>
                  Your Love Story
                </Text>
              </View>

              <View style={styles.headerActions}>
                {renderPremiumBadge()}

                <TouchableOpacity
                  style={styles.profileButton}
                  activeOpacity={0.9}
                  onPress={() => navigation.navigate("Settings")}
                >
                  <BlurView
                    intensity={isDark ? 30 : 50}
                    tint={isDark ? "dark" : "light"}
                    style={styles.profileBlur}
                  >
                    <LinearGradient
                      colors={[t.blushRose + "20", "transparent"]}
                      style={StyleSheet.absoluteFill}
                    />
                    <Image
                      source={require("../assets/icon.png")}
                      style={styles.profileIcon}
                      resizeMode="cover"
                    />
                  </BlurView>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

          {/* Hero Prompt Section */}
          <View style={styles.heroSection}>
            <BlurView
              intensity={isDark ? 50 : 80}
              tint={isDark ? "dark" : "light"}
              style={styles.heroCard}
            >
              <LinearGradient
                colors={
                  isDark
                    ? ["rgba(255,255,255,0.08)", "rgba(255,255,255,0.03)"]
                    : ["rgba(255,255,255,0.95)", "rgba(255,255,255,0.7)"]
                }
                style={StyleSheet.absoluteFill}
              />

              <View style={[styles.accentBorder, { backgroundColor: t.mutedGold }]} />

              <View style={styles.heroContent}>
                <View style={styles.heroHeader}>
                  <MaterialCommunityIcons name="heart" size={20} color={t.mutedGold} />
                  <Text style={[styles.heroEyebrow, { color: t.mutedGold }]}>
                    TODAY'S CONNECTION
                  </Text>
                </View>

                <Text style={[styles.heroPromptText, { color: t.text }]}>
                  {promptReady ? prompt.text : "Loading today’s prompt..."}
                </Text>

                <Text style={[styles.statusExplainer, { color: t.textSecondary }]}>
                  Partner status
                </Text>

                <View style={styles.statusRow}>
                  <StatusIndicator
                    active={!!partnerAnswer}
                    label={
                      partnerAnswer
                        ? `${partnerLabel} answered`
                        : `Waiting for ${partnerLabel}`
                    }
                    delay={0}
                    textColor={t.text}
                    dotColor={getPartnerVibeColor()}
                    onPress={() => {
                      if (myAnswer.trim() && promptReady) openReveal();
                    }}
                  />
                </View>

                <View style={styles.heroActions}>
                  <TouchableOpacity
                    style={styles.primaryAction}
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      navigation.navigate("HeatLevel");
                    }}
                    activeOpacity={0.9}
                  >
                    <LinearGradient
                      colors={t.gradients.primary}
                      style={styles.primaryActionGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <MaterialCommunityIcons name="fire" size={20} color="#FFF" />
                      <Text style={styles.primaryActionText}>Choose Heat Level</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryAction}
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      navigation.navigate("PromptLibrary");
                    }}
                    activeOpacity={0.9}
                  >
                    <MaterialCommunityIcons name="library" size={20} color={t.blushRose} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.secondaryAction, !promptReady && { opacity: 0.5 }]}
                    onPress={handleOpenAnswer}
                    activeOpacity={0.9}
                    disabled={!promptReady}
                  >
                    <MaterialCommunityIcons
                      name={myAnswer ? "pencil" : "feather"}
                      size={20}
                      color={t.blushRose}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.revealButton,
                      {
                        backgroundColor:
                          canReveal && promptReady ? t.blushRose : t.surfaceSecondary,
                        opacity: promptReady ? 1 : 0.5,
                      },
                    ]}
                    onPress={openReveal}
                    activeOpacity={0.9}
                    disabled={!promptReady}
                  >
                    <MaterialCommunityIcons
                      name={canReveal && promptReady ? "eye-outline" : "lock-outline"}
                      size={24}
                      color={canReveal && promptReady ? "#FFF" : t.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </BlurView>
          </View>

          {/* Insights Row */}
          <View style={styles.insightsSection}>
            <View style={styles.insightsRow}>
              {!!(memoryState.memories?.length) && (
                <View style={styles.insightCard}>
                  <BlurView
                    intensity={isDark ? 40 : 70}
                    tint={isDark ? "dark" : "light"}
                    style={styles.insightBlur}
                  >
                    <LinearGradient
                      colors={
                        isDark
                          ? ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.02)"]
                          : ["rgba(255,255,255,0.9)", "rgba(255,255,255,0.6)"]
                      }
                      style={StyleSheet.absoluteFill}
                    />

                    <View style={styles.insightContent}>
                      <MaterialCommunityIcons
                        name="heart-multiple"
                        size={28}
                        color={t.blushRose}
                      />
                      <Text style={[styles.insightNumber, { color: t.text }]}>
                        {memoryState.memories.length}
                      </Text>
                      <Text style={[styles.insightLabel, { color: t.textSecondary }]}>
                        Memories
                      </Text>

                      <TouchableOpacity
                        style={styles.insightAction}
                        onPress={() =>
                          handlePremiumFeature("Memory Timeline", "MemoryTimeline")
                        }
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons
                          name="arrow-right"
                          size={18}
                          color={t.blushRose}
                        />
                      </TouchableOpacity>
                    </View>
                  </BlurView>
                </View>
              )}

              <View style={styles.insightCard}>
                <BlurView
                  intensity={isDark ? 40 : 70}
                  tint={isDark ? "dark" : "light"}
                  style={styles.insightBlur}
                >
                  <LinearGradient
                    colors={
                      isDark
                        ? ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.02)"]
                        : ["rgba(255,255,255,0.9)", "rgba(255,255,255,0.6)"]
                    }
                    style={StyleSheet.absoluteFill}
                  />

                  <View style={styles.insightContent}>
                    <MaterialCommunityIcons
                      name="moon-waning-crescent"
                      size={28}
                      color={t.mutedGold}
                    />
                    <Text style={[styles.insightNumber, { color: t.text }]}>
                      {ritualState.streak || 0}
                    </Text>
                    <Text style={[styles.insightLabel, { color: t.textSecondary }]}>
                      Night Streak
                    </Text>

                    <TouchableOpacity
                      style={styles.insightAction}
                      onPress={() => navigation.navigate("NightRitual")}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons
                        name="arrow-right"
                        size={18}
                        color={t.mutedGold}
                      />
                    </TouchableOpacity>
                  </View>
                </BlurView>
              </View>
            </View>
          </View>

          {/* Features Grid */}
          <View style={styles.featuresSection}>
            <Text style={[styles.sectionTitle, { color: t.text }]}>
              Explore Together
            </Text>

            <View style={styles.featuresGrid}>
              <TouchableOpacity
                style={styles.featureCard}
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("Journal");
                }}
                activeOpacity={0.9}
              >
                <BlurView
                  intensity={isDark ? 30 : 60}
                  tint={isDark ? "dark" : "light"}
                  style={styles.featureBlur}
                >
                  <LinearGradient
                    colors={
                      isDark
                        ? ["rgba(255,255,255,0.03)", "transparent"]
                        : ["rgba(255,255,255,0.8)", "rgba(255,255,255,0.5)"]
                    }
                    style={StyleSheet.absoluteFill}
                  />
                  <View
                    style={[
                      styles.featureIconContainer,
                      { backgroundColor: t.blushRose + "20" },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="book-open-variant"
                      size={32}
                      color={t.blushRose}
                    />
                  </View>
                  <Text style={[styles.featureLabel, { color: t.text }]}>Journal</Text>
                </BlurView>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.featureCard}
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("Calendar");
                }}
                activeOpacity={0.9}
              >
                <BlurView
                  intensity={isDark ? 30 : 60}
                  tint={isDark ? "dark" : "light"}
                  style={styles.featureBlur}
                >
                  <LinearGradient
                    colors={
                      isDark
                        ? ["rgba(255,255,255,0.03)", "transparent"]
                        : ["rgba(255,255,255,0.8)", "rgba(255,255,255,0.5)"]
                    }
                    style={StyleSheet.absoluteFill}
                  />
                  <View
                    style={[
                      styles.featureIconContainer,
                      { backgroundColor: t.mutedGold + "20" },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="calendar-heart"
                      size={32}
                      color={t.mutedGold}
                    />
                  </View>
                  <Text style={[styles.featureLabel, { color: t.text }]}>Planner</Text>
                </BlurView>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.featureCard}
                onPress={() => handlePremiumFeature("Vibe Signal", "VibeSignal")}
                activeOpacity={0.9}
              >
                <BlurView
                  intensity={isDark ? 30 : 60}
                  tint={isDark ? "dark" : "light"}
                  style={styles.featureBlur}
                >
                  <LinearGradient
                    colors={
                      isDark
                        ? ["rgba(255,255,255,0.03)", "transparent"]
                        : ["rgba(255,255,255,0.8)", "rgba(255,255,255,0.5)"]
                    }
                    style={StyleSheet.absoluteFill}
                  />
                  <View
                    style={[
                      styles.featureIconContainer,
                      { backgroundColor: "#FF6B9D20" },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="heart-pulse"
                      size={32}
                      color="#FF6B9D"
                    />
                  </View>
                  <Text style={[styles.featureLabel, { color: t.text }]}>
                    Vibe Signal
                  </Text>
                  {!isPremium && (
                    <View style={styles.premiumIndicator}>
                      <MaterialCommunityIcons name="crown" size={16} color="#0B0B0B" />
                    </View>
                  )}
                </BlurView>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.featureCard}
                onPress={() =>
                  handlePremiumFeature("Daily Reflection", "EditorialPrompt", {
                    category: "daily_life",
                  })
                }
                activeOpacity={0.9}
              >
                <BlurView
                  intensity={isDark ? 30 : 60}
                  tint={isDark ? "dark" : "light"}
                  style={styles.featureBlur}
                >
                  <LinearGradient
                    colors={
                      isDark
                        ? ["rgba(255,255,255,0.03)", "transparent"]
                        : ["rgba(255,255,255,0.8)", "rgba(255,255,255,0.5)"]
                    }
                    style={StyleSheet.absoluteFill}
                  />
                  <View
                    style={[
                      styles.featureIconContainer,
                      { backgroundColor: "#F4A46120" },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="calendar-heart"
                      size={32}
                      color="#F4A461"
                    />
                  </View>
                  <Text style={[styles.featureLabel, { color: t.text }]}>
                    Daily Reflection
                  </Text>
                  {!isPremium && (
                    <View style={styles.premiumIndicator}>
                      <MaterialCommunityIcons name="crown" size={16} color="#0B0B0B" />
                    </View>
                  )}
                </BlurView>
              </TouchableOpacity>
            </View>
          </View>

          {/* Dev Tool - Hidden (DEV only) */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.devTool}
              onLongPress={async () => {
                if (!promptReady) return;

                await promptStorage.setAnswer(todayKey, `partner_${prompt.id}`, {
                  answer: "This is a simulated answer for your connection.",
                  timestamp: Date.now(),
                  isRevealed: false,
                });

                setPartnerAnswer("This is a simulated answer for your connection.");
                Alert.alert("Sync Successful", "Partner answer simulated.");
              }}
              activeOpacity={0.9}
            >
              <Text style={[styles.devText, { color: t.textSecondary }]}>
                Hold to sync {partnerLabel}'s local state
              </Text>
            </TouchableOpacity>
          )}

          {/* Adaptive Home Access */}
          {isPremium && (
            <TouchableOpacity
              style={styles.adaptiveHomeButton}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate("AdaptiveHome");
              }}
              activeOpacity={0.9}
            >
              <BlurView
                intensity={isDark ? 40 : 70}
                tint={isDark ? "dark" : "light"}
                style={styles.adaptiveHomeBlur}
              >
                <LinearGradient
                  colors={["#D4AF37", "#F7E7CE"]}
                  style={styles.adaptiveHomeGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <MaterialCommunityIcons
                    name="sparkles"
                    size={20}
                    color="#0B0B0B"
                  />
                  <Text style={styles.adaptiveHomeText}>Try Smart Home</Text>
                </LinearGradient>
              </BlurView>
            </TouchableOpacity>
          )}
        </Animated.ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { paddingBottom: 120 },

  masthead: {
    paddingHorizontal: SPACING.xl,
    paddingTop: 30,
    paddingBottom: 40,
  },
  mastheadContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  brandSection: { flex: 1 },
  dateStamp: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 12,
    opacity: 0.8,
  },
  mastheadTitle: {
    fontFamily: Platform.select({
      ios: "PlayfairDisplay-Bold",
      android: "PlayfairDisplay_700Bold",
    }),
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  mastheadSubtitle: {
    fontSize: 14,
    letterSpacing: 1,
    fontWeight: "500",
    opacity: 0.9,
  },
  headerActions: { alignItems: "flex-end", gap: SPACING.md },

  premiumBadge: { borderRadius: BORDER_RADIUS.full, overflow: "hidden" },
  premiumBadgeBlur: { borderRadius: BORDER_RADIUS.full, overflow: "hidden" },
  premiumBadgeGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    gap: 4,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: "#0B0B0B",
  },

  profileButton: { width: 56, height: 56 },
  profileBlur: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  profileIcon: { width: 40, height: 40, borderRadius: 20 },

  heroSection: { paddingHorizontal: SPACING.xl, marginBottom: 50 },
  heroCard: {
    borderRadius: BORDER_RADIUS.xxl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.15,
        shadowRadius: 32,
      },
      android: { elevation: 10 },
    }),
  },
  accentBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  heroContent: { padding: 32 },
  heroHeader: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
    marginLeft: 10,
  },
  heroPromptText: {
    fontFamily: Platform.select({
      ios: "PlayfairDisplay-Bold",
      android: "PlayfairDisplay_700Bold",
    }),
    fontSize: 28,
    lineHeight: 40,
    marginBottom: 28,
  },

  statusExplainer: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.3,
    marginBottom: 16,
    marginTop: 8,
    textAlign: "center",
    opacity: 0.8,
    paddingHorizontal: 16,
  },
  statusRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.05)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  interactiveStatusPill: {
    backgroundColor: "rgba(0,0,0,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  statusLabel: { fontSize: 11, fontWeight: "600" },
  statusChevron: { marginLeft: 6, opacity: 0.6 },

  heroActions: { flexDirection: "row", gap: 16 },
  primaryAction: {
    flex: 1,
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    overflow: "hidden",
  },
  primaryActionGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  primaryActionText: { fontSize: 14, fontWeight: "600", color: "#FFF" },

  secondaryAction: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },

  revealButton: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },

  insightsSection: { paddingHorizontal: SPACING.xl, marginBottom: 50 },
  insightsRow: { flexDirection: "row", gap: SPACING.lg },
  insightCard: { flex: 1 },
  insightBlur: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
    }),
  },
  insightContent: { padding: 24, alignItems: "center" },
  insightNumber: {
    ...TYPOGRAPHY.display,
    fontSize: 32,
    fontWeight: "700",
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  insightLabel: { ...TYPOGRAPHY.body, fontSize: 14, marginBottom: SPACING.md },
  insightAction: { padding: SPACING.xs },

  featuresSection: { paddingHorizontal: SPACING.xl, marginBottom: 60 },
  sectionTitle: {
    ...TYPOGRAPHY.h2,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 24,
    textAlign: "center",
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.lg,
    justifyContent: "space-between",
  },
  featureCard: {
    width: (width - SPACING.xl * 2 - SPACING.lg) / 2,
    aspectRatio: 1,
  },
  featureBlur: {
    flex: 1,
    borderRadius: BORDER_RADIUS.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
    }),
  },
  featureIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
  },
  featureLabel: { ...TYPOGRAPHY.h3, fontSize: 16, fontWeight: "600" },

  premiumIndicator: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#D4AF37",
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },

  devTool: { alignItems: "center", padding: 40, marginTop: 20 },
  devText: { fontSize: 11, opacity: 0.3, fontStyle: "italic" },

  adaptiveHomeButton: {
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    overflow: "hidden",
  },
  adaptiveHomeBlur: { borderRadius: BORDER_RADIUS.lg, overflow: "hidden" },
  adaptiveHomeGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  adaptiveHomeText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0B0B0B",
    letterSpacing: 0.5,
  },
});
