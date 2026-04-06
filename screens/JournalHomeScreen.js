import React, { useCallback, useMemo, useState } from 'react';
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
import { DataLayer } from '../services/localfirst';
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';
import { SPACING, withAlpha } from '../utils/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif' });

const FILTERS = [
  { id: 'private', label: 'Private', icon: 'eye-off-outline' },
  { id: 'shared', label: 'Shared', icon: 'people-outline' },
];

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

function buildJournalItem(row, currentUserId) {
  const isOwn = row.user_id === currentUserId;
  const isPrivate = !!row.is_private;
  const preview = row.locked
    ? 'This entry is locked on this device.'
    : (row.body || '').trim();

  return {
    id: `journal:${row.id}`,
    sourceId: row.id,
    title: row.locked ? 'Locked journal entry' : (row.title || 'Untitled reflection'),
    body: preview,
    eyebrow: isPrivate ? 'PRIVATE JOURNAL' : (isOwn ? 'SHARED BY YOU' : 'SHARED BY PARTNER'),
    icon: isPrivate ? 'eye-off-outline' : 'book-outline',
    accent: isPrivate ? '#7E4FA3' : '#D2121A',
    meta: isPrivate ? 'Only you can read this' : (isOwn ? 'Visible to both of you' : 'Shared with both of you'),
    dateLabel: formatDateLabel(row.created_at),
    entry: row,
    canEdit: isOwn,
  };
}

