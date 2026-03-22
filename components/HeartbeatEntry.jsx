import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withRepeat, 
  withSequence,
  Easing,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

const HeartbeatEntry = () => {
  const { colors, isDark } = useTheme();
  
  // STRICT Apple Editorial Theme Map
  const t = useMemo(() => ({
    background: isDark ? '#000000' : '#F2F2F7', 
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    primary: colors.primary,
    accent: colors.accent || '#FF2D55',
    text: isDark ? '#FFFFFF' : '#000000',
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);
  const pulse = useSharedValue(1);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    // Continuous heartbeat-like pulse with Apple-like spring/easing
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 1200, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
        withTiming(1, { duration: 1200, easing: Easing.bezier(0.4, 0, 0.2, 1) })
      ),
      -1,
      true
    );

    // Fade in text quote after mounting
    textOpacity.value = withTiming(1, { duration: 2000, easing: Easing.out(Easing.cubic) });
  }, [pulse, textOpacity]);

  const glowStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulse.value, [1, 1.2], [1, 1.6], Extrapolate.CLAMP);
    const opacity = interpolate(pulse.value, [1, 1.2], [0.3, 0.05], Extrapolate.CLAMP);
    
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const coreStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulse.value, [1, 1.2], [1, 1.05], Extrapolate.CLAMP);
    
    return {
      transform: [{ scale }],
    };
  });

  const animatedTextStyle = useAnimatedStyle(() => {
    return {
      opacity: textOpacity.value,
      transform: [
        { translateY: interpolate(textOpacity.value, [0, 1], [15, 0], Extrapolate.CLAMP) }
      ]
    };
  });

  return (
    <View style={styles.container}>
      {/* Velvet background gradient injected directly for the immersive intro */}
      <LinearGradient
        colors={
          isDark 
            ? [t.background, '#0F0A1A', '#0D081A', t.background] 
            : [t.background, '#EBEBF5', t.background]
        }
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.animationWrapper}>
        {/* Deep Velvet Pulsing Glow */}
        <Animated.View style={[styles.glow, glowStyle]} />
        
        {/* Stark Editorial Core */}
        <Animated.View style={[styles.core, coreStyle]} />
      </View>

      {/* Fade-in Quote */}
      <Animated.View style={[styles.quoteContainer, animatedTextStyle]}>
        <Text style={styles.quote}>
          "A space for just the two of you."
        </Text>
      </Animated.View>
    </View>
  );
};

// ------------------------------------------------------------------
// STYLES - Apple Editorial / Velvet Glass
// ------------------------------------------------------------------
const createStyles = (t, isDark) => {
  const systemFont = Platform.select({ ios: "System", android: "Roboto" });

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    animationWrapper: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 380,
      width: 380,
    },
    glow: {
      position: 'absolute',
      width: 160,
      height: 160,
      borderRadius: 80,
      backgroundColor: t.primary,
      ...Platform.select({
        ios: {
          shadowColor: t.primary,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 40,
        },
        android: { elevation: 10 },
      }),
    },
    core: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: t.text, // High contrast crisp core
      zIndex: 2,
      ...Platform.select({
        ios: {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: isDark ? 0.8 : 0.15,
          shadowRadius: 20,
        },
        android: { elevation: 8 },
      }),
    },
    quoteContainer: {
      marginTop: 40,
      width: width * 0.85,
    },
    quote: {
      fontFamily: systemFont,
      fontSize: 24,
      fontWeight: '700',
      textAlign: 'center',
      color: t.text,
      letterSpacing: -0.3,
      lineHeight: 32,
    },
  });
};

export default HeartbeatEntry;
