/**
 * IntimacyPositionCard — Premium Velvet Glass Format
 * Sleek segmented controls, grouped actions, balanced typography.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
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
  ip001: 'This position is usually most comfortable when the seated partner has enough back, hip, and leg support to stay relaxed. Sitting against a headboard, couch arm, wall, or sturdy cushion can help a lot. If the hips feel tight, loosen the leg wrap slightly or place a pillow underneath for height and support.',
  ip002: 'Hip openness and lower-back support matter here. If the seated position starts to feel tiring, sit against a headboard, wall, or sturdy cushion so the body can relax into it more easily. This one usually feels best when both partners are supported enough to stay soft.',
  ip003: 'If the foot placement on the chest feels too intense, lower it slightly or reduce pressure until it feels stable. The partner underneath may want a pillow beneath the head for support, and the top partner should keep some softness in the knees and ankles rather than locking the joints.',
  ip004: 'Knees, wrists, and lower back usually matter most here. A pillow under the knees can help a lot, and lowering to the forearms can reduce wrist strain. If the lower back starts to feel overworked, soften the arch and bring the torso closer to the bed.',
  ip005: 'A padded surface helps, since both partners are taking some weight through their hands and wrists. If the hamstrings or hips feel too tight, soften the bend in the extended leg or reduce the lean until the shape feels sustainable.',
  ip006: 'This one can put extra work into the top partner\'s thighs and knees, so support matters. A pillow under the lower partner\'s hips can change the angle in a helpful way, and the top partner may want to use their hands more for balance to reduce tension in the legs. It usually feels best when the top partner stays active but not rigid.',
  ip007: 'If the wrists or shoulders start to tire, place a pillow beneath the hands or raise the receiving partner slightly with extra cushion beneath the hips. The supporting partner may also want to come in closer to reduce strain and make the position feel more secure. This one works best when the body is supported, not forced.',
  ip008: 'This position can ask a lot from the top partner\'s thighs and knees over time, so comfort matters. A softer surface or pillow under the knees can help, and taking breaks by leaning forward or changing the rhythm can make it much easier to sustain. It usually feels best when the body stays active but not tense.',
  ip009: 'Neck, shoulders, and jaw can tire more quickly here than people expect. Pillows under the head, hips, or upper body can help a lot, and side-lying variations are often easier to sustain than stacked ones. If either partner feels crowded, strained, or distracted by the setup, pause and reset rather than trying to push through discomfort.',
  ip010: 'Hip flexibility matters here. If the legs-on-shoulders version feels too intense, lower the legs slightly or rest them more loosely against the upper arms instead. A pillow under the hips can also soften the angle and make the shape easier to hold without strain.',
  ip011: 'This one asks more from the supporting partner\'s legs, core, and grip, so it usually works best in shorter bursts rather than long stretches. A wall behind the lifted partner or a surface close by can make it far more comfortable and sustainable. If either person feels unstable, reset right away and use more support.',
  ip012: 'This one can put more demand on the lower back, hamstrings, wrists, and hips than it first appears. A soft surface under the hands or extra support beneath the hips can help. If the lifted-leg version feels too intense, lower the legs slightly or reduce the arch until the body can stay supported without strain.',
  ip013: 'Make sure the surface is stable and at a workable height. If the wrists or shoulders of the seated partner get tired, reduce the lean or place a pillow or folded blanket behind them for support. This one works best when the seated partner feels secure on the surface and the standing partner can stay close without overreaching.',
  ip014: 'This one asks more from balance, legs, and grip than it first appears. A wall, bed edge, or sturdy surface nearby can make a big difference. If the lifted partner feels unstable, bring the body closer in rather than leaning farther back. This position is usually best in shorter bursts unless there is strong support.',
  ip015: 'This one can be demanding on the wrists, shoulders, lower back, and thighs. It is usually best in shorter periods unless the partner in the bridge is already very comfortable in that shape. A padded surface under the hands and feet helps, and a modified version with the hips lowered slightly may feel better for many bodies.',
  ip016: 'Neck, jaw, and shoulder comfort matter most here. A pillow under the giving partner\'s chest can reduce strain, and support under the receiving partner\'s hips can improve the angle without asking either body to work harder. If either person starts feeling compressed or uncomfortable, reset the height before continuing.',
  ip017: 'If the wrists tire quickly, lower down onto forearms on whatever surface you\'re using. If the lower back starts to arch uncomfortably, soften the knees slightly and let the spine settle.',
  ip018: 'This one is usually easier on the wrists than classic doggy style, but hips, knees, and lower back can still matter. A pillow beneath the hips, stomach, or chest can help improve the angle and reduce compression. If the lower partner feels crowded or flattened, shift the torso slightly or change the bend in the leg until the shape feels softer and easier to hold.',
};

export default function IntimacyPositionCard({
  position,
  t,
  isDark,
  defaultBodyType = 'standard',
  isFavorite = false,
  onToggleFavorite,
  favoriteBusy = false,
  isTried = false,
  onToggleTried,
  triedBusy = false,
  rating = null,
  onRate,
  ratingBusy = false,
  compact = false,
}) {
  const [activeBodyType, setActiveBodyType] = useState(defaultBodyType);

  const heatIcon = HEAT_ICONS[position.heat || 1];
  const heatLabel = HEAT_LABELS[position.heat || 1];
  const moodIcon = MOOD_ICONS[position.mood] || 'ellipse-outline';
  
  const comfortBody = activeBodyType === 'support' ? (position.comfort || POSITION_SUPPORT_TIPS[position.id] || null) : null;

  const shadowStyle = Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.2 : 0.04, shadowRadius: 16 },
    android: { elevation: 2 },
  });

  return (
    <View style={[
      styles.heroCardWrap,
      compact && styles.heroCardWrapCompact,
      { backgroundColor: t.surface, borderColor: t.border, ...shadowStyle },
    ]}>

      {/* ── Eyebrow & Title ── */}
      <View style={styles.headerRow}>
        <View style={styles.eyebrowRow}>
          <Icon name="star-outline" size={14} color={t.primary} />
          <Text style={[styles.eyebrow, { color: t.primary }]} numberOfLines={1}>
            {position.commonName || "SEX POSITION"}
          </Text>
        </View>
      </View>
      <Text style={[styles.promptText, compact && styles.promptTextCompact, { color: t.text }]}>
        {position.title}
      </Text>

      {/* ── Grouped Control Panel: Actions & Ratings ── */}
      <View style={styles.controlPanel}>
        <View style={styles.actionRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? 'Remove sex position favorite' : 'Save sex position favorite'}
            activeOpacity={0.8}
            disabled={favoriteBusy || !onToggleFavorite}
            onPress={onToggleFavorite}
            style={[
              styles.actionButton,
              {
                backgroundColor: isFavorite ? t.primary : t.surfaceSecondary,
                borderColor: isFavorite ? t.primary : t.border,
              },
            ]}
          >
            <Icon name="heart-outline" size={16} color={isFavorite ? t.background : t.text} />
            <Text style={[styles.actionLabel, { color: isFavorite ? t.background : t.text }]}>
              {isFavorite ? 'Saved' : 'Save'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={isTried ? 'Remove tried position' : 'Mark position as tried'}
            activeOpacity={0.8}
            disabled={triedBusy || !onToggleTried}
            onPress={onToggleTried}
            style={[
              styles.actionButton,
              {
                backgroundColor: isTried ? t.text : t.surfaceSecondary,
                borderColor: isTried ? t.text : t.border,
              },
            ]}
          >
            <Icon name="checkmark-circle-outline" size={16} color={isTried ? t.background : t.text} />
            <Text style={[styles.actionLabel, { color: isTried ? t.background : t.text }]}>
              {isTried ? 'Tried' : 'Tried'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.ratingRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ selected: rating === 'up', disabled: ratingBusy }}
            accessibilityLabel={rating === 'up' ? 'Remove thumbs up for this position' : 'Thumbs up for this position'}
            activeOpacity={0.75}
            disabled={ratingBusy || !onRate}
            onPress={() => onRate?.('up')}
            style={[
              styles.ratingButton,
              { borderColor: rating === 'up' ? '#22C55E60' : t.border, backgroundColor: rating === 'up' ? '#22C55E20' : t.surfaceSecondary },
              ratingBusy && styles.disabledControl,
            ]}
          >
            <Icon name="thumbs-up-outline" size={18} color={rating === 'up' ? '#22C55E' : t.text} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ selected: rating === 'down', disabled: ratingBusy }}
            accessibilityLabel={rating === 'down' ? 'Remove thumbs down for this position' : 'Thumbs down for this position'}
            activeOpacity={0.75}
            disabled={ratingBusy || !onRate}
            onPress={() => onRate?.('down')}
            style={[
              styles.ratingButton,
              { borderColor: rating === 'down' ? '#EF444460' : t.border, backgroundColor: rating === 'down' ? '#EF444420' : t.surfaceSecondary },
              ratingBusy && styles.disabledControl,
            ]}
          >
            <Icon name="thumbs-down-outline" size={18} color={rating === 'down' ? '#EF4444' : t.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Sleek Segmented Control for Body Type ── */}
      <View style={[styles.segmentedControl, { backgroundColor: t.surfaceSecondary, borderColor: t.border }]}>
        {BODY_TYPE_OPTIONS.map(bt => {
          const isActive = activeBodyType === bt.key;
          return (
            <TouchableOpacity
              key={bt.key}
              onPress={() => setActiveBodyType(bt.key)}
              activeOpacity={0.7}
              style={[
                styles.segmentButton,
                isActive && { backgroundColor: t.text, ...shadowStyle }, // Added subtle shadow to the active thumb
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  compact && styles.segmentTextCompact,
                  { color: isActive ? t.background : t.subtext },
                ]}
                numberOfLines={1}
              >
                {bt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Refined Tags Row ── */}
      <View style={styles.tagRow}>
        {/* Tags removed per user request - Heated, min, intimate pills no longer shown */}
      </View>

      {/* ── Support Tip ── */}
      {comfortBody && (
        <View style={[styles.answerBubble, { backgroundColor: t.surfaceSecondary, borderColor: t.border }]}>
          <View style={styles.partnerVisibilityRow}>
            <Icon name="heart-circle-outline" size={16} color={t.primary} />
            <Text style={[styles.partnerVisibilityText, { color: t.primary }]}>A note on comfort</Text>
          </View>
          <Text style={[styles.answerText, { color: t.text }]}>{comfortBody}</Text>
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
    paddingHorizontal: SPACING.lg,
    paddingVertical: 18,
    marginBottom: 0,
  },
  heroCardWrapCompact: {
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8, // Tighter to title
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: systemFont,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8, // Pushed tracking for premium feel
    textTransform: 'none',
  },
  promptText: {
    fontFamily: systemFont,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    letterSpacing: -0.3,
    marginBottom: 20,
  },
  promptTextCompact: {
    fontSize: 20,
    lineHeight: 26,
  },
  controlPanel: {
    marginBottom: 22,
    gap: 14,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 46,
  },
  actionLabel: {
    fontFamily: systemFont,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    alignSelf: 'center',
  },
  ratingButton: {
    width: 46,
    height: 46,
    borderRadius: 100,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledControl: {
    opacity: 0.55,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 100,
    borderWidth: 1,
    padding: 3,
    marginBottom: 20,
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 100,
  },
  segmentText: {
    fontFamily: systemFont,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  segmentTextCompact: {
    fontSize: 11,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  tag: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 0,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 100,
    borderWidth: 1,
  },
  tagText: {
    fontFamily: systemFont,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  tagTextCompact: {
    fontSize: 11,
  },
  section: {
    marginBottom: SPACING.sm,
  },
  sectionLabel: {
    fontFamily: systemFont,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'none',
    marginBottom: 10,
  },
  answerText: {
    fontFamily: systemFont,
    fontSize: 16,
    lineHeight: 26,
    fontWeight: '400',
    letterSpacing: 0.15,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 24,
  },
  answerBubble: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  partnerVisibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  partnerVisibilityText: {
    fontFamily: systemFont,
    fontSize: 14,
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
