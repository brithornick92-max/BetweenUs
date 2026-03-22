// components/InvisibleInkMessage.jsx
// Tilt your phone ~45° backward to reveal hidden text.
// Shoulder-surfing is physically impossible — the message vanishes the moment you straighten up.

import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Platform, Animated } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import { impact, ImpactFeedbackStyle } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';

// ─── Tilt thresholds (Accelerometer z-axis) ────────────────────────────────
// When phone is held upright in portrait: z ≈ 0 (gravity is in the -y direction)
// When tilting backward (screen starts to face ceiling): z becomes negative
// At 45° tilt: z ≈ -cos(45°) ≈ -0.7
const REVEAL_START = -0.15; // begin fading ink (~9° past vertical)
const REVEAL_FULL  = -0.62; // fully revealed (~38° past vertical — the magic window)

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

/**
 * InvisibleInkMessage
 *
 * @param {string}  text    — The secret text to reveal
 * @param {object}  style   — Optional container style override
 */
export default function InvisibleInkMessage({ text, style }) {
  const { isDark } = useTheme();

  const inkOpacity  = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const scanlineAnim = useRef(new Animated.Value(-1)).current;
  const hasRevealedRef = useRef(false);
  const subRef = useRef(null);

  // ─── Shimmer breath loop (runs always, visible through the ink panel) ──
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  // ─── Scanline sweep loop ───────────────────────────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanlineAnim, { toValue: 1, duration: 3200, useNativeDriver: true }),
        Animated.timing(scanlineAnim, { toValue: -1, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scanlineAnim]);

  // ─── Accelerometer tilt listener ──────────────────────────────────────
  useEffect(() => {
    Accelerometer.setUpdateInterval(50); // ~20Hz — light on battery

    subRef.current = Accelerometer.addListener(({ z }) => {
      // Map z from REVEAL_START→REVEAL_FULL to progress 0→1
      const progress = clamp(
        (z - REVEAL_START) / (REVEAL_FULL - REVEAL_START),
        0,
        1
      );

      // Ink fades away, glow rises
      inkOpacity.setValue(1 - progress);
      glowOpacity.setValue(progress * 0.35);

      // One satisfying heavy thud when fully revealed for the first time
      if (progress >= 1 && !hasRevealedRef.current) {
        hasRevealedRef.current = true;
        impact(ImpactFeedbackStyle.Heavy).catch(() => {});
      } else if (progress < 0.8) {
        hasRevealedRef.current = false;
      }
    });

    return () => {
      subRef.current?.remove();
    };
  }, [inkOpacity, glowOpacity]);

  const t = useMemo(() => ({
    text:     '#FFFFFF',
    inkPanel: isDark ? '#030002' : '#050003',
    shimmer:  '#D2121A',
    hint:     'rgba(255,255,255,0.32)',
    glow:     'rgba(195,17,61,0.18)',
  }), [isDark]);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0.0, 0.22],
  });

  const scanlineY = scanlineAnim.interpolate({
    inputRange:  [-1, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.wrapper, style]}>

      {/* ── Layer 1: The actual message text ── */}
      <Text style={styles.text}>{text}</Text>

      {/* ── Layer 2: Crimson glow halo that bleeds through on reveal ── */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.glowLayer, { backgroundColor: t.glow, opacity: glowOpacity }]}
      />

      {/* ── Layer 3: The ink panel — fades away as phone tilts ── */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.inkPanel, { backgroundColor: t.inkPanel, opacity: inkOpacity }]}
      >
        {/* Prismatic shimmer pulse */}
        <Animated.View
          style={[styles.shimmerBar, { backgroundColor: t.shimmer, opacity: shimmerOpacity }]}
        />

        {/* Moving scanline */}
        <Animated.View
          style={[styles.scanline, { backgroundColor: t.shimmer, top: scanlineY }]}
        />

        {/* Reveal hint */}
        <View style={styles.hintPill}>
          <Text style={[styles.hintText, { color: t.hint }]}>
            TILT TO REVEAL
          </Text>
        </View>
      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 80,
  },
  text: {
    fontSize: 19,
    lineHeight: 30,
    color: '#FFFFFF',
    fontFamily: Platform.select({
      ios:     'DMSerifDisplay-Regular',
      android: 'DMSerifDisplay_400Regular',
    }),
    paddingVertical: 20,
    paddingHorizontal: 8,
  },
  glowLayer: {
    borderRadius: 16,
  },
  inkPanel: {
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    overflow: 'hidden',
  },
  shimmerBar: {
    width: '45%',
    height: 1.5,
    borderRadius: 1,
  },
  scanline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.06,
  },
  hintPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  hintText: {
    fontSize: 10,
    letterSpacing: 3.5,
    fontFamily: 'Lato_700Bold',
  },
});
