// components/InsideJokes.jsx
/**
 * BETWEEN US - PRIVATE LANGUAGE VAULT (EDITORIAL V3)
 * High-End Apple Editorial Layout + Sexy Red (#D2121A)
 * Matches Home, Intimacy, and Saved Space architectures.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  FadeInDown,
  FadeIn,
  interpolate,
  Layout,
} from 'react-native-reanimated';
import Icon from './Icon';
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import { SPACING, withAlpha } from '../utils/theme';
import { PrivateLanguageVault } from '../services/ConnectionEngine';

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });
const SERIF_FONT = Platform.select({ ios: "Georgia", android: "serif" });

// ─── CATEGORY COLOR MAP ───
const getJokeTypes = (isDark) => [
  { key: 'nickname', label: 'Nickname', icon: 'heart-half-outline', color: '#FF85C2' },
  { key: 'joke', label: 'Inside Joke', icon: 'sparkles-outline', color: '#FF1493' },
  { key: 'ritual', label: 'Comfort Ritual', icon: 'leaf-outline', color: '#FF006E' },
  { key: 'reference', label: 'Shared Ref', icon: 'bookmark-outline', color: '#F00049' },
  { key: 'phrase', label: 'Our Phrase', icon: 'chatbubbles-outline', color: '#D2121A' }, // Sexy Red
];

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function InsideJokes({ compact = false }) {
  const { colors, isDark } = useTheme();
  
  const JOKE_TYPES = useMemo(() => getJokeTypes(isDark), [isDark]);
  const [jokes, setJokes] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('joke');
  const [formTitle, setFormTitle] = useState('');
  const [formStory, setFormStory] = useState('');

  // ─── THEME MAP ───
  const t = useMemo(() => ({
    background: colors.background,
    surface: colors.surface || (isDark ? '#1C1C1E' : '#FFFFFF'),
    surfaceSecondary: colors.surface2 || (isDark ? '#2C2C2E' : '#F2F2F7'),
    primary: colors.primary || '#D2121A',
    accent: colors.accent || '#D4AA7E',
    text: colors.text,
    subtext: colors.textMuted || (isDark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.6)'),
    border: colors.border || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  // ─── ANIMATIONS ───
  const breathe = useSharedValue(1);
  useEffect(() => {
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }],
    opacity: interpolate(breathe.value, [1, 1.08], [0.4, 0.7]),
  }));

  // ─── DATA LOADING ───
  const loadJokes = useCallback(async () => {
    const loaded = await PrivateLanguageVault.getAll();
    setJokes(loaded || []);
  }, []);

  useEffect(() => { loadJokes(); }, [loadJokes]);

  // ─── HANDLERS ───
  const handleSave = async () => {
    if (!formTitle.trim()) return;
    await PrivateLanguageVault.add({
      type: selectedType,
      title: formTitle.trim(),
      story: formStory.trim(),
    });
    setFormTitle('');
    setFormStory('');
    setModalOpen(false);
    notification(NotificationFeedbackType.Success);
    loadJokes();
  };

  const handleDelete = (id) => {
    impact(ImpactFeedbackStyle.Medium);
    Alert.alert('Remove this memory?', 'This private moment will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
          await PrivateLanguageVault.remove(id);
          loadJokes();
      }},
    ]);
  };

  const getTypeConfig = (type) => JOKE_TYPES.find(t => t.key === type) || JOKE_TYPES[1];

  // ════════════════════════════════════
  //  COMPACT WIDGET RENDER (HOME SCREEN)
  // ════════════════════════════════════
  if (compact) {
    const preview = jokes.slice(0, 2);
    if (preview.length === 0) return null;
    return (
      <View style={[styles.compactContainer, getShadow(isDark)]}>
        <View style={styles.compactHeaderRow}>
          <Icon name="chatbubble-ellipses-outline" size={14} color={t.primary} />
          <Text style={styles.compactHeader}>PRIVATE LANGUAGE</Text>
        </View>
        {preview.map((item) => (
          <View key={item.id} style={styles.compactItem}>
            <View style={[styles.compactDot, { backgroundColor: getTypeConfig(item.type).color }]} />
            <Text style={styles.compactItemText} numberOfLines={1}>{item.title}</Text>
          </View>
        ))}
      </View>
    );
  }

  // ════════════════════════════════════
  //  FULL LIST RENDER
  // ════════════════════════════════════
  const renderItem = ({ item, index }) => {
    const config = getTypeConfig(item.type);
    return (
      <AnimatedTouchable
        entering={FadeInDown.delay(index * 40).springify().damping(18)}
        layout={Layout.springify()}
        style={[styles.card, getShadow(isDark)]}
        onLongPress={() => handleDelete(item.id)}
        activeOpacity={0.85}
      >
        <View style={styles.cardTopRow}>
          <View style={[styles.tag, { backgroundColor: withAlpha(config.color, 0.12), borderColor: withAlpha(config.color, 0.2) }]}>
            <Icon name={config.icon} size={12} color={config.color} />
            <Text style={[styles.tagText, { color: config.color }]}>{config.label.toUpperCase()}</Text>
          </View>
        </View>
        
        <Text style={styles.cardTitle}>{item.title}</Text>
        
        {item.story ? (
          <Text style={styles.cardBody}>{item.story}</Text>
        ) : null}
      </AnimatedTouchable>
    );
  };

  const EmptyState = (
    <Animated.View entering={FadeIn.duration(450)} style={styles.emptyState}>
      <Animated.View style={[styles.emptyIconCircle, breatheStyle]}>
        <Icon name="chatbubble-ellipses-outline" size={42} color={t.primary} />
      </Animated.View>
      <Text style={styles.emptyTitle}>Your vault is quiet</Text>
      <Text style={styles.emptyBody}>
        Add the nicknames, inside jokes, and shared references that define your world.
      </Text>
    </Animated.View>
  );

  return (
    <View style={styles.main}>
      <FlatList
        data={jokes}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={EmptyState}
      />

      {/* ── Apple Floating Action Pill ── */}
      <Animated.View entering={FadeInDown.delay(300).springify().damping(18)} style={styles.fabContainer}>
        <TouchableOpacity 
          style={[styles.fab, getShadow(isDark)]} 
          activeOpacity={0.85}
          onPress={() => { impact(ImpactFeedbackStyle.Light); setModalOpen(true); }}
        >
          <Icon name="add" size={20} color="#FFFFFF" />
          <Text style={styles.fabText}>Add Entry</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── iOS Native Bottom Sheet Aesthetic ── */}
      <Modal visible={modalOpen} animationType="slide" transparent>
        <BlurView intensity={isDark ? 40 : 80} tint={isDark ? "dark" : "light"} style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setModalOpen(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
            <View style={[styles.sheet, getShadow(isDark)]}>
              <View style={styles.sheetHandle} />
              
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Add to Vault</Text>
                <TouchableOpacity onPress={() => { selection(); setModalOpen(false); }} hitSlop={12}>
                  <View style={styles.closeButton}>
                    <Icon name="close" size={20} color={t.subtext} />
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.typeGrid}>
                {JOKE_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.key}
                    style={[
                      styles.typeChip,
                      { borderColor: selectedType === type.key ? type.color : t.border },
                      selectedType === type.key && { backgroundColor: withAlpha(type.color, 0.12) }
                    ]}
                    onPress={() => { selection(); setSelectedType(type.key); }}
                    activeOpacity={0.7}
                  >
                    <Icon name={type.icon} size={14} color={selectedType === type.key ? type.color : t.subtext} />
                    <Text style={[styles.typeText, { color: selectedType === type.key ? type.color : t.subtext }]}>{type.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[styles.inputTitle, { color: t.text, borderColor: t.border, backgroundColor: t.surfaceSecondary }]}
                placeholder="The phrase or name..."
                placeholderTextColor={t.subtext}
                value={formTitle}
                onChangeText={setFormTitle}
              />

              <TextInput
                style={[styles.inputStory, { color: t.text, borderColor: t.border, backgroundColor: t.surfaceSecondary }]}
                placeholder="The story behind it... (optional)"
                placeholderTextColor={t.subtext}
                value={formStory}
                onChangeText={setFormStory}
                multiline
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: formTitle.trim() ? t.primary : t.surfaceSecondary }]}
                onPress={handleSave}
                disabled={!formTitle.trim()}
                activeOpacity={0.85}
              >
                <Text style={[styles.saveBtnText, { color: formTitle.trim() ? '#FFFFFF' : t.subtext }] }>
                  Secure in Vault
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </BlurView>
      </Modal>
    </View>
  );
}

