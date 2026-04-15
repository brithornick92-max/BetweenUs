/**
 * IntimacyPositionCard — Premium intimacy building card
 * Velvet Glass surface with editorial typography.
 * Displays a single position from content/intimacy-positions.json.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { SPACING, COLORS, TYPOGRAPHY, SERIF, withAlpha } from '../utils/theme';
import Icon from './Icon';

const { width: SCREEN_W } = Dimensions.get('window');

const HEAT_ICONS = {
  1: 'heart-outline',
  2: 'sparkles-outline',
  3: 'flame-outline',
};

const HEAT_LABELS = {
  1: 'Gentle',
  2: 'Warm',
  3: 'Heated',
};

const MOOD_ICONS = {
  intimate: 'moon-outline',
  tender: 'heart-outline',
  curious: 'compass-outline',
  protective: 'shield-outline',
  playful: 'happy-outline',
  meditative: 'leaf-outline',
  freeform: 'infinite-outline',
  devoted: 'star-outline',
  grounding: 'earth-outline',
  magnetic: 'magnet-outline',
  exploratory: 'search-outline',
  cozy: 'home-outline',
  soothing: 'water-outline',
  flowing: 'git-merge-outline',
  healing: 'bandage-outline',
  fluid: 'swap-horizontal-outline',
  warm: 'sunny-outline',
  intense: 'flash-outline',
  peaceful: 'cloudy-night-outline',
};

const VARIANT_OPTIONS = [
  { key: 'him-her', label: 'Him & Her', icon: 'heart-outline' },
  { key: 'her-her', label: 'Her & Her', icon: 'heart-outline' },
  { key: 'him-him', label: 'Him & Him', icon: 'heart-outline' },
];

const BODY_TYPE_OPTIONS = [
  { key: 'average', label: 'Average' },
  { key: 'curvy', label: 'Curvy' },
  { key: 'athletic', label: 'Athletic' },
  { key: 'slim', label: 'Slim' },
  { key: 'plus', label: 'Plus' },
];

// Color mapping per variant — which figure gets which color
const getIllustrationColors = (variant, colors) => {
  const sexyRed = colors.primary || '#D2121A';
  const deepCrimson = colors.primaryMuted || '#900C0F';
  const silver = 'rgba(229,229,231,0.55)';
  const silverLight = 'rgba(229,229,231,0.35)';

  switch (variant) {
    case 'her-her': return { figureA: sexyRed, figureB: deepCrimson };
    case 'him-him': return { figureA: silver, figureB: silverLight };
    case 'him-her':
    default:        return { figureA: silver, figureB: sexyRed };
  }
};

const FONTS = {
  serif: Platform.select({
    ios: 'DMSerifDisplay-Regular',
    android: 'DMSerifDisplay_400Regular',
    default: 'serif',
  }),
  body: Platform.select({
    ios: 'Lato-Regular',
    android: 'Lato_400Regular',
    default: 'sans-serif',
  }),
  bodyBold: Platform.select({
    ios: 'Lato-Bold',
    android: 'Lato_700Bold',
    default: 'sans-serif',
  }),
};

export default function IntimacyPositionCard({ position, defaultVariant = 'him-her', defaultBodyType = 'average', IllustrationSvg, getIllustrationForBodyType }) {
  const [activeVariant, setActiveVariant] = useState(defaultVariant);
  const [activeBodyType, setActiveBodyType] = useState(defaultBodyType);
  const { colors, isDark } = useTheme();
  const illustrationColors = useMemo(() => getIllustrationColors(activeVariant, colors), [activeVariant, colors]);
  const ActiveIllustration = useMemo(() => {
    if (getIllustrationForBodyType) return getIllustrationForBodyType(position.id, activeVariant, activeBodyType);
    return IllustrationSvg || null;
  }, [getIllustrationForBodyType, IllustrationSvg, position.id, activeVariant, activeBodyType]);

  const t = useMemo(() => ({
    bg: isDark ? 'rgba(19, 16, 22, 0.75)' : 'rgba(255, 255, 255, 0.7)',
    border: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
    borderSubtle: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
    primary: colors.primary || '#D2121A',
    primaryMuted: colors.primaryMuted || '#900C0F',
    text: colors.text || '#FFFFFF',
    textSecondary: colors.textSecondary || 'rgba(255,255,255,0.78)',
    textMuted: colors.textMuted || 'rgba(255,255,255,0.48)',
  }), [colors, isDark]);

  const heat = position.heat || 1;
  const heatIcon = HEAT_ICONS[heat] || 'heart-outline';
  const heatLabel = HEAT_LABELS[heat] || 'Gentle';
  const moodIcon = MOOD_ICONS[position.mood] || 'ellipse-outline';
  const variantSetup = position.variants?.[activeVariant] || position.setup;

  return (
    <Animated.View entering={FadeInDown.duration(500).damping(20)} style={styles.wrapper}>
      {/* Section eyebrow */}
      <Text style={[styles.kicker, { color: withAlpha(t.primary, 0.8) }]}>
        INTIMACY BUILDING
      </Text>

      {/* Title */}
      <Text style={[styles.title, { color: t.text, fontFamily: FONTS.serif }]}>
        {position.title}
      </Text>

      {/* Glass card */}
      <BlurView intensity={isDark ? 25 : 45} tint="dark" style={styles.glassOuter}>
        <View style={[styles.glassInner, { backgroundColor: t.bg, borderColor: t.border }]}>

          {/* Couple variant selector */}
          <View style={styles.variantRow}>
            {VARIANT_OPTIONS.map(v => {
              const isActive = activeVariant === v.key;
              return (
                <TouchableOpacity
                  key={v.key}
                  onPress={() => setActiveVariant(v.key)}
                  activeOpacity={0.7}
                  style={[
                    styles.variantPill,
                    {
                      backgroundColor: isActive ? withAlpha(t.primary, 0.15) : 'transparent',
                      borderColor: isActive ? withAlpha(t.primary, 0.3) : t.borderSubtle,
                    },
                  ]}
                >
                  <Text style={[styles.variantText, { color: isActive ? t.primary : t.textMuted }]}>
                    {v.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* SVG illustration — colors based on variant */}
          {ActiveIllustration ? (
            <View style={styles.illustrationWrap}>
              <ActiveIllustration
                width="100%"
                height={200}
                figureAColor={illustrationColors.figureA}
                figureBColor={illustrationColors.figureB}
              />
            </View>
          ) : (
            <View style={[styles.illustrationPlaceholder, { backgroundColor: withAlpha(t.primary, 0.04), borderColor: t.borderSubtle }]}>
              <Icon name="image-outline" size={28} color={t.textMuted} />
              <Text style={[styles.placeholderText, { color: t.textMuted }]}>Silhouette illustration</Text>
            </View>
          )}

          {/* Body type selector */}
          <View style={styles.bodyTypeRow}>
            {BODY_TYPE_OPTIONS.map(bt => {
              const isActive = activeBodyType === bt.key;
              return (
                <TouchableOpacity
                  key={bt.key}
                  onPress={() => setActiveBodyType(bt.key)}
                  activeOpacity={0.7}
                  style={[
                    styles.bodyTypePill,
                    {
                      backgroundColor: isActive ? withAlpha(t.primary, 0.12) : 'transparent',
                      borderColor: isActive ? withAlpha(t.primary, 0.25) : t.borderSubtle,
                    },
                  ]}
                >
                  <Text style={[styles.bodyTypeText, { color: isActive ? t.primary : t.textMuted }]}>
                    {bt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Tags row */}
          <View style={styles.tagRow}>
            <View style={[styles.tag, { backgroundColor: withAlpha(t.primary, 0.12) }]}>
              <Icon name={heatIcon} size={13} color={t.primary} />
              <Text style={[styles.tagText, { color: t.primary }]}>{heatLabel}</Text>
            </View>
            <View style={[styles.tag, styles.tagOutline, { borderColor: t.borderSubtle }]}>
              <Text style={[styles.tagText, { color: t.textMuted }]}>{position.duration}</Text>
            </View>
            {position.mood && (
              <View style={[styles.tag, styles.tagOutline, { borderColor: t.borderSubtle }]}>
                <Icon name={moodIcon} size={13} color={t.textMuted} />
                <Text style={[styles.tagText, { color: t.textMuted }]}>
                  {position.mood.charAt(0).toUpperCase() + position.mood.slice(1)}
                </Text>
              </View>
            )}
          </View>

          {/* The Focus */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: t.textMuted }]}>THE FOCUS</Text>
            <Text style={[styles.bodyText, { color: t.textSecondary }]}>
              {position.focus}
            </Text>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: t.borderSubtle }]} />

          {/* The Setup — variant-specific */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: t.textMuted }]}>THE SETUP</Text>
            <Text style={[styles.bodyText, { color: t.textSecondary }]}>
              {variantSetup}
            </Text>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: t.borderSubtle }]} />

          {/* Why It Works */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: t.textMuted }]}>WHY IT WORKS</Text>
            <Text style={[styles.bodyText, { color: t.textSecondary }]}>
              {position.whyItWorks}
            </Text>
          </View>

          {/* Accessibility note */}
          {position.accessibility && (
            <View style={[styles.accessibilityBadge, { backgroundColor: withAlpha(t.primary, 0.06), borderColor: t.borderSubtle }]}>
              <Icon name="accessibility-outline" size={14} color={t.textMuted} />
              <Text style={[styles.accessibilityText, { color: t.textMuted }]}>
                {position.accessibility === 'low-mobility' ? 'Low mobility friendly' :
                 position.accessibility === 'active' ? 'Some movement required' : 'Standard comfort'}
              </Text>
            </View>
          )}
        </View>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: SPACING.section,
    paddingHorizontal: SPACING.screen,
  },
  kicker: {
    fontFamily: Platform.select({ ios: 'Lato-Bold', android: 'Lato_700Bold', default: 'sans-serif' }),
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: 32,
    fontWeight: '400',
    letterSpacing: -0.5,
    lineHeight: 38,
    marginBottom: SPACING.lg,
  },
  glassOuter: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  glassInner: {
    borderRadius: 20,
    borderWidth: 1,
    padding: SPACING.xl,
  },
  variantRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  variantPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
  },
  variantText: {
    fontFamily: Platform.select({ ios: 'Lato-Bold', android: 'Lato_700Bold', default: 'sans-serif' }),
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  illustrationWrap: {
    width: '100%',
    height: 200,
    marginBottom: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  placeholderText: {
    fontFamily: Platform.select({ ios: 'Lato-Regular', android: 'Lato_400Regular', default: 'sans-serif' }),
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  tagOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  tagText: {
    fontFamily: Platform.select({ ios: 'Lato-Bold', android: 'Lato_700Bold', default: 'sans-serif' }),
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionLabel: {
    fontFamily: Platform.select({ ios: 'Lato-Bold', android: 'Lato_700Bold', default: 'sans-serif' }),
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  bodyText: {
    fontFamily: Platform.select({ ios: 'Lato-Regular', android: 'Lato_400Regular', default: 'sans-serif' }),
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 24,
    letterSpacing: 0.1,
  },
  divider: {
    height: 1,
    marginVertical: SPACING.lg,
  },
  accessibilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: SPACING.sm,
    alignSelf: 'flex-start',
  },
  accessibilityText: {
    fontFamily: Platform.select({ ios: 'Lato-Regular', android: 'Lato_400Regular', default: 'sans-serif' }),
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  bodyTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: SPACING.xl,
  },
  bodyTypePill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  bodyTypeText: {
    fontFamily: Platform.select({ ios: 'Lato-Bold', android: 'Lato_700Bold', default: 'sans-serif' }),
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
