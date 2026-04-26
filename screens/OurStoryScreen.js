// screens/OurStoryScreen.js
/**
 * BETWEEN US - OUR STORY (EDITORIAL V3)
 * High-End Apple Editorial Layout + Velvet Glass + Original Sexy Red (#D2121A)
 */

import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ActivityIndicator,
  Animated as RNAnimated,
  Image,
  Modal,
  Dimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ReAnimated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

// Context & Services
import Icon from '../components/Icon';
import { useTheme } from '../context/ThemeContext';
import { DataLayer } from '../services/localfirst';
import EncryptedAttachments from '../services/e2ee/EncryptedAttachments';
import { getPromptById } from '../utils/contentLoader';

// Utilities
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';
import { SPACING, withAlpha } from '../utils/theme';
import { storage } from '../utils/storage';
import EditorialScreenScaffold from '../components/EditorialScreenScaffold';
import MediaLightbox from '../components/MediaLightbox';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDateHistory } from '../utils/dateHistory';
import { getIntimacyTried } from '../utils/intimacyFavorites';

const HEARTS_KEY = '@betweenus:moment_hearts';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });
const SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif' });

const MEMORY_TYPE_META = {
  moment: { label: 'Saved Moment', icon: 'sparkles-outline' },
  anniversary: { label: 'Anniversary', icon: 'heart-outline' },
  milestone: { label: 'Milestone', icon: 'ribbon-outline' },
  intimacy_favorite: { label: 'Intimacy Favorite', icon: 'heart-outline' },
  intimacy_tried: { label: 'Position Tried', icon: 'checkmark-circle-outline' },
  date_tried: { label: 'Date Tried', icon: 'calendar-outline' },
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

function getMediaKind(mimeType, uri) {
  if (mimeType?.startsWith('video/')) return 'video';
  if (mimeType?.startsWith('image/')) return 'image';
  return uri ? 'image' : null;
}

async function resolveRowMedia(row) {
  const directUri = row.mediaUri || row.photo_uri || row.photoUri || null;
  const directMimeType = row.mediaType || row.mime_type || row.mimeType || null;
  if (directUri) {
    return {
      uri: directUri,
      mimeType: directMimeType || 'image/jpeg',
      kind: row.mediaKind || getMediaKind(directMimeType, directUri),
    };
  }

  const mediaRef = row.media_ref || row.mediaRef || null;
  if (!mediaRef) return null;

  try {
    const kt = row.couple_id ? 'couple' : 'device';
    const cid = kt === 'couple' ? row.couple_id : null;
    const uri = await EncryptedAttachments.getDecryptedUri(mediaRef, kt, cid);
    let attachment = null;
    try {
      const { default: Database } = await import('../services/db/Database');
      attachment = await Database.getAttachmentById(mediaRef);
    } catch {}
    const mimeType = attachment?.mime_type || directMimeType || 'image/jpeg';
    return { uri, mimeType, kind: getMediaKind(mimeType, uri) };
  } catch {
    return null;
  }
}

function dedupeRows(rows) {
  const seen = new Set();
  return (rows || []).filter((row) => {
    if (!row?.id || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

async function safeLoad(loader) {
  try {
    return await loader();
  } catch {
    return [];
  }
}

function buildPromptItem(row, media = null, myName = 'You', partnerName = 'Partner') {
  const prompt = getPromptById(row.prompt_id);
  const body = row.locked
    ? 'This reflection is locked on this device.'
    : (row.is_revealed && row.partnerAnswer
      ? `${myName}: ${row.answer || ''}\n\n${partnerName}: ${row.partnerAnswer}`.trim()
      : (row.answer || ''));
  return {
    id: `prompt:${row.id}`,
    kind: 'prompt',
    sourceId: row.id,
    title: prompt?.text || 'Saved reflection',
    body,
    eyebrow: row.is_revealed ? 'Prompt' : 'Sealed prompt',
    icon: row.is_revealed ? 'chatbubbles-outline' : 'lock-closed-outline',
    accent: '#D2121A',
    meta: row.heat_level ? `Heat ${row.heat_level}` : 'Prompt',
    dateLabel: formatDateLabel(row.date_key || row.created_at),
    sortAt: row.created_at || row.date_key,
    media,
  };
}

function buildMemoryItem(row, media = null) {
  const memoryType = MEMORY_TYPE_META[row.type] || MEMORY_TYPE_META.moment;
  const isIntimacyFavorite = row.type === 'intimacy_favorite';
  return {
    id: `memory:${row.id}`,
    kind: 'memory',
    sourceId: row.id,
    title: memoryType.label,
    body: row.locked ? 'This moment is locked on this device.' : (row.content || ''),
    eyebrow: isIntimacyFavorite ? 'Intimacy favorite' : (row.is_private ? 'Private moment' : 'Memory'),
    icon: memoryType.icon,
    accent: row.is_private ? '#7E4FA3' : '#D2121A',
    meta: isIntimacyFavorite ? 'Shared intimacy' : (row.mood ? String(row.mood).toUpperCase() : 'Moment'),
    dateLabel: formatDateLabel(row.created_at || row.date),
    sortAt: row.created_at || row.date,
    mediaRef: row.media_ref || null,
    mimeType: row.mime_type || null,
    rawDate: row.created_at || row.date || null,
    media,
  };
}

function buildJournalItem(row, media = null) {
  return {
    id: `journal:${row.id}`,
    kind: 'journal',
    sourceId: row.id,
    title: row.locked ? 'Journal entry' : (row.title || 'Journal entry'),
    body: row.locked ? 'This entry is locked on this device.' : (row.body || ''),
    eyebrow: 'Journal',
    icon: 'book-outline',
    accent: '#D2121A',
    meta: row.mood ? String(row.mood).toUpperCase() : 'Journal',
    dateLabel: formatDateLabel(row.created_at || row.date),
    sortAt: row.created_at || row.date,
    rawDate: row.created_at || row.date || null,
    media,
  };
}

function buildDateItem(row) {
  const parts = [];
  if (row.minutes) parts.push(`${row.minutes} min`);
  if (row.location) parts.push(row.location === 'home' ? 'At home' : 'Out');
  const meta = parts.length ? parts.join(' • ') : 'Date night';

  return {
    id: `date:${row.id}`,
    kind: 'date',
    sourceId: row.id,
    title: row.title || 'Date tried',
    body: 'A date you tried together.',
    eyebrow: 'Date tried',
    icon: 'calendar-outline',
    accent: '#D2121A',
    meta,
    dateLabel: formatDateLabel(row.addedAt),
    sortAt: row.addedAt,
    memoryId: row.memoryId || null,
  };
}

function buildPositionTriedItem(row) {
  const label = row.commonName ? `${row.commonName}: ${row.title}` : row.title;
  return {
    id: `position-tried:${row.positionId}`,
    kind: 'position_tried',
    sourceId: row.positionId,
    title: label || 'Position tried',
    body: 'An intimacy position you tried together.',
    eyebrow: 'Position tried',
    icon: 'checkmark-circle-outline',
    accent: '#7E4FA3',
    meta: row.mood ? String(row.mood).toUpperCase() : 'Intimacy',
    dateLabel: formatDateLabel(row.triedAt),
    sortAt: row.triedAt,
    memoryId: row.memoryId || null,
  };
}

export default function OurStoryScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [hearts, setHearts] = useState({}); // itemId → { count: number, hearted: bool }
  const scrollY = useRef(new RNAnimated.Value(0)).current;

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
      const [
        sharedPrompts,
        personalPrompts,
        sharedMemories,
        personalMemories,
        dateHistory,
        triedPositionHistory,
      ] = await Promise.all([
        safeLoad(() => DataLayer.getSharedPromptAnswers({ limit: 200 })),
        safeLoad(() => DataLayer.getPromptAnswers({ limit: 200 })),
        safeLoad(() => DataLayer.getSharedMemories({ limit: 200 })),
        safeLoad(() => DataLayer.getMemories({ limit: 200 })),
        safeLoad(() => getDateHistory(AsyncStorage)),
        safeLoad(() => getIntimacyTried()),
      ]);

      const promptItems = dedupeRows([...(sharedPrompts || []), ...(personalPrompts || [])])
        .map((row) => buildPromptItem(row));
      const memoryItems = await Promise.all(
        dedupeRows([...(sharedMemories || []), ...(personalMemories || [])])
          .map(async (row) => buildMemoryItem(row, await resolveRowMedia(row)))
      );
      const memoryIds = new Set(memoryItems.map((item) => item.sourceId).filter(Boolean));
      const dateItems = (dateHistory || [])
        .filter((row) => !row.memoryId || !memoryIds.has(row.memoryId))
        .map((row) => buildDateItem(row));
      const triedPositionItems = Object.values(triedPositionHistory || {})
        .filter((row) => row?.positionId)
        .filter((row) => !row.memoryId || !memoryIds.has(row.memoryId))
        .map((row) => buildPositionTriedItem(row));

      const merged = [
        ...promptItems,
        ...memoryItems,
        ...dateItems,
        ...triedPositionItems,
      ].sort((a, b) => getSortTime(b) - getSortTime(a));

      setEntries(merged);
    } catch (error) {
      if (__DEV__) console.warn('[OurStory] Load failed:', error?.message);
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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

  const onRefresh = useCallback(() => {
    selection();
    setRefreshing(true);
    loadEntries();
  }, [loadEntries]);

  const handleBack = useCallback(() => {
    impact(ImpactFeedbackStyle.Light);
    navigation.goBack();
  }, [navigation]);

  const openLightbox = useCallback((item) => {
    if (!item?.media?.uri) return;
    impact(ImpactFeedbackStyle.Medium);
    setLightbox(item);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightbox(null);
  }, []);

  // ─── RENDERERS ───
  const renderItem = ({ item, index }) => {
    const heartState = hearts[item.id] || { count: 0, hearted: false };
    const isVideo = item.media?.kind === 'video' || item.media?.mimeType?.startsWith('video/');

    return (
      <ReAnimated.View
        entering={FadeInDown.delay(index * 35).springify().damping(18)}
        style={styles.timelineRow}
      >
        {/* Timeline spine + dot */}
        <View style={styles.timelineSpine}>
          <View style={[styles.timelineDot, { backgroundColor: item.accent }]} />
          <View style={[styles.timelineLine, { backgroundColor: t.border }]} />
        </View>

        <View style={[styles.cardContainer, styles.cardTimeline]}>
          <View style={[styles.editorialCard, styles.editorialCardColumn, { backgroundColor: t.surface, borderColor: t.borderGlass, padding: 0 }, !isDark && styles.lightShadow]}>
            <View style={{ paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl, paddingTop: SPACING.xl, width: '100%' }}>
            <View style={styles.cardTopRow}>
              <View style={styles.cardEyebrowRow}>
                <Icon name={item.icon} size={14} color={item.accent} />
                <Text style={[styles.cardEyebrow, { color: item.accent }]}>{item.eyebrow}</Text>
              </View>
              <Text style={styles.dateLabel}>{item.dateLabel}</Text>
            </View>

            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.media?.uri ? (
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => openLightbox(item)}
                style={styles.mediaButton}
              >
                {isVideo ? (
                  <View style={[styles.videoPreview, { backgroundColor: withAlpha(item.accent, 0.1), borderColor: withAlpha(item.accent, 0.18) }]}>
                    <Icon name="play-circle-outline" size={34} color={item.accent} />
                    <Text style={[styles.videoPreviewText, { color: item.accent }]}>Video</Text>
                  </View>
                ) : (
                  <Image source={{ uri: item.media.uri }} style={styles.storyImage} resizeMode="cover" />
                )}
              </TouchableOpacity>
            ) : null}
            <Text style={styles.cardBody}>{item.body || 'Nothing saved yet.'}</Text>

            <View style={styles.cardFooter}>
              <Text style={[styles.cardMetaText, { color: t.subtext }]}>{item.meta}</Text>
              <View style={styles.cardFooterRight}>
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
          </View>
          </View>
        </View>
      </ReAnimated.View>
    );
  };

  const ListHeader = (
    <ReAnimated.View entering={FadeIn.duration(500)}>
      <View style={styles.headerIntroContainer}>
        <Text style={styles.headerIntro}>
          {entries.length ? `${entries.length} moments, newest first` : 'Newest first'}
        </Text>
      </View>
    </ReAnimated.View>
  );

  const EmptyState = (
    <ReAnimated.View entering={FadeIn.duration(450)} style={styles.emptyState}>
      <View style={[styles.emptyIconCircle, { borderColor: t.border, backgroundColor: t.surface }]}>
        <Icon name="archive-outline" size={42} color={t.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: t.text }]}>Your story begins here</Text>
      <Text style={styles.emptyBody}>
        Prompts, memories, photos, dates, and moments will collect here as you build your story together.
      </Text>
    </ReAnimated.View>
  );

  const LoadingState = (
    <View style={styles.loadingState}>
      <ActivityIndicator size="small" color={t.primary} />
      <Text style={styles.loadingText}>Gathering your story...</Text>
    </View>
  );

  return (
    <EditorialScreenScaffold
      navigation={navigation}
      headerTitle="Keepsake"
      headerSubtitle="OUR STORY"
      scroll={false}
      onBack={handleBack}
    >
        <RNAnimated.FlatList
          data={entries}
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

        {/* Camera FAB for adding photos/videos */}
        <TouchableOpacity
          style={styles.fabContainer}
          onPress={() => navigation.navigate('AddMemory', { autoLaunchCamera: true })}
          activeOpacity={0.85}
        >
          <BlurView intensity={70} tint={isDark ? 'dark' : 'light'} style={[styles.fabBlur, { backgroundColor: withAlpha(t.primary, 0.8) }]}>
            <Icon name="camera" size={26} color="#FFF" />
          </BlurView>
        </TouchableOpacity>

        <Modal
          visible={!!lightbox}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={closeLightbox}
        >
          <MediaLightbox item={lightbox} onClose={closeLightbox} showCloseButton={false} />
        </Modal>
    </EditorialScreenScaffold>
  );
}

// ─── HIGH-END DESIGN SYSTEM STYLES ───
const createStyles = (t, isDark) => StyleSheet.create({
  editorialCard: {
    borderRadius: 28,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  editorialCardColumn: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  lightShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
  },
  listContent: {
    paddingHorizontal: 0,
    paddingBottom: 160,
  },

  // ── Floating Action Button ──
  fabContainer: {
    position: 'absolute',
    right: SPACING.screen,
    bottom: 32,
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
  
  // ── Header Intro ──
  headerIntroContainer: {
    paddingHorizontal: SPACING.screen,
    paddingBottom: SPACING.md,
  },
  headerIntro: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: t.subtext,
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
  mediaButton: {
    width: '100%',
    marginBottom: SPACING.lg,
    borderRadius: 18,
    overflow: 'hidden',
  },
  storyImage: {
    width: '100%',
    height: 220,
    borderRadius: 18,
    backgroundColor: withAlpha(t.text, 0.06),
  },
  videoPreview: {
    height: 180,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  videoPreviewText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
  },
  cardMetaText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    flexShrink: 1,
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
