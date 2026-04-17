// screens/LoveNotesInboxScreen.js
/**
 * BETWEEN US - LOVE NOTES INBOX (EDITORIAL V3)
 * High-End Apple Editorial Layout + Sexy Red (#D2121A) + Solid Widgets
 * End-to-End Encrypted Architecture
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  Platform,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Animated as RNAnimated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import ReAnimated, { FadeIn, FadeInDown, Layout } from "react-native-reanimated";

// Context & Services
import Icon from '../components/Icon';
import GlowOrb from "../components/GlowOrb";
import FilmGrain from "../components/FilmGrain";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useEntitlements } from "../context/EntitlementsContext";
import DataLayer from "../services/data/DataLayer";
import SyncEngine from "../services/sync/SyncEngine";
import AsyncStorage from '@react-native-async-storage/async-storage';

// Utilities
import { PremiumFeature } from '../utils/featureFlags';
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';
import { SPACING, withAlpha } from "../utils/theme";

const FREE_LOVE_NOTE_PEEK_KEY = '@betweenus:freeLoveNotePeekUsed';

const { width: SCREEN_W, height: SCREEN_HEIGHT } = Dimensions.get("window");

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });
const SERIF_FONT = Platform.select({ ios: "Georgia", android: "serif" });

// Unified Stationery Map
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
  const { isDark, colors } = useTheme();
  const { user } = useAuth();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all"); 
  const scrollY = useRef(new RNAnimated.Value(0)).current;

  // ─── THEME MAP ───
  const t = useMemo(() => ({
    background: colors.background,
    surface: colors.surface || (isDark ? '#1C1C1E' : '#FFFFFF'),
    surfaceSecondary: colors.surface2 || (isDark ? '#2C2C2E' : '#F2F2F7'),
    primary: colors.primary || '#D2121A', // Sexy Red
    accent: colors.accent || '#D4AA7E',
    text: colors.text,
    subtext: colors.textMuted || (isDark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.6)'),
    border: colors.border || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  // Integrated premium logic
  useEffect(() => {
    if (isPremium) return;
    AsyncStorage.getItem(FREE_LOVE_NOTE_PEEK_KEY).then((used) => {
      if (!used) {
        AsyncStorage.setItem(FREE_LOVE_NOTE_PEEK_KEY, 'true').catch(() => {});
        return;
      }
      showPaywall?.(PremiumFeature.LOVE_NOTES);
      navigation.goBack();
    }).catch(() => {
      showPaywall?.(PremiumFeature.LOVE_NOTES);
      navigation.goBack();
    });
  }, [isPremium, navigation, showPaywall]);

  const loadNotes = useCallback(async () => {
    try {
      await DataLayer.purgeExpiredLoveNotes().catch(() => {});
      const all = await DataLayer.getLoveNotes({ limit: 200 });
      setNotes(all || []);
    } catch (err) {
      if (__DEV__) console.warn("[LoveNotesInbox] Load failed:", err?.message);
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

  // ─── HANDLERS ───
  const handleBack = useCallback(() => {
    impact(ImpactFeedbackStyle.Light);
    navigation.goBack();
  }, [navigation]);

  const handleOpenNote = useCallback((noteId) => {
    impact(ImpactFeedbackStyle.Light);
    navigation.navigate("LoveNoteDetail", { noteId });
  }, [navigation]);

  const handleCompose = useCallback(() => {
    impact(ImpactFeedbackStyle.Medium);
    navigation.navigate("ComposeLoveNote");
  }, [navigation]);

  // ─── ANIMATION VALUES ───
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const headerScale = scrollY.interpolate({
    inputRange: [-100, 0],
    outputRange: [1.1, 1],
    extrapolate: 'clamp',
  });

  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, -20],
    extrapolate: 'clamp',
  });

  // ─── RENDERERS ───
  const renderEmpty = () => (
    <ReAnimated.View entering={FadeIn.duration(800)} style={styles.emptyContainer}>
      <View style={[styles.emptyIconCircle, { borderColor: t.border, backgroundColor: t.surface }]}>
        <Icon name="mail-outline" size={42} color={t.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: t.text }]}>No notes yet</Text>
      <Text style={styles.emptySubtitle}>
        Begin your shared anthology. Send a private note that only you two can ever decrypt.
      </Text>
      <TouchableOpacity activeOpacity={0.85} onPress={handleCompose}>
        <LinearGradient colors={[t.primary, '#8A0B11']} style={[styles.emptyButton, getShadow(isDark)]}>
          <Icon name="pencil-outline" size={18} color="#FFF" />
          <Text style={styles.emptyButtonText}>Write First Note</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ReAnimated.View>
  );

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
      <ReAnimated.View 
        entering={FadeInDown.delay(index * 35).springify().damping(18)} 
        layout={Layout.springify()}
      >
        <TouchableOpacity
          onPress={() => handleOpenNote(item.id)}
          activeOpacity={0.86}
          style={[
            styles.noteCard, 
            getShadow(isDark),
            { 
              backgroundColor: isUnread ? withAlpha(t.primary, 0.08) : t.surface,
              borderColor: isUnread ? withAlpha(t.primary, 0.6) : t.border 
            }
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
            {isUnread && <View style={[styles.unreadDot, { backgroundColor: t.primary, borderColor: isDark ? '#1C1C1E' : '#FFF' }]} />}
          </View>

          {/* Editorial Content */}
          <View style={styles.noteContent}>
            <View style={styles.noteTopRow}>
              <Text style={[styles.noteSender, { color: isUnread ? t.text : t.subtext }]} numberOfLines={1}>
                {item.isOwn ? "Sent" : item.senderName || "Received"}
              </Text>
              <Text style={styles.noteTime}>{relativeTime(item.createdAt)}</Text>
            </View>
            <Text
              style={[styles.notePreview, { color: isUnread ? t.text : t.subtext }]}
              numberOfLines={2}
            >
              {previewText}
            </Text>
            
            {!item.isOwn && item.expiresAt && (
              <View style={[styles.expiryBadge, { backgroundColor: withAlpha(t.primary, 0.12) }]}>
                <Icon name="time-outline" size={10} color={t.primary} />
                <Text style={[styles.expiryHint, { color: t.primary }]} numberOfLines={1}>
                  {formatExpiryShort(item.expiresAt)}
                </Text>
              </View>
            )}
          </View>

          <Icon name="chevron-forward" size={20} color={withAlpha(t.text, 0.2)} />
        </TouchableOpacity>
      </ReAnimated.View>
    );
  }, [t, isDark, handleOpenNote, styles]);

  const ListHeader = (
    <ReAnimated.View entering={FadeIn.duration(500)}>
      {/* ── Editorial Header ── */}
      <RNAnimated.View
        style={[styles.editorialHeader, {
          opacity: headerOpacity,
          transform: [{ scale: headerScale }, { translateY: headerTranslateY }],
        }]}
      >
        <Text style={[styles.headerSubtitle, { color: t.primary }]}>
          {unreadCount > 0 ? `${unreadCount} UNREAD` : "END-TO-END ENCRYPTED"}
        </Text>
        <Text style={[styles.headerTitle, { color: t.text }]}>Love Notes</Text>
      </RNAnimated.View>

      {/* ── Filters ── */}
      <View style={styles.filtersRow}>
        {[
          { key: "all", label: "Inbox" },
          { key: "received", label: "Received" },
          { key: "sent", label: "Sent" },
        ].map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.filterChip,
                { backgroundColor: t.surface, borderColor: t.border },
                active && { borderColor: t.primary, backgroundColor: withAlpha(t.primary, 0.12) }
              ]}
              activeOpacity={0.8}
              onPress={() => { selection(); setFilter(f.key); }}
            >
              <Text style={[styles.filterLabel, { color: active ? t.text : t.subtext }]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Security Info ── */}
      <View style={styles.securityHeader}>
        <Icon name="shield-checkmark-outline" size={12} color={t.subtext} />
        <Text style={[styles.securityText, { color: t.subtext }]}>SECURE PRIVATE CHANNEL</Text>
      </View>
    </ReAnimated.View>
  );

  const LoadingState = (
    <View style={styles.loadingState}>
      <ActivityIndicator size="small" color={t.primary} />
      <Text style={styles.loadingText}>Decrypting inbox…</Text>
    </View>
  );

  if (!isPremium) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      
      <LinearGradient
        colors={isDark 
          ? [t.background, '#120206', '#0A0003', t.background] 
          : [t.background, t.surfaceSecondary, t.background]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <GlowOrb color={t.primary} size={460} top={-180} left={SCREEN_W - 220} opacity={isDark ? 0.18 : 0.08} />
      <GlowOrb color={t.primary} size={260} top={620} left={-80} opacity={isDark ? 0.12 : 0.05} />
      <FilmGrain opacity={0.1} />

      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        {/* ── Fixed Apple Nav Header ── */}
        <View style={styles.navHeader}>
          <TouchableOpacity onPress={handleBack} hitSlop={16} style={styles.iconButton}>
            <Icon name="arrow-back" size={24} color={t.text} />
          </TouchableOpacity>
        </View>

        <RNAnimated.FlatList
          data={filteredNotes}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderNote}
          ListEmptyComponent={loading ? LoadingState : renderEmpty}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          windowSize={11}
          maxToRenderPerBatch={8}
          removeClippedSubviews={true}
          onScroll={RNAnimated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
        />
      </SafeAreaView>
    </View>
  );
}

