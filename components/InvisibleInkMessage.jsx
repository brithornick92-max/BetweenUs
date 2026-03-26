// components/InvisibleInkMessage.jsx
// Hidden at normal viewing angle — tilt screen toward ceiling to reveal.
// Text materializes from blank paper like heat-activated invisible ink, 
// using fluid spring physics, Velvet Glass blurring, and a center-outward radial mask.

import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Platform, AppState } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import { BlurView } from 'expo-blur';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withRepeat, 
  withSequence, 
  withTiming,
  interpolate,
  Extrapolation
} from 'react-native-reanimated';
import { impact, ImpactFeedbackStyle } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';

// ─── Tilt thresholds (Accelerometer z-axis) ────────────────────────────────
// Phone held at a normal reading angle: z ≈ -0.5 to -0.77
// Screen facing ceiling (flat on back): z ≈ -1.0
const REVEAL_START = -0.80; 
const REVEAL_FULL  = -0.96; 

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

export default function InvisibleInkMessage({ text, style, textColor, panelColor, accentColor }) {
  const { isDark } = useTheme();

  // Reanimated Shared Values for 60fps UI-thread performance
  const rawProgress = useSharedValue(0);
  const fluidProgress = useSharedValue(0);
  const breathAnim = useSharedValue(0.5);
  
  const hasRevealedRef = useRef(false);
  const subRef = useRef(null);
  const appState = useRef(AppState.currentState);

  // ─── Theme & Colors ───────────────────────────────────────────────────
  const t = useMemo(() => ({
    ink:  textColor || (isDark ? '#FFFFFF' : '#2C2C2E'),
    heat: accentColor || '#C47A20',           
    hint: panelColor ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.22)',
    glassTint: isDark ? 'dark' : 'light',
  }), [isDark, textColor, panelColor, accentColor]);

  // ─── Gentle breath loop ───────────────────────────────────────────────
  useEffect(() => {
    breathAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3000 }),
        withTiming(0.5, { duration: 3000 })
      ),
      -1,
      true
    );
  }, []);

  // ─── Accelerometer tilt listener with Spring Smoothing ────────────────
  useEffect(() => {
    Accelerometer.setUpdateInterval(40); // 25Hz - optimal balance of responsiveness and battery

    const subscribe = () => {
      subRef.current = Accelerometer.addListener(({ z }) => {
        const progress = clamp(
          (z - REVEAL_START) / (REVEAL_FULL - REVEAL_START),
          0,
          1
        );

        rawProgress.value = progress;
        
        // Apply a luxurious spring to smooth out hand jitters
        fluidProgress.value = withSpring(progress, {
          damping: 20,
          stiffness: 90,
          mass: 0.8,
        });

        // Haptic triggers
        if (progress >= 0.95 && !hasRevealedRef.current) {
          hasRevealedRef.current = true;
          impact(ImpactFeedbackStyle.Heavy).catch(() => {});
        } else if (progress < 0.7) {
          if (hasRevealedRef.current) {
            // Subtle tick when it hides again
            impact(ImpactFeedbackStyle.Light).catch(() => {});
          }
          hasRevealedRef.current = false;
        }
      });
    };

    const unsubscribe = () => {
      subRef.current?.remove();
      subRef.current = null;
    };

    // Start listening
    subscribe();

    // Pause accelerometer if app goes to background to save battery
    const appStateSubscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/active/) && nextAppState.match(/inactive|background/)) {
        unsubscribe();
      } else if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        subscribe();
      }
      appState.current = nextAppState;
    });

    return () => {
      unsubscribe();
      appStateSubscription.remove();
    };
  }, []);

  // ─── Animated Styles (Apple Editorial Rendering) ──────────────────────
  
  // The clip circle expands from center outward as a circular overflow:hidden container
  const maskAnimatedStyle = useAnimatedStyle(() => {
    // Diameter: starts at 0 and grows to cover the entire wrapper (1000px is generous)
    const size = interpolate(fluidProgress.value, [0.1, 0.95], [0, 1000], Extrapolation.CLAMP);
    const opacity = interpolate(fluidProgress.value, [0.05, 0.2], [0, 1], Extrapolation.CLAMP);
    
    return {
      opacity,
      width: size,
      height: size,
      borderRadius: size / 2,
    };
  });

  // Text layers focus in, scale down slightly, and bleed the heat color
  const textAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(fluidProgress.value, [0.2, 0.8, 1], [0, 0.9, 1], Extrapolation.CLAMP);
    const scale = interpolate(fluidProgress.value, [0, 1], [1.05, 1], Extrapolation.CLAMP);
    // Glow starts huge (hiding the harsh edge of the mask) and focuses down to 0
    const glowRadius = interpolate(fluidProgress.value, [0.2, 0.7, 1], [25, 10, 0], Extrapolation.CLAMP);
    
    return {
      opacity,
      transform: [{ scale }],
      textShadowColor: t.heat,
      textShadowRadius: glowRadius,
      textShadowOffset: { width: 0, height: 0 },
    };
  });

  // Velvet Glass overlay dissolves as you tilt
  const glassAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(fluidProgress.value, [0, 0.7], [1, 0], Extrapolation.CLAMP);
    return { opacity };
  });

  // Background heat flush (like paper warming up)
  const backgroundHeatStyle = useAnimatedStyle(() => {
    const opacity = interpolate(fluidProgress.value, [0, 0.6, 1], [0, 0.15, 0], Extrapolation.CLAMP);
    return { 
      opacity,
      backgroundColor: t.heat 
    };
  });

  const hintAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(fluidProgress.value, [0, 0.3], [1, 0], Extrapolation.CLAMP);
    return { opacity };
  });

  return (
    <View style={[styles.wrapper, style]}>
      
      {/* ── Invisible Layout Anchor (Ensures the wrapper sizes correctly for MaskedView) ── */}
      <Text style={[styles.text, { opacity: 0 }]} pointerEvents="none">
        {text}
      </Text>

      {/* ── Layer 1: Warm ambient paper flush ── */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.glowLayer, backgroundHeatStyle]}
      />

      {/* ── Layer 2: The secret text (Masked Center-Outward Reveal) ── */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.maskCenter]}>
        <Animated.View style={[maskAnimatedStyle, { overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }]}>
          <Animated.Text style={[styles.text, { color: t.ink, position: 'absolute' }, textAnimatedStyle]}>
            {text}
          </Animated.Text>
        </Animated.View>
      </View>

      {/* ── Layer 3: Velvet Glass Obfuscation ── */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, glassAnimatedStyle]}>
        <BlurView intensity={40} tint={t.glassTint} style={StyleSheet.absoluteFill} />
      </Animated.View>

      {/* ── Layer 4: Breathing Hint ── */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.hintOverlay, hintAnimatedStyle]}
      >
        <Animated.View style={[styles.hintPill, { opacity: breathAnim }]}>
          <Text style={[styles.hintIcon]}>🕯</Text>
          <Text style={[styles.hintText, { color: t.hint }]}>
            HOLD UP TO LIGHT
          </Text>
        </Animated.View>
      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 80,
    backgroundColor: 'rgba(0,0,0,0.02)',
    position: 'relative',
  },
  textContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 19,
    lineHeight: 30,
    fontFamily: Platform.select({
      ios:     'DMSerifDisplay-Regular',
      android: 'DMSerifDisplay_400Regular',
    }),
    paddingVertical: 24,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  maskCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  maskCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  glowLayer: {
    borderRadius: 16,
  },
  hintOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  hintIcon: {
    fontSize: 14,
  },
  hintText: {
    fontSize: 10,
    letterSpacing: 3,
    fontFamily: Platform.select({
      ios: 'Lato-Bold',
      android: 'Lato_700Bold',
    }),
  },
});
