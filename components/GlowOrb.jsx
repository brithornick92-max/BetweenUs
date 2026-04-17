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
  const pulse = useRef(new Animated.Value(0)).current;
  // Crossfade between base color orb (opacity 1) and together orb (opacity 0→1)
  const togetherAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Apple-style sophisticated breathing animation
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 5000 + delay,
          easing: Easing.bezier(0.4, 0, 0.2, 1), // Native iOS-like easing
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 5000 + delay,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, pulse]);

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
    opacity: pulse.interpolate({
      inputRange: [0, 1],
      // When together, the base orb breathes a bit brighter
      outputRange: [opacity * 0.5, togetherNow ? opacity * 1.4 : opacity],
    }),
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          // Together: orb expands more (1.35 vs 1.2)
          outputRange: [1, togetherNow ? 1.35 : 1.2],
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
        scale: pulse.interpolate({
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
