/**
 * SoftBoundariesPanel — Elegant consent controls
 * * Velvet Glass & Apple Editorial updates integrated.
 * Pure native iOS surface mapping with Sexy Red (#D2121A) accents.
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Animated,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import Icon from './Icon';
import { impact, ImpactFeedbackStyle } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import { SPACING, withAlpha } from '../utils/theme';
import { SoftBoundaries } from '../services/PolishEngine';

const ALL_PROMPTS = require('../content/prompts.json').items || [];
const PROMPTS_BY_ID = ALL_PROMPTS.reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
const ALL_DATES = require('../content/dates.json').items || [];
const DATES_BY_ID = ALL_DATES.reduce((acc, d) => { acc[d.id] = d; return acc; }, {});
const ALL_CATEGORIES = [...new Set(ALL_PROMPTS.map((prompt) => prompt?.category).filter(Boolean))].sort();

export default function SoftBoundariesPanel({ onBoundaryChange }) {
  const { colors, isDark } = useTheme();
  const [boundaries, setBoundaries] = useState(null);
  const [showHiddenModal, setShowHiddenModal] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [showDatesModal, setShowDatesModal] = useState(false);

  // STRICT Midnight Intimacy x Apple Editorial Theme Map
  const t = useMemo(() => ({
    surface: isDark ? '#131016' : '#FFFFFF',
    surfaceSecondary: isDark ? '#1C1520' : '#F2F2F7',
    primary: colors.primary || '#D2121A', // Sexy Red
    text: colors.text,
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  // Entrance Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    (async () => {
      const b = await SoftBoundaries.getAll();
      setBoundaries(b);

      // Trigger native spring entrance
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 9,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();
    })();
  }, [fadeAnim, slideAnim]);

  const toggleSpicy = useCallback(async (value) => {
    impact(ImpactFeedbackStyle.Light);
    await SoftBoundaries.setHideSpicy(value);
    const updated = await SoftBoundaries.getAll();
    setBoundaries(updated);
    onBoundaryChange?.();
  }, [onBoundaryChange]);

  const unhideEntry = useCallback(async (entryId) => {
    impact(ImpactFeedbackStyle.Light);
    await SoftBoundaries.unpauseEntry(entryId);
    const updated = await SoftBoundaries.getAll();
    setBoundaries(updated);
    onBoundaryChange?.();
  }, [onBoundaryChange]);

  const unpauseDate = useCallback(async (dateId) => {
    impact(ImpactFeedbackStyle.Light);
    await SoftBoundaries.unpauseDate(dateId);
    const updated = await SoftBoundaries.getAll();
    setBoundaries(updated);
    onBoundaryChange?.();
  }, [onBoundaryChange]);

  const toggleCategory = useCallback(async (category) => {
    impact(ImpactFeedbackStyle.Light);
    if (boundaries?.hiddenCategories?.includes(category)) {
      await SoftBoundaries.unhideCategory(category);
    } else {
      await SoftBoundaries.hideCategory(category);
    }
    const updated = await SoftBoundaries.getAll();
    setBoundaries(updated);
    onBoundaryChange?.();
  }, [boundaries?.hiddenCategories, onBoundaryChange]);

  if (!boundaries) return null;

  const pausedItems = (boundaries.pausedEntries || []).map(id => ({
    id,
    text: PROMPTS_BY_ID[id]?.text || id,
    category: PROMPTS_BY_ID[id]?.category,
  }));
  const pausedDates = (boundaries.pausedDates || []).map(id => ({
    id,
    title: DATES_BY_ID[id]?.title || id,
    minutes: DATES_BY_ID[id]?.minutes || null,
  }));

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Text style={[styles.sectionLabel, { color: t.subtext }]}>
        YOUR BOUNDARIES
      </Text>

      <View style={[styles.widgetCard, { backgroundColor: t.surface, borderColor: t.border }]}>
        
        {/* Row 1: Hide Spicy */}
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconWrap, { backgroundColor: withAlpha(t.primary, 0.12) }]}>
              <Icon name="flame-outline" size={18} color={t.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: t.text }]}>
                Hide spicy prompts
              </Text>
              <Text style={[styles.rowSub, { color: t.subtext }]}>
                Only gentle and warm content
              </Text>
            </View>
          </View>
          <Switch
            value={boundaries.hideSpicy}
            onValueChange={toggleSpicy}
            trackColor={{ false: isDark ? '#38383A' : '#E9E9EA', true: t.primary }}
            thumbColor={Platform.OS === 'ios' ? undefined : '#FFFFFF'}
            ios_backgroundColor={isDark ? '#38383A' : '#E9E9EA'}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: t.border }]} />

        {/* Row 2: Hidden Entries */}
        <TouchableOpacity
          style={styles.row}
          onPress={() => { impact(ImpactFeedbackStyle.Light); setShowHiddenModal(true); }}
          activeOpacity={0.7}
        >
          <View style={styles.rowLeft}>
            <View style={[styles.iconWrap, { backgroundColor: withAlpha(t.subtext, 0.1) }]}>
              <Icon name="eye-off-outline" size={18} color={t.subtext} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: t.text }]}>
                Hidden entries
              </Text>
              <Text style={[styles.rowSub, { color: t.subtext }]}>
                {boundaries.pausedEntries.length === 0
                  ? 'None — long-press to hide'
                  : `${boundaries.pausedEntries.length} items currently paused`}
              </Text>
            </View>
          </View>
          <Icon name="chevron-forward" size={20} color={t.border} />
        </TouchableOpacity>

        {/* Hidden Entries Modal */}
        <Modal
          visible={showHiddenModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowHiddenModal(false)}
        >
          <View style={[styles.modalContainer, { backgroundColor: t.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: t.border }]}>
              <Text style={[styles.modalTitle, { color: t.text }]}>Hidden Entries</Text>
              <TouchableOpacity onPress={() => setShowHiddenModal(false)} style={styles.modalClose}>
                <Icon name="close-outline" size={24} color={t.subtext} />
              </TouchableOpacity>
            </View>

            {pausedItems.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Icon name="eye-off-outline" size={40} color={t.subtext} />
                <Text style={[styles.modalEmptyText, { color: t.subtext }]}>
                  No hidden entries yet.{`\n`}Long-press any prompt to hide it.
                </Text>
              </View>
            ) : (
              <FlatList
                data={pausedItems}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.modalList}
                renderItem={({ item }) => (
                  <View style={[styles.hiddenItemRow, { borderBottomColor: t.border }]}>
                    <View style={styles.hiddenItemText}>
                      <Text style={[styles.hiddenItemBody, { color: t.text }]} numberOfLines={3}>
                        {item.text}
                      </Text>
                      {item.category ? (
                        <Text style={[styles.hiddenItemCategory, { color: t.subtext }]}>
                          {item.category}
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={[styles.unhideBtn, { borderColor: t.primary }]}
                      onPress={() => unhideEntry(item.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.unhideBtnText, { color: t.primary }]}>Unhide</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>
        </Modal>

        <View style={[styles.divider, { backgroundColor: t.border }]} />

        <TouchableOpacity
          style={styles.row}
          onPress={() => { impact(ImpactFeedbackStyle.Light); setShowDatesModal(true); }}
          activeOpacity={0.7}
        >
          <View style={styles.rowLeft}>
            <View style={[styles.iconWrap, { backgroundColor: withAlpha(t.subtext, 0.1) }]}> 
              <Icon name="calendar-outline" size={18} color={t.subtext} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: t.text }]}>Paused date ideas</Text>
              <Text style={[styles.rowSub, { color: t.subtext }]}> 
                {boundaries.pausedDates.length === 0
                  ? 'None paused right now'
                  : `${boundaries.pausedDates.length} date ideas paused`}
              </Text>
            </View>
          </View>
          <Icon name="chevron-forward" size={20} color={t.border} />
        </TouchableOpacity>

        <Modal
          visible={showDatesModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowDatesModal(false)}
        >
          <View style={[styles.modalContainer, { backgroundColor: t.surface }]}> 
            <View style={[styles.modalHeader, { borderBottomColor: t.border }]}> 
              <Text style={[styles.modalTitle, { color: t.text }]}>Paused Dates</Text>
              <TouchableOpacity onPress={() => setShowDatesModal(false)} style={styles.modalClose}>
                <Icon name="close-outline" size={24} color={t.subtext} />
              </TouchableOpacity>
            </View>

            {pausedDates.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Icon name="calendar-outline" size={40} color={t.subtext} />
                <Text style={[styles.modalEmptyText, { color: t.subtext }]}>No paused dates yet.</Text>
              </View>
            ) : (
              <FlatList
                data={pausedDates}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.modalList}
                renderItem={({ item }) => (
                  <View style={[styles.hiddenItemRow, { borderBottomColor: t.border }]}> 
                    <View style={styles.hiddenItemText}>
                      <Text style={[styles.hiddenItemBody, { color: t.text }]} numberOfLines={2}>{item.title}</Text>
                      {item.minutes ? (
                        <Text style={[styles.hiddenItemCategory, { color: t.subtext }]}>{item.minutes} min</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={[styles.unhideBtn, { borderColor: t.primary }]}
                      onPress={() => unpauseDate(item.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.unhideBtnText, { color: t.primary }]}>Unpause</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>
        </Modal>

        <View style={[styles.divider, { backgroundColor: t.border }]} />

        {/* Row 3: Hidden Categories */}
        <TouchableOpacity style={styles.row} onPress={() => { impact(ImpactFeedbackStyle.Light); setShowCategoriesModal(true); }} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconWrap, { backgroundColor: withAlpha(t.subtext, 0.1) }]}>
              <Icon name="pricetag-outline" size={18} color={t.subtext} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: t.text }]}>
                Hidden categories
              </Text>
              <Text style={[styles.rowSub, { color: t.subtext }]}>
                {boundaries.hiddenCategories.length === 0
                  ? 'All categories visible'
                  : `${boundaries.hiddenCategories.join(', ')} hidden`}
              </Text>
            </View>
          </View>
          <Icon name="chevron-forward" size={20} color={t.border} />
        </TouchableOpacity>

        <Modal
          visible={showCategoriesModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowCategoriesModal(false)}
        >
          <View style={[styles.modalContainer, { backgroundColor: t.surface }]}> 
            <View style={[styles.modalHeader, { borderBottomColor: t.border }]}> 
              <Text style={[styles.modalTitle, { color: t.text }]}>Hidden Categories</Text>
              <TouchableOpacity onPress={() => setShowCategoriesModal(false)} style={styles.modalClose}>
                <Icon name="close-outline" size={24} color={t.subtext} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={ALL_CATEGORIES}
              keyExtractor={(item) => item}
              contentContainerStyle={styles.modalList}
              renderItem={({ item }) => {
                const hidden = boundaries.hiddenCategories.includes(item);
                return (
                  <TouchableOpacity
                    style={[styles.hiddenItemRow, { borderBottomColor: t.border }]}
                    onPress={() => toggleCategory(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.hiddenItemText}>
                      <Text style={[styles.hiddenItemBody, { color: t.text }]}>{item}</Text>
                    </View>
                    <View style={[styles.unhideBtn, { borderColor: hidden ? t.primary : t.border }]}> 
                      <Text style={[styles.unhideBtnText, { color: hidden ? t.primary : t.subtext }]}>{hidden ? 'Hidden' : 'Visible'}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </Modal>
      </View>

      <Text style={[styles.footer, { color: t.subtext }]}>
        Settings are private to your device and never shared.
      </Text>
    </Animated.View>
  );
}

const systemFont = Platform.select({ ios: "System", android: "Roboto" });

const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACING.md,
    width: '100%',
  },
  sectionLabel: {
    fontFamily: systemFont,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
    paddingLeft: SPACING.xs,
  },
  widgetCard: {
    borderRadius: 24, // Deep Apple squircle
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12 },
      android: { elevation: 2 },
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10, // Slight squircle for icons
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: systemFont,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  rowSub: {
    fontFamily: systemFont,
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 68, // Aligns after the icon wrap
  },
  footer: {
    fontFamily: systemFont,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    lineHeight: 18,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontFamily: systemFont,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  modalClose: {
    padding: SPACING.xs,
  },
  modalEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  modalEmptyText: {
    fontFamily: systemFont,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 24,
  },
  modalList: {
    padding: SPACING.lg,
    gap: 0,
  },
  hiddenItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: SPACING.md,
  },
  hiddenItemText: {
    flex: 1,
  },
  hiddenItemBody: {
    fontFamily: systemFont,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
  },
  hiddenItemCategory: {
    fontFamily: systemFont,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  unhideBtn: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  unhideBtnText: {
    fontFamily: systemFont,
    fontSize: 13,
    fontWeight: '600',
  },
});
