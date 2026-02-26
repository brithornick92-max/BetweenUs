/**
 * DateCardBack.jsx — Back face (face-down) of a date night card
 * Metallic chrome design matching PromptCardDeck style.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, Animated as RNAnimated, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const SCREEN_W = Dimensions.get('window').width;

const FONTS = {
  body: Platform.select({ ios: 'Inter', android: 'Inter_400Regular', default: 'sans-serif' }),
  bodyBold: Platform.select({ ios: 'Inter-SemiBold', android: 'Inter_600SemiBold', default: 'sans-serif' }),
};

const HEAT_METAL = {
  1: { base: '#1A1230', chrome: '#C4A8FF', highlight: '#E0CCFF', mid: '#6B48B8' },
  2: { base: '#1E0F1A', chrome: '#FFB0D6', highlight: '#FFD6EA', mid: '#B8487A' },
  3: { base: '#1E0808', chrome: '#FF9090', highlight: '#FFB8B8', mid: '#B83030' },
};

const HEAT_COLORS = {
  1: ['#B07EFF', '#9060E0'],
  2: ['#FF7EB8', '#E0609A'],
  3: ['#FF5A5A', '#D03030'],
};

const HEAT_ICONS = {
  1: 'hand-heart',
  2: 'party-popper',
  3: 'fire',
};

const HEAT_LABELS = {
  1: 'Heart',
  2: 'Play',
  3: 'Heat',
};

export default function DateCardBack({ date, dims }) {
  const heat = date?.heat || 1;
  const metal = HEAT_METAL[heat] || HEAT_METAL[1];
  const gradient = HEAT_COLORS[heat] || HEAT_COLORS[1];
  const icon = HEAT_ICONS[heat] || 'hand-heart';
  const label = HEAT_LABELS[heat] || 'Emotional';

  // Breathing ring pulse
  const ringPulse = useSharedValue(1);
  useEffect(() => {
    ringPulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringPulse.value }],
    opacity: interpolate(ringPulse.value, [1, 1.08], [0.7, 1]),
  }));

  // Animated shimmer band
  const shimmerX = useRef(new RNAnimated.Value(-SCREEN_W * 0.5)).current;
  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.timing(shimmerX, {
        toValue: SCREEN_W * 1.2,
        duration: 3500,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: metal.base }]}>
      {/* Base dark chrome gradient */}
      <LinearGradient
        colors={[metal.base, metal.mid + '30', metal.base]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Chrome edge shines */}
      <LinearGradient
        colors={[metal.chrome + '18', 'transparent']}
        style={styles.topEdgeShine}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <LinearGradient
        colors={[metal.chrome + '10', 'transparent']}
        style={styles.leftEdgeShine}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
      />
      <LinearGradient
        colors={['transparent', metal.chrome + '08']}
        style={styles.bottomEdgeShine}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Animated shimmer band */}
      <RNAnimated.View
        style={[styles.shimmerBand, { transform: [{ translateX: shimmerX }, { rotate: '25deg' }] }]}
      >
        <LinearGradient
          colors={['transparent', metal.chrome + '10', metal.highlight + '18', metal.chrome + '10', 'transparent']}
          style={{ width: '100%', height: '100%' }}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        />
      </RNAnimated.View>

      {/* Inner chrome frame */}
      <View style={[styles.innerFrame, { borderColor: metal.chrome + '18' }]}>
        <LinearGradient
          colors={['transparent', metal.chrome + '15', metal.highlight + '20', metal.chrome + '15', 'transparent']}
          style={styles.frameTopLine}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        />
        <LinearGradient
          colors={['transparent', metal.chrome + '10', metal.highlight + '15', metal.chrome + '10', 'transparent']}
          style={styles.frameBottomLine}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        />

        {/* Top badge */}
        <View style={[styles.topBadge, { borderColor: metal.chrome + '25' }]}>
          <MaterialCommunityIcons name="cards-heart" size={12} color={metal.chrome} />
          <Text style={[styles.badgeText, { color: metal.chrome }]}>DATE NIGHT</Text>
        </View>

        {/* Center emblem */}
        <Animated.View style={[styles.emblemOuter, { borderColor: metal.chrome + '30' }, ringStyle]}>
          <LinearGradient
            colors={[gradient[0] + '30', gradient[1] + '15']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={[styles.emblemInner, { borderColor: metal.chrome + '20' }]}>
            <LinearGradient
              colors={[gradient[0] + '20', gradient[1] + '10']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <MaterialCommunityIcons name={icon} size={36} color={metal.chrome + '60'} />
          </View>
        </Animated.View>

        {/* Heat level text */}
        <Text style={[styles.levelText, { color: metal.chrome + '50', textShadowColor: gradient[0] + '40' }]}>
          {label.toUpperCase()}
        </Text>

        {/* Bottom hint */}
        <Text style={[styles.hint, { color: metal.chrome + '30' }]}>tap to reveal</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  topEdgeShine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 60,
  },
  leftEdgeShine: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0,
    width: 40,
  },
  bottomEdgeShine: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 40,
  },
  shimmerBand: {
    position: 'absolute',
    top: '-30%',
    width: SCREEN_W * 0.35,
    height: '180%',
  },
  innerFrame: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: 12,
    margin: 8,
    paddingVertical: 22,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    overflow: 'hidden',
  },
  frameTopLine: {
    position: 'absolute',
    top: 0, left: 16, right: 16,
    height: 1,
  },
  frameBottomLine: {
    position: 'absolute',
    bottom: 40, left: 16, right: 16,
    height: 1,
  },
  topBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 7,
  },
  badgeText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  emblemOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(255,255,255,0.25)',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 16,
      },
      android: {},
    }),
  },
  emblemInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  levelText: {
    fontFamily: FONTS.body,
    fontSize: 15,
    letterSpacing: 5,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  hint: {
    fontFamily: FONTS.body,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
