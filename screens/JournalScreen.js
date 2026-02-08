import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Animated,
  Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from 'expo-haptics';
import { useAppContext } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import { journalStorage, myDatesStorage } from "../utils/storage";
import { useEntitlements } from "../context/EntitlementsContext";
import { FREE_LIMITS } from "../utils/featureFlags";
import { TYPOGRAPHY, SPACING, BORDER_RADIUS, GRADIENTS, COLORS, SHADOWS, getGlassStyle } from "../utils/theme";

const { width } = Dimensions.get("window");

// Animated Entry Card
function AnimatedEntryCard({ item, index, isLocked, onPress, theme, isDark }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  if (isLocked) {
    return (
      <Animated.View
        style={[
          styles.entryWrapper,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
          <BlurView
            intensity={isDark ? 25 : 45}
            tint={isDark ? "dark" : "light"}
            style={styles.lockedCard}
          >
            <LinearGradient
              colors={[theme.blushRose + "15", theme.blushRose + "05"]}
              style={StyleSheet.absoluteFill}
            />
            <MaterialCommunityIcons name="lock-outline" size={32} color={theme.blushRose} />
            <Text style={[styles.lockedText, { color: theme.blushRose }]}>
              Unlock with Premium
            </Text>
          </BlurView>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.entryWrapper,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        onPress={() => {
          Haptics.selectionAsync();
          onPress(item);
        }}
        activeOpacity={0.9}
      >
        <BlurView
          intensity={isDark ? 30 : 55}
          tint={isDark ? "dark" : "light"}
          style={styles.entryCard}
        >
          <LinearGradient
            colors={
              isDark
                ? ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.01)"]
                : ["rgba(255,255,255,0.85)", "rgba(255,255,255,0.6)"]
            }
            style={StyleSheet.absoluteFill}
          />

          {/* Date Badge */}
          <View style={[styles.dateBadge, { backgroundColor: theme.blushRose + "20" }]}>
            <Text style={[styles.dateText, { color: theme.blushRose }]}>
              {new Date(item.date || item.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </Text>
          </View>

          {/* Content */}
          <View style={styles.entryContent}>
            <View style={styles.entryTitleRow}>
              <Text style={[styles.entryTitle, { color: theme.text }]} numberOfLines={1}>
                {item.title || "Untitled Entry"}
              </Text>
              {item.isShared && (
                <MaterialCommunityIcons
                  name="account-multiple"
                  size={16}
                  color={theme.blushRose}
                />
              )}
            </View>

            <View style={styles.answerContainer}>
              <View style={[styles.quoteBar, { backgroundColor: theme.blushRose }]} />
              <Text style={[styles.answerText, { color: theme.textSecondary }]} numberOfLines={3}>
                {item.content || item.userAnswer || "No content"}
              </Text>
            </View>

            {item.mood && (
              <View style={styles.moodBadge}>
                <Text style={[styles.moodText, { color: theme.textSecondary }]}>
                  {item.mood}
                </Text>
              </View>
            )}
          </View>

          {/* Actions */}
          <TouchableOpacity 
            style={styles.entryAction} 
            onPress={(e) => {
              e.stopPropagation();
              // Add menu options here
            }}
            activeOpacity={0.9}
          >
            <MaterialCommunityIcons name="dots-horizontal" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </BlurView>
      </TouchableOpacity>
    </Animated.View>
  );
}

// Animated Date Idea Card
function AnimatedDateCard({ item, onPress, theme, isDark, index }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      delay: index * 60,
      useNativeDriver: true,
    }).start();
  }, []);

  const loc = item.locationType || item.location || "either";
  const label = loc === "home" ? "At Home" : loc === "out" ? "Out" : "Either";

  return (
    <Animated.View style={[styles.dateWrapper, { opacity: fadeAnim }]}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        <BlurView
          intensity={isDark ? 30 : 55}
          tint={isDark ? "dark" : "light"}
          style={styles.dateCard}
        >
          <LinearGradient
            colors={
              isDark
                ? ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.01)"]
                : ["rgba(255,255,255,0.85)", "rgba(255,255,255,0.6)"]
            }
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.dateCardContent}>
            <View style={styles.dateCardMain}>
              <Text style={[styles.dateTitle, { color: theme.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={styles.dateMeta}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={12}
                  color={theme.textSecondary}
                />
                <Text style={[styles.dateMetaText, { color: theme.textSecondary }]}>
                  {item.minutes}m
                </Text>
                <View style={[styles.metaDot, { backgroundColor: theme.textSecondary }]} />
                <Text style={[styles.dateMetaText, { color: theme.textSecondary }]}>{label}</Text>
              </View>
            </View>

            <View style={[styles.dateIcon, { backgroundColor: theme.blushRose + "20" }]}>
              <MaterialCommunityIcons name="star" size={18} color={theme.blushRose} />
            </View>
          </View>
        </BlurView>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function JournalScreen({ navigation }) {
  const { state } = useAppContext();
  const { theme: activeTheme, isDark } = useTheme();

  const t = useMemo(() => {
    const base = activeTheme?.colors ? activeTheme.colors : activeTheme;

    const actionGradient =
      activeTheme?.gradients?.action || base?.gradients?.action || GRADIENTS.action;

    return {
      background: base?.background ?? (isDark ? COLORS.warmCharcoal : COLORS.softCream),
      surface: base?.surface ?? (isDark ? COLORS.deepPlum : "#FFFFFF"),
      surfaceSecondary:
        base?.surfaceSecondary ?? (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)"),
      text: base?.text ?? (isDark ? COLORS.softCream : COLORS.charcoal),
      textSecondary:
        base?.textSecondary ?? (isDark ? "rgba(246,242,238,0.70)" : "rgba(51,51,51,0.68)"),
      border: base?.border ?? (isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"),
      blushRose: base?.accent ?? COLORS.blushRose,
      blushRoseLight: COLORS.blushRoseLight,
      mutedGold: COLORS.mutedGold,
      gradients: { action: actionGradient },
    };
  }, [activeTheme, isDark]);

  const [activeTab, setActiveTab] = useState("journal");
  const [entries, setEntries] = useState([]);
  const [myDates, setMyDates] = useState([]);
  const { isPremiumEffective: isPremium, limits } = useEntitlements();
  const [refreshing, setRefreshing] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    const [j, d] = await Promise.all([
      journalStorage.getEntries(),
      myDatesStorage.getMyDates(),
    ]);
    setEntries(Array.isArray(j) ? j : []);
    setMyDates(Array.isArray(d) ? d : []);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const renderJournalEntry = ({ item, index }) => {
    const isLocked = !isPremium && index >= FREE_LIMITS.JOURNAL_ENTRIES_VISIBLE;

    return (
      <AnimatedEntryCard
        item={item}
        index={index}
        isLocked={isLocked}
        onPress={async (entry) => {
          if (isLocked) {
            await Haptics.selectionAsync();
            navigation.navigate("Paywall");
          } else {
            navigation.navigate("JournalEntry", { entry });
          }
        }}
        theme={t}
        isDark={isDark}
      />
    );
  };

  const renderMyDate = ({ item, index }) => (
    <AnimatedDateCard
      item={item}
      index={index}
      onPress={async () => {
        await Haptics.selectionAsync();
        navigation.navigate("DateNightDetail", { date: item });
      }}
      theme={t}
      isDark={isDark}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      {/* Background Gradient */}
      <LinearGradient
        colors={
          isDark
            ? [COLORS.warmCharcoal, COLORS.deepPlum + "40", COLORS.warmCharcoal]
            : [COLORS.softCream, COLORS.blushRose + "15", COLORS.softCream]
        }
        style={StyleSheet.absoluteFill}
        locations={[0, 0.5, 1]}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <BlurView
            intensity={isDark ? 30 : 50}
            tint={isDark ? "dark" : "light"}
            style={styles.tabBar}
          >
            <LinearGradient
              colors={
                isDark
                  ? ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.02)"]
                  : ["rgba(255,255,255,0.85)", "rgba(255,255,255,0.6)"]
              }
              style={StyleSheet.absoluteFill}
            />

            <TouchableOpacity
              style={[styles.tab, activeTab === "journal" && styles.tabActive]}
              onPress={async () => {
                await Haptics.selectionAsync();
                setActiveTab("journal");
              }}
              activeOpacity={0.9}
            >
              {activeTab === "journal" && (
                <View style={[styles.tabIndicator, { backgroundColor: t.blushRose }]} />
              )}
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === "journal" ? t.text : t.textSecondary },
                  activeTab === "journal" && styles.tabTextActive,
                ]}
              >
                Journal
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === "dates" && styles.tabActive]}
              onPress={async () => {
                await Haptics.selectionAsync();
                setActiveTab("dates");
              }}
              activeOpacity={0.9}
            >
              {activeTab === "dates" && (
                <View style={[styles.tabIndicator, { backgroundColor: t.blushRose }]} />
              )}
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === "dates" ? t.text : t.textSecondary },
                  activeTab === "dates" && styles.tabTextActive,
                ]}
              >
                My Dates
              </Text>
            </TouchableOpacity>
          </BlurView>
        </View>

        <Animated.FlatList
          data={activeTab === "journal" ? entries : myDates}
          keyExtractor={(item, idx) => String(item?.id ?? idx)}
          renderItem={activeTab === "journal" ? renderJournalEntry : renderMyDate}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: true,
          })}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.blushRose} />
          }
          ListHeaderComponent={() => (
            <View style={styles.listHeader}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={[styles.headerEyebrow, { color: t.mutedGold }]}>
                  YOUR COLLECTION
                </Text>
                <Text style={[styles.headerTitle, { color: t.text }]}>
                  {activeTab === "journal" ? "Memory Vault" : "Date Ideas"}
                </Text>
              </View>

              {/* Add New Entry Button (only on journal tab) */}
              {activeTab === "journal" && (
                <TouchableOpacity 
                  style={styles.addButton} 
                  onPress={() => {
                    Haptics.selectionAsync();
                    navigation.navigate("JournalEntry");
                  }}
                  activeOpacity={0.9}
                >
                  <LinearGradient colors={t.gradients.action} style={styles.addButtonGradient}>
                    <MaterialCommunityIcons name="plus" size={20} color="#FFF" />
                    <Text style={styles.addButtonText}>New Entry</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons
                name={activeTab === "journal" ? "book-open-variant" : "heart-outline"}
                size={64}
                color={t.border}
              />
              <Text style={[styles.emptyTitle, { color: t.text }]}>
                {activeTab === "journal" ? "No entries yet" : "No dates saved"}
              </Text>
              <Text style={[styles.emptySubtext, { color: t.textSecondary }]}>
                {activeTab === "journal"
                  ? "Start journaling your moments"
                  : "Create your first date idea"}
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },

  // Tabs
  tabContainer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },

  tabBar: {
    flexDirection: "row",
    borderRadius: BORDER_RADIUS.full,
    padding: SPACING.xs,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },

  tab: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BORDER_RADIUS.full,
    position: "relative",
  },

  tabActive: {},

  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },

  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },

  tabTextActive: {
    fontWeight: "800",
  },

  // List
  listContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 120,
  },

  listHeader: {
    marginBottom: SPACING.xl,
  },

  // Header
  header: {
    marginBottom: SPACING.lg,
  },

  headerEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    marginBottom: SPACING.sm,
  },

  headerTitle: {
    fontFamily: Platform.select({
      ios: "PlayfairDisplay-Bold",
      android: "PlayfairDisplay_700Bold",
    }),
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.5,
  },

  // Add Button
  addButton: {
    height: 52,
    borderRadius: BORDER_RADIUS.lg,
    overflow: "hidden",
    marginTop: SPACING.md,
  },

  addButtonGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  addButtonText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
  },

  // Entry Cards
  entryWrapper: {
    marginBottom: 16,
  },

  entryCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: "hidden",
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
    }),
  },

  dateBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: 12,
  },

  dateText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  entryContent: {
    marginBottom: SPACING.md,
  },

  entryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: SPACING.sm,
  },

  entryTitle: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 24,
    flex: 1,
  },

  promptText: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 24,
    marginBottom: SPACING.sm,
  },

  answerContainer: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },

  quoteBar: {
    width: 3,
    borderRadius: 1.5,
  },

  answerText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    fontStyle: "italic",
  },

  moodBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.xs,
  },

  moodText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },

  entryAction: {
    position: "absolute",
    top: 18,
    right: 18,
  },

  // Locked Card
  lockedCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: "hidden",
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },

  lockedText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Date Cards
  dateWrapper: {
    marginBottom: 12,
  },

  dateCard: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: "hidden",
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },

  dateCardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dateCardMain: {
    flex: 1,
  },

  dateTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
  },

  dateMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  dateMetaText: {
    fontSize: 12,
  },

  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },

  dateIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: 80,
    paddingHorizontal: 40,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 8,
  },

  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
  },
});
