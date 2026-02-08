import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from 'expo-haptics';
import { useTheme } from "../context/ThemeContext";
import { journalStorage } from "../utils/storage";
import { TYPOGRAPHY, SPACING, BORDER_RADIUS, GRADIENTS, COLORS } from "../utils/theme";

export default function JournalEntryScreen({ navigation, route }) {
  const { entry } = route.params || {};
  const { theme: activeTheme, isDark } = useTheme();

  const t = useMemo(() => {
    const base = activeTheme?.colors ? activeTheme.colors : activeTheme;

    return {
      background: base?.background ?? (isDark ? COLORS.warmCharcoal : COLORS.softCream),
      surface: base?.surface ?? (isDark ? COLORS.deepPlum : "#FFFFFF"),
      text: base?.text ?? (isDark ? COLORS.softCream : COLORS.charcoal),
      textSecondary:
        base?.textSecondary ??
        (isDark ? "rgba(246,242,238,0.60)" : "rgba(51,51,51,0.60)"),
      blushRose: base?.accent ?? COLORS.blushRose,
      mutedGold: base?.mutedGold ?? COLORS.mutedGold,
      gradients: {
        primary:
          activeTheme?.gradients?.primary ||
          base?.gradients?.primary ||
          GRADIENTS.primary,
      },
    };
  }, [activeTheme, isDark]);

  const [title, setTitle] = useState(entry?.title || "");
  const [content, setContent] = useState(entry?.content || "");
  const [mood, setMood] = useState(entry?.mood || "grateful");
  const [isShared, setIsShared] = useState(entry?.isShared ?? false);
  const [isSaving, setIsSaving] = useState(false);

  const fadeAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnimation, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const moods = [
    { id: "grateful", emoji: "🙏", label: "Grateful", color: "#40E0D0" },
    { id: "happy", emoji: "😊", label: "Happy", color: COLORS.mutedGold },
    { id: "loving", emoji: "🥰", label: "Loving", color: "#FF69B4" },
    { id: "excited", emoji: "🤩", label: "Excited", color: "#FF6B35" },
    { id: "peaceful", emoji: "😌", label: "Peaceful", color: "#87CEEB" },
    { id: "reflective", emoji: "🤔", label: "Reflective", color: "#9370DB" },
  ];

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
    await Haptics.selectionAsync();

    try {
      const entryData = {
        id: entry?.id,
        title: title.trim(),
        content: content.trim(),
        mood,
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

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      {/* Atmospheric Background */}
      <LinearGradient
        colors={
          isDark
            ? [COLORS.warmCharcoal, COLORS.deepPlum + "30", COLORS.warmCharcoal]
            : [COLORS.softCream, COLORS.blushRose + "10", COLORS.mutedGold + "05", COLORS.softCream]
        }
        style={StyleSheet.absoluteFill}
        locations={isDark ? [0, 0.5, 1] : [0, 0.35, 0.7, 1]}
      />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Animated.View style={[styles.content, { opacity: fadeAnimation }]}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="arrow-left" size={24} color={t.text} />
              </TouchableOpacity>

              <View style={styles.headerContent}>
                <Text style={[styles.headerTitle, { color: t.text }]}>
                  {entry ? "Edit Entry" : "New Entry"}
                </Text>
                <Text style={[styles.headerSubtitle, { color: t.textSecondary }]}>
                  {new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.saveButton, isSaving && styles.savingButton]}
                onPress={handleSave}
                disabled={isSaving}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={t.gradients.primary}
                  style={styles.saveButtonGradient}
                >
                  {isSaving ? (
                    <MaterialCommunityIcons name="loading" size={20} color="#FFF" />
                  ) : (
                    <MaterialCommunityIcons name="check" size={20} color="#FFF" />
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              {/* Title Input */}
              <View style={styles.inputSection}>
                <BlurView
                  intensity={isDark ? 40 : 70}
                  tint={isDark ? "dark" : "light"}
                  style={styles.inputCard}
                >
                  <LinearGradient
                    colors={
                      isDark
                        ? ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.02)"]
                        : ["rgba(255,255,255,0.9)", "rgba(255,255,255,0.6)"]
                    }
                    style={StyleSheet.absoluteFill}
                  />
                  
                  <TextInput
                    style={[styles.titleInput, { color: t.text }]}
                    placeholder="What's on your mind?"
                    placeholderTextColor={t.textSecondary}
                    value={title}
                    onChangeText={setTitle}
                    maxLength={100}
                  />
                </BlurView>
              </View>

              {/* Mood Selection */}
              <View style={styles.moodSection}>
                <Text style={[styles.sectionTitle, { color: t.text }]}>How are you feeling?</Text>
                
                <View style={styles.moodGrid}>
                  {moods.map((moodOption) => (
                    <TouchableOpacity
                      key={moodOption.id}
                      style={[
                        styles.moodCard,
                        mood === moodOption.id && styles.selectedMoodCard,
                      ]}
                      onPress={() => {
                        setMood(moodOption.id);
                        Haptics.selectionAsync();
                      }}
                      activeOpacity={0.8}
                    >
                      <BlurView
                        intensity={isDark ? 30 : 60}
                        tint={isDark ? "dark" : "light"}
                        style={styles.moodCardBlur}
                      >
                        <LinearGradient
                          colors={
                            mood === moodOption.id
                              ? [`${moodOption.color}20`, `${moodOption.color}10`]
                              : isDark
                              ? ["rgba(255,255,255,0.03)", "transparent"]
                              : ["rgba(255,255,255,0.8)", "rgba(255,255,255,0.5)"]
                          }
                          style={StyleSheet.absoluteFill}
                        />
                        
                        <Text style={styles.moodEmoji}>{moodOption.emoji}</Text>
                        <Text style={[styles.moodLabel, { color: t.text }]}>
                          {moodOption.label}
                        </Text>
                      </BlurView>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Content Input */}
              <View style={styles.contentSection}>
                <Text style={[styles.sectionTitle, { color: t.text }]}>Your thoughts</Text>
                
                <BlurView
                  intensity={isDark ? 40 : 70}
                  tint={isDark ? "dark" : "light"}
                  style={styles.contentCard}
                >
                  <LinearGradient
                    colors={
                      isDark
                        ? ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.02)"]
                        : ["rgba(255,255,255,0.9)", "rgba(255,255,255,0.6)"]
                    }
                    style={StyleSheet.absoluteFill}
                  />
                  
                  <TextInput
                    style={[styles.contentInput, { color: t.text }]}
                    placeholder="Write about your day, your feelings, or anything that comes to mind..."
                    placeholderTextColor={t.textSecondary}
                    value={content}
                    onChangeText={setContent}
                    multiline
                    textAlignVertical="top"
                    maxLength={2000}
                  />
                  
                  <Text style={[styles.characterCount, { color: t.textSecondary }]}>
                    {content.length}/2000
                  </Text>
                </BlurView>
              </View>

              {/* Share with Partner Toggle */}
              <View style={styles.shareSection}>
                <BlurView
                  intensity={isDark ? 40 : 70}
                  tint={isDark ? "dark" : "light"}
                  style={styles.shareCard}
                >
                  <LinearGradient
                    colors={
                      isDark
                        ? ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.02)"]
                        : ["rgba(255,255,255,0.9)", "rgba(255,255,255,0.6)"]
                    }
                    style={StyleSheet.absoluteFill}
                  />
                  
                  <View style={styles.shareContent}>
                    <View style={styles.shareInfo}>
                      <MaterialCommunityIcons
                        name={isShared ? "account-multiple" : "lock"}
                        size={24}
                        color={isShared ? t.blushRose : t.textSecondary}
                      />
                      <View style={styles.shareText}>
                        <Text style={[styles.shareTitle, { color: t.text }]}>
                          {isShared ? "Shared with Partner" : "Private Entry"}
                        </Text>
                        <Text style={[styles.shareSubtitle, { color: t.textSecondary }]}>
                          {isShared
                            ? "Your partner can see this entry"
                            : "Only you can see this entry"}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.shareToggle,
                        {
                          backgroundColor: isShared ? t.blushRose : t.textSecondary + "30",
                        },
                      ]}
                      onPress={() => {
                        setIsShared(!isShared);
                        Haptics.selectionAsync();
                      }}
                      activeOpacity={0.8}
                    >
                      <Animated.View
                        style={[
                          styles.shareToggleThumb,
                          {
                            transform: [{ translateX: isShared ? 20 : 0 }],
                          },
                        ]}
                      />
                    </TouchableOpacity>
                  </View>
                </BlurView>
              </View>

              {/* Delete Button (only for existing entries) */}
              {entry && (
                <View style={styles.deleteSection}>
                  <TouchableOpacity
                    style={[styles.deleteButton, { borderColor: "#FF3B30" }]}
                    onPress={handleDelete}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="delete-outline" size={20} color="#FF3B30" />
                    <Text style={[styles.deleteButtonText, { color: "#FF3B30" }]}>
                      Delete Entry
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardView: { flex: 1 },
  content: { flex: 1 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.xl,
    paddingTop: 20,
    paddingBottom: 30,
  },

  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  headerContent: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: SPACING.lg,
  },

  headerTitle: {
    fontFamily: Platform.select({
      ios: "PlayfairDisplay-Bold",
      android: "PlayfairDisplay_700Bold",
    }),
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },

  headerSubtitle: {
    fontSize: 14,
  },

  saveButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
  },

  savingButton: {
    opacity: 0.7,
  },

  saveButtonGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  scrollView: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
  },

  // Input Section
  inputSection: {
    marginBottom: 40,
  },

  inputCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
    }),
  },

  titleInput: {
    fontSize: 20,
    fontWeight: "600",
    padding: 24,
    minHeight: 60,
  },

  // Mood Section
  moodSection: {
    marginBottom: 40,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 20,
  },

  moodGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
  },

  moodCard: {
    width: "30%",
    aspectRatio: 1,
  },

  selectedMoodCard: {
    transform: [{ scale: 1.05 }],
  },

  moodCardBlur: {
    flex: 1,
    borderRadius: BORDER_RADIUS.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },

  moodEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },

  moodLabel: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },

  // Content Section
  contentSection: {
    marginBottom: 40,
  },

  contentCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    position: "relative",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
    }),
  },

  contentInput: {
    fontSize: 16,
    lineHeight: 24,
    padding: 24,
    minHeight: 200,
  },

  characterCount: {
    position: "absolute",
    bottom: 12,
    right: 16,
    fontSize: 12,
  },

  // Share Section
  shareSection: {
    marginBottom: 40,
  },

  shareCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },

  shareContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
  },

  shareInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 16,
  },

  shareText: {
    flex: 1,
  },

  shareTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },

  shareSubtitle: {
    fontSize: 13,
  },

  shareToggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    padding: 2,
    justifyContent: "center",
  },

  shareToggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },

  // Delete Section
  deleteSection: {
    marginBottom: 60,
  },

  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: 8,
  },

  deleteButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});