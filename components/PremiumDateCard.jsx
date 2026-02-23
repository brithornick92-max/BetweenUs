import React, { useMemo } from 'react';
import { StyleSheet, Text, View, Pressable, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { TYPOGRAPHY } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { getDimensionMeta } from '../utils/contentLoader';

const { width } = Dimensions.get('window');

const DIMS = getDimensionMeta();

const PremiumDateCard = ({
  title,
  duration,
  description,
  heat,
  load,
  style: dateStyle,
  _matchLabel,
  minutes,
  steps,
  onPress,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scale = useSharedValue(1);

  // Build dimension badges from heat + load
  const heatMeta = useMemo(() => {
    return DIMS.heat.find(h => h.level === heat) || DIMS.heat[0];
  }, [heat]);

  const loadMeta = useMemo(() => {
    return DIMS.load.find(l => l.level === load) || DIMS.load[1];
  }, [load]);

  const durationText = useMemo(() => {
    if (duration) return duration;
    if (typeof minutes === 'number') return `${minutes} min`;
    return minutes ? String(minutes) : '';
  }, [duration, minutes]);

  const descriptionText = useMemo(() => {
    if (description) return description;
    if (Array.isArray(steps) && steps.length > 0) return steps[0];
    return '';
  }, [description, steps]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Pressable 
        onPress={onPress}
        onPressIn={handlePressIn} 
        onPressOut={handlePressOut}
        style={styles.pressable}
      >
        <BlurView intensity={20} tint={colors.background === '#F8F5F3' ? 'light' : 'dark'} style={styles.blurContainer}>
          <View style={styles.badgeRow}>
            <View style={[styles.badgePill, { borderColor: heatMeta.color + '50' }]}>
              <Text style={[styles.categoryText, { color: heatMeta.color }]}>{heatMeta.icon} {heatMeta.label.toUpperCase()}</Text>
            </View>
            <View style={[styles.badgePill, { borderColor: loadMeta.color + '50' }]}>
              <Text style={[styles.categoryText, { color: loadMeta.color }]}>{loadMeta.icon} {loadMeta.label.toUpperCase()}</Text>
            </View>
            {_matchLabel ? (
              <View style={[styles.badgePill, { borderColor: '#C9A84C50' }]}>
                <Text style={[styles.categoryText, { color: '#C9A84C' }]}>{_matchLabel}</Text>
              </View>
            ) : null}
          </View>
          {!!durationText && <Text style={styles.durationText}>{durationText}</Text>}
          
          <Text style={styles.titleText}>{title}</Text>
          {!!descriptionText && <Text style={styles.descriptionText}>{descriptionText}</Text>}
          
          <View style={styles.footer}>
            <View style={styles.premiumButton}>
              <Text style={styles.buttonText}>Experience Tonight</Text>
            </View>
          </View>
        </BlurView>
      </Pressable>
    </Animated.View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    width: width - 40,
    marginVertical: 14,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressable: {
    flex: 1,
  },
  blurContainer: {
    padding: 24,
    paddingBottom: 28,
    backgroundColor: colors.surface,
    gap: 6,
  },
  categoryText: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  durationText: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  titleText: {
    color: colors.text,
    fontSize: 24,
    fontFamily: TYPOGRAPHY?.serif || 'System',
    fontWeight: '300',
    marginBottom: 8,
    letterSpacing: -0.2,
    lineHeight: 31,
  },
  descriptionText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 24,
    opacity: 0.85,
  },
  premiumButton: {
    backgroundColor: colors.surface2,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  footer: {},
});

export default PremiumDateCard;
