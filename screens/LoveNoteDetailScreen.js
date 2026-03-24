/**
 * LoveNoteDetailScreen.js — View a single love note (E2EE)
 * True Red (#D2121A) · Foggy Glass Wipe Reveal · Apple Editorial
 */

import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  Alert,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Icon from '../components/Icon';
import { impact, notification, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import Animated, {
  FadeIn,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withSpring,
  interpolate,
  Extrapolation,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Svg, { Defs, Mask, Rect, Path } from "react-native-svg";
import LottieView from "lottie-react-native";

import { useTheme } from "../context/ThemeContext";
import { useEntitlements } from "../context/EntitlementsContext";
import { PremiumFeature } from '../utils/featureFlags';
import DataLayer from "../services/data/DataLayer";
import GlowOrb from "../components/GlowOrb";
import FilmGrain from "../components/FilmGrain";
import InvisibleInkMessage from "../components/InvisibleInkMessage";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });
const SERIF_FONT = Platform.select({ ios: "DMSerifDisplay-Regular", android: "DMSerifDisplay_400Regular" });

const AnimatedPath = Animated.createAnimatedComponent(Path);

// True Red / Neon Progression for Love Notes
const STATIONERY_MAP = {
  love:    { emoji: "💗", gradient: ["#FF85C2", "#D4609A"], metal: "#160A10" },
  heart:   { emoji: "💞", gradient: ["#FF2D55", "#C40070"], metal: "#16050A" },
  sparkle: { emoji: "🫧", gradient: ["#FF006E", "#BB004F"], metal: "#140005" },
  rose:    { emoji: "🌹", gradient: ["#D2121A", "#8A0B11"], metal: "#0A0000" }, // True Red
  sunset:  { emoji: "🌅", gradient: ["#E08860", "#A83850"], metal: "#1A0A05" },
  night:   { emoji: "🌌", gradient: ["#1C1C1E", "#000000"], metal: "#050505" },
};

