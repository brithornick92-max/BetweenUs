import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import EditorialScreenScaffold from '../components/EditorialScreenScaffold';
import Icon from '../components/Icon';
import { SPACING } from '../utils/theme';
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
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

const EMPTY_OPTION = { id: null, icon: 'remove-circle-outline', label: 'Not set' };

const LOVE_LANGUAGE_OPTIONS = [
  EMPTY_OPTION,
  { id: 'words', icon: 'chatbubble-ellipses-outline', label: LOVE_LANGUAGE_LABELS.words },
  { id: 'touch', icon: 'hand-left-outline', label: LOVE_LANGUAGE_LABELS.touch },
  { id: 'time', icon: 'time-outline', label: LOVE_LANGUAGE_LABELS.time },
  { id: 'gifts', icon: 'gift-outline', label: LOVE_LANGUAGE_LABELS.gifts },
  { id: 'service', icon: 'construct-outline', label: LOVE_LANGUAGE_LABELS.service },
];

const RELATIONSHIP_GOAL_OPTIONS = [
  EMPTY_OPTION,
  { id: 'deeper', icon: 'heart-outline', label: GOAL_LABELS.deeper },
  { id: 'communicate', icon: 'chatbubbles-outline', label: GOAL_LABELS.communicate },
  { id: 'fun', icon: 'happy-outline', label: GOAL_LABELS.fun },
  { id: 'intimacy', icon: 'flame-outline', label: GOAL_LABELS.intimacy },
  { id: 'grow', icon: 'leaf-outline', label: GOAL_LABELS.grow },
];

const DATE_STYLE_OPTIONS = [
  EMPTY_OPTION,
  { id: 'home', icon: 'home-outline', label: DATE_STYLE_LABELS.home },
  { id: 'adventure', icon: 'compass-outline', label: DATE_STYLE_LABELS.adventure },
  { id: 'mixed', icon: 'shuffle-outline', label: DATE_STYLE_LABELS.mixed },
];

const COMMUNICATION_OPTIONS = [
  EMPTY_OPTION,
  { id: 'direct', icon: 'arrow-forward-outline', label: COMMUNICATION_LABELS.direct },
  { id: 'gentle', icon: 'water-outline', label: COMMUNICATION_LABELS.gentle },
  { id: 'playful', icon: 'sparkles-outline', label: COMMUNICATION_LABELS.playful },
];

const HAS_KIDS_OPTIONS = [
  EMPTY_OPTION,
  { id: true, icon: 'people-outline', label: 'Yes' },
  { id: false, icon: 'person-outline', label: 'No' },
];

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

