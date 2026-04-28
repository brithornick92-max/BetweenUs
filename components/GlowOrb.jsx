// components/GlowOrb.jsx — Slow-breathing ambient editorial glow
// Sexy Red Intimacy & Apple Editorial Updates Integrated.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

/**
 * GlowOrb
 * Creates an immersive "Velvet Glass" depth effect.
 * Best used behind content with low opacity for an intimate atmosphere.
 *
 * Extra props:
 *   togetherNow  {boolean} — when true, the orb blooms deeper and shifts to
 *                            togetherColor, signalling both partners are present.
 *   togetherColor {string} — defaults to deep Sexy Red '#8B0020'
 */
const GlowOrb = ({
  color,
  size = 300,
  top,
  left,
  delay = 0,
  opacity = 0.15,
  togetherNow = false,
  togetherColor = '#8B0020',
}) => {
  // Crossfade between base color orb (opacity 1) and together orb (opacity 0→1)
  const togetherAnim = useRef(new Animated.Value(0)).current;

  // ── Together bloom — fades in the deeper-red orb over 1.4s ───────────────
  useEffect(() => {
    Animated.timing(togetherAnim, {
      toValue: togetherNow ? 1 : 0,
      duration: 1400,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [togetherNow, togetherAnim]);

  const animatedStyle = {
    opacity: togetherAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [opacity, opacity * 1.4],
    }),
    transform: [
      {
        scale: togetherAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1.2, 1.35],
        }),
      },
    ],
  };

  const togetherOrbStyle = {
    opacity: togetherAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, opacity * 1.6],
    }),
    transform: [
      {
        scale: togetherAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1.1, 1.45],
        }),
      },
    ],
  };

  return (
    <>
      {/* Base color orb — always present */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.orb,
          {
            top,
            left,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
          animatedStyle,
        ]}
      />
      {/* Together bloom — crossfades in on top when both partners are present */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.orb,
          {
            top,
            left,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: togetherColor,
          },
          togetherOrbStyle,
        ]}
      />
    </>
  );
};

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
  },
});

export default React.memo(GlowOrb);
