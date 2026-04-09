import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import Icon from './Icon';
import { impact, notification, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { MomentSignalSender } from '../services/ConnectionEngine';
import { supabase } from '../config/supabase';
import { useTheme } from '../context/ThemeContext';
import { useTogetherPresence } from '../hooks/useTogetherPresence';
import { useAppContext } from '../context/AppContext';
import { SPACING, withAlpha } from '../utils/theme';

const INCOMING_LABEL_DURATION = 3000;

const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });

export default function LiveVibeSync({ partnerLabel = 'Partner', style, onViewportStabilize }) {
  const { colors, isDark } = useTheme();
  const { isTogetherNow } = useTogetherPresence();
  const { state: appState } = useAppContext();
  const coupleId = appState?.coupleId || null;
  const userId = appState?.userId || null;
  const hapticTimerRef = useRef(null);

  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState(null);
  const [incomingLabel, setIncomingLabel] = useState(null);
  const [partnerOnScreen, setPartnerOnScreen] = useState(false);
  const incomingLabelTimerRef = useRef(null);
  const unsubSignalsRef = useRef(null);
  const broadcastChannelRef = useRef(null);
  const recentBroadcastRef = useRef(null);
  const incomingHapticTimerRef = useRef(null);

  const scale = useSharedValue(1);
  const bloomScale = useSharedValue(0.9);
  const bloomOpacity = useSharedValue(0);
  // Separate bloom for incoming so it can use a different colour
  const inBloomScale = useSharedValue(0.9);
  const inBloomOpacity = useSharedValue(0);
  // Gentle breathing glow when partner is also on this screen
  const glowRingOpacity = useSharedValue(0);
  const glowRingScale = useSharedValue(1);

  useEffect(() => {
    return () => {
      if (hapticTimerRef.current) clearTimeout(hapticTimerRef.current);
      if (incomingHapticTimerRef.current) clearTimeout(incomingHapticTimerRef.current);
      if (incomingLabelTimerRef.current) clearTimeout(incomingLabelTimerRef.current);
    };
  }, []);

  // Stable ref for the incoming animation so broadcast + postgres_changes can both call it
  const triggerIncomingRef = useRef(null);
  triggerIncomingRef.current = () => {
    // Haptic double-tap — mirrors what the sender feels
    impact(ImpactFeedbackStyle.Heavy);
    if (incomingHapticTimerRef.current) clearTimeout(incomingHapticTimerRef.current);
    incomingHapticTimerRef.current = setTimeout(() => {
      incomingHapticTimerRef.current = null;
      impact(ImpactFeedbackStyle.Heavy);
    }, 150);
    notification(NotificationFeedbackType.Success);

    // Animate the button (pronounced bounce)
    scale.value = withSequence(
      withTiming(1.14, { duration: 140 }),
      withTiming(0.93, { duration: 80 }),
      withSpring(1, { damping: 10, stiffness: 160 })
    );

    // Animate the incoming bloom — brighter and longer-lasting
    inBloomScale.value = 0.92;
    inBloomOpacity.value = withSequence(
      withTiming(0.9, { duration: 160 }),
      withTiming(0.45, { duration: 700 }),
      withTiming(0, { duration: 900 })
    );
    inBloomScale.value = withSequence(
      withTiming(1.5, { duration: 220 }),
      withTiming(2.2, { duration: 1380 })
    );

    // Show label briefly
    setIncomingLabel(partnerLabel);
    if (incomingLabelTimerRef.current) clearTimeout(incomingLabelTimerRef.current);
    incomingLabelTimerRef.current = setTimeout(() => setIncomingLabel(null), INCOMING_LABEL_DURATION);
  };

  // ── Broadcast channel: instant heartbeat relay when both partners are on screen ──
  useEffect(() => {
    if (!supabase || !coupleId || !userId) return;

    const channel = supabase.channel(`heartbeat-live:${coupleId}`, {
      config: { broadcast: { self: false }, presence: { key: userId } },
    });

    const checkPartner = () => {
      const ps = channel.presenceState();
      setPartnerOnScreen(Object.keys(ps).some((k) => k !== userId));
    };

    channel
      .on('broadcast', { event: 'heartbeat' }, () => {
        recentBroadcastRef.current = Date.now();
        triggerIncomingRef.current?.();
      })
      .on('presence', { event: 'sync' }, checkPartner)
      .on('presence', { event: 'join' }, checkPartner)
      .on('presence', { event: 'leave' }, checkPartner)
      .subscribe(async (st) => {
        if (st === 'SUBSCRIBED') {
          await channel.track({ screen: 'vibe-signal', joined_at: new Date().toISOString() }).catch((err) => {
            if (__DEV__) console.warn('[LiveVibeSync] track() failed:', err?.message);
          });
        }
      });

    broadcastChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      broadcastChannelRef.current = null;
      setPartnerOnScreen(false);
    };
  }, [coupleId, userId]);

  // Breathing glow ring while partner is also viewing the heartbeat
  useEffect(() => {
    if (partnerOnScreen) {
      glowRingOpacity.value = withRepeat(
        withSequence(
          withTiming(0.55, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.15, { duration: 1200, easing: Easing.inOut(Easing.ease) })
        ),
        -1, true
      );
      glowRingScale.value = withRepeat(
        withSequence(
          withTiming(1.18, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.06, { duration: 1200, easing: Easing.inOut(Easing.ease) })
        ),
        -1, true
      );
    } else {
      glowRingOpacity.value = withTiming(0, { duration: 400 });
      glowRingScale.value = withTiming(1, { duration: 400 });
    }
  }, [partnerOnScreen]);

  // Subscribe to partner heartbeats via postgres_changes (fallback for when broadcast misses)
  useEffect(() => {
    unsubSignalsRef.current = MomentSignalSender.subscribeToSignals((signal) => {
      // If we already received this via broadcast within the last 4s, skip the duplicate
      if (recentBroadcastRef.current && (Date.now() - recentBroadcastRef.current) < 4000) {
        return;
      }
      triggerIncomingRef.current?.();
    }, { coupleId, userId });

    return () => {
      if (typeof unsubSignalsRef.current === 'function') unsubSignalsRef.current();
    };
  }, [partnerLabel, coupleId, userId]);

  const t = useMemo(() => ({
    surface: isDark ? '#130608' : '#FFFFFF',
    surfaceRaised: isDark ? '#1E0A0D' : '#FFF5F5',
    text: colors.text,
    subtext: isDark ? 'rgba(242,233,230,0.66)' : 'rgba(60,60,67,0.66)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    primary: colors.primary || '#D2121A',
    primaryDeep: isDark ? '#1A0000' : colors.background,
    success: '#34C759',
  }), [colors, isDark]);

  const triggerPulseAnimation = () => {
    scale.value = withSequence(
      withTiming(1.08, { duration: 120 }),
      withTiming(0.96, { duration: 70 }),
      withSpring(1, { damping: 12, stiffness: 180 })
    );

    bloomScale.value = 0.92;
    bloomOpacity.value = withSequence(
      withTiming(0.85, { duration: 140 }),
      withTiming(0, { duration: 650 })
    );
    bloomScale.value = withSequence(
      withTiming(1.35, { duration: 160 }),
      withTiming(1.7, { duration: 630 })
    );
  };

  const scheduleViewportStabilize = () => {
    if (typeof onViewportStabilize !== 'function') return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        onViewportStabilize();
      });
    });
  };

  const handleSend = async () => {
    if (isSending) return;

    setIsSending(true);
    setStatus(null);
    scheduleViewportStabilize();

    impact(ImpactFeedbackStyle.Heavy);
    hapticTimerRef.current = setTimeout(() => {
      impact(ImpactFeedbackStyle.Heavy);
    }, 150);

    triggerPulseAnimation();

    // Broadcast instantly for partners on the same screen
    try {
      broadcastChannelRef.current?.send({
        type: 'broadcast',
        event: 'heartbeat',
        payload: { sender: userId, ts: Date.now() },
      });
    } catch { /* non-critical */ }

    try {
      const result = await MomentSignalSender.sendHeartbeat();

      if (!result.sent) {
        notification(NotificationFeedbackType.Error);
        const e = result.error || '';
        const code = result.errorCode || '';
        // Map to a friendly message. Check both the message text AND the Postgres/PostgREST error code.
        const isRLS = e.includes('violates') || e.includes('policy') || e.includes('permission') || e.includes('insufficient') || code === '42501' || code === 'PGRST301' || e.includes('row-level') || e.includes('security');
        const isAuth = e.includes('JWT') || e.includes('token') || e.includes('expired') || e.includes('auth') || e.includes('session') || e.includes('Sign in') || code === 'PGRST302';
        const isNetwork = e.includes('fetch') || e.includes('network') || e.includes('Network') || e.includes('timeout') || e.includes('ECONNREFUSED') || e.includes('Failed to fetch') || e.includes('Abort');
        const isNotLinked = e.includes('Link') || e.includes('couple') || e.includes('partner');
        const isCooldown = false;
        const isNotConfigured = e.includes('configured') || e.includes('Sync is not') || e.includes('not configured');

        const friendlyError = isCooldown
          ? e
          : isNotConfigured
            ? 'Connection not set up on this device yet.'
            : isNotLinked
              ? 'Link with your partner to send a pulse.'
              : isAuth
                ? 'Session expired — please sign out and back in.'
                : isRLS
                  ? 'A server policy is blocking this — the database needs a quick update.'
                  : isNetwork
                    ? 'No connection — check your internet and try again.'
                    : e
                      ? `Could not send right now (${__DEV__ ? e : 'try again'}).`
                      : 'Could not reach your partner right now. Try again in a moment.';

        if (__DEV__) {
          console.warn('[LiveVibeSync] result.sent=false error:', e, 'code:', code);
        }

        setStatus({
          tone: 'error',
          title: 'Hold for a beat',
          subtitle: friendlyError,
        });
        scheduleViewportStabilize();
        return;
      }

      notification(NotificationFeedbackType.Success);
      setStatus({
        tone: result.remote ? 'success' : 'pending',
        title: `Sent to ${partnerLabel}`,
        subtitle: result.remote
          ? (isTogetherNow ? 'Their device should pulse now.' : 'Push is on the way.')
          : 'Saved locally and will sync when connected.',
      });
      scheduleViewportStabilize();
    } catch {
      notification(NotificationFeedbackType.Error);
      setStatus({
        tone: 'pending',
        title: `Saved for ${partnerLabel}`,
        subtitle: 'Pulse will sync when the connection returns.',
      });
      scheduleViewportStabilize();
    } finally {
      setIsSending(false);
      scheduleViewportStabilize();
    }
  };

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const bloomStyle = useAnimatedStyle(() => ({
    opacity: bloomOpacity.value,
    transform: [{ scale: bloomScale.value }],
  }));

  const inBloomStyle = useAnimatedStyle(() => ({
    opacity: inBloomOpacity.value,
    transform: [{ scale: inBloomScale.value }],
  }));

  const glowRingStyle = useAnimatedStyle(() => ({
    opacity: glowRingOpacity.value,
    transform: [{ scale: glowRingScale.value }],
  }));

  const statusColor = status?.tone === 'error'
    ? '#FF9F0A'
    : status?.tone === 'success'
      ? t.success
      : t.primary;

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.eyebrow, { color: t.subtext }]}>Sanctuary Sync</Text>
            <Text style={[styles.title, { color: t.text }]}>Heartbeat</Text>
          </View>
          <View style={[styles.presencePill, { backgroundColor: withAlpha(partnerOnScreen ? t.success : isTogetherNow ? t.success : t.primary, 0.12) }]}>
            <View style={[styles.presenceDot, { backgroundColor: partnerOnScreen ? t.success : isTogetherNow ? t.success : t.primary }]} />
            <Text style={[styles.presenceText, { color: partnerOnScreen ? t.success : isTogetherNow ? t.success : t.primary }]}>
              {partnerOnScreen ? 'Both live' : isTogetherNow ? 'Live now' : 'Push ready'}
            </Text>
          </View>
        </View>

        <View style={styles.centerStage}>
          {/* Breathing glow ring — visible when partner is also on this screen */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glowRing,
              { borderColor: '#FF6B8A', shadowColor: '#FF6B8A' },
              glowRingStyle,
            ]}
          />

          {/* Outgoing bloom */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.bloom,
              { backgroundColor: t.primary, shadowColor: t.primary },
              bloomStyle,
            ]}
          />

          {/* Incoming bloom — softer pink tint so Partner B can tell it's from their partner */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.bloom,
              { backgroundColor: '#FF6B8A', shadowColor: '#FF6B8A' },
              inBloomStyle,
            ]}
          />

          <Pressable onPress={handleSend} disabled={isSending} style={styles.buttonPressable}>
            <Animated.View
              style={[
                styles.pulseButton,
                {
                  backgroundColor: t.primaryDeep,
                  borderColor: incomingLabel ? '#FF6B8A' : t.primary,
                  shadowColor: incomingLabel ? '#FF6B8A' : t.primary,
                  opacity: isSending ? 0.82 : 1,
                },
                buttonStyle,
              ]}
            >
              <Icon name="pulse-outline" size={incomingLabel ? 22 : 34} color={incomingLabel ? '#FF6B8A' : t.primary} />
              <Text style={[styles.buttonText, { color: incomingLabel ? '#FF6B8A' : t.primary, fontSize: incomingLabel ? 11 : 14, letterSpacing: incomingLabel ? 0.3 : 1, width: incomingLabel ? 140 : undefined }]} numberOfLines={2} textBreakStrategy="balanced">
                {incomingLabel ? `${incomingLabel}\nis here ♥` : isSending ? 'Sending...' : 'Send Pulse'}
              </Text>
            </Animated.View>
          </Pressable>
        </View>

        <View style={[styles.statusCard, { backgroundColor: t.surfaceRaised, borderColor: withAlpha(statusColor, 0.25) }]}>
          <Text style={[styles.statusTitle, { color: status ? statusColor : t.text }]}>
            {status?.title || `Send a tactile pulse to ${partnerLabel}`}
          </Text>
          <Text style={[styles.statusSubtitle, { color: t.subtext }]}>
            {status?.subtitle || (partnerOnScreen
              ? `${partnerLabel} is viewing this right now — pulses arrive instantly.`
              : isTogetherNow
              ? 'Your partner is active right now, so realtime and push can both carry it.'
              : 'The app writes a heartbeat signal and sends a push when the connection path is available.')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: SPACING.xl,
    paddingBottom: 16,
  },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrow: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontFamily: SYSTEM_FONT,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  presencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  presenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  presenceText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  centerStage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    minHeight: 260,
  },
  bloom: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 40,
  },
  glowRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  buttonPressable: {
    borderRadius: 999,
  },
  pulseButton: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  buttonText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  statusCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  statusTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: '800',
  },
  statusSubtitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
});
