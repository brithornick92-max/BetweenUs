import React, { useState, useRef, useMemo } from "react";
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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { journalStorage } from "../utils/storage";
import { useTheme } from "../context/ThemeContext";
import { useEntitlements } from "../context/EntitlementsContext";
import {
  TYPOGRAPHY,
  SPACING,
  BORDER_RADIUS,
  ICON_SIZES,
} from "../utils/theme";

const moods = [
  { id: "calm", label: "Calm", icon: "leaf" },
  { id: "connected", label: "Connected", icon: "heart-outline" },
  { id: "reflective", label: "Reflective", icon: "book-open-outline" },
  { id: "energized", label: "Energized", icon: "lightning-bolt-outline" },
];

export default function JournalEntryScreen({ navigation, route }) {
  const { entry } = route.params || {};
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();

  // Free users cannot create/edit journal entries
  React.useEffect(() => {
    if (!isPremium) {
      showPaywall?.('unlimitedJournalHistory');
      navigation.goBack();
    }
  }, [isPremium]);

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
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const entryData = {
        id: entry?.id,
        title: title.trim(),
        content: content.trim(),
        mood,
        imageUri: imageUri || null,
        isShared,
        date: entry?.date || new Date().toISOString(),
        createdAt: entry?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      await journalStorage.saveEntry(entryData);
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
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await journalStorage.deleteEntry(entry.id);
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (err) {
      Alert.alert("Error", "Couldn't open your photo library.");
    }
  };
    // Render UI
    return (
      <View style={styles.container}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
      <LinearGradient
        colors={[colors.primary + "08", "transparent", "transparent"]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Animated.View
            entering={FadeIn.duration(600)}
            style={styles.header}
          >
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="chevron-left"
                size={28}
                color={colors.text}
              />
            </TouchableOpacity>

            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>
                {entry ? "Edit Reflection" : "New Reflection"}
              </Text>
              <Text style={styles.headerSubtitle}>
                {new Date().toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "long",
                  day: "numeric",
                })}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.85}
            >
              <Text style={styles.saveText}>{isSaving ? "..." : "Save"}</Text>
            </TouchableOpacity>
          </Animated.View>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: SPACING.xxxl }}
          >
            <Animated.View
              entering={FadeInDown.springify().damping(18)}
              style={styles.promptCardContainer}
            >
              <BlurView intensity={20} tint={isDark ? "dark" : "light"} style={styles.blurContainer}>
                <TextInput
                  style={styles.promptInput}
                  placeholder="Capture your evening..."
                  placeholderTextColor={colors.text + "40"}
                  value={title}
                  onChangeText={setTitle}
                  multiline
                  selectionColor={colors.primary}
                />
              </BlurView>
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(150).duration(600)}
              style={styles.moodContainer}
            >
              {moods.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => {
                    setMood(m.id);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[
                    styles.moodChip,
                    mood === m.id && {
                      backgroundColor: colors.primary,
                      borderColor: colors.primary,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={m.icon}
                    size={14}
                    color={mood === m.id ? colors.text : colors.primary}
                  />
                  <Text
                    style={[
                      styles.moodText,
                      {
                        color: mood === m.id ? colors.text : colors.primary,
                      },
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(225).duration(600)}
              style={styles.imagePickerCard}
            >
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <MaterialCommunityIcons
                    name="image-outline"
                    size={24}
                    color={colors.textMuted}
                  />
                  <Text style={styles.imagePlaceholderText}>
                    Use default background or add a photo
                  </Text>
                </View>
              )}

              <View style={styles.imagePickerActions}>
                <TouchableOpacity
                  style={styles.imageButton}
                  onPress={handlePickImage}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons name="image-plus" size={16} color={colors.text} />
                  <Text style={[styles.imageButtonText, { color: colors.text }]}>Choose Photo</Text>
                </TouchableOpacity>

                {imageUri && (
                  <TouchableOpacity
                    style={styles.imageButtonSecondary}
                    onPress={() => setImageUri(null)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.imageButtonSecondaryText}>Use Default</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(300).duration(800)}
              style={styles.writingField}
            >
              <TextInput
                style={styles.contentInput}
                placeholder="Let your thoughts flow beautifully..."
                placeholderTextColor={colors.text + "30"}
                value={content}
                onChangeText={handleContentChange}
                multiline
                scrollEnabled={false}
                selectionColor={colors.primary}
                autoFocus={!entry}
              />
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(450).duration(600)}
              style={styles.footer}
            >
              <View style={styles.footerActions}>
                <TouchableOpacity
                  onPress={() => {
                    setIsShared(!isShared);
                    Haptics.selectionAsync();
                  }}
                  style={[
                    styles.actionToggle,
                    isShared && styles.actionToggleActive,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={isShared ? "account-multiple" : "lock-outline"}
                    size={ICON_SIZES.sm}
                    color={isShared ? colors.text : colors.primary}
                  />
                  <Text
                    style={[
                      styles.actionText,
                      {
                        color: isShared ? colors.text : colors.primary,
                      },
                    ]}
                  >
                    {isShared ? "Shared with Partner" : "Private Entry"}
                  </Text>
                </TouchableOpacity>

                {entry && (
                  <TouchableOpacity
                    onPress={handleDelete}
                    style={styles.deleteCircle}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons
                      name="delete-outline"
                      size={ICON_SIZES.md}
                      color={colors.textMuted}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerTitleContainer: {
    alignItems: "center",
  },
  headerTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    opacity: 0.9,
  },
  headerSubtitle: {
    color: colors.primary,
    fontSize: 11,
    marginTop: 2,
    opacity: 0.9,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  saveText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
  },
  promptCardContainer: {
    marginTop: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.primary + "20",
  },
  blurContainer: {
    padding: SPACING.xl,
  },
  promptInput: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 32,
    fontFamily: Platform.select({
      ios: "Playfair Display",
      android: "PlayfairDisplay_300Light",
    }),
    fontWeight: "300",
  },
  moodContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: SPACING.xl,
    gap: SPACING.sm,
  },
  moodChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: colors.primary + "40",
    gap: 6,
  },
  moodText: {
    fontSize: 13,
    fontWeight: "500",
  },
  imagePickerCard: {
    marginTop: SPACING.lg,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  imagePreview: {
    width: "100%",
    height: 180,
  },
  imagePlaceholder: {
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  imagePlaceholderText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  imagePickerActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    gap: 10,
  },
  imageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    flex: 1,
  },
  imageButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  imageButtonSecondary: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  imageButtonSecondaryText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  writingField: {
    marginTop: SPACING.xxl,
    minHeight: 360,
  },
  contentInput: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 28,
    textAlignVertical: "top",
  },
  footer: {
    marginTop: SPACING.xl,
    paddingTop: SPACING.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  footerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actionToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.primary + "15",
    gap: SPACING.sm,
  },
  actionToggleActive: {
    backgroundColor: colors.primary,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  deleteCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface2 + "60",
    alignItems: "center",
    justifyContent: "center",
  },
});
