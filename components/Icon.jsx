// components/Icon.jsx
import React from 'react';
import { Platform, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons);
const IONICON_GLYPHS = Ionicons?.glyphMap || {};

/**
 * Apple Editorial Icon Bridge
 * Uses outline Ionicons whenever an outline glyph exists and keeps a tiny
 * compatibility layer only for non-Ionicons values emitted by platform APIs.
 */
const ICON_ALIASES = {
  'face-recognition': 'scan-outline',
  'fingerprint': 'finger-print-outline',
};

function normalizeIoniconName(name) {
  if (!name) {
    return 'ellipse-outline';
  }

  const mappedName = ICON_ALIASES[name] || name;
  const baseName = mappedName
    .replace(/-sharp$/, '')
    .replace(/-outline$/, '');

  if (IONICON_GLYPHS[`${baseName}-outline`]) {
    return `${baseName}-outline`;
  }

  if (IONICON_GLYPHS[mappedName]) {
    return mappedName;
  }

  return 'ellipse-outline';
}

function Icon({ 
  name, 
  size = 24, 
  color, 
  style, 
  animated = false 
}) {
  const mappedName = normalizeIoniconName(name);

  // Automatically thin out the weight slightly on iOS to perfectly match Apple SF Symbols
  const editorialStyle = [
    Platform.OS === 'ios' && { fontWeight: '300' },
    style
  ];

  if (animated) {
    return (
      <AnimatedIonicons
        name={mappedName}
        size={size}
        style={[{ color }, editorialStyle]}
      />
    );
  }

  return (
    <Ionicons
      name={mappedName}
      size={size}
      color={color}
      style={editorialStyle}
    />
  );
}

export default React.memo(Icon);
