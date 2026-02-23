// components/InvitationCard.jsx — Gentle connection invitation
// Brand-aligned replacement for ChallengeCard
// No difficulty levels, no points, no score — just an invitation to connect.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Card from './Card';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY, withAlpha } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';

/**
 * InvitationCard — A warm invitation for couples to connect.
 *
 * Replaces ChallengeCard with brand-aligned design:
 * - No difficulty levels
 * - No points / rewards
 * - No competitive progress tracking
 * - Warm, present language
 *
 * Props are backward-compatible with ChallengeCard.
 */
export default function InvitationCard({
  challenge,
  onPress = null,
  onAccept = null,
  compact = false,
  style,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const getTypeIcon = (type) => {
    const icons = {
      daily: '🌙',
      weekly: '✨',
      monthly: '💛',
      special: '🕯️',
      exploration: '🌿',
    };
    return icons[type] || '💛';
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

  const typeIcon = getTypeIcon(challenge?.type);
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
          <Text style={styles.compactIcon}>{typeIcon}</Text>
          <Text style={styles.compactTitle} numberOfLines={1}>
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
      accessibilityLabel={`${challenge?.name || 'Invitation'}${isComplete ? ', completed' : ''}${isExpired ? ', passed' : ''}`}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.typeIcon}>{typeIcon}</Text>
          <View style={styles.headerInfo}>
            <Text style={styles.title} numberOfLines={1}>
              {challenge?.name}
            </Text>
            {timeLeft && !isComplete && !isExpired && (
              <Text style={styles.timeHint}>{timeLeft} remaining</Text>
            )}
          </View>
          {isComplete && <Text style={styles.completeIcon}>✨</Text>}
        </View>

        {/* Description */}
        {challenge?.description && (
          <Text style={styles.description} numberOfLines={2}>
            {challenge.description}
          </Text>
        )}

        {/* Accept / Complete states */}
        {isComplete && (
          <View style={styles.completeBanner}>
            <Text style={styles.completeText}>Beautifully done</Text>
          </View>
        )}

        {isExpired && !isComplete && (
          <View style={styles.expiredBanner}>
            <Text style={styles.expiredText}>This invitation has passed</Text>
          </View>
        )}

        {onAccept && challenge?.status === 'available' && !isExpired && (
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={onAccept}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Begin ${challenge?.name || 'invitation'}`}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryMuted]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.acceptGradient}
            >
              <Text style={styles.acceptText}>Begin</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );
}

// Backward-compatible alias
export { InvitationCard as ChallengeCard };

const createStyles = (colors) =>
  StyleSheet.create({
    card: { marginVertical: SPACING.xs },
    expiredCard: { opacity: 0.55 },
    content: { width: '100%' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    typeIcon: { fontSize: 28, marginRight: SPACING.sm },
    headerInfo: { flex: 1 },
    title: {
      ...TYPOGRAPHY.h3,
      color: colors.text,
    },
    timeHint: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      marginTop: 2,
    },
    completeIcon: { fontSize: 22 },
    description: {
      ...TYPOGRAPHY.body,
      color: colors.textMuted,
      marginBottom: SPACING.md,
    },
    completeBanner: {
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      backgroundColor: withAlpha(colors.primary, 0.08),
      borderRadius: BORDER_RADIUS.md,
      alignItems: 'center',
    },
    completeText: {
      ...TYPOGRAPHY.body,
      color: colors.primary,
      fontStyle: 'italic',
    },
    expiredBanner: {
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      backgroundColor: withAlpha(colors.text, 0.04),
      borderRadius: BORDER_RADIUS.md,
      alignItems: 'center',
    },
    expiredText: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      fontStyle: 'italic',
    },
    acceptButton: {
      borderRadius: BORDER_RADIUS.md,
      overflow: 'hidden',
      alignSelf: 'flex-end',
      marginTop: SPACING.sm,
    },
    acceptGradient: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
    },
    acceptText: {
      ...TYPOGRAPHY.button,
      color: '#FFFFFF',
    },
    // Compact
    compactCard: { marginVertical: SPACING.xs / 2 },
    compactContent: { flexDirection: 'row', alignItems: 'center' },
    compactIcon: { fontSize: 22, marginRight: SPACING.sm },
    compactTitle: {
      ...TYPOGRAPHY.body,
      color: colors.text,
      flex: 1,
    },
  });
