/**
 * IntimacyPositionCard — Premium intimacy building card
 * Velvet Glass surface with editorial typography.
 * Displays a single position from content/intimacy-positions.json.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
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
  passionate: 'flame-outline',
  surrendered: 'bed-outline',
};

const VARIANT_OPTIONS = [
  { key: 'him-her', label: 'Him & Her', icon: 'heart-outline' },
  { key: 'her-her', label: 'Her & Her', icon: 'heart-outline' },
  { key: 'him-him', label: 'Him & Him', icon: 'heart-outline' },
];

const BODY_TYPE_OPTIONS = [
  { key: 'standard', label: 'Standard' },
  { key: 'support', label: 'More Support' },
];

const POSITION_SUPPORT_TIPS = {
  ip001: 'If sitting cross-legged puts pressure on the knees or hips, try sitting on a folded pillow or blanket to raise the hips slightly. This opens the pelvis and makes it easier to hold the position without strain. The partner on top can lean forward to rest more weight through their own legs.',
  ip002: 'The dramatic back arch can create tension through the lower back and neck. If lower back discomfort builds, reduce the arch and let the front partner rest more of their weight against the sitting partner\'s chest rather than fully extending. A pillow behind the sitting partner\'s lower back gives firm support to brace against.',
  ip003: 'If the knee angle feels uncomfortable, lean forward and rest your hands on your partner\'s shins or the bed rather than riding fully upright. This shortens the range of motion and takes weight off the knees. A pillow behind the knees of the partner lying down can also ease the hip angle.',
  ip004: 'If wrist or elbow pressure builds, lower down onto forearms instead of hands. A pillow under the stomach of the receiving partner raises the hips slightly, reducing the forward lean needed. If knee discomfort is the issue, kneel on a folded blanket or a pillow.',
  ip005: 'The reverse tabletop position puts load through the wrists and shoulders of the bottom partner. If wrist discomfort builds, try propping up on fists or place a folded blanket under the hands. The top partner can lean slightly forward to shift weight off the wrists. Shorter rounds let both partners shake out between sets.',
  ip006: 'If breathing feels compressed, try turning the head to the side and letting it rest on a pillow rather than being fully face-down. A pillow under the chest — not just the hips — opens the airway and softens the feeling of weight. Widening the legs slightly also reduces stomach compression.',
  ip007: 'The bottom partner is already on forearms, which is a stable low position. A folded blanket under the knees of both partners reduces hard-floor pressure significantly. The top partner can place their hands on either side of the bottom partner for stability, and moving more slowly reduces the effort needed to hold alignment from above.'
  ip008: 'If the knee angle makes staying upright difficult, lean forward and rest your hands on your partner\'s chest or the bed. This shifts weight forward and takes pressure off the knees. Your partner can also bend their knees up slightly to give you a surface to brace against.',
  ip009: 'A thin pillow under the lying partner\'s stomach can tilt the hips into a more comfortable angle. The kneeling partner can ease their weight forward gradually rather than all at once, and placing their hands or forearms on either side of their partner distributes pressure so no one spot takes the full load.'
  ip010: 'If the partner on top struggles to hold their weight on forearms, try dropping fully chest-to-chest and moving more slowly. A pillow under the receiving partner\'s lower back or hips tilts the pelvis up slightly, making the angle easier for both.',
  ip011: 'The lifting partner should keep their back straight and bend at the knees rather than the waist when taking on their partner\'s weight. Stepping close to a wall and leaning back into it lets the wall share the load. The lifted partner can loosen their grip slightly and let their weight settle low — squeezing too hard makes it harder to hold.',
  ip012: 'A folded blanket under the knees of both partners softens the surface pressure. If raising the leg straight up creates hip or groin strain, lower it to a comfortable angle — even 45 degrees still shifts the sensation significantly. The kneeling partner should hold the leg at the ankle or calf rather than the foot for better control.',
  ip013: 'A pillow under the hips at the bed edge helps maintain the angle and reduces lower back strain. The lying partner can bend their elbows slightly rather than reaching all the way to the floor, or place a bolster beneath their hanging upper body. The standing partner stepping slightly closer reduces the reach needed to hold the hips steady.'
  ip014: 'If the lifted partner\'s thighs fatigue from squeezing, loosen the leg grip and let the arms carry more of the weight instead. The standing partner can bend their knees slightly to lower both bodies, which transfers more weight through their legs rather than their arms and back. Doing this near a wall gives a natural place to rest between moments.',
  ip015: 'If elbow or shoulder pressure builds on the forearms, slide a folded pillow under the forearms to cushion the surface. The receiving partner can also widen their knees slightly to lower the hips closer to the bed, reducing how much the behind partner needs to angle down. Moving more slowly reduces the need to hold the position rigidly.',
  ip016: 'If lower back support is needed for the leaning-back partner, place a firm pillow or folded blanket behind the lower back before settling in. The reclining partner can shift their angle slightly — more on their side vs. more on their back — to find the most comfortable position for both. Moving in smaller, slower rhythms reduces the effort needed to maintain the angle.',
  ip017: 'If wrist pressure builds quickly, lower down onto forearms on the surface rather than hands. A lower surface — like the bed edge — is usually easier than a higher counter. If lower back strain develops, bend the knees slightly and soften the arch rather than staying fully straight.',
  ip018: 'The sitting partner can slide back so more of their thigh is supported on the bed, reducing hip flexor tension. The kneeling partner can place a folded blanket under their knees. There\'s no need to hold a particular leg position — feet can rest on the kneeling partner\'s shoulders or stay relaxed.',
  ip019: 'If the chair digs into the back of the thighs, use a softer surface or add a folded blanket to the seat. The straddling partner can lean slightly forward to shift weight through their own legs rather than bearing it all through the knees. A lower seat height generally makes this position more comfortable.',
  ip020: 'If hip flexor or lower back tension builds during side-lying, place a pillow between the knees to keep the hips stacked and the spine neutral. Reducing how far the thigh is raised also reduces the stretch required. Rolling slightly onto the back — just 20–30 degrees — can immediately relieve pressure.',
};

function getBodyTypeSupport(activeBodyType, position) {
  if (activeBodyType !== 'support') return null;

  const id = position?.id;
  const tip = POSITION_SUPPORT_TIPS[id] || 'Use pillows, wedges, or the edge of the bed to create more space and a better angle. Take pressure off knees, hips, or stomach by widening your base and letting support do more of the work.';

  return {
    title: 'Comfort tip',
    body: tip,
  };
}

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

export default function IntimacyPositionCard({ position, defaultVariant = 'him-her', defaultBodyType = 'standard', IllustrationSvg, getIllustrationForBodyType }) {
  const [activeVariant, setActiveVariant] = useState(defaultVariant);
  const [activeBodyType, setActiveBodyType] = useState(defaultBodyType);
  const { colors, isDark } = useTheme();
  const illustrationColors = useMemo(() => getIllustrationColors(activeVariant, colors), [activeVariant, colors]);
  const ActiveIllustration = useMemo(() => {
    if (getIllustrationForBodyType) return getIllustrationForBodyType(position.id, activeVariant, activeBodyType);
    return IllustrationSvg || null;
  }, [getIllustrationForBodyType, IllustrationSvg, position.id, activeVariant, activeBodyType]);
  const isImageIllustration = typeof ActiveIllustration === 'number';

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
  const bodyTypeSupport = useMemo(
    () => getBodyTypeSupport(activeBodyType, position),
    [activeBodyType, position]
  );

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
      {position.commonName ? (
        <Text style={[styles.commonName, { color: withAlpha(t.text, 0.5) }]}>
          {position.commonName}
        </Text>
      ) : null}

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

          {/* Illustration — PNG preferred, SVG fallback */}
          {ActiveIllustration ? (
            <View style={styles.illustrationWrap}>
              {isImageIllustration ? (
                <Image
                  source={ActiveIllustration}
                  resizeMode="contain"
                  style={styles.illustrationImage}
                />
              ) : (
                <ActiveIllustration
                  width="100%"
                  height={200}
                  figureAColor={illustrationColors.figureA}
                  figureBColor={illustrationColors.figureB}
                />
              )}
            </View>
          ) : null}

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

          {bodyTypeSupport && (
            <>
              <View style={[styles.divider, { backgroundColor: t.borderSubtle }]} />

              <View style={[styles.supportCard, { backgroundColor: withAlpha(t.primary, 0.06), borderColor: t.borderSubtle }]}>
                <View style={styles.supportHeader}>
                  <Icon name="heart-circle-outline" size={16} color={t.primary} />
                  <Text style={[styles.supportTitle, { color: t.primary }]}>{bodyTypeSupport.title}</Text>
                </View>
                <Text style={[styles.supportBody, { color: t.textSecondary }]}>
                  {bodyTypeSupport.body}
                </Text>
              </View>
            </>
          )}

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
    marginBottom: SPACING.xs,
  },
  commonName: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: SPACING.lg,
    opacity: 0.45,
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
  illustrationImage: {
    width: '100%',
    height: 200,
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
  supportCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  supportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  supportTitle: {
    fontFamily: Platform.select({ ios: 'Lato-Bold', android: 'Lato_700Bold', default: 'sans-serif' }),
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  supportBody: {
    fontFamily: Platform.select({ ios: 'Lato-Regular', android: 'Lato_400Regular', default: 'sans-serif' }),
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '400',
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
