/**
 * OfflineIndicator — Subtle offline grace indicator
 * Sexy Red Intimacy & Apple Editorial Updates Integrated.
 * * A refined, non-intrusive pill that appears when offline.
 * Communicates reliability without anxiety using luxury aesthetic.
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  AppState,
  Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { SPACING, withAlpha } from '../utils/theme';
import { OfflineGrace } from '../services/PolishEngine';
import { SUPABASE_URL } from '../config/supabase';
import Icon from './Icon';

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

const CONNECTIVITY_URL = SUPABASE_URL
  ? `${SUPABASE_URL}/rest/v1/`
  : 'https://one.one.one.one/cdn-cgi/trace';

function OfflineIndicator() {
  const { colors, isDark } = useTheme();
  const [isOffline, setIsOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const consecutiveFailuresRef = useRef(0);
  const retryTimeoutRef = useRef(null);

  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    primary: colors.primary || '#D2121A', // Sexy Red
    text: colors.text,
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const checkConnection = useCallback(async () => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    let timeout = null;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 6000);
      await fetch(CONNECTIVITY_URL, {
        method: 'HEAD',
        signal: controller.signal,
      });
      consecutiveFailuresRef.current = 0;
      setIsOffline(false);
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } catch {
      consecutiveFailuresRef.current += 1;

      if (consecutiveFailuresRef.current < 2) {
        retryTimeoutRef.current = setTimeout(() => {
          retryTimeoutRef.current = null;
          checkConnection();
        }, 1500);
        return;
      }

      setIsOffline(true);
      OfflineGrace.getPendingCount().then(setPendingCount).catch(() => {});
      Animated.spring(slideAnim, {
        toValue: 50, // Floating position below the status bar area
        damping: 18,
        stiffness: 120,
        useNativeDriver: true,
      }).start();
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }, [slideAnim]);

  useEffect(() => {
    checkConnection();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkConnection();
    });
    const interval = setInterval(() => {
      if (isOffline) checkConnection();
    }, 30000);
    return () => {
      sub.remove();
      clearInterval(interval);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [checkConnection, isOffline]);

  if (!isOffline) return null;

  return (
    <View style={styles.absoluteWrapper} pointerEvents="none">
      <Animated.View
        style={[
          styles.pill,
          { 
            backgroundColor: t.surface, 
            borderColor: t.border,
            transform: [{ translateY: slideAnim }] 
          },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: withAlpha(t.primary, 0.1) }]}>
          <Icon 
            name={pendingCount > 0 ? "cloud-offline-outline" : "wifi-outline"} 
            size={14} 
            color={t.primary} 
          />
        </View>
        
        <Text style={[styles.text, { color: t.text }]}>
          {pendingCount > 0
            ? `Syncing ${pendingCount} ${pendingCount === 1 ? 'item' : 'items'} when back`
            : 'Working Offline'}
        </Text>
        
        <View style={[styles.statusDot, { backgroundColor: t.primary }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  absoluteWrapper: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    zIndex: 9999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: 20, // Perfect Apple Pill
    borderWidth: 1,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
    }),
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.8,
  },
});

export default React.memo(OfflineIndicator);
