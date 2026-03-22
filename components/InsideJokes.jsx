// components/InsideJokes.jsx — Private Language Vault
// Sexy Red Intimacy, Apple Editorial & Velvet Glass Updates Integrated.
// High-end, unabridged code for the "Things only we understand" archive.

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
} from 'react-native-reanimated';
import Icon from './Icon';
import { impact, notification, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import { SPACING, withAlpha } from '../utils/theme';
import { PrivateLanguageVault } from '../services/ConnectionEngine';

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });
const SERIF_FONT = Platform.select({ ios: "Georgia", android: "serif" });

// ─── CATEGORY COLOR MAP (Using Your Palette #1-5) ───
const getJokeTypes = (isDark) => [
  { key: 'nickname', label: 'Nickname', icon: 'heart-half-sharp', color: '#FF85C2' }, // #1 Soft Orchid
  { key: 'joke', label: 'Inside Joke', icon: 'sparkles-sharp', color: '#FF1493' },    // #2 Deep Pink
  { key: 'ritual', label: 'Comfort Ritual', icon: 'leaf-sharp', color: '#FF006E' },   // #3 Vivid Magenta
  { key: 'reference', label: 'Shared Ref', icon: 'bookmark-sharp', color: '#F00049' }, // #4 Carmine
  { key: 'phrase', label: 'Our Phrase', icon: 'chatbubbles-sharp', color: '#D2121A' }, // #5 Deep Red
];

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function InsideJokes({ compact = false }) {
  const { isDark } = useTheme();
  
  const JOKE_TYPES = useMemo(() => getJokeTypes(isDark), [isDark]);
  const [jokes, setJokes] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('joke');
  const [formTitle, setFormTitle] = useState('');
  const [formStory, setFormStory] = useState('');

  // ─── APPLE EDITORIAL THEME ───
  const t = useMemo(() => ({
    background: isDark ? '#1D1D1F' : '#F5F5F7', 
    surface: isDark ? 'rgba(44, 44, 46, 0.8)' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#1D1D1F',
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
  }), [isDark]);

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

  const loadJokes = useCallback(async () => {
    const loaded = await PrivateLanguageVault.getAll();
    setJokes(loaded);
  }, []);

  useEffect(() => { loadJokes(); }, [loadJokes]);

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

  if (compact) {
    const preview = jokes.slice(0, 2);
    if (preview.length === 0) return null;
    return (
      <View style={[styles.compactContainer, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Text style={[styles.compactHeader, { color: t.subtext }]}>PRIVATE LANGUAGE</Text>
        {preview.map((item) => (
          <View key={item.id} style={styles.compactItem}>
            <View style={[styles.dot, { backgroundColor: getTypeConfig(item.type).color }]} />
            <Text style={[styles.compactItemText, { color: t.text }]} numberOfLines={1}>{item.title}</Text>
          </View>
        ))}
      </View>
    );
  }

  const renderItem = ({ item, index }) => {
    const config = getTypeConfig(item.type);
    return (
      <AnimatedTouchable
        entering={FadeInDown.delay(index * 100).springify().damping(20)}
        style={[styles.jokeCard, { backgroundColor: t.surface, borderColor: t.border }]}
        onLongPress={() => handleDelete(item.id)}
        activeOpacity={0.9}
      >
        <View style={styles.cardTop}>
          <View style={[styles.tag, { backgroundColor: withAlpha(config.color, 0.1) }]}>
            <Icon name={config.icon} size={12} color={config.color} />
            <Text style={[styles.tagText, { color: config.color }]}>{config.label.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={[styles.jokeTitle, { color: t.text }]}>{item.title}</Text>
        {item.story ? <Text style={[styles.jokeStory, { color: t.subtext }]}>{item.story}</Text> : null}
      </AnimatedTouchable>
    );
  };

  return (
    <View style={[styles.main, { backgroundColor: t.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.editorialTitle, { color: t.text }]}>Inside Jokes</Text>
          <Text style={[styles.subtitle, { color: t.subtext }]}>The vault of us</Text>
        </View>
        <TouchableOpacity 
          style={[styles.fab, { backgroundColor: t.text }]} 
          onPress={() => { impact(ImpactFeedbackStyle.Light); setModalOpen(true); }}
        >
          <Icon name="add" size={24} color={isDark ? '#000' : '#FFF'} />
        </TouchableOpacity>
      </View>

      {jokes.length === 0 ? (
        <View style={styles.empty}>
          <Animated.View style={breatheStyle}>
            <Icon name="archive-outline" size={60} color={t.subtext} />
          </Animated.View>
          <Text style={[styles.emptyTitle, { color: t.text }]}>Your vault is quiet</Text>
          <Text style={[styles.emptySub, { color: t.subtext }]}>Add the nicknames and rituals that define your world.</Text>
        </View>
      ) : (
        <FlatList
          data={jokes}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal visible={modalOpen} animationType="slide" transparent>
        <BlurView intensity={isDark ? 40 : 80} tint={isDark ? "dark" : "light"} style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
            <View style={[styles.sheet, { backgroundColor: t.surface }]}>
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: t.text }]}>Add to Vault</Text>
                <TouchableOpacity onPress={() => setModalOpen(false)}>
                  <Icon name="close-circle-sharp" size={28} color={t.subtext} />
                </TouchableOpacity>
              </View>

              <View style={styles.typeGrid}>
                {JOKE_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.key}
                    style={[
                      styles.typeChip,
                      { borderColor: selectedType === type.key ? type.color : t.border },
                      selectedType === type.key && { backgroundColor: withAlpha(type.color, 0.1) }
                    ]}
                    onPress={() => { selection(); setSelectedType(type.key); }}
                  >
                    <Icon name={type.icon} size={16} color={selectedType === type.key ? type.color : t.subtext} />
                    <Text style={[styles.typeText, { color: selectedType === type.key ? type.color : t.subtext }]}>{type.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[styles.input, { color: t.text, borderBottomColor: t.border }]}
                placeholder="The secret phrase or name..."
                placeholderTextColor={t.subtext}
                value={formTitle}
                onChangeText={setFormTitle}
              />

              <TextInput
                style={[styles.inputStory, { color: t.text, borderBottomColor: t.border }]}
                placeholder="The story behind it..."
                placeholderTextColor={t.subtext}
                value={formStory}
                onChangeText={setFormStory}
                multiline
              />

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: formTitle.trim() ? '#D2121A' : t.border }]}
                onPress={handleSave}
                disabled={!formTitle.trim()}
              >
                <Text style={styles.saveBtnText}>Secure in Vault</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </BlurView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    marginBottom: 30,
  },
  editorialTitle: {
    fontFamily: SERIF_FONT,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
  },
  subtitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: '500',
    opacity: 0.7,
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: 20, paddingBottom: 100 },
  jokeCard: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 },
      android: { elevation: 2 },
    }),
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  jokeTitle: {
    fontFamily: SERIF_FONT,
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  jokeStory: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.8,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontFamily: SERIF_FONT, fontSize: 24, fontWeight: '600', marginTop: 20 },
  emptySub: { textAlign: 'center', marginTop: 10, lineHeight: 22 },
  compactContainer: { padding: 16, borderRadius: 20, borderWidth: 1 },
  compactHeader: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 10 },
  compactItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  compactItemText: { fontSize: 14, fontWeight: '500' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { width: '100%' },
  sheet: { borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 30, paddingBottom: 50 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  sheetTitle: { fontFamily: SERIF_FONT, fontSize: 24, fontWeight: '700' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 30 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 100, borderWidth: 1 },
  typeText: { fontSize: 13, fontWeight: '600' },
  input: { fontSize: 20, fontFamily: SERIF_FONT, paddingVertical: 15, borderBottomWidth: 1, marginBottom: 15 },
  inputStory: { fontSize: 16, paddingVertical: 15, borderBottomWidth: 1, marginBottom: 30, minHeight: 80 },
  saveBtn: { paddingVertical: 18, borderRadius: 20, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
});
