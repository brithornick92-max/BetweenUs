/**
 * SettingsSection.jsx — Reusable card section wrapper for settings screens
 * Extracted from SettingsScreen for reuse and maintainability.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../utils/theme';

/**
 * A single settings row with icon, title, optional subtitle, and chevron.
 */
export function SettingRow({ icon, iconColor, title, subtitle, onPress, rightElement, disabled, colors, isLast }) {
  return (
    <TouchableOpacity
      style={[styles.row, disabled && { opacity: 0.4 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.6}
    >
      <View style={[styles.rowIcon, { backgroundColor: (iconColor || colors.primary) + '14' }]}>
        <MaterialCommunityIcons name={icon} size={18} color={iconColor || colors.primary} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.rowSub, { color: colors.textMuted }]} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {rightElement || (
        <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} style={{ opacity: 0.35 }} />
      )}
      {!isLast && <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />}
    </TouchableOpacity>
  );
}

/**
 * A card-wrapped section with optional label.
 */
export function SettingsSection({ title, children, colors, style }) {
  return (
    <View style={[styles.sectionWrap, style]}>
      {title ? <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{title}</Text> : null}
      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  rowSub: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.7,
  },
  rowDivider: {
    position: 'absolute',
    bottom: 0,
    left: 58,
    right: 14,
    height: StyleSheet.hairlineWidth,
  },
  sectionWrap: {
    marginBottom: SPACING.md,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
