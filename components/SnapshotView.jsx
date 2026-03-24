// components/SnapshotView.jsx — Hidden View for Image Export
// 9:16 Vertical Editorial Page. Sexy Red & Light Gray "Lume" effect.
// Rendered off-screen inside a ViewShot wrapper in YearReflectionScreen.

import React from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import Icon from './Icon';

// Use logical screen width so ViewShot can upscale via pixelRatio option.
const { width: WINDOW_WIDTH } = Dimensions.get('window');
export const SNAPSHOT_WIDTH = WINDOW_WIDTH;
export const SNAPSHOT_HEIGHT = Math.round(SNAPSHOT_WIDTH * (16 / 9));

const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });
const SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif' });

const PALETTE = {
  sexyRed: '#D2121A',
  lightGray: '#F2F2F7',
  white: '#FFFFFF',
};

export default function SnapshotView({ text, year, isDark }) {
  const bg = isDark ? '#1D1D1F' : PALETTE.white;
  const textColor = isDark ? '#FFFFFF' : '#1D1D1F';
  const subtextColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const orbOpacity = isDark ? 0.22 : 0.13;
  const grayOrbOpacity = isDark ? 0.13 : 0.08;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* CHROMATIC LUME — red orb top-right */}
      <View style={[styles.orbRed, { opacity: orbOpacity }]} />
      {/* Subtle gray orb bottom-left */}
      <View
        style={[
          styles.orbGray,
          {
            backgroundColor: isDark ? PALETTE.white : PALETTE.lightGray,
            opacity: grayOrbOpacity,
          },
        ]}
      />

      {/* CONTENT AREA */}
      <View style={styles.content}>
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={[styles.yearLabel, { color: PALETTE.sexyRed }]}>
            {year} PRIVATE REFLECTION
          </Text>
          <Text style={[styles.bookTitle, { color: textColor }]}>THE STORY OF US</Text>
          <View style={[styles.divider, { backgroundColor: PALETTE.sexyRed }]} />
        </View>

        {/* BODY — paragraph, vertically centered */}
        <View style={styles.paragraphBody}>
          <Text style={[styles.serifText, { color: textColor }]}>{text}</Text>
        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <View style={[styles.endMark, { borderColor: subtextColor }]}>
            <Icon name="heart-outline" size={20} color={PALETTE.sexyRed} />
          </View>
          <Text style={[styles.brandLabel, { color: subtextColor }]}>BETWEEN US</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SNAPSHOT_WIDTH,
    height: SNAPSHOT_HEIGHT,
    overflow: 'hidden',
  },

  // Orbs — absolute, no BlurView needed (native blur unavailable off-screen in ViewShot)
  orbRed: {
    position: 'absolute',
    backgroundColor: PALETTE.sexyRed,
    width: SNAPSHOT_WIDTH * 0.9,
    height: SNAPSHOT_WIDTH * 0.9,
    borderRadius: SNAPSHOT_WIDTH * 0.45,
    top: -SNAPSHOT_HEIGHT * 0.1,
    right: -SNAPSHOT_WIDTH * 0.3,
  },
  orbGray: {
    position: 'absolute',
    width: SNAPSHOT_WIDTH * 0.7,
    height: SNAPSHOT_WIDTH * 0.7,
    borderRadius: SNAPSHOT_WIDTH * 0.35,
    bottom: -SNAPSHOT_WIDTH * 0.2,
    left: -SNAPSHOT_WIDTH * 0.2,
  },

  content: {
    flex: 1,
    paddingHorizontal: SNAPSHOT_WIDTH * 0.09,
    paddingTop: SNAPSHOT_HEIGHT * 0.11,
    paddingBottom: SNAPSHOT_HEIGHT * 0.1,
    justifyContent: 'space-between',
  },

  header: {
    alignItems: 'center',
  },
  yearLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 14,
  },
  bookTitle: {
    fontFamily: SERIF_FONT,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
    lineHeight: 38,
    textAlign: 'center',
  },
  divider: {
    width: 44,
    height: 3,
    borderRadius: 2,
    marginTop: 20,
  },

  paragraphBody: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  serifText: {
    fontFamily: SERIF_FONT,
    fontSize: 19,
    lineHeight: 30,
    letterSpacing: -0.3,
    textAlign: 'center',
  },

  footer: {
    alignItems: 'center',
  },
  endMark: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  brandLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
});
