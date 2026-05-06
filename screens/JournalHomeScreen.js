import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useVideoPlayer, VideoView } from 'expo-video';
import Icon from '../components/Icon';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { DataLayer } from '../services/localfirst';
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';
import { SPACING, withAlpha } from '../utils/theme';
import EditorialScreenScaffold from '../components/EditorialScreenScaffold';
import { getMyDisplayName, getPartnerDisplayName } from '../utils/profileNames';

const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });
const SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif' });

function JournalVideoPreview({ uri, style }) {
  const player = useVideoPlayer(uri || null, (videoPlayer) => {
    videoPlayer.loop = false;
  });

  if (!uri) return null;

  return (
    <VideoView
      style={style}
      player={player}
      contentFit="contain"
      nativeControls={false}
      pointerEvents="none"
    />
  );
}

function toDate(value) {
  if (!value) return null;

  const date = typeof value === 'string' && value.length === 10
    ? new Date(`${value}T00:00:00`)
    : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTimeLabel(value) {
  const date = toDate(value);
  if (!date) return '';

  const datePart = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const timePart = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return `${datePart} · ${timePart}`;
}

function getSortTime(row) {
  const date = toDate(row?.created_at || row?.updated_at || row?.date);
  return date ? date.getTime() : 0;
}

function formatDateGroupLabel(value) {
  const date = toDate(value);
  if (!date) return 'Undated';

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getDateGroupKey(item) {
  const raw = item?.sortAt || item?.entry?.created_at || item?.entry?.updated_at || item?.entry?.date;
  const date = toDate(raw);
  if (!date) return 'undated';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function buildJournalItem(row, ownerIds, myName, partnerName, isLinked = true) {
  const isOwn = ownerIds.has(row.user_id) || ownerIds.has(row.created_by);
  const displayName = isOwn ? myName : partnerName;
  const eyebrowPrefix = isLinked ? 'SHARED BY' : 'SAVED BY';

  const preview = row.locked
    ? 'This entry is locked on this device.'
    : (row.body || row.content || '').trim();

  return {
    id: `journal:${row.id}`,
    title: row.locked ? 'Locked journal entry' : (row.title || 'Untitled reflection'),
    body: preview,
    eyebrow: isOwn
      ? `${eyebrowPrefix} ${String(displayName || 'YOU').toUpperCase()}`
      : `${eyebrowPrefix} ${String(displayName || 'PARTNER').toUpperCase()}`,
    icon: 'book-outline',
    accent: '#D2121A',
    dateTimeLabel: formatDateTimeLabel(row.created_at || row.updated_at || row.date),
    dateGroupLabel: formatDateGroupLabel(row.created_at || row.updated_at || row.date),
    sortAt: row.created_at || row.updated_at || row.date || null,
    photoUri: row.photo_uri || row.photoUri || row.imageUri || null,
    mediaUri: row.mediaUri || row.media_uri || row.photo_uri || row.photoUri || row.imageUri || null,
    mediaType:
      row.mediaType ||
      row.media_type ||
      (row.photo_uri || row.photoUri || row.imageUri ? 'image/jpeg' : null),
    mediaKind:
      row.mediaKind ||
      row.media_kind ||
      (row.mediaType?.startsWith('video/') || row.media_type?.startsWith('video/') ? 'video' : null) ||
      (row.photo_uri || row.photoUri || row.imageUri ? 'image' : null),
    entry: row,
    canEdit: isOwn,
  };
}

export function buildDateGroupedJournalList(entries = []) {
  const rows = [];
  let currentGroupKey = null;

  for (const entry of entries || []) {
    const groupKey = getDateGroupKey(entry);

    if (groupKey !== currentGroupKey) {
      currentGroupKey = groupKey;
      rows.push({
        id: `date-header:${groupKey}`,
        kind: 'date_header',
        title: entry?.dateGroupLabel || formatDateGroupLabel(entry?.sortAt),
        sortAt: entry?.sortAt || null,
      });
    }

    rows.push(entry);
  }

  return rows;
}

export default function JournalHomeScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { user, userProfile } = useAuth();
  const { state } = useAppContext();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isLinked = !!(state?.coupleId || state?.isLinked);

  const myName = useMemo(
    () => getMyDisplayName(userProfile, state?.userProfile, user?.displayName || 'You') || 'You',
    [state?.userProfile, user?.displayName, userProfile]
  );

  const partnerName = useMemo(
    () => getPartnerDisplayName(userProfile, state?.userProfile, 'your partner') || 'your partner',
    [state?.userProfile, userProfile]
  );

  const ownerIds = useMemo(
    () => new Set([user?.id, user?.uid, state?.userId].filter(Boolean)),
    [state?.userId, user?.id, user?.uid]
  );

  const t = useMemo(() => ({
    background: colors.background,
    surface: colors.surface,
    surfaceSecondary: colors.surface2 || (isDark ? '#1C1C1E' : '#F2F2F7'),
    primary: colors.primary || '#D2121A',
    accent: colors.accent || '#D4AA7E',
    text: colors.text,
    subtext: colors.textMuted || (isDark ? 'rgba(255,255,255,0.55)' : 'rgba(60,60,67,0.6)'),
    border: colors.border || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
    borderGlass: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  const groupedEntries = useMemo(
    () => buildDateGroupedJournalList(entries),
    [entries]
  );

  const loadEntries = useCallback(async () => {
    try {
      const sharedRows = await DataLayer.getJournalEntries({
        limit: 500,
        visibility: 'shared',
      });

      const sharedEntries = (sharedRows || [])
        .filter((row) => row && row.id)
        .filter((row) => (
          row.visibility === 'shared'
          || row.is_private === false
          || row.isPrivate === false
          || row.shared === true
          || row.visibility == null
        ))
        .sort((a, b) => getSortTime(b) - getSortTime(a))
        .map((row) => buildJournalItem(row, ownerIds, myName, partnerName, isLinked));

      setEntries(sharedEntries);
    } catch (error) {
      if (__DEV__) console.warn('[JournalHome] Load failed:', error?.message);
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLinked, myName, ownerIds, partnerName]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadEntries();
    }, [loadEntries])
  );

  const onRefresh = useCallback(() => {
    selection();
    setRefreshing(true);
    loadEntries();
  }, [loadEntries]);

  const handleCreate = useCallback(() => {
    impact(ImpactFeedbackStyle.Light);
    navigation.navigate('JournalEntry');
  }, [navigation]);

  const handleBack = useCallback(() => {
    impact(ImpactFeedbackStyle.Light);
    navigation.goBack();
  }, [navigation]);

  const handleEditEntry = useCallback((item) => {
    impact(ImpactFeedbackStyle.Light);
    navigation.navigate('JournalEntry', {
      entry: item.entry,
      readOnly: false,
    });
  }, [navigation]);

  const handleDeleteEntry = useCallback((item) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this journal entry? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              impact(ImpactFeedbackStyle.Medium);
              await DataLayer.deleteJournalEntry(item.entry.id);
              await loadEntries();
            } catch (_error) {
              Alert.alert('Error', 'Failed to delete entry. Please try again.');
            }
          },
        },
      ]
    );
  }, [loadEntries]);

  const renderItem = ({ item, index }) => {
    if (item.kind === 'date_header') {
      return (
        <View style={styles.dateHeaderRow}>
          <Text style={[styles.dateHeaderText, { color: t.text }]}>
            {item.title}
          </Text>
        </View>
      );
    }

    return (
    <Animated.View entering={FadeInDown.delay(index * 35).springify().damping(18)}>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => navigation.navigate('JournalEntry', {
          entry: item.entry,
          readOnly: !item.canEdit,
        })}
        style={styles.cardContainer}
        accessibilityLabel={item.title || 'Journal entry'}
        accessibilityRole="button"
        accessibilityHint={item.canEdit ? 'Double tap to edit' : 'Double tap to read more'}
      >
        <View
          style={[
            styles.editorialCard,
            styles.editorialCardColumn,
            { backgroundColor: t.surface, borderColor: t.borderGlass },
            !isDark && styles.lightShadow,
          ]}
        >
          <View style={styles.cardContent}>
            <View style={styles.eyebrowRow}>
              <Icon name={item.icon} size={14} color={item.accent} />
              <Text
                style={[styles.eyebrow, { color: t.primary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.78}
              >
                {item.eyebrow}
              </Text>
            </View>

            <Text style={styles.cardTitle}>{item.title}</Text>

            {item.mediaUri && item.mediaKind === 'video' ? (
              <View style={styles.journalMediaFrame}>
                <JournalVideoPreview
                  uri={item.mediaUri}
                  style={styles.journalThumbnail}
                />
                <View pointerEvents="none" style={styles.mediaIndicatorOverlay}>
                  <Icon name="videocam-outline" size={14} color="#FFF" />
                  <Text style={styles.mediaIndicatorText}>
                    Video attached
                  </Text>
                </View>
              </View>
            ) : null}

            {item.mediaUri && item.mediaKind !== 'video' ? (
              <View style={styles.journalMediaFrame}>
                <Image
                  source={{ uri: item.mediaUri }}
                  style={styles.journalThumbnail}
                  resizeMode="contain"
                />
              </View>
            ) : null}
          </View>

          <View style={styles.cardLowerContent}>
            <Text style={styles.cardBody} numberOfLines={4}>
              {item.body || 'Nothing saved yet.'}
            </Text>

            <View style={styles.cardFooter}>
              <Text style={styles.cardTimestamp} numberOfLines={1}>
                {item.dateTimeLabel}
              </Text>

              {item.canEdit ? (
                <View style={styles.entryActionsRow}>
                  <TouchableOpacity
                    style={[styles.entryActionButton, { borderColor: t.border }]}
                    onPress={() => handleEditEntry(item)}
                    activeOpacity={0.75}
                    accessibilityLabel={`Edit ${item.title || 'journal entry'}`}
                    accessibilityRole="button"
                  >
                    <Icon name="create-outline" size={16} color={t.text} />
                    <Text style={[styles.entryActionText, { color: t.text }]}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.entryActionIconButton, { borderColor: t.border }]}
                    onPress={() => handleDeleteEntry(item)}
                    activeOpacity={0.75}
                    accessibilityLabel={`Delete ${item.title || 'journal entry'}`}
                    accessibilityRole="button"
                  >
                    <Icon name="trash-outline" size={17} color="#D2121A" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[styles.downArrowButton, { borderColor: t.border }]}>
                  <Icon name="chevron-down-outline" size={18} color={t.text} />
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
    );
  };

  const EmptyState = (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconCircle}>
        <Icon name={isLinked ? 'people-outline' : 'book-outline'} size={42} color={t.primary} />
      </View>

      <Text style={styles.emptyTitle}>{isLinked ? 'No shared entries yet' : 'No journal entries yet'}</Text>

      <TouchableOpacity
        style={[styles.emptyButton, { backgroundColor: t.primary }]}
        activeOpacity={0.85}
        onPress={handleCreate}
        accessibilityLabel={isLinked ? 'Write shared entry' : 'Write journal entry'}
        accessibilityRole="button"
      >
        <Text style={styles.emptyButtonText}>{isLinked ? 'Write Shared Entry' : 'Write Entry'}</Text>
      </TouchableOpacity>
    </View>
  );

  const LoadingState = (
    <View style={styles.loadingState}>
      <ActivityIndicator size="small" color={t.primary} />
      <Text style={[styles.loadingText, { color: t.subtext }]}>
        {isLinked ? 'Loading your shared journal...' : 'Loading your journal...'}
      </Text>
    </View>
  );

  return (
    <EditorialScreenScaffold
      navigation={navigation}
      headerTitle="Journal"
      headerSubtitle={isLinked ? 'SHARED NOTES' : 'YOUR NOTES'}
      scroll={false}
      onBack={handleBack}
    >
      <FlatList
        data={groupedEntries}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={loading ? LoadingState : EmptyState}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
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
        onPress={handleCreate}
        activeOpacity={0.85}
        accessibilityLabel={isLinked ? 'New shared entry' : 'New journal entry'}
        accessibilityRole="button"
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
    </EditorialScreenScaffold>
  );
}

