// screens/LoveNoteDetailScreen.js — View a single love note (E2EE)
import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp, useSharedValue, useAnimatedStyle, withTiming, withDelay } from "react-native-reanimated";
import LottieView from "lottie-react-native";

import { useTheme } from "../context/ThemeContext";
import { useEntitlements } from "../context/EntitlementsContext";
import DataLayer from "../services/data/DataLayer";
import { TYPOGRAPHY, SPACING, BORDER_RADIUS } from "../utils/theme";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const STATIONERY_MAP = {
  love:    { emoji: "💗", gradient: ["#E8A0BF", "#BA6B8F"] },
  heart:   { emoji: "💞", gradient: ["#F4C2C2", "#D4878F"] },
  sparkle: { emoji: "🫧", gradient: ["#C8A2D4", "#8E6AA0"] },
  rose:    { emoji: "🌷", gradient: ["#F2B5D4", "#C96B8E"] },
  sunset:  { emoji: "🧡", gradient: ["#F8C8A4", "#E08860"] },
  night:   { emoji: "🌌", gradient: ["#6C7EBB", "#3B4678"] },
};

function formatDate(ts) {
  return new Date(ts).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function LoveNoteDetailScreen({ navigation, route }) {
  const { noteId } = route.params || {};
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [envelopeOpen, setEnvelopeOpen] = useState(false);
  const lottieRef = useRef(null);
  // Animation value: 0 = closed, 1 = open
  const openAnim = useSharedValue(0);

  const styles = useMemo(() => createStyles(colors), [colors]);

  // Free users: love notes are locked — redirect
  useEffect(() => {
    if (!isPremium) {
      showPaywall?.('loveNotes');
      navigation.goBack();
    }
  }, [isPremium]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const loaded = await DataLayer.getLoveNote(noteId);
        if (active) setNote(loaded);
      } catch (err) {
        console.warn('[LoveNoteDetail] Failed to load note:', err?.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [noteId]);

  // Animation styles — must be above early returns to preserve hook order
  const bodyAnim = useAnimatedStyle(() => ({
    opacity: openAnim.value,
    transform: [
      { translateY: withTiming(openAnim.value ? 0 : 40, { duration: 400 }) },
      { scale: withTiming(openAnim.value ? 1 : 0.95, { duration: 400 }) },
    ],
  }));

  const stationery = note?.stationeryId
    ? (STATIONERY_MAP[note.stationeryId] || STATIONERY_MAP.love)
    : STATIONERY_MAP.love;
  const hasImage = !!note?.imageUri;

  const handleDelete = () => {
    Alert.alert(
      "Delete Note",
      "Are you sure you want to delete this love note?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await DataLayer.deleteLoveNote(noteId);
              navigation.goBack();
            } catch {
              Alert.alert("Error", "Couldn't delete the note.");
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}> 
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!note) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}> 
        <Text style={{ color: colors.textMuted }}>Note not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Envelope animation overlay */}
      {!envelopeOpen && (
        <SafeAreaView style={styles.envelopeContainer}>
          {/* Back button */}
          <View style={styles.envelopeTopBar}>
            <TouchableOpacity
              style={[styles.circleButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="chevron-left" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Centered Lottie envelope + open prompt */}
          <View style={styles.envelopeCenterArea}>
            <Text style={[styles.envelopeLabel, { color: colors.textMuted }]}>You have a love note</Text>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                lottieRef.current?.play();
                setTimeout(() => setEnvelopeOpen(true), 2200);
              }}
            >
              <View style={styles.envelopeWrapper}>
                <LottieView
                  ref={lottieRef}
                  source={require("../assets/envelope-love.json")}
                  style={styles.lottieEnvelope}
                  autoPlay={false}
                  loop={false}
                  speed={1.2}
                />
              </View>
            </TouchableOpacity>
            <Text style={[styles.envelopeTapHint, { color: colors.textMuted }]}>Tap to open</Text>
          </View>
        </SafeAreaView>
      )}
      {envelopeOpen && (
        <>
          {/* Full-screen background */}
          {hasImage ? (
            <Image source={{ uri: note.imageUri }} style={styles.fullBg} blurRadius={Platform.OS === "ios" ? 30 : 15} />
          ) : (
            <LinearGradient colors={stationery.gradient} style={styles.fullBg} />
          )}

          {/* Dark overlay for readability */}
          <View style={styles.overlay} />

          <SafeAreaView style={styles.safeArea}>
            {/* Top bar */}
            <Animated.View entering={FadeIn.duration(500)} style={styles.topBar}>
              <TouchableOpacity
                style={styles.circleButton}
                onPress={() => navigation.goBack()}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="chevron-left" size={26} color="#FFF" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.circleButton} onPress={handleDelete} activeOpacity={0.8}>
                <MaterialCommunityIcons name="delete-outline" size={20} color="#FFF" />
              </TouchableOpacity>
            </Animated.View>

            {/* Center card */}
            <View style={styles.centerArea}>
              <Animated.View entering={FadeInUp.delay(200).springify().damping(16)} style={[styles.card, bodyAnim]}>
                {hasImage && (
                  <Image source={{ uri: note.imageUri }} style={styles.cardImage} />
                )}
                {!hasImage && (
                  <LinearGradient colors={stationery.gradient} style={styles.cardGradientBg}>
                    <Text style={styles.cardBgEmoji}>{stationery.emoji}</Text>
                  </LinearGradient>
                )}

                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.6)"]}
                  style={styles.cardOverlay}
                />

                <View style={styles.cardContent}>
                  {note.senderName && (
                    <Text style={styles.senderLabel}>From {note.senderName}</Text>
                  )}
                  {!!note.text && <Text style={styles.noteText}>{note.text}</Text>}
                  <Text style={styles.dateText}>{formatDate(note.createdAt)}</Text>
                </View>
              </Animated.View>
            </View>

            {/* Bottom — reply or heart decoration */}
            <Animated.View entering={FadeIn.delay(500).duration(800)} style={styles.bottomDecoration}>
              {!note.isOwn ? (
                <TouchableOpacity
                  style={styles.replyButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    navigation.navigate("ComposeLoveNote");
                  }}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons name="reply" size={18} color="#FFF" />
                  <Text style={styles.replyButtonText}>Write Back</Text>
                </TouchableOpacity>
              ) : (
                <MaterialCommunityIcons name="heart" size={24} color={colors.primary + "60"} />
              )}
            </Animated.View>
          </SafeAreaView>
        </>
      )}
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    envelopeContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    envelopeTopBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.sm,
    },
    envelopeCenterArea: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingBottom: SPACING.xxl,
    },
    envelopeWrapper: {
      width: 300,
      height: 300,
      alignItems: "center",
      justifyContent: "center",
    },
    lottieEnvelope: {
      width: 300,
      height: 300,
    },
    envelopeLabel: {
      fontSize: 16,
      fontWeight: "500",
      letterSpacing: 0.3,
      marginBottom: SPACING.xl,
    },
    envelopeTapHint: {
      fontSize: 13,
      fontWeight: "400",
      marginTop: SPACING.lg,
      opacity: 0.6,
    },
    fullBg: {
      ...StyleSheet.absoluteFillObject,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    safeArea: {
      flex: 1,
      justifyContent: "space-between",
    },

    topBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.sm,
    },

    circleButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(255,255,255,0.15)",
      alignItems: "center",
      justifyContent: "center",
    },

    centerArea: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: SPACING.lg,
    },
    card: {
      width: screenWidth - SPACING.lg * 2,
      height: screenHeight * 0.72,
      borderRadius: BORDER_RADIUS.xl,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
    },
    cardImage: {
      ...StyleSheet.absoluteFillObject,
    },
    cardGradientBg: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
    },
    cardBgEmoji: {
      fontSize: 96,
      opacity: 0.15,
    },
    cardOverlay: {
      ...StyleSheet.absoluteFillObject,
    },
    cardContent: {
      padding: SPACING.xl,
      paddingTop: SPACING.xxxl,
      justifyContent: "flex-end",
      minHeight: 280,
    },
    senderLabel: {
      color: "rgba(242,233,230,0.7)",
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: SPACING.sm,
    },
    noteText: {
      color: "#F2E9E6",
      fontSize: 22,
      lineHeight: 32,
      fontWeight: "300",
      fontFamily: Platform.select({
        ios: "Playfair Display",
        android: "PlayfairDisplay_300Light",
        default: "serif",
      }),
    },
    dateText: {
      color: "rgba(242,233,230,0.5)",
      fontSize: 12,
      marginTop: SPACING.lg,
    },

    bottomDecoration: {
      alignItems: "center",
      paddingBottom: SPACING.lg,
    },
    replyButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: SPACING.xl,
      paddingVertical: 14,
      borderRadius: BORDER_RADIUS.full,
      ...Platform.select({
        ios: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12 },
        android: { elevation: 6 },
      }),
    },
    replyButtonText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "600",
      letterSpacing: 0.5,
    },
  });
