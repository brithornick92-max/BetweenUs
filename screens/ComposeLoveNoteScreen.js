// screens/ComposeLoveNoteScreen.js — Write a love note with optional photo
// Sexy Red Intimacy & Apple Editorial Updates Integrated.

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
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Icon from '../components/Icon';
import { BlurView } from "expo-blur";
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import * as ImagePicker from "expo-image-picker";
import Animated, { FadeIn, FadeInDown, Layout, SlideInDown } from "react-native-reanimated";

import { useTheme } from "../context/ThemeContext";
import { useAppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useEntitlements } from "../context/EntitlementsContext";
import { PremiumFeature } from '../utils/featureFlags';
import DataLayer from "../services/data/DataLayer";
import { SPACING, withAlpha } from "../utils/theme";
import { getMyDisplayName } from '../utils/profileNames';

const { width: screenWidth } = Dimensions.get("window");
const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });
const SERIF_FONT = Platform.select({ ios: "DMSerifDisplay-Regular", android: "DMSerifDisplay_400Regular", default: "serif" });

// All Emojis replaced with crisp Outline Ionicons for that custom-embossed wax seal look
const STATIONERY_OPTIONS = [
  { id: "sexy",    icon: "flame-outline", label: "Intimate",  paper: "#FFF5F5", ink: "#6B0F0F", accent: "#D2121A", ruled: "rgba(200,80,80,0.08)" },
  { id: "love",    icon: "heart-outline", label: "Sweet",     paper: "#FFF0F5", ink: "#5E2040", accent: "#D4609A", ruled: "rgba(180,100,140,0.08)" },
  { id: "dreamy",  icon: "moon-outline",  label: "Midnight",  paper: "#F0EDF8", ink: "#1C1C3E", accent: "#7B68EE", ruled: "rgba(80,60,160,0.08)" },
  { id: "playful", icon: "happy-outline", label: "Playful",   paper: "#FFFDF2", ink: "#5C4A1E", accent: "#E8A020", ruled: "rgba(180,140,40,0.08)" },
  { id: "classic", icon: "mail-outline",  label: "Classic",   paper: "#FAF8F5", ink: "#2C2C2E", accent: "#8B7355", ruled: "rgba(100,80,60,0.08)" },
];

const PROMPTS = [
  "I love you because…",
  "My favorite memory with you is…",
  "You make me feel…",
  "I can't stop thinking about…",
  "Tonight I want to…",
];

