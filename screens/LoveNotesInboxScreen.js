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
import { BlurView } from "expo-blur";
import Icon from '../components/Icon';
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import Animated, { FadeIn, FadeInDown, Layout } from "react-native-reanimated";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useEntitlements } from "../context/EntitlementsContext";
import { PremiumFeature } from '../utils/featureFlags';
import DataLayer from "../services/data/DataLayer";
import SyncEngine from "../services/sync/SyncEngine";
import { withAlpha } from "../utils/theme";
import GlowOrb from "../components/GlowOrb";
import FilmGrain from "../components/FilmGrain";

const { width: SCREEN_W } = Dimensions.get("window");

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });
const SERIF_FONT = Platform.select({ ios: "DMSerifDisplay-Regular", android: "DMSerifDisplay_400Regular", default: "serif" });

// Unified Stationery Map to match Compose & Detail screens
const STATIONERY_MAP = {
  love:    { icon: "heart-outline", paper: "#FFF0F5", accent: "#D4609A" },
  heart:   { icon: "heart-circle-outline", paper: "#FFF5F5", accent: "#FF2D55" },
  sparkle: { icon: "sparkles-outline", paper: "#FFF0F3", accent: "#FF006E" },
  rose:    { icon: "flower-outline", paper: "#FFF5F5", accent: "#D2121A" },
  sunset:  { icon: "sunny-outline", paper: "#FFF8F2", accent: "#E08860" },
  night:   { icon: "star-outline", paper: "#F0EDF8", accent: "#7B68EE" },
  sexy:    { icon: "flame-outline", paper: "#FFF5F5", accent: "#D2121A" },
  dreamy:  { icon: "moon-outline", paper: "#F0EDF8", accent: "#7B68EE" },
  playful: { icon: "happy-outline", paper: "#FFFDF2", accent: "#E8A020" },
  classic: { icon: "mail-outline", paper: "#FAF8F5", accent: "#8B7355" },
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

function formatExpiryShort(expiresAt) {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'Expiring…';
  const totalMins = Math.floor(ms / 60000);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

export default function LoveNotesInboxScreen({ navigation }) {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all"); 

  // Apple Editorial Velvet Glass Theme
  const t = useMemo(() => ({
    background: isDark ? '#050305' : '#140A0D',
    primary: '#D2121A',
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.55)',
    border: 'rgba(255, 255, 255, 0.08)',
    surface: 'rgba(255, 255, 255, 0.03)',
  }), [isDark]);

  const styles = useMemo(() => createStyles(t), [t]);

  // Integrated premium logic
  useEffect(() => {
    if (!isPremium) {
      showPaywall?.(PremiumFeature.LOVE_NOTES);
      navigation.goBack();
    }
  }, [isPremium, navigation, showPaywall]);

  const loadNotes = useCallback(async () => {
    try {
      await DataLayer.purgeExpiredLoveNotes().catch(() => {});
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
    SyncEngine.pushNow()
      .catch(() => {})
      .then(() => DataLayer.pullNow())
      .catch(() => {})
      .finally(() => loadNotes());

    const unsub = DataLayer.onSyncEvent((event, data) => {
      if (
        (event === 'sync:complete' && (data?.pulled ?? 0) > 0) ||
        (event === 'sync:realtime' && data?.table === 'love_notes')
      ) {
        loadNotes();
      }
    });
    return unsub;
  }, [loadNotes]);

  useEffect(() => {
    const expiringNotes = notes.filter((n) => !n.isOwn && n.expiresAt);
    if (!expiringNotes.length) return;
    const nearestExpiry = Math.min(...expiringNotes.map((n) => n.expiresAt));
    const delay = nearestExpiry - Date.now();
    if (delay <= 0) { loadNotes(); return; }
    const id = setTimeout(() => loadNotes(), delay + 500);
    return () => clearTimeout(id);
  }, [notes, loadNotes]);

  const onRefresh = useCallback(async () => {
    selection();
    setRefreshing(true);
    try {
      await SyncEngine.pushNow().catch(() => {});
      await DataLayer.pullNow().catch(() => {});
    } catch { /* best-effort */ }
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
        <Icon name="mail-outline" size={48} color={t.primary} />
      </View>
      <Text style={styles.emptyTitle}>No notes yet</Text>
      <Text style={styles.emptySubtitle}>
        Begin your shared anthology. Send a private note that only you two can ever decrypt.
      </Text>
      <TouchableOpacity activeOpacity={0.85} onPress={handleCompose}>
        <LinearGradient colors={[t.primary, '#8A0B11']} style={styles.emptyButton}>
          <Icon name="pencil-outline" size={18} color="#FFF" />
          <Text style={styles.emptyButtonText}>Write First Note</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  // ── High-End Velvet Glass Note Card ──
  const renderNote = useCallback(({ item, index }) => {
    const stationery = STATIONERY_MAP[item.stationeryId] || STATIONERY_MAP.love;
    const isUnread = !item.isOwn && !item.isRead;
    const previewText = item.locked
      ? "Locked Reflection"
      : item.text
          ? item.text.length > 100
            ? item.text.slice(0, 100) + "…"
            : item.text
          : "A digital keepsake";

    return (
      <Animated.View 
        entering={FadeInDown.delay(index * 40).springify().damping(20)} 
        layout={Layout.springify()}
      >
        <TouchableOpacity
          onPress={() => handleOpenNote(item.id)}
          activeOpacity={0.7}
          style={styles.noteCardWrapper}
        >
          <BlurView 
            intensity={40} 
            tint="dark" 
            style={[
              styles.noteCard, 
              isUnread && { borderColor: withAlpha(t.primary, 0.4), backgroundColor: withAlpha(t.primary, 0.05) }
            ]}
          >
            {/* Visual Identity (Miniature Paper) */}
            <View style={styles.noteThumbnailWrap}>
              {item.imageUri ? (
                <View style={styles.imageThumbnailContainer}>
                  <Image source={{ uri: item.imageUri }} style={styles.noteThumbnailImg} />
                </View>
              ) : (
                <View style={[styles.noteThumbnail, { backgroundColor: stationery.paper }]}>
                  <View style={[styles.thumbnailAccent, { backgroundColor: withAlpha(stationery.accent, 0.3) }]} />
                  <Icon name={stationery.icon} size={18} color={stationery.accent} />
                </View>
              )}
              {isUnread && <View style={[styles.unreadDot, { backgroundColor: t.primary }]} />}
            </View>

            {/* Editorial Content */}
            <View style={styles.noteContent}>
              <View style={styles.noteTopRow}>
                <Text style={[styles.noteSender, { color: isUnread ? t.text : t.textMuted }]} numberOfLines={1}>
                  {item.isOwn ? "Sent" : item.senderName || "Received"}
                </Text>
                <Text style={styles.noteTime}>{relativeTime(item.createdAt)}</Text>
              </View>
              <Text
                style={[styles.notePreview, { color: isUnread ? t.text : t.textMuted }]}
                numberOfLines={2}
              >
                {previewText}
              </Text>
              
              {!item.isOwn && item.expiresAt && (
                <View style={styles.expiryBadge}>
                  <Icon name="time-outline" size={10} color={t.primary} />
                  <Text style={styles.expiryHint} numberOfLines={1}>
                    {formatExpiryShort(item.expiresAt)}
                  </Text>
                </View>
              )}
            </View>

            <Icon name="chevron-forward" size={20} color={withAlpha(t.text, 0.2)} />
          </BlurView>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [t, handleOpenNote, styles]);

  if (!isPremium) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <FilmGrain opacity={0.05} />
      <GlowOrb color={t.primary} size={500} top={-200} left={SCREEN_W - 250} opacity={0.12} />
      <GlowOrb color={t.primary} size={400} top={SCREEN_W * 1.5} left={-150} opacity={0.08} />
      
      <LinearGradient colors={['#110408', t.background]} style={StyleSheet.absoluteFillObject} />

      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        {/* ── Apple Editorial Header ── */}
        <Animated.View entering={FadeIn.duration(600)} style={styles.header}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.goBack()}>
            <BlurView intensity={40} tint="dark" style={styles.circleButton}>
              <Icon name="chevron-back" size={24} color={t.text} />
            </BlurView>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Love Notes</Text>
            <Text style={styles.headerSubtitle}>
              {unreadCount > 0
                ? `${unreadCount} UNREAD`
                : "END-TO-END ENCRYPTED"}
            </Text>
          </View>

          <TouchableOpacity activeOpacity={0.85} onPress={handleCompose}>
            <LinearGradient colors={[t.primary, '#9F1218']} style={styles.composeButton}>
              <Icon name="add-outline" size={24} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Editorial Filter Tabs (Velvet Glass) ── */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.filterRow}>
          {[
            { key: "all", label: "Inbox" },
            { key: "received", label: "Received" },
            { key: "sent", label: "Sent" },
          ].map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => { setFilter(f.key); selection(); }}
                activeOpacity={0.8}
                style={styles.filterChipWrapper}
              >
                <BlurView 
                  intensity={active ? 60 : 20} 
                  tint="dark" 
                  style={[
                    styles.filterChip,
                    active && { borderColor: withAlpha(t.primary, 0.5), backgroundColor: withAlpha(t.primary, 0.15) }
                  ]}
                >
                  <Text style={[styles.filterText, active && { color: '#FFF', fontWeight: '700' }]}>
                    {f.label}
                  </Text>
                </BlurView>
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
          windowSize={11}
          maxToRenderPerBatch={8}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />
          }
          ListHeaderComponent={
            <View style={styles.securityHeader}>
                <Icon name="shield-checkmark-outline" size={12} color={t.textMuted} />
                <Text style={styles.securityText}>SECURE PRIVATE CHANNEL</Text>
            </View>
          }
        />
      </SafeAreaView>
    </View>
  );
}

const createStyles = (t) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050305' },
    safeArea: { flex: 1 },

    // Header Architecture
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 24,
      zIndex: 10,
    },
    circleButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: t.border,
      overflow: 'hidden',
    },
    headerCenter: {
      flex: 1,
      alignItems: "center",
    },
    headerTitle: {
      fontFamily: SYSTEM_FONT,
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: -0.5,
      color: t.text,
    },
    headerSubtitle: {
      fontFamily: SYSTEM_FONT,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 2,
      color: t.primary,
      marginTop: 4,
    },
    composeButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      ...Platform.select({
        ios: { shadowColor: t.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
        android: { elevation: 6 },
      }),
    },

    // Filters
    filterRow: {
      flexDirection: "row",
      paddingHorizontal: 24,
      gap: 12,
      marginBottom: 24,
      zIndex: 10,
    },
    filterChipWrapper: {
      borderRadius: 20,
      overflow: 'hidden',
    },
    filterChip: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 20,
    },
    filterText: {
      fontFamily: SYSTEM_FONT,
      fontSize: 13,
      fontWeight: '500',
      color: t.textMuted,
      letterSpacing: 0.2,
    },

    // Security Info
    securityHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 20,
        paddingHorizontal: 24,
    },
    securityText: {
      fontFamily: SYSTEM_FONT,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.5,
      color: t.textMuted,
    },

    // List Layout
    listContent: {
      paddingHorizontal: 24,
      paddingBottom: 120,
    },

    // Velvet Glass Note Card
    noteCardWrapper: {
      marginBottom: 16,
      borderRadius: 24,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16 },
        android: { elevation: 6 },
      }),
    },
    noteCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: t.border,
      gap: 16,
      overflow: 'hidden',
    },
    noteThumbnailWrap: {
      position: "relative",
    },
    noteThumbnail: {
      width: 56,
      height: 64,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.1)',
      transform: [{ rotate: '-2deg' }],
    },
    thumbnailAccent: {
      position: 'absolute',
      left: 6,
      top: 0,
      bottom: 0,
      width: 1.5,
    },
    imageThumbnailContainer: {
      width: 56,
      height: 64,
      borderRadius: 8,
      backgroundColor: '#FFF',
      padding: 3,
      transform: [{ rotate: '-2deg' }],
    },
    noteThumbnailImg: {
      flex: 1,
      borderRadius: 4,
    },
    unreadDot: {
      position: "absolute",
      top: -4,
      right: -4,
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: '#110408',
    },
    noteContent: {
      flex: 1,
      justifyContent: 'center',
    },
    noteTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    noteSender: {
      fontFamily: SYSTEM_FONT,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    noteTime: {
      fontFamily: SYSTEM_FONT,
      fontSize: 12,
      fontWeight: '500',
      color: t.textMuted,
    },
    notePreview: {
      fontFamily: SERIF_FONT,
      fontSize: 15,
      lineHeight: 22,
    },
    expiryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 8,
      backgroundColor: withAlpha(t.primary, 0.1),
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    expiryHint: {
      fontFamily: SYSTEM_FONT,
      fontSize: 10,
      fontWeight: '800',
      color: t.primary,
      letterSpacing: 0.5,
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
        backgroundColor: withAlpha(t.primary, 0.08),
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    emptyTitle: {
      fontFamily: SERIF_FONT,
      fontSize: 28,
      textAlign: 'center',
      marginBottom: 12,
      color: t.text,
    },
    emptySubtitle: {
      fontFamily: SYSTEM_FONT,
      fontSize: 15,
      textAlign: "center",
      lineHeight: 24,
      marginBottom: 36,
      color: t.textMuted,
    },
    emptyButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 32,
      paddingVertical: 18,
      borderRadius: 30,
      ...Platform.select({
        ios: { shadowColor: t.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16 },
        android: { elevation: 8 },
      }),
    },
    emptyButtonText: {
      fontFamily: SYSTEM_FONT,
      fontSize: 16,
      fontWeight: '700',
      color: "#FFF",
      letterSpacing: -0.2,
    },
  });
  