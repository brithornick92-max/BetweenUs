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
import Icon from './Icon';
import { LinearGradient } from 'expo-linear-gradient';
import { getDateCardPalette } from './dateCardPalette';

const SCREEN_W = Dimensions.get('window').width;

const FONTS = {
  body: Platform.select({ ios: 'Lato-Regular', android: 'Lato_400Regular', default: 'sans-serif' }),
  bodyBold: Platform.select({ ios: 'Lato-Bold', android: 'Lato_700Bold', default: 'sans-serif' }),
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
  const palette = getDateCardPalette(heat);
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
    <View style={[styles.container, { backgroundColor: palette.base }]}> 
      {/* Base dark chrome gradient */}
      <LinearGradient
        colors={[palette.base, palette.mid + 'A6', palette.base]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Chrome edge shines */}
      <LinearGradient
        colors={[palette.highlight + '1F', 'transparent']}
        style={styles.topEdgeShine}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <LinearGradient
        colors={[palette.chrome + '14', 'transparent']}
        style={styles.leftEdgeShine}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
      />
      <LinearGradient
        colors={['transparent', palette.chrome + '12']}
        style={styles.bottomEdgeShine}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Animated shimmer band */}
      <RNAnimated.View
        style={[styles.shimmerBand, { transform: [{ translateX: shimmerX }, { rotate: '25deg' }] }]}
      >
        <LinearGradient
          colors={['transparent', palette.chrome + '12', palette.highlight + '20', palette.chrome + '12', 'transparent']}
          style={{ width: '100%', height: '100%' }}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        />
      </RNAnimated.View>

      {/* Inner chrome frame */}
      <View style={[styles.innerFrame, { borderColor: palette.chrome + '2D', backgroundColor: palette.frameFill }]}> 
        <LinearGradient
          colors={['transparent', palette.chrome + '20', palette.highlight + '24', palette.chrome + '20', 'transparent']}
          style={styles.frameTopLine}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        />
        <LinearGradient
          colors={['transparent', palette.chrome + '18', palette.highlight + '20', palette.chrome + '18', 'transparent']}
          style={styles.frameBottomLine}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        />

        {/* Top badge */}
        <View style={[styles.topBadge, { borderColor: palette.chrome + '32', backgroundColor: palette.badgeBackground }]}> 
          <Icon name="cards-heart" size={12} color={palette.highlight} />
          <Text style={[styles.badgeText, { color: palette.highlight, textShadowColor: palette.shadow }]}>DATE NIGHT</Text>
        </View>

        {/* Center emblem */}
        <Animated.View style={[styles.emblemOuter, { borderColor: palette.chrome + '38' }, ringStyle]}> 
          <LinearGradient
            colors={[palette.band[0] + 'B3', palette.band[1] + '59']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={[styles.emblemInner, { borderColor: palette.chrome + '2D' }]}> 
            <LinearGradient
              colors={[palette.highlight + '24', palette.chrome + '12']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Icon name={icon} size={36} color={palette.highlight} />
          </View>
        </Animated.View>

        {/* Heat level text */}
        <Text style={[styles.levelText, { color: palette.text, textShadowColor: palette.shadow }]}> 
          {label.toUpperCase()}
        </Text>

        {/* Bottom hint */}
        <Text style={[styles.hint, { color: palette.body }]}>tap to reveal</Text>
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
        shadowColor: '#070509',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.08,
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
