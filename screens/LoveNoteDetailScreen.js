// screens/LoveNoteDetailScreen.js — View a single love note (E2EE)
// Velvet Glass · Reveal Sequence · Apple Editorial Vertical Rhythm

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
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Icon from '../components/Icon';
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import Animated, { 
  FadeIn, 
  FadeInUp, 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSpring,
  interpolate,
  Extrapolate
} from "react-native-reanimated";
import LottieView from "lottie-react-native";

import { useTheme } from "../context/ThemeContext";
import { useEntitlements } from "../context/EntitlementsContext";
import DataLayer from "../services/data/DataLayer";
import { TYPOGRAPHY, SPACING, BORDER_RADIUS, withAlpha } from "../utils/theme";
import GlowOrb from "../components/GlowOrb";
import FilmGrain from "../components/FilmGrain";
import InvisibleInkMessage from "../components/InvisibleInkMessage";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const STATIONERY_MAP = {
  love:    { emoji: "💗", gradient: ["#7A1E4E", "#5E1940"] },
  heart:   { emoji: "💞", gradient: ["#9A2E5E", "#7A1E4E"] },
  sparkle: { emoji: "🫧", gradient: ["#B84070", "#9A2E5E"] },
  rose:    { emoji: "🌷", gradient: ["#C45060", "#A83850"] },
  sunset:  { emoji: "🧡", gradient: ["#E08860", "#C45060"] },
  night:   { emoji: "🌌", gradient: ["#2C2C2E", "#000000"] },
};

