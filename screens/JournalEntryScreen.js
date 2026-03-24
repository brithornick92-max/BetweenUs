// screens/JournalEntryScreen.js — Private Reflections
// Velvet Glass · Apple Editorial Vertical Rhythm · Haptic Stationery Physics

import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from '../components/Icon';
import { BlurView } from "expo-blur";
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import * as ImagePicker from "expo-image-picker";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { journalStorage } from "../utils/storage";
import { DataLayer } from "../services/localfirst";
import { useTheme } from "../context/ThemeContext";
import { useEntitlements } from "../context/EntitlementsContext";
import { PremiumFeature } from '../utils/featureFlags';
import {
  TYPOGRAPHY,
  SPACING,
  BORDER_RADIUS,
  ICON_SIZES,
  withAlpha,
} from "../utils/theme";
import GlowOrb from "../components/GlowOrb";
import FilmGrain from "../components/FilmGrain";

const { width: SCREEN_W } = Dimensions.get('window');
const MAX_LEN = 5000;

const moods = [
  { id: "calm", label: "Calm", icon: "leaf-outline" },
  { id: "connected", label: "Connected", icon: "heart-outline" },
  { id: "reflective", label: "Reflective", icon: "book-outline" },
  { id: "energized", label: "Energized", icon: "flash-outline" },
];

