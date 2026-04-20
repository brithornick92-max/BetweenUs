// screens/AddMemoryScreen.js
// Capture a shared memory with optional photo attachment.
// Apple Editorial aesthetic — Velvet Glass Materials + Original Palette.

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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';

import Icon from '../components/Icon';
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';
import { useTheme } from '../context/ThemeContext';
import { DataLayer } from '../services/localfirst';
import { impact, selection, notification, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { SPACING, withAlpha } from '../utils/theme';

const { width: SCREEN_W } = require('react-native').Dimensions.get('window');
const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });
const SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif' });

const MEMORY_TYPES = [
  { id: 'moment',      label: 'Moment',      icon: 'star-outline' },
  { id: 'first',       label: 'A First',     icon: 'star-outline' },
  { id: 'anniversary', label: 'Anniversary', icon: 'heart-outline' },
  { id: 'milestone',   label: 'Milestone',   icon: 'ribbon-outline' },
  { id: 'inside_joke', label: 'Inside Joke', icon: 'happy-outline' },
];

const MOODS = [
  { id: 'love',      icon: 'heart-outline',        label: 'Love' },
  { id: 'happy',     icon: 'happy-outline',        label: 'Happy' },
  { id: 'passionate',icon: 'flame-outline',         label: 'Passionate' },
  { id: 'playful',   icon: 'game-controller-outline', label: 'Playful' },
  { id: 'tender',    icon: 'rose-outline',          label: 'Tender' },
  { id: 'calm',      icon: 'moon-outline',          label: 'Calm' },
  { id: 'grateful',  icon: 'sparkles-outline',      label: 'Grateful' },
];

