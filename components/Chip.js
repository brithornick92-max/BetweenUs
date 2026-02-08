import React, { useEffect, useMemo, useRef } from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  Animated,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { COLORS, SPACING, BORDER_RADIUS } from "../utils/theme";

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
export default function Chip({
  label,
  value = null, // ✅ optional stable value for selection + mood mapping
  selected = false,
  onPress = null,
  icon = null,
  variant = "default", // 'default', 'mood', 'glass'
  color = null,
  size = "md",
  disabled = false,
  blurTint = "dark",
  blurIntensity = 10,
  haptic = true,
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Mood color mapping should key off value (best), fallback to label
  const moodKey = useMemo(() => {
    const raw = (value ?? label ?? "").toString();
    return raw.trim().toLowerCase();
  }, [value, label]);

  const moodColors = {
    romantic: COLORS.blushRose,
    playful: COLORS.mutedGold,
    spicy: "#FF5252",
    emotional: "#B39DDB",
    calm: "#80CBC4",
    happy: "#FFD700",
    anxious: "#9370DB",
    stressed: "#FF6347",
    loving: "#FF69B4",
    grateful: "#40E0D0",
  };

  const activeColor =
    color || (variant === "mood" ? moodColors[moodKey] || COLORS.blushRose : COLORS.blushRose);

  // Sync animation with selection state
  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: selected ? 1.05 : 1,
      useNativeDriver: true,
      friction: 7,
      tension: 100,
    }).start();
  }, [selected, scaleAnim]);

  const handlePress = async () => {
    if (!onPress || disabled) return;

    if (haptic && Platform.OS !== "web" && Haptics?.selectionAsync) {
      try {
        await Haptics.selectionAsync();
      } catch {}
    }
    onPress();
  };

  const Content = () => (
    <View style={[styles.content, styles[`size_${size}`]]}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text
        style={[
          styles.text,
          styles[`text_${size}`],
          { color: selected ? activeColor : COLORS.creamSubtle },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        disabled={disabled || !onPress}
        style={[
          styles.chip,
          { borderColor: selected ? activeColor : "rgba(255,255,255,0.15)" },
          selected && { backgroundColor: activeColor + "15" },
          disabled && styles.disabled,
        ]}
      >
        {variant === "glass" && !selected ? (
          <BlurView
            intensity={blurIntensity}
            tint={blurTint}
            style={styles.blurFill}
          >
            <Content />
          </BlurView>
        ) : (
          <Content />
        )}
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

const styles = StyleSheet.create({
  chip: {
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1.2,
    backgroundColor: "rgba(255,255,255,0.05)",
    overflow: "hidden",
  },
  blurFill: {
    width: "100%",
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

const groupStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
});
