import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  useDerivedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { SPACING, SANS_BOLD } from '../utils/theme';

/**
 * High-End Interactive Slider
 * Reanimated 3 + haptics + spring snap
 */
export default function Slider({
  label,
  value = 50,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  labels = null,
  trackHeight = 6,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const sliderWidth = useSharedValue(0);
  const translateX = useSharedValue(0);
  const isPressed = useSharedValue(false);

  const [displayValue, setDisplayValue] = useState(() => formatDisplay(value, labels, min, max));

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  const valueToX = (val) => {
    'worklet';
    if (sliderWidth.value <= 0) return 0;
    const pct = (val - min) / (max - min);
    return clamp(pct, 0, 1) * sliderWidth.value;
  };

  const xToSteppedValue = (x) => {
    'worklet';
    if (sliderWidth.value <= 0) return value;
    const pct = clamp(x / sliderWidth.value, 0, 1);
    const rawValue = pct * (max - min) + min;
    const stepped = Math.round(rawValue / step) * step;
    return clamp(stepped, min, max);
  };

  // Derived stepped value (UI thread)
  const steppedValue = useDerivedValue(() => xToSteppedValue(translateX.value));

  // Sync thumb position when external `value` changes
  useEffect(() => {
    // wait until layout measured
    if (sliderWidth.value <= 0) return;
    translateX.value = withSpring(valueToX(value), { damping: 15, stiffness: 140 });
    setDisplayValue(formatDisplay(value, labels, min, max));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const gesture = Gesture.Pan()
    .onBegin(() => {
      isPressed.value = true;
    })
    .onUpdate((e) => {
      const x = clamp(e.x, 0, sliderWidth.value);
      const prev = xToSteppedValue(translateX.value);

      translateX.value = x;

      const next = xToSteppedValue(x);

      if (prev !== next && Platform.OS !== 'web') {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      }

      if (onValueChange) {
        runOnJS(onValueChange)(next);
      }
      runOnJS(setDisplayValue)(formatDisplay(next, labels, min, max));
    })
    .onFinalize(() => {
      isPressed.value = false;
      const finalVal = xToSteppedValue(translateX.value);
      translateX.value = withSpring(valueToX(finalVal), { damping: 15, stiffness: 120 });
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value - 14 },
      { scale: withSpring(isPressed.value ? 1.2 : 1) },
    ],
    backgroundColor: isPressed.value ? colors.primary : colors.text,
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: translateX.value,
  }));

  return (
    <View
      style={styles.container}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: displayValue }}
    >
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.valueText}>{displayValue}</Text>
      </View>

      <GestureDetector gesture={gesture}>
        <View
          style={styles.trackWrapper}
          onLayout={(e) => {
            sliderWidth.value = e.nativeEvent.layout.width;
            translateX.value = valueToX(value);
          }}
        >
          <View style={[styles.trackBase, { height: trackHeight }]} />
          <Animated.View style={[styles.trackFill, fillStyle, { height: trackHeight }]} />
          <Animated.View style={[styles.thumb, thumbStyle]} />
        </View>
      </GestureDetector>

      {labels && (
        <View style={styles.tickContainer}>
          {labels.map((l, i) => (
            <Text key={i} style={styles.tickText}>{l}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

function formatDisplay(val, labels, min, max) {
  if (labels && labels.length > 0) {
    const pct = (val - min) / (max - min);
    const idx = Math.round(pct * (labels.length - 1));
    return labels[idx] || '';
  }
  return String(val);
}

const createStyles = (colors) => StyleSheet.create({
  container: { marginVertical: SPACING.md, width: '100%' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  label: {
    fontFamily: SANS_BOLD,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  valueText: {
    fontFamily: SANS_BOLD,
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    fontVariant: ['tabular-nums'],
  },
  trackWrapper: {
    height: 40,
    justifyContent: 'center',
    position: 'relative',
  },
  trackBase: {
    width: '100%',
    backgroundColor: colors.surface2,
    borderRadius: 10,
  },
  trackFill: {
    position: 'absolute',
    backgroundColor: colors.primary,
    borderRadius: 10,
  },
  thumb: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: colors.primary,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 5 },
      android: { elevation: 6 },
    }),
  },
  tickContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  tickText: {
    fontFamily: SANS_BOLD,
    fontSize: 11,
    fontWeight: '600',
    color: colors.text + '40',
    textTransform: 'uppercase',
  },
});