// ─── HIGH-END DESIGN SYSTEM STYLES ───
const getShadow = (isDark) => Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: isDark ? 0.4 : 0.08, shadowRadius: 24 },
  android: { elevation: 6 },
});

const createStyles = (t, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.background },
  safeArea: { flex: 1 },
  listContent: {
    paddingHorizontal: SPACING.screen || 24,
    paddingBottom: 160,
  },
  
  // ── Fixed Nav Header ──
  navHeader: {
    paddingHorizontal: SPACING.screen || 24,
    paddingTop: 12,
    paddingBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  iconButton: {
    padding: 8,
    marginLeft: -8,
  },
  composeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Editorial Header ──
  editorialHeader: {
    paddingTop: SPACING.md || 16,
    paddingBottom: SPACING.lg || 24,
  },
  headerSubtitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 40,
    color: t.text,
  },

  // ── Filters ──
  filtersRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: SPACING.xl || 32,
  },
  filterChip: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  filterLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Security Info ──
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  securityText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  // ── Content Cards ──
  noteCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    gap: 16,
    marginBottom: 16,
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
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
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
    fontWeight: '600',
    color: t.subtext,
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
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  expiryHint: {
    fontFamily: SYSTEM_FONT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // ── Empty / Loading States ──
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontFamily: SERIF_FONT,
    fontSize: 30,
    marginBottom: 12,
  },
  emptySubtitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    lineHeight: 22,
    color: t.subtext,
    textAlign: 'center',
    marginBottom: 36,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 30,
  },
  emptyButtonText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '700',
    color: "#FFF",
    letterSpacing: -0.2,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 72,
    gap: 14,
  },
  loadingText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: '600',
    color: t.subtext,
  },
});

  