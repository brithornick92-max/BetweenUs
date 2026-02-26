/**
 * InsideJokes — Private Language Vault
 * 
 * Stores and surfaces the couple's private language:
 * nicknames, running jokes, comfort rituals, shared references.
 * 
 * This is an intimate scrapbook of "things only we understand."
 * No gamification. No scoring. Just a warm, personal archive.
 */

import React, { useState, useEffect, useCallback } from 'react';
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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  withSpring,
  FadeInDown,
  FadeIn,
  Easing,
  interpolate,
  SlideInRight,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { TYPOGRAPHY, BORDER_RADIUS } from '../utils/theme';
import { PrivateLanguageVault } from '../services/ConnectionEngine';

const JOKE_TYPES = [
  { key: 'nickname', label: 'Nickname', icon: 'account-heart', color: '#D4839A' },
  { key: 'joke', label: 'Inside Joke', icon: 'emoticon-wink-outline', color: '#C9A84C' },
  { key: 'ritual', label: 'Comfort Ritual', icon: 'candelabra', color: '#9A2E5E' },
  { key: 'reference', label: 'Shared Reference', icon: 'bookmark-outline', color: '#7B9EBC' },
  { key: 'phrase', label: 'Our Phrase', icon: 'format-quote-open', color: '#8B7D6B' },
];

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function InsideJokes({ compact = false }) {
  const { colors } = useTheme();
  const [jokes, setJokes] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('joke');
  const [formTitle, setFormTitle] = useState('');
  const [formStory, setFormStory] = useState('');

  // Breathing animation for empty state icon
  const breathe = useSharedValue(1);
  useEffect(() => {
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);
  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }],
    opacity: interpolate(breathe.value, [1, 1.12], [0.5, 0.8]),
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
    setSelectedType('joke');
    setModalOpen(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    loadJokes();
  };

  const handleDelete = (id) => {
    Alert.alert('Remove this memory?', 'It will be gone forever.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await PrivateLanguageVault.remove(id);
          loadJokes();
        },
      },
    ]);
  };

  const getTypeConfig = (type) => JOKE_TYPES.find(t => t.key === type) || JOKE_TYPES[1];

  // Compact mode: show 2-3 items as a teaser
  if (compact) {
    const preview = jokes.slice(0, 3);
    if (preview.length === 0) return null;

    return (
      <View style={[styles.compactContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.compactHeader}>
          <MaterialCommunityIcons name="lock-outline" size={14} color={colors.textMuted} />
          <Text style={[styles.compactTitle, { color: colors.textMuted }]}>Our Private Language</Text>
        </View>
        {preview.map((item) => {
          const config = getTypeConfig(item.type);
          return (
            <View key={item.id} style={styles.compactItem}>
              <MaterialCommunityIcons name={config.icon} size={14} color={config.color} />
              <Text style={[styles.compactItemText, { color: colors.text }]} numberOfLines={1}>
                {item.title}
              </Text>
            </View>
          );
        })}
      </View>
    );
  }

  // Full mode: scrollable vault
  const renderItem = ({ item, index }) => {
    const config = getTypeConfig(item.type);
    return (
      <AnimatedTouchable
        entering={FadeInDown.delay(index * 80).duration(400).springify().damping(18)}
        style={[styles.jokeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        activeOpacity={0.8}
        onLongPress={() => handleDelete(item.id)}
      >
        <View style={styles.jokeCardHeader}>
          <View style={[styles.jokeTypeTag, { backgroundColor: config.color + '15' }]}>
            <MaterialCommunityIcons name={config.icon} size={14} color={config.color} />
            <Text style={[styles.jokeTypeLabel, { color: config.color }]}>{config.label}</Text>
          </View>
          <Text style={[styles.jokeDate, { color: colors.textMuted }]}>
            {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
        </View>
        <Text style={[styles.jokeTitle, { color: colors.text }]}>{item.title}</Text>
        {item.story ? (
          <Text style={[styles.jokeStory, { color: colors.textMuted }]} numberOfLines={3}>
            {item.story}
          </Text>
        ) : null}
      </AnimatedTouchable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Things only we understand
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.surface2 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setModalOpen(true);
          }}
        >
          <MaterialCommunityIcons name="plus" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {jokes.length === 0 ? (
        <Animated.View entering={FadeIn.duration(800)} style={styles.emptyState}>
          <Animated.View style={breatheStyle}>
            <MaterialCommunityIcons name="book-heart-outline" size={52} color={colors.textMuted + '50'} />
          </Animated.View>
          <Animated.Text
            entering={FadeInDown.delay(200).duration(600)}
            style={[styles.emptyTitle, { color: colors.textMuted }]}
          >
            Your vault is empty
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(400).duration(600)}
            style={[styles.emptySubtitle, { color: colors.textMuted + '80' }]}
          >
            Add the nicknames, jokes, and rituals{'\n'}that belong to just the two of you.
          </Animated.Text>
        </Animated.View>
      ) : (
        <FlatList
          data={jokes}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Add New Modal */}
      <Modal visible={modalOpen} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add to Vault</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Type Selector */}
            <View style={styles.typeSelector}>
              {JOKE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.key}
                  style={[
                    styles.typeChip,
                    { borderColor: selectedType === type.key ? type.color : colors.border },
                    selectedType === type.key && { backgroundColor: type.color + '15' },
                  ]}
                  onPress={() => setSelectedType(type.key)}
                >
                  <MaterialCommunityIcons
                    name={type.icon}
                    size={16}
                    color={selectedType === type.key ? type.color : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.typeChipText,
                      { color: selectedType === type.key ? type.color : colors.textMuted },
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder={
                selectedType === 'nickname' ? 'The nickname...'
                  : selectedType === 'ritual' ? 'The ritual...'
                  : selectedType === 'phrase' ? 'The phrase...'
                  : 'The joke or reference...'
              }
              placeholderTextColor={colors.textMuted}
              value={formTitle}
              onChangeText={setFormTitle}
            />

            <TextInput
              style={[styles.storyInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="The story behind it (optional)"
              placeholderTextColor={colors.textMuted}
              value={formStory}
              onChangeText={setFormStory}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: formTitle.trim() ? colors.primary : colors.border },
              ]}
              onPress={handleSave}
              disabled={!formTitle.trim()}
            >
              <Text style={styles.saveButtonText}>Save to Vault</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    marginBottom: 24,
  },
  title: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 24,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
    fontFamily: 'Inter_400Regular',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: 24, paddingBottom: 40 },
  jokeCard: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: 20,
    marginBottom: 12,
  },
  jokeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  jokeTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  jokeTypeLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  jokeDate: {
    fontSize: 11,
  },
  jokeTitle: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 18,
    marginBottom: 6,
  },
  jokeStory: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 20,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  // Compact mode
  compactContainer: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: 16,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  compactTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  compactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  compactItemText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    flex: 1,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 32,
    paddingBottom: 48,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 22,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  input: {
    borderBottomWidth: 1,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
  },
  storyInput: {
    borderBottomWidth: 1,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginBottom: 24,
    minHeight: 60,
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
