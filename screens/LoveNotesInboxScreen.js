// screens/LoveNotesInboxScreen.js — Inbox for sent & received love notes (E2EE)
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Platform,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, FadeInUp, SlideInRight } from "react-native-reanimated";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useEntitlements } from "../context/EntitlementsContext";
import DataLayer from "../services/data/DataLayer";
import {
  SPACING,
  BORDER_RADIUS,
  TYPOGRAPHY,
  SERIF,
  SERIF_ACCENT,
  SANS,
  SANS_MEDIUM,
  SANS_BOLD,
  withAlpha,
} from "../utils/theme";

const { width: SCREEN_W } = Dimensions.get("window");

const STATIONERY_COLORS = {
  love:    ["#9A2E5E", "#7A1E4E"],
  fun:     ["#F5A623", "#F7D046"],
  sexy:    ["#C0392B", "#8E2323"],
  spicy:   ["#D35400", "#A83210"],
  sweet:   ["#D4856A", "#A85A4A"],
  flirty:  ["#8E44AD", "#6C3483"],
  classic: ["#5D6D7E", "#2C3E50"],
  dreamy:  ["#3A4A7A", "#1E2E5E"],
  heart:   ["#A8516E", "#8B3A5C"],
  sparkle: ["#6E4B7A", "#4A2E5E"],
  rose:    ["#B8606A", "#9A3E4E"],
  sunset:  ["#D4856A", "#A85A4A"],
  night:   ["#3A4A7A", "#1E2E5E"],
};

