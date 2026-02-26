/**
 * DateCardFront.jsx — Front face of a date night card
 * Metallic chrome design matching PromptCardDeck style.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, Animated as RNAnimated, Dimensions } from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Easing } from 'react-native-reanimated';

const SCREEN_W = Dimensions.get('window').width;

const FONTS = {
  serif: Platform.select({ ios: 'DMSerifDisplay-Regular', android: 'DMSerifDisplay_400Regular', default: 'serif' }),
  serifAccent: Platform.select({ ios: 'Playfair Display', android: 'PlayfairDisplay_300Light', default: 'serif' }),
  body: Platform.select({ ios: 'Inter', android: 'Inter_400Regular', default: 'sans-serif' }),
  bodyBold: Platform.select({ ios: 'Inter-SemiBold', android: 'Inter_600SemiBold', default: 'sans-serif' }),
};

export const HEAT_GRADIENTS = {
  1: ['#B07EFF', '#9060E0'],
  2: ['#FF7EB8', '#E0609A'],
  3: ['#FF5A5A', '#D03030'],
};

export const HEAT_ICONS = {
  1: 'hand-heart',
  2: 'party-popper',
  3: 'fire',
};

const HEAT_LABELS = {
  1: 'Heart',
  2: 'Play',
  3: 'Heat',
};

const HEAT_METAL = {
  1: { base: '#1A1230', chrome: '#C4A8FF', highlight: '#E0CCFF', mid: '#6B48B8' },
  2: { base: '#1E0F1A', chrome: '#FFB0D6', highlight: '#FFD6EA', mid: '#B8487A' },
  3: { base: '#1E0808', chrome: '#FF9090', highlight: '#FFB8B8', mid: '#B83030' },
};

export default function DateCardFront({ date, colors, dims }) {
  const heat = date?.heat || 1;
  const metal = HEAT_METAL[heat] || HEAT_METAL[1];
  const gradient = HEAT_GRADIENTS[heat] || HEAT_GRADIENTS[1];
  const icon = HEAT_ICONS[heat] || 'hand-heart';
  const label = HEAT_LABELS[heat] || 'Emotional';
  const loadMeta = dims.load.find(l => l.level === date.load) || dims.load[1];

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
        colors={[metal.base, metal.mid + '20', metal.base]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Top shine */}
      <LinearGradient
        colors={[metal.chrome + '12', 'transparent']}
        style={styles.topShine}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Animated shimmer band */}
      <RNAnimated.View
        style={[styles.shimmerBand, { transform: [{ translateX: shimmerX }, { rotate: '25deg' }] }]}
      >
        <LinearGradient
          colors={['transparent', metal.chrome + '08', metal.highlight + '14', metal.chrome + '08', 'transparent']}
          style={{ width: '100%', height: '100%' }}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        />
      </RNAnimated.View>

      {/* Top band with heat level accent */}
      <View style={styles.topBand}>
        <LinearGradient
          colors={[gradient[0] + '35', gradient[1] + '20']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
        {/* Brushed metal accent line */}
        <LinearGradient
          colors={['transparent', metal.chrome + '30', metal.highlight + '40', metal.chrome + '30', 'transparent']}
          style={styles.bandTopEdge}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        />
        <View style={styles.bandContent}>
          <MaterialCommunityIcons name={icon} size={16} color={metal.highlight} />
          <Text style={[styles.bandLabel, { color: metal.highlight }]}>{label}</Text>
        </View>
      </View>

      {/* Chrome divider */}
      <LinearGradient
        colors={['transparent', metal.chrome + '40', metal.highlight + '50', metal.chrome + '40', 'transparent']}
        style={styles.chromeDivider}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
      />

      {/* Inner card frame — metallic border */}
      <View style={[styles.innerFrame, { borderColor: metal.chrome + '18' }]}>
        <LinearGradient
          colors={[metal.chrome + '06', 'transparent', metal.chrome + '04']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        <View style={styles.body}>
          {/* Tags row */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.tagsRow}>
            {loadMeta && (
              <View style={[styles.tag, { borderColor: metal.chrome + '30' }]}>
                <Text style={[styles.tagText, { color: metal.chrome }]}>{loadMeta.icon} {loadMeta.label}</Text>
              </View>
            )}
            {date.minutes ? (
              <View style={[styles.tag, { borderColor: metal.chrome + '30' }]}>
                <MaterialCommunityIcons name="clock-outline" size={11} color={metal.chrome} />
                <Text style={[styles.tagText, { color: metal.chrome }]}> {date.minutes} min</Text>
              </View>
            ) : null}
            {date._matchLabel ? (
              <View style={[styles.tag, { borderColor: '#C9A84C50' }]}>
                <Text style={[styles.tagText, { color: '#C9A84C' }]}>{date._matchLabel}</Text>
              </View>
            ) : null}
          </Animated.View>

          {/* Title */}
          <Animated.Text
            entering={FadeInDown.delay(200).duration(450)}
            style={[styles.title, { color: metal.highlight }]}
            numberOfLines={3}
          >
            {date.title}
          </Animated.Text>

          {/* First step as description */}
          {Array.isArray(date.steps) && date.steps[0] ? (
            <Animated.Text
              entering={FadeInDown.delay(300).duration(450)}
              style={[styles.description, { color: metal.chrome + '80' }]}
              numberOfLines={3}
            >
              {date.steps[0]}
            </Animated.Text>
          ) : null}
        </View>
      </View>

      {/* Chrome separator above footer */}
      <LinearGradient
        colors={['transparent', metal.chrome + '30', metal.highlight + '40', metal.chrome + '30', 'transparent']}
        style={styles.chromeDivider}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
      />

      {/* Bottom footer */}
      <View style={styles.footer}>
        <View style={styles.footerContent}>
          <Text style={[styles.footerText, { color: metal.chrome + '60' }]}>swipe right for tonight</Text>
          <MaterialCommunityIcons name="arrow-right" size={14} color={metal.chrome + '60'} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  topShine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 50,
    zIndex: 1,
  },
  shimmerBand: {
    position: 'absolute',
    top: '-30%',
    width: SCREEN_W * 0.35,
    height: '180%',
  },
  topBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    overflow: 'hidden',
  },
  bandTopEdge: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
  },
  bandContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bandLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  chromeDivider: {
    height: 1,
    marginHorizontal: 10,
  },
  innerFrame: {
    flex: 1,
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  tagText: {
    fontSize: 11,
    fontFamily: FONTS.body,
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 20,
    fontFamily: FONTS.serif,
    fontWeight: '700',
    lineHeight: 26,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  description: {
    fontSize: 13,
    fontFamily: FONTS.body,
    lineHeight: 19,
  },
  footer: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    paddingTop: 6,
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  footerText: {
    fontFamily: FONTS.body,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
