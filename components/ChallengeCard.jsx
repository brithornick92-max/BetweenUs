import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Card from './Card';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../utils/theme';

/**
 * Challenge Card Component
 * 
 * Displays challenge information with progress tracking,
 * difficulty indicators, and time remaining.
 */
export default function ChallengeCard({
  challenge,
  onPress = null,
  onAccept = null,
  compact = false,
  style
}) {
  const getDifficultyColor = (difficulty) => {
    const colors = {
      easy: '#4CAF50',
      medium: '#FFC107',
      hard: '#FF5722',
      expert: '#9C27B0'
    };
    return colors[difficulty] || colors.easy;
  };

  const getTypeIcon = (type) => {
    const icons = {
      daily: '📅',
      weekly: '🗓️',
      monthly: '📆',
      special: '⭐',
      streak: '🔥',
      exploration: '🗺️'
    };
    return icons[type] || '🎯';
  };

  const getTimeRemaining = (expiresAt) => {
    const now = Date.now();
    const remaining = expiresAt - now;
    
    if (remaining <= 0) return 'Expired';
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d remaining`;
    if (hours > 0) return `${hours}h remaining`;
    return 'Ending soon';
  };

  const difficultyColor = getDifficultyColor(challenge.difficulty);
  const typeIcon = getTypeIcon(challenge.type);
  const timeRemaining = getTimeRemaining(challenge.expiresAt);
  const isComplete = challenge.status === 'completed';
  const isExpired = challenge.expiresAt < Date.now();
  const progress = challenge.progress || 0;

  if (compact) {
    return (
      <Card variant="glass" padding="sm" onPress={onPress} style={[styles.compactCard, style]}>
        <View style={styles.compactContent}>
          <Text style={styles.compactIcon}>{typeIcon}</Text>
          <View style={styles.compactInfo}>
            <Text style={styles.compactTitle} numberOfLines={1}>
              {challenge.name}
            </Text>
            <View style={styles.compactProgress}>
              <View style={styles.compactProgressBar}>
                <View style={[styles.compactProgressFill, { width: `${progress * 100}%` }]} />
              </View>
              <Text style={styles.compactProgressText}>
                {challenge.current}/{challenge.target}
              </Text>
            </View>
          </View>
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
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.typeIcon}>{typeIcon}</Text>
            <View style={styles.headerInfo}>
              <Text style={styles.title} numberOfLines={1}>
                {challenge.name}
              </Text>
              <View style={styles.meta}>
                <View style={[styles.difficultyBadge, { backgroundColor: difficultyColor + '30' }]}>
                  <Text style={[styles.difficultyText, { color: difficultyColor }]}>
                    {challenge.difficulty.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.typeText}>
                  {challenge.type}
                </Text>
              </View>
            </View>
          </View>
          
          {!isComplete && !isExpired && (
            <Text style={styles.timeRemaining}>{timeRemaining}</Text>
          )}
          
          {isComplete && (
            <Text style={styles.completeIcon}>✅</Text>
          )}
        </View>

        {/* Description */}
        <Text style={styles.description} numberOfLines={2}>
          {challenge.description}
        </Text>

        {/* Progress */}
        {!isComplete && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Progress</Text>
              <Text style={styles.progressStats}>
                {challenge.current} / {challenge.target}
              </Text>
            </View>
            <View style={styles.progressBar}>
              <LinearGradient
                colors={[COLORS.blushRose, COLORS.deepPlum]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${progress * 100}%` }]}
              />
            </View>
            <Text style={styles.progressPercentage}>
              {Math.round(progress * 100)}% complete
            </Text>
          </View>
        )}

        {/* Reward */}
        <View style={styles.rewardSection}>
          <View style={styles.rewardInfo}>
            <Text style={styles.rewardLabel}>Reward:</Text>
            <Text style={styles.rewardPoints}>
              +{challenge.reward.points} points
            </Text>
          </View>
          
          {onAccept && challenge.status === 'available' && (
            <TouchableOpacity 
              style={styles.acceptButton}
              onPress={onAccept}
            >
              <LinearGradient
                colors={[COLORS.blushRose, COLORS.deepPlum]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.acceptGradient}
              >
                <Text style={styles.acceptText}>Accept</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* Completion Banner */}
        {isComplete && (
          <View style={styles.completionBanner}>
            <LinearGradient
              colors={[COLORS.blushRose + '40', COLORS.deepPlum + '40']}
              style={styles.completionGradient}
            >
              <Text style={styles.completionText}>
                🎉 Challenge Complete! +{challenge.reward.points} pts
              </Text>
            </LinearGradient>
          </View>
        )}

        {/* Expired Banner */}
        {isExpired && !isComplete && (
          <View style={styles.expiredBanner}>
            <Text style={styles.expiredText}>⏰ Challenge Expired</Text>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: SPACING.xs
  },
  expiredCard: {
    opacity: 0.6
  },
  content: {
    width: '100%'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  typeIcon: {
    fontSize: 32,
    marginRight: SPACING.sm
  },
  headerInfo: {
    flex: 1
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.cream,
    marginBottom: SPACING.xs
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm
  },
  difficultyBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs / 2,
    borderRadius: BORDER_RADIUS.sm
  },
  difficultyText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    fontSize: 10
  },
  typeText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.softGray,
    textTransform: 'capitalize'
  },
  timeRemaining: {
    ...TYPOGRAPHY.caption,
    color: COLORS.blushRose,
    fontWeight: '600'
  },
  completeIcon: {
    fontSize: 24
  },
  description: {
    ...TYPOGRAPHY.body,
    color: COLORS.softGray,
    marginBottom: SPACING.md
  },
  progressSection: {
    marginBottom: SPACING.md
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs
  },
  progressLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.softGray
  },
  progressStats: {
    ...TYPOGRAPHY.caption,
    color: COLORS.cream,
    fontWeight: '600'
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
    marginBottom: SPACING.xs
  },
  progressFill: {
    height: '100%',
    borderRadius: BORDER_RADIUS.sm
  },
  progressPercentage: {
    ...TYPOGRAPHY.caption,
    color: COLORS.blushRose,
    textAlign: 'right'
  },
  rewardSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  rewardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs
  },
  rewardLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.softGray
  },
  rewardPoints: {
    ...TYPOGRAPHY.body,
    color: COLORS.blushRose,
    fontWeight: '700'
  },
  acceptButton: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden'
  },
  acceptGradient: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm
  },
  acceptText: {
    ...TYPOGRAPHY.body,
    color: COLORS.cream,
    fontWeight: '700'
  },
  completionBanner: {
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden'
  },
  completionGradient: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignItems: 'center'
  },
  completionText: {
    ...TYPOGRAPHY.body,
    color: COLORS.cream,
    fontWeight: '700'
  },
  expiredBanner: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: 'rgba(255, 87, 34, 0.2)',
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center'
  },
  expiredText: {
    ...TYPOGRAPHY.body,
    color: '#FF5722',
    fontWeight: '600'
  },
  // Compact styles
  compactCard: {
    marginVertical: SPACING.xs / 2
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  compactIcon: {
    fontSize: 24,
    marginRight: SPACING.sm
  },
  compactInfo: {
    flex: 1
  },
  compactTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.cream,
    fontWeight: '600',
    marginBottom: SPACING.xs / 2
  },
  compactProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm
  },
  compactProgressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden'
  },
  compactProgressFill: {
    height: '100%',
    backgroundColor: COLORS.blushRose,
    borderRadius: BORDER_RADIUS.sm
  },
  compactProgressText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.softGray,
    fontSize: 10
  }
});
