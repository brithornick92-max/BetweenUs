/**
 * FoggyGlassReveal — "Foggy Glass" Reveal
 *
 * Wraps any content in a frosted-glass overlay. The user physically swipes
 * a finger across the screen to "wipe away the condensation" and reveal
 * the message, photo, or card beneath.
 *
 * Sensory layers:
 *   • BlurView at constant high intensity, fades to 0 as wipe accumulates
 *   • Soft Light haptic fires every ~35px of movement (glass-rubbing texture)
 *   • Condensation water-blobs dissolve staggered across wipe progress
 *   • A radial gleam spotlight follows the finger in real-time
 *   • Notification haptic + onReveal() fires when glass is fully cleared
 *
 * Usage:
 *   <FoggyGlassReveal label="A love note" onReveal={() => markRead()}>
 *     <LoveNoteCard ... />
 *   </FoggyGlassReveal>
 */

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  impact,
  notification,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import { withAlpha } from '../utils/theme';

const { width: W } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────
// How far the user needs to wipe (in accumulated px) to fully reveal.
// Using 90% of screen width feels natural — roughly one deliberate swipe.
const WIPE_THRESHOLD = W * 0.90;

// ─────────────────────────────────────────────────────────────
// Condensation blob definitions — pre-placed "water beads" on the glass.
// { nx, ny } = normalized position (0–1), w/h = size in px, r = border-radius
const BLOBS = [
  { nx: 0.13, ny: 0.18, w: 88,  h: 56, r: 30, fadeAt: 0.18 },
  { nx: 0.78, ny: 0.12, w: 60,  h: 40, r: 22, fadeAt: 0.28 },
  { nx: 0.48, ny: 0.32, w: 112, h: 68, r: 38, fadeAt: 0.22 },
  { nx: 0.07, ny: 0.62, w: 72,  h: 50, r: 26, fadeAt: 0.35 },
  { nx: 0.86, ny: 0.52, w: 96,  h: 60, r: 32, fadeAt: 0.42 },
  { nx: 0.32, ny: 0.78, w: 58,  h: 38, r: 20, fadeAt: 0.30 },
  { nx: 0.67, ny: 0.84, w: 80,  h: 54, r: 28, fadeAt: 0.50 },
  { nx: 0.52, ny: 0.58, w: 48,  h: 32, r: 18, fadeAt: 0.12 },
  { nx: 0.23, ny: 0.44, w: 64,  h: 44, r: 24, fadeAt: 0.38 },
];

