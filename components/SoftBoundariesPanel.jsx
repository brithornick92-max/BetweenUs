/**
 * SoftBoundariesPanel — Elegant consent controls
 * 
 * "Hide spicy prompts for now"
 * "Don't resurface this entry"
 * 
 * Trust deepens when users feel in control,
 * even if they never use it.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { BORDER_RADIUS, SPACING } from '../utils/theme';
import { SoftBoundaries } from '../services/PolishEngine';

export default function SoftBoundariesPanel({ onBoundaryChange }) {
  const { colors } = useTheme();
  const [boundaries, setBoundaries] = useState(null);

  useEffect(() => {
    (async () => {
      const b = await SoftBoundaries.getAll();
      setBoundaries(b);
    })();
  }, []);

  const toggleSpicy = useCallback(async (value) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await SoftBoundaries.setHideSpicy(value);
    const updated = await SoftBoundaries.getAll();
    setBoundaries(updated);
    onBoundaryChange?.();
  }, [onBoundaryChange]);

  if (!boundaries) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
        YOUR BOUNDARIES
      </Text>
      <Text style={[styles.sectionSub, { color: colors.textMuted }]}>
        You're always in control of what appears
      </Text>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Hide Spicy */}
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <MaterialCommunityIcons name="fire" size={18} color={colors.primary} style={styles.rowIcon} />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                Hide spicy prompts for now
              </Text>
              <Text style={[styles.rowSub, { color: colors.textMuted }]}>
                Only gentle and warm content
              </Text>
            </View>
          </View>
          <Switch
            value={boundaries.hideSpicy}
            onValueChange={toggleSpicy}
            trackColor={{ false: colors.border, true: colors.primary + '60' }}
            thumbColor={boundaries.hideSpicy ? colors.primary : Platform.OS === 'android' ? '#ccc' : undefined}
            ios_backgroundColor={colors.border}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.divider }]} />

        {/* Info about paused entries */}
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <MaterialCommunityIcons name="eye-off-outline" size={18} color={colors.primary} style={styles.rowIcon} />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                Hidden entries
              </Text>
              <Text style={[styles.rowSub, { color: colors.textMuted }]}>
                {boundaries.pausedEntries.length === 0
                  ? 'None — long-press any entry to hide it'
                  : `${boundaries.pausedEntries.length} ${boundaries.pausedEntries.length === 1 ? 'entry' : 'entries'} hidden`}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.divider }]} />

        {/* Hidden categories */}
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <MaterialCommunityIcons name="tag-off-outline" size={18} color={colors.primary} style={styles.rowIcon} />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                Hidden categories
              </Text>
              <Text style={[styles.rowSub, { color: colors.textMuted }]}>
                {boundaries.hiddenCategories.length === 0
                  ? 'All categories visible'
                  : `${boundaries.hiddenCategories.join(', ')} hidden`}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <Text style={[styles.footer, { color: colors.textMuted }]}>
        These settings are private to your device and never shared.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACING.sm,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginBottom: SPACING.md,
    opacity: 0.7,
  },
  card: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md + 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rowIcon: {
    marginRight: 14,
    width: 20,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  rowSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginHorizontal: -SPACING.md,
    marginVertical: 4,
  },
  footer: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: SPACING.md,
    opacity: 0.5,
    fontStyle: 'italic',
  },
});