export default function JournalEntryScreen({ navigation, route }) {
  const { entry } = route.params || {};
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();

  // integrated premium logic
  useEffect(() => {
    if (!isPremium) {
      showPaywall?.(PremiumFeature.UNLIMITED_JOURNAL_HISTORY);
      navigation.goBack();
    }
  }, [isPremium, navigation, showPaywall]);

  const [title, setTitle] = useState(entry?.title || "");
  const [content, setContent] = useState(entry?.content || "");
  const [mood, setMood] = useState(entry?.mood || "calm");
  const [imageUri, setImageUri] = useState(
    entry?.imageUri || entry?.photoUri || entry?.mediaUri || null
  );
  const [isShared, setIsShared] = useState(entry?.isShared ?? false);
  const [isSaving, setIsSaving] = useState(false);

  const lastHapticLength = useRef(0);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Title Required", "Please add a title for your journal entry.");
      return;
    }

    if (!content.trim()) {
      Alert.alert("Content Required", "Please write something in your journal entry.");
      return;
    }

    setIsSaving(true);
    notification(NotificationFeedbackType.Success);

    try {
      const entryData = {
        title: title.trim(),
        body: content.trim(),
        mood,
        isPrivate: !isShared,
      };

      if (entry?.id) {
        await DataLayer.updateJournalEntry(entry.id, entryData);
      } else {
        await DataLayer.saveJournalEntry(entryData);
      }
      navigation.goBack();
    } catch (error) {
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
            } catch (error) {
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
      text.length > 0 &&
      text.length % 50 === 0 &&
      text.length !== lastHapticLength.current
    ) {
      impact(ImpactFeedbackStyle.Light);
      lastHapticLength.current = text.length;
    }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Allow photo access to add a background image.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: true,
        aspect: [4, 5],
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setImageUri(result.assets[0].uri);
        impact(ImpactFeedbackStyle.Light);
      }
    } catch (err) {
      Alert.alert("Error", "Couldn't open your photo library.");
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <FilmGrain opacity={0.1} />
      <GlowOrb color={colors.primary} size={400} top={-150} left={SCREEN_W - 200} opacity={0.1} />
      <GlowOrb color={isDark ? '#FFFFFF' : '#F2F2F7'} size={300} top={650} left={-100} opacity={isDark ? 0.1 : 0.06} />
      
      <LinearGradient
        colors={[isDark ? "#0F0514" : "#FAF7F5", colors.background]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {/* Editorial Header */}
          <Animated.View entering={FadeIn.duration(600)} style={styles.header}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: withAlpha(colors.text, 0.05) }]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Icon name="chevron-back" size={28} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={[styles.headerSubtitle, { color: colors.primary }]}>PRIVATE REFLECTION</Text>
              <Text style={[styles.headerDate, { color: colors.text }]}>
                {new Date().toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "long",
                  day: "numeric",
                })}
              </Text>
            </View>

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
          </Animated.View>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 100 }}
          >
            {/* Title Block - Large Editorial Serif */}
            <Animated.View entering={FadeInDown.delay(100).duration(800)}>
              <TextInput
                style={[styles.titleInput, { color: colors.text }]}
                placeholder="Title your thoughts..."
                placeholderTextColor={withAlpha(colors.text, 0.2)}
                value={title}
                onChangeText={setTitle}
                multiline
                selectionColor={colors.primary}
              />
            </Animated.View>

            {/* Mood Selector - Tactile Chips */}
            <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.moodSection}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>VIBE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moodRow}>
                {moods.map((m) => {
                    const active = mood === m.id;
                    return (
                        <TouchableOpacity
                            key={m.id}
                            onPress={() => {
                                setMood(m.id);
                                impact(ImpactFeedbackStyle.Light);
                            }}
                            style={[
                                styles.moodChip,
                                active && { backgroundColor: colors.primary, borderColor: colors.primary },
                                !active && { borderColor: withAlpha(colors.text, 0.1) }
                            ]}
                        >
                            <Icon
                                name={m.icon}
                                size={14}
                                color={active ? "#FFF" : colors.primary}
                            />
                            <Text style={[styles.moodText, { color: active ? "#FFF" : colors.text }]}>{m.label}</Text>
                        </TouchableOpacity>
                    );
                })}
              </ScrollView>
            </Animated.View>

            {/* Visual Anchor - Media Card */}
            <Animated.View entering={FadeInDown.delay(300).duration(600)} style={styles.mediaContainer}>
              {imageUri ? (
                <View style={styles.previewWrapper}>
                  <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                  <TouchableOpacity 
                    style={styles.removeImageBtn} 
                    onPress={() => { selection(); setImageUri(null); }}
                  >
                    <Icon name="close-outline" size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity 
                  style={[styles.imagePlaceholder, { borderColor: withAlpha(colors.text, 0.1) }]} 
                  onPress={handlePickImage}
                >
                  <Icon name="camera-plus-outline" size={24} color={colors.primary} />
                  <Text style={[styles.placeholderText, { color: colors.textMuted }]}>Add a visual memory</Text>
                </TouchableOpacity>
              )}
            </Animated.View>

            {/* Writing Surface - High Contrast Stationery */}
            <Animated.View entering={FadeInDown.delay(400).duration(800)} style={styles.writingSurface}>
                <View style={styles.writingHeader}>
                    <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>THE REFLECTION</Text>
                    <Text style={[styles.charCount, { color: colors.textMuted }]}>{content.length} characters</Text>
                </View>
                <TextInput
                    style={[styles.contentInput, { color: colors.text }]}
                    placeholder="Let your story flow here..."
                    placeholderTextColor={withAlpha(colors.text, 0.25)}
                    value={content}
                    onChangeText={handleContentChange}
                    multiline
                    scrollEnabled={false}
                    selectionColor={colors.primary}
                    autoFocus={!entry}
                />
            </Animated.View>

            {/* Footer Actions */}
            <Animated.View entering={FadeInUp.delay(600)} style={styles.footer}>
              <View style={styles.footerActions}>
                <TouchableOpacity
                  onPress={() => {
                    setIsShared(!isShared);
                    selection();
                  }}
                  activeOpacity={0.8}
                  style={[
                    styles.shareToggle,
                    { borderColor: isShared ? colors.primary : withAlpha(colors.text, 0.1) },
                    isShared && { backgroundColor: withAlpha(colors.primary, 0.08) }
                  ]}
                >
                  <Icon
                    name={isShared ? "people-outline" : "eye-off-outline"}
                    size={18}
                    color={isShared ? colors.primary : colors.textMuted}
                  />
                  <Text style={[styles.shareText, { color: isShared ? colors.primary : colors.textMuted }]}>
                    {isShared ? "Shared with Partner" : "Private Archive"}
                  </Text>
                </TouchableOpacity>

                {entry && (
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
                <Text style={[styles.securityText, { color: colors.textMuted }]}>END-TO-END ENCRYPTED</Text>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { alignItems: "center" },
  headerSubtitle: {
    fontFamily: 'Lato_700Bold',
    fontSize: 10,
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  headerDate: {
    fontFamily: 'Lato_400Regular',
    fontSize: 14,
    opacity: 0.7,
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
    ...Platform.select({
        ios: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
        android: { elevation: 4 }
    })
  },
  saveText: {
    color: "#FFF",
    fontSize: 14,
    fontFamily: 'Lato_700Bold',
  },
  scrollView: { flex: 1, paddingHorizontal: 28 },
  titleInput: {
    fontSize: 34,
    lineHeight: 42,
    fontFamily: Platform.select({ ios: "DMSerifDisplay-Regular", android: "DMSerifDisplay_400Regular" }),
    fontWeight: "300",
    marginBottom: 32,
  },
  sectionLabel: {
    fontFamily: 'Lato_700Bold',
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  moodSection: { marginBottom: 32 },
  moodRow: { gap: 10, paddingRight: 20 },
  moodChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  moodText: { fontSize: 14, fontFamily: 'Lato_700Bold' },
  mediaContainer: { marginBottom: 32 },
  imagePreview: { width: "100%", height: 220, borderRadius: 24 },
  previewWrapper: { position: 'relative' },
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
  placeholderText: { fontFamily: 'Lato_400Regular', fontSize: 14 },
  writingSurface: { marginBottom: 40 },
  writingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  charCount: { fontSize: 10, fontFamily: 'Lato_400Regular', opacity: 0.5 },
  contentInput: {
    fontSize: 18,
    lineHeight: 30,
    textAlignVertical: "top",
    fontFamily: 'Lato_400Regular',
  },
  footer: {
    paddingTop: 32,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  footerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
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
  shareText: { fontSize: 13, fontFamily: 'Lato_700Bold' },
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
  securityText: { fontSize: 9, fontFamily: 'Lato_700Bold' }
});
