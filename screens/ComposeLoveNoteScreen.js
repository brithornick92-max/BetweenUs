// screens/ComposeLoveNoteScreen.js — Write a love note with optional photo
import React, { useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { useTheme } from "../context/ThemeContext";
import { useAppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useEntitlements } from "../context/EntitlementsContext";
import DataLayer from "../services/data/DataLayer";
import { TYPOGRAPHY, SPACING, BORDER_RADIUS, ICON_SIZES } from "../utils/theme";

const { width: screenWidth } = Dimensions.get("window");

const STATIONERY_OPTIONS = [
  { id: "love",    image: require("../assets/intimate.png"), gradient: ["#9A2E5E", "#7A1E4E"], label: "Intimate" },
  { id: "fun",     image: require("../assets/fun.png"),      gradient: ["#F5A623", "#F7D046"], label: "Fun" },
  { id: "sexy",    image: require("../assets/sexy.png"),     gradient: ["#C0392B", "#8E2323"], label: "Sexy" },
  { id: "spicy",   image: require("../assets/spicy.png"),    gradient: ["#D35400", "#A83210"], label: "Spicy" },
  { id: "sweet",   image: require("../assets/sweet.png"),    gradient: ["#D4856A", "#A85A4A"], label: "Sweet" },
  { id: "flirty",  image: require("../assets/flirty.png"),   gradient: ["#8E44AD", "#6C3483"], label: "Flirty" },
  { id: "classic", image: require("../assets/classic.png"),  gradient: ["#5D6D7E", "#2C3E50"], label: "Classic" },
  { id: "dreamy",  image: require("../assets/dreamy.png"),   gradient: ["#3A4A7A", "#1E2E5E"], label: "Dreamy" },
];

const PROMPTS = [
  "I love you because…",
  "My favorite memory with you is…",
  "You make me feel…",
  "I can't stop thinking about…",
  "Tonight I want to…",
  "You looked so good when…",
  "Remember that time we…",
  "Something I'll never get tired of…",
];

export default function ComposeLoveNoteScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { state } = useAppContext();
  const { userProfile } = useAuth();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();

  // Free users: love notes are locked
  if (!isPremium) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
          <MaterialCommunityIcons name="email-lock-outline" size={64} color={colors.primary} style={{ marginBottom: 16 }} />
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '600', marginBottom: 8, textAlign: 'center' }}>
            Love Notes are Premium
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
            Write heartfelt notes, choose stationery, add photos — and send them to your partner.
          </Text>
          <TouchableOpacity
            onPress={() => showPaywall?.('loveNotes')}
            style={{ backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 }}
            activeOpacity={0.85}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Upgrade to Premium</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const [text, setText] = useState("");
  const [imageUri, setImageUri] = useState(null);
  const [selectedStationery, setSelectedStationery] = useState(STATIONERY_OPTIONS[0]);
  const [isSending, setIsSending] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);

  const inputRef = useRef(null);
  const lastHapticLen = useRef(0);

  const senderName =
    userProfile?.displayName || userProfile?.name || state?.partnerLabel || null;

  const styles = useMemo(() => createStyles(colors), [colors]);

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Allow photo access to add a picture to your note.");
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
    } catch {
      Alert.alert("Error", "Couldn't open your photo library.");
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Allow camera access to take a photo for your note.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.85,
        allowsEditing: true,
        aspect: [4, 5],
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setImageUri(result.assets[0].uri);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {
      Alert.alert("Error", "Couldn't open the camera.");
    }
  };

  const handleSend = async () => {
    if (!text.trim()) {
      Alert.alert("Write something", "Your love note needs at least a few words. 💕");
      return;
    }

    setIsSending(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      await DataLayer.saveLoveNote({
        text: text.trim(),
        imageUri: imageUri || null,
        stationeryId: selectedStationery.id,
        senderName: senderName || null,
      });
      navigation.goBack();
    } catch (err) {
      console.error('[ComposeLoveNote] Send failed:', err);
      const message = err?.message?.startsWith('COUPLE_KEY_MISSING')
        ? 'Your partner encryption key isn\'t ready yet. Make sure both of you have completed pairing.'
        : "Couldn't save your love note. Please try again.";
      Alert.alert("Error", message);
    } finally {
      setIsSending(false);
    }
  };

  const handleTextChange = (value) => {
    setText(value);
    if (value.length > 0 && value.length % 40 === 0 && value.length !== lastHapticLen.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      lastHapticLen.current = value.length;
    }
  };

  const handlePickPrompt = (prompt) => {
    setText(prompt);
    setShowPrompts(false);
    Haptics.selectionAsync();
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ── Preview ──────────────────────────────────
  const previewBg = imageUri
    ? null
    : selectedStationery.gradient;

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
          {/* Header */}
          <Animated.View entering={FadeIn.duration(500)} style={styles.header}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>New Love Note</Text>
              <Text style={styles.headerSubtitle}>
                {text.length > 0 ? `${text.length} characters` : "Express yourself"}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={isSending || !text.trim()}
              activeOpacity={0.85}
            >
              <Text style={styles.sendText}>{isSending ? "…" : "Send"}</Text>
            </TouchableOpacity>
          </Animated.View>

          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: SPACING.xxxl }}
          >
            {/* Live Preview Card */}
            <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.previewWrapper}>
              <View style={styles.previewCard}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.previewImage} />
                ) : (
                  <>
                    <Image source={selectedStationery.image} style={styles.previewStationeryImage} blurRadius={1} />
                    <LinearGradient colors={previewBg} style={styles.previewGradientOverlay} />
                  </>
                )}
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.65)"]}
                  style={styles.previewOverlay}
                />
                <View style={styles.previewTextContainer}>
                  <Text style={styles.previewText} numberOfLines={5}>
                    {text || "Your words will appear here…"}
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* Stationery Picker */}
            <Animated.View entering={FadeInDown.delay(100).duration(600)}>
              <Text style={styles.sectionLabel}>STATIONERY</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.stationeryRow}
              >
                {STATIONERY_OPTIONS.map((opt) => {
                  const isActive = selectedStationery.id === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => {
                        setSelectedStationery(opt);
                        Haptics.selectionAsync();
                      }}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={opt.gradient}
                        style={[
                          styles.stationeryChip,
                          isActive && { borderColor: colors.text, borderWidth: 2 },
                        ]}
                      >
                        <Image source={opt.image} style={styles.stationeryImage} />
                      </LinearGradient>
                      <Text style={[styles.stationeryLabel, isActive && { color: colors.text }]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Animated.View>

            {/* Inspiration Prompts */}
            <Animated.View entering={FadeInDown.delay(150).duration(600)}>
              <TouchableOpacity
                style={styles.promptToggle}
                onPress={() => {
                  setShowPrompts(!showPrompts);
                  Haptics.selectionAsync();
                }}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="lightbulb-outline"
                  size={16}
                  color={colors.primary}
                />
                <Text style={styles.promptToggleText}>
                  {showPrompts ? "Hide ideas" : "Need inspiration?"}
                </Text>
                <MaterialCommunityIcons
                  name={showPrompts ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={colors.textMuted}
                />
              </TouchableOpacity>

              {showPrompts && (
                <View style={styles.promptList}>
                  {PROMPTS.map((p, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.promptItem}
                      onPress={() => handlePickPrompt(p)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.promptItemText}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </Animated.View>

            {/* Text Input */}
            <Animated.View entering={FadeInDown.delay(200).duration(700)} style={styles.inputContainer}>
              <TextInput
                ref={inputRef}
                style={styles.textInput}
                placeholder="Write from the heart…"
                placeholderTextColor={colors.text + "40"}
                value={text}
                onChangeText={handleTextChange}
                multiline
                scrollEnabled={false}
                selectionColor={colors.primary}
                autoFocus
              />
            </Animated.View>

            {/* Photo Actions */}
            <Animated.View entering={FadeInDown.delay(250).duration(600)} style={styles.photoSection}>
              <Text style={styles.sectionLabel}>ADD A PICTURE</Text>
              <View style={styles.photoActions}>
                <TouchableOpacity style={styles.photoButton} onPress={handlePickImage} activeOpacity={0.85}>
                  <MaterialCommunityIcons name="image-plus" size={20} color={colors.text} />
                  <Text style={styles.photoButtonText}>Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.photoButton} onPress={handleTakePhoto} activeOpacity={0.85}>
                  <MaterialCommunityIcons name="camera-outline" size={20} color={colors.text} />
                  <Text style={styles.photoButtonText}>Camera</Text>
                </TouchableOpacity>

                {imageUri && (
                  <TouchableOpacity
                    style={styles.photoButtonSecondary}
                    onPress={() => {
                      setImageUri(null);
                      Haptics.selectionAsync();
                    }}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons name="close" size={18} color={colors.textMuted} />
                    <Text style={styles.photoButtonSecondaryText}>Remove</Text>
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

const createStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },

    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
    },
    headerCenter: { alignItems: "center" },
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
    iconButton: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    sendButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.full,
    },
    sendButtonDisabled: {
      opacity: 0.4,
    },
    sendText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: "600",
    },

    scroll: {
      flex: 1,
      paddingHorizontal: SPACING.xl,
    },

    // Preview
    previewWrapper: {
      alignItems: "center",
      marginTop: SPACING.md,
    },
    previewCard: {
      width: screenWidth * 0.7,
      height: screenWidth * 0.85,
      borderRadius: BORDER_RADIUS.xl,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewImage: {
      ...StyleSheet.absoluteFillObject,
    },
    previewStationeryImage: {
      ...StyleSheet.absoluteFillObject,
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },
    previewGradientOverlay: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.45,
    },
    previewOverlay: {
      ...StyleSheet.absoluteFillObject,
    },
    previewTextContainer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      padding: SPACING.lg,
    },
    previewText: {
      color: "#F2E9E6",
      fontSize: 16,
      lineHeight: 24,
      fontWeight: "500",
      fontStyle: "italic",
    },

    // Stationery
    sectionLabel: {
      ...TYPOGRAPHY.label,
      color: colors.textMuted,
      marginTop: SPACING.xl,
      marginBottom: SPACING.sm,
    },
    stationeryRow: {
      gap: SPACING.md,
      paddingVertical: SPACING.xs,
    },
    stationeryChip: {
      width: 52,
      height: 52,
      borderRadius: BORDER_RADIUS.md,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "transparent",
    },
    stationeryImage: {
      width: 36,
      height: 36,
      borderRadius: 8,
      resizeMode: "cover",
    },
    stationeryLabel: {
      color: colors.textMuted,
      fontSize: 10,
      textAlign: "center",
      marginTop: 4,
    },

    // Prompts
    promptToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: SPACING.xl,
      paddingVertical: SPACING.sm,
    },
    promptToggleText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "500",
      flex: 1,
    },
    promptList: {
      marginTop: SPACING.sm,
      gap: SPACING.xs,
    },
    promptItem: {
      backgroundColor: colors.surface,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    promptItemText: {
      color: colors.text,
      fontSize: 14,
      fontStyle: "italic",
    },

    // Text Input
    inputContainer: {
      marginTop: SPACING.xl,
      minHeight: 160,
    },
    textInput: {
      color: colors.text,
      fontSize: 18,
      lineHeight: 28,
      textAlignVertical: "top",
      fontFamily: Platform.select({
        ios: "DMSerifDisplay-Regular",
        android: "DMSerifDisplay_400Regular",
        default: "serif",
      }),
      fontWeight: "400",
    },

    // Photo
    photoSection: {
      marginTop: SPACING.lg,
    },
    photoActions: {
      flexDirection: "row",
      gap: SPACING.sm,
    },
    photoButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderRadius: BORDER_RADIUS.sm,
    },
    photoButtonText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: "600",
    },
    photoButtonSecondary: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderRadius: BORDER_RADIUS.sm,
    },
    photoButtonSecondaryText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
    },
  });
