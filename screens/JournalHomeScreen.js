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

const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });
const SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif' });
const SHARED_JOURNAL_NOTICE_KEY = '@betweenus:sharedJournalNoticeDismissed';

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

function formatTimeLabel(value) {
  if (!value) return '';
  const date = typeof value === 'string' && value.length === 10
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildJournalItem(row, ownerIds) {
  const isOwn = ownerIds.has(row.user_id);
  const preview = row.locked
    ? 'This entry is locked on this device.'
    : (row.body || '').trim();

  return {
    id: `journal:${row.id}`,
    title: row.locked ? 'Locked journal entry' : (row.title || 'Untitled reflection'),
    body: preview,
    eyebrow: isOwn ? 'SHARED BY YOU' : 'SHARED BY PARTNER',
    icon: 'book-outline',
    accent: '#D2121A',
    meta: isOwn ? 'Visible to both of you' : 'Shared with both of you',
    dateLabel: formatDateLabel(row.created_at),
    timeLabel: formatTimeLabel(row.created_at),
    photoUri: row.photo_uri || null,
    mediaUri: row.mediaUri || null,
    mediaType: row.mediaType || null,
    mediaKind: row.mediaKind || (row.mediaType?.startsWith('video/') ? 'video' : null),
    entry: row,
    canEdit: isOwn,
  };
}

export default function JournalHomeScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { state } = useAppContext();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSharedNotice, setShowSharedNotice] = useState(false);

  const ownerIds = useMemo(
    () => new Set([user?.id, state?.userId].filter(Boolean)),
    [state?.userId, user?.id]
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

  const styles = useMemo(() => createStyles(t), [t]);

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
      const sharedRows = await DataLayer.getJournalEntries({ limit: 500, visibility: 'shared' });
      setEntries((sharedRows || []).map((row) => buildJournalItem(row, ownerIds)));
    } catch (error) {
      if (__DEV__) console.warn('[JournalHome] Load failed:', error?.message);
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

  const renderItem = ({ item, index }) => (
    <Animated.View entering={FadeInDown.delay(index * 35).springify().damping(18)}>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => navigation.navigate('JournalEntry', { entry: item.entry, readOnly: !item.canEdit })}
        style={styles.cardContainer}
        accessibilityLabel={item.title || 'Journal entry'}
        accessibilityRole="button"
        accessibilityHint={item.canEdit ? 'Double tap to edit' : 'Double tap to read'}
      >
        <View style={[styles.editorialCard, styles.editorialCardColumn, { backgroundColor: t.surface, borderColor: t.borderGlass }, !isDark && styles.lightShadow]}>
          <View style={styles.cardContent}>
            <View style={styles.cardTopRow}>
              <View style={styles.eyebrowRow}>
                <Icon name={item.icon} size={14} color={item.accent} />
                <Text style={[styles.eyebrow, { color: item.accent }]}>{item.eyebrow}</Text>
              </View>
              <Text style={styles.dateLabel}>{item.dateLabel}</Text>
            </View>

            <Text style={styles.cardTitle}>{item.title}</Text>
          </View>
            
          <View style={{ paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl, width: '100%' }}>
            <Text style={styles.cardBody} numberOfLines={4}>{item.body || 'Nothing saved yet.'}</Text>

            <View style={styles.cardFooter}>
              <View style={[styles.metaPill, { backgroundColor: withAlpha(item.accent, 0.12), borderColor: withAlpha(item.accent, 0.22) }]}>
                <Text style={[styles.metaPillText, { color: item.accent }]}>{item.meta}</Text>
              </View>
              <View style={styles.cardFooterRight}>
                <Text style={styles.cardTimestamp}>{item.dateLabel} · {item.timeLabel}</Text>
                <View style={[styles.actionPill, { borderColor: t.border }]}> 
                  <Text style={[styles.actionPillText, { color: t.text }]}>{item.canEdit ? 'Edit' : 'Read'}</Text>
                </View>
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
        <View style={[styles.editorialCard, styles.editorialCardColumn, { backgroundColor: t.surface, borderColor: t.borderGlass }, !isDark && styles.lightShadow]}>
          <View style={styles.cardContent}>
            <View style={styles.heroEyebrowRow}>
              <Icon name='book-outline' size={15} color={t.accent} />
              <Text style={[styles.heroEyebrow, { color: t.text }]}>VISIBLE TO BOTH OF YOU</Text>
            </View>
            <Text style={[styles.heroTitle, { color: t.text }]}>A shared shelf for the entries you write together.</Text>
            <Text style={[styles.heroBody, { color: t.subtext }]}>
              Everything here is shared with your partner — a transparent space where your reflections live together.
            </Text>
          </View>

          <View style={{ paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl, width: '100%' }}>
            <View style={styles.heroActions}>
              <TouchableOpacity
                style={[styles.heroPrimaryAction, { backgroundColor: t.primary }]}
                activeOpacity={0.85}
                onPress={handleCreate}
                accessibilityLabel="New shared entry"
                accessibilityRole="button"
              >
                <Icon name='create-outline' size={16} color='#FFF' />
                <Text style={styles.heroPrimaryActionText}>New Shared Entry</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {showSharedNotice ? (
        <View style={styles.cardContainer}>
          <View style={[styles.editorialCard, styles.editorialCardColumn, { backgroundColor: withAlpha(t.primary, isDark ? 0.12 : 0.08), borderColor: t.borderGlass }]}>
            <View style={{ paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.lg, width: '100%' }}>
              <View style={styles.noticeHeader}>
                <View style={styles.noticeTitleRow}>
                  <Icon name='megaphone-outline' size={16} color={t.primary} />
                  <Text style={[styles.noticeTitle, { color: t.text }]}>Journal is now shared</Text>
                </View>
                <TouchableOpacity
                  onPress={dismissSharedNotice}
                  hitSlop={12}
                  accessibilityLabel="Dismiss journal notice"
                  accessibilityRole="button"
                >
                  <Icon name='close-outline' size={18} color={t.subtext} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.noticeBody, { color: t.subtext }]}>New journal entries are visible to both partners, so memories and reflections live in one shared relationship space.</Text>
            </View>
          </View>
        </View>
      ) : null}
    </Animated.View>
  );

  const EmptyState = (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconCircle}>
        <Icon name='people-outline' size={42} color={t.primary} />
      </View>
      <Text style={styles.emptyTitle}>No shared entries yet</Text>
      <Text style={styles.emptyBody}>
        Start a shared entry when you want a memory, mood, or milestone to live with both of you.
      </Text>
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
      <ActivityIndicator size='small' color={t.primary} />
      <Text style={[styles.loadingText, { color: t.subtext }]}>Loading your shared journal...</Text>
    </View>
  );

  const handleBack = useCallback(() => {
    impact(ImpactFeedbackStyle.Light);
    navigation.goBack();
  }, [navigation]);

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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
        />
    </EditorialScreenScaffold>
  );
}

