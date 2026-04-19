import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Platform,
  Dimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Icon from '../components/Icon';
import FilmGrain from '../components/FilmGrain';
import GlowOrb from '../components/GlowOrb';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { DataLayer } from '../services/localfirst';
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';
import { SPACING, withAlpha } from '../utils/theme';
import { storage } from '../utils/storage';

const { width: SCREEN_W } = Dimensions.get('window');
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
    photoUri: row.photo_uri || null,
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
        style={[styles.card, getShadow(isDark)]}
        accessibilityLabel={item.title || 'Journal entry'}
        accessibilityRole="button"
        accessibilityHint={item.canEdit ? 'Double tap to edit' : 'Double tap to read'}
      >
        <View style={styles.cardTopRow}>
          <View style={styles.eyebrowRow}>
            <Icon name={item.icon} size={14} color={item.accent} />
            <Text style={[styles.eyebrow, { color: item.accent }]}>{item.eyebrow}</Text>
          </View>
          <Text style={styles.dateLabel}>{item.dateLabel}</Text>
        </View>

        <Text style={styles.cardTitle}>{item.title}</Text>
        {item.photoUri ? <Image source={{ uri: item.photoUri }} style={styles.cardPhoto} /> : null}
        <Text style={styles.cardBody} numberOfLines={4}>{item.body || 'Nothing saved yet.'}</Text>

        <View style={styles.cardFooter}>
          <View style={[styles.metaPill, { backgroundColor: withAlpha(item.accent, 0.12), borderColor: withAlpha(item.accent, 0.22) }]}>
            <Text style={[styles.metaPillText, { color: item.accent }]}>{item.meta}</Text>
          </View>
          <View style={[styles.actionPill, { borderColor: t.border }]}> 
            <Text style={[styles.actionPillText, { color: t.text }]}>{item.canEdit ? 'Edit' : 'Read'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const ListHeader = (
    <Animated.View entering={FadeIn.duration(500)}>
      <View style={styles.navHeader}>
        <TouchableOpacity
          style={styles.iconButton}
          hitSlop={16}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => {
            impact(ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
        >
          <Icon name='arrow-back' size={24} color={t.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.editorialHeader}>
        <Text style={[styles.headerSubtitle, { color: t.primary }]}>JOURNAL</Text>
        <Text style={[styles.headerTitle, { color: t.text }]}>Your Shared Story</Text>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroEyebrowRow}>
          <Icon name='book-outline' size={15} color={t.accent} />
          <Text style={styles.heroEyebrow}>VISIBLE TO BOTH OF YOU</Text>
        </View>
        <Text style={styles.heroTitle}>A shared shelf for the entries you write together.</Text>
        <Text style={styles.heroBody}>
          Shared entries are readable by both partners and belong to the relationship story, not just your private notes.
        </Text>

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

      {showSharedNotice ? (
        <View style={[styles.noticeCard, { backgroundColor: withAlpha(t.primary, isDark ? 0.12 : 0.08), borderColor: withAlpha(t.primary, 0.22) }]}>
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient
        colors={isDark ? [t.background, '#120206', '#0A0003', t.background] : [t.background, t.surfaceSecondary, t.background]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <GlowOrb color={t.primary} size={460} top={-180} left={SCREEN_W - 220} opacity={isDark ? 0.18 : 0.08} />
      <GlowOrb color={t.accent} size={260} top={620} left={-80} opacity={isDark ? 0.12 : 0.05} />
      <FilmGrain opacity={0.1} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
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
      </SafeAreaView>
    </View>
  );
}

const getShadow = (isDark) => Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: isDark ? 0.4 : 0.08, shadowRadius: 24 },
  android: { elevation: 6 },
});

const createStyles = (t) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.background },
  safeArea: { flex: 1 },
  listContent: {
    paddingHorizontal: SPACING.screen,
    paddingBottom: 160,
  },
  navHeader: {
    paddingHorizontal: SPACING.screen,
    paddingTop: 12,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  iconButton: {
    padding: 8,
    marginLeft: -8,
  },
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
    fontFamily: SYSTEM_FONT,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
    padding: SPACING.xl,
    marginBottom: SPACING.xl,
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
  noticeCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
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
  card: {
    borderRadius: 24,
    padding: SPACING.xl,
    marginBottom: SPACING.md,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
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