// screens/SavedMomentsScreen.js
/**
 * BETWEEN US - SAVED MOMENTS ENGINE (EDITORIAL V3)
 * High-End Apple Editorial Layout + Velvet Glass + Original Sexy Red (#D2121A)
 */

import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Platform,
  Dimensions,
  ActivityIndicator,
  Animated as RNAnimated,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import ReAnimated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

// Context & Services
import Icon from '../components/Icon';
import FilmGrain from '../components/FilmGrain';
import GlowOrb from '../components/GlowOrb';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { DataLayer } from '../services/localfirst';
import { getPromptById } from '../utils/contentLoader';

// Utilities
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';
import { SPACING, withAlpha } from '../utils/theme';
import { storage } from '../utils/storage';

const HEARTS_KEY = '@betweenus:moment_hearts';

const { width: SCREEN_W, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });
const SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif' });

const FILTERS = [
  { id: 'all', label: 'All', icon: 'albums-outline' },
  { id: 'prompt', label: 'Prompts', icon: 'chatbubbles-outline' },
  { id: 'memory', label: 'Moments', icon: 'images-outline' },
  { id: 'photo', label: 'Photos', icon: 'camera-outline' },
  { id: 'journal', label: 'Journal', icon: 'book-outline' },
];

const MEMORY_TYPE_META = {
  moment: { label: 'Saved Moment', icon: 'sparkles-outline' },
  anniversary: { label: 'Anniversary', icon: 'heart-outline' },
  milestone: { label: 'Milestone', icon: 'ribbon-outline' },
  memory: { label: 'Memory', icon: 'time-outline' },
  first: { label: 'A First', icon: 'star-outline' },
  inside_joke: { label: 'Inside Joke', icon: 'happy-outline' },
};