const getShadow = (isDark) => Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: isDark ? 0.4 : 0.08, shadowRadius: 24 },
  android: { elevation: 6 },
});

const createStyles = (t) => StyleSheet.create({
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
  lightShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
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
    color: t.text,
  },
  heroTitle: {
    fontFamily: SERIF_FONT,
    fontSize: 30,
    lineHeight: 36,
    color: t.text,
    marginBottom: SPACING.sm,
  },
  heroBody: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    lineHeight: 22,
    color: t.subtext,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: SPACING.lg,
  },
  heroPrimaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 28,
  },
  heroPrimaryActionText: {
    fontFamily: SYSTEM_FONT,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
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
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  eyebrow: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  dateLabel: {
    fontFamily: SYSTEM_FONT,
    color: t.subtext,
    fontSize: 12,
    fontWeight: '500',
  },
  cardTitle: {
    fontFamily: SERIF_FONT,
    color: t.text,
    fontSize: 26,
    lineHeight: 32,
    marginBottom: SPACING.sm,
  },
  cardPhoto: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: SPACING.md,
    resizeMode: 'cover',
  },
  videoCardPreview: {
    width: '100%',
    height: 140,
    borderRadius: 18,
    marginBottom: SPACING.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  videoCardLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '700',
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
    gap: 10,
  },
  cardFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTimestamp: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '500',
    color: t.subtext,
  },
  metaPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexShrink: 1,
  },
  metaPillText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '600',
  },
  actionPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionPillText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '700',
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