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
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { useTheme } from "../context/ThemeContext";
import { useAppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useEntitlements } from "../context/EntitlementsContext";
import DataLayer from "../services/data/DataLayer";
import { SPACING, withAlpha } from "../utils/theme";

const { width: screenWidth } = Dimensions.get("window");
const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

const STATIONERY_OPTIONS = [
  { id: "sexy",    icon: "flame-outline", gradient: ["#D2121A", "#5E081D"], label: "Intimate" },
  { id: "love",    icon: "heart-outline", gradient: ["#E8A0BF", "#BA6B8F"], label: "Sweet" },
  { id: "dreamy",  icon: "moon-outline",  gradient: ["#1C1C1E", "#0A0003"], label: "Midnight" },
  { id: "playful", icon: "happy-outline", gradient: ["#FFD966", "#F5A623"], label: "Playful" },
  { id: "classic", icon: "mail-outline",  gradient: ["#AEB6BF", "#5D6D7E"], label: "Classic" },
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
    background: colors.background, 
    surface: isDark ? '#131016' : '#FFFFFF',
    surfaceSecondary: isDark ? '#1C1520' : '#F2F2F7',
    primary: colors.primary || '#D2121A', 
    text: colors.text,
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const [text, setText] = useState("");
  const [imageUri, setImageUri] = useState(null);
  const [selectedStationery, setSelectedStationery] = useState(STATIONERY_OPTIONS[0]);
  const [isSending, setIsSending] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [invisibleInk, setInvisibleInk] = useState(false);

  const inputRef = useRef(null);
  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  if (!isPremium) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.background }}>
        <StatusBar barStyle="light-content" />
        <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={15}>
            <Icon name="chevron-back" size={28} color={t.text} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
          <View style={styles.lockIconContainer}>
            <Icon name="lock-closed-outline" size={32} color={t.primary} />
          </View>
          <Text style={styles.lockTitle}>Love Notes</Text>
          <Text style={styles.lockSubtitle}>
            Write heartfelt notes, choose high-end stationery, and share private moments with your partner.
          </Text>
          <TouchableOpacity
            onPress={() => showPaywall?.('loveNotes')}
            style={styles.lockButton}
            activeOpacity={0.9}
          >
            <Icon name="sparkles" size={18} color="#FFF" />
            <Text style={styles.lockButtonText}>Unlock Pro Experience</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
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
    if (!result.canceled && result.assets?.[0]?.uri) {
      setImageUri(result.assets[0].uri);
      impact(ImpactFeedbackStyle.Light);
    }
  };

  const handleSend = async () => {
    if (!text.trim() && !imageUri) return;
    setIsSending(true);
    notification(NotificationFeedbackType.Success).catch(() => {});
    try {
      await DataLayer.saveLoveNote({
        text: text.trim() || null,
        imageUri: imageUri || null,
        stationeryId: selectedStationery.id,
        senderName: userProfile?.partnerNames?.myName || userProfile?.displayName || userProfile?.name || null,
        invisibleInk,
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert("Error", "Your partner key isn't ready. Ensure both are paired.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[t.background, "#0A0003"]} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          {/* Editorial Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
              <Icon name="close-outline" size={28} color={t.text} />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Compose</Text>
              <View style={styles.headerIndicator} />
            </View>

            <TouchableOpacity
              style={[styles.sendButton, (!text.trim() && !imageUri) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={isSending || (!text.trim() && !imageUri)}
            >
              <Text style={styles.sendText}>{isSending ? "..." : "Send"}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            
            {/* Live Preview Card */}
            <Animated.View entering={FadeInDown.springify()} style={styles.previewWrapper}>
              <View style={[styles.previewCard, { borderColor: t.border }]}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.previewImage} />
                ) : (
                  <LinearGradient colors={selectedStationery.gradient} style={styles.previewGradientFill}>
                    <Icon name={selectedStationery.icon} size={80} color={withAlpha('#FFF', 0.1)} />
                  </LinearGradient>
                )}
                <LinearGradient colors={["transparent", "rgba(0,0,0,0.8)"]} style={styles.previewOverlay} />
                <View style={styles.previewTextContainer}>
                  <Text style={styles.previewText} numberOfLines={6}>
                    {text || "Your heartbeat, in words..."}
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* Stationery Picker */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Select Vibe</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stationeryRow}>
                {STATIONERY_OPTIONS.map((opt) => {
                  const isActive = selectedStationery.id === opt.id;
                  return (
                    <TouchableOpacity key={opt.id} onPress={() => { setSelectedStationery(opt); selection(); }} style={styles.optContainer}>
                      <LinearGradient colors={opt.gradient} style={[styles.stationeryChip, isActive && { borderWidth: 2, borderColor: '#FFF' }]}>
                        <Icon name={opt.icon} size={20} color="#FFF" />
                      </LinearGradient>
                      <Text style={[styles.stationeryLabel, { color: isActive ? t.text : t.subtext }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Text Input Area */}
            <View style={styles.inputArea}>
              <TextInput
                ref={inputRef}
                style={styles.textInput}
                placeholder="Write something intimate..."
                placeholderTextColor={withAlpha(t.text, 0.3)}
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
                <View style={styles.promptList}>
                  {PROMPTS.map((p, i) => (
                    <TouchableOpacity key={i} style={[styles.promptItem, { backgroundColor: t.surfaceSecondary }]} onPress={() => { setText(p); setShowPrompts(false); }}>
                      <Text style={[styles.promptItemText, { color: t.text }]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Media Actions */}
            <View style={styles.mediaRow}>
              <TouchableOpacity style={[styles.mediaBtn, { backgroundColor: t.surfaceSecondary }]} onPress={handlePickImage}>
                <Icon name="image-outline" size={20} color={t.text} />
                <Text style={[styles.mediaBtnText, { color: t.text }]}>Add Photo</Text>
              </TouchableOpacity>
              
              {imageUri && (
                <TouchableOpacity onPress={() => setImageUri(null)} style={styles.removeBtn}>
                  <Text style={{ color: t.primary, fontWeight: '700' }}>Remove Image</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Invisible Ink Toggle */}
            <TouchableOpacity
              style={[
                styles.inkToggle,
                invisibleInk && { borderColor: t.primary, backgroundColor: `${t.primary}18` },
              ]}
              onPress={() => { setInvisibleInk(v => !v); selection(); }}
              activeOpacity={0.85}
            >
              <Icon
                name={invisibleInk ? 'eye-off' : 'eye-off-outline'}
                size={18}
                color={invisibleInk ? t.primary : t.subtext}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.inkToggleTitle, { color: invisibleInk ? t.primary : t.text }]}>
                  Invisible Ink
                </Text>
                <Text style={[styles.inkToggleSubtitle, { color: t.subtext }]}>
                  {invisibleInk
                    ? 'Partner must tilt their phone 45° to reveal'
                    : 'Hide message — tilt to reveal'}
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
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (t, isDark) => StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    height: 60,
  },
  headerCenter: { alignItems: "center" },
  headerTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 42,
    color: t.text,
  },
  headerIndicator: {
    width: 12,
    height: 2,
    backgroundColor: t.primary,
    marginTop: 4,
    borderRadius: 1,
  },
  sendButton: {
    backgroundColor: t.primary,
    paddingHorizontal: 20,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
  },
  sendButtonDisabled: { opacity: 0.3 },
  sendText: { color: "#FFF", fontSize: 14, fontWeight: "800" },
  
  // Content
  scroll: { flex: 1, paddingHorizontal: 24 },
  previewWrapper: { alignItems: "center", marginVertical: 32 },
  previewCard: {
    width: screenWidth * 0.75,
    height: screenWidth * 0.95,
    borderRadius: 32,
    overflow: "hidden",
    borderWidth: 1,
  },
  previewImage: { ...StyleSheet.absoluteFillObject },
  previewGradientFill: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  previewOverlay: { ...StyleSheet.absoluteFillObject },
  previewTextContainer: { position: "absolute", bottom: 0, padding: 24 },
  previewText: { 
    color: "#FFF", 
    fontSize: 18, 
    fontWeight: "600", 
    fontStyle: "italic", 
    lineHeight: 26,
    letterSpacing: -0.4
  },
  
  // Stationery
  section: { marginBottom: 32 },
  sectionLabel: { 
    fontSize: 12, 
    fontWeight: "800", 
    textTransform: "uppercase", 
    letterSpacing: 1.5, 
    color: t.subtext, 
    marginBottom: 16 
  },
  stationeryRow: { gap: 16 },
  optContainer: { alignItems: 'center' },
  stationeryChip: { 
    width: 56, 
    height: 56, 
    borderRadius: 16, 
    alignItems: "center", 
    justifyContent: "center" 
  },
  stationeryLabel: { fontSize: 11, fontWeight: "700", marginTop: 8 },
  
  // Input
  inputArea: { marginBottom: 32 },
  textInput: { 
    fontFamily: SYSTEM_FONT, 
    fontSize: 20, 
    color: t.text, 
    minHeight: 120, 
    textAlignVertical: "top", 
    fontWeight: "500",
    letterSpacing: -0.5
  },
  promptBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  promptBtnText: { fontSize: 14, fontWeight: '700', color: t.primary },
  promptList: { marginTop: 12, gap: 8 },
  promptItem: { padding: 12, borderRadius: 12 },
  promptItemText: { fontSize: 14, fontWeight: '600', fontStyle: 'italic' },
  
  // Media
  mediaRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingBottom: 24 },
  mediaBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10, 
    height: 48, 
    paddingHorizontal: 20, 
    borderRadius: 24 
  },
  mediaBtnText: { fontSize: 14, fontWeight: '700' },
  removeBtn: { marginLeft: 'auto' },

  // Invisible Ink toggle
  inkToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 60,
  },
  inkToggleTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  inkToggleSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  inkTogglePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  inkTogglePillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Lock Screen Updates
  lockIconContainer: { 
    width: 80, 
    height: 80, 
    borderRadius: 24, 
    backgroundColor: withAlpha(t.primary, 0.12), 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 32 
  },
  lockTitle: { 
    color: t.text, 
    fontSize: 32, 
    fontWeight: '800', 
    letterSpacing: -1, 
    marginBottom: 12, 
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
    backgroundColor: t.primary, 
    height: 56, 
    borderRadius: 28, 
    width: '100%', 
    alignItems: 'center', 
    justifyContent: 'center', 
    flexDirection: 'row', 
    gap: 10 
  },
  lockButtonText: { 
    color: '#FFF', 
    fontSize: 16, 
    fontWeight: '800', 
    textTransform: 'uppercase', 
    letterSpacing: -0.2 
  },
});
