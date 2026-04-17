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
import { BlurView } from "expo-blur";
import Icon from '../components/Icon';
import { impact, notification, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import Animated, {
  FadeIn,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  Easing,
} from "react-native-reanimated";
import LottieView from "lottie-react-native";

import { useTheme } from "../context/ThemeContext";
import { useEntitlements } from "../context/EntitlementsContext";
import { PremiumFeature } from '../utils/featureFlags';
import DataLayer from "../services/data/DataLayer";
import { withAlpha } from "../utils/theme";
import GlowOrb from "../components/GlowOrb";
import FilmGrain from "../components/FilmGrain";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });
const SERIF_FONT = Platform.select({ ios: "DMSerifDisplay-Regular", android: "DMSerifDisplay_400Regular" });

// True Red / Neon Progression for Love Notes (Updated with Outline Ionicons)
const STATIONERY_MAP = {
  love:    { icon: "heart-outline", paper: "#FFF0F5", ink: "#5E2040", accent: "#D4609A", ruled: "rgba(180,100,140,0.08)", gradient: ["#FF85C2", "#D4609A"], metal: "#160A10" },
  heart:   { icon: "heart-circle-outline", paper: "#FFF5F5", ink: "#6B0F1A", accent: "#FF2D55", ruled: "rgba(200,50,80,0.08)", gradient: ["#FF2D55", "#C40070"], metal: "#16050A" },
  sparkle: { icon: "sparkles-outline", paper: "#FFF0F3", ink: "#5E0030", accent: "#FF006E", ruled: "rgba(200,50,100,0.08)", gradient: ["#FF006E", "#BB004F"], metal: "#140005" },
  rose:    { icon: "flower-outline", paper: "#FFF5F5", ink: "#6B0F0F", accent: "#D2121A", ruled: "rgba(200,80,80,0.08)", gradient: ["#D2121A", "#8A0B11"], metal: "#0A0000" },
  sunset:  { icon: "sunny-outline", paper: "#FFF8F2", ink: "#5A2818", accent: "#E08860", ruled: "rgba(180,100,60,0.08)", gradient: ["#E08860", "#A83850"], metal: "#1A0A05" },
  night:   { icon: "star-outline", paper: "#F0EDF8", ink: "#1C1C3E", accent: "#7B68EE", ruled: "rgba(80,60,160,0.08)", gradient: ["#1C1C1E", "#000000"], metal: "#050505" },
  sexy:    { icon: "flame-outline", paper: "#FFF5F5", ink: "#6B0F0F", accent: "#D2121A", ruled: "rgba(200,80,80,0.08)", gradient: ["#D2121A", "#5E081D"], metal: "#0A0000" },
  dreamy:  { icon: "moon-outline", paper: "#F0EDF8", ink: "#1C1C3E", accent: "#7B68EE", ruled: "rgba(80,60,160,0.08)", gradient: ["#1C1C1E", "#0A0003"], metal: "#050005" },
  playful: { icon: "happy-outline", paper: "#FFFDF2", ink: "#5C4A1E", accent: "#E8A020", ruled: "rgba(180,140,40,0.08)", gradient: ["#FFD966", "#F5A623"], metal: "#1A1500" },
  classic: { icon: "mail-outline", paper: "#FAF8F5", ink: "#2C2C2E", accent: "#8B7355", ruled: "rgba(100,80,60,0.08)", gradient: ["#AEB6BF", "#5D6D7E"], metal: "#0A0A10" },
};

function formatDate(ts) {
  return new Date(ts).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function formatExpiry(expiresAt) {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'Expiring…';
  const totalMins = Math.floor(ms / 60000);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0) return `Expires in ${hrs}h ${mins}m`;
  return `Expires in ${mins}m`;
}

