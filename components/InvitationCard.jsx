// components/InvitationCard.jsx — Gentle connection invitation
// Brand-aligned replacement for ChallengeCard
// Sexy Red Intimacy & Apple Editorial Updates Integrated.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Card from './Card';
import Icon from './Icon';
import { SPACING, withAlpha } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

/**
 * InvitationCard — A warm invitation for couples to connect.
 *
 * Replaces ChallengeCard with brand-aligned design:
 * - No difficulty levels
 * - No points / rewards
 * - Warm, editorial system typography
 */
export default function InvitationCard({
  challenge,
  onPress = null,
  onAccept = null,
  compact = false,
  style,
}) {
  const { colors, isDark } = useTheme();

  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    surfaceSecondary: isDark ? '#2C2C2E' : '#F2F2F7',
    primary: colors.primary || '#D2121A', // Sexy Red
    text: colors.text,
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  const getTypeIcon = (type) => {
    const icons = {
      daily: 'moon-outline',
      weekly: 'sparkles-outline',
      monthly: 'heart-outline',
      special: 'flame-outline',
      exploration: 'compass-outline',
    };
    return icons[type] || 'heart-outline';
  };

  const getTimeRemaining = (expiresAt) => {
    if (!expiresAt) return null;
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) return null;
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return 'soon';
  };

  const typeIconName = getTypeIcon(challenge?.type);
  const isComplete = challenge?.status === 'completed';
  const isExpired = challenge?.expiresAt < Date.now();
  const timeLeft = getTimeRemaining(challenge?.expiresAt);

  if (compact) {
    return (
      <Card
        variant="glass"
        padding="sm"
        onPress={onPress}
        style={[styles.compactCard, style]}
        accessibilityRole="button"
        accessibilityLabel={challenge?.name || 'Connection invitation'}
      >
        <View style={styles.compactContent}>
          <Icon name={typeIconName} size={20} color={t.primary} />
          <Text style={[styles.compactTitle, { color: t.text }]} numberOfLines={1}>
            {challenge?.name}
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <Card
      variant={isComplete ? 'elevated' : 'glass'}
      padding="md"
      onPress={onPress}
      style={[styles.card, isExpired && styles.expiredCard, style]}
      accessibilityRole="button"
    >
      <Animated.View entering={FadeInDown.duration(600).springify().damping(18)} style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconBox, { backgroundColor: withAlpha(t.primary, 0.12) }]}>
            <Icon name={typeIconName} size={22} color={t.primary} />
          </View>
          <View style={styles.headerInfo}>
            <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
              {challenge?.name}
            </Text>
            {timeLeft && !isComplete && !isExpired && (
              <Text style={[styles.timeHint, { color: t.subtext }]}>{timeLeft} remaining</Text>
            )}
          </View>
          {isComplete && <Icon name="checkmark-circle" size={22} color={t.primary} />}
        </View>

        {/* Description */}
        {challenge?.description && (
          <Text style={[styles.description, { color: t.subtext }]} numberOfLines={2}>
            {challenge.description}
          </Text>
        )}

        {/* State Banners */}
        {isComplete && (
          <View style={[styles.completeBanner, { backgroundColor: withAlpha(t.primary, 0.08) }]}>
            <Text style={[styles.completeText, { color: t.primary }]}>Beautifully done</Text>
          </View>
        )}

        {isExpired && !isComplete && (
          <View style={[styles.expiredBanner, { backgroundColor: withAlpha(t.text, 0.05) }]}>
            <Text style={[styles.expiredText, { color: t.subtext }]}>This invitation has passed</Text>
          </View>
        )}

        {/* Action Button */}
        {onAccept && challenge?.status === 'available' && !isExpired && (
          <Animated.View entering={FadeIn.delay(300).duration(400)}>
            <TouchableOpacity
              style={[styles.acceptButton, { backgroundColor: t.primary }]}
              onPress={onAccept}
              activeOpacity={0.9}
            >
              <Text style={styles.acceptText}>Begin</Text>
              <Icon name="arrow-forward" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </Animated.View>
        )}
      </Animated.View>
    </Card>
  );
}

export { InvitationCard as ChallengeCard };

const createStyles = (t, isDark) =>
  StyleSheet.create({
    card: { 
      marginVertical: SPACING.sm,
      borderRadius: 24, // Deep Apple Squircle
      borderWidth: 1,
      borderColor: t.border,
    },
    expiredCard: { opacity: 0.5 },
    content: { width: '100%', paddingVertical: 4 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    headerInfo: { flex: 1 },
    title: {
      fontFamily: SYSTEM_FONT,
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    timeHint: {
      fontFamily: SYSTEM_FONT,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    },
    description: {
      fontFamily: SYSTEM_FONT,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '400',
      marginBottom: SPACING.lg,
      paddingHorizontal: 2,
    },
    completeBanner: {
      paddingVertical: 10,
      borderRadius: 16,
      alignItems: 'center',
    },
    completeText: {
      fontFamily: SYSTEM_FONT,
      fontSize: 14,
      fontWeight: '700',
      fontStyle: 'italic',
    },
    expiredBanner: {
      paddingVertical: 10,
      borderRadius: 16,
      alignItems: 'center',
    },
    expiredText: {
      fontFamily: SYSTEM_FONT,
      fontSize: 13,
      fontWeight: '600',
    },
    acceptButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 44,
      borderRadius: 22, // Pill shape
      paddingHorizontal: 20,
      alignSelf: 'flex-end',
      marginTop: SPACING.sm,
      gap: 6,
    },
    acceptText: {
      fontFamily: SYSTEM_FONT,
      fontSize: 15,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.2,
      textTransform: 'uppercase',
    },
    // Compact View
    compactCard: { 
      marginVertical: SPACING.xs,
      borderRadius: 16,
    },
    compactContent: { 
      flexDirection: 'row', 
      alignItems: 'center',
      paddingHorizontal: SPACING.sm,
      gap: 12,
    },
    compactTitle: {
      fontFamily: SYSTEM_FONT,
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: -0.2,
      flex: 1,
    },
  });
  