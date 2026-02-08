import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Card from './Card';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../utils/theme';

/**
 * Leaderboard Widget Component
 * 
 * Displays anonymous leaderboard with rankings, points, and user position.
 * Privacy-preserving - no personal information displayed.
 */
export default function LeaderboardWidget({
  leaderboard = [],
  userRank = null,
  compact = false,
  maxEntries = 10,
  onPress = null,
  style
}) {
  const getRankIcon = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getRankColor = (rank) => {
    if (rank === 1) return '#FFD700';
    if (rank === 2) return '#C0C0C0';
    if (rank === 3) return '#CD7F32';
    return COLORS.softGray;
  };

  const displayedLeaderboard = leaderboard.slice(0, maxEntries);

  if (compact) {
    return (
      <Card variant="glass" padding="sm" onPress={onPress} style={[styles.compactCard, style]}>
        <View style={styles.compactContent}>
          <Text style={styles.compactTitle}>🏆 Leaderboard</Text>
          {userRank && (
            <View style={styles.compactRank}>
              <Text style={styles.compactRankText}>
                You're #{userRank.rank}
              </Text>
            </View>
          )}
        </View>
      </Card>
    );
  }

  return (
    <Card variant="elevated" padding="md" onPress={onPress} style={[styles.card, style]}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>🏆 Leaderboard</Text>
          <Text style={styles.subtitle}>Top Couples</Text>
        </View>

        {/* Leaderboard List */}
        <ScrollView 
          style={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {displayedLeaderboard.map((entry, index) => {
            const isTopThree = entry.rank <= 3;
            const rankColor = getRankColor(entry.rank);

            return (
              <View 
                key={index}
                style={[
                  styles.entry,
                  isTopThree && styles.topEntry
                ]}
              >
                {isTopThree && (
                  <LinearGradient
                    colors={[rankColor + '20', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.entryGradient}
                  />
                )}

                {/* Rank */}
                <View style={styles.rankContainer}>
                  <Text style={[styles.rankIcon, { color: rankColor }]}>
                    {getRankIcon(entry.rank)}
                  </Text>
                </View>

                {/* Info */}
                <View style={styles.entryInfo}>
                  <Text style={styles.entryName}>
                    Couple {entry.rank}
                  </Text>
                  <Text style={styles.entryStats}>
                    {entry.achievementCount} achievements
                  </Text>
                </View>

                {/* Points */}
                <View style={styles.pointsContainer}>
                  <Text style={styles.points}>{entry.points}</Text>
                  <Text style={styles.pointsLabel}>pts</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* User Rank */}
        {userRank && (
          <View style={styles.userRankContainer}>
            <LinearGradient
              colors={[COLORS.blushRose + '40', COLORS.deepPlum + '40']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.userRankGradient}
            >
              <View style={styles.userRank}>
                <View style={styles.userRankLeft}>
                  <Text style={styles.userRankIcon}>👫</Text>
                  <View>
                    <Text style={styles.userRankTitle}>Your Rank</Text>
                    <Text style={styles.userRankPercentile}>
                      Top {userRank.percentile}%
                    </Text>
                  </View>
                </View>
                <View style={styles.userRankRight}>
                  <Text style={styles.userRankNumber}>#{userRank.rank}</Text>
                  <Text style={styles.userRankPoints}>{userRank.points} pts</Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Privacy Notice */}
        <Text style={styles.privacyNotice}>
          🔒 All rankings are anonymous
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: SPACING.xs
  },
  content: {
    width: '100%'
  },
  header: {
    marginBottom: SPACING.md,
    alignItems: 'center'
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.cream,
    fontWeight: '700',
    marginBottom: SPACING.xs
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.softGray
  },
  list: {
    maxHeight: 400,
    marginBottom: SPACING.md
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    position: 'relative',
    overflow: 'hidden'
  },
  topEntry: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)'
  },
  entryGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  },
  rankContainer: {
    width: 50,
    alignItems: 'center'
  },
  rankIcon: {
    ...TYPOGRAPHY.h2,
    fontWeight: '700'
  },
  entryInfo: {
    flex: 1,
    marginLeft: SPACING.sm
  },
  entryName: {
    ...TYPOGRAPHY.body,
    color: COLORS.cream,
    fontWeight: '600',
    marginBottom: SPACING.xs / 2
  },
  entryStats: {
    ...TYPOGRAPHY.caption,
    color: COLORS.softGray
  },
  pointsContainer: {
    alignItems: 'flex-end'
  },
  points: {
    ...TYPOGRAPHY.h3,
    color: COLORS.blushRose,
    fontWeight: '700'
  },
  pointsLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.softGray
  },
  userRankContainer: {
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden'
  },
  userRankGradient: {
    padding: SPACING.md
  },
  userRank: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  userRankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm
  },
  userRankIcon: {
    fontSize: 32
  },
  userRankTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.cream,
    fontWeight: '600',
    marginBottom: SPACING.xs / 2
  },
  userRankPercentile: {
    ...TYPOGRAPHY.caption,
    color: COLORS.blushRose,
    fontWeight: '600'
  },
  userRankRight: {
    alignItems: 'flex-end'
  },
  userRankNumber: {
    ...TYPOGRAPHY.h2,
    color: COLORS.cream,
    fontWeight: '700',
    marginBottom: SPACING.xs / 2
  },
  userRankPoints: {
    ...TYPOGRAPHY.caption,
    color: COLORS.softGray
  },
  privacyNotice: {
    ...TYPOGRAPHY.caption,
    color: COLORS.softGray,
    textAlign: 'center',
    marginTop: SPACING.sm
  },
  // Compact styles
  compactCard: {
    marginVertical: SPACING.xs / 2
  },
  compactContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  compactTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.cream,
    fontWeight: '600'
  },
  compactRank: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs / 2,
    backgroundColor: COLORS.blushRose + '30',
    borderRadius: BORDER_RADIUS.sm
  },
  compactRankText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.blushRose,
    fontWeight: '700'
  }
});