export default function ComposeLoveNoteScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { state } = useAppContext();
  const { userProfile } = useAuth();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();

  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    background: isDark ? '#050305' : '#140A0D', 
    surface: 'rgba(255,255,255,0.03)',
    surfaceSecondary: 'rgba(255,255,255,0.06)',
    primary: '#D2121A', 
    text: '#FFFFFF',
    subtext: 'rgba(255, 255, 255, 0.55)',
    border: 'rgba(255,255,255,0.08)',
  }), [isDark]);

  const [text, setText] = useState("");
  const [imageUri, setImageUri] = useState(null);
  const [selectedStationery, setSelectedStationery] = useState(STATIONERY_OPTIONS[0]);
  const [isSending, setIsSending] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [invisibleInk, setInvisibleInk] = useState(false);

  const inputRef = useRef(null);
  const styles = useMemo(() => createStyles(t), [t]);

  // ─── Premium Lock Screen (Velvet Glass Upgraded) ───
  if (!isPremium) {
    return (
      <View style={{ flex: 1, backgroundColor: t.background }}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={['#16050A', t.background]} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <BlurView intensity={40} tint="dark" style={styles.circleButton}>
                <Icon name="chevron-back" size={24} color={t.text} />
              </BlurView>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
            <Animated.View entering={FadeInDown.springify().damping(20)}>
              <BlurView intensity={80} tint="dark" style={styles.lockCard}>
                <View style={styles.lockIconContainer}>
                  <Icon name="heart-half-outline" size={40} color={t.primary} />
                </View>
                <Text style={styles.lockTitle}>Love Notes</Text>
                <Text style={styles.lockSubtitle}>
                  Write deeply personal notes on high-end stationery. Encrypted, intimate, and exclusive to the Pro experience.
                </Text>
                <TouchableOpacity
                  onPress={() => showPaywall?.(PremiumFeature.LOVE_NOTES)}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={[t.primary, '#8A0B11']} style={styles.lockButton}>
                    <Icon name="sparkles-outline" size={18} color="#FFF" />
                    <Text style={styles.lockButtonText}>Unlock Pro</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </BlurView>
            </Animated.View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 5],
    });
    const asset = result.assets?.[0];
    if (!result.canceled && asset?.uri) {
      if (asset.fileSize && asset.fileSize > 5_000_000) {
        Alert.alert("Image Too Large", "Please choose a photo under 5 MB.");
        return;
      }
      setImageUri(asset.uri);
      impact(ImpactFeedbackStyle.Medium);
    }
  };

  const handleSend = async () => {
    if (!text.trim() && !imageUri) return;
    setIsSending(true);
    try {
      await DataLayer.saveLoveNote({
        text: text.trim() || null,
        imageUri: imageUri || null,
        stationeryId: selectedStationery.id,
        senderName: getMyDisplayName(userProfile, state?.userProfile, null),
        invisibleInk,
      });
      notification(NotificationFeedbackType.Success).catch(() => {});
      navigation.goBack();
    } catch (err) {
      let message = "Something went wrong. Please try again.";
      if (err?.message?.includes('COUPLE_KEY_MISSING')) {
        message = "Your partner key isn't ready. Make sure both partners have completed pairing.";
      } else if (err?.message?.includes('attach image')) {
        message = "Failed to attach your photo. Please try a different image.";
      }
      Alert.alert("Couldn't Send Note", message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#110408', t.background]} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          
          {/* Editorial Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <BlurView intensity={40} tint="dark" style={styles.circleButton}>
                <Icon name="close-outline" size={24} color={t.text} />
              </BlurView>
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Compose</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleSend}
              disabled={isSending || (!text.trim() && !imageUri)}
            >
              <Animated.View layout={Layout.springify()}>
                <LinearGradient 
                  colors={(!text.trim() && !imageUri) ? ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)'] : [t.primary, '#9F1218']}
                  style={styles.sendButton}
                >
                  <Text style={[styles.sendText, (!text.trim() && !imageUri) && { color: t.subtext }]}>
                    {isSending ? "..." : "Seal"}
                  </Text>
                </LinearGradient>
              </Animated.View>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            
            {/* Live Preview Card */}
            <Animated.View entering={FadeInDown.springify().damping(20).delay(100)} style={styles.previewWrapper}>
              <View style={[styles.previewCard, { borderColor: withAlpha(selectedStationery.accent, 0.15) }]}>
                
                {/* ── Paper Lighting Gradient ── */}
                <LinearGradient 
                  colors={[selectedStationery.paper, withAlpha(selectedStationery.paper, 0.9)]} 
                  style={StyleSheet.absoluteFill} 
                />

                {/* Left margin accent line */}
                <View style={[styles.accentStrip, { backgroundColor: withAlpha(selectedStationery.accent, 0.25) }]} />
                
                {/* Ruled lines */}
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <View key={i} style={[styles.ruledLine, { top: 52 + i * 28, backgroundColor: selectedStationery.ruled }]} />
                  ))}
                </View>

                {/* Photo tucked into letter (Polaroid Feel) */}
                {imageUri && (
                  <View style={styles.photoInset}>
                    <Image source={{ uri: imageUri }} style={styles.photoInsetImg} />
                  </View>
                )}

                {/* Letter text */}
                <View style={[styles.letterBody, imageUri && { top: 140 }]}>
                  <Text style={[styles.letterText, { color: selectedStationery.ink, opacity: text ? 1 : 0.4 }]} numberOfLines={imageUri ? 4 : 8}>
                    {text || "Write something from the heart..."}
                  </Text>
                </View>

                {/* Outline Icon Wax Seal */}
                <View style={[styles.waxSeal, { backgroundColor: selectedStationery.accent }]}>
                  <Icon name={selectedStationery.icon} size={14} color="#FFF" />
                </View>
              </View>
            </Animated.View>

            {/* Stationery Picker (Velvet Swatches) */}
            <Animated.View entering={FadeIn.delay(300)} style={styles.section}>
              <Text style={styles.sectionLabel}>Material & Vibe</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stationeryRow}>
                {STATIONERY_OPTIONS.map((opt) => {
                  const isActive = selectedStationery.id === opt.id;
                  return (
                    <TouchableOpacity key={opt.id} onPress={() => { setSelectedStationery(opt); selection(); }} activeOpacity={0.8}>
                      <View style={[
                        styles.stationeryChip, 
                        { backgroundColor: opt.paper },
                        isActive && { borderColor: opt.accent, borderWidth: 2, transform: [{ scale: 1.05 }] }
                      ]}>
                        <Icon name={opt.icon} size={22} color={opt.accent} />
                      </View>
                      <Text style={[styles.stationeryLabel, { color: isActive ? '#FFF' : t.subtext }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Animated.View>

            {/* Text Input Area */}
            <View style={styles.inputArea}>
              <TextInput
                ref={inputRef}
                style={[styles.textInput, { color: '#FFF' }]}
                placeholder="Pour your heart out here..."
                placeholderTextColor={t.subtext}
                value={text}
                onChangeText={setText}
                multiline
                selectionColor={t.primary}
              />
              
              <TouchableOpacity style={styles.promptBtn} onPress={() => { setShowPrompts(!showPrompts); selection(); }}>
                <Icon name="bulb-outline" size={16} color={t.primary} />
                <Text style={styles.promptBtnText}>Need a spark?</Text>
              </TouchableOpacity>

              {showPrompts && (
                <Animated.View entering={SlideInDown.springify()} style={styles.promptList}>
                  {PROMPTS.map((p, i) => (
                    <TouchableOpacity key={i} onPress={() => { setText(p); setShowPrompts(false); impact(ImpactFeedbackStyle.Light); }}>
                      <BlurView intensity={30} tint="dark" style={styles.promptItem}>
                        <Text style={[styles.promptItemText, { color: t.text }]}>{p}</Text>
                      </BlurView>
                    </TouchableOpacity>
                  ))}
                </Animated.View>
              )}
            </View>

            {/* Media Actions */}
            <View style={styles.mediaRow}>
              <TouchableOpacity activeOpacity={0.8} onPress={handlePickImage}>
                <BlurView intensity={40} tint="dark" style={styles.mediaBtn}>
                  <Icon name="image-outline" size={20} color={t.text} />
                  <Text style={[styles.mediaBtnText, { color: t.text }]}>Attach Photo</Text>
                </BlurView>
              </TouchableOpacity>
              
              {imageUri && (
                <TouchableOpacity onPress={() => setImageUri(null)} style={styles.removeBtn}>
                  <Text style={{ color: t.primary, fontWeight: '700', fontSize: 13, letterSpacing: 0.5 }}>REMOVE</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Invisible Ink Toggle */}
            <TouchableOpacity
              onPress={() => { setInvisibleInk(v => !v); selection(); }}
              activeOpacity={0.85}
              style={{ marginBottom: 60 }}
            >
              <BlurView intensity={40} tint="dark" style={[
                styles.inkToggle,
                invisibleInk && { borderColor: withAlpha(t.primary, 0.4), backgroundColor: withAlpha(t.primary, 0.1) }
              ]}>
                <Icon
                  name={invisibleInk ? 'eye-off' : 'eye-off-outline'}
                  size={22}
                  color={invisibleInk ? t.primary : t.subtext}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inkToggleTitle, { color: invisibleInk ? t.primary : t.text }]}>
                    Invisible Ink
                  </Text>
                  <Text style={[styles.inkToggleSubtitle, { color: t.subtext }]}>
                    {invisibleInk
                      ? 'Partner must hold phone up to light to reveal.'
                      : 'Hide message until tilted.'}
                  </Text>
                </View>
                <View style={[
                  styles.inkTogglePill,
                  { backgroundColor: invisibleInk ? t.primary : t.surfaceSecondary },
                ]}>
                  <Text style={[
                    styles.inkTogglePillText,
                    { color: invisibleInk ? '#FFF' : t.subtext },
                  ]}>
                    {invisibleInk ? 'ON' : 'OFF'}
                  </Text>
                </View>
              </BlurView>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (t) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050305' },
  safeArea: { flex: 1 },
  
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    height: 70,
    zIndex: 10,
  },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: t.border,
    overflow: 'hidden',
  },
  headerCenter: { alignItems: "center" },
  headerTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
    color: t.text,
    textTransform: 'uppercase',
  },
  sendButton: {
    paddingHorizontal: 20,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  sendText: { color: "#FFF", fontSize: 14, fontWeight: "800", letterSpacing: 0.5 },
  
  // Content
  scroll: { flex: 1, paddingHorizontal: 24 },
  previewWrapper: { alignItems: "center", marginVertical: 32 },
  previewCard: {
    width: screenWidth * 0.75,
    height: screenWidth * 0.95,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    position: 'relative',
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.35, shadowRadius: 24 },
      android: { elevation: 12 },
    }),
  },
  accentStrip: {
    position: 'absolute',
    left: 32,
    top: 0,
    bottom: 0,
    width: 2,
  },
  ruledLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  photoInset: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 80,
    height: 100,
    borderRadius: 4,
    overflow: 'hidden',
    transform: [{ rotate: '3deg' }],
    backgroundColor: '#FFF',
    padding: 6,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 2, height: 6 }, shadowOpacity: 0.25, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  photoInsetImg: {
    flex: 1,
    borderRadius: 2,
  },
  letterBody: {
    position: 'absolute',
    left: 44,
    right: 20,
    top: 52,
    bottom: 44,
  },
  letterText: {
    fontFamily: SERIF_FONT,
    fontSize: 16,
    lineHeight: 28,
  },
  waxSeal: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },
  
  // Stationery
  section: { marginBottom: 36 },
  sectionLabel: { 
    fontFamily: SYSTEM_FONT,
    fontSize: 11, 
    fontWeight: "800", 
    textTransform: "uppercase", 
    letterSpacing: 2, 
    color: t.subtext, 
    marginBottom: 20 
  },
  stationeryRow: { gap: 20, paddingBottom: 10 },
  stationeryChip: {
    width: 56,
    height: 72,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: 'transparent',
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  stationeryLabel: { 
    fontSize: 11, 
    fontWeight: "800", 
    marginTop: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  
  // Input
  inputArea: { marginBottom: 36 },
  textInput: { 
    fontFamily: SYSTEM_FONT, 
    fontSize: 22, 
    minHeight: 120, 
    textAlignVertical: "top", 
    fontWeight: "500",
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  promptBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  promptBtnText: { fontSize: 14, fontWeight: '800', color: t.primary, letterSpacing: -0.2 },
  promptList: { marginTop: 16, gap: 10 },
  promptItem: { 
    padding: 16, 
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.border,
    overflow: 'hidden',
  },
  promptItemText: { fontSize: 15, fontWeight: '500', fontStyle: 'italic' },
  
  // Media
  mediaRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingBottom: 32 },
  mediaBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10, 
    height: 52, 
    paddingHorizontal: 24, 
    borderRadius: 26,
    borderWidth: 1,
    borderColor: t.border,
    overflow: 'hidden',
  },
  mediaBtnText: { fontSize: 14, fontWeight: '700' },
  removeBtn: { marginLeft: 'auto' },

  // Invisible Ink toggle
  inkToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: t.border,
    overflow: 'hidden',
  },
  inkToggleTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  inkToggleSubtitle: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
    lineHeight: 18,
  },
  inkTogglePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  inkTogglePillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Lock Screen Updates
  lockCard: {
    width: '100%',
    borderRadius: 40,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.border,
    overflow: 'hidden',
  },
  lockIconContainer: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: 'rgba(210, 18, 26, 0.1)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 24 
  },
  lockTitle: { 
    color: t.text, 
    fontSize: 34, 
    fontWeight: '800', 
    letterSpacing: -1, 
    marginBottom: 16, 
    textAlign: 'center' 
  },
  lockSubtitle: { 
    color: t.subtext, 
    fontSize: 16, 
    textAlign: 'center', 
    lineHeight: 24, 
    marginBottom: 40, 
    fontWeight: '500' 
  },
  lockButton: { 
    height: 60, 
    borderRadius: 30, 
    width: screenWidth * 0.6, 
    alignItems: 'center', 
    justifyContent: 'center', 
    flexDirection: 'row', 
    gap: 10 
  },
  lockButtonText: { 
    color: '#FFF', 
    fontSize: 17, 
    fontWeight: '800', 
    letterSpacing: -0.3 
  },
});