// ─────────────────────────────────────────────────────────────
// Single condensation droplet — fades away as the wipe passes its threshold
function CondensationBlob({ blob, wipeProgress, containerW, containerH }) {
  const style = useAnimatedStyle(() => {
    // Each blob starts dissolving at its own staggered wipeProgress threshold
    const fadeStart = blob.fadeAt;
    const fadeEnd = Math.min(fadeStart + 0.30, 0.95);
    return {
      opacity: interpolate(wipeProgress.value, [fadeStart, fadeEnd], [1, 0], 'clamp'),
      transform: [
        // Droplets "slide down" slightly as they evaporate — tactile feel
        {
          translateY: interpolate(
            wipeProgress.value,
            [fadeStart, fadeEnd],
            [0, 6],
            'clamp',
          ),
        },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: blob.nx * containerW - blob.w / 2,
          top: blob.ny * containerH - blob.h / 2,
          width: blob.w,
          height: blob.h,
          borderRadius: blob.r,
          backgroundColor: 'rgba(255,255,255,0.11)',
          borderWidth: 0.5,
          borderColor: 'rgba(255,255,255,0.18)',
        },
        style,
      ]}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
export default function FoggyGlassReveal({
  children,
  label = 'Something for you',
  hint = 'Wipe to reveal',
  onReveal,
  style,
}) {
  const { colors, isDark } = useTheme();
  const [revealed, setRevealed] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: W, height: 300 });

  // ── Shared animation values ──────────────────────────────
  const wipeProgress = useSharedValue(0);      // 0 → 1
  const lastHapticAt = useSharedValue(0);      // wipeProgress at last haptic
  const isRevealedSV = useSharedValue(false);  // prevents double-fire
  const fingerX = useSharedValue(-999);        // local finger coords for gleam
  const fingerY = useSharedValue(-999);

  // ── JS-thread callbacks from worklet ────────────────────
  const handleRevealComplete = useCallback(() => {
    notification(NotificationFeedbackType.Success);
    setRevealed(true);
    onReveal?.();
  }, [onReveal]);

  const triggerHaptic = useCallback(() => {
    impact(ImpactFeedbackStyle.Light);
  }, []);

  // ── Pan gesture — accumulates wipe distance ─────────────
  const pan = Gesture.Pan()
    .minDistance(2)
    .onUpdate((e) => {
      // changeX / changeY = delta per frame (local to view, resets each gesture)
      const delta = (Math.abs(e.changeX) + Math.abs(e.changeY)) / WIPE_THRESHOLD;
      wipeProgress.value = Math.min(wipeProgress.value + delta, 1);

      // Update gleam to follow finger (local coords)
      fingerX.value = e.x;
      fingerY.value = e.y;

      // Haptic every ~3.5% wipe — simulates rubbing textured glass
      if (wipeProgress.value - lastHapticAt.value >= 0.035) {
        lastHapticAt.value = wipeProgress.value;
        runOnJS(triggerHaptic)();
      }

      // Trigger reveal once
      if (!isRevealedSV.value && wipeProgress.value >= 1) {
        isRevealedSV.value = true;
        runOnJS(handleRevealComplete)();
      }
    })
    .onEnd(() => {
      // Gleam fades off-screen after finger lifts
      fingerX.value = withTiming(-999, { duration: 700, easing: Easing.out(Easing.quad) });
      fingerY.value = withTiming(-999, { duration: 700, easing: Easing.out(Easing.quad) });
    });

  // ── Animated styles ──────────────────────────────────────

  // Fog overlay: opacity 1 → 0 (with a quick tail at the end)
  const fogStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      wipeProgress.value,
      [0, 0.75, 1],
      [1, 0.35, 0],
      'clamp',
    ),
  }));

  // Hint label fades fast on first swipe
  const hintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(wipeProgress.value, [0, 0.28], [1, 0], 'clamp'),
    transform: [
      {
        translateY: interpolate(wipeProgress.value, [0, 0.28], [0, -10], 'clamp'),
      },
    ],
  }));

  // Gleam — radial glow that follows the finger
  const gleamStyle = useAnimatedStyle(() => {
    const visible = fingerX.value > -900;
    return {
      transform: [
        { translateX: fingerX.value - 60 },
        { translateY: fingerY.value - 60 },
      ],
      opacity: visible
        ? interpolate(wipeProgress.value, [0, 0.9], [0.55, 0], 'clamp')
        : 0,
    };
  });

  const { width: cW, height: cH } = containerSize;

  return (
    <GestureDetector gesture={pan}>
      <View
        style={[styles.container, style]}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setContainerSize({ width, height });
        }}
      >
        {/* Content underneath the glass */}
        <View style={StyleSheet.absoluteFill}>{children}</View>

        {/* ── Frosted glass overlay — unmounted once fully revealed ── */}
        {!revealed && (
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.fogLayer, fogStyle]}
            pointerEvents="auto"
          >
            {/* The blur itself — constant intensity, opacity controlled by parent */}
            <BlurView
              intensity={90}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />

            {/* Condensation droplets that dissolve staggered */}
            {BLOBS.map((blob, i) => (
              <CondensationBlob
                key={i}
                blob={blob}
                wipeProgress={wipeProgress}
                containerW={cW}
                containerH={cH}
              />
            ))}

            {/* Hint label — tells user what to do before they start wiping */}
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, styles.hintLayer, hintStyle]}
            >
              <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                {hint}{'  '}›
              </Text>
            </Animated.View>
          </Animated.View>
        )}

        {/* ── Gleam — radial highlight following the finger ── */}
        {!revealed && (
          <Animated.View
            pointerEvents="none"
            style={[styles.gleam, gleamStyle]}
          />
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  fogLayer: {
    // Sits above content; unmounts once revealed so touches pass through
    zIndex: 10,
  },
  hintLayer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  hint: {
    fontSize: 13,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    textAlign: 'center',
    opacity: 0.8,
  },
  gleam: {
    // Positioned at {top:0, left:0} then transformed to finger position
    position: 'absolute',
    top: 0,
    left: 0,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.13)',
    // iOS shadow creates the radial "glow" spread
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    zIndex: 20,
  },
});
