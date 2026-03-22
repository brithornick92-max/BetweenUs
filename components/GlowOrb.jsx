// components/GlowOrb.jsx — Slow-breathing ambient editorial glow
// Sexy Red Intimacy & Apple Editorial Updates Integrated.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

/**
 * GlowOrb
 * Creates an immersive "Velvet Glass" depth effect.
 * Best used behind content with low opacity for an intimate atmosphere.
 */
const GlowOrb = ({ 
  color, 
  size = 300, 
  top, 
  left, 
  delay = 0, 
  opacity = 0.15 
}) => {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Apple-style sophisticated breathing animation
    Animated.loop(
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
    ).start();
  }, [delay, pulse]);

  const animatedStyle = {
    opacity: pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [opacity * 0.5, opacity], // High-end subtle range
    }),
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.2], // Gentle expansion
        }),
      },
    ],
  };

  return (
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
  );
};

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
    // Blurred state is often handled by the style prop color + opacity
    // but can be enhanced by an external blur wrapper if needed.
    zIndex: -1,
  },
});

export default GlowOrb;
