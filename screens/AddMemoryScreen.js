// screens/AddMemoryScreen.js
// Capture a shared snapshot with optional photo attachment.
// Apple Editorial aesthetic — Velvet Glass Materials + Original Palette.

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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
import { impact, selection, notification, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { SPACING, withAlpha } from '../utils/theme';

const { width: SCREEN_W } = require('react-native').Dimensions.get('window');
const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });
const SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif' });

export default function AddMemoryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useTheme();
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

  const [content, setContent] = useState(promptRevealDraft.content);
  const [media, setMedia] = useState(null); // { uri, type, mimeType }
  const [saving, setSaving] = useState(false);

  const inputRef = useRef(null);
  const autoLaunchCamera = useRef(route.params?.autoLaunchCamera || false);

  // ─── VELVET GLASS THEME MAP ───
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

  // ─── PICK PHOTO ───
  const handlePickPhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo access to attach a photo to this memory.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.85,
        allowsEditing: true,
        aspect: [4, 3],
        videoMaxDuration: 180, // 3 minutes max
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        if (asset.fileSize && asset.fileSize > 50_000_000) {
          Alert.alert('File Too Large', 'Please choose a file under 50 MB.');
          return;
        }
        // Check video duration (3 minutes = 180 seconds)
        if (asset.type === 'video' && asset.duration && asset.duration > 180000) {
          Alert.alert('Video Too Long', 'Please choose a video under 3 minutes.');
          return;
        }
        setMedia({
          uri: asset.uri,
          type: asset.type,
          mimeType: asset.type === 'video' ? 'video/mp4' : 'image/jpeg'
        });
        impact(ImpactFeedbackStyle.Light);
      }
    } catch (err) {
      if (__DEV__) console.warn('[AddMemory] Photo pick failed:', err?.message);
      Alert.alert('Error', "Couldn't open your photo library.");
    }
  }, []);

  // ─── TAKE PHOTO ───
  const handleTakePhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow camera access to capture a photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.85,
        allowsEditing: true,
        aspect: [4, 3],
        videoMaxDuration: 180, // 3 minutes max
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        // Check video duration (3 minutes = 180 seconds)
        if (asset.type === 'video' && asset.duration && asset.duration > 180000) {
          Alert.alert('Video Too Long', 'Please choose a video under 3 minutes.');
          return;
        }
        setMedia({
          uri: asset.uri,
          type: asset.type,
          mimeType: asset.type === 'video' ? 'video/mp4' : 'image/jpeg'
        });
        impact(ImpactFeedbackStyle.Light);
      }
    } catch (err) {
      if (__DEV__) console.warn('[AddMemory] Camera failed:', err?.message);
      Alert.alert('Error', "Couldn't open the camera.");
    }
  }, []);

  useEffect(() => {
    if (autoLaunchCamera.current) {
      autoLaunchCamera.current = false; // Only launch once
      setTimeout(() => {
        handlePhotoPress();
      }, 500); // Wait for screen transition
    }
  }, [handlePhotoPress]);

  const handlePhotoPress = useCallback(() => {
    Alert.alert('Add Media', 'Choose how to add a photo or video', [
      { text: 'Take Photo/Video', onPress: handleTakePhoto },
      { text: 'Choose from Library', onPress: handlePickPhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [handlePickPhoto, handleTakePhoto]);

  // ─── SAVE ───
  const handleSave = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed && !media) {
      Alert.alert('Add something', 'Write a note or attach a photo/video to save this memory.');
      return;
    }

    setSaving(true);
    impact(ImpactFeedbackStyle.Medium);

    try {
      await DataLayer.saveMemory({
        content: trimmed || '',
        type: 'moment',
        mood: null,
        isPrivate: false,
        mediaUri: media?.uri || undefined,
        mimeType: media?.mimeType || undefined,
        fileName: media ? `memory_${Date.now()}.${media.type === 'video' ? 'mp4' : 'jpg'}` : undefined,
      });

      notification(NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (err) {
      setSaving(false);
      if (__DEV__) console.warn('[AddMemory] Save failed:', err?.message);
      Alert.alert('Error', 'Could not save your memory. Please try again.');
    }
  }, [content, media, navigation]);

  const canSave = (content.trim().length > 0 || !!media) && !saving;

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      <LinearGradient
        colors={isDark
          ? [t.background, '#120206', '#0A0003', t.background]
          : [t.background, t.surfaceSecondary, t.background]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <GlowOrb color={t.primary} size={400} top={-160} left={SCREEN_W - 200} opacity={isDark ? 0.16 : 0.07} />
      <FilmGrain opacity={0.08} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <CloseScreenHeader
          title="New Snapshot"
          subtitle="CAPTURE THE MOMENT"
          titleColor={t.text}
          closeColor={t.text}
          onClose={() => navigation.goBack()}
          rightAccessory={(
            <TouchableOpacity
              onPress={handleSave}
              disabled={!canSave}
              style={[styles.saveButton, {
                backgroundColor: canSave ? withAlpha(t.primary, 0.15) : 'transparent',
                borderColor: canSave ? withAlpha(t.primary, 0.3) : 'transparent'
              }]}
            >
              {saving
                ? <ActivityIndicator size="small" color={t.primary} />
                : <Text style={[styles.saveButtonText, { color: canSave ? t.primary : t.subtext }]}>Save</Text>
              }
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
            {/* ── Photo/Video Drop-Zone ── */}
            <Animated.View entering={FadeInDown.delay(50).springify().damping(18)}>
              {media ? (
                <View style={styles.photoContainer}>
                  <Image source={{ uri: media.uri }} style={styles.photoPreview} resizeMode="cover" />
                  {media.type === 'video' && (
                    <View style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center'}}>
                      <Icon name="play-circle-outline" size={48} color="#FFF" />
                    </View>
                  )}
                  <TouchableOpacity
                    style={[styles.removePhotoBtn, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
                    onPress={() => { selection(); setMedia(null); }}
                    hitSlop={10}
                  >
                    <Icon name="close-outline" size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.photoPlaceholderContainer}
                  onPress={handlePhotoPress}
                  activeOpacity={0.8}
                >
                  <BlurView intensity={isDark ? 45 : 25} tint={isDark ? 'dark' : 'light'} style={[styles.photoPlaceholderBlur, { backgroundColor: t.surface }]}>
                    <Icon name="camera-outline" size={32} color={t.text} />
                    <Text style={[styles.photoPlaceholderText, { color: t.text }]}>Add a Photo or Video</Text>
                    <Text style={[styles.photoPlaceholderSub, { color: t.subtext }]}>
                      Videos under 3 min · protected in your account
                    </Text>
                  </BlurView>
                </TouchableOpacity>
              )}
            </Animated.View>

            {/* ── Text input ── */}
            <Animated.View entering={FadeInDown.delay(80).springify().damping(18)} style={styles.inputContainer}>
              <BlurView intensity={isDark ? 45 : 25} tint={isDark ? 'dark' : 'light'} style={[styles.inputBlur, { backgroundColor: t.surface }]}>
                <TextInput
                  ref={inputRef}
                  style={[styles.input, { color: t.text }]}
                  placeholder="What happened? How did it feel?"
                  placeholderTextColor={withAlpha(t.text, 0.4)}
                  value={content}
                  onChangeText={setContent}
                  multiline
                  maxLength={1000}
                  autoFocus={false}
                  textAlignVertical="top"
                />
                <Text style={[styles.charCount, { color: withAlpha(t.subtext, 0.5) }]}>{content.length}/1000</Text>
              </BlurView>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const getShadow = (isDark) => Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: isDark ? 0.3 : 0.08, shadowRadius: 20 },
  android: { elevation: 6 },
});

const createStyles = (t, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.background },
  safeArea: { flex: 1 },

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

  // ── Photo Drop-Zone ──
  photoPlaceholderContainer: {
    borderRadius: 24,
    ...getShadow(isDark),
  },
  photoPlaceholderBlur: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    paddingVertical: 46,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  photoContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    ...getShadow(isDark),
  },
  photoPreview: {
    width: '100%',
    height: 240,
    borderRadius: 24,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    fontFamily: SERIF_FONT,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  photoPlaceholderSub: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '500',
  },

  // ── Text input ──
  inputContainer: {
    borderRadius: 24,
    ...getShadow(isDark),
  },
  inputBlur: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    padding: SPACING.xl,
    overflow: 'hidden',
  },
  input: {
    fontFamily: SYSTEM_FONT,
    fontSize: 17,
    lineHeight: 25,
    minHeight: 120,
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
