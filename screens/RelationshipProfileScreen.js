import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
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
import {
  CLIMATE_OPTIONS,
  ContentIntensityMatcher,
  ENERGY_LEVELS,
  RelationshipClimateState,
} from '../services/ConnectionEngine';
import { NicknameEngine, RelationshipSeasons, SEASONS, SoftBoundaries } from '../services/PolishEngine';
import StorageRouter from '../services/storage/StorageRouter';
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
  { id: true, icon: 'people-outline', label: 'Kids are part of our day-to-day' },
  { id: false, icon: 'person-outline', label: 'No kids in our day-to-day' },
];

const RELATIONSHIP_STAGE_OPTIONS = [
  { id: null, icon: 'calendar-outline', label: 'Use anniversary' },
  { id: 'new', icon: 'sparkles-outline', label: DURATION_LABELS.new },
  { id: 'developing', icon: 'leaf-outline', label: DURATION_LABELS.developing },
  { id: 'established', icon: 'heart-outline', label: DURATION_LABELS.established },
  { id: 'mature', icon: 'infinite-outline', label: DURATION_LABELS.mature },
  { id: 'long_term', icon: 'ribbon-outline', label: DURATION_LABELS.long_term },
];

const SEASON_OPTIONS = SEASONS.map((season) => ({
  id: season.id,
  icon: season.icon,
  label: season.label,
}));

const APP_TONE_OPTIONS = NicknameEngine.TONE_OPTIONS.map((tone) => ({
  id: tone.id,
  icon: tone.icon,
  label: tone.label,
}));

const CLIMATE_SCROLL_OPTIONS = [
  { id: null, icon: 'ellipse-outline', label: 'Open' },
  ...CLIMATE_OPTIONS.map((climate) => ({
    id: climate.id,
    icon: climate.icon,
    label: climate.label,
  })),
];

const HEAT_OPTIONS = [
  { id: 1, icon: 'leaf-outline', label: 'Heat 1: Emotional' },
  { id: 2, icon: 'sparkles-outline', label: 'Heat 2: Romantic' },
  { id: 3, icon: 'heart-outline', label: 'Heat 3: Sensual' },
  { id: 4, icon: 'flame-outline', label: 'Heat 4: Steamy' },
  { id: 5, icon: 'infinite-outline', label: 'Heat 5: Explicit' },
];

const PROMPT_LANE_LABELS = {
  emotional: 'Emotional',
  romance: 'Romance',
  memory: 'Memory',
  future: 'Future',
  playful: 'Playful',
  physical: 'Physical',
  sensory: 'Sensory',
  fantasy: 'Fantasy',
  visual: 'Visual',
  seasonal: 'Seasonal',
  location: 'Location',
  roleplay: 'Roleplay',
  kinky: 'Kinky',
};

const PROMPT_LANE_ICONS = {
  emotional: 'chatbubble-ellipses-outline',
  romance: 'heart-outline',
  memory: 'albums-outline',
  future: 'telescope-outline',
  playful: 'sparkles-outline',
  physical: 'hand-left-outline',
  sensory: 'color-palette-outline',
  fantasy: 'color-wand-outline',
  visual: 'eye-outline',
  seasonal: 'leaf-outline',
  location: 'map-outline',
  roleplay: 'people-circle-outline',
  kinky: 'flame-outline',
};

const PROMPT_LANE_OPTIONS = [
  { id: null, icon: 'sync-outline', label: 'Use profile answers' },
  ...Object.keys(PROMPT_LANE_LABELS).map((id) => ({
    id,
    icon: PROMPT_LANE_ICONS[id] || 'ellipse-outline',
    label: PROMPT_LANE_LABELS[id],
  })),
];

const HIDDEN_CATEGORY_OPTIONS = [
  { id: null, icon: 'checkmark-circle-outline', label: 'None hidden' },
  ...Object.keys(PROMPT_LANE_LABELS).map((id) => ({
    id,
    icon: PROMPT_LANE_ICONS[id] || 'ellipse-outline',
    label: PROMPT_LANE_LABELS[id],
  })),
];

const TONE_LANE_LABELS = {
  warm: 'Warm',
  soft: 'Soft',
  gentle: 'Gentle',
  deep: 'Deep',
  honest: 'Honest',
  reflective: 'Reflective',
  playful: 'Playful',
  light: 'Light',
  spontaneous: 'Spontaneous',
  sensual: 'Sensual',
  bold: 'Bold',
  appreciative: 'Appreciative',
  cozy: 'Cozy',
  future: 'Future',
};

