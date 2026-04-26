// screens/JournalEntryScreen.js — Shared Journal
// Velvet Glass · Apple Editorial Vertical Rhythm · Haptic Stationery Physics

import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from 'expo-video';
import Icon from '../components/Icon';
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import * as ImagePicker from "expo-image-picker";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { DataLayer } from "../services/localfirst";
import { useTheme } from "../context/ThemeContext";
import { useEntitlements } from "../context/EntitlementsContext";
import { useAuth } from "../context/AuthContext";
import { useAppContext } from "../context/AppContext";
import { PremiumFeature } from '../utils/featureFlags';
import { withAlpha, SPACING } from "../utils/theme";
import GlowOrb from "../components/GlowOrb";
import FilmGrain from "../components/FilmGrain";
import CloseScreenHeader, { CLOSE_HEADER_STYLES } from "../components/CloseScreenHeader";

const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });
const SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif' });

const { width: SCREEN_W } = Dimensions.get('window');

const moods = [
  { id: "calm", label: "Calm", icon: "leaf-outline" },
  { id: "connected", label: "Connected", icon: "heart-outline" },
  { id: "reflective", label: "Reflective", icon: "book-outline" },
  { id: "energized", label: "Energized", icon: "flash-outline" },
];

export default function JournalEntryScreen({ navigation, route }) {
  const { entry, readOnly = false } = route.params || {};
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const { user } = useAuth();
  const { state } = useAppContext();

  const ownerIds = useMemo(
    () => new Set([user?.id, user?.uid, state?.userId].filter(Boolean)),
    [state?.userId, user?.id, user?.uid]
  );

  const isOwnEntry = !!entry?.id && ownerIds.has(entry?.user_id);
  const isReadOnly = !!readOnly || (!!entry?.id && !isOwnEntry);
  const isPremiumGated = !isPremium;

  useEffect(() => {
    if (!isPremiumGated) return undefined;

    showPaywall?.(PremiumFeature.UNLIMITED_JOURNAL_HISTORY);

    const id = requestAnimationFrame(() => {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('JournalHome');
      }
    });

    return () => cancelAnimationFrame(id);
  }, [isPremiumGated, navigation, showPaywall]);

  const [title, setTitle] = useState(entry?.title || "");
  const [content, setContent] = useState(entry?.content || entry?.body || "");
  const [mood, setMood] = useState(entry?.mood || "calm");

  const initialLegacyImageUri = entry?.imageUri || entry?.photoUri || entry?.photo_uri || null;
  const [mediaUri, setMediaUri] = useState(entry?.mediaUri || initialLegacyImageUri || null);
  const [mediaType, setMediaType] = useState(entry?.mediaType || (initialLegacyImageUri ? 'image/jpeg' : null));
  const [mediaFileName, setMediaFileName] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const headerLabel = 'SHARED JOURNAL';
  const isVideoMedia = typeof mediaType === 'string' && mediaType.startsWith('video/');

  const lastHapticLength = useRef(0);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const videoPlayer = useVideoPlayer(mediaUri || null, (player) => {
    player.loop = false;
  });

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Title Required", "Please add a title for your journal entry.");
      return;
    }

    if (!content.trim()) {
      Alert.alert("Content Required", "Please write something in your journal entry.");
      return;
    }

    Keyboard.dismiss();

    setIsSaving(true);
    notification(NotificationFeedbackType.Success);

    try {
      const entryData = {
        title: title.trim(),
        body: content.trim(),
        mood,
        isPrivate: false,
      };

      const isExistingVideoUnchanged = !!entry?.mediaRef
        && !!entry?.mediaUri
        && mediaUri === entry.mediaUri
        && mediaType === entry.mediaType;

      if (isVideoMedia) {
        if (!isExistingVideoUnchanged) {
          entryData.mediaUri = mediaUri || null;
          entryData.mimeType = mediaType || 'video/quicktime';
          entryData.fileName = mediaFileName || `journal_${Date.now()}.mov`;
        }
      } else {
        entryData.imageUri = mediaUri || null;
      }

      if (entry?.id) {
        await DataLayer.updateJournalEntry(entry.id, entryData);
      } else {
        await DataLayer.saveJournalEntry(entryData);
      }

      navigation.goBack();
    } catch (_error) {
      Alert.alert("Error", "Failed to save journal entry. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Entry",
      "Are you sure you want to delete this journal entry? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              impact(ImpactFeedbackStyle.Medium);
              await DataLayer.deleteJournalEntry(entry.id);
              navigation.goBack();
            } catch (_error) {
              Alert.alert("Error", "Failed to delete entry. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleContentChange = (text) => {
    setContent(text);

    if (
      text.length > 0
      && text.length % 50 === 0
      && text.length !== lastHapticLength.current
    ) {
      impact(ImpactFeedbackStyle.Light);
      lastHapticLength.current = text.length;
    }
  };

  const handlePickMedia = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        Alert.alert("Permission needed", "Allow library access to attach a photo or video.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.85,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const asset = result.assets[0];
        const assetMimeType = asset.mimeType || (asset.type === 'video' ? 'video/quicktime' : 'image/jpeg');
        const maxBytes = asset.type === 'video' ? 25_000_000 : 5_000_000;

        if (asset.fileSize && asset.fileSize > maxBytes) {
          Alert.alert(
            asset.type === 'video' ? 'Video Too Large' : 'Image Too Large',
            asset.type === 'video' ? 'Please choose a video under 25 MB.' : 'Please choose a photo under 5 MB.'
          );
          return;
        }

        setMediaUri(asset.uri);
        setMediaType(assetMimeType);
        setMediaFileName(
          asset.fileName || (asset.type === 'video' ? `journal_${Date.now()}.mov` : `journal_${Date.now()}.jpg`)
        );

        impact(ImpactFeedbackStyle.Light);
      }
    } catch (err) {
      if (__DEV__) console.warn('[JournalEntry] Media pick failed:', err?.message);
      Alert.alert("Error", "Couldn't open your library.");
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <FilmGrain opacity={0.1} />

      <GlowOrb
        color={colors.primary}
        size={400}
        top={-150}
        left={SCREEN_W - 200}
        opacity={0.1}
      />

      <GlowOrb
        color={isDark ? '#FFFFFF' : '#F2F2F7'}
        size={300}
        top={650}
        left={-100}
        opacity={isDark ? 0.1 : 0.06}
      />

      <LinearGradient
        colors={[isDark ? "#0F0514" : "#FAF7F5", colors.background]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Animated.View entering={FadeIn.duration(600)}>
            <CloseScreenHeader
              title={new Date(entry?.created_at || Date.now()).toLocaleDateString("en-US", {
                weekday: "short",
                month: "long",
                day: "numeric",
              })}
              subtitle={headerLabel}
              titleColor={colors.text}
              subtitleColor={colors.primary}
              closeColor={colors.text}
              onClose={() => navigation.goBack()}
              rightAccessory={isReadOnly ? (
                <View
                  style={[
                    styles.readOnlyBadge,
                    {
                      borderColor: withAlpha(colors.text, 0.12),
                      backgroundColor: withAlpha(colors.text, 0.05),
                    },
                  ]}
                >
                  <Icon name="book-outline" size={14} color={colors.textMuted} />
                  <Text style={[styles.readOnlyText, { color: colors.textMuted }]}>
                    Read Only
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: colors.primary }]}
                  onPress={handleSave}
                  disabled={isSaving}
                  activeOpacity={0.8}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.saveText}>Save</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </Animated.View>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 100 }}
          >
            <Animated.View entering={FadeInDown.delay(100).duration(800)}>
              <TextInput
                style={[styles.titleInput, { color: colors.text }]}
                placeholder="Title your thoughts..."
                placeholderTextColor={withAlpha(colors.text, 0.2)}
                value={title}
                onChangeText={setTitle}
                multiline
                editable={!isReadOnly}
                selectionColor={colors.primary}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.moodSection}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                VIBE
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.moodRow}
              >
                {moods.map((m) => {
                  const active = mood === m.id;

                  return (
                    <TouchableOpacity
                      key={m.id}
                      disabled={isReadOnly}
                      onPress={() => {
                        setMood(m.id);
                        impact(ImpactFeedbackStyle.Light);
                      }}
                      style={[
                        styles.moodChip,
                        active && {
                          backgroundColor: colors.primary,
                          borderColor: colors.primary,
                        },
                        !active && {
                          borderColor: withAlpha(colors.text, 0.1),
                        },
                      ]}
                    >
                      <Icon
                        name={m.icon}
                        size={14}
                        color={active ? "#FFF" : colors.primary}
                      />

                      <Text style={[styles.moodText, { color: active ? "#FFF" : colors.text }]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(300).duration(600)} style={styles.mediaContainer}>
              {mediaUri ? (
                <View style={styles.previewWrapper}>
                  {isVideoMedia ? (
                    <VideoView
                      style={styles.imagePreview}
                      player={videoPlayer}
                      fullscreenOptions={{ enable: true }}
                      allowsPictureInPicture
                    />
                  ) : (
                    <Image source={{ uri: mediaUri }} style={styles.imagePreview} />
                  )}

                  {isVideoMedia ? (
                    <View style={styles.videoBadge}>
                      <Icon name="play-circle-outline" size={16} color="#FFF" />
                      <Text style={styles.videoBadgeText}>Video</Text>
                    </View>
                  ) : null}

                  {!isReadOnly && (
                    <TouchableOpacity
                      style={styles.removeImageBtn}
                      onPress={() => {
                        selection();
                        setMediaUri(null);
                        setMediaType(null);
                        setMediaFileName(null);
                      }}
                    >
                      <Icon name="close-outline" size={16} color="#FFF" />
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.imagePlaceholder,
                    { borderColor: withAlpha(colors.text, 0.1) },
                  ]}
                  onPress={handlePickMedia}
                  disabled={isReadOnly}
                >
                  <Icon name="images-outline" size={24} color={colors.primary} />
                  <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
                    Add a photo or video
                  </Text>
                </TouchableOpacity>
              )}
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(400).duration(800)} style={styles.writingSurface}>
              <View style={styles.writingHeader}>
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                  THE REFLECTION
                </Text>

                <Text style={[styles.charCount, { color: colors.textMuted }]}>
                  {content.length} characters
                </Text>
              </View>

              <TextInput
                style={[styles.contentInput, { color: colors.text }]}
                placeholder="Let your story flow here..."
                placeholderTextColor={withAlpha(colors.text, 0.25)}
                value={content}
                onChangeText={handleContentChange}
                multiline
                scrollEnabled={false}
                editable={!isReadOnly}
                selectionColor={colors.primary}
                autoFocus={!entry && !isReadOnly}
              />
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(600)} style={styles.footer}>
              <View style={styles.footerActions}>
                <View
                  style={[
                    styles.shareToggle,
                    {
                      borderColor: isReadOnly ? withAlpha(colors.text, 0.1) : colors.primary,
                      backgroundColor: isReadOnly ? withAlpha(colors.text, 0.04) : withAlpha(colors.primary, 0.08),
                    },
                  ]}
                >
                  <Icon
                    name="people-outline"
                    size={18}
                    color={isReadOnly ? colors.textMuted : colors.primary}
                  />

                  <Text style={[styles.shareText, { color: isReadOnly ? colors.textMuted : colors.primary }]}>
                    Shared journal
                  </Text>
                </View>

                {entry && !isReadOnly && (
                  <TouchableOpacity
                    onPress={handleDelete}
                    style={[styles.deleteButton, { backgroundColor: withAlpha('#D2121A', 0.1) }]}
                    activeOpacity={0.7}
                  >
                    <Icon name="trash-outline" size={20} color="#D2121A" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.securityBanner}>
                <Icon name="shield-checkmark-outline" size={12} color={colors.textMuted} />
                <Text style={[styles.securityText, { color: colors.textMuted }]}>
                  END-TO-END ENCRYPTED
                </Text>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: CLOSE_HEADER_STYLES.header,
  backButton: CLOSE_HEADER_STYLES.closeButton,
  headerCenter: { alignItems: "center" },
  headerSubtitle: CLOSE_HEADER_STYLES.subtitle,
  headerDate: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.7,
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  readOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  readOnlyText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '700',
  },
  saveText: {
    fontFamily: SYSTEM_FONT,
    color: "#FFF",
    fontSize: 14,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: SPACING.screen,
  },
  titleInput: {
    fontSize: 34,
    lineHeight: 42,
    fontFamily: SERIF_FONT,
    marginBottom: SPACING.xxxl,
  },
  sectionLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: SPACING.md,
    textTransform: 'uppercase',
  },
  moodSection: {
    marginBottom: SPACING.xxxl,
  },
  moodRow: {
    gap: 10,
    paddingRight: 20,
  },
  moodChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  moodText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '600',
  },
  mediaContainer: {
    marginBottom: SPACING.xxxl,
  },
  imagePreview: {
    width: "100%",
    height: 220,
    borderRadius: 24,
  },
  previewWrapper: {
    position: 'relative',
  },
  videoBadge: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  videoBadgeText: {
    color: '#FFF',
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '700',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholder: {
    height: 80,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  placeholderText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '500',
  },
  writingSurface: {
    marginBottom: SPACING.xxxl,
  },
  writingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  charCount: {
    fontFamily: SYSTEM_FONT,
    fontSize: 10,
    fontWeight: '500',
    opacity: 0.5,
  },
  contentInput: {
    fontFamily: SYSTEM_FONT,
    fontSize: 18,
    lineHeight: 30,
    fontWeight: '400',
    textAlignVertical: "top",
  },
  footer: {
    paddingTop: SPACING.xxxl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  reconnectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: SPACING.lg,
  },
  reconnectBannerText: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  footerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.lg,
  },
  shareToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  shareText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '700',
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  securityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    opacity: 0.5,
  },
  securityText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
});