function formatDateLabel(value) {
  if (!value) return '';
  const date = typeof value === 'string' && value.length === 10
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getSortTime(item) {
  const raw = item.sortAt || item.created_at || item.date_key || item.date;
  if (!raw) return 0;
  const value = typeof raw === 'string' && raw.length === 10
    ? new Date(`${raw}T00:00:00`).getTime()
    : new Date(raw).getTime();
  return Number.isNaN(value) ? 0 : value;
}

function buildPromptItem(row) {
  const prompt = getPromptById(row.prompt_id);
  return {
    id: `prompt:${row.id}`,
    kind: 'prompt',
    sourceId: row.id,
    title: prompt?.text || 'Saved reflection',
    body: row.locked ? 'This reflection is locked on this device.' : (row.answer || ''),
    eyebrow: row.is_revealed ? 'REFLECTION' : 'SEALED REFLECTION',
    icon: row.is_revealed ? 'chatbubbles-outline' : 'lock-closed-outline',
    accent: '#D2121A',
    meta: row.heat_level ? `Heat ${row.heat_level}` : 'Prompt',
    dateLabel: formatDateLabel(row.date_key || row.created_at),
    sortAt: row.created_at || row.date_key,
  };
}

function buildMemoryItem(row) {
  const memoryType = MEMORY_TYPE_META[row.type] || MEMORY_TYPE_META.moment;
  return {
    id: `memory:${row.id}`,
    kind: 'memory',
    sourceId: row.id,
    title: memoryType.label,
    body: row.locked ? 'This moment is locked on this device.' : (row.content || ''),
    eyebrow: row.is_private ? 'PRIVATE MOMENT' : 'SHARED MOMENT',
    icon: memoryType.icon,
    accent: row.is_private ? '#7E4FA3' : '#D2121A',
    meta: row.mood ? String(row.mood).toUpperCase() : 'Moment',
    dateLabel: formatDateLabel(row.created_at || row.date),
    sortAt: row.created_at || row.date,
    mediaRef: row.media_ref || null,
    rawDate: row.created_at || row.date || null,
  };
}

function buildJournalItem(row, ownerIds) {
  const isOwn = ownerIds.has(row.user_id);
  return {
    id: `journal:${row.id}`,
    kind: 'journal',
    sourceId: row.id,
    title: row.locked ? 'Locked shared journal' : (row.title || 'Shared reflection'),
    body: row.locked ? 'This shared journal entry is locked on this device.' : (row.body || ''),
    eyebrow: isOwn ? 'SHARED JOURNAL' : 'PARTNER JOURNAL',
    icon: 'book-outline',
    accent: '#D2121A',
    meta: isOwn ? 'Visible to both of you' : 'Shared by your partner',
    dateLabel: formatDateLabel(row.created_at),
    sortAt: row.created_at,
    entry: row,
    canOpen: true,
    canEdit: isOwn,
    photoUri: row.photo_uri || row.photoUri || row.imageUri || null,
  };
}

export default function SavedMomentsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { state } = useAppContext();
  const { colors, isDark } = useTheme();
  
  const [filter, setFilter] = useState('all');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [photoUris, setPhotoUris] = useState({}); // itemId → decrypted local URI
  const [hearts, setHearts] = useState({}); // itemId → { count: number, hearted: bool }
  const scrollY = useRef(new RNAnimated.Value(0)).current;

  const ownerIds = useMemo(
    () => new Set([user?.id, user?.uid, state?.userId].filter(Boolean)),
    [state?.userId, user?.id, user?.uid]
  );

  // ─── THEME MAP (Original Colors, Glass Opacities) ───
  const t = useMemo(() => ({
    background: colors.background,
    surface: isDark ? 'rgba(28, 28, 30, 0.45)' : 'rgba(255, 255, 255, 0.65)',
    surfaceSecondary: isDark ? 'rgba(44, 44, 46, 0.8)' : 'rgba(242, 242, 247, 0.8)',
    primary: colors.primary || '#D2121A',
    accent: colors.accent || '#D4AA7E',
    text: colors.text,
    subtext: colors.textMuted || (isDark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.6)'),
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  // ─── DATA LOADING ───
  const loadEntries = useCallback(async () => {
    try {
      const [promptRows, memoryRows, journalRows] = await Promise.all([
        DataLayer.getPromptAnswers({ limit: 50 }),
        DataLayer.getMemories({ limit: 50 }),
        DataLayer.getJournalEntries({ limit: 50, visibility: 'shared' }),
      ]);

      const merged = [
        ...(promptRows || []).map(buildPromptItem),
        ...(memoryRows || []).map(buildMemoryItem),
        ...(journalRows || []).map((row) => buildJournalItem(row, ownerIds)),
      ].sort((a, b) => getSortTime(b) - getSortTime(a));

      setEntries(merged);
    } catch (error) {
      if (__DEV__) console.warn('[SavedMoments] Load failed:', error?.message);
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ownerIds]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadEntries();
    }, [loadEntries])
  );

  // ─── LOAD HEARTS FROM STORAGE ───
  useEffect(() => {
    storage.get(HEARTS_KEY, {}).then((saved) => {
      if (saved && typeof saved === 'object') setHearts(saved);
    });
  }, []);

  // ─── LOAD PHOTO URIS FOR MEMORY ITEMS ───
  useEffect(() => {
    if (!entries.length) return;
    const memoryItemsWithPhotos = entries.filter(
      (e) => e.kind === 'memory' && e.mediaRef
    );
    if (!memoryItemsWithPhotos.length) return;

    let cancelled = false;
    (async () => {
      const newUris = {};
      for (const item of memoryItemsWithPhotos) {
        try {
          const uri = await DataLayer.getDecryptedAttachment(item.mediaRef);
          if (uri) newUris[item.id] = uri;
        } catch (err) {
          if (__DEV__) console.warn('[SavedMoments] Photo decrypt failed:', err?.message);
        }
      }
      if (!cancelled) {
        setPhotoUris((prev) => ({ ...prev, ...newUris }));
      }
    })();
    return () => { cancelled = true; };
  }, [entries]);

  // ─── HEART TOGGLE ───
  const handleHeartToggle = useCallback(async (itemId) => {
    impact(ImpactFeedbackStyle.Light);
    setHearts((prev) => {
      const current = prev[itemId] || { count: 0, hearted: false };
      const updated = {
        ...prev,
        [itemId]: {
          count: current.hearted ? Math.max(0, current.count - 1) : current.count + 1,
          hearted: !current.hearted,
        },
      };
      storage.set(HEARTS_KEY, updated);
      return updated;
    });
  }, []);

  const filteredEntries = useMemo(() => {
    if (filter === 'all') return entries;
    if (filter === 'photo') return entries.filter((item) => item.kind === 'memory' && item.mediaRef);
    return entries.filter((item) => item.kind === filter);
  }, [entries, filter]);

  const counts = useMemo(() => ({
    all: entries.length,
    prompt: entries.filter((item) => item.kind === 'prompt').length,
    memory: entries.filter((item) => item.kind === 'memory').length,
    photo: entries.filter((item) => item.kind === 'memory' && item.mediaRef).length,
    journal: entries.filter((item) => item.kind === 'journal').length,
  }), [entries]);

  // ─── ON THIS DAY ───
  const onThisDay = useMemo(() => {
    const today = new Date();
    const todayM = today.getMonth();
    const todayD = today.getDate();
    const thisYear = today.getFullYear();
    return entries.find((item) => {
      const raw = item.sortAt;
      if (!raw) return false;
      const d = typeof raw === 'string' && raw.length === 10
        ? new Date(`${raw}T00:00:00`)
        : new Date(raw);
      if (Number.isNaN(d.getTime())) return false;
      return d.getMonth() === todayM && d.getDate() === todayD && d.getFullYear() < thisYear;
    }) || null;
  }, [entries]);

  const onRefresh = useCallback(() => {
    selection();
    setRefreshing(true);
    loadEntries();
  }, [loadEntries]);

  const handleBack = useCallback(() => {
    impact(ImpactFeedbackStyle.Light);
    navigation.goBack();
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
  const renderFilter = ({ id, label, icon }) => {
    const active = filter === id;
    return (
      <TouchableOpacity
        key={id}
        style={[
          styles.filterChip,
          active && { borderColor: t.primary, backgroundColor: withAlpha(t.primary, 0.15) },
        ]}
        activeOpacity={0.8}
        onPress={() => {
          selection();
          setFilter(id);
        }}
      >
        <Icon name={icon} size={14} color={active ? t.primary : t.subtext} />
        <Text style={[styles.filterLabel, { color: active ? t.text : t.subtext }]}>{label}</Text>
        <View style={[styles.filterCount, { backgroundColor: active ? 'transparent' : t.surfaceSecondary }]}> 
          <Text style={[styles.filterCountText, { color: active ? t.primary : t.subtext }]}>{counts[id]}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item, index }) => {
    const photoUri = item.kind === 'journal' ? (item.photoUri || null) : (item.mediaRef ? (photoUris[item.id] || null) : null);
    const heartState = hearts[item.id] || { count: 0, hearted: false };
    const isMemory = item.kind === 'memory';

    return (
      <ReAnimated.View
        entering={FadeInDown.delay(index * 35).springify().damping(18)}
        style={isMemory ? styles.timelineRow : undefined}
      >
        {/* Timeline spine + dot */}
        {isMemory && (
          <View style={styles.timelineSpine}>
            <View style={[styles.timelineDot, { backgroundColor: item.accent }]} />
            <View style={[styles.timelineLine, { backgroundColor: t.border }]} />
          </View>
        )}

        <TouchableOpacity
          activeOpacity={item.canOpen ? 0.86 : 1}
          disabled={!item.canOpen}
          onPress={() => {
            if (item.kind === 'journal') {
              impact(ImpactFeedbackStyle.Light);
              navigation.navigate('JournalEntry', { entry: item.entry, readOnly: !item.canEdit });
            }
          }}
          style={[styles.cardContainer, isMemory && styles.cardTimeline, getShadow(isDark)]}
        >
          <BlurView intensity={isDark ? 55 : 30} tint={isDark ? 'dark' : 'light'} style={styles.cardBlur}>
            {/* Photo thumbnail */}
            {photoUri && (
              <View style={styles.photoWrapper}>
                <Image
                  source={{ uri: photoUri }}
                  style={styles.photoThumb}
                  resizeMode="cover"
                />
                <View style={[styles.photoOverlay, { backgroundColor: withAlpha(item.accent, 0.18) }]} />
              </View>
            )}

            <View style={styles.cardTopRow}>
              <View style={styles.cardEyebrowRow}>
                <Icon name={item.icon} size={14} color={item.accent} />
                <Text style={[styles.cardEyebrow, { color: item.accent }]}>{item.eyebrow}</Text>
              </View>
              <Text style={styles.dateLabel}>{item.dateLabel}</Text>
            </View>

            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardBody}>{item.body || 'Nothing saved yet.'}</Text>

            <View style={styles.cardFooter}>
              <View style={[styles.metaPill, { backgroundColor: withAlpha(item.accent, 0.08), borderColor: withAlpha(item.accent, 0.2) }]}>
                <Text style={[styles.metaPillText, { color: item.accent }]}>{item.meta}</Text>
              </View>
              <View style={styles.cardFooterRight}>
                {item.kind === 'journal' && (
                  <View style={[styles.openPill, { borderColor: t.border }]}> 
                    <Text style={[styles.openPillText, { color: t.text }]}>{item.canEdit ? 'Open' : 'Read'}</Text>
                  </View>
                )}
                {/* Heart reaction */}
                <TouchableOpacity
                  onPress={() => handleHeartToggle(item.id)}
                  hitSlop={12}
                  style={styles.heartButton}
                >
                  <Icon
                    name="heart-outline"
                    size={18}
                    color={heartState.hearted ? t.primary : t.subtext}
                  />
                  {heartState.count > 0 && (
                    <Text style={[styles.heartCount, { color: heartState.hearted ? t.primary : t.subtext }]}>
                      {heartState.count}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </TouchableOpacity>
      </ReAnimated.View>
    );
  };

  const ListHeader = (
    <ReAnimated.View entering={FadeIn.duration(500)}>
      {/* ── Editorial Header ── */}
      <RNAnimated.View
        style={[styles.editorialHeader, {
          opacity: headerOpacity,
          transform: [{ scale: headerScale }, { translateY: headerTranslateY }],
        }]}
      >
        <Text style={[styles.headerSubtitle, { color: t.primary }]}>SAVED SPACE</Text>
        <Text style={[styles.headerTitle, { color: t.text }]}>Shared Moments</Text>
      </RNAnimated.View>

      {/* ── On This Day Banner ── */}
      {onThisDay && (
        <ReAnimated.View entering={FadeInDown.springify().damping(18)}>
          <View style={[styles.onThisDayContainer, getShadow(isDark)]}>
            <BlurView intensity={isDark ? 55 : 30} tint={isDark ? 'dark' : 'light'} style={[styles.onThisDayCard, { borderColor: withAlpha(t.primary, 0.15) }]}>
              <View style={styles.onThisDayLeft}>
                <Icon name="time-outline" size={18} color={t.primary} />
              </View>
              <View style={styles.onThisDayContent}>
                <Text style={[styles.onThisDayEyebrow, { color: t.primary }]}>ON THIS DAY</Text>
                <Text style={[styles.onThisDayTitle, { color: t.text }]} numberOfLines={2}>
                  {onThisDay.title}
                </Text>
                <Text style={[styles.onThisDayDate, { color: t.subtext }]}>{onThisDay.dateLabel}</Text>
              </View>
              <Icon name="chevron-forward" size={16} color={t.subtext} />
            </BlurView>
          </View>
        </ReAnimated.View>
      )}

      {/* ── Hero Card ── */}
      <View style={[styles.heroCardContainer, getShadow(isDark)]}>
        <BlurView intensity={isDark ? 65 : 45} tint={isDark ? 'dark' : 'light'} style={styles.heroCardBlur}>
          <View style={styles.heroEyebrowRow}>
            <Icon name="archive-outline" size={15} color={t.text} />
            <Text style={[styles.heroEyebrow, { color: t.text }]}>YOUR SHARED ARCHIVE</Text>
          </View>
          <Text style={[styles.heroTitle, { color: t.text }]}>Everything you've saved, kept in one place.</Text>
          <Text style={styles.heroBody}>
            Browse earlier reflections, shared journal entries, and captured moments without leaving the app's main rhythm.
          </Text>
        </BlurView>
      </View>

      {/* ── Filters (scrollable) ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
        style={styles.filtersScroll}
      >
        {FILTERS.map((f) => renderFilter(f))}
      </ScrollView>
    </ReAnimated.View>
  );

  const EmptyState = (
    <ReAnimated.View entering={FadeIn.duration(450)} style={styles.emptyState}>
      <View style={[styles.emptyIconCircle, { borderColor: t.border, backgroundColor: t.surface }]}>
        <Icon name="archive-outline" size={42} color={t.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: t.text }]}>Nothing saved yet</Text>
      <Text style={styles.emptyBody}>
        Reflections, shared journal entries, and captured moments will collect here once you start saving them.
      </Text>
    </ReAnimated.View>
  );

  const LoadingState = (
    <View style={styles.loadingState}>
      <ActivityIndicator size="small" color={t.primary} />
      <Text style={styles.loadingText}>Gathering your saved history…</Text>
    </View>
  );

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
      <GlowOrb color={t.accent} size={260} top={620} left={-80} opacity={isDark ? 0.12 : 0.05} />
      <FilmGrain opacity={0.1} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* ── Fixed Apple Nav Header ── */}
        <View style={styles.navHeader}>
          <TouchableOpacity onPress={handleBack} hitSlop={16} style={styles.iconButton}>
            <Icon name="arrow-back" size={24} color={t.text} />
          </TouchableOpacity>
        </View>

        <RNAnimated.FlatList
          data={filteredEntries}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={loading ? LoadingState : EmptyState}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onScroll={RNAnimated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
        />

        {/* ── Velvet Glass FAB ── */}
        <TouchableOpacity
          style={styles.fabContainer}
          onPress={() => navigation.navigate('AddMemory')}
          activeOpacity={0.85}
        >
          <BlurView intensity={70} tint={isDark ? 'dark' : 'light'} style={[styles.fabBlur, { backgroundColor: withAlpha(t.primary, 0.8) }]}>
            <Icon name="add" size={26} color="#FFF" />
          </BlurView>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

// ─── HIGH-END DESIGN SYSTEM STYLES ───
const getShadow = (isDark) => Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: isDark ? 0.35 : 0.08, shadowRadius: 32 },
  android: { elevation: 6 },
});

const createStyles = (t, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.background },
  safeArea: { flex: 1 },
  listContent: {
    paddingHorizontal: SPACING.screen,
    paddingBottom: 160,
  },

  // ── Floating Action Button ──
  fabContainer: {
    position: 'absolute',
    bottom: 32,
    right: SPACING.screen,
    width: 56,
    height: 56,
    borderRadius: 28,
    ...Platform.select({
      ios: { shadowColor: t.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 16 },
      android: { elevation: 8 },
    }),
  },
  fabBlur: {
    flex: 1,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  
  // ── Fixed Nav Header ──
  navHeader: {
    paddingHorizontal: SPACING.screen,
    paddingTop: 12,
    paddingBottom: 4,
    flexDirection: 'row',
    zIndex: 10,
  },
  iconButton: {
    padding: 8,
    marginLeft: -8,
  },

  // ── Editorial Header ──
  editorialHeader: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
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
    fontFamily: SERIF_FONT,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 40,
  },

  // ── Hero Card ──
  heroCardContainer: {
    borderRadius: 24,
    marginBottom: SPACING.xl,
  },
  heroCardBlur: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    padding: SPACING.xl,
    overflow: 'hidden',
    backgroundColor: t.surface,
  },
  heroEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  heroEyebrow: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontFamily: SERIF_FONT,
    fontSize: 30,
    lineHeight: 36,
    marginBottom: SPACING.sm,
  },
  heroBody: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    lineHeight: 26, // Breathed out for editorial feel
    color: t.subtext,
  },

  // ── Filters ──
  filtersScroll: {
    marginBottom: SPACING.xl,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: SPACING.screen,
  },
  filterChip: {
    height: 42,
    borderRadius: 999, // Perfect pill shape
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    backgroundColor: t.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
  },
  filterLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '700',
  },
  filterCount: {
    minWidth: 24,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterCountText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '800',
  },

  // ── Content Cards ──
  cardContainer: {
    borderRadius: 24,
    marginBottom: SPACING.lg,
  },
  cardBlur: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    padding: SPACING.xl,
    overflow: 'hidden',
    backgroundColor: t.surface,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: SPACING.md,
  },
  cardEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  cardEyebrow: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  dateLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '600',
    color: t.subtext,
  },
  cardTitle: {
    fontFamily: SERIF_FONT,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: t.text,
    marginBottom: SPACING.sm,
  },
  cardBody: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    lineHeight: 24,
    color: t.subtext, // Softened from primary text for better hierarchy
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
  },
  metaPill: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  metaPillText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  openPill: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  openPillText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Empty / Loading States ──
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: SPACING.xl,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontFamily: SERIF_FONT,
    fontSize: 30,
    marginBottom: SPACING.sm,
  },
  emptyBody: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    lineHeight: 24,
    color: t.subtext,
    textAlign: 'center',
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

  // ── On This Day ──
  onThisDayContainer: {
    marginBottom: SPACING.lg,
    borderRadius: 20,
  },
  onThisDayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.md,
    overflow: 'hidden',
    backgroundColor: t.surface,
  },
  onThisDayLeft: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(t.primary, 0.12),
  },
  onThisDayContent: {
    flex: 1,
  },
  onThisDayEyebrow: {
    fontFamily: SYSTEM_FONT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  onThisDayTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '700',
    color: t.text,
    lineHeight: 20,
  },
  onThisDayDate: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },

  // ── Photo thumbnail ──
  photoWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    position: 'relative',
  },
  photoThumb: {
    width: '100%',
    height: 180,
    borderRadius: 16,
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },

  // ── Timeline layout ──
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  timelineSpine: {
    width: 20,
    alignItems: 'center',
    paddingTop: SPACING.xl + 4,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 4,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    borderRadius: 1,
  },
  cardTimeline: {
    flex: 1,
  },

  // ── Heart reaction ──
  cardFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  heartCount: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '700',
  },
});
