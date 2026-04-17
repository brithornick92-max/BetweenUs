/**
 * IntimacyPositionCard — Apple Editorial Format
 * Crisp solid widgets, heavy native typography, high contrast.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SPACING } from '../utils/theme';
import Icon from './Icon';

const systemFont = Platform.select({ ios: "System", android: "Roboto" });

const HEAT_ICONS = { 1: 'heart-outline', 2: 'sparkles-outline', 3: 'flame-outline', 4: 'flame-outline' };
const HEAT_LABELS = { 1: 'Gentle', 2: 'Warm', 3: 'Heated' };
const MOOD_ICONS = {
  intimate: 'moon-outline', tender: 'heart-outline', curious: 'compass-outline',
  playful: 'happy-outline', freeform: 'infinite-outline', devoted: 'star-outline',
  passionate: 'flame-outline', surrendered: 'bed-outline', cozy: 'home-outline',
};

const BODY_TYPE_OPTIONS = [
  { key: 'standard', label: 'Standard' },
  { key: 'support', label: 'More Support' },
];

const POSITION_SUPPORT_TIPS = {
  ip001: 'Tuck a folded blanket beneath the seated partner\'s hips to lift them gently and soften any strain through the knees. The arching partner can let their arms open wide — releasing into the position rather than holding it.',
  ip002: 'If the lower back begins to speak up, ease the arch and let the front partner settle back into their partner\'s chest — less open, more held. A pillow tucked behind the sitting partner\'s lower back gives them something solid to press into.',
  ip003: 'If the knee angle starts to bite, lean forward and let your hands rest on your partner\'s shins or the bed. That small shift shortens the range and takes the weight off.',
  ip004: 'If the wrists start to protest, slide down onto the forearms — the whole position softens from there. A pillow under the receiving partner\'s stomach lifts the hips just enough to ease the angle.',
  ip005: 'The lifted-hips position draws a lot through the wrists and shoulders. If pressure builds, try propping up on fists or sliding a folded blanket under the hands.',
  ip006: 'If breathing feels compressed, turn the head to one side and let it rest rather than pressing straight down. Widening the legs slightly gives the stomach more room to breathe.',
  ip007: 'A folded blanket under both sets of knees takes the hardness out of any surface. The top partner can rest their hands gently on either side for stability.',
  ip008: 'If staying upright feels like work, lean forward and let your hands rest on your partner\'s chest or the surface beside them — the weight shifts forward and the knees decompress immediately.',
  ip009: 'A thin pillow tucked under the lying partner\'s stomach can tilt the hips into a more open, comfortable angle. The partner above can ease their weight forward gradually.',
  ip010: 'If holding the weight on forearms becomes tiring, drop all the way down — chest to chest — and let the movement get smaller and slower.',
  ip011: 'The lifting partner keeps their back long and bends through the knees rather than the waist. A wall just behind them lets it share the load.',
  ip012: 'If lifting the leg fully creates tension through the hip or groin, lower it — even 45 degrees reshapes the sensation meaningfully. Hold the leg at the ankle or calf for control.',
  ip013: 'A pillow beneath the hips, right at the edge of the bed, keeps the angle and protects the lower back. The lying partner can bend their elbows slightly rather than reaching all the way to the floor.',
  ip014: 'If the thighs start to fatigue, loosen the leg grip and let the arms carry more — the position stays just as close. The standing partner can bend their knees slightly, lowering both bodies together.',
  ip015: 'If the forearms need more cushion, slide a folded pillow beneath them before you begin. The receiving partner widening their knees slightly lowers the hips toward the surface.',
  ip016: 'Before settling in, place a firm pillow behind the lower back of the reclining partner — it makes a quiet difference. Shifting slightly toward one side rather than full recline can find a sweeter angle.',
  ip017: 'If the wrists tire quickly, lower down onto forearms on whatever surface you\'re using. If the lower back starts to arch uncomfortably, soften the knees slightly and let the spine settle.',
};

export default function IntimacyPositionCard({ position, t, isDark, defaultBodyType = 'standard', IllustrationSvg, getIllustrationForBodyType }) {
  const [activeBodyType, setActiveBodyType] = useState(defaultBodyType);

  const getIllustrationColors = (variant) => {
    const primary = t.primary;
    const secondary = isDark ? '#4A4A4E' : '#D1D1D6';
    switch (variant) {
      case 'her-her': return { figureA: primary, figureB: primary };
      case 'him-him': return { figureA: secondary, figureB: secondary };
      case 'him-her':
      default:        return { figureA: secondary, figureB: primary };
    }
  };

  const illustrationColors = useMemo(() => getIllustrationColors('him-her'), [t, isDark]);
  const ActiveIllustration = useMemo(() => {
    if (getIllustrationForBodyType) return getIllustrationForBodyType(position.id, activeBodyType);
    return IllustrationSvg || null;
  }, [getIllustrationForBodyType, IllustrationSvg, position.id, activeBodyType]);

  const heatIcon = HEAT_ICONS[position.heat || 1];
  const heatLabel = HEAT_LABELS[position.heat || 1];
  const moodIcon = MOOD_ICONS[position.mood] || 'ellipse-outline';
  
  const tipBody = activeBodyType === 'support' ? POSITION_SUPPORT_TIPS[position.id] : null;

  const shadowStyle = Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: isDark ? 0.4 : 0.08, shadowRadius: 24 },
    android: { elevation: 6 },
  });

  return (
    <View style={[styles.heroCardWrap, { backgroundColor: t.surface, borderColor: t.border, ...shadowStyle }]}>
      
      {/* ── Eyebrow & Title ── */}
      <View style={styles.eyebrowRow}>
        <Icon name="star-outline" size={14} color={t.primary} />
        <Text style={[styles.eyebrow, { color: t.primary }]}>{position.commonName || "INTIMACY"}</Text>
      </View>
      <Text style={[styles.promptText, { color: t.text }]}>{position.title}</Text>

      {/* ── Illustration ── */}
      {ActiveIllustration && (
        <View style={[styles.illustrationWrap, { backgroundColor: t.surfaceSecondary, borderColor: t.border }]}>
          {typeof ActiveIllustration === 'number' ? (
            <Image source={ActiveIllustration} resizeMode="contain" style={styles.illustrationImage} />
          ) : (
            <ActiveIllustration width="100%" height={200} figureAColor={illustrationColors.figureA} figureBColor={illustrationColors.figureB} />
          )}
        </View>
      )}

      {/* ── Body Type Selector ── */}
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
                  backgroundColor: isActive ? t.text : t.surfaceSecondary,
                  borderColor: isActive ? t.text : t.border,
                },
              ]}
            >
              <Text style={[styles.bodyTypeText, { color: isActive ? t.background : t.subtext }]}>
                {bt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Tags ── */}
      <View style={styles.tagRow}>
        <View style={[styles.tag, { backgroundColor: isDark ? '#3A1015' : '#FCE8EA', borderColor: t.primary }]}>
          <Icon name={heatIcon} size={14} color={t.primary} />
          <Text style={[styles.tagText, { color: t.primary }]}>{heatLabel}</Text>
        </View>
        <View style={[styles.tag, { backgroundColor: t.surfaceSecondary, borderColor: t.border }]}>
          <Text style={[styles.tagText, { color: t.subtext }]}>{position.duration}</Text>
        </View>
        {position.mood && (
          <View style={[styles.tag, { backgroundColor: t.surfaceSecondary, borderColor: t.border }]}>
            <Icon name={moodIcon} size={14} color={t.subtext} />
            <Text style={[styles.tagText, { color: t.subtext }]}>
              {position.mood.charAt(0).toUpperCase() + position.mood.slice(1)}
            </Text>
          </View>
        )}
      </View>

      {/* ── Support Tip ── */}
      {tipBody && (
        <View style={[styles.answerBubble, { backgroundColor: t.surfaceSecondary, borderColor: t.border }]}>
          <View style={styles.partnerVisibilityRow}>
            <Icon name="heart-circle-outline" size={16} color={t.primary} />
            <Text style={[styles.partnerVisibilityText, { color: t.primary }]}>A note on comfort</Text>
          </View>
          <Text style={[styles.answerText, { color: t.text }]}>{tipBody}</Text>
        </View>
      )}

      {/* ── Content Sections ── */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: t.subtext }]}>THE FEELING</Text>
        <Text style={[styles.answerText, { color: t.text }]}>{position.focus}</Text>
      </View>

      <View style={[styles.divider, { backgroundColor: t.border }]} />

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: t.subtext }]}>THE PRACTICE</Text>
        <Text style={[styles.answerText, { color: t.text }]}>{position.howTo}</Text>
      </View>

      <View style={[styles.divider, { backgroundColor: t.border }]} />

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: t.subtext }]}>WHAT YOU'LL FEEL</Text>
        <Text style={[styles.answerText, { color: t.text }]}>{position.benefits}</Text>
      </View>

      {position.makeItHotter && (
        <>
          <View style={[styles.divider, { backgroundColor: t.border }]} />
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: t.primary }]}>TURN IT UP</Text>
            <Text style={[styles.answerText, { color: t.text }]}>{position.makeItHotter}</Text>
          </View>
        </>
      )}

      {/* ── Accessibility ── */}
      {position.accessibility && (
        <View style={styles.statusRow}>
          <Icon name="accessibility-outline" size={16} color={t.subtext} />
          <Text style={[styles.statusText, { color: t.subtext }]}>
            {position.accessibility === 'low-mobility' ? 'Gentle on the body' :
             position.accessibility === 'active' ? 'A little energy goes a long way' : 'Comfortable for most'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heroCardWrap: { 
    borderRadius: 24, 
    borderWidth: 1,
    padding: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  eyebrow: {
    fontFamily: systemFont,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  promptText: {
    fontFamily: systemFont,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    letterSpacing: -0.5,
    marginBottom: SPACING.lg,
  },
  illustrationWrap: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    overflow: 'hidden',
  },
  illustrationImage: {
    width: '100%',
    height: 200,
  },
  bodyTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: SPACING.lg,
  },
  bodyTypePill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  bodyTypeText: {
    fontFamily: systemFont,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.xl,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  tagText: {
    fontFamily: systemFont,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  section: {
    marginBottom: 8,
  },
  sectionLabel: {
    fontFamily: systemFont,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  answerText: {
    fontFamily: systemFont,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '400',
  },
  divider: {
    height: 1,
    marginVertical: SPACING.lg,
  },
  answerBubble: {
    borderRadius: 20,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  partnerVisibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  partnerVisibilityText: {
    fontFamily: systemFont,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xl,
    gap: 8,
  },
  statusText: {
    fontFamily: systemFont,
    fontSize: 14,
    fontWeight: '600',
  },
});
