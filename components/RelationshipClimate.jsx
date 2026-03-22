// components/RelationshipClimate.jsx — "We're in the mood for…" picker
// No scores. No tracking. No trends. Just a vibe.

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import { SPACING } from '../utils/theme';
import { RelationshipClimateState, CLIMATE_OPTIONS } from '../services/ConnectionEngine';

// Note: MaterialCommunityIcons does not support setNativeProps, so we cannot use
// Animated.createAnimatedComponent with it. Use crossfade instead.

// ------------------------------------------------------------------
// INLINE COMPONENT: Animated Climate Card
// ------------------------------------------------------------------
const ClimateOption = ({ option, isSelected, onPress, t, isDark, styleOverrides }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

  // Active color resolution (uses the colors defined in ConnectionEngine)
  const activeColor = isDark ? (option.colorDark || option.color) : (option.colorLight || option.color);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: isSelected ? 1 : 0,
        duration: 200,
        useNativeDriver: false, // Required for color interpolation
      }),
      Animated.spring(scaleAnim, {
        toValue: isSelected ? 0.96 : 1,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      })
    ]).start();
  }, [isSelected, fadeAnim, scaleAnim]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: isSelected ? 0.96 : 1,
      friction: 8,
      tension: 60,
      useNativeDriver: true,
    }).start();
  };

  // Pure Apple Editorial Color Interpolations
  const backgroundColor = fadeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [t.surface, activeColor] 
  });

  const iconCircleBg = fadeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [t.surfaceSecondary, 'rgba(255,255,255,0.25)']
  });

  const textColor = fadeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [t.text, '#FFFFFF']
  });

  const borderColor = isSelected ? 'transparent' : t.border;

  return (
    <Animated.View style={[styleOverrides, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => onPress(option.id)}
        style={styles.touchableArea}
      >
        <Animated.View 
          style={[
            styles.optionCard, 
            { backgroundColor, borderColor },
            isSelected && {
              shadowColor: activeColor,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4,
              shadowRadius: 12,
              elevation: 6,
            }
          ]}
        >
          <Animated.View style={[styles.iconCircle, { backgroundColor: iconCircleBg }]}>
            {/* Crossfade between two static icons to avoid setNativeProps crash */}
            <View style={{ width: 24, height: 24 }}>
              <MaterialCommunityIcons
                name={option.icon}
                size={24}
                color={activeColor}
                style={{ position: 'absolute' }}
              />
              <Animated.View style={{ opacity: fadeAnim }}>
                <MaterialCommunityIcons
                  name={option.icon}
                  size={24}
                  color="#FFFFFF"
                />
              </Animated.View>
            </View>
          </Animated.View>
          <Animated.Text style={[styles.optionLabel, { color: textColor }]}>
            {option.label}
          </Animated.Text>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ------------------------------------------------------------------
// MAIN COMPONENT
// ------------------------------------------------------------------
export default function RelationshipClimate({ onClimateChange, compact = false }) {
  const { colors, isDark } = useTheme();
  const [selected, setSelected] = useState(null);

  // STRICT Apple Editorial Theme Map
  const t = useMemo(() => ({
    background: isDark ? '#000000' : '#F2F2F7', 
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    surfaceSecondary: isDark ? '#2C2C2E' : '#E5E5EA',
    primary: colors.primary,
    text: isDark ? '#FFFFFF' : '#000000',
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  useEffect(() => {
    RelationshipClimateState.get().then(data => {
      if (data?.id) setSelected(data.id);
    });
  }, []);

  const handleSelect = useCallback(async (climateId) => {
    selection();
    setSelected(climateId);
    await RelationshipClimateState.set(climateId);
    onClimateChange?.(climateId);
  }, [onClimateChange]);

  if (compact && selected) {
    const current = CLIMATE_OPTIONS.find(c => c.id === selected);
    if (!current) return null;
    const compactColor = isDark ? (current.colorDark || current.color) : (current.colorLight || current.color);
    
    return (
      <TouchableOpacity
        style={[styles.compactContainer, { backgroundColor: t.surfaceSecondary, borderColor: t.border }]}
        onPress={() => {
          impact(ImpactFeedbackStyle.Light);
          setSelected(null);
        }}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name={current.icon} size={18} color={compactColor} />
        <Text style={[styles.compactLabel, { color: t.text }]}>
          In the mood for <Text style={{ color: compactColor, fontWeight: '700' }}>{current.label.toLowerCase()}</Text>
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: t.text }]}>
        Climate
      </Text>
      <Text style={[styles.sectionSubtitle, { color: t.subtext }]}>
        What are we in the mood for tonight?
      </Text>

      {/* Mode Toggles (Top 2) */}
      <View style={styles.togglesRow}>
        {CLIMATE_OPTIONS.slice(0, 2).map((option) => (
          <ClimateOption
            key={option.id}
            option={option}
            isSelected={selected === option.id}
            onPress={handleSelect}
            t={t}
            isDark={isDark}
            styleOverrides={{ flex: 1 }}
          />
        ))}
      </View>

      {/* Grid Options (Bottom 4) */}
      <View style={styles.optionsGrid}>
        {CLIMATE_OPTIONS.slice(2).map((option) => (
          <ClimateOption
            key={option.id}
            option={option}
            isSelected={selected === option.id}
            onPress={handleSelect}
            t={t}
            isDark={isDark}
            styleOverrides={{ width: '48%' }}
          />
        ))}
      </View>
    </View>
  );
}

// ------------------------------------------------------------------
// STYLES - Apple Editorial Squircle
// ------------------------------------------------------------------
const systemFont = Platform.select({ ios: "System", android: "Roboto" });

const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl, // Match screen padding for flush layout
    width: '100%',
  },
  sectionTitle: {
    fontFamily: systemFont,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontFamily: systemFont,
    fontSize: 15,
    fontWeight: '500',
    marginBottom: SPACING.lg,
  },
  
  // ── Grid Layouts ──
  togglesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },

  // ── Card Styles ──
  touchableArea: {
    width: '100%',
  },
  optionCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    borderRadius: 24, // Deep iOS squircle
    borderWidth: 1,
    gap: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
      android: { elevation: 1 },
    }),
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontFamily: systemFont,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.2,
  },

  // ── Compact Mode (Pill) ──
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm + 4,
    paddingHorizontal: SPACING.lg,
    borderRadius: 999, // Perfect pill
    borderWidth: 1,
    gap: 8,
    alignSelf: 'center',
    marginTop: SPACING.sm,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  compactLabel: {
    fontFamily: systemFont,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