function relativeTime(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function LoveNotesInboxScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all"); // all | received | sent

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  // Premium gate
  useEffect(() => {
    if (!isPremium) {
      showPaywall?.("loveNotes");
      navigation.goBack();
    }
  }, [isPremium]);

  const loadNotes = useCallback(async () => {
    try {
      const all = await DataLayer.getLoveNotes({ limit: 200 });
      setNotes(all || []);
    } catch (err) {
      console.warn("[LoveNotesInbox] Load failed:", err?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Reload notes when screen regains focus (e.g. after sending a new note)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadNotes();
    });
    return unsubscribe;
  }, [navigation, loadNotes]);

  // Mark received notes as read when viewing inbox
  useEffect(() => {
    if (notes.length > 0) {
      const unread = notes.filter((n) => !n.isOwn && !n.isRead);
      unread.forEach((n) => DataLayer.markLoveNoteRead(n.id).catch(() => {}));
    }
  }, [notes]);

  const onRefresh = useCallback(async () => {
    Haptics.selectionAsync();
    setRefreshing(true);
    await loadNotes();
    setRefreshing(false);
  }, [loadNotes]);

  const filteredNotes = useMemo(() => {
    if (filter === "received") return notes.filter((n) => !n.isOwn);
    if (filter === "sent") return notes.filter((n) => n.isOwn);
    return notes;
  }, [notes, filter]);

  const unreadCount = useMemo(
    () => notes.filter((n) => !n.isOwn && !n.isRead).length,
    [notes]
  );

  const handleOpenNote = useCallback(
    async (noteId) => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate("LoveNoteDetail", { noteId });
    },
    [navigation]
  );

  const handleCompose = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("ComposeLoveNote");
  }, [navigation]);

  // ── Empty State ──
  const renderEmpty = () => (
    <Animated.View entering={FadeIn.duration(600)} style={styles.emptyContainer}>
      <MaterialCommunityIcons
        name="email-heart-outline"
        size={72}
        color={withAlpha(colors.primary, 0.3)}
      />
      <Text style={styles.emptyTitle}>No notes yet</Text>
      <Text style={styles.emptySubtitle}>
        Send your first love note — they're encrypted{"\n"}so only you two can read them.
      </Text>
      <TouchableOpacity style={styles.emptyButton} onPress={handleCompose} activeOpacity={0.85}>
        <MaterialCommunityIcons name="pen" size={18} color="#FFF" />
        <Text style={styles.emptyButtonText}>Write a Love Note</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  // ── Note Card ──
  const renderNote = ({ item, index }) => {
    const gradient = STATIONERY_COLORS[item.stationeryId] || STATIONERY_COLORS.love;
    const isUnread = !item.isOwn && !item.isRead;
    const previewText = item.locked
      ? "🔒 Encrypted — tap to unlock"
      : item.text
        ? item.text.length > 100
          ? item.text.slice(0, 100) + "…"
          : item.text
        : "Love note 💌";

    return (
      <Animated.View entering={FadeInDown.delay(index * 60).springify().damping(18)}>
        <TouchableOpacity
          style={[styles.noteCard, isUnread && styles.noteCardUnread]}
          onPress={() => handleOpenNote(item.id)}
          activeOpacity={0.8}
        >
          {/* Stationery / Image Thumbnail */}
          <View style={styles.noteThumbnailWrap}>
            {item.imageUri ? (
              <Image source={{ uri: item.imageUri }} style={styles.noteThumbnail} />
            ) : (
              <LinearGradient colors={gradient} style={styles.noteThumbnail}>
                <MaterialCommunityIcons
                  name="email-heart-outline"
                  size={20}
                  color="rgba(255,255,255,0.6)"
                />
              </LinearGradient>
            )}
            {isUnread && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
          </View>

          {/* Content */}
          <View style={styles.noteContent}>
            <View style={styles.noteTopRow}>
              <Text style={styles.noteSender} numberOfLines={1}>
                {item.isOwn ? "You" : item.senderName || "Your partner"}
              </Text>
              <Text style={styles.noteTime}>{relativeTime(item.createdAt)}</Text>
            </View>
            <Text
              style={[styles.notePreview, isUnread && styles.notePreviewUnread]}
              numberOfLines={2}
            >
              {previewText}
            </Text>
            {item.imageUri && (
              <View style={styles.noteAttachmentBadge}>
                <MaterialCommunityIcons name="image-outline" size={12} color={colors.textMuted} />
                <Text style={styles.noteAttachmentText}>Photo</Text>
              </View>
            )}
          </View>

          <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (!isPremium) return null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={
          isDark
            ? [colors.background, "#0F0A1A", colors.background]
            : [colors.background, colors.surface2 || "#F3EDE8", colors.background]
        }
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        {/* ── Header ── */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Love Notes</Text>
            <Text style={styles.headerSubtitle}>
              {unreadCount > 0
                ? `${unreadCount} unread note${unreadCount > 1 ? "s" : ""}`
                : "End-to-end encrypted"}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.composeButton, { backgroundColor: colors.primary }]}
            onPress={handleCompose}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="pen" size={16} color="#FFF" />
          </TouchableOpacity>
        </Animated.View>

        {/* ── Filter Tabs ── */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.filterRow}>
          {[
            { key: "all", label: "All" },
            { key: "received", label: "Received" },
            { key: "sent", label: "Sent" },
          ].map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.filterChip,
                  active && { backgroundColor: withAlpha(colors.primary, 0.15), borderColor: colors.primary },
                ]}
                onPress={() => {
                  setFilter(f.key);
                  Haptics.selectionAsync();
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterText, active && { color: colors.primary, fontFamily: SANS_BOLD }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Animated.View>

        {/* ── Security Banner ── */}
        <Animated.View entering={FadeIn.delay(200).duration(500)} style={styles.securityBanner}>
          <MaterialCommunityIcons name="shield-lock-outline" size={14} color={colors.primary} />
          <Text style={styles.securityText}>
            Notes & photos are end-to-end encrypted — only you and your partner can read them
          </Text>
        </Animated.View>

        {/* ── Notes List ── */}
        <FlatList
          data={filteredNotes}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderNote}
          ListEmptyComponent={loading ? null : renderEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        />
      </SafeAreaView>
    </View>
  );
}

const createStyles = (colors, isDark) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    safeArea: { flex: 1 },

    // Header
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: SPACING.screen,
      paddingTop: SPACING.sm,
      paddingBottom: SPACING.md,
    },
    backButton: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    headerCenter: {
      flex: 1,
      alignItems: "center",
    },
    headerTitle: {
      fontFamily: SERIF,
      fontSize: 22,
      color: colors.text,
      letterSpacing: -0.3,
    },
    headerSubtitle: {
      fontFamily: SANS,
      fontSize: 12,
      color: colors.primary,
      marginTop: 2,
      letterSpacing: 0.3,
    },
    composeButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      ...Platform.select({
        ios: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
        android: { elevation: 6 },
      }),
    },

    // Filter
    filterRow: {
      flexDirection: "row",
      paddingHorizontal: SPACING.screen,
      gap: SPACING.sm,
      marginBottom: SPACING.md,
    },
    filterChip: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderRadius: BORDER_RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? "rgba(20,15,28,0.4)" : "rgba(255,255,255,0.6)",
    },
    filterText: {
      fontFamily: SANS_MEDIUM,
      fontSize: 13,
      color: colors.textMuted,
      letterSpacing: 0.3,
    },

    // Security
    securityBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: SPACING.screen,
      paddingBottom: SPACING.md,
    },
    securityText: {
      fontFamily: SANS,
      fontSize: 11,
      color: colors.textMuted,
      flex: 1,
      lineHeight: 16,
    },

    // List
    listContent: {
      paddingHorizontal: SPACING.screen,
      paddingBottom: SPACING.xxxl,
    },

    // Note Card
    noteCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: SPACING.md,
      marginBottom: SPACING.sm,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? "rgba(20,15,28,0.45)" : "rgba(255,255,255,0.65)",
      gap: SPACING.md,
    },
    noteCardUnread: {
      borderColor: withAlpha(colors.primary, 0.3),
      backgroundColor: isDark ? "rgba(30,20,42,0.6)" : "rgba(255,245,250,0.85)",
    },
    noteThumbnailWrap: {
      position: "relative",
    },
    noteThumbnail: {
      width: 52,
      height: 52,
      borderRadius: BORDER_RADIUS.md,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    unreadDot: {
      position: "absolute",
      top: -3,
      right: -3,
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: colors.background,
    },
    noteContent: {
      flex: 1,
    },
    noteTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    noteSender: {
      fontFamily: SANS_BOLD,
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
    noteTime: {
      fontFamily: SANS,
      fontSize: 11,
      color: colors.textMuted,
      marginLeft: SPACING.sm,
    },
    notePreview: {
      fontFamily: SANS,
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 19,
    },
    notePreviewUnread: {
      color: colors.text,
      fontFamily: SANS_MEDIUM,
    },
    noteAttachmentBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 4,
    },
    noteAttachmentText: {
      fontFamily: SANS,
      fontSize: 11,
      color: colors.textMuted,
    },

    // Empty State
    emptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: SPACING.xxxl,
      paddingHorizontal: SPACING.xl,
    },
    emptyTitle: {
      fontFamily: SERIF,
      fontSize: 22,
      color: colors.text,
      marginTop: SPACING.lg,
      marginBottom: SPACING.sm,
    },
    emptySubtitle: {
      fontFamily: SANS,
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: SPACING.xl,
    },
    emptyButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: SPACING.xl,
      paddingVertical: 14,
      borderRadius: BORDER_RADIUS.full,
      ...Platform.select({
        ios: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
        android: { elevation: 6 },
      }),
    },
    emptyButtonText: {
      fontFamily: SANS_BOLD,
      fontSize: 14,
      color: "#FFFFFF",
      letterSpacing: 0.5,
    },
  });
