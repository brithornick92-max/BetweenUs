import React, { useEffect, useMemo, useRef } from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  Animated,
  Platform,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import { SPACING, BORDER_RADIUS } from "../utils/theme";

/**
 * Optional dependency: expo-haptics (safe import)
 */
let Haptics = null;
try {
  // eslint-disable-next-line global-require
  Haptics = require("expo-haptics");
} catch (e) {
  Haptics = null;
}

/**
 * High-End Interactive Chip
 * Features: Spring-based scaling, optional haptics, mood coloring, and glass variant.
 */

const createStyles = (colors) => StyleSheet.create({
  chip: {
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { marginRight: 6 },

  // Sizes
  size_sm: { paddingVertical: 6, paddingHorizontal: 12 },
  size_md: { paddingVertical: 8, paddingHorizontal: 16 },
  size_lg: { paddingVertical: 10, paddingHorizontal: 20 },

  // Text
  text: { fontWeight: "600", letterSpacing: 0.3 },
  text_sm: { fontSize: 12 },
  text_md: { fontSize: 14 },
  text_lg: { fontSize: 16 },

  disabled: { opacity: 0.3 },
});

export default function Chip({
  label,
  value = null,
  selected = false,
  onPress = null,
  icon = null,
  variant = "default",
  color = null,
  size = "md",
  disabled = false,
  haptic = true,
}) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Mood color mapping should key off value (best), fallback to label
  const moodKey = useMemo(() => {
    const raw = (value ?? label ?? "").toString();
    return raw.trim().toLowerCase();
  }, [value, label]);

  const moodColorsDark = {
    comfort: '#162218', connection: '#1E1228', flirtation: '#261018',
    intimacy: '#200C0C', passion: '#1A0808',
    calm: '#121E14', balanced: '#1E160A', energizing: '#1E0E06',
    talking: '#0E1A24', doing: '#14101E', mixed: '#1E0C16',
    sweet: '#162218', flirty: '#1E1228', intimate: '#261018',
    steamy: '#200C0C', scorching: '#1A0808',
    spicy: '#200808', romantic: '#1E0810', heartfelt: '#0C1420',
    adventurous: '#0C1A0E', cozy: '#121E14', playful: '#1E1808',
    tranquil: '#081A16', connected: '#1E1808',
    reflective: colors.textMuted, energized: colors.primary,
    emotional: colors.textMuted, happy: colors.primary,
    anxious: colors.textMuted, stressed: colors.textMuted,
    loving: colors.primary, grateful: colors.primary,
  };

  const moodColorsLight = {
    // Heat levels (Closeness)
    comfort: '#5A8A5C',
    connection: '#8B5A9E',
    flirtation: '#B85A78',
    intimacy: '#A84848',
    passion: '#8C1E1E',
    // Load levels (Energy)
    calm: '#4D7A50',
    balanced: '#B8863A',
    energizing: '#C05228',
    // Interaction style
    talking: '#4A82B0',
    doing: '#6B4E96',
    mixed: '#A84468',
    // Heat tiers (legacy labels)
    sweet: '#5A8A5C',
    flirty: '#8B5A9E',
    intimate: '#B85A78',
    steamy: '#A84848',
    scorching: '#8C1E1E',
    // Legacy / general mood colors (for prompts or other features)
    spicy: '#A83232',
    romantic: '#8B2248',
    heartfelt: '#3A6A9E',
    adventurous: '#2E6E30',
    cozy: '#5A7A56',
    playful: '#B8961E',
    tranquil: '#1A6E62',
    connected: '#B8961E',
    reflective: colors.textMuted,
    energized: colors.primary,
    emotional: colors.textMuted,
    happy: colors.primary,
    anxious: colors.textMuted,
    stressed: colors.textMuted,
    loving: colors.primary,
    grateful: colors.primary,
  };

  const moodColors = isDark ? moodColorsDark : moodColorsLight;

  const activeColor =
    color || (variant === "mood" ? moodColors[moodKey] || colors.primary : colors.primary);

  // Sync animation with selection state
  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: selected ? 1.05 : 1,
      useNativeDriver: true,
      damping: 14,
      stiffness: 150,
      mass: 1,
    }).start();
  }, [selected, scaleAnim]);

  const handlePress = async () => {
    if (!onPress || disabled) return;

    if (haptic && Platform.OS !== "web" && Haptics?.selectionAsync) {
      try {
        await Haptics.selectionAsync();
      } catch (e) { /* haptics non-critical */ }
    }
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        disabled={disabled || !onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected, disabled }}
        style={[
          styles.chip,
          { borderColor: selected ? activeColor : colors.border },
          selected && { backgroundColor: activeColor + "15" },
          disabled && styles.disabled,
        ]}
      >
        <View style={[styles.content, styles[`size_${size}`]]}>
          {icon && <View style={styles.icon}>{icon}</View>}
          <Text
            style={[
              styles.text,
              styles[`text_${size}`],
              { color: selected ? activeColor : colors.textMuted },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * ChipGroup
 * ✅ Supports items as strings OR objects:
 * - "Romantic"
 * - { value: "romantic", label: "Romantic" }
 *
 * selectedItems should be an array of values (strings).
 */
export function ChipGroup({
  items = [],
  selectedItems = [],
  onSelectionChange,
  variant = "default",
  size = "md",
  multiSelect = true,
  disabled = false,
}) {
  const normalized = useMemo(() => {
    return (items || []).map((it) => {
      if (typeof it === "string") return { value: it, label: it };
      return {
        value: it?.value ?? it?.id ?? it?.label,
        label: it?.label ?? String(it?.value ?? it?.id ?? ""),
      };
    });
  }, [items]);

  const toggle = (val) => {
    if (disabled) return;

    let next;
    if (multiSelect) {
      next = selectedItems.includes(val)
        ? selectedItems.filter((x) => x !== val)
        : [...selectedItems, val];
    } else {
      next = selectedItems.includes(val) ? [] : [val];
    }
    onSelectionChange?.(next);
  };

  return (
    <View style={groupStyles.container}>
      {normalized.map((item) => (
        <Chip
          key={String(item.value)}
          value={item.value}
          label={item.label}
          selected={selectedItems.includes(item.value)}
          onPress={() => toggle(item.value)}
          variant={variant}
          size={size}
          disabled={disabled}
        />
      ))}
    </View>
  );
}

const groupStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
});