// ─── HIGH-END DESIGN SYSTEM STYLES ───
const getShadow = (isDark) => Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: isDark ? 0.4 : 0.08, shadowRadius: 24 },
  android: { elevation: 6 },
});

const createStyles = (t, isDark) => StyleSheet.create({
  main: { flex: 1 },
  listContent: { 
    paddingHorizontal: SPACING.screen || 24, 
    paddingBottom: 160 
  },

  // ── Compact Widget ──
  compactContainer: { 
    padding: SPACING.lg, 
    borderRadius: 24, 
    borderWidth: 1, 
    borderColor: t.border,
    backgroundColor: t.surface,
  },
  compactHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  compactHeader: { 
    fontFamily: SYSTEM_FONT,
    fontSize: 11, 
    fontWeight: '800', 
    letterSpacing: 1.5, 
    color: t.primary,
  },
  compactItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    marginBottom: 6,
  },
  compactDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4,
  },
  compactItemText: { 
    fontFamily: SYSTEM_FONT,
    fontSize: 15, 
    fontWeight: '600',
    color: t.text,
  },

  // ── Content Cards ──
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
    padding: SPACING.xl || 24,
    marginBottom: SPACING.lg || 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  tagText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cardTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: t.text,
    marginBottom: 6,
  },
  cardBody: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    lineHeight: 24,
    color: t.text,
  },

  // ── Floating Action Pill ──
  fabContainer: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    zIndex: 10,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    gap: 8,
  },
  fabText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // ── Empty State ──
  emptyState: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingTop: 80,
    paddingHorizontal: 40 
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: { 
    fontFamily: SERIF_FONT, 
    fontSize: 30, 
    color: t.text,
    marginBottom: SPACING.sm,
  },
  emptyBody: { 
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    lineHeight: 22,
    color: t.subtext,
    textAlign: 'center', 
  },

  // ── Modal Sheet ──
  modalOverlay: { 
    flex: 1, 
    justifyContent: 'flex-end',
  },
  modalContent: { 
    width: '100%',
  },
  sheet: { 
    borderTopLeftRadius: 36, 
    borderTopRightRadius: 36, 
    padding: SPACING.xl || 24, 
    paddingBottom: Platform.OS === 'ios' ? 50 : 30,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: t.border,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  sheetHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: SPACING.xl,
  },
  sheetTitle: { 
    fontFamily: SYSTEM_FONT, 
    fontSize: 24, 
    fontWeight: '800',
    letterSpacing: -0.4,
    color: t.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: t.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 8, 
    marginBottom: SPACING.xl,
  },
  typeChip: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    paddingVertical: 10, 
    paddingHorizontal: 14, 
    borderRadius: 20, 
    borderWidth: 1,
  },
  typeText: { 
    fontFamily: SYSTEM_FONT,
    fontSize: 13, 
    fontWeight: '700',
  },
  inputTitle: { 
    fontFamily: SYSTEM_FONT,
    fontSize: 17, 
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 16, 
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: SPACING.md, 
  },
  inputStory: { 
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 16,
    paddingVertical: 16, 
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: SPACING.xl, 
    minHeight: 100, 
  },
  saveBtn: { 
    paddingVertical: 18, 
    borderRadius: 28, 
    alignItems: 'center',
  },
  saveBtnText: { 
    fontFamily: SYSTEM_FONT,
    fontSize: 16, 
    fontWeight: '800', 
    letterSpacing: 0.2, 
  },
});