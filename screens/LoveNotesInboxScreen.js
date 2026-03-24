// screens/LoveNotesInboxScreen.js — Inbox for sent & received love notes (E2EE)
// Velvet Glass · Apple Editorial Layout · End-to-End Encrypted Architecture

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
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Icon from '../components/Icon';
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import Animated, { FadeIn, FadeInDown, FadeInUp, SlideInRight } from "react-native-reanimated";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useEntitlements } from "../context/EntitlementsContext";
import { PremiumFeature } from '../utils/featureFlags';
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
  SYSTEM_FONT,
  withAlpha,
} from "../utils/theme";
import GlowOrb from "../components/GlowOrb";
import FilmGrain from "../components/FilmGrain";

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
  const [filter, setFilter] = useState("all"); 

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  // integrated premium logic
  useEffect(() => {
    if (!isPremium) {
      showPaywall?.(PremiumFeature.LOVE_NOTES);
      navigation.goBack();
    }
  }, [isPremium, navigation, showPaywall]);

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

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadNotes();
    });
    return unsubscribe;
  }, [navigation, loadNotes]);

  useEffect(() => {
    if (notes.length > 0) {
      const unread = notes.filter((n) => !n.isOwn && !n.isRead);
      unread.forEach((n) => DataLayer.markLoveNoteRead(n.id).catch(() => {}));
    }
  }, [notes]);

  const onRefresh = useCallback(async () => {
    selection();
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
      impact(ImpactFeedbackStyle.Light);
      navigation.navigate("LoveNoteDetail", { noteId });
    },
    [navigation]
  );

  const handleCompose = useCallback(async () => {
    impact(ImpactFeedbackStyle.Medium);
    navigation.navigate("ComposeLoveNote");
  }, [navigation]);

  // ── High-End Empty State ──
  const renderEmpty = () => (
    <Animated.View entering={FadeIn.duration(800)} style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Icon
          name="email-heart-outline"
          size={48}
          color={colors.primary}
        />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No notes yet</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
        Begin your shared anthology. Send a private note that only you two can ever decrypt.
      </Text>
      <TouchableOpacity style={[styles.emptyButton, { backgroundColor: colors.primary }]} onPress={handleCompose} activeOpacity={0.85}>
        <Icon name="pencil-outline" size={18} color="#FFF" />
        <Text style={styles.emptyButtonText}>Write First Note</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  // ── High-End Note Card ──
  const renderNote = ({ item, index }) => {
    const gradient = STATIONERY_COLORS[item.stationeryId] || STATIONERY_COLORS.love;
    const isUnread = !item.isOwn && !item.isRead;
    const previewText = item.locked
      ? "Locked Reflection"
      : item.text
        ? item.text.length > 100
          ? item.text.slice(0, 100) + "…"
          : item.text
        : "A digital keepsake";

    return (
      <Animated.View entering={FadeInDown.delay(index * 40).springify().damping(20)}>
        <TouchableOpacity
          style={[styles.noteCard, isUnread && { borderColor: withAlpha(colors.primary, 0.3) }]}
          onPress={() => handleOpenNote(item.id)}
          activeOpacity={0.7}
        >
          {/* Visual Identity */}
          <View style={styles.noteThumbnailWrap}>
            {item.imageUri ? (
              <Image source={{ uri: item.imageUri }} style={styles.noteThumbnail} />
            ) : (
              <LinearGradient colors={gradient} style={styles.noteThumbnail}>
                <Icon
                  name="seal"
                  size={24}
                  color="rgba(255,255,255,0.25)"
                />
              </LinearGradient>
            )}
            {isUnread && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
          </View>

          {/* Editorial Content */}
          <View style={styles.noteContent}>
            <View style={styles.noteTopRow}>
              <Text style={[styles.noteSender, { color: colors.text }]} numberOfLines={1}>
                {item.isOwn ? "Sent" : item.senderName || "Received"}
              </Text>
              <Text style={[styles.noteTime, { color: colors.textMuted }]}>{relativeTime(item.createdAt)}</Text>
            </View>
            <Text
              style={[styles.notePreview, { color: isUnread ? colors.text : colors.textMuted }]}
              numberOfLines={2}
            >
              {previewText}
            </Text>
          </View>

          <Icon name="chevron-right" size={20} color={withAlpha(colors.text, 0.2)} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (!isPremium) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <FilmGrain opacity={0.15} />
      <GlowOrb color={colors.primary} size={400} top={-150} left={SCREEN_W - 200} opacity={0.1} />
      <GlowOrb color={isDark ? '#FFFFFF' : '#F2F2F7'} size={300} top={650} left={-100} opacity={isDark ? 0.1 : 0.06} />
      
      <LinearGradient
        colors={[isDark ? "#0F0514" : "#FAF7F5", colors.background]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        {/* ── Apple Editorial Header ── */}
        <Animated.View entering={FadeIn.duration(600)} style={styles.header}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: withAlpha(colors.text, 0.05) }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Icon name="chevron-left" size={28} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Love Notes</Text>
            <Text style={[styles.headerSubtitle, { color: colors.primary }]}>
              {unreadCount > 0
                ? `${unreadCount} UNREAD`
                : "END-TO-END ENCRYPTED"}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.composeButton, { backgroundColor: colors.primary }]}
            onPress={handleCompose}
            activeOpacity={0.85}
          >
            <Icon name="plus" size={24} color="#FFF" />
          </TouchableOpacity>
        </Animated.View>

        {/* ── Editorial Filter Tabs ── */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.filterRow}>
          {[
            { key: "all", label: "Archive" },
            { key: "received", label: "Received" },
            { key: "sent", label: "Sent" },
          ].map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.filterChip,
                  active && { backgroundColor: withAlpha(colors.primary, 0.12), borderColor: colors.primary },
                ]}
                onPress={() => {
                  setFilter(f.key);
                  selection();
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

        {/* ── Editorial Timeline ── */}
        <FlatList
          data={filteredNotes}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderNote}
          ListEmptyComponent={loading ? null : renderEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          RefreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListHeaderComponent={
            <View style={styles.securityHeader}>
                <Icon name="shield-check" size={12} color={colors.textMuted} />
                <Text style={[styles.securityText, { color: colors.textMuted }]}>SECURE PRIVATE CHANNEL</Text>
            </View>
          }
        />
      </SafeAreaView>
    </View>
  );
}

const createStyles = (colors, isDark) =>
  StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },

    // Header Architecture
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 24,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    headerCenter: {
      flex: 1,
      alignItems: "center",
    },
    headerTitle: {
      fontFamily: SYSTEM_FONT,
      fontSize: 36,
      fontWeight: '900',
      letterSpacing: -1,
      lineHeight: 42,
    },
    headerSubtitle: {
      fontFamily: SANS_BOLD,
      fontSize: 10,
      letterSpacing: 2,
      marginTop: 4,
    },
    composeButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      ...Platform.select({
        ios: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
        android: { elevation: 6 },
      }),
    },

    // Filters
    filterRow: {
      flexDirection: "row",
      paddingHorizontal: 24,
      gap: 10,
      marginBottom: 24,
    },
    filterChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: withAlpha(colors.text, 0.08),
      backgroundColor: withAlpha(colors.text, 0.03),
    },
    filterText: {
      fontFamily: SANS_MEDIUM,
      fontSize: 13,
      color: colors.textMuted,
    },

    // Security Info
    securityHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    securityText: {
      fontFamily: SANS_BOLD,
      fontSize: 9,
      letterSpacing: 1.5,
    },

    // List Layout
    listContent: {
      paddingHorizontal: 24,
      paddingBottom: 120,
    },

    // Editorial Note Card
    noteCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      marginBottom: 12,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: withAlpha(colors.text, 0.08),
      backgroundColor: withAlpha(colors.surface, 0.5),
      gap: 16,
    },
    noteThumbnailWrap: {
      position: "relative",
    },
    noteThumbnail: {
      width: 56,
      height: 56,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    unreadDot: {
      position: "absolute",
      top: -4,
      right: -4,
      width: 12,
      height: 12,
      borderRadius: 6,
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
      fontSize: 15,
    },
    noteTime: {
      fontFamily: SANS,
      fontSize: 11,
      opacity: 0.6,
    },
    notePreview: {
      fontFamily: SANS,
      fontSize: 14,
      lineHeight: 20,
    },

    // Empty State Architecture
    emptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 80,
      paddingHorizontal: 40,
    },
    emptyIconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: withAlpha(colors.primary, 0.08),
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    emptyTitle: {
      fontFamily: SERIF,
      fontSize: 28,
      textAlign: 'center',
      marginBottom: 12,
    },
    emptySubtitle: {
      fontFamily: SANS,
      fontSize: 15,
      textAlign: "center",
      lineHeight: 24,
      marginBottom: 32,
    },
    emptyButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 32,
      paddingVertical: 16,
      borderRadius: 30,
      ...Platform.select({
        ios: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12 },
        android: { elevation: 8 },
      }),
    },
    emptyButtonText: {
      fontFamily: SANS_BOLD,
      fontSize: 15,
      color: "#FFF",
    },
  });
  