function formatDate(ts) {
  return new Date(ts).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export default function LoveNoteDetailScreen({ navigation, route }) {
  const { noteId } = route.params || {};
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();

  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [envelopeOpen, setEnvelopeOpen] = useState(false);
  const [fogCleared, setFogCleared] = useState(false);
  const lottieRef = useRef(null);

  // ── True Red × Apple Editorial theme map ──
  const t = useMemo(() => ({
    background: isDark ? '#1D1D1F' : '#FAF7F5',
    primary: '#D2121A',
    text: colors.text,
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60,60,67,0.6)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t), [t]);

  // ── Animation shared values ──
  const revealProgress = useSharedValue(0);
  const fogOpacity = useSharedValue(1);
  const pathData = useSharedValue("M 0 0");

  useEffect(() => {
    if (!isPremium) {
      showPaywall?.(PremiumFeature.LOVE_NOTES);
      navigation.goBack();
    }
  }, [isPremium, navigation, showPaywall]);

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

  // ── Foggy Glass Wipe Gesture (runs on UI thread) ──
  const panGesture = Gesture.Pan()
    .onStart((e) => {
      pathData.value = `${pathData.value} M ${e.x} ${e.y}`;
      runOnJS(impact)(ImpactFeedbackStyle.Light);
    })
    .onUpdate((e) => {
      pathData.value = `${pathData.value} L ${e.x} ${e.y}`;
    });

  const animatedMaskProps = useAnimatedProps(() => ({
    d: pathData.value,
  }));

  // ── Animated styles ──
  const cardRevealStyle = useAnimatedStyle(() => ({
    opacity: revealProgress.value,
    transform: [
      { translateY: interpolate(revealProgress.value, [0, 1], [80, 0], Extrapolation.CLAMP) },
      { scale: interpolate(revealProgress.value, [0, 1], [0.85, 1], Extrapolation.CLAMP) },
    ],
  }));

  const fogContainerStyle = useAnimatedStyle(() => ({
    opacity: fogOpacity.value,
  }));

  // ── Handlers ──
  const handleOpenEnvelope = () => {
    impact(ImpactFeedbackStyle.Heavy);
    lottieRef.current?.play();
    setTimeout(() => {
      setEnvelopeOpen(true);
      revealProgress.value = withSpring(1, { damping: 18, stiffness: 120 });
      notification(NotificationFeedbackType.Success);
    }, 1800);
  };

  const handleClearFog = () => {
    impact(ImpactFeedbackStyle.Medium);
    setFogCleared(true);
    fogOpacity.value = withTiming(0, { duration: 800, easing: Easing.out(Easing.cubic) });
  };

  const handleDelete = () => {
    Alert.alert("Delete Note", "Remove this memory from your vault?", [
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
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center", backgroundColor: t.background }]}>
        <ActivityIndicator size="large" color={t.primary} />
      </View>
    );
  }

  if (!note) return null;

  const stationery = note?.stationeryId
    ? (STATIONERY_MAP[note.stationeryId] || STATIONERY_MAP.love)
    : STATIONERY_MAP.love;
  const hasImage = !!note?.imageUri;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: t.background }]}>
        <StatusBar barStyle="light-content" />
        <FilmGrain opacity={0.03} />

        {/* Deep Velvet Background */}
        <Animated.View style={StyleSheet.absoluteFill}>
          {hasImage ? (
            <Image source={{ uri: note.imageUri }} style={styles.fullBg} blurRadius={50} />
          ) : (
            <LinearGradient colors={[stationery.metal, "#000"]} style={styles.fullBg} />
          )}
          <View style={styles.overlay} />
          <GlowOrb color={stationery.gradient[0]} size={SCREEN_WIDTH * 1.5} top={-200} left={-100} opacity={0.15} />
        </Animated.View>

        {/* STAGE 1: The Sealed Envelope */}
        {!envelopeOpen && (
          <SafeAreaView style={styles.envelopeContainer}>
            <View style={styles.envelopeTopBar}>
              <TouchableOpacity style={styles.circleButton} onPress={() => navigation.goBack()}>
                <Icon name="chevron-left" size={24} color={t.text} />
              </TouchableOpacity>
            </View>

            <Animated.View entering={FadeIn.duration(800)} style={styles.envelopeCenterArea}>
              <Text style={[styles.envelopeLabel, { color: t.primary }]}>A PRIVATE MESSAGE</Text>
              <Text style={[styles.editorialTitle, { color: t.text }]}>For your eyes only</Text>

              <TouchableOpacity activeOpacity={0.95} onPress={handleOpenEnvelope} style={styles.lottieContainer}>
                <LottieView
                  ref={lottieRef}
                  source={require("../assets/envelope-love.json")}
                  style={styles.lottieEnvelope}
                  autoPlay={false}
                  loop={false}
                  speed={1.4}
                />
              </TouchableOpacity>

              <Animated.View entering={FadeIn.delay(1000)} style={styles.hintRow}>
                <Text style={[styles.envelopeTapHint, { color: t.subtext }]}>TAP TO OPEN</Text>
              </Animated.View>
            </Animated.View>
          </SafeAreaView>
        )}

        {/* STAGE 2: The Revealed Note (with Fog) */}
        {envelopeOpen && (
          <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            <Animated.View entering={FadeIn.duration(600)} style={styles.topBar}>
              <TouchableOpacity style={styles.circleButton} onPress={() => navigation.goBack()}>
                <Icon name="chevron-left" size={24} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.circleButton} onPress={handleDelete}>
                <Icon name="trash-outline" size={20} color="#FFF" />
              </TouchableOpacity>
            </Animated.View>

            <View style={styles.centerArea}>
              <Animated.View style={[styles.card, cardRevealStyle]}>

                {/* ── Note Content Layer ── */}
                <View style={StyleSheet.absoluteFill}>
                  {hasImage ? (
                    <Image source={{ uri: note.imageUri }} style={styles.cardImage} />
                  ) : (
                    <LinearGradient
                      colors={stationery.gradient}
                      style={styles.cardGradientBg}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Text style={styles.cardBgEmoji}>{stationery.emoji}</Text>
                    </LinearGradient>
                  )}
                  <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.6)", "#000"]}
                    style={styles.cardOverlay}
                  />
                  <View style={styles.cardContent}>
                    <View style={styles.senderHeader}>
                      <View style={styles.senderLine} />
                      <Text style={styles.senderLabel}>
                        FROM {note.senderName?.toUpperCase() || 'YOUR PARTNER'}
                      </Text>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                      {note.invisibleInk ? (
                        <InvisibleInkMessage text={note.text || ''} style={styles.noteText} />
                      ) : (
                        <Text style={styles.noteText}>{note.text}</Text>
                      )}
                    </ScrollView>

                    <View style={styles.cardFooter}>
                      <Text style={styles.dateText}>{formatDate(note.createdAt).toUpperCase()}</Text>
                      <Icon name="shield-checkmark-outline" size={16} color="rgba(255,255,255,0.4)" />
                    </View>
                  </View>
                </View>

                {/* ── Foggy Glass Overlay ── */}
                {!fogCleared && (
                  <GestureDetector gesture={panGesture}>
                    <Animated.View style={[StyleSheet.absoluteFill, fogContainerStyle]}>
                      <Svg style={StyleSheet.absoluteFill}>
                        <Defs>
                          <Mask id="wipeMask">
                            {/* White = show fog, black stroke = punch a hole */}
                            <Rect x="0" y="0" width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="white" />
                            <AnimatedPath
                              animatedProps={animatedMaskProps}
                              fill="none"
                              stroke="black"
                              strokeWidth={60}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </Mask>
                        </Defs>
                        <Rect
                          x="0"
                          y="0"
                          width={SCREEN_WIDTH}
                          height={SCREEN_HEIGHT}
                          fill="rgba(20, 10, 15, 0.95)"
                          mask="url(#wipeMask)"
                        />
                      </Svg>

                      <View style={styles.fogInstructions} pointerEvents="none">
                        <Icon name="hand-index-outline" size={32} color="rgba(255,255,255,0.6)" />
                        <Text style={styles.fogText}>Wipe the glass</Text>
                      </View>
                    </Animated.View>
                  </GestureDetector>
                )}

              </Animated.View>
            </View>

            <Animated.View entering={FadeInUp.delay(800)} style={styles.bottomDecoration}>
              {!fogCleared ? (
                <TouchableOpacity style={styles.clearFogBtn} onPress={handleClearFog} activeOpacity={0.8}>
                  <Text style={styles.clearFogText}>Reveal Entirely</Text>
                </TouchableOpacity>
              ) : !note.isOwn ? (
                <TouchableOpacity
                  style={[styles.replyButton, { backgroundColor: t.primary }]}
                  onPress={() => {
                    impact(ImpactFeedbackStyle.Medium);
                    navigation.navigate("ComposeLoveNote");
                  }}
                  activeOpacity={0.9}
                >
                  <Icon name="heart-outline" size={20} color="#FFF" />
                  <Text style={styles.replyButtonText}>Respond with Love</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.sentBadge}>
                  <Icon name="checkmark-done-outline" size={18} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.sentText}>DELIVERED TO THEIR HEART</Text>
                </View>
              )}
            </Animated.View>
          </SafeAreaView>
        )}
      </View>
    </GestureHandlerRootView>
  );
}

