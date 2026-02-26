/**
 * DateFilterDropdowns.jsx — Filter controls for date night card browser
 * Extracted from DateNightScreen for maintainability.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const FONTS = {
  body: Platform.select({ ios: 'Inter', android: 'Inter_400Regular', default: 'sans-serif' }),
  bodyBold: Platform.select({ ios: 'Inter-SemiBold', android: 'Inter_600SemiBold', default: 'sans-serif' }),
};

/**
 * @param {Object} props
 * @param {Object} props.dims - Dimension metadata (heat, load, style arrays)
 * @param {number|null} props.selectedHeat
 * @param {number|null} props.selectedLoad
 * @param {string|null} props.selectedStyle
 * @param {string|null} props.dropdownOpen - Currently open dropdown ('heat'|'load'|'style'|null)
 * @param {Function} props.setDropdownOpen
 * @param {Function} props.onFilterPress - (dim, value) => void
 * @param {Function} props.onClearFilters
 * @param {boolean} props.isPremium
 * @param {Function} props.showPaywall
 * @param {Object} props.colors - Theme colors
 * @param {boolean} props.isDark
 */
export default function DateFilterDropdowns({
  dims,
  selectedHeat,
  selectedLoad,
  selectedStyle,
  dropdownOpen,
  setDropdownOpen,
  onFilterPress,
  onClearFilters,
  isPremium,
  showPaywall,
  colors,
  isDark,
}) {
  const hasFilters = selectedHeat || selectedLoad || selectedStyle;
  const activeHeat = dims.heat.find(h => h.level === selectedHeat);
  const activeLoad = dims.load.find(l => l.level === selectedLoad);
  const activeStyleMeta = dims.style.find(s => s.id === selectedStyle);

  return (
    <View style={styles.filterSection}>
      <View style={styles.filterDropdowns}>
        {/* Mood dropdown */}
        <TouchableOpacity
          style={[styles.dropdownBtn, {
            borderColor: activeHeat ? activeHeat.color + '60' : colors.border,
            backgroundColor: activeHeat ? activeHeat.color + '10' : isDark ? colors.surface : '#FFFAF7',
          }]}
          onPress={() => setDropdownOpen(o => o === 'heat' ? null : 'heat')}
          activeOpacity={0.7}
        >
          <Text style={[styles.dropdownLabel, { color: colors.textMuted }]}>Mood</Text>
          <View style={styles.dropdownValue}>
            {activeHeat ? (
              <Text style={[styles.dropdownValueText, { color: activeHeat.color }]}>{activeHeat.icon} {activeHeat.label}</Text>
            ) : (
              <Text style={[styles.dropdownValueText, { color: colors.textMuted, opacity: 0.6 }]}>Choose</Text>
            )}
            <MaterialCommunityIcons name={dropdownOpen === 'heat' ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textMuted} />
          </View>
        </TouchableOpacity>

        {/* Energy dropdown */}
        <TouchableOpacity
          style={[styles.dropdownBtn, {
            borderColor: activeLoad ? activeLoad.color + '60' : colors.border,
            backgroundColor: activeLoad ? activeLoad.color + '10' : isDark ? colors.surface : '#FFFAF7',
          }]}
          onPress={() => setDropdownOpen(o => o === 'load' ? null : 'load')}
          activeOpacity={0.7}
        >
          <Text style={[styles.dropdownLabel, { color: colors.textMuted }]}>Energy</Text>
          <View style={styles.dropdownValue}>
            {activeLoad ? (
              <Text style={[styles.dropdownValueText, { color: activeLoad.color }]}>{activeLoad.icon} {activeLoad.label}</Text>
            ) : (
              <Text style={[styles.dropdownValueText, { color: colors.textMuted, opacity: 0.6 }]}>Choose</Text>
            )}
            <MaterialCommunityIcons name={dropdownOpen === 'load' ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textMuted} />
          </View>
        </TouchableOpacity>

        {/* Style dropdown */}
        <TouchableOpacity
          style={[styles.dropdownBtn, {
            borderColor: activeStyleMeta ? activeStyleMeta.color + '60' : colors.border,
            backgroundColor: activeStyleMeta ? activeStyleMeta.color + '10' : isDark ? colors.surface : '#FFFAF7',
          }]}
          onPress={() => setDropdownOpen(o => o === 'style' ? null : 'style')}
          activeOpacity={0.7}
        >
          <Text style={[styles.dropdownLabel, { color: colors.textMuted }]}>Style</Text>
          <View style={styles.dropdownValue}>
            {activeStyleMeta ? (
              <Text style={[styles.dropdownValueText, { color: activeStyleMeta.color }]}>{activeStyleMeta.icon} {activeStyleMeta.label}</Text>
            ) : (
              <Text style={[styles.dropdownValueText, { color: colors.textMuted, opacity: 0.6 }]}>Choose</Text>
            )}
            <MaterialCommunityIcons name={dropdownOpen === 'style' ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textMuted} />
          </View>
        </TouchableOpacity>
      </View>

      {hasFilters && (
        <TouchableOpacity style={styles.clearFiltersBtn} onPress={onClearFilters} activeOpacity={0.7}>
          <MaterialCommunityIcons name="close-circle-outline" size={14} color={colors.textMuted} />
          <Text style={[styles.clearFiltersTxt, { color: colors.textMuted }]}>Clear all</Text>
        </TouchableOpacity>
      )}

      {/* Dropdown option panels */}
      {dropdownOpen === 'heat' && (
        <View style={[styles.dropdownPanel, { backgroundColor: isDark ? colors.surface : '#FFFAF7', borderColor: colors.border }]}>
          {dims.heat.map((h) => {
            const active = selectedHeat === h.level;
            return (
              <TouchableOpacity
                key={h.level}
                style={[styles.dropdownOption, active && { backgroundColor: h.color + '15' }]}
                onPress={() => onFilterPress('heat', h.level)}
                activeOpacity={0.7}
              >
                <Text style={styles.dropdownOptionEmoji}>{h.icon}</Text>
                <View style={styles.dropdownOptionContent}>
                  <Text style={[styles.dropdownOptionLabel, { color: active ? h.color : colors.text }]}>{h.label}</Text>
                </View>
                {active && <MaterialCommunityIcons name="check" size={18} color={h.color} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {dropdownOpen === 'load' && (
        <View style={[styles.dropdownPanel, { backgroundColor: isDark ? colors.surface : '#FFFAF7', borderColor: colors.border }]}>
          {dims.load.map((l) => {
            const active = selectedLoad === l.level;
            return (
              <TouchableOpacity
                key={l.level}
                style={[styles.dropdownOption, active && { backgroundColor: l.color + '15' }]}
                onPress={() => onFilterPress('load', l.level)}
                activeOpacity={0.7}
              >
                <Text style={styles.dropdownOptionEmoji}>{l.icon}</Text>
                <View style={styles.dropdownOptionContent}>
                  <Text style={[styles.dropdownOptionLabel, { color: active ? l.color : colors.text }]}>{l.label}</Text>
                </View>
                {active && <MaterialCommunityIcons name="check" size={18} color={l.color} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {dropdownOpen === 'style' && (
        <View style={[styles.dropdownPanel, { backgroundColor: isDark ? colors.surface : '#FFFAF7', borderColor: colors.border }]}>
          {dims.style.map((s) => {
            const active = selectedStyle === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                style={[styles.dropdownOption, active && { backgroundColor: s.color + '15' }]}
                onPress={() => onFilterPress('style', s.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.dropdownOptionEmoji}>{s.icon}</Text>
                <View style={styles.dropdownOptionContent}>
                  <Text style={[styles.dropdownOptionLabel, { color: active ? s.color : colors.text }]}>{s.label}</Text>
                </View>
                {active && <MaterialCommunityIcons name="check" size={18} color={s.color} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filterSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterDropdowns: {
    flexDirection: 'row',
    gap: 8,
  },
  dropdownBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  dropdownLabel: {
    fontSize: 10,
    fontFamily: FONTS.body,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  dropdownValue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownValueText: {
    fontSize: 12,
    fontFamily: FONTS.bodyBold,
  },
  clearFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  clearFiltersTxt: {
    fontSize: 11,
    fontFamily: FONTS.body,
  },
  dropdownPanel: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 6,
    marginTop: 8,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    gap: 10,
  },
  dropdownOptionEmoji: {
    fontSize: 18,
  },
  dropdownOptionContent: {
    flex: 1,
  },
  dropdownOptionLabel: {
    fontSize: 14,
    fontFamily: FONTS.bodyBold,
  },
});
