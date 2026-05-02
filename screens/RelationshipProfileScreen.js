import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import EditorialScreenScaffold from '../components/EditorialScreenScaffold';
import Icon from '../components/Icon';
import { SPACING, withAlpha } from '../utils/theme';
import * as PreferenceEngine from '../services/PreferenceEngine';
import { CLIMATE_OPTIONS, ENERGY_LEVELS } from '../services/ConnectionEngine';
import { SEASONS } from '../services/PolishEngine';
import { getMyDisplayName, getPartnerDisplayName } from '../utils/profileNames';

const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });

const LOVE_LANGUAGE_LABELS = {
  words: 'Words of Affirmation',
  touch: 'Physical Touch',
  time: 'Quality Time',
  gifts: 'Receiving Gifts',
  service: 'Acts of Service',
};

const GOAL_LABELS = {
  deeper: 'Keep choosing each other',
  communicate: 'Feel close on busy days',
  fun: 'Have more fun together',
  intimacy: 'Keep intimacy alive',
  grow: 'Build your private story',
};

const DATE_STYLE_LABELS = {
  home: 'Cozy nights in',
  adventure: 'Adventures out',
  mixed: 'A mix of both',
};

const COMMUNICATION_LABELS = {
  direct: 'Direct and honest',
  gentle: 'Gentle and careful',
  playful: 'Playful and light',
};

const TONE_LABELS = {
  warm: 'Warm',
  playful: 'Playful',
  intimate: 'Intimate',
  minimal: 'Minimal',
};

const DURATION_LABELS = {
  new: 'New rhythm',
  developing: 'Building rhythm',
  established: 'Established',
  mature: 'Deep roots',
  long_term: 'Long-term',
};

function labelFrom(list, id, fallback = 'Not set') {
  if (!id) return fallback;
  return list.find((item) => item.id === id)?.label || fallback;
}

function compactList(values, fallback = 'Not enough signal yet') {
  const list = (Array.isArray(values) ? values : [])
    .filter(Boolean)
    .map((value) => String(value).replace(/_/g, ' '));

  if (!list.length) return fallback;
  return list.slice(0, 4).join(', ');
}

function ProfileCard({ title, icon, children, t }) {
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconFrame, { backgroundColor: withAlpha(t.primary, 0.11) }]}>
          <Icon name={icon} size={19} color={t.primary} />
        </View>
        <Text style={[styles.cardTitle, { color: t.text }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function ProfileRow({ label, value, t }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: t.subtext }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: t.text }]}>{value || 'Not set'}</Text>
    </View>
  );
}

export default function RelationshipProfileScreen() {
  const navigation = useNavigation();
  const { user, userProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const t = useMemo(() => ({
    background: colors.background,
    surface: colors.surface || (isDark ? '#1C1C1E' : '#FFFFFF'),
    surfaceSecondary: colors.surface2 || (isDark ? '#2C2C2E' : '#F2F2F7'),
    primary: colors.primary || '#D2121A',
    text: colors.text,
    subtext: colors.textMuted || (isDark ? 'rgba(235,235,245,0.58)' : 'rgba(60,60,67,0.62)'),
    border: colors.border || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
  }), [colors, isDark]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      PreferenceEngine.getContentProfile(userProfile || {})
        .then((nextProfile) => {
          if (active) setProfile(nextProfile);
        })
        .catch(() => {
          if (active) setProfile(null);
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [userProfile])
  );

  const myName = getMyDisplayName(userProfile, null, user?.displayName || 'You');
  const partnerName = getPartnerDisplayName(userProfile, null, 'Partner');
  const quiz = profile?.quiz || userProfile?.quiz || userProfile?.preferences?.quiz || {};
  const seasonLabel = labelFrom(SEASONS, profile?.season?.id);
  const climateLabel = labelFrom(CLIMATE_OPTIONS, profile?.climate?.id, 'Open');
  const energyLabel = labelFrom(ENERGY_LEVELS, profile?.energy?.level);
  const maxHeat = profile?.maxHeat || userProfile?.heatLevelPreference || 5;
  const hiddenCategories = profile?.boundaries?.hiddenCategories || [];
  const pausedEntries = profile?.boundaries?.pausedEntries || [];
  const pausedDates = profile?.boundaries?.pausedDates || [];

  return (
    <EditorialScreenScaffold
      navigation={navigation}
      headerTitle="Relationship Profile"
      headerSubtitle="WHAT FEELS LIKE US"
      headerDescription="Preferences, signals, and boundaries that shape your prompts, dates, and private moments."
      contentContainerStyle={styles.content}
    >
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={t.primary} />
        </View>
      ) : (
        <>
          <ProfileCard title="You Two" icon="people-outline" t={t}>
            <ProfileRow label="Names" value={`${myName} and ${partnerName}`} t={t} />
            <ProfileRow label="Relationship stage" value={DURATION_LABELS[profile?.relationshipDuration] || 'Not set'} t={t} />
            <ProfileRow label="Current season" value={seasonLabel} t={t} />
          </ProfileCard>

          <ProfileCard title="Connection Style" icon="heart-outline" t={t}>
            <ProfileRow label="Love language" value={LOVE_LANGUAGE_LABELS[quiz.loveLanguage]} t={t} />
            <ProfileRow label="Main goal" value={GOAL_LABELS[quiz.relationshipGoal]} t={t} />
            <ProfileRow label="Communication" value={COMMUNICATION_LABELS[quiz.communicationStyle]} t={t} />
            <ProfileRow label="Date style" value={DATE_STYLE_LABELS[quiz.idealDateStyle]} t={t} />
          </ProfileCard>

          <ProfileCard title="Content Shape" icon="options-outline" t={t}>
            <ProfileRow label="Tone" value={TONE_LABELS[profile?.tone] || 'Warm'} t={t} />
            <ProfileRow label="Energy" value={energyLabel} t={t} />
            <ProfileRow label="Climate" value={climateLabel} t={t} />
            <ProfileRow label="Max heat" value={`Heat ${maxHeat}`} t={t} />
          </ProfileCard>

          <ProfileCard title="What We Prioritize" icon="sparkles-outline" t={t}>
            <ProfileRow label="Prompt lanes" value={compactList(profile?.quiz?.preferredCategories)} t={t} />
            <ProfileRow label="Tone lanes" value={compactList(profile?.quiz?.preferredTones)} t={t} />
            <ProfileRow label="Date effort" value={profile?.preferShort ? 'Shorter, lower friction' : 'Room for deeper plans'} t={t} />
          </ProfileCard>

          <ProfileCard title="Boundaries" icon="shield-checkmark-outline" t={t}>
            <ProfileRow label="Spicy content" value={profile?.boundaries?.hideSpicy ? 'Hidden' : 'Available within heat setting'} t={t} />
            <ProfileRow label="Hidden categories" value={compactList(hiddenCategories, 'None hidden')} t={t} />
            <ProfileRow label="Paused prompts" value={pausedEntries.length ? `${pausedEntries.length} paused` : 'None paused'} t={t} />
            <ProfileRow label="Paused dates" value={pausedDates.length ? `${pausedDates.length} paused` : 'None paused'} t={t} />
          </ProfileCard>
        </>
      )}
    </EditorialScreenScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SPACING.screen,
    paddingBottom: 120,
    gap: SPACING.md,
  },
  loading: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  iconFrame: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: 0,
  },
  row: {
    gap: 4,
  },
  rowLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  rowValue: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
});
