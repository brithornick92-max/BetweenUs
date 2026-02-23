/**
 * DateCardBack.jsx — Back face (face-down) of a date night card
 * Extracted from DateNightScreen for maintainability.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { HEAT_GRADIENTS, HEAT_ICONS } from './DateCardFront';

export default function DateCardBack({ date, dims }) {
  const heatMeta = dims.heat.find(h => h.level === date.heat) || dims.heat[0];
  const gradient = HEAT_GRADIENTS[date.heat] || HEAT_GRADIENTS[1];
  const icon = HEAT_ICONS[date.heat] || 'heart-outline';

  return (
    <LinearGradient
      colors={gradient}
      style={styles.cardBackGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.backRing}>
        <View style={styles.backRingInner}>
          <MaterialCommunityIcons name={icon} size={44} color="rgba(255,255,255,0.25)" />
        </View>
      </View>

      <View style={styles.backPill}>
        <Text style={styles.backPillEmoji}>{heatMeta.icon}</Text>
        <Text style={styles.backPillText}>{heatMeta.label}</Text>
      </View>

      <Text style={styles.backHint}>tap to reveal</Text>

      <Text style={[styles.cornerMark, { top: 16, left: 16 }]}>✦</Text>
      <Text style={[styles.cornerMark, { top: 16, right: 16 }]}>✦</Text>
      <Text style={[styles.cornerMark, { bottom: 16, left: 16 }]}>✦</Text>
      <Text style={[styles.cornerMark, { bottom: 16, right: 16 }]}>✦</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  cardBackGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  backRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  backRingInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  backPillEmoji: {
    fontSize: 14,
  },
  backPillText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  backHint: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 12,
  },
  cornerMark: {
    position: 'absolute',
    color: 'rgba(255,255,255,0.1)',
    fontSize: 10,
  },
});