function ExpiryCountdown({ expiresAt }) {
  const [label, setLabel] = React.useState(() => formatExpiry(expiresAt));
  React.useEffect(() => {
    const id = setInterval(() => setLabel(formatExpiry(expiresAt)), 60000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return (
    <Text style={{ color: 'rgba(255,120,100,0.8)', fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>
      {label.toUpperCase()}
    </Text>
  );
}

export default function LoveNoteDetailScreen({ navigation, route }) {
  const { noteId } = route.params || {};
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();

  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [envelopeOpen, setEnvelopeOpen] = useState(false);
  const lottieRef = useRef(null);
  const envelopeTimerRef = useRef(null);

  // ── True Red × Apple Editorial theme map ──
  const t = useMemo(() => ({
    background: isDark ? '#050305' : '#140A0D', // Darkened for deeper contrast
    primary: '#D2121A',
    text: '#FFFFFF',
    subtext: 'rgba(255,255,255,0.6)',
  }), [isDark]);

  const styles = useMemo(() => createStyles(t), [t]);

  // ── Animation shared values ──
  const revealProgress = useSharedValue(0);
  const fogOpacity = useSharedValue(1);

  useEffect(() => {
    if (!isPremium) {
      showPaywall?.(PremiumFeature.LOVE_NOTES);
      navigation.goBack();
    }
  }, [isPremium, navigation, showPaywall]);

  useEffect(() => {
    if (!noteId) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    let active = true;
    setLoadError(false);
    setEnvelopeOpen(false);
    revealProgress.value = 0;
    fogOpacity.value = 1;
    
    (async () => {
      try {
        let loaded = await DataLayer.getLoveNote(noteId);
        if (!loaded) {
          await DataLayer.pullNow().catch(() => {});
          loaded = await DataLayer.getLoveNote(noteId);
        }
        if (active) {
          if (loaded) setNote(loaded);
          else setLoadError(true);
        }
      } catch (err) {
        if (__DEV__) console.warn('[LoveNoteDetail] Failed to load note:', err?.message);
        if (active) setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      lottieRef.current?.reset?.();
      if (envelopeTimerRef.current) clearTimeout(envelopeTimerRef.current);
    };
  }, [noteId]);

  useEffect(() => {
    if (envelopeOpen && note && !note.isOwn && !note.isRead) {
      DataLayer.markLoveNoteRead(note.id).catch((err) =>
        if (__DEV__) console.warn('[LoveNoteDetail] Failed to mark read:', err?.message)
      );
    }
  }, [envelopeOpen, note]);

  // ── Animated styles ──
  const cardRevealStyle = useAnimatedStyle(() => ({
    opacity: interpolate(revealProgress.value, [0, 0.5, 1], [0, 1, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(revealProgress.value, [0, 1], [40, 0], Extrapolation.CLAMP) },
      { scale: interpolate(revealProgress.value, [0, 1], [0.96, 1], Extrapolation.CLAMP) },
    ],
  }));

  const fogStyle = useAnimatedStyle(() => ({
    opacity: fogOpacity.value,
  }));

  // ── Handlers ──
  const handleOpenEnvelope = () => {
    impact(ImpactFeedbackStyle.Heavy);
    lottieRef.current?.play();
    envelopeTimerRef.current = setTimeout(() => {
      setEnvelopeOpen(true);
      
      // Phase 1: Spring the card into place underneath the fog
      revealProgress.value = withSpring(1, { damping: 20, stiffness: 90, mass: 0.8 });
      
      // Phase 2: Slowly evaporate the fog (Wipe Reveal)
      fogOpacity.value = withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.ease) });
      
      notification(NotificationFeedbackType.Success);
    }, 1800);
  };

  // Image retry hook — must be before early returns
  const [retryImageUri, setRetryImageUri] = useState(null);
  useEffect(() => {
    const mediaRef = note?.mediaRef;
    const imageUri = note?.imageUri;
    if (mediaRef && !imageUri) {
      DataLayer.getLoveNoteImageUri(mediaRef)
        .then(uri => { if (uri) setRetryImageUri(uri); })
        .catch(() => {});
    } else {
      setRetryImageUri(null);
    }
  }, [note?.mediaRef, note?.imageUri]);

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

  if (loadError || !note) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center", backgroundColor: t.background }]}>
        <Text style={{ color: t.subtext, marginBottom: 16 }}>
          {loadError ? "Couldn\u2019t load this note." : "This note no longer exists."}
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: t.primary, fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const stationery = note?.stationeryId
    ? (STATIONERY_MAP[note.stationeryId] || STATIONERY_MAP.love)
    : STATIONERY_MAP.love;
  const displayImageUri = note?.imageUri || retryImageUri;
  const showImage = !!displayImageUri;

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: t.background }]}>
        <StatusBar barStyle="light-content" />
        <FilmGrain opacity={0.04} />

        {/* Deep Velvet Background */}
        <Animated.View style={StyleSheet.absoluteFill}>
          <LinearGradient colors={[stationery.metal, t.background]} style={styles.fullBg} />
          <View style={styles.overlay} />
          <GlowOrb color={stationery.accent} size={SCREEN_WIDTH * 1.5} top={-200} left={-100} opacity={0.15} />
        </Animated.View>

        {/* STAGE 1: The Sealed Envelope */}
        {!envelopeOpen && (
          <SafeAreaView style={styles.envelopeContainer}>
            <View style={styles.envelopeTopBar}>
              <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
                <BlurView intensity={40} tint="dark" style={styles.circleButton}>
                  <Icon name="chevron-back" size={24} color={t.text} />
                </BlurView>
              </TouchableOpacity>
            </View>

            <Animated.View entering={FadeIn.duration(800)} style={styles.envelopeCenterArea}>
              <Text style={[styles.envelopeLabel, { color: t.primary }]}>
                {note.isOwn ? 'YOUR SENT NOTE' : 'A PRIVATE MESSAGE'}
              </Text>
              <Text style={[styles.editorialTitle, { color: t.text }]}>
                {note.isOwn ? 'Delivered with love' : 'For your eyes only'}
              </Text>

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

        {/* STAGE 2: The Revealed Note */}
        {envelopeOpen && (
          <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            <Animated.View entering={FadeIn.duration(600).delay(400)} style={styles.topBar}>
              <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
                <BlurView intensity={40} tint="dark" style={styles.circleButton}>
                  <Icon name="chevron-back" size={24} color="#FFF" />
                </BlurView>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} activeOpacity={0.7}>
                <BlurView intensity={40} tint="dark" style={styles.circleButton}>
                  <Icon name="trash-outline" size={20} color="#FFF" />
                </BlurView>
              </TouchableOpacity>
            </Animated.View>

            <View style={styles.centerArea}>
              <Animated.View style={[styles.card, cardRevealStyle, { borderColor: withAlpha(stationery.accent, 0.15) }]}>
                
                {/* ── Paper Lighting Gradient ── */}
                <LinearGradient 
                  colors={[stationery.paper, withAlpha(stationery.paper, 0.9)]} 
                  style={StyleSheet.absoluteFill} 
                />

                {/* ── Love Letter Paper Lines ── */}
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  {/* Left margin accent line */}
                  <View style={[styles.cardAccentStrip, { backgroundColor: withAlpha(stationery.accent, 0.25) }]} />
                  {/* Ruled lines */}
                  {Array.from({ length: 18 }).map((_, i) => (
                    <View key={i} style={[styles.cardRuledLine, { top: 80 + i * 32, backgroundColor: stationery.ruled }]} />
                  ))}
                </View>

                <View style={styles.cardContent}>
                  <View style={[styles.cardFooter, { borderTopColor: 'transparent', borderBottomColor: withAlpha(stationery.ink, 0.1), borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 12, paddingBottom: 10, paddingTop: 0 }]}>
                    <Text style={[styles.dateText, { color: withAlpha(stationery.ink, 0.4) }]}>{formatDate(note.createdAt).toUpperCase()}</Text>
                    <Icon name="shield-checkmark-outline" size={16} color={withAlpha(stationery.ink, 0.3)} />
                  </View>

                  {/* Photo attachment with physical Polaroid feel */}
                  {showImage && (
                    <View style={styles.cardPhotoFrame}>
                      <Image source={{ uri: displayImageUri }} style={styles.cardPhotoImg} resizeMode="cover" />
                    </View>
                  )}

                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                    {note.locked ? (
                      <Text style={[styles.noteText, { color: stationery.ink, opacity: 0.4 }]}>[Message could not be decrypted]</Text>
                    ) : (
                      <Text style={[styles.noteText, { color: stationery.ink }]}>{note.text}</Text>
                    )}
                  </ScrollView>

                  <View style={styles.senderHeader}>
                    <View style={[styles.senderLine, { backgroundColor: withAlpha(stationery.ink, 0.15) }]} />
                    <Text style={[styles.senderLabel, { color: withAlpha(stationery.ink, 0.5) }]}>
                      FROM {note.senderName?.toUpperCase() || 'YOUR PARTNER'}
                    </Text>
                  </View>
                </View>

                {/* Wax seal using Outline Icon */}
                <View style={[styles.cardWaxSeal, { backgroundColor: stationery.accent }]}>
                  <Icon name={stationery.icon} size={20} color="#FFFFFF" />
                </View>
              </Animated.View>
            </View>

            <Animated.View entering={FadeInUp.delay(1200)} style={styles.bottomDecoration}>
              {!note.isOwn ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    impact(ImpactFeedbackStyle.Medium);
                    navigation.navigate("ComposeLoveNote");
                  }}
                >
                  <LinearGradient colors={[t.primary, '#9F1218']} style={styles.replyButton}>
                    <Icon name="heart-outline" size={20} color="#FFF" />
                    <Text style={styles.replyButtonText}>Respond with Love</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <BlurView intensity={30} tint="dark" style={styles.sentBadge}>
                  <Icon name="checkmark-done-outline" size={18} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.sentText}>DELIVERED TO THEIR HEART</Text>
                </BlurView>
              )}
            </Animated.View>
          </SafeAreaView>
        )}

        {/* STAGE 3: The Foggy Glass Wipe Reveal Overlay */}
        {envelopeOpen && (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, fogStyle, { zIndex: 100 }]}>
            <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
          </Animated.View>
        )}
      </View>
    </View>
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
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 2.5,
      marginBottom: 8,
    },
    editorialTitle: {
      fontFamily: SERIF_FONT,
      fontSize: 40,
      letterSpacing: -1.2,
      marginBottom: 24,
      textAlign: 'center',
    },
    lottieContainer: {
      width: SCREEN_WIDTH * 0.85,
      height: SCREEN_WIDTH * 0.85,
      alignItems: "center",
      justifyContent: "center",
    },
    lottieEnvelope: { width: '100%', height: '100%' },
    hintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 32,
    },
    envelopeTapHint: {
      fontFamily: SYSTEM_FONT,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 2,
    },

    // ── Reveal Phase ──
    fullBg: { ...StyleSheet.absoluteFillObject },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
    safeArea: { flex: 1 },
    topBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 24,
      paddingTop: 12,
      zIndex: 10,
    },
    circleButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
      overflow: 'hidden',
    },
    centerArea: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    card: {
      width: SCREEN_WIDTH - 48,
      height: SCREEN_HEIGHT * 0.68,
      borderRadius: 8, // Slightly sharper corners for premium paper feel
      overflow: "hidden",
      borderWidth: 1,
      ...Platform.select({
        ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.4, shadowRadius: 32 },
        android: { elevation: 16 },
      }),
    },
    cardAccentStrip: {
      position: 'absolute',
      left: 36,
      top: 0,
      bottom: 0,
      width: 2,
    },
    cardRuledLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: StyleSheet.hairlineWidth,
    },
    cardPhotoFrame: {
      alignSelf: 'center',
      width: '75%',
      height: 200,
      borderRadius: 4,
      overflow: 'hidden',
      backgroundColor: '#FFF',
      padding: 8,
      marginBottom: 24,
      transform: [{ rotate: '-2deg' }],
      ...Platform.select({
        ios: { shadowColor: "#000", shadowOffset: { width: 2, height: 8 }, shadowOpacity: 0.15, shadowRadius: 12 },
        android: { elevation: 6 },
      }),
    },
    cardPhotoImg: {
      flex: 1,
      borderRadius: 2,
    },
    cardWaxSeal: {
      position: 'absolute',
      bottom: 20,
      right: 20,
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 6 },
        android: { elevation: 5 },
      }),
    },
    cardContent: { flex: 1, paddingHorizontal: 48, paddingTop: 36, paddingBottom: 36 },
    senderHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 28,
    },
    senderLine: { height: StyleSheet.hairlineWidth, flex: 1 },
    senderLabel: {
      fontFamily: SYSTEM_FONT,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 2,
    },
    noteText: {
      fontFamily: SERIF_FONT,
      fontSize: 26,
      lineHeight: 38,
      letterSpacing: 0.3,
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 24,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: 24,
    },
    dateText: {
      fontFamily: SYSTEM_FONT,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.5,
    },

    // ── Bottom Interaction ──
    bottomDecoration: {
      alignItems: "center",
      paddingBottom: Platform.OS === 'ios' ? 24 : 36,
      zIndex: 10,
    },
    replyButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 36,
      height: 60,
      borderRadius: 30,
      ...Platform.select({
        ios: { shadowColor: '#D2121A', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 20 },
        android: { elevation: 8 },
      }),
    },
    replyButtonText: {
      color: "#FFF",
      fontFamily: SYSTEM_FONT,
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    sentBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 24,
      height: 48,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      overflow: 'hidden',
    },
    sentText: {
      color: 'rgba(255,255,255,0.9)',
      fontFamily: SYSTEM_FONT,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.5,
    },
  });
  