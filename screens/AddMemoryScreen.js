// screens/AddMemoryScreen.js
// Premium shared snapshot composer.
// Multi-photo/video upload → one grouped Snapshot → saves into Our Story / Keepsake.
// Supports create + edit mode.

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Alert,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation, useRoute } from '@react-navigation/native';
import { BlurView } from 'expo-blur';

import Icon from '../components/Icon';
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';
import CloseScreenHeader, { CLOSE_HEADER_STYLES } from '../components/CloseScreenHeader';
import { useTheme } from '../context/ThemeContext';
import { DataLayer } from '../services/localfirst';
import {
  impact,
  selection,
  notification,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from '../utils/haptics';
import { SPACING, withAlpha } from '../utils/theme';

const { width: SCREEN_W } = Dimensions.get('window');

const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });
const SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif' });

const MAX_MEDIA_ITEMS = 10;
const MAX_FILE_BYTES = 50_000_000;
const MAX_VIDEO_DURATION_MS = 180_000;

function buildSnapshotId() {
  return `snapshot_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getSnapshotGroupId(item) {
  return item?.sourceId
    || item?.snapshotGroupId
    || item?.snapshotId
    || item?.snapshot_id
    || item?.groupId
    || item?.group_id
    || null;
}

function getMediaTypeFromMime(mimeType) {
  return mimeType?.startsWith('video/') ? 'video' : 'image';
}

function buildMediaItem(asset, index = 0) {
  const isVideo = asset.type === 'video';
  const fallbackExtension = isVideo ? 'mp4' : 'jpg';

  return {
    id: `${asset.assetId || asset.uri || Date.now()}-${index}`,
    uri: asset.uri,
    type: isVideo ? 'video' : 'image',
    mimeType: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
    fileName: asset.fileName || `snapshot_${Date.now()}_${index}.${fallbackExtension}`,
    duration: asset.duration || null,
    sourceId: null,
    isExisting: false,
  };
}

function buildExistingMediaItem(mediaItem, index = 0) {
  const mimeType = mediaItem?.mimeType
    || mediaItem?.mime
    || mediaItem?.media?.mimeType
    || 'image/jpeg';

  const uri = mediaItem?.uri || mediaItem?.media?.uri || null;
  const type = mediaItem?.kind || mediaItem?.media?.kind || getMediaTypeFromMime(mimeType);
  const sourceId = mediaItem?.sourceItem?.sourceId || mediaItem?.sourceId || null;

  if (!uri) return null;

  return {
    id: `existing:${sourceId || uri}:${index}`,
    uri,
    type: type === 'video' ? 'video' : 'image',
    mimeType,
    fileName: `snapshot_existing_${index}.${type === 'video' ? 'mp4' : 'jpg'}`,
    duration: null,
    sourceId,
    isExisting: true,
  };
}

function getInitialMediaItems(editItem) {
  if (!editItem) return [];

  if (editItem.kind === 'snapshot' && Array.isArray(editItem.mediaItems)) {
    return editItem.mediaItems
      .map((mediaItem, index) => buildExistingMediaItem(mediaItem, index))
      .filter(Boolean);
  }

  if (editItem.media?.uri) {
    const one = buildExistingMediaItem(
      {
        uri: editItem.media.uri,
        mimeType: editItem.media.mimeType,
        kind: editItem.media.kind,
        sourceId: editItem.sourceId,
      },
      0
    );

    return one ? [one] : [];
  }

  return [];
}

function getOriginalMemoryIds(editItem) {
  if (!editItem) return [];

  if (editItem.kind === 'snapshot') {
    return (editItem.rawItems || [])
      .map((item) => item?.sourceId)
      .filter(Boolean);
  }

  return editItem.sourceId ? [editItem.sourceId] : [];
}

async function deleteMemoryById(memoryId) {
  if (!memoryId) return;

  if (typeof DataLayer.deleteMemory === 'function') {
    await DataLayer.deleteMemory(memoryId);
    return;
  }

  if (typeof DataLayer.deleteMemoryById === 'function') {
    await DataLayer.deleteMemoryById(memoryId);
    return;
  }

  if (typeof DataLayer.deleteMemoryEntry === 'function') {
    await DataLayer.deleteMemoryEntry(memoryId);
    return;
  }

  if (typeof DataLayer.deleteSavedMemory === 'function') {
    await DataLayer.deleteSavedMemory(memoryId);
    return;
  }

  throw new Error('No supported memory delete method found on DataLayer.');
}

export default function AddMemoryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useTheme();

  const editItem = route.params?.editItem || null;
  const isEditMode = route.params?.mode === 'edit' && !!editItem;
  const originalMemoryIds = useMemo(() => getOriginalMemoryIds(editItem), [editItem]);

  const editSnapshotId = useMemo(() => {
    if (!isEditMode) return null;
    return getSnapshotGroupId(editItem) || buildSnapshotId();
  }, [editItem, isEditMode]);

  const promptRevealDraft = useMemo(() => {
    if (route.params?.source !== 'prompt_reveal') {
      return { content: '', type: 'moment' };
    }

    const sections = [
      route.params?.promptText ? `Today's question: ${route.params.promptText}` : null,
      route.params?.myAnswer ? `You said: ${route.params.myAnswer}` : null,
      route.params?.partnerAnswer ? `Your partner said: ${route.params.partnerAnswer}` : null,
    ].filter(Boolean);

    return {
      content: sections.join('\n\n'),
      type: 'moment',
    };
  }, [route.params]);

  const initialContent = useMemo(() => {
    if (isEditMode) {
      return editItem?.body || editItem?.content || '';
    }

    return promptRevealDraft.content;
  }, [editItem, isEditMode, promptRevealDraft.content]);

  const initialMediaItems = useMemo(
    () => getInitialMediaItems(editItem),
    [editItem]
  );

  const [content, setContent] = useState(initialContent);
  const [mediaItems, setMediaItems] = useState(initialMediaItems);
  const [saving, setSaving] = useState(false);

  const inputRef = useRef(null);

  const t = useMemo(() => ({
    background: colors.background,
    surface: isDark ? 'rgba(28, 28, 30, 0.45)' : 'rgba(255, 255, 255, 0.65)',
    surfaceSecondary: isDark ? 'rgba(44, 44, 46, 0.8)' : 'rgba(242, 242, 247, 0.8)',
    primary: colors.primary || '#D2121A',
    accent: colors.accent || '#D4AA7E',
    text: colors.text,
    subtext: colors.textMuted || (isDark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.6)'),
    border: colors.border || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  const validateAssets = useCallback((assets) => {
    for (const asset of assets) {
      if (asset.fileSize && asset.fileSize > MAX_FILE_BYTES) {
        Alert.alert('File Too Large', 'Please choose photos or videos under 50 MB.');
        return false;
      }

      if (asset.type === 'video' && asset.duration && asset.duration > MAX_VIDEO_DURATION_MS) {
        Alert.alert('Video Too Long', 'Please choose videos under 3 minutes.');
        return false;
      }
    }

    return true;
  }, []);

  const addAssetsToComposer = useCallback((assets) => {
    if (!assets?.length) return;

    if (!validateAssets(assets)) return;

    const normalized = assets
      .filter((asset) => !!asset?.uri)
      .map((asset, index) => buildMediaItem(asset, index));

    if (!normalized.length) return;

    setMediaItems((current) => {
      const existingUris = new Set(current.map((item) => item.uri));
      const uniqueNewItems = normalized.filter((item) => !existingUris.has(item.uri));

      const remainingSlots = Math.max(0, MAX_MEDIA_ITEMS - current.length);
      const itemsToAdd = uniqueNewItems.slice(0, remainingSlots);

      if (uniqueNewItems.length > remainingSlots) {
        Alert.alert(
          'Limit Reached',
          `You can add up to ${MAX_MEDIA_ITEMS} photos or videos to one snapshot.`
        );
      }

      return [...current, ...itemsToAdd];
    });

    impact(ImpactFeedbackStyle.Light);
  }, [validateAssets]);

  const handlePickMedia = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo access to add photos or videos to this keepsake.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.88,
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit: MAX_MEDIA_ITEMS,
        videoMaxDuration: 180,
      });

      if (!result.canceled && result.assets?.length) {
        addAssetsToComposer(result.assets);
      }
    } catch (err) {
      if (__DEV__) console.warn('[AddMemory] Media pick failed:', err?.message);
      Alert.alert('Error', "Couldn't open your photo library.");
    }
  }, [addAssetsToComposer]);

  const handleRemoveMedia = useCallback((itemId) => {
    selection();
    setMediaItems((current) => current.filter((item) => item.id !== itemId));
  }, []);

  const handleClearAllMedia = useCallback(() => {
    selection();
    setMediaItems([]);
  }, []);

  const saveSnapshotItems = useCallback(async ({ snapshotId, trimmed, items }) => {
    const now = new Date().toISOString();

    if (items.length > 0) {
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];

        await DataLayer.saveMemory({
          content: trimmed || '',
          type: 'snapshot',
          mood: null,
          isPrivate: false,

          snapshot_id: snapshotId,
          snapshot_index: index,
          snapshot_count: items.length,
          snapshot_created_at: now,

          mediaUri: item.uri,
          mimeType: item.mimeType,
          fileName: item.fileName || `memory_${Date.now()}_${index}.${item.type === 'video' ? 'mp4' : 'jpg'}`,

          // Notify only after the final media row saves successfully.
          notifyPartner: index === items.length - 1,
        });
      }

      return;
    }

    await DataLayer.saveMemory({
      content: trimmed || '',
      type: 'snapshot',
      mood: null,
      isPrivate: false,

      snapshot_id: snapshotId,
      snapshot_index: 0,
      snapshot_count: 1,
      snapshot_created_at: now,

      notifyPartner: true,
    });
  }, []);

  const handleSave = useCallback(async () => {
    const trimmed = content.trim();

    if (!trimmed && mediaItems.length === 0) {
      Alert.alert('Add something', 'Add photos/videos or write a note to save this keepsake.');
      return;
    }

    setSaving(true);
    impact(ImpactFeedbackStyle.Medium);

    try {
      const snapshotId = editSnapshotId || buildSnapshotId();

      if (isEditMode && originalMemoryIds.length > 0) {
        await Promise.all(originalMemoryIds.map((memoryId) => deleteMemoryById(memoryId)));
      }

      await saveSnapshotItems({
        snapshotId,
        trimmed,
        items: mediaItems,
      });

      notification(NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (err) {
      setSaving(false);
      if (__DEV__) console.warn('[AddMemory] Save failed:', err?.message);

      Alert.alert(
        isEditMode ? 'Could not update keepsake' : 'Could not save keepsake',
        isEditMode
          ? 'The edit could not be saved. Please try again.'
          : 'Could not save your keepsake. Please try again.'
      );
    }
  }, [
    content,
    editSnapshotId,
    isEditMode,
    mediaItems,
    navigation,
    originalMemoryIds,
    saveSnapshotItems,
  ]);

  const canSave = (content.trim().length > 0 || mediaItems.length > 0) && !saving;
  const hasMedia = mediaItems.length > 0;
  const mediaCountLabel = mediaItems.length === 1 ? '1 item selected' : `${mediaItems.length} items selected`;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor="transparent"
      />

      <LinearGradient
        colors={isDark
          ? [t.background, '#120206', '#0A0003', t.background]
          : [t.background, t.surfaceSecondary, t.background]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <GlowOrb
        color={t.primary}
        size={400}
        top={-160}
        left={SCREEN_W - 200}
        opacity={isDark ? 0.16 : 0.07}
      />

      <FilmGrain opacity={0.08} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <CloseScreenHeader
          title={isEditMode ? 'Edit Snapshot' : 'New Snapshot'}
          subtitle={isEditMode ? 'UPDATE KEEPSAKE' : 'ADD TO KEEPSAKE'}
          titleColor={t.text}
          closeColor={t.text}
          onClose={() => navigation.goBack()}
          rightAccessory={(
            <TouchableOpacity
              onPress={handleSave}
              disabled={!canSave}
              style={[
                styles.saveButton,
                {
                  backgroundColor: canSave ? withAlpha(t.primary, 0.15) : 'transparent',
                  borderColor: canSave ? withAlpha(t.primary, 0.3) : 'transparent',
                },
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={t.primary} />
              ) : (
                <Text style={[styles.saveButtonText, { color: canSave ? t.primary : t.subtext }]}>
                  {isEditMode ? 'Update' : 'Save'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View entering={FadeInDown.delay(50).springify().damping(18)}>
              {!hasMedia ? (
                <TouchableOpacity
                  style={styles.uploadCardContainer}
                  onPress={handlePickMedia}
                  activeOpacity={0.84}
                >
                  <BlurView
                    intensity={isDark ? 48 : 28}
                    tint={isDark ? 'dark' : 'light'}
                    style={[
                      styles.uploadCard,
                      { backgroundColor: t.surface, borderColor: t.border },
                    ]}
                  >
                    <View style={[styles.uploadIconCircle, { backgroundColor: withAlpha(t.primary, 0.12) }]}>
                      <Icon name="images-outline" size={34} color={t.primary} />
                    </View>

                    <Text style={[styles.uploadTitle, { color: t.text }]}>
                      Upload Photos or Videos
                    </Text>

                    <Text style={[styles.uploadBody, { color: t.subtext }]}>
                      Select one or many from your library.
                    </Text>

                    <View
                      style={[
                        styles.uploadPill,
                        {
                          backgroundColor: withAlpha(t.primary, 0.1),
                          borderColor: withAlpha(t.primary, 0.22),
                        },
                      ]}
                    >
                      <Text style={[styles.uploadPillText, { color: t.primary }]}>
                        Choose from Library
                      </Text>
                    </View>
                  </BlurView>
                </TouchableOpacity>
              ) : (
                <View style={styles.mediaSection}>
                  <View style={styles.mediaHeaderRow}>
                    <View>
                      <Text style={[styles.mediaEyebrow, { color: t.primary }]}>
                        SELECTED MEDIA
                      </Text>
                      <Text style={[styles.mediaCount, { color: t.subtext }]}>
                        {mediaCountLabel}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={handleClearAllMedia}
                      activeOpacity={0.75}
                      style={[
                        styles.clearButton,
                        {
                          borderColor: withAlpha(t.text, 0.12),
                          backgroundColor: withAlpha(t.text, 0.04),
                        },
                      ]}
                    >
                      <Text style={[styles.clearButtonText, { color: t.subtext }]}>
                        Clear
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.mediaCarouselContent}
                  >
                    {mediaItems.map((item) => {
                      const isItemVideo = item.type === 'video';

                      return (
                        <View key={item.id} style={styles.mediaTile}>
                          {isItemVideo ? (
                            <View style={styles.videoTileFallback}>
                              <Icon name="play-circle-outline" size={44} color="#FFF" />
                              <Text style={styles.videoTileText}>Video</Text>
                            </View>
                          ) : (
                            <Image
                              source={{ uri: item.uri }}
                              style={styles.mediaTileImage}
                              resizeMode="cover"
                            />
                          )}

                          <TouchableOpacity
                            style={styles.removeMediaButton}
                            onPress={() => handleRemoveMedia(item.id)}
                            hitSlop={10}
                          >
                            <Icon name="close-outline" size={15} color="#FFF" />
                          </TouchableOpacity>
                        </View>
                      );
                    })}

                    {mediaItems.length < MAX_MEDIA_ITEMS && (
                      <TouchableOpacity
                        activeOpacity={0.82}
                        onPress={handlePickMedia}
                        style={[
                          styles.addMoreTile,
                          {
                            borderColor: withAlpha(t.primary, 0.22),
                            backgroundColor: withAlpha(t.primary, 0.08),
                          },
                        ]}
                      >
                        <Icon name="add-outline" size={28} color={t.primary} />
                        <Text style={[styles.addMoreText, { color: t.primary }]}>
                          Add More
                        </Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                </View>
              )}
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(80).springify().damping(18)}
              style={styles.inputContainer}
            >
              <BlurView
                intensity={isDark ? 45 : 25}
                tint={isDark ? 'dark' : 'light'}
                style={[styles.inputBlur, { backgroundColor: t.surface, borderColor: t.border }]}
              >
                <Text style={[styles.noteLabel, { color: t.primary }]}>
                  NOTE
                </Text>

                <TextInput
                  ref={inputRef}
                  style={[styles.input, { color: t.text }]}
                  placeholder="What do you want to remember about this moment?"
                  placeholderTextColor={withAlpha(t.text, 0.4)}
                  value={content}
                  onChangeText={setContent}
                  multiline
                  maxLength={1000}
                  autoFocus={false}
                  textAlignVertical="top"
                />

                <Text style={[styles.charCount, { color: withAlpha(t.subtext, 0.5) }]}>
                  {content.length}/1000
                </Text>
              </BlurView>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const getShadow = (isDark) => Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isDark ? 0.28 : 0.08,
    shadowRadius: 22,
  },
  android: { elevation: 6 },
});

const createStyles = (t, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.background,
  },
  safeArea: {
    flex: 1,
  },

  navHeader: CLOSE_HEADER_STYLES.header,
  iconButton: CLOSE_HEADER_STYLES.closeButton,
  navTitleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  navTitle: CLOSE_HEADER_STYLES.title,

  saveButton: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  saveButtonText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: '800',
  },

  scrollContent: {
    paddingHorizontal: SPACING.screen,
    paddingTop: SPACING.md,
    paddingBottom: 80,
    gap: 24,
  },

  uploadCardContainer: {
    borderRadius: 30,
    ...getShadow(isDark),
  },
  uploadCard: {
    borderRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 44,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  uploadIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  uploadTitle: {
    fontFamily: SERIF_FONT,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  uploadBody: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
  },
  uploadPill: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  uploadPillText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '800',
  },

  mediaSection: {
    marginHorizontal: -SPACING.screen,
  },
  mediaHeaderRow: {
    paddingHorizontal: SPACING.screen,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mediaEyebrow: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  mediaCount: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  clearButton: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  clearButtonText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '800',
  },
  mediaCarouselContent: {
    paddingHorizontal: SPACING.screen,
    gap: 12,
  },
  mediaTile: {
    width: SCREEN_W * 0.7,
    height: 335,
    borderRadius: 28,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(0,0,0,0.18)',
    ...getShadow(isDark),
  },
  mediaTileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
  },
  videoTileFallback: {
    flex: 1,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.52)',
    gap: 8,
  },
  videoTileText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#FFF',
  },
  removeMediaButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 31,
    height: 31,
    borderRadius: 15.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  addMoreTile: {
    width: 128,
    height: 335,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addMoreText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },

  inputContainer: {
    borderRadius: 26,
    ...getShadow(isDark),
  },
  inputBlur: {
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.xl,
    overflow: 'hidden',
  },
  noteLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 12,
  },
  input: {
    fontFamily: SYSTEM_FONT,
    fontSize: 17,
    lineHeight: 25,
    minHeight: 126,
    textAlignVertical: 'top',
  },
  charCount: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: 10,
  },
});
