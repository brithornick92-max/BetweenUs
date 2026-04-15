/**
 * SkeletonLoader — Shimmer loading placeholder
 * Replaces ActivityIndicator spinners with content-shaped placeholders.
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

function ShimmerBlock({ width = '100%', height = 16, borderRadius = 8, style }) {
  const { isDark } = useTheme();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const bg = isDark ? '#2C2C2E' : '#E5E5EA';
  const highlight = isDark ? '#3A3A3C' : '#F2F2F7';

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: bg,
          opacity: shimmer.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] }),
        },
        style,
      ]}
    />
  );
}

/** Skeleton that mimics the home screen prompt card */
export function PromptCardSkeleton() {
  return (
    <View style={styles.card}>
      <ShimmerBlock width={120} height={12} style={{ marginBottom: 12 }} />
      <ShimmerBlock width="90%" height={20} style={{ marginBottom: 8 }} />
      <ShimmerBlock width="75%" height={20} style={{ marginBottom: 20 }} />
      <ShimmerBlock width="100%" height={80} borderRadius={12} style={{ marginBottom: 16 }} />
      <ShimmerBlock width="100%" height={48} borderRadius={24} />
    </View>
  );
}

/** Skeleton that mimics a list of prompt cards */
export function PromptListSkeleton({ count = 3 }) {
  return (
    <View style={{ padding: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.listItem, i > 0 && { marginTop: 12 }]}>
          <ShimmerBlock width="85%" height={18} style={{ marginBottom: 8 }} />
          <ShimmerBlock width="60%" height={14} />
        </View>
      ))}
    </View>
  );
}

/** Skeleton that mimics date night cards */
export function DateCardSkeleton({ count = 2 }) {
  return (
    <View style={{ padding: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.dateCard, i > 0 && { marginTop: 12 }]}>
          <ShimmerBlock width="70%" height={20} style={{ marginBottom: 10 }} />
          <ShimmerBlock width="40%" height={14} style={{ marginBottom: 8 }} />
          <ShimmerBlock width="100%" height={14} />
        </View>
      ))}
    </View>
  );
}

/** Generic inline skeleton */
export { ShimmerBlock };

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 16,
    marginHorizontal: 16,
  },
  listItem: {
    padding: 16,
    borderRadius: 12,
  },
  dateCard: {
    padding: 16,
    borderRadius: 12,
  },
});
