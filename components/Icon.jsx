// components/Icon.jsx
import React from 'react';
import { Platform, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons);
const IONICON_GLYPHS = Ionicons?.glyphMap || {};

/**
 * Apple Editorial Icon Bridge
 * Intercepts legacy MaterialCommunityIcon string names from your data layer 
 * and translates them into sleek, native iOS-style Ionicons.
 */
const ICON_DICTIONARY = {
  // ── Actions & Navigation ──
  'arrow-right': 'arrow-forward-outline',
  'arrow-left': 'arrow-back-outline',
  'chevron-right': 'chevron-forward',
  'chevron-left': 'chevron-back',
  'close': 'close-outline',
  'check': 'checkmark-outline',
  'check-decagram-outline': 'checkmark-circle-outline',
  'plus': 'add-outline',
  'minus': 'remove-outline',
  'pencil': 'pencil-outline',
  'cog': 'settings-outline',
  'dots-vertical': 'ellipsis-vertical',
  'dots-horizontal': 'ellipsis-horizontal',

  // ── Heat Levels (old MaterialCommunity names) ──
  'spa-outline': 'chatbubble-outline',
  'cards-heart-outline': 'heart-outline',
  'cards-heart': 'heart-outline',

  // ── Relationship & Emotional ──
  'heart': 'heart-outline',
  'heart-outline': 'heart-outline',
  'heart-half-full': 'heart-half-outline',
  'hand-heart': 'heart-circle-outline',
  'email-heart-outline': 'mail-outline',
  'emoticon-wink-outline': 'happy-outline',
  'emoticon-happy-outline': 'happy-outline',

  // ── Climate & Vibe ──
  'weather-night': 'moon-outline',
  'white-balance-sunny': 'sunny-outline',
  'water': 'water-outline',
  'leaf': 'leaf-outline',
  'fire': 'flame-outline',
  'fire-alert': 'flame-outline',
  'candle': 'flame-outline',
  'shimmer': 'sparkles-outline',
  'star-four-points': 'sparkles-outline',
  'party-popper': 'sparkles-outline',
  'diamond-stone': 'diamond-outline',
  'creation': 'color-wand-outline',

  // ── App Features & Content ──
  'calendar': 'calendar-outline',
  'calendar-heart': 'calendar-outline',
  'clock-outline': 'time-outline',
  'history': 'time-outline',
  'book-open-outline': 'book-outline',
  'book-open-variant': 'book-outline',
  'chat-outline': 'chatbox-outline',
  'thought-bubble-outline': 'chatbubble-ellipses-outline',
  'bed-outline': 'bed-outline',
  'gamepad-variant-outline': 'game-controller-outline',
  'dice-multiple-outline': 'dice-outline',
  'compass-outline': 'compass-outline',
  'link-variant': 'infinite-outline',
  
  // ── Premium & Vault ──
  'lock': 'lock-closed-outline',
  'eye-outline': 'eye-outline',
  'eye-off-outline': 'eye-off-outline',
  'tag-off-outline': 'pricetag-outline',
  'cloud-sync': 'cloud-done-outline',
  'shield-check-outline': 'shield-checkmark-outline',

  // ── Account & Settings ──
  'crown': 'ribbon-outline',           // premium badge
  'heart-flash': 'heart-circle-outline', // partner connection promo
  'account-edit-outline': 'create-outline', // identity / edit profile
  'bell-badge-outline': 'notifications-outline', // notification settings
  'palette-outline': 'color-palette-outline', // appearance / theme
  'logout': 'log-out-outline',         // sign out
  'trash-can-outline': 'trash-outline', // delete

  // ── Season / Lifestyle ──
  'clock-fast': 'timer-outline',       // busy season
  'sofa-outline': 'cafe-outline',      // cozy season (closest warm-home feel)
  'sprout': 'leaf-outline',            // growth season

  // ── More actions ──
  'content-copy': 'copy-outline',
  'check-all': 'checkmark-done-outline',
  'heart-plus': 'heart-outline',
  'gesture-tap': 'hand-index-outline',
  'hand-wave': 'hand-left-outline',
  'heart-multiple': 'heart-outline',
  'library-outline': 'library-outline',
  'star-four-points-outline': 'sparkles-outline',
  'calendar-range': 'calendar-outline',

  // ── Passthroughs (For safety if we pass Ionicons directly) ──
  'time-outline': 'time-outline',
  'play': 'play-outline',
  'pause': 'pause-outline',
  'play-circle': 'play-circle-outline',
  'pause-circle': 'pause-circle-outline',
  'refresh': 'refresh-outline',
  'search': 'search-outline',
  'share': 'share-outline',
  'information': 'information-circle-outline',
  'warning': 'warning-outline',
  'seal': 'checkmark-seal-outline',
  'close-circle': 'close-circle-outline',
  'checkmark-circle': 'checkmark-circle-outline',
  'lock-closed': 'lock-closed-outline',
  'shield-check': 'shield-checkmark-outline',
  'sparkles': 'sparkles-outline',
  'add': 'add-outline',
  'archive': 'archive-outline',
  'pulse': 'pulse-outline',
  'book': 'book-outline',
  'gift': 'gift-outline',
  'arrow-forward': 'arrow-forward',
  'arrow-forward-outline': 'arrow-forward-outline',
  'arrow-back': 'arrow-back-outline',
  'arrow-back-outline': 'arrow-back-outline',
  'chevron-back': 'chevron-back',
  'chevron-forward': 'chevron-forward',
  'chevron-up': 'chevron-up',
  'chevron-down': 'chevron-down',
  'color-wand-outline': 'color-wand-outline',
  'sparkles-outline': 'sparkles-outline',
  'heart-half-outline': 'heart-half-outline',
  'bookmark-outline': 'bookmark-outline',
  'chatbubbles-outline': 'chatbubbles-outline',
  'hand-left-outline': 'hand-left-outline',
  'checkmark': 'checkmark',
  'checkmark-outline': 'checkmark-outline',
  'star-outline': 'star-outline',
  'help-circle-outline': 'help-circle-outline',
  'log-out-outline': 'log-out-outline',
  'trash-outline': 'trash-outline',
  'notifications-outline': 'notifications-outline',
  'color-palette-outline': 'color-palette-outline',
  'create-outline': 'create-outline',
  'copy-outline': 'copy-outline',
  'ribbon-outline': 'ribbon-outline',
  'timer-outline': 'timer-outline',
  'leaf-outline': 'leaf-outline',
  'cafe-outline': 'cafe-outline',
  'wifi-outline': 'wifi-outline',
  'cloud-offline-outline': 'cloud-offline-outline',
  'fingerprint': 'finger-print-outline',
  'face-recognition': 'scan-outline',
  'heart-lock': 'lock-closed-outline',
  'lock-heart': 'lock-closed-outline',
  'heart-pulse': 'pulse-outline',
  'auto-fix': 'color-wand-outline',
};

function normalizeIoniconName(name) {
  const mappedName = ICON_DICTIONARY[name] || (name ? name : 'ellipse-outline');

  if (IONICON_GLYPHS[mappedName]) {
    return mappedName;
  }

  if (!mappedName.endsWith('-outline') && IONICON_GLYPHS[`${mappedName}-outline`]) {
    return `${mappedName}-outline`;
  }

  if (mappedName.endsWith('-circle') && IONICON_GLYPHS[`${mappedName}-outline`]) {
    return `${mappedName}-outline`;
  }

  return IONICON_GLYPHS[mappedName] ? mappedName : 'ellipse-outline';
}

export default function Icon({ 
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