const createStyles = (t, isDark) => StyleSheet.create({
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
  cardContainer: {
    paddingHorizontal: 0,
    marginVertical: SPACING.md,
  },
  dateHeaderRow: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  dateHeaderText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
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
  cardContent: {
    width: '100%',
  },
  journalMediaFrame: {
    width: '100%',
    borderRadius: 18,
    marginTop: SPACING.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  journalThumbnail: {
    width: '100%',
    height: 190,
  },
  mediaIndicatorOverlay: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  mediaIndicatorText: {
    fontSize: 12,
    fontFamily: SYSTEM_FONT,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: '#FFF',
  },
  cardLowerContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
    width: '100%',
  },
  lightShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
  },

  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.md,
    minWidth: 0,
  },
  eyebrow: {
    flexShrink: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontFamily: SERIF_FONT,
    color: t.text,
    fontSize: 26,
    lineHeight: 32,
    marginBottom: SPACING.sm,
  },
  cardBody: {
    fontFamily: SYSTEM_FONT,
    color: t.subtext,
    fontSize: 15,
    lineHeight: 22,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.lg,
    gap: 12,
  },
  cardTimestamp: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
    color: t.subtext,
    opacity: 0.72,
  },
  entryActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  entryActionButton: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: withAlpha(t.text, isDark ? 0.04 : 0.03),
  },
  entryActionIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha('#D2121A', 0.08),
  },
  entryActionText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '800',
  },
  downArrowButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: withAlpha(t.text, isDark ? 0.04 : 0.03),
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: SPACING.xl,
  },
  emptyIconCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(210,18,26,0.08)',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontFamily: SERIF_FONT,
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
    color: t.text,
    marginBottom: SPACING.sm,
  },
  emptyBody: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: t.subtext,
    marginBottom: SPACING.lg,
  },
  emptyButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  emptyButtonText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  loadingText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '500',
  },
});
