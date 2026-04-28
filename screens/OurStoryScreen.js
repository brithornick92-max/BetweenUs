// screens/OurStoryScreen.js
/**
 * BETWEEN US - KEEPSAKE / OUR STORY
 * Premium grouped Snapshot cards + timeline moments.
 * Long press a Keepsake card to edit or delete.
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
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ReAnimated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

import Icon from '../components/Icon';
import { useTheme } from '../context/ThemeContext';
import { DataLayer } from '../services/localfirst';
import AttachmentCacheService from '../services/AttachmentCacheService';
import { getPromptById } from '../utils/contentLoader';
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';
import { SPACING, withAlpha } from '../utils/theme';
import { storage } from '../utils/storage';
import EditorialScreenScaffold from '../components/EditorialScreenScaffold';
import MediaLightbox from '../components/MediaLightbox';
import { getDateHistory } from '../utils/dateHistory';
import { getIntimacyTried } from '../utils/intimacyFavorites';
import { NicknameEngine } from '../services/PolishEngine';

const HEARTS_KEY = '@betweenus:cache:momentHearts';

const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });
const SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif' });

const MEMORY_TYPE_META = {
  snapshot: { label: 'Snapshot', icon: 'images-outline' },
  moment: { label: 'Saved Moment', icon: 'sparkles-outline' },
  anniversary: { label: 'Anniversary', icon: 'heart-outline' },
  milestone: { label: 'Milestone', icon: 'ribbon-outline' },
  intimacy_favorite: { label: 'Intimacy Favorite', icon: 'heart-outline' },
  intimacy_tried: { label: 'Position Tried', icon: 'checkmark-circle-outline' },
  date_tried: { label: 'Date Tried', icon: 'calendar-outline' },
  memory: { label: 'Memory', icon: 'time-outline' },
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

function getSnapshotGroupId(row) {
  return row?.snapshot_id || null;
}

function getSnapshotIndex(row) {
  const index = row?.snapshot_index ?? 0;
  return Number.isFinite(Number(index)) ? Number(index) : 0;
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
    const uri = await AttachmentCacheService.getCachedUri(mediaRef);
    if (!uri) return null;
    const mimeType = directMimeType || 'image/jpeg';

    return {
      uri,
      mimeType,
      kind: getMediaKind(mimeType, uri),
    };
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

  const answers = [];
  if (row.locked) {
    // No structured answers for locked items.
  } else if (row.is_revealed && row.partnerAnswer) {
    if (row.answer) {
      answers.push({ name: myName, text: row.answer });
    }
    answers.push({ name: partnerName, text: row.partnerAnswer });
  } else if (row.answer) {
    answers.push({ name: myName, text: row.answer });
  }

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
    answers,
    eyebrow: row.is_revealed ? 'Prompt' : 'Sealed prompt',
    icon: row.is_revealed ? 'chatbubbles-outline' : 'lock-closed-outline',
    accent: '#D2121A',
    meta: row.heat_level ? `Heat ${row.heat_level}` : 'Prompt',
    dateLabel: formatDateLabel(row.date_key || row.created_at),
    sortAt: row.created_at || row.date_key,
    media,
    editable: false,
    deletable: false,
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
    meta: isIntimacyFavorite ? 'Shared intimacy' : (row.mood ? String(row.mood).toUpperCase() : memoryType.label),
    dateLabel: formatDateLabel(row.created_at || row.date),
    sortAt: row.snapshot_created_at || row.created_at || row.date,
    mediaRef: row.media_ref || null,
    mimeType: row.mime_type || null,
    rawDate: row.created_at || row.date || null,
    snapshotGroupId: getSnapshotGroupId(row),
    snapshotIndex: getSnapshotIndex(row),
    media,
    row,
    editable: true,
    deletable: true,
  };
}

function buildSnapshotItem(groupId, items) {
  const sortedItems = [...items].sort((a, b) => a.snapshotIndex - b.snapshotIndex);
  const first = sortedItems[0];
  const body = first?.body || '';

  const mediaItems = sortedItems
    .filter((item) => item.media?.uri)
    .map((item, index) => ({
      id: `${item.id}:media:${index}`,
      uri: item.media.uri,
      mimeType: item.media.mimeType,
      mime: item.media.mimeType,
      kind: item.media.kind,
      media: item.media,
      caption: body,
      body,
      title: 'Snapshot',
      date: item.rawDate || item.sortAt,
      dateLabel: item.dateLabel,
      sourceItem: item,
    }));

  return {
    id: `snapshot:${groupId}`,
    kind: 'snapshot',
    sourceId: groupId,
    title: 'Snapshot',
    body,
    eyebrow: 'Snapshot',
    icon: 'images-outline',
    accent: '#FFD60A',
    meta: mediaItems.length === 1 ? '1 item' : `${mediaItems.length} items`,
    dateLabel: first?.dateLabel || '',
    sortAt: first?.sortAt || null,
    mediaItems,
    rawItems: sortedItems,
    editable: true,
    deletable: true,
  };
}

function groupMemoryItems(memoryItems) {
  const grouped = new Map();
  const standalone = [];

  for (const item of memoryItems || []) {
    if (item.snapshotGroupId) {
      if (!grouped.has(item.snapshotGroupId)) {
        grouped.set(item.snapshotGroupId, []);
      }

      grouped.get(item.snapshotGroupId).push(item);
      continue;
    }

    const isLegacyUngroupedSnapshot =
      item.row?.type === 'snapshot'
      || item.title === 'Snapshot'
      || item.kind === 'snapshot';

    if (isLegacyUngroupedSnapshot) {
      // Old Snapshot rows created before snapshot_id existed.
      // Hide them so they do not appear as separate broken Keepsake cards.
      continue;
    }

    standalone.push(item);
  }

  const snapshots = Array.from(grouped.entries()).map(([groupId, items]) =>
    buildSnapshotItem(groupId, items)
  );

  return [...snapshots, ...standalone];
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
    editable: false,
    deletable: false,
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
    accent: '#D2121A',
    meta: row.mood ? String(row.mood).toUpperCase() : 'Intimacy',
    dateLabel: formatDateLabel(row.triedAt),
    sortAt: row.triedAt,
    memoryId: row.memoryId || null,
    editable: false,
    deletable: false,
  };
}

export default function OurStoryScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [hearts, setHearts] = useState({});
  const scrollY = useRef(new RNAnimated.Value(0)).current;

  const t = useMemo(() => ({
    background: colors.background,
    surface: isDark ? 'rgba(28, 28, 30, 0.45)' : 'rgba(255, 255, 255, 0.65)',
    surfaceSecondary: isDark ? 'rgba(44, 44, 46, 0.8)' : 'rgba(242, 242, 247, 0.8)',
    primary: colors.primary || '#D2121A',
    accent: colors.accent || '#D4AA7E',
    text: colors.text,
    subtext: colors.textMuted || (isDark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.6)'),
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    borderGlass: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  const loadEntries = useCallback(async () => {
    try {
      const [
        sharedPrompts,
        personalPrompts,
        sharedMemories,
        personalMemories,
        dateHistory,
        triedPositionHistory,
        myName,
        partnerName,
      ] = await Promise.all([
        safeLoad(() => DataLayer.getSharedPromptAnswers({ limit: 200 })),
        safeLoad(() => DataLayer.getPromptAnswers({ limit: 200 })),
        safeLoad(() => DataLayer.getSharedMemories({ limit: 500 })),
        safeLoad(() => DataLayer.getMemories({ limit: 500 })),
        safeLoad(() => getDateHistory()),
        safeLoad(() => getIntimacyTried()),
        NicknameEngine.getMyName('You'),
        NicknameEngine.getPartnerName('Partner'),
      ]);

      const promptItems = dedupeRows([...(sharedPrompts || []), ...(personalPrompts || [])])
        .map((row) => buildPromptItem(row, null, myName, partnerName));

      const rawMemoryItems = await Promise.all(
        dedupeRows([...(sharedMemories || []), ...(personalMemories || [])])
          .map(async (row) => buildMemoryItem(row, await resolveRowMedia(row)))
      );

      const memoryItems = groupMemoryItems(rawMemoryItems);

      const memoryIds = new Set(
        rawMemoryItems
          .map((item) => item.sourceId)
          .filter(Boolean)
      );

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
      ].sort((a, b) => {
        // Show grouped Snapshots first so new uploads do not get buried under old legacy moments.
        if (a.kind === 'snapshot' && b.kind !== 'snapshot') return -1;
        if (a.kind !== 'snapshot' && b.kind === 'snapshot') return 1;

        return getSortTime(b) - getSortTime(a);
      });

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

  useEffect(() => {
    storage.get(HEARTS_KEY, {}).then((saved) => {
      if (saved && typeof saved === 'object') {
        setHearts(saved);
      }
    });
  }, []);

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

  const normalizeLightboxItem = useCallback((item) => {
    if (!item) return null;

    if (item.uri) {
      return item;
    }

    if (item.media?.uri) {
      return {
        ...item,
        uri: item.media.uri,
        mimeType: item.media.mimeType,
        mime: item.media.mimeType,
        kind: item.media.kind,
      };
    }

    return null;
  }, []);

  const openLightbox = useCallback((item, allItems = null, startIndex = 0) => {
    const normalizedItems = Array.isArray(allItems) && allItems.length > 0
      ? allItems.map(normalizeLightboxItem).filter(Boolean)
      : [normalizeLightboxItem(item)].filter(Boolean);

    if (normalizedItems.length === 0) return;

    const safeIndex = Math.min(
      Math.max(Number(startIndex) || 0, 0),
      normalizedItems.length - 1
    );

    impact(ImpactFeedbackStyle.Medium);

    setLightbox({
      items: normalizedItems,
      index: safeIndex,
    });
  }, [normalizeLightboxItem]);

  const closeLightbox = useCallback(() => {
    setLightbox(null);
  }, []);

  const goToPreviousLightboxItem = useCallback(() => {
    setLightbox((current) => {
      if (!current?.items?.length) return current;

      const nextIndex = current.index <= 0
        ? current.items.length - 1
        : current.index - 1;

      return {
        ...current,
        index: nextIndex,
      };
    });
  }, []);

  const goToNextLightboxItem = useCallback(() => {
    setLightbox((current) => {
      if (!current?.items?.length) return current;

      const nextIndex = current.index >= current.items.length - 1
        ? 0
        : current.index + 1;

      return {
        ...current,
        index: nextIndex,
      };
    });
  }, []);

  const confirmDeleteItem = useCallback((item) => {
    const isSnapshot = item.kind === 'snapshot';

    Alert.alert(
      isSnapshot ? 'Delete Snapshot?' : 'Delete Memory?',
      isSnapshot
        ? 'This will remove all photos and videos in this snapshot from Keepsake.'
        : 'This will remove this memory from Keepsake.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              impact(ImpactFeedbackStyle.Medium);

              if (isSnapshot) {
                await Promise.all(
                  (item.rawItems || [])
                    .filter((rawItem) => rawItem?.sourceId)
                    .map((rawItem) => DataLayer.deleteMemory(rawItem.sourceId))
                );
              } else {
                await DataLayer.deleteMemory(item.sourceId);
              }

              await loadEntries();
            } catch (error) {
              if (__DEV__) console.warn('[OurStory] Delete failed:', error?.message);
              Alert.alert('Could not delete', 'Please try again.');
            }
          },
        },
      ]
    );
  }, [loadEntries]);

  const handleEditItem = useCallback((item) => {
    if (!item?.editable) return;

    impact(ImpactFeedbackStyle.Light);

    navigation.navigate('AddMemory', {
      mode: 'edit',
      editItem: item,
      editKind: item.kind,
      sourceId: item.sourceId,
    });
  }, [navigation]);

  const handleLongPressItem = useCallback((item) => {
    if (!item?.editable && !item?.deletable) return;

    impact(ImpactFeedbackStyle.Medium);

    const isSnapshot = item.kind === 'snapshot';

    Alert.alert(
      isSnapshot ? 'Snapshot Options' : 'Keepsake Options',
      null,
      [
        item.editable ? {
          text: isSnapshot ? 'Edit Snapshot' : 'Edit Memory',
          onPress: () => handleEditItem(item),
        } : null,
        item.deletable ? {
          text: isSnapshot ? 'Delete Snapshot' : 'Delete Memory',
          style: 'destructive',
          onPress: () => confirmDeleteItem(item),
        } : null,
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ].filter(Boolean)
    );
  }, [confirmDeleteItem, handleEditItem]);

  const renderSnapshotTile = (media, index, mediaItems, tileStyle, options = {}) => {
    const isVideo = media.kind === 'video' || media.mimeType?.startsWith('video/');
    const hasMoreOverlay = options.remaining > 0;

    return (
      <TouchableOpacity
        key={media.id}
        activeOpacity={0.9}
        onPress={() => openLightbox(media, mediaItems, index)}
        style={[styles.snapshotGridTile, tileStyle]}
      >
        {isVideo ? (
          <View style={styles.snapshotVideoTile}>
            <Icon
              name="play-circle-outline"
              size={options.small ? 30 : 46}
              color="#FFF"
            />
            {!options.small ? (
              <Text style={styles.snapshotVideoText}>Video</Text>
            ) : null}
          </View>
        ) : (
          <Image
            source={{ uri: media.uri }}
            style={styles.snapshotImage}
            resizeMode="cover"
          />
        )}

        {hasMoreOverlay ? (
          <View pointerEvents="none" style={styles.remainingOverlay}>
            <Text style={styles.remainingText}>+{options.remaining}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderSnapshotGrid = (item) => {
    const mediaItems = item.mediaItems || [];
    const count = mediaItems.length;

    if (count === 0) return null;

    if (count === 1) {
      return (
        <View style={styles.snapshotMediaBlock}>
          <View style={[styles.facebookGrid, styles.facebookGridSingle]}>
            {renderSnapshotTile(mediaItems[0], 0, mediaItems, styles.singleTile)}
          </View>
        </View>
      );
    }

    if (count === 2) {
      return (
        <View style={styles.snapshotMediaBlock}>
          <View style={[styles.facebookGrid, styles.facebookGridTwo]}>
            {renderSnapshotTile(mediaItems[0], 0, mediaItems, styles.twoTile)}
            {renderSnapshotTile(mediaItems[1], 1, mediaItems, styles.twoTile)}
          </View>
        </View>
      );
    }

    if (count === 3) {
      return (
        <View style={styles.snapshotMediaBlock}>
          <View style={[styles.facebookGrid, styles.facebookGridThree]}>
            {renderSnapshotTile(mediaItems[0], 0, mediaItems, styles.threeLargeTile)}
            <View style={styles.threeSideStack}>
              {renderSnapshotTile(mediaItems[1], 1, mediaItems, styles.threeSmallTile, { small: true })}
              {renderSnapshotTile(mediaItems[2], 2, mediaItems, styles.threeSmallTile, { small: true })}
            </View>
          </View>
        </View>
      );
    }

    const remaining = Math.max(0, count - 4);

    return (
      <View style={styles.snapshotMediaBlock}>
        <View style={[styles.facebookGrid, styles.facebookGridFour]}>
          <View style={styles.facebookGridRow}>
            {renderSnapshotTile(mediaItems[0], 0, mediaItems, styles.fourTile, { small: true })}
            {renderSnapshotTile(mediaItems[1], 1, mediaItems, styles.fourTile, { small: true })}
          </View>

          <View style={styles.facebookGridRow}>
            {renderSnapshotTile(mediaItems[2], 2, mediaItems, styles.fourTile, { small: true })}
            {renderSnapshotTile(mediaItems[3], 3, mediaItems, styles.fourTile, {
              small: true,
              remaining,
            })}
          </View>
        </View>
      </View>
    );
  };

  const renderItem = ({ item, index }) => {
    const heartState = hearts[item.id] || { count: 0, hearted: false };
    const isSnapshot = item.kind === 'snapshot';
    const isVideo = item.media?.kind === 'video' || item.media?.mimeType?.startsWith('video/');

    return (
      <ReAnimated.View
        entering={FadeInDown.delay(index * 35).springify().damping(18)}
        style={styles.timelineRow}
      >
        <View style={styles.timelineSpine}>
          <View style={[styles.timelineDot, { backgroundColor: item.accent }]} />
          <View style={[styles.timelineLine, { backgroundColor: t.border }]} />
        </View>

        <TouchableOpacity
          activeOpacity={0.96}
          delayLongPress={360}
          onLongPress={() => handleLongPressItem(item)}
          style={[styles.cardContainer, styles.cardTimeline]}
        >
          <View
            style={[
              styles.editorialCard,
              styles.editorialCardColumn,
              {
                backgroundColor: t.surface,
                borderColor: t.borderGlass,
                padding: 0,
              },
              !isDark && styles.lightShadow,
            ]}
          >
            <View style={styles.cardInner}>
              <View style={styles.cardTopRow}>
                <View style={styles.cardEyebrowRow}>
                  <Icon name={item.icon} size={14} color={item.accent} />
                  <Text
                    style={[styles.cardEyebrow, { color: item.accent }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.78}
                  >
                    {item.eyebrow}
                  </Text>
                </View>

                <Text style={styles.dateLabel} numberOfLines={1}>
                  {item.dateLabel}
                </Text>
              </View>

              <Text style={styles.cardTitle}>
                {item.title}
              </Text>

              {isSnapshot ? (
                renderSnapshotGrid(item)
              ) : item.media?.uri ? (
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => openLightbox(item)}
                  style={styles.mediaButton}
                >
                  {isVideo ? (
                    <View
                      style={[
                        styles.videoPreview,
                        {
                          backgroundColor: withAlpha(item.accent, 0.1),
                          borderColor: withAlpha(item.accent, 0.18),
                        },
                      ]}
                    >
                      <Icon name="play-circle-outline" size={34} color={item.accent} />
                      <Text style={[styles.videoPreviewText, { color: item.accent }]}>
                        Video
                      </Text>
                    </View>
                  ) : (
                    <Image
                      source={{ uri: item.media.uri }}
                      style={styles.storyImage}
                      resizeMode="cover"
                    />
                  )}
                </TouchableOpacity>
              ) : null}

              {item.answers && item.answers.length > 0 ? (
                <View style={[styles.answersContainer, isSnapshot && styles.snapshotBody]}>
                  {item.answers.map((answer, idx) => (
                    <View key={`${item.id}:answer:${idx}`} style={idx > 0 ? styles.answerSpacing : undefined}>
                      <Text style={styles.cardBody}>
                        <Text style={styles.answerName}>{answer.name}: </Text>
                        {answer.text}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : item.body ? (
                <Text style={[styles.cardBody, isSnapshot && styles.snapshotBody]}>
                  {item.body}
                </Text>
              ) : null}

              <View style={styles.cardFooter}>
                {isSnapshot ? (
                  <Text style={[styles.cardMetaText, { color: t.subtext }]} numberOfLines={1}>
                    {item.meta}
                  </Text>
                ) : (
                  <View style={styles.cardMetaSpacer} />
                )}

                <View style={styles.cardFooterRight}>
                  {item.editable || item.deletable ? (
                    <Text style={[styles.longPressHint, { color: t.subtext }]}>
                      Hold for options
                    </Text>
                  ) : null}

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
                      <Text
                        style={[
                          styles.heartCount,
                          { color: heartState.hearted ? t.primary : t.subtext },
                        ]}
                      >
                        {heartState.count}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </ReAnimated.View>
    );
  };

  const currentLightboxItem = lightbox?.items?.[lightbox.index] || null;
  const lightboxTotal = lightbox?.items?.length || 0;
  const lightboxPosition = lightbox ? lightbox.index + 1 : 0;

  const ListHeader = (
    <ReAnimated.View entering={FadeIn.duration(500)}>
      <View style={styles.headerIntroContainer}>
        <Text style={styles.headerIntro}>
          {entries.length ? `${entries.length} keepsakes, newest first` : 'Newest first'}
        </Text>
      </View>
    </ReAnimated.View>
  );

  const EmptyState = (
    <ReAnimated.View entering={FadeIn.duration(450)} style={styles.emptyState}>
      <View style={[styles.emptyIconCircle, { borderColor: t.border, backgroundColor: t.surface }]}>
        <Icon name="archive-outline" size={42} color={t.primary} />
      </View>

      <Text style={[styles.emptyTitle, { color: t.text }]}>
        Your story begins here
      </Text>

      <Text style={styles.emptyBody}>
        Prompts, snapshots, dates, and memories will collect here as you build your story together.
      </Text>
    </ReAnimated.View>
  );

  const LoadingState = (
    <View style={styles.loadingState}>
      <ActivityIndicator size="small" color={t.primary} />
      <Text style={styles.loadingText}>
        Gathering your story...
      </Text>
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
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={t.primary}
          />
        )}
      />

      <TouchableOpacity
        style={styles.fabContainer}
        onPress={() => navigation.navigate('AddMemory')}
        activeOpacity={0.85}
      >
        <BlurView
          intensity={70}
          tint={isDark ? 'dark' : 'light'}
          style={[
            styles.fabBlur,
            { backgroundColor: withAlpha(t.primary, 0.8) },
          ]}
        >
          <Icon name="add-outline" size={28} color="#FFF" />
        </BlurView>
      </TouchableOpacity>

      <Modal
        visible={!!currentLightboxItem}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeLightbox}
      >
        <View style={styles.lightboxShell}>
          <MediaLightbox
            item={currentLightboxItem}
            onClose={closeLightbox}
            showCloseButton
          />

          {lightboxTotal > 1 ? (
            <>
              <View pointerEvents="none" style={styles.lightboxCounter}>
                <BlurView intensity={55} tint="dark" style={styles.lightboxCounterPill}>
                  <Text style={styles.lightboxCounterText}>
                    {lightboxPosition} of {lightboxTotal}
                  </Text>
                </BlurView>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={goToPreviousLightboxItem}
                style={[styles.lightboxNavButton, styles.lightboxNavLeft]}
              >
                <BlurView intensity={55} tint="dark" style={styles.lightboxNavBlur}>
                  <Icon name="chevron-back-outline" size={28} color="#FFF" />
                </BlurView>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={goToNextLightboxItem}
                style={[styles.lightboxNavButton, styles.lightboxNavRight]}
              >
                <BlurView intensity={55} tint="dark" style={styles.lightboxNavBlur}>
                  <Icon name="chevron-forward-outline" size={28} color="#FFF" />
                </BlurView>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </Modal>
    </EditorialScreenScaffold>
  );
}

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

  fabContainer: {
    position: 'absolute',
    right: SPACING.screen,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    ...Platform.select({
      ios: {
        shadowColor: t.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
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

  cardContainer: {
    borderRadius: 24,
    marginBottom: SPACING.lg,
  },
  cardInner: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
    paddingTop: SPACING.xl,
    width: '100%',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: SPACING.md,
  },
  cardEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  cardEyebrow: {
    flexShrink: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  dateLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '600',
    color: t.subtext,
    flexShrink: 0,
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
    color: t.subtext,
  },
  answersContainer: {
    gap: 0,
  },
  answerSpacing: {
    marginTop: SPACING.md,
  },
  answerName: {
    fontFamily: SYSTEM_FONT,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  snapshotBody: {
    marginTop: SPACING.lg,
    color: t.text,
  },

  snapshotMediaBlock: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    width: '100%',
  },

  facebookGrid: {
    width: '100%',
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  facebookGridSingle: {
    height: 320,
  },
  facebookGridTwo: {
    height: 292,
    flexDirection: 'row',
    gap: 3,
  },
  facebookGridThree: {
    height: 292,
    flexDirection: 'row',
    gap: 3,
  },
  facebookGridFour: {
    height: 292,
    gap: 3,
  },
  facebookGridRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
  },
  snapshotGridTile: {
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  singleTile: {
    width: '100%',
    height: '100%',
  },
  twoTile: {
    flex: 1,
    height: '100%',
  },
  threeLargeTile: {
    flex: 1.15,
    height: '100%',
  },
  threeSideStack: {
    flex: 0.85,
    height: '100%',
    gap: 3,
  },
  threeSmallTile: {
    flex: 1,
    width: '100%',
  },
  fourTile: {
    flex: 1,
    height: '100%',
  },
  snapshotImage: {
    width: '100%',
    height: '100%',
  },
  snapshotVideoTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.54)',
    gap: 8,
  },
  snapshotVideoText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#FFF',
  },
  remainingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  remainingText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 30,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.8,
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
    gap: 12,
  },
  cardMetaText: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },

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

  cardFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  longPressHint: {
    fontFamily: SYSTEM_FONT,
    fontSize: 10,
    fontWeight: '700',
    opacity: 0.55,
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

  lightboxShell: {
    flex: 1,
    backgroundColor: '#000',
  },
  lightboxCounter: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 58 : 32,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  lightboxCounterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  lightboxCounterText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  lightboxNavButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  lightboxNavLeft: {
    left: 16,
  },
  lightboxNavRight: {
    right: 16,
  },
  lightboxNavBlur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});