// ──────────────────────────────────────────────────────────
// STYLES — Apple Editorial × Velvet Glass
// ──────────────────────────────────────────────────────────
const createStyles = (t) =>
  StyleSheet.create({
    container: { flex: 1 },

    // ── Envelope Phase ──
    envelopeContainer: { flex: 1 },
    envelopeTopBar: { paddingHorizontal: 24, paddingTop: 12 },
    envelopeCenterArea: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingBottom: 60,
    },
    envelopeLabel: {
      fontFamily: SYSTEM_FONT,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 2.5,
      marginBottom: 8,
    },
    editorialTitle: {
      fontFamily: SERIF_FONT,
      fontSize: 38,
      letterSpacing: -1,
      marginBottom: 20,
      textAlign: 'center',
    },
    lottieContainer: {
      width: SCREEN_WIDTH * 0.8,
      height: SCREEN_WIDTH * 0.8,
      alignItems: "center",
      justifyContent: "center",
    },
    lottieEnvelope: { width: '100%', height: '100%' },
    hintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 24,
    },
    envelopeTapHint: {
      fontFamily: SYSTEM_FONT,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 2,
    },

    // ── Reveal Phase ──
    fullBg: { ...StyleSheet.absoluteFillObject },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)" },
    safeArea: { flex: 1 },
    topBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 24,
      paddingTop: 12,
    },
    circleButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(255,255,255,0.1)",
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
      width: SCREEN_WIDTH - 48,
      height: SCREEN_HEIGHT * 0.65,
      borderRadius: 32,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.15)",
      backgroundColor: "#000",
      ...Platform.select({
        ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.8, shadowRadius: 40 },
        android: { elevation: 20 },
      }),
    },
    cardImage: { ...StyleSheet.absoluteFillObject },
    cardGradientBg: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
    },
    cardBgEmoji: { fontSize: 120, opacity: 0.15 },
    cardOverlay: { ...StyleSheet.absoluteFillObject },
    cardContent: { flex: 1, padding: 32, justifyContent: "flex-end" },
    senderHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 24,
    },
    senderLine: { height: 1, flex: 1, backgroundColor: "rgba(255,255,255,0.3)" },
    senderLabel: {
      color: "#FFF",
      fontFamily: SYSTEM_FONT,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 2,
    },
    noteText: {
      color: "#FFF",
      fontFamily: SERIF_FONT,
      fontSize: 28,
      lineHeight: 38,
      textShadowColor: 'rgba(0,0,0,0.8)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 10,
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 24,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.15)',
      paddingTop: 20,
    },
    dateText: {
      color: "rgba(255,255,255,0.6)",
      fontFamily: SYSTEM_FONT,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.5,
    },

    // ── Foggy Glass ──
    fogInstructions: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    fogText: {
      fontFamily: SERIF_FONT,
      fontSize: 24,
      color: "rgba(255,255,255,0.8)",
      letterSpacing: 1,
    },
    clearFogBtn: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.2)",
      backgroundColor: "rgba(255,255,255,0.05)",
    },
    clearFogText: {
      color: "#FFF",
      fontFamily: SYSTEM_FONT,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },

    // ── Bottom Interaction ──
    bottomDecoration: {
      alignItems: "center",
      paddingBottom: Platform.OS === 'ios' ? 20 : 32,
    },
    replyButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 32,
      height: 56,
      borderRadius: 28,
      ...Platform.select({
        ios: { shadowColor: t.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16 },
        android: { elevation: 8 },
      }),
    },
    replyButtonText: {
      color: "#FFF",
      fontFamily: SYSTEM_FONT,
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: -0.2,
    },
    sentBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(255,255,255,0.1)',
      paddingHorizontal: 20,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.05)',
    },
    sentText: {
      color: 'rgba(255,255,255,0.8)',
      fontFamily: SYSTEM_FONT,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.5,
    },
  });

  