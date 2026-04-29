import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Icon from '../components/Icon';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { DataLayer } from '../services/localfirst';
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';
import { SPACING, withAlpha } from '../utils/theme';
import { storage } from '../utils/storage';
import EditorialScreenScaffold from '../components/EditorialScreenScaffold';
import { getMyDisplayName, getPartnerDisplayName } from '../utils/profileNames';

const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });
const SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif' });
const SHARED_JOURNAL_NOTICE_KEY = '@betweenus:cache:sharedJournalNoticeDismissed';

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

function buildJournalItem(row, ownerIds, myName, partnerName) {
  const isOwn = ownerIds.has(row.user_id) || ownerIds.has(row.created_by);
  const displayName = isOwn ? myName : partnerName;

  const preview = row.locked
    ? 'This entry is locked on this device.'
    : (row.body || row.content || '').trim();

  return {
    id: `journal:${row.id}`,
    title: row.locked ? 'Locked journal entry' : (row.title || 'Untitled reflection'),
    body: preview,
    eyebrow: isOwn
      ? `SHARED BY ${String(displayName || 'YOU').toUpperCase()}`
      : `SHARED BY ${String(displayName || 'PARTNER').toUpperCase()}`,
    icon: 'book-outline',
    accent: '#D2121A',
    dateTimeLabel: formatDateTimeLabel(row.created_at || row.updated_at || row.date),
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

export default function JournalHomeScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { user, userProfile } = useAuth();
  const { state } = useAppContext();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSharedNotice, setShowSharedNotice] = useState(false);

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

  useEffect(() => {
    let active = true;

    const loadNoticeState = async () => {
      try {
        const dismissed = await storage.get(SHARED_JOURNAL_NOTICE_KEY, false);
        if (active && !dismissed) {
          setShowSharedNotice(true);
        }
      } catch {
        if (active) {
          setShowSharedNotice(true);
        }
      }
    };

    loadNoticeState();

    return () => {
      active = false;
    };
  }, []);

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
        .sort((a, b) => getSortTime(a) - getSortTime(b))
        .map((row) => buildJournalItem(row, ownerIds, myName, partnerName));

      setEntries(sharedEntries);
    } catch (error) {
      if (__DEV__) console.warn('[JournalHome] Load failed:', error?.message);
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [myName, ownerIds, partnerName]);

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

  const dismissSharedNotice = useCallback(async () => {
    setShowSharedNotice(false);

    try {
      await storage.set(SHARED_JOURNAL_NOTICE_KEY, true);
    } catch {}
  }, []);

  const handleBack = useCallback(() => {
    impact(ImpactFeedbackStyle.Light);
    navigation.goBack();
  }, [navigation]);

  const renderItem = ({ item, index }) => (
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
                style={[styles.eyebrow, { color: item.accent }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.78}
              >
                {item.eyebrow}
              </Text>
            </View>

            <Text style={styles.cardTitle}>{item.title}</Text>

            {item.mediaUri && item.mediaKind === 'video' ? (
              <View style={styles.mediaIndicator}>
                <Icon name="videocam-outline" size={14} color={item.accent} />
                <Text style={[styles.mediaIndicatorText, { color: item.accent }]}>
                  Video attached
                </Text>
              </View>
            ) : null}

            {item.mediaUri && item.mediaKind !== 'video' ? (
              <Image
                source={{ uri: item.mediaUri }}
                style={styles.journalThumbnail}
                resizeMode="cover"
              />
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

              <View style={[styles.downArrowButton, { borderColor: t.border }]}>
                <Icon name="chevron-down-outline" size={18} color={t.text} />
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const ListHeader = (
    <Animated.View entering={FadeIn.duration(500)}>
      <View style={styles.cardContainer}>
        <View
          style={[
            styles.editorialCard,
            styles.editorialCardColumn,
            { backgroundColor: t.surface, borderColor: t.borderGlass },
            !isDark && styles.lightShadow,
          ]}
        >
          <View style={styles.cardContent}>
          </View>

          <View style={styles.heroActionWrap}>
            <TouchableOpacity
              style={[styles.heroPrimaryAction, { backgroundColor: t.primary }]}
              activeOpacity={0.85}
              onPress={handleCreate}
              accessibilityLabel="New shared entry"
              accessibilityRole="button"
            >
              <Icon name="create-outline" size={16} color="#FFF" />
              <Text style={styles.heroPrimaryActionText}>New Shared Entry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {showSharedNotice ? (
        <View style={styles.cardContainer}>
          <View
            style={[
              styles.editorialCard,
              styles.editorialCardColumn,
              {
                backgroundColor: withAlpha(t.primary, isDark ? 0.12 : 0.08),
                borderColor: t.borderGlass,
              },
            ]}
          >
            <View style={styles.noticeContent}>
              <View style={styles.noticeHeader}>
                <View style={styles.noticeTitleRow}>
                  <Icon name="megaphone-outline" size={16} color={t.primary} />
                  <Text style={[styles.noticeTitle, { color: t.text }]}>
                    Journal is now shared
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={dismissSharedNotice}
                  hitSlop={12}
                  accessibilityLabel="Dismiss journal notice"
                  accessibilityRole="button"
                >
                  <Icon name="close-outline" size={18} color={t.subtext} />
                </TouchableOpacity>
              </View>

            </View>
          </View>
        </View>
      ) : null}
    </Animated.View>
  );

  const EmptyState = (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconCircle}>
        <Icon name="people-outline" size={42} color={t.primary} />
      </View>

      <Text style={styles.emptyTitle}>No shared entries yet</Text>

      <TouchableOpacity
        style={[styles.emptyButton, { backgroundColor: t.primary }]}
        activeOpacity={0.85}
        onPress={handleCreate}
        accessibilityLabel="Write shared entry"
        accessibilityRole="button"
      >
        <Text style={styles.emptyButtonText}>Write Shared Entry</Text>
      </TouchableOpacity>
    </View>
  );

  const LoadingState = (
    <View style={styles.loadingState}>
      <ActivityIndicator size="small" color={t.primary} />
      <Text style={[styles.loadingText, { color: t.subtext }]}>
        Loading your shared journal...
      </Text>
    </View>
  );

  return (
    <EditorialScreenScaffold
      navigation={navigation}
      headerTitle="Journal"
      headerSubtitle="SHARED NOTES"
      scroll={false}
      onBack={handleBack}
    >
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
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
    </EditorialScreenScaffold>
  );
}

const createStyles = (t, isDark) => StyleSheet.create({
  listContent: {
    paddingHorizontal: 0,
    paddingBottom: 160,
  },
  cardContainer: {
    paddingHorizontal: 0,
    marginVertical: SPACING.md,
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
  journalThumbnail: {
    width: '100%',
    height: 150,
    borderRadius: 18,
    marginTop: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  mediaIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
  },
  mediaIndicatorText: {
    fontSize: 12,
    fontFamily: SYSTEM_FONT,
    fontWeight: '700',
    letterSpacing: 0.3,
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

  heroTitle: {
    fontFamily: SERIF_FONT,
    fontSize: 30,
    lineHeight: 36,
    color: t.text,
    marginBottom: SPACING.sm,
  },
  heroActionWrap: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
    width: '100%',
    alignItems: 'center',
  },
  heroPrimaryAction: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 28,
    marginTop: SPACING.xl,
  },
  heroPrimaryActionText: {
    fontFamily: SYSTEM_FONT,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },

  noticeContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    width: '100%',
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    gap: 12,
  },
  noticeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  noticeTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: '800',
  },
  noticeBody: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    lineHeight: 20,
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