function formatDate(ts) {
  return new Date(ts).toLocaleDateString("en-US", {
    weekday: "long",
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

  // Animation values for reveal sequence
  const revealProgress = useSharedValue(0);

  const styles = useMemo(() => createStyles(colors), [colors]);

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

  // Reveal Animation Styles
  const cardRevealStyle = useAnimatedStyle(() => {
    return {
      opacity: revealProgress.value,
      transform: [
        { translateY: interpolate(revealProgress.value, [0, 1], [60, 0], Extrapolate.CLAMP) },
        { scale: interpolate(revealProgress.value, [0, 1], [0.9, 1], Extrapolate.CLAMP) },
      ],
    };
  });

  const backgroundStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(envelopeOpen ? 1 : 0, { duration: 1000 }),
    };
  });

  const stationery = note?.stationeryId
    ? (STATIONERY_MAP[note.stationeryId] || STATIONERY_MAP.love)
    : STATIONERY_MAP.love;
  const hasImage = !!note?.imageUri;

  const handleOpenEnvelope = () => {
    impact(ImpactFeedbackStyle.Medium);
    lottieRef.current?.play();
    
    // Sequence the reveal
    setTimeout(() => {
      setEnvelopeOpen(true);
      revealProgress.value = withSpring(1, { damping: 15, stiffness: 100 });
      notification(NotificationFeedbackType.Success);
    }, 1800);
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Note",
      "Remove this memory from your vault?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              impact(ImpactFeedbackStyle.Medium);
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

  if (!note) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <FilmGrain opacity={0.2} />
      
      {/* Background Layer: Velvet Deep Plum Ambience */}
      <Animated.View style={[StyleSheet.absoluteFill, backgroundStyle]}>
        {hasImage ? (
          <Image 
            source={{ uri: note.imageUri }} 
            style={styles.fullBg} 
            blurRadius={Platform.OS === "ios" ? 40 : 20} 
          />
        ) : (
          <LinearGradient colors={stationery.gradient} style={styles.fullBg} />
        )}
        <View style={styles.overlay} />
        <GlowOrb color={colors.primary} size={screenWidth * 1.5} top={-200} left={-100} opacity={0.12} />
      </Animated.View>

      {/* STAGE 1: The Sealed Envelope */}
      {!envelopeOpen && (
        <SafeAreaView style={styles.envelopeContainer}>
          <View style={styles.envelopeTopBar}>
            <TouchableOpacity
              style={styles.circleButton}
              onPress={() => navigation.goBack()}
            >
              <Icon name="chevron-left" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ReAnimated.View entering={FadeIn.duration(800)} style={styles.envelopeCenterArea}>
            <Text style={[styles.envelopeLabel, { color: colors.primary }]}>A PRIVATE MESSAGE</Text>
            <Text style={[styles.editorialTitle, { color: colors.text }]}>For your eyes only</Text>
            
            <TouchableOpacity
              activeOpacity={0.95}
              onPress={handleOpenEnvelope}
              style={styles.lottieContainer}
            >
              <LottieView
                ref={lottieRef}
                source={require("../assets/envelope-love.json")}
                style={styles.lottieEnvelope}
                autoPlay={false}
                loop={false}
                speed={1.4}
              />
            </TouchableOpacity>
            
            <ReAnimated.View entering={FadeIn.delay(1000)} style={styles.hintRow}>
              <Icon name="gesture-tap" size={16} color={colors.textMuted} />
              <Text style={[styles.envelopeTapHint, { color: colors.textMuted }]}>Tap to reveal</Text>
            </ReAnimated.View>
          </ReAnimated.View>
        </SafeAreaView>
      )}

      {/* STAGE 2: The Revealed Note */}
      {envelopeOpen && (
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          {/* Action Bar */}
          <Animated.View entering={FadeIn.duration(600)} style={styles.topBar}>
            <TouchableOpacity
              style={styles.circleButton}
              onPress={() => navigation.goBack()}
            >
              <Icon name="chevron-left" size={28} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.circleButton} onPress={handleDelete}>
              <Icon name="trash-can-outline" size={22} color="#FFF" />
            </TouchableOpacity>
          </Animated.View>

          {/* The Stationery Card */}
          <View style={styles.centerArea}>
            <Animated.View style={[styles.card, cardRevealStyle]}>
              {hasImage ? (
                <Image source={{ uri: note.imageUri }} style={styles.cardImage} />
              ) : (
                <LinearGradient colors={stationery.gradient} style={styles.cardGradientBg}>
                  <Text style={styles.cardBgEmoji}>{stationery.emoji}</Text>
                </LinearGradient>
              )}

              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.8)"]}
                style={styles.cardOverlay}
              />

              <View style={styles.cardContent}>
                <View style={styles.senderHeader}>
                  <View style={[styles.senderLine, { backgroundColor: withAlpha('#FFF', 0.3) }]} />
                  <Text style={styles.senderLabel}>FROM {note.senderName?.toUpperCase() || 'YOUR PARTNER'}</Text>
                </View>

                {note.invisibleInk ? (
                  <InvisibleInkMessage
                    text={note.text || ''}
                    style={styles.invisibleInkWrapper}
                  />
                ) : (
                  <Text style={styles.noteText}>{note.text}</Text>
                )}

                <View style={styles.cardFooter}>
                  <Text style={styles.dateText}>{formatDate(note.createdAt)}</Text>
                  <Icon name="seal" size={20} color={withAlpha('#FFF', 0.4)} />
                </View>
              </View>
            </Animated.View>
          </View>

          {/* Bottom Interaction */}
          <Animated.View entering={FadeInUp.delay(500)} style={styles.bottomDecoration}>
            {!note.isOwn ? (
              <TouchableOpacity
                style={[styles.replyButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  impact(ImpactFeedbackStyle.Medium);
                  navigation.navigate("ComposeLoveNote");
                }}
              >
                <Icon name="heart-plus" size={20} color="#FFF" />
                <Text style={styles.replyButtonText}>Respond with Love</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.sentBadge}>
                <Icon name="check-all" size={16} color={withAlpha('#FFF', 0.6)} />
                <Text style={styles.sentText}>Delivered to their heart</Text>
              </View>
            )}
          </Animated.View>
        </SafeAreaView>
      )}
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1 },
    
    // Envelope Phase
    envelopeContainer: { flex: 1 },
    envelopeTopBar: {
      paddingHorizontal: 24,
      paddingTop: 12,
    },
    envelopeCenterArea: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingBottom: 60,
    },
    editorialTitle: {
      fontFamily: Platform.select({ ios: 'DMSerifDisplay-Regular', android: 'DMSerifDisplay_400Regular' }),
      fontSize: 32,
      letterSpacing: -0.5,
      marginTop: 8,
      marginBottom: 20,
    },
    envelopeLabel: {
      fontFamily: 'Lato_700Bold',
      fontSize: 11,
      letterSpacing: 3,
    },
    lottieContainer: {
      width: screenWidth * 0.8,
      height: screenWidth * 0.8,
      alignItems: "center",
      justifyContent: "center",
    },
    lottieEnvelope: {
      width: '100%',
      height: '100%',
    },
    hintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 20,
    },
    envelopeTapHint: {
      fontSize: 14,
      fontFamily: 'Lato_400Regular',
    },

    // Reveal Phase
    fullBg: { ...StyleSheet.absoluteFillObject },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.55)",
    },
    safeArea: { flex: 1 },
    topBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 24,
      paddingTop: 12,
    },
    circleButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: "rgba(255,255,255,0.12)",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
    },
    centerArea: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    card: {
      width: screenWidth - 48,
      height: screenHeight * 0.68,
      borderRadius: 32,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.15)",
      ...Platform.select({
        ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.4, shadowRadius: 30 },
        android: { elevation: 20 },
      }),
    },
    cardImage: { ...StyleSheet.absoluteFillObject },
    cardGradientBg: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
    },
    cardBgEmoji: { fontSize: 100, opacity: 0.1 },
    cardOverlay: { ...StyleSheet.absoluteFillObject },
    cardContent: {
      flex: 1,
      padding: 32,
      justifyContent: "flex-end",
    },
    senderHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 20,
    },
    senderLine: {
      height: 1,
      flex: 1,
    },
    senderLabel: {
      color: "#FFF",
      fontSize: 10,
      fontFamily: 'Lato_700Bold',
      letterSpacing: 2,
    },
    noteText: {
      color: "#FFF",
      fontSize: 26,
      lineHeight: 38,
      fontFamily: Platform.select({ ios: 'DMSerifDisplay-Regular', android: 'DMSerifDisplay_400Regular' }),
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 32,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.1)',
      paddingTop: 20,
    },
    dateText: {
      color: "rgba(255,255,255,0.5)",
      fontSize: 12,
      fontFamily: 'Lato_400Regular',
    },

    bottomDecoration: {
      alignItems: "center",
      paddingBottom: 32,
    },
    replyButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 32,
      paddingVertical: 18,
      borderRadius: 30,
      ...Platform.select({
        ios: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15 },
        android: { elevation: 8 },
      }),
    },
    replyButtonText: {
      color: "#FFF",
      fontSize: 16,
      fontFamily: 'Lato_700Bold',
    },
    sentBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(255,255,255,0.1)',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    sentText: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 12,
      fontFamily: 'Lato_400Regular',
    }
  });
  