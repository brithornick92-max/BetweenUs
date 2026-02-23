/**
 * OfflineIndicator — Subtle offline grace indicator
 * 
 * A tiny, non-intrusive bar that appears when offline.
 * Shows pending items queued for sync.
 * Communicates reliability without anxiety.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  AppState,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { SPACING, SANS } from '../utils/theme';
import { OfflineGrace } from '../services/PolishEngine';
import { SUPABASE_URL } from '../config/supabase';

// Use the app's own Supabase endpoint for connectivity checks.
// Falls back to a region-neutral endpoint if Supabase isn't configured.
// This avoids the Google-blocked-in-China problem.
const CONNECTIVITY_URL = SUPABASE_URL
  ? `${SUPABASE_URL}/rest/v1/`
  : 'https://one.one.one.one/cdn-cgi/trace';

export default function OfflineIndicator() {
  const { colors } = useTheme();
  const [isOffline, setIsOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const slideAnim = useRef(new Animated.Value(-40)).current;

  const checkConnection = useCallback(async () => {
    try {
      // Connectivity check using the app's own backend (or Cloudflare fallback)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      await fetch(CONNECTIVITY_URL, {
        method: 'HEAD',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      setIsOffline(false);
      Animated.timing(slideAnim, {
        toValue: -40,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } catch {
      setIsOffline(true);
      OfflineGrace.getPendingCount().then(setPendingCount).catch(() => {});
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 20,
        stiffness: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [slideAnim]);

  useEffect(() => {
    checkConnection();
    // Re-check when app comes back to foreground
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkConnection();
    });
    // Periodic check every 30 seconds while offline
    const interval = setInterval(() => {
      if (isOffline) checkConnection();
    }, 30000);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [checkConnection, isOffline]);

  if (!isOffline) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: colors.surface2, transform: [{ translateY: slideAnim }] },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={pendingCount > 0
        ? `Offline. ${pendingCount} ${pendingCount === 1 ? 'item' : 'items'} will sync when you're back`
        : 'Offline. Everything saved is still here'}
    >
      <View style={[styles.dot, { backgroundColor: colors.accent || '#C9A84C' }]} />
      <Text style={[styles.text, { color: colors.textMuted }]}>
        {pendingCount > 0
          ? `Offline · ${pendingCount} ${pendingCount === 1 ? 'item' : 'items'} will sync when you're back`
          : 'Offline · Everything saved is still here'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: SPACING.md,
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 12,
    fontFamily: SANS,
  },
});
