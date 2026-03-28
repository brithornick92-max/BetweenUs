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
import { SPACING } from '../utils/theme';

const { width } = Dimensions.get('window');

/**
 * HeartbeatEntry
 * Sexy Red Intimacy & Apple Editorial Intro Animation.
 * Establishes the high-end "Velvet Glass" atmosphere upon app entry.
 */
const HeartbeatEntry = () => {
  const { colors, isDark } = useTheme();
  
  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    background: colors.background, 
    surface: isDark ? '#131016' : '#FFFFFF',
    primary: colors.primary || '#D2121A', // Sexy Red
    text: colors.text,
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);
  const pulse = useSharedValue(1);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    // Continuous high-end heartbeat pulse
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1500, easing: Easing.bezier(0.33, 1, 0.68, 1) }),
        withTiming(1, { duration: 1500, easing: Easing.bezier(0.33, 1, 0.68, 1) })
      ),
      -1,
      true
    );

    // Elegant text entrance
    textOpacity.value = withTiming(1, { 
      duration: 2500, 
      easing: Easing.out(Easing.exp) 
    });
  }, [pulse, textOpacity]);

  const glowStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulse.value, [1, 1.15], [1, 1.8], Extrapolate.CLAMP);
    const opacity = interpolate(pulse.value, [1, 1.15], [0.4, 0.02], Extrapolate.CLAMP);
    
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const coreStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulse.value, [1, 1.15], [1, 1.04], Extrapolate.CLAMP);
    
    return {
      transform: [{ scale }],
    };
  });

  const animatedTextStyle = useAnimatedStyle(() => {
    return {
      opacity: textOpacity.value,
      transform: [
        { translateY: interpolate(textOpacity.value, [0, 1], [20, 0], Extrapolate.CLAMP) }
      ]
    };
  });

  return (
    <View style={styles.container}>
      {/* Immersive background with Sexy Red vignette */}
      <LinearGradient
        colors={
          isDark 
            ? [t.background, '#120206', '#0A0003', t.background] 
            : [t.background, '#F2F2F7', t.background]
        }
        locations={[0, 0.4, 0.6, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.animationWrapper}>
        {/* Intimate Sexy Red Glow */}
        <Animated.View style={[styles.glow, glowStyle]} />
        
        {/* High-End Editorial Core */}
        <Animated.View style={[styles.core, coreStyle]} />
      </View>

      {/* Narrative Entry Text */}
      <Animated.View style={[styles.quoteContainer, animatedTextStyle]}>
        <Text style={styles.quote}>
          "A space for just the two of you."
        </Text>
        <View style={[styles.indicator, { backgroundColor: t.primary }]} />
      </Animated.View>
    </View>
  );
};

const createStyles = (t, isDark) => {
  const systemFont = Platform.select({ ios: "System", android: "Roboto" });
  const serifFont = Platform.select({ ios: "Georgia", android: "serif" });

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
      height: 300,
      width: 300,
    },
    glow: {
      position: 'absolute',
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: t.primary,
      ...Platform.select({
        ios: {
          shadowColor: t.primary,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 50,
        },
        android: { elevation: 12 },
      }),
    },
    core: {
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: t.text,
      zIndex: 2,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: isDark ? 0.9 : 0.1,
          shadowRadius: 24,
        },
        android: { elevation: 8 },
      }),
    },
    quoteContainer: {
      marginTop: 60,
      width: width * 0.8,
      alignItems: 'center',
    },
    quote: {
      fontFamily: serifFont,
      fontSize: 22,
      fontWeight: '600',
      textAlign: 'center',
      color: t.text,
      fontStyle: 'italic',
      lineHeight: 30,
      letterSpacing: -0.2,
    },
    indicator: {
      marginTop: 24,
      width: 3,
      height: 3,
      borderRadius: 1.5,
      opacity: 0.8,
    }
  });
};

export default React.memo(HeartbeatEntry);
