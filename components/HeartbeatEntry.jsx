import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
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
import { useTheme } from '../context/ThemeContext';
import { TYPOGRAPHY } from '../utils/theme';

const { width } = Dimensions.get('window');

const HeartbeatEntry = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pulse = useSharedValue(1);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    // Continuous heartbeat-like pulse
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 1200, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
        withTiming(1, { duration: 1200, easing: Easing.bezier(0.4, 0, 0.2, 1) })
      ),
      -1,
      true
    );

    // Fade in text quote after mounting
    textOpacity.value = withTiming(1, { duration: 2500, easing: Easing.out(Easing.quad) });
  }, []);

  const glowStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulse.value, [1, 1.2], [1, 1.5], Extrapolate.CLAMP);
    const opacity = interpolate(pulse.value, [1, 1.2], [0.4, 0.15], Extrapolate.CLAMP);
    
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
        { translateY: interpolate(textOpacity.value, [0, 1], [10, 0]) }
      ]
    };
  });

  return (
    <View style={styles.container}>
      <View style={styles.animationWrapper}>
        {/* Rose Gold Pulsing Glow */}
        <Animated.View style={[styles.glow, glowStyle]} />
        
        {/* Champagne Core */}
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

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.primary,
    // We use shadow for extra bloom effect if needed, but the view itself pulses
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 40,
  },
  core: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.text,
    zIndex: 2,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  quoteContainer: {
    marginTop: 60,
    width: width * 0.8,
  },
  quote: {
    ...TYPOGRAPHY.bodySecondary,
    fontSize: 18,
    fontStyle: 'italic',
    textAlign: 'center',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
});

export default HeartbeatEntry;
