// components/RelationshipClimate.jsx — "We're in the mood for…" picker
// No scores. No tracking. No trends. Just a vibe.
// Sexy Red Intimacy & Apple Editorial Updates Integrated.

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import Icon from './Icon';
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import { SPACING, withAlpha } from '../utils/theme';
import { RelationshipClimateState, CLIMATE_OPTIONS } from '../services/ConnectionEngine';
import StorageRouter from '../services/storage/StorageRouter';

// ------------------------------------------------------------------
// INLINE COMPONENT: Animated Climate Card
// ------------------------------------------------------------------
const ClimateOption = ({ option, isSelected, onPress, t, isDark, styleOverrides }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

  // Active color resolution (uses Sexy Red for romantic options or native iOS palettes)
  const activeColor = useMemo(() => {
    if (option.id === 'romance' || option.id === 'intimacy') return t.primary;
    return isDark ? (option.colorDark || option.color) : (option.colorLight || option.color);
  }, [option, isDark, t.primary]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: isSelected ? 1 : 0,
        duration: 240,
        useNativeDriver: false, // Color interpolation
      }),
      Animated.spring(scaleAnim, {
        toValue: isSelected ? 0.96 : 1,
        friction: 9,
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
      friction: 9,
      tension: 60,
      useNativeDriver: true,
    }).start();
  };

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
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.4,
              shadowRadius: 16,
              elevation: 6,
            }
          ]}
        >
          <Animated.View style={[styles.iconCircle, { backgroundColor: iconCircleBg }]}>
            <View style={{ width: 24, height: 24 }}>
              <Icon
                name={option.icon}
                size={24}
                color={activeColor}
                style={{ position: 'absolute' }}
              />
              <Animated.View style={{ opacity: fadeAnim }}>
                <Icon
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
function RelationshipClimate({ onClimateChange, compact = false }) {
  const { colors, isDark } = useTheme();
  const [selected, setSelected] = useState(null);

  // Midnight Intimacy x Apple Editorial Theme Map
  const t = useMemo(() => ({
    background: colors.background, 
    surface: isDark ? '#131016' : '#FFFFFF',
    surfaceSecondary: isDark ? '#1C1520' : '#F2F2F7',
    primary: colors.primary || '#D2121A', // SEXY RED
    text: colors.text,
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  useEffect(() => {
    let active = true;
    RelationshipClimateState.get()
      .then(data => {
        if (active && data?.id) setSelected(data.id);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleSelect = useCallback(async (climateId) => {
    selection();
    setSelected(climateId);
    await RelationshipClimateState.set(climateId);
    StorageRouter.updateCloudProfilePreferences({
      relationshipClimate: { id: climateId, updatedAt: Date.now() },
    }).catch(() => {});
    onClimateChange?.(climateId);
  }, [onClimateChange]);

  if (compact && selected) {
    const current = CLIMATE_OPTIONS.find(c => c.id === selected);
    if (!current) return null;
    const compactColor = (current.id === 'romance' || current.id === 'intimacy') 
      ? t.primary 
      : (isDark ? (current.colorDark || current.color) : (current.colorLight || current.color));
    
    return (
      <TouchableOpacity
        style={[styles.compactContainer, { backgroundColor: t.surfaceSecondary, borderColor: t.border }]}
        onPress={() => {
          impact(ImpactFeedbackStyle.Light);
          setSelected(null);
        }}
        activeOpacity={0.8}
      >
        <Icon name={current.icon} size={18} color={compactColor} />
        <Text style={[styles.compactLabel, { color: t.text }]}>
          In the mood for <Text style={{ color: compactColor, fontWeight: '800' }}>{current.label.toLowerCase()}</Text>
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
    paddingHorizontal: 4,
    width: '100%',
  },
  sectionTitle: {
    fontFamily: systemFont,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontFamily: systemFont,
    fontSize: 15,
    fontWeight: '500',
    marginBottom: SPACING.lg,
  },
  
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

  touchableArea: {
    width: '100%',
  },
  optionCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.md,
    borderRadius: 24, // Deep Apple squircle
    borderWidth: 1,
    gap: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 },
      android: { elevation: 2 },
    }),
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontFamily: systemFont,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
  },

  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999, // Pill shape
    borderWidth: 1,
    gap: 10,
    alignSelf: 'center',
    marginTop: SPACING.sm,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  compactLabel: {
    fontFamily: systemFont,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});

export default React.memo(RelationshipClimate);
