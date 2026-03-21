// components/GlowOrb.jsx — Slow-breathing ambient plum glow
import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

const GlowOrb = ({ color, size = 200, top, left, delay = 0 }) => {
  const pulse = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.5, duration: 4000 + delay, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.25, duration: 4000 + delay, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', top, left,
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color, opacity: pulse,
      }}
    />
  );
};

export default GlowOrb;