export default function AddMemoryScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();

  const [content, setContent] = useState('');
  const [selectedType, setSelectedType] = useState('moment');
  const [selectedMood, setSelectedMood] = useState(null);
  const [imageUri, setImageUri] = useState(null);
  const [saving, setSaving] = useState(false);

  const inputRef = useRef(null);

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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        if (asset.fileSize && asset.fileSize > 10_000_000) {
          Alert.alert('Image Too Large', 'Please choose a photo under 10 MB.');
          return;
        }
        setImageUri(asset.uri);
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
        quality: 0.85,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets?.[0]) {
        setImageUri(result.assets[0].uri);
        impact(ImpactFeedbackStyle.Light);
      }
    } catch (err) {
      if (__DEV__) console.warn('[AddMemory] Camera failed:', err?.message);
      Alert.alert('Error', "Couldn't open the camera.");
    }
  }, []);

  const handlePhotoPress = useCallback(() => {
    Alert.alert('Add Photo', 'Choose how to add a photo', [
      { text: 'Take Photo', onPress: handleTakePhoto },
      { text: 'Choose from Library', onPress: handlePickPhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [handlePickPhoto, handleTakePhoto]);

  // ─── SAVE ───
  const handleSave = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed && !imageUri) {
      Alert.alert('Add something', 'Write a note or attach a photo to save this memory.');
      return;
    }

    setSaving(true);
    impact(ImpactFeedbackStyle.Medium);

    try {
      await DataLayer.saveMemory({
        content: trimmed || '',
        type: selectedType,
        mood: selectedMood,
        isPrivate: false,
        mediaUri: imageUri || undefined,
        mimeType: imageUri ? 'image/jpeg' : undefined,
        fileName: imageUri ? `memory_${Date.now()}.jpg` : undefined,
      });

      notification(NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (err) {
      setSaving(false);
      if (__DEV__) console.warn('[AddMemory] Save failed:', err?.message);

      if (err?.message?.includes('COUPLE_KEY_MISSING')) {
        Alert.alert(
          'Sync needed',
          'Your partner encryption key is unavailable. Save as private, or reconnect with your partner first.',
          [
            { text: 'Save as Private', onPress: async () => {
              try {
                await DataLayer.saveMemory({
                  content: trimmed || '',
                  type: selectedType,
                  mood: selectedMood,
                  isPrivate: true,
                  mediaUri: imageUri || undefined,
                  mimeType: imageUri ? 'image/jpeg' : undefined,
                  fileName: imageUri ? `memory_${Date.now()}.jpg` : undefined,
                });
                notification(NotificationFeedbackType.Success);
                navigation.goBack();
              } catch (e2) {
                Alert.alert('Error', 'Could not save. Please try again.');
                setSaving(false);
              }
            }},
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      } else {
        Alert.alert('Error', 'Could not save your memory. Please try again.');
      }
    }
  }, [content, imageUri, navigation, selectedMood, selectedType]);

  const canSave = (content.trim().length > 0 || !!imageUri) && !saving;

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
        {/* ── Nav Header ── */}
        <View style={styles.navHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={16} style={styles.iconButton}>
            <Icon name="close-outline" size={26} color={t.text} />
          </TouchableOpacity>
          
          {/* Centered Absolute Title */}
          <View style={styles.navTitleContainer}>
            <Text style={[styles.navTitle, { color: t.text }]}>New Memory</Text>
          </View>

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
        </View>

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
            {/* ── Photo Drop-Zone ── */}
            <Animated.View entering={FadeInDown.delay(50).springify().damping(18)}>
              {imageUri ? (
                <View style={styles.photoContainer}>
                  <Image source={{ uri: imageUri }} style={styles.photoPreview} resizeMode="cover" />
                  <TouchableOpacity
                    style={[styles.removePhotoBtn, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
                    onPress={() => { selection(); setImageUri(null); }}
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
                    <Text style={[styles.photoPlaceholderText, { color: t.text }]}>Add a Photo</Text>
                    <Text style={[styles.photoPlaceholderSub, { color: t.subtext }]}>
                      Optional · stays encrypted
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

            {/* ── Memory type ── */}
            <Animated.View entering={FadeInDown.delay(110).springify().damping(18)}>
              <Text style={[styles.sectionLabel, { color: t.subtext }]}>TYPE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
                {MEMORY_TYPES.map((mt) => {
                  const active = selectedType === mt.id;
                  return (
                    <TouchableOpacity
                      key={mt.id}
                      style={styles.chipContainer}
                      onPress={() => { selection(); setSelectedType(mt.id); }}
                      activeOpacity={0.7}
                    >
                      <BlurView 
                        intensity={isDark ? 40 : 20} 
                        tint={isDark ? 'dark' : 'light'} 
                        style={[styles.typeChipBlur, {
                          backgroundColor: active ? withAlpha(t.primary, 0.15) : t.surface,
                          borderColor: active ? withAlpha(t.primary, 0.3) : t.border,
                        }]}
                      >
                        <Icon name={mt.icon} size={14} color={active ? t.primary : t.subtext} />
                        <Text style={[styles.typeChipLabel, { color: active ? t.text : t.subtext }]}>{mt.label}</Text>
                      </BlurView>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Animated.View>

            {/* ── Mood ── */}
            <Animated.View entering={FadeInDown.delay(140).springify().damping(18)}>
              <Text style={[styles.sectionLabel, { color: t.subtext }]}>MOOD</Text>
              <View style={styles.moodRow}>
                {MOODS.map((mood) => {
                  const active = selectedMood === mood.id;
                  return (
                    <TouchableOpacity
                      key={mood.id}
                      style={styles.chipContainer}
                      onPress={() => { selection(); setSelectedMood(active ? null : mood.id); }}
                      activeOpacity={0.7}
                    >
                      <BlurView 
                        intensity={isDark ? 40 : 20} 
                        tint={isDark ? 'dark' : 'light'} 
                        style={[styles.moodChipBlur, {
                          backgroundColor: active ? withAlpha(t.primary, 0.15) : t.surface,
                          borderColor: active ? withAlpha(t.primary, 0.3) : t.border,
                        }]}
                      >
                        <Icon name={mood.icon} size={22} color={active ? t.primary : t.subtext} />
                      </BlurView>
                    </TouchableOpacity>
                  );
                })}
              </View>
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

  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.screen,
    paddingTop: 12,
    paddingBottom: 8,
    position: 'relative',
  },
  iconButton: { 
    padding: 8, 
    marginLeft: -8, 
    width: 44, 
    alignItems: 'flex-start' 
  },
  navTitleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  navTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
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

  // ── Sections ──
  sectionLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  // ── Type & Mood Chips ──
  chipContainer: {
    // Allows shadow to exist outside the overflow: hidden of the blur view
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: SPACING.screen,
  },
  typeChipBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  typeChipLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '700',
  },
  moodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  moodChipBlur: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
