/**
 * DateCardFront.jsx — Front face of a date night card
 * Metallic chrome design matching PromptCardDeck style.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, Animated as RNAnimated, Dimensions } from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import Icon from './Icon';
import { LinearGradient } from 'expo-linear-gradient';
import { Easing } from 'react-native-reanimated';
import { getDateCardPalette } from './dateCardPalette';

const SCREEN_W = Dimensions.get('window').width;

const FONTS = {
  serif: Platform.select({ ios: 'DMSerifDisplay-Regular', android: 'DMSerifDisplay_400Regular', default: 'serif' }),
  serifAccent: Platform.select({ ios: 'DMSerifDisplay-Regular', android: 'DMSerifDisplay_400Regular', default: 'serif' }),
  body: Platform.select({ ios: 'Lato-Regular', android: 'Lato_400Regular', default: 'sans-serif' }),
  bodyBold: Platform.select({ ios: 'Lato-Bold', android: 'Lato_700Bold', default: 'sans-serif' }),
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

export default function DateCardFront({ date, colors, dims }) {
  const heat = date?.heat || 1;
  const palette = getDateCardPalette(heat);
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
    <View style={[styles.container, { backgroundColor: palette.base }]}> 
      {/* Base dark chrome gradient */}
      <LinearGradient
        colors={[palette.base, palette.mid + '90', palette.base]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Top shine */}
      <LinearGradient
        colors={[palette.highlight + '14', 'transparent']}
        style={styles.topShine}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Animated shimmer band */}
      <RNAnimated.View
        style={[styles.shimmerBand, { transform: [{ translateX: shimmerX }, { rotate: '25deg' }] }]}
      >
        <LinearGradient
          colors={['transparent', palette.chrome + '10', palette.highlight + '1C', palette.chrome + '10', 'transparent']}
          style={{ width: '100%', height: '100%' }}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        />
      </RNAnimated.View>

      {/* Top band with heat level accent */}
      <View style={styles.topBand}>
        <LinearGradient
          colors={[palette.band[0] + 'E6', palette.band[1] + 'CC']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
        {/* Brushed metal accent line */}
        <LinearGradient
          colors={['transparent', palette.chrome + '45', palette.highlight + '55', palette.chrome + '45', 'transparent']}
          style={styles.bandTopEdge}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        />
        <View style={styles.bandContent}>
          <Icon name={icon} size={16} color={palette.highlight} />
          <Text style={[styles.bandLabel, { color: palette.highlight, textShadowColor: palette.shadow }]}>{label}</Text>
        </View>
      </View>

      {/* Chrome divider */}
      <LinearGradient
        colors={['transparent', palette.chrome + '45', palette.highlight + '55', palette.chrome + '45', 'transparent']}
        style={styles.chromeDivider}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
      />

      {/* Inner card frame — metallic border */}
      <View style={[styles.innerFrame, { borderColor: palette.chrome + '2D' }]}> 
        <LinearGradient
          colors={[palette.highlight + '08', 'transparent', palette.chrome + '0A']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        <View style={styles.body}>
          {/* Tags row */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.tagsRow}>
            {loadMeta && (
              <View style={[styles.tag, { borderColor: palette.chrome + '38', backgroundColor: palette.tagBackground }]}> 
                <Text style={[styles.tagText, { color: palette.body }]}>{loadMeta.icon} {loadMeta.label}</Text>
              </View>
            )}
            {date.minutes ? (
              <View style={[styles.tag, { borderColor: palette.chrome + '38', backgroundColor: palette.tagBackground }]}> 
                <Icon name="clock-outline" size={11} color={palette.body} />
                <Text style={[styles.tagText, { color: palette.body }]}> {date.minutes} min</Text>
              </View>
            ) : null}
            {date._matchLabel ? (
              <View style={[styles.tag, { borderColor: colors.primaryMuted + '50', backgroundColor: palette.tagBackground }]}> 
                <Text style={[styles.tagText, { color: colors.primaryMuted }]}>{date._matchLabel}</Text>
              </View>
            ) : null}
          </Animated.View>

          {/* Title */}
          <Animated.Text
            entering={FadeInDown.delay(200).duration(450)}
            style={[styles.title, { color: palette.text, textShadowColor: palette.shadow }]}
            numberOfLines={3}
          >
            {date.title}
          </Animated.Text>

          {/* First step as description */}
          {Array.isArray(date.steps) && date.steps[0] ? (
            <Animated.Text
              entering={FadeInDown.delay(300).duration(450)}
              style={[styles.description, { color: palette.body }]}
              numberOfLines={3}
            >
              {date.steps[0]}
            </Animated.Text>
          ) : null}
        </View>
      </View>

      {/* Chrome separator above footer */}
      <LinearGradient
        colors={['transparent', palette.chrome + '40', palette.highlight + '4A', palette.chrome + '40', 'transparent']}
        style={styles.chromeDivider}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
      />

      {/* Bottom footer */}
      <View style={styles.footer}>
        <View style={styles.footerContent}>
          <Text style={[styles.footerText, { color: palette.body }]}>swipe right for tonight</Text>
          <Icon name="arrow-right" size={14} color={palette.body} />
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
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
