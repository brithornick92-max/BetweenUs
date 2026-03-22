// components/Icon.jsx
import React from 'react';
import { Platform, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons);

/**
 * Apple Editorial Icon Bridge
 * Intercepts legacy MaterialCommunityIcon string names from your data layer 
 * and translates them into sleek, native iOS-style Ionicons.
 */
const ICON_DICTIONARY = {
  // ── Actions & Navigation ──
  'arrow-right': 'arrow-forward',
  'arrow-left': 'arrow-back',
  'chevron-right': 'chevron-forward',
  'chevron-left': 'chevron-back',
  'close': 'close',
  'check': 'checkmark',
  'check-decagram-outline': 'checkmark-circle-outline',
  'plus': 'add',
  'minus': 'remove',
  'pencil': 'pencil-outline',
  'cog': 'settings-outline',
  'dots-vertical': 'ellipsis-vertical',
  'dots-horizontal': 'ellipsis-horizontal',

  // ── Relationship & Emotional ──
  'heart': 'heart',
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
  'candle': 'flame', // Ionicons doesn't have a candle, flame works perfectly for romance
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
  'star-four-points-outline': 'sparkles-outline',
  'calendar-range': 'calendar-outline',

  // ── Passthroughs (For safety if we pass Ionicons directly) ──
  'time-outline': 'time-outline',
  'arrow-forward': 'arrow-forward',
  'chevron-up': 'chevron-up',
  'chevron-down': 'chevron-down',
  'color-wand-outline': 'color-wand-outline',
  'sparkles-outline': 'sparkles-outline',
  'checkmark': 'checkmark',
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
};

export default function Icon({ 
  name, 
  size = 24, 
  color, 
  style, 
  animated = false 
}) {
  // 1. Try to find a direct translation in our dictionary
  // 2. If it's not in the dictionary, assume it might already be a valid Ionicon string and pass it through
  // 3. If it is completely missing, fallback to 'ellipse-outline' to avoid crashing the view
  const mappedName = ICON_DICTIONARY[name] || (name ? name : 'ellipse-outline');

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