function ProfileSection({ title, children, t, isDark }) {
  return (
    <View>
      <Text style={[styles.sectionTitle, { color: t.subtext }]}>{title}</Text>
      <View
        style={[
          styles.widgetCard,
          { backgroundColor: t.surface, borderColor: t.border },
          Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isDark ? 0 : 0.04,
              shadowRadius: 10,
            },
            android: { elevation: 2 },
          }),
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function ProfileRow({ label, value, t, isLast }) {
  return (
    <>
      <View style={styles.profileRow}>
        <Text style={[styles.rowLabel, { color: t.subtext }]}>{label}</Text>
        <Text style={[styles.rowValue, { color: t.text }]}>{value || 'Not set'}</Text>
      </View>
      {!isLast && <View style={[styles.divider, { backgroundColor: t.border }]} />}
    </>
  );
}

function ChoiceRow({ item, selected, onSelect, t, isLast }) {
  const isActive = selected === item.id;

  return (
    <>
      <TouchableOpacity
        style={styles.choiceRow}
        activeOpacity={0.78}
        onPress={() => {
          selection();
          onSelect(item.id);
        }}
        accessibilityRole="radio"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={item.label}
      >
        <View style={[styles.choiceIcon, { backgroundColor: isActive ? `${t.primary}15` : t.surfaceSecondary }]}>
          <Icon name={item.icon} size={20} color={isActive ? t.primary : t.subtext} />
        </View>
        <Text style={[styles.choiceLabel, { color: isActive ? t.primary : t.text }]}>{item.label}</Text>
        {isActive ? <Icon name="checkmark-outline" size={20} color={t.primary} /> : null}
      </TouchableOpacity>
      {!isLast && <View style={[styles.dividerIndent, { backgroundColor: t.border }]} />}
    </>
  );
}

function ChoiceSection({ title, options, value, onChange, t, isDark }) {
  return (
    <ProfileSection title={title} t={t} isDark={isDark}>
      {options.map((item, index) => (
        <ChoiceRow
          key={`${title}-${String(item.id)}`}
          item={item}
          selected={value ?? null}
          onSelect={onChange}
          t={t}
          isLast={index === options.length - 1}
        />
      ))}
    </ProfileSection>
  );
}

export default function RelationshipProfileScreen() {
  const navigation = useNavigation();
  const { user, userProfile, updateProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftQuiz, setDraftQuiz] = useState({});

  const t = useMemo(() => ({
    background: colors.background,
    surface: isDark ? '#131016' : '#FFFFFF',
    surfaceSecondary: isDark ? '#1C1520' : '#F2F2F7',
    primary: colors.primary || '#D2121A',
    text: colors.text,
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
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

  const savedQuiz = useMemo(
    () => userProfile?.quiz || userProfile?.preferences?.quiz || {},
    [userProfile]
  );
  const hasSavedProfile = useMemo(() => (
    !!(
      savedQuiz?.loveLanguage
      || savedQuiz?.relationshipGoal
      || savedQuiz?.idealDateStyle
      || savedQuiz?.communicationStyle
      || typeof savedQuiz?.hasKids === 'boolean'
    )
  ), [savedQuiz]);

  useEffect(() => {
    if (!editing) {
      setDraftQuiz(savedQuiz);
    }
  }, [editing, savedQuiz]);

  const handleToggleEdit = useCallback(() => {
    impact(ImpactFeedbackStyle.Light);
    if (editing) {
      setDraftQuiz(savedQuiz);
      setEditing(false);
      return;
    }

    setDraftQuiz(savedQuiz);
    setEditing(true);
  }, [editing, savedQuiz]);

  const updateDraftField = useCallback((field, value) => {
    setDraftQuiz((current) => {
      const next = { ...(current || {}) };
      if (value === null || typeof value === 'undefined') {
        delete next[field];
      } else {
        next[field] = value;
      }
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (saving) return;

    try {
      setSaving(true);
      impact(ImpactFeedbackStyle.Medium);

      const nextQuiz = { ...(draftQuiz || {}) };
      const nextPreferences = {
        ...(userProfile?.preferences || {}),
        quiz: nextQuiz,
      };
      const updatedProfile = await updateProfile({
        quiz: nextQuiz,
        preferences: nextPreferences,
      });
      const nextProfile = await PreferenceEngine.getContentProfile(updatedProfile || userProfile || {});

      setProfile(nextProfile);
      setDraftQuiz(nextQuiz);
      setEditing(false);
      notification(NotificationFeedbackType.Success);
    } catch (error) {
      if (__DEV__) console.warn('[RelationshipProfile] Failed to save profile:', error?.message);
      notification(NotificationFeedbackType.Error);
      Alert.alert('Update Failed', 'We could not save your relationship profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [draftQuiz, saving, updateProfile, userProfile]);

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
      headerRight={(
        <TouchableOpacity
          style={[
            styles.headerAction,
            { backgroundColor: t.surfaceSecondary, borderColor: t.border },
          ]}
          activeOpacity={0.75}
          onPress={handleToggleEdit}
          accessibilityRole="button"
          accessibilityLabel={editing ? 'Cancel editing relationship profile' : `${hasSavedProfile ? 'Edit' : 'Add'} relationship profile`}
          disabled={saving}
        >
          <Text style={[styles.headerActionText, { color: t.text }]}>
            {editing ? 'Cancel' : hasSavedProfile ? 'Edit' : 'Add'}
          </Text>
        </TouchableOpacity>
      )}
      contentContainerStyle={styles.content}
    >
      {loading ? (
        <View style={[styles.loading, { backgroundColor: t.surface, borderColor: t.border }]}>
          <ActivityIndicator size="small" color={t.primary} />
        </View>
      ) : editing ? (
        <>
          <ChoiceSection
            title="Love Language"
            options={LOVE_LANGUAGE_OPTIONS}
            value={draftQuiz.loveLanguage}
            onChange={(value) => updateDraftField('loveLanguage', value)}
            t={t}
            isDark={isDark}
          />

          <ChoiceSection
            title="Main Goal"
            options={RELATIONSHIP_GOAL_OPTIONS}
            value={draftQuiz.relationshipGoal}
            onChange={(value) => updateDraftField('relationshipGoal', value)}
            t={t}
            isDark={isDark}
          />

          <ChoiceSection
            title="Communication"
            options={COMMUNICATION_OPTIONS}
            value={draftQuiz.communicationStyle}
            onChange={(value) => updateDraftField('communicationStyle', value)}
            t={t}
            isDark={isDark}
          />

          <ChoiceSection
            title="Date Style"
            options={DATE_STYLE_OPTIONS}
            value={draftQuiz.idealDateStyle}
            onChange={(value) => updateDraftField('idealDateStyle', value)}
            t={t}
            isDark={isDark}
          />

          <ChoiceSection
            title="Family Rhythm"
            options={HAS_KIDS_OPTIONS}
            value={typeof draftQuiz.hasKids === 'boolean' ? draftQuiz.hasKids : null}
            onChange={(value) => updateDraftField('hasKids', value)}
            t={t}
            isDark={isDark}
          />

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: t.primary }, saving && styles.disabledControl]}
            activeOpacity={0.88}
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Save relationship profile"
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Apply Changes</Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <ProfileSection title="You Two" t={t} isDark={isDark}>
            <ProfileRow label="Names" value={`${myName} and ${partnerName}`} t={t} />
            <ProfileRow label="Relationship stage" value={DURATION_LABELS[profile?.relationshipDuration] || 'Not set'} t={t} />
            <ProfileRow label="Current season" value={seasonLabel} t={t} isLast />
          </ProfileSection>

          <ProfileSection title="Connection Style" t={t} isDark={isDark}>
            <ProfileRow label="Love language" value={LOVE_LANGUAGE_LABELS[quiz.loveLanguage]} t={t} />
            <ProfileRow label="Main goal" value={GOAL_LABELS[quiz.relationshipGoal]} t={t} />
            <ProfileRow label="Communication" value={COMMUNICATION_LABELS[quiz.communicationStyle]} t={t} />
            <ProfileRow label="Date style" value={DATE_STYLE_LABELS[quiz.idealDateStyle]} t={t} />
            <ProfileRow
              label="Family rhythm"
              value={typeof quiz.hasKids === 'boolean' ? (quiz.hasKids ? 'Kids at home' : 'No kids noted') : 'Not set'}
              t={t}
              isLast
            />
          </ProfileSection>

          <ProfileSection title="Content Shape" t={t} isDark={isDark}>
            <ProfileRow label="Tone" value={TONE_LABELS[profile?.tone] || 'Warm'} t={t} />
            <ProfileRow label="Energy" value={energyLabel} t={t} />
            <ProfileRow label="Climate" value={climateLabel} t={t} />
            <ProfileRow label="Max heat" value={`Heat ${maxHeat}`} t={t} isLast />
          </ProfileSection>

          <ProfileSection title="What We Prioritize" t={t} isDark={isDark}>
            <ProfileRow label="Prompt lanes" value={compactList(profile?.quiz?.preferredCategories)} t={t} />
            <ProfileRow label="Tone lanes" value={compactList(profile?.quiz?.preferredTones)} t={t} />
            <ProfileRow label="Date effort" value={profile?.preferShort ? 'Shorter, lower friction' : 'Room for deeper plans'} t={t} isLast />
          </ProfileSection>

          <ProfileSection title="Boundaries" t={t} isDark={isDark}>
            <ProfileRow label="Spicy content" value={profile?.boundaries?.hideSpicy ? 'Hidden' : 'Available within heat setting'} t={t} />
            <ProfileRow label="Hidden categories" value={compactList(hiddenCategories, 'None hidden')} t={t} />
            <ProfileRow label="Paused prompts" value={pausedEntries.length ? `${pausedEntries.length} paused` : 'None paused'} t={t} />
            <ProfileRow label="Paused dates" value={pausedDates.length ? `${pausedDates.length} paused` : 'None paused'} t={t} isLast />
          </ProfileSection>
        </>
      )}
    </EditorialScreenScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SPACING.screen,
    paddingTop: SPACING.sm,
    paddingBottom: 100,
  },
  loading: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: 1,
  },
  sectionTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
    marginTop: 32,
    paddingLeft: 4,
  },
  widgetCard: {
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 8,
  },
  profileRow: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 6,
  },
  rowLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  rowValue: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '700',
    letterSpacing: 0,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
  },
  dividerIndent: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 76,
  },
  headerAction: {
    minWidth: 64,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  headerActionText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  choiceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceLabel: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    letterSpacing: 0,
  },
  primaryButton: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#D2121A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  disabledControl: {
    opacity: 0.65,
  },
});