const TONE_LANE_OPTIONS = [
  { id: null, icon: 'sync-outline', label: 'Use profile answers' },
  ...Object.keys(TONE_LANE_LABELS).map((id) => ({
    id,
    icon: id === 'sensual' || id === 'bold' ? 'flame-outline' : id === 'playful' ? 'sparkles-outline' : 'chatbubble-outline',
    label: TONE_LANE_LABELS[id],
  })),
];

const DATE_EFFORT_OPTIONS = [
  { id: null, icon: 'sync-outline', label: 'Use profile signals' },
  { id: 'short', icon: 'flash-outline', label: 'Shorter, lower friction' },
  { id: 'deeper', icon: 'hourglass-outline', label: 'Room for deeper plans' },
];

const SPICY_CONTENT_OPTIONS = [
  { id: 'available', icon: 'checkmark-circle-outline', label: 'Available within heat setting' },
  { id: 'hidden', icon: 'eye-off-outline', label: 'Hide spicy content' },
];

function labelFrom(list, id, fallback = 'Not set') {
  if (!id) return fallback;
  return list.find((item) => item.id === id)?.label || fallback;
}

function compactList(values, fallback = 'Not enough signal yet', labels = null) {
  const list = (Array.isArray(values) ? values : [])
    .filter(Boolean)
    .map((value) => labels?.[value] || String(value).replace(/_/g, ' '));

  if (!list.length) return fallback;
  return list.slice(0, 4).join(', ');
}

function preferenceValueEquals(left, right) {
  if (Array.isArray(left) || Array.isArray(right)) {
    const leftValues = Array.isArray(left) ? left.filter(Boolean) : [];
    const rightValues = Array.isArray(right) ? right.filter(Boolean) : [];

    if (leftValues.length !== rightValues.length) return false;
    return leftValues.every((value) => rightValues.includes(value));
  }

  return (left ?? null) === (right ?? null);
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

function ProfileRow({ label, value, t, isLast, onPress, accessibilityLabel, expanded, children }) {
  const row = (
    <View style={[styles.profileRow, onPress && styles.profileRowPressable]}>
      <View style={styles.profileRowText}>
        <Text style={[styles.rowLabel, { color: t.subtext }]}>{label}</Text>
        <Text style={[styles.rowValue, { color: t.text }]}>{value || 'Not set'}</Text>
      </View>
      {onPress ? (
        <Icon
          name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
          size={18}
          color={t.subtext}
        />
      ) : null}
    </View>
  );

  return (
    <>
      {onPress ? (
        <TouchableOpacity
          activeOpacity={0.72}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel || `Edit ${label}`}
        >
          {row}
        </TouchableOpacity>
      ) : row}
      {children}
      {!isLast && <View style={[styles.divider, { backgroundColor: t.border }]} />}
    </>
  );
}

