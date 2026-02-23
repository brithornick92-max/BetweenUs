/**
 * DateCardFront.jsx — Front face of a date night card
 * Extracted from DateNightScreen for maintainability.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BORDER_RADIUS } from '../utils/theme';

const FONTS = {
  serif: Platform.select({ ios: 'Playfair Display', android: 'PlayfairDisplay_300Light', default: 'serif' }),
  body: Platform.select({ ios: 'Inter', android: 'Inter_400Regular', default: 'sans-serif' }),
  bodyBold: Platform.select({ ios: 'Inter-SemiBold', android: 'Inter_600SemiBold', default: 'sans-serif' }),
};

export const HEAT_GRADIENTS = {
  1: ['#8B9E8B', '#5C7A5C'],
  2: ['#7E6B99', '#5A4578'],
  3: ['#9E5C7A', '#7A3D5A'],
  4: ['#8B6844', '#6B4A2A'],
  5: ['#8B3A3A', '#5C1A1A'],
};

export const HEAT_ICONS = {
  1: 'heart-outline',
  2: 'heart-multiple-outline',
  3: 'emoticon-kiss-outline',
  4: 'fire',
  5: 'weather-lightning',
};

export default function DateCardFront({ date, colors, dims }) {
  const heatMeta = dims.heat.find(h => h.level === date.heat) || dims.heat[0];
  const loadMeta = dims.load.find(l => l.level === date.load) || dims.load[1];
  const gradient = HEAT_GRADIENTS[date.heat] || HEAT_GRADIENTS[1];

  return (
    <View style={styles.cardFrontInner}>
      <LinearGradient
        colors={gradient}
        style={styles.cardFrontBand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      />

      <View style={styles.cardFrontBody}>
        <View style={styles.cardFrontBandTags}>
          <View style={[styles.cardFrontBandTag, { borderColor: heatMeta.color + '50' }]}>
            <Text style={[styles.cardFrontBandTagText, { color: heatMeta.color }]}>{heatMeta.icon} {heatMeta.label}</Text>
          </View>
          <View style={[styles.cardFrontBandTag, { borderColor: loadMeta.color + '50' }]}>
            <Text style={[styles.cardFrontBandTagText, { color: loadMeta.color }]}>{loadMeta.icon} {loadMeta.label}</Text>
          </View>
          {date._matchLabel ? (
            <View style={[styles.cardFrontBandTag, { borderColor: '#C9A84C50' }]}>
              <Text style={[styles.cardFrontBandTagText, { color: '#C9A84C' }]}>{date._matchLabel}</Text>
            </View>
          ) : null}
        </View>

        <Text style={[styles.cardFrontTitle, { color: colors.text }]} numberOfLines={3}>
          {date.title}
        </Text>

        {Array.isArray(date.steps) && date.steps[0] ? (
          <Text style={[styles.cardFrontDesc, { color: colors.textMuted }]} numberOfLines={3}>
            {date.steps[0]}
          </Text>
        ) : null}

        <View style={{ flex: 1 }} />

        <View style={styles.cardFrontFooter}>
          {date.minutes ? (
            <View style={styles.cardFrontMeta}>
              <MaterialCommunityIcons name="clock-outline" size={13} color={colors.textMuted} />
              <Text style={[styles.cardFrontMetaTxt, { color: colors.textMuted }]}>{date.minutes} min</Text>
            </View>
          ) : null}
          <View style={styles.cardFrontFooterRight}>
            <Text style={[styles.cardFrontHint, { color: colors.textMuted }]}>swipe right for tonight</Text>
            <MaterialCommunityIcons name="arrow-right" size={13} color={colors.textMuted} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardFrontInner: {
    flex: 1,
  },
  cardFrontBand: {
    height: 4,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
  },
  cardFrontBody: {
    flex: 1,
    padding: 18,
  },
  cardFrontBandTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  cardFrontBandTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderRadius: 6,
  },
  cardFrontBandTagText: {
    fontSize: 11,
    fontFamily: FONTS.body,
    letterSpacing: 0.2,
  },
  cardFrontTitle: {
    fontSize: 20,
    fontFamily: FONTS.serif,
    fontWeight: '700',
    lineHeight: 26,
    marginBottom: 8,
  },
  cardFrontDesc: {
    fontSize: 13,
    fontFamily: FONTS.body,
    lineHeight: 19,
    opacity: 0.75,
  },
  cardFrontFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  cardFrontMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardFrontMetaTxt: {
    fontSize: 11,
    fontFamily: FONTS.body,
  },
  cardFrontFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardFrontHint: {
    fontSize: 10,
    fontFamily: FONTS.body,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