export default function JournalHomeScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const [filter, setFilter] = useState('private');
  const [entries, setEntries] = useState({ private: [], shared: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const currentUserId = user?.id || user?.uid || null;

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

  const loadEntries = useCallback(async () => {
    try {
      const [privateRows, sharedRows] = await Promise.all([
        DataLayer.getJournalEntries({ limit: 500, visibility: 'private' }),
        DataLayer.getJournalEntries({ limit: 500, visibility: 'shared' }),
      ]);

      setEntries({
        private: (privateRows || []).map((row) => buildJournalItem(row, currentUserId)),
        shared: (sharedRows || []).map((row) => buildJournalItem(row, currentUserId)),
      });
    } catch (error) {
      if (__DEV__) console.warn('[JournalHome] Load failed:', error?.message);
      setEntries({ private: [], shared: [] });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUserId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadEntries();
    }, [loadEntries])
  );

  const filteredEntries = entries[filter] || [];

  const counts = useMemo(() => ({
    private: entries.private.length,
    shared: entries.shared.length,
  }), [entries]);

  const onRefresh = useCallback(() => {
    selection();
    setRefreshing(true);
    loadEntries();
  }, [loadEntries]);

  const handleCreate = useCallback((nextFilter = filter) => {
    impact(ImpactFeedbackStyle.Light);
    navigation.navigate('JournalEntry', { defaultShared: nextFilter === 'shared' });
  }, [filter, navigation]);

  const renderFilter = ({ id, label, icon }) => {
    const active = filter === id;
    return (
      <TouchableOpacity
        key={id}
        style={[
          styles.filterChip,
          active && { borderColor: t.primary, backgroundColor: withAlpha(t.primary, 0.12) },
        ]}
        activeOpacity={0.8}
        onPress={() => {
          selection();
          setFilter(id);
        }}
      >
        <Icon name={icon} size={14} color={active ? t.primary : t.subtext} />
        <Text style={[styles.filterLabel, { color: active ? t.text : t.subtext }]}>{label}</Text>
        <View style={[styles.filterCount, { backgroundColor: active ? withAlpha(t.primary, 0.18) : t.surfaceSecondary }]}>
          <Text style={[styles.filterCountText, { color: active ? t.primary : t.subtext }]}>{counts[id]}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item, index }) => (
    <Animated.View entering={FadeInDown.delay(index * 35).springify().damping(18)}>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => navigation.navigate('JournalEntry', { entry: item.entry, readOnly: !item.canEdit })}
        style={styles.card}
      >
        <View style={styles.cardTopRow}>
          <View style={styles.eyebrowRow}>
            <Icon name={item.icon} size={14} color={item.accent} />
            <Text style={[styles.eyebrow, { color: item.accent }]}>{item.eyebrow}</Text>
          </View>
          <Text style={styles.dateLabel}>{item.dateLabel}</Text>
        </View>

        <Text style={styles.cardTitle}>{item.title}</Text>
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
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => {
            impact(ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
        >
          <Icon name='chevron-back' size={28} color={t.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerSubtitle, { color: t.primary }]}>JOURNAL</Text>
          <Text style={styles.headerTitle}>Private & Shared</Text>
        </View>

        <TouchableOpacity
          style={[styles.newButton, { backgroundColor: t.primary }]}
          activeOpacity={0.85}
          onPress={() => handleCreate()}
        >
          <Icon name='add-outline' size={18} color='#FFF' />
        </TouchableOpacity>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroEyebrowRow}>
          <Icon name='book-outline' size={15} color={t.accent} />
          <Text style={styles.heroEyebrow}>{filter === 'private' ? 'ONLY YOU' : 'VISIBLE TO BOTH OF YOU'}</Text>
        </View>
        <Text style={styles.heroTitle}>{filter === 'private' ? 'A quieter place for your own reflections.' : 'A shared shelf for the entries you write together.'}</Text>
        <Text style={styles.heroBody}>
          {filter === 'private'
            ? 'Private entries stay in your personal journal and never show up in the couple archive.'
            : 'Shared entries are readable by both partners and belong to the relationship story, not just your private notes.'}
        </Text>

        <View style={styles.heroActions}>
          <TouchableOpacity style={[styles.heroPrimaryAction, { backgroundColor: t.primary }]} activeOpacity={0.85} onPress={() => handleCreate(filter)}>
            <Icon name='create-outline' size={16} color='#FFF' />
            <Text style={styles.heroPrimaryActionText}>{filter === 'private' ? 'New Private Entry' : 'New Shared Entry'}</Text>
          </TouchableOpacity>
          {filter === 'shared' && (
            <TouchableOpacity style={[styles.heroSecondaryAction, { borderColor: t.border }]} activeOpacity={0.8} onPress={() => handleCreate('private')}>
              <Text style={[styles.heroSecondaryActionText, { color: t.text }]}>Write privately instead</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.filtersRow}>
        {FILTERS.map(renderFilter)}
      </View>
    </Animated.View>
  );

  const EmptyState = (
    <Animated.View entering={FadeIn.duration(450)} style={styles.emptyState}>
      <View style={styles.emptyIconCircle}>
        <Icon name={filter === 'private' ? 'eye-off-outline' : 'people-outline'} size={42} color={t.primary} />
      </View>
      <Text style={styles.emptyTitle}>{filter === 'private' ? 'No private entries yet' : 'No shared entries yet'}</Text>
      <Text style={styles.emptyBody}>
        {filter === 'private'
          ? 'Start a personal reflection and keep it just for yourself.'
          : 'Write something meant for both of you and it will collect here.'}
      </Text>
      <TouchableOpacity style={[styles.emptyButton, { backgroundColor: t.primary }]} activeOpacity={0.85} onPress={() => handleCreate(filter)}>
        <Text style={styles.emptyButtonText}>{filter === 'private' ? 'Write Private Entry' : 'Write Shared Entry'}</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const LoadingState = (
    <View style={styles.loadingState}>
      <ActivityIndicator size='small' color={t.primary} />
      <Text style={styles.loadingText}>Gathering your journal…</Text>
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
          data={filteredEntries}
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

const createStyles = (t) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.background },
  safeArea: { flex: 1 },
  listContent: {
    paddingHorizontal: SPACING.screen,
    paddingBottom: 160,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.md,
    marginBottom: SPACING.xl,
  },
  backButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { alignItems: 'center' },
  headerSubtitle: {
    fontSize: 10,
    letterSpacing: 2.2,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    color: t.text,
    fontFamily: SERIF_FONT,
  },
  newButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: withAlpha(t.surface, 0.9),
    padding: 24,
    marginBottom: SPACING.xl,
  },
  heroEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  heroEyebrow: {
    color: t.accent,
    fontSize: 11,
    letterSpacing: 1.8,
    fontWeight: '700',
  },
  heroTitle: {
    color: t.text,
    fontSize: 28,
    lineHeight: 34,
    fontFamily: SERIF_FONT,
    marginBottom: 10,
  },
  heroBody: {
    color: t.subtext,
    fontSize: 15,
    lineHeight: 24,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  heroPrimaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  heroPrimaryActionText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  heroSecondaryAction: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  heroSecondaryActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: SPACING.xl,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: withAlpha(t.surface, 0.72),
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterCount: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  card: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 14,
    backgroundColor: withAlpha(t.surface, 0.92),
    borderWidth: 1,
    borderColor: t.border,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  dateLabel: {
    color: t.subtext,
    fontSize: 12,
  },
  cardTitle: {
    color: t.text,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: SERIF_FONT,
    marginBottom: 10,
  },
  cardBody: {
    color: t.subtext,
    fontSize: 15,
    lineHeight: 24,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
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
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: withAlpha(t.primary, 0.12),
  },
  emptyTitle: {
    color: t.text,
    fontSize: 24,
    fontFamily: SERIF_FONT,
    marginBottom: 10,
  },
  emptyBody: {
    color: t.subtext,
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyButton: {
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  emptyButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  loadingText: {
    color: t.subtext,
    fontSize: 14,
  },
});