function InlineChoiceEditor({ options, value, values, onSelect, onSave, t, saving, multiple = false }) {
  const initialValues = useMemo(
    () => (Array.isArray(values) ? values.filter(Boolean) : []),
    [values]
  );
  const [draftValues, setDraftValues] = useState(initialValues);

  useEffect(() => {
    if (multiple) setDraftValues(initialValues);
  }, [initialValues, multiple]);

  const handleOptionPress = useCallback((optionId) => {
    selection();

    if (!multiple) {
      onSelect?.(optionId);
      return;
    }

    setDraftValues((currentValues) => {
      if (optionId === null) return [];
      return currentValues.includes(optionId)
        ? currentValues.filter((item) => item !== optionId)
        : [...currentValues, optionId];
    });
  }, [multiple, onSelect]);

  const handleSaveDraft = useCallback(() => {
    onSave?.(draftValues.length ? draftValues : null);
  }, [draftValues, onSave]);

  return (
    <View style={[styles.inlineEditor, { backgroundColor: t.surfaceSecondary, borderColor: t.border }]}>
      <ScrollView
        style={styles.inlineDropdownList}
        nestedScrollEnabled
        showsVerticalScrollIndicator={options.length > 6}
        contentContainerStyle={styles.inlineDropdownContent}
      >
        {options.map((item) => {
          const selectedValues = multiple ? draftValues : initialValues;
          const isActive = multiple
            ? item.id === null
              ? selectedValues.length === 0
              : selectedValues.includes(item.id)
            : (value ?? null) === item.id;

          return (
            <TouchableOpacity
              key={String(item.id)}
              style={[
                styles.inlineOption,
                isActive && {
                  backgroundColor: `${t.primary}12`,
                  borderColor: `${t.primary}33`,
                },
              ]}
              activeOpacity={0.78}
              onPress={() => handleOptionPress(item.id)}
              disabled={saving}
              accessibilityRole={multiple ? 'checkbox' : 'radio'}
              accessibilityState={{ selected: isActive, checked: isActive, disabled: saving }}
              accessibilityLabel={item.label}
            >
              <View style={[styles.inlineOptionIcon, { backgroundColor: isActive ? `${t.primary}16` : t.surface }]}>
                <Icon name={item.icon} size={18} color={isActive ? t.primary : t.subtext} />
              </View>
              <Text style={[styles.inlineOptionLabel, { color: isActive ? t.primary : t.text }]} numberOfLines={2}>
                {item.label}
              </Text>
              {saving && isActive ? (
                <ActivityIndicator size="small" color={t.primary} />
              ) : isActive ? (
                <Icon name="checkmark-outline" size={18} color={t.primary} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {multiple ? (
        <View style={[styles.multiSelectFooter, { borderTopColor: t.border }]}>
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={handleSaveDraft}
            disabled={saving}
            style={[styles.multiSelectDoneButton, { backgroundColor: t.primary, opacity: saving ? 0.65 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Save selections"
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.multiSelectDoneText}>Done</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

export default function RelationshipProfileScreen() {
  const navigation = useNavigation();
  const { user, userProfile, updateProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState(null);
  const [savingField, setSavingField] = useState(null);

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
  const handleToggleField = useCallback((field) => {
    if (savingField) return;
    selection();
    setEditingField((current) => (current === field ? null : field));
  }, [savingField]);

  const refreshProfile = useCallback(async (sourceProfile = userProfile) => {
    const nextProfile = await PreferenceEngine.getContentProfile(sourceProfile || {});
    setProfile(nextProfile);
    return nextProfile;
  }, [userProfile]);

  const saveQuizValue = useCallback(async (field, value, { keepOpen = false } = {}) => {
    if (savingField) return;

    const currentValue = typeof savedQuiz?.[field] === 'undefined' ? null : savedQuiz[field];
    const nextValue = Array.isArray(value) && value.length === 0 ? null : value;
    if (preferenceValueEquals(currentValue, nextValue)) {
      if (!keepOpen) setEditingField(null);
      return;
    }

    const nextQuiz = { ...(savedQuiz || {}) };
    if (nextValue === null || typeof nextValue === 'undefined') {
      delete nextQuiz[field];
    } else {
      nextQuiz[field] = nextValue;
    }

    try {
      setSavingField(field);
      impact(ImpactFeedbackStyle.Medium);

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
      if (!keepOpen) setEditingField(null);
      notification(NotificationFeedbackType.Success);
    } catch (error) {
      if (__DEV__) console.warn('[RelationshipProfile] Failed to save profile:', error?.message);
      notification(NotificationFeedbackType.Error);
      Alert.alert('Update Failed', 'We could not save your couple profile. Please try again.');
    } finally {
      setSavingField(null);
    }
  }, [savedQuiz, savingField, updateProfile, userProfile]);

  const handleSaveQuizList = useCallback((field, values) => {
    const nextValues = Array.isArray(values) ? values.filter(Boolean) : [];
    return saveQuizValue(field, nextValues.length ? nextValues : null);
  }, [saveQuizValue]);

  const handleSelectDateEffort = useCallback((value) => {
    if (value === null) {
      return saveQuizValue('preferShort', null);
    }
    return saveQuizValue('preferShort', value === 'short');
  }, [saveQuizValue]);

  const handleSelectPreference = useCallback(async (field, value) => {
    if (savingField) return;

    try {
      setSavingField(field);
      impact(ImpactFeedbackStyle.Medium);

      if (field === 'season') {
        const nextSeason = await RelationshipSeasons.set(value);
        await StorageRouter.updateCloudProfilePreferences({ relationshipSeason: nextSeason });
        await refreshProfile();
      }

      if (field === 'tone') {
        const nicknameConfig = await NicknameEngine.setConfig({ tone: value });
        const nextPreferences = {
          ...(userProfile?.preferences || {}),
          tone: value,
          nicknameConfig,
        };
        const updatedProfile = await updateProfile({
          tone: value,
          nicknameConfig,
          preferences: nextPreferences,
        });
        await refreshProfile(updatedProfile || userProfile);
      }

      if (field === 'energy') {
        await ContentIntensityMatcher.setEnergyLevel(value);
        await StorageRouter.updateCloudProfilePreferences({ energyLevel: value });
        await refreshProfile();
      }

      if (field === 'climate') {
        const nextClimate = await RelationshipClimateState.set(value);
        await StorageRouter.updateCloudProfilePreferences({ relationshipClimate: nextClimate });
        await refreshProfile();
      }

      if (field === 'heat') {
        const nextPreferences = {
          ...(userProfile?.preferences || {}),
          heatLevelPreference: value,
        };
        const updatedProfile = await updateProfile({
          heatLevelPreference: value,
          preferences: nextPreferences,
        });
        await refreshProfile(updatedProfile || userProfile);
      }

      if (field === 'spicyContent') {
        const currentBoundaries = await SoftBoundaries.getAll();
        const nextBoundaries = {
          ...currentBoundaries,
          hideSpicy: value === 'hidden',
          maxHeatOverride: value === 'hidden' ? 3 : null,
        };
        await SoftBoundaries.setAll(nextBoundaries);
        await StorageRouter.updateCloudProfilePreferences({ softBoundaries: nextBoundaries });
        await refreshProfile();
      }

      setEditingField(null);
      notification(NotificationFeedbackType.Success);
    } catch (error) {
      if (__DEV__) console.warn('[RelationshipProfile] Failed to save preference:', error?.message);
      notification(NotificationFeedbackType.Error);
      Alert.alert('Update Failed', 'We could not save your couple profile. Please try again.');
    } finally {
      setSavingField(null);
    }
  }, [refreshProfile, savingField, updateProfile, userProfile]);

  const handleSaveHiddenCategories = useCallback(async (values) => {
    if (savingField) return;

    try {
      setSavingField('hiddenCategories');
      impact(ImpactFeedbackStyle.Medium);

      const currentBoundaries = await SoftBoundaries.getAll();
      const currentCategories = Array.isArray(currentBoundaries.hiddenCategories)
        ? currentBoundaries.hiddenCategories
        : [];
      const nextCategories = Array.isArray(values) ? values.filter(Boolean) : [];

      if (preferenceValueEquals(currentCategories, nextCategories)) {
        setEditingField(null);
        return;
      }

      const nextBoundaries = {
        ...currentBoundaries,
        hiddenCategories: nextCategories,
      };

      await SoftBoundaries.setAll(nextBoundaries);
      await StorageRouter.updateCloudProfilePreferences({ softBoundaries: nextBoundaries });
      await refreshProfile();
      setEditingField(null);
      notification(NotificationFeedbackType.Success);
    } catch (error) {
      if (__DEV__) console.warn('[RelationshipProfile] Failed to save hidden categories:', error?.message);
      notification(NotificationFeedbackType.Error);
      Alert.alert('Update Failed', 'We could not save your couple profile. Please try again.');
    } finally {
      setSavingField(null);
    }
  }, [refreshProfile, savingField]);

  const myName = getMyDisplayName(userProfile, null, user?.displayName || 'You');
  const partnerName = getPartnerDisplayName(userProfile, null, 'Partner');
  const quiz = profile?.quiz || userProfile?.quiz || userProfile?.preferences?.quiz || {};
  const seasonLabel = labelFrom(SEASONS, profile?.season?.id);
  const climateLabel = labelFrom(CLIMATE_OPTIONS, profile?.climate?.id, 'Open');
  const energyLabel = labelFrom(ENERGY_LEVELS, profile?.energy?.level);
  const heatLevel = profile?.heatLevel || userProfile?.heatLevelPreference || 5;
  const maxHeat = profile?.maxHeat || userProfile?.heatLevelPreference || 5;
  const hiddenCategories = profile?.boundaries?.hiddenCategories || [];
  const hasKidsValue = typeof quiz.hasKids === 'boolean' ? quiz.hasKids : null;
  const promptLaneValues = Array.isArray(savedQuiz?.preferredCategories) ? savedQuiz.preferredCategories : null;
  const toneLaneValues = Array.isArray(savedQuiz?.preferredTones) ? savedQuiz.preferredTones : null;
  const dateEffortValue = typeof savedQuiz?.preferShort === 'boolean'
    ? savedQuiz.preferShort ? 'short' : 'deeper'
    : null;
  const dateEffortLabel = dateEffortValue
    ? labelFrom(DATE_EFFORT_OPTIONS, dateEffortValue)
    : profile?.preferShort ? 'Shorter, lower friction' : 'Room for deeper plans';
  const spicyContentValue = profile?.boundaries?.hideSpicy ? 'hidden' : 'available';

  return (
    <EditorialScreenScaffold
      navigation={navigation}
      headerTitle="Couple Profile"
      headerSubtitle="WHAT FEELS LIKE US"
      contentContainerStyle={styles.content}
    >
      {loading ? (
        <View style={[styles.loading, { backgroundColor: t.surface, borderColor: t.border }]}>
          <ActivityIndicator size="small" color={t.primary} />
        </View>
      ) : (
        <>
          <ProfileSection title="You Two" t={t} isDark={isDark}>
            <ProfileRow label="Names" value={`${myName} and ${partnerName}`} t={t} />
            <ProfileRow
              label="Relationship stage"
              value={DURATION_LABELS[profile?.relationshipDuration] || 'Not set'}
              t={t}
              onPress={() => handleToggleField('relationshipStage')}
              accessibilityLabel="Edit relationship stage"
              expanded={editingField === 'relationshipStage'}
            >
              {editingField === 'relationshipStage' ? (
                <InlineChoiceEditor
                  options={RELATIONSHIP_STAGE_OPTIONS}
                  value={savedQuiz.relationshipStage ?? null}
                  onSelect={(value) => saveQuizValue('relationshipStage', value)}
                  t={t}
                  saving={savingField === 'relationshipStage'}
                />
              ) : null}
            </ProfileRow>
            <ProfileRow
              label="Current season"
              value={seasonLabel}
              t={t}
              onPress={() => handleToggleField('season')}
              accessibilityLabel="Edit current season"
              expanded={editingField === 'season'}
              isLast
            >
              {editingField === 'season' ? (
                <InlineChoiceEditor
                  options={SEASON_OPTIONS}
                  value={profile?.season?.id || 'cozy'}
                  onSelect={(value) => handleSelectPreference('season', value)}
                  t={t}
                  saving={savingField === 'season'}
                />
              ) : null}
            </ProfileRow>
          </ProfileSection>

          <ProfileSection title="Connection Style" t={t} isDark={isDark}>
            <ProfileRow
              label="Love language"
              value={LOVE_LANGUAGE_LABELS[quiz.loveLanguage]}
              t={t}
              onPress={() => handleToggleField('loveLanguage')}
              accessibilityLabel="Edit love language"
              expanded={editingField === 'loveLanguage'}
            >
              {editingField === 'loveLanguage' ? (
                <InlineChoiceEditor
                  options={LOVE_LANGUAGE_OPTIONS}
                  value={quiz.loveLanguage}
                  onSelect={(value) => saveQuizValue('loveLanguage', value)}
                  t={t}
                  saving={savingField === 'loveLanguage'}
                />
              ) : null}
            </ProfileRow>
            <ProfileRow
              label="Main goal"
              value={GOAL_LABELS[quiz.relationshipGoal]}
              t={t}
              onPress={() => handleToggleField('relationshipGoal')}
              accessibilityLabel="Edit main goal"
              expanded={editingField === 'relationshipGoal'}
            >
              {editingField === 'relationshipGoal' ? (
                <InlineChoiceEditor
                  options={RELATIONSHIP_GOAL_OPTIONS}
                  value={quiz.relationshipGoal}
                  onSelect={(value) => saveQuizValue('relationshipGoal', value)}
                  t={t}
                  saving={savingField === 'relationshipGoal'}
                />
              ) : null}
            </ProfileRow>
            <ProfileRow
              label="Communication"
              value={COMMUNICATION_LABELS[quiz.communicationStyle]}
              t={t}
              onPress={() => handleToggleField('communicationStyle')}
              accessibilityLabel="Edit communication style"
              expanded={editingField === 'communicationStyle'}
            >
              {editingField === 'communicationStyle' ? (
                <InlineChoiceEditor
                  options={COMMUNICATION_OPTIONS}
                  value={quiz.communicationStyle}
                  onSelect={(value) => saveQuizValue('communicationStyle', value)}
                  t={t}
                  saving={savingField === 'communicationStyle'}
                />
              ) : null}
            </ProfileRow>
            <ProfileRow
              label="Date style"
              value={DATE_STYLE_LABELS[quiz.idealDateStyle]}
              t={t}
              onPress={() => handleToggleField('idealDateStyle')}
              accessibilityLabel="Edit date style"
              expanded={editingField === 'idealDateStyle'}
            >
              {editingField === 'idealDateStyle' ? (
                <InlineChoiceEditor
                  options={DATE_STYLE_OPTIONS}
                  value={quiz.idealDateStyle}
                  onSelect={(value) => saveQuizValue('idealDateStyle', value)}
                  t={t}
                  saving={savingField === 'idealDateStyle'}
                />
              ) : null}
            </ProfileRow>
            <ProfileRow
              label="Kids at home"
              value={hasKidsValue === null ? 'Not set' : hasKidsValue ? 'Kids at home' : 'No kids noted'}
              t={t}
              onPress={() => handleToggleField('hasKids')}
              accessibilityLabel="Edit kids at home"
              expanded={editingField === 'hasKids'}
              isLast
            >
              {editingField === 'hasKids' ? (
                <InlineChoiceEditor
                  options={HAS_KIDS_OPTIONS}
                  value={hasKidsValue}
                  onSelect={(value) => saveQuizValue('hasKids', value)}
                  t={t}
                  saving={savingField === 'hasKids'}
                />
              ) : null}
            </ProfileRow>
          </ProfileSection>

          <ProfileSection title="Content Shape" t={t} isDark={isDark}>
            <ProfileRow
              label="Tone"
              value={TONE_LABELS[profile?.tone] || 'Warm'}
              t={t}
              onPress={() => handleToggleField('tone')}
              accessibilityLabel="Edit tone"
              expanded={editingField === 'tone'}
            >
              {editingField === 'tone' ? (
                <InlineChoiceEditor
                  options={APP_TONE_OPTIONS}
                  value={profile?.tone || 'warm'}
                  onSelect={(value) => handleSelectPreference('tone', value)}
                  t={t}
                  saving={savingField === 'tone'}
                />
              ) : null}
            </ProfileRow>
            <ProfileRow
              label="Energy"
              value={energyLabel}
              t={t}
              onPress={() => handleToggleField('energy')}
              accessibilityLabel="Edit energy"
              expanded={editingField === 'energy'}
            >
              {editingField === 'energy' ? (
                <InlineChoiceEditor
                  options={ENERGY_LEVELS}
                  value={profile?.energy?.level || 'open'}
                  onSelect={(value) => handleSelectPreference('energy', value)}
                  t={t}
                  saving={savingField === 'energy'}
                />
              ) : null}
            </ProfileRow>
            <ProfileRow
              label="Climate"
              value={climateLabel}
              t={t}
              onPress={() => handleToggleField('climate')}
              accessibilityLabel="Edit climate"
              expanded={editingField === 'climate'}
            >
              {editingField === 'climate' ? (
                <InlineChoiceEditor
                  options={CLIMATE_SCROLL_OPTIONS}
                  value={profile?.climate?.id ?? null}
                  onSelect={(value) => handleSelectPreference('climate', value)}
                  t={t}
                  saving={savingField === 'climate'}
                />
              ) : null}
            </ProfileRow>
            <ProfileRow
              label="Max heat"
              value={`Heat ${maxHeat}`}
              t={t}
              onPress={() => handleToggleField('heat')}
              accessibilityLabel="Edit max heat"
              expanded={editingField === 'heat'}
              isLast
            >
              {editingField === 'heat' ? (
                <InlineChoiceEditor
                  options={HEAT_OPTIONS}
                  value={heatLevel}
                  onSelect={(value) => handleSelectPreference('heat', value)}
                  t={t}
                  saving={savingField === 'heat'}
                />
              ) : null}
            </ProfileRow>
          </ProfileSection>

          <ProfileSection title="What We Prioritize" t={t} isDark={isDark}>
            <ProfileRow
              label="Prompt lanes"
              value={compactList(profile?.quiz?.preferredCategories, 'Use profile answers', PROMPT_LANE_LABELS)}
              t={t}
              onPress={() => handleToggleField('preferredCategories')}
              accessibilityLabel="Edit prompt lanes"
              expanded={editingField === 'preferredCategories'}
            >
              {editingField === 'preferredCategories' ? (
                <InlineChoiceEditor
                  options={PROMPT_LANE_OPTIONS}
                  values={promptLaneValues}
                  onSave={(values) => handleSaveQuizList('preferredCategories', values)}
                  t={t}
                  saving={savingField === 'preferredCategories'}
                  multiple
                />
              ) : null}
            </ProfileRow>
            <ProfileRow
              label="Tone lanes"
              value={compactList(profile?.quiz?.preferredTones, 'Use profile answers', TONE_LANE_LABELS)}
              t={t}
              onPress={() => handleToggleField('preferredTones')}
              accessibilityLabel="Edit tone lanes"
              expanded={editingField === 'preferredTones'}
            >
              {editingField === 'preferredTones' ? (
                <InlineChoiceEditor
                  options={TONE_LANE_OPTIONS}
                  values={toneLaneValues}
                  onSave={(values) => handleSaveQuizList('preferredTones', values)}
                  t={t}
                  saving={savingField === 'preferredTones'}
                  multiple
                />
              ) : null}
            </ProfileRow>
            <ProfileRow
              label="Date effort"
              value={dateEffortLabel}
              t={t}
              onPress={() => handleToggleField('preferShort')}
              accessibilityLabel="Edit date effort"
              expanded={editingField === 'preferShort'}
              isLast
            >
              {editingField === 'preferShort' ? (
                <InlineChoiceEditor
                  options={DATE_EFFORT_OPTIONS}
                  value={dateEffortValue}
                  onSelect={handleSelectDateEffort}
                  t={t}
                  saving={savingField === 'preferShort'}
                />
              ) : null}
            </ProfileRow>
          </ProfileSection>

          <ProfileSection title="Boundaries" t={t} isDark={isDark}>
            <ProfileRow
              label="Spicy content"
              value={profile?.boundaries?.hideSpicy ? 'Hidden' : 'Available within heat setting'}
              t={t}
              onPress={() => handleToggleField('spicyContent')}
              accessibilityLabel="Edit spicy content"
              expanded={editingField === 'spicyContent'}
            >
              {editingField === 'spicyContent' ? (
                <InlineChoiceEditor
                  options={SPICY_CONTENT_OPTIONS}
                  value={spicyContentValue}
                  onSelect={(value) => handleSelectPreference('spicyContent', value)}
                  t={t}
                  saving={savingField === 'spicyContent'}
                />
              ) : null}
            </ProfileRow>
            <ProfileRow
              label="Hidden categories"
              value={compactList(hiddenCategories, 'None hidden', PROMPT_LANE_LABELS)}
              t={t}
              onPress={() => handleToggleField('hiddenCategories')}
              accessibilityLabel="Edit hidden categories"
              expanded={editingField === 'hiddenCategories'}
              isLast
            >
              {editingField === 'hiddenCategories' ? (
                <InlineChoiceEditor
                  options={HIDDEN_CATEGORY_OPTIONS}
                  values={hiddenCategories}
                  onSave={handleSaveHiddenCategories}
                  t={t}
                  saving={savingField === 'hiddenCategories'}
                  multiple
                />
              ) : null}
            </ProfileRow>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  profileRowPressable: {
    minHeight: 72,
  },
  profileRowText: {
    flex: 1,
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
  inlineEditor: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: 340,
    paddingVertical: 6,
  },
  inlineDropdownList: {
    maxHeight: 280,
  },
  inlineDropdownContent: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 6,
  },
  inlineOption: {
    minHeight: 58,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inlineOptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineOptionLabel: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    letterSpacing: 0,
  },
  multiSelectFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 2,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  multiSelectDoneButton: {
    minWidth: 86,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  multiSelectDoneText: {
    color: '#FFFFFF',
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
  },
});
