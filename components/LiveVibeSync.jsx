import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Icon from './Icon';
import { impact, notification, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { MomentSignalSender } from '../services/ConnectionEngine';
import { useTheme } from '../context/ThemeContext';
import { useTogetherPresence } from '../hooks/useTogetherPresence';
import { SPACING, withAlpha } from '../utils/theme';

const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });

export default function LiveVibeSync({ partnerLabel = 'Partner', style }) {
  const { colors, isDark } = useTheme();
  const { isTogetherNow } = useTogetherPresence();
  const hapticTimerRef = useRef(null);

  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState(null);

  const scale = useSharedValue(1);
  const bloomScale = useSharedValue(0.9);
  const bloomOpacity = useSharedValue(0);

  useEffect(() => {
    return () => {
      if (hapticTimerRef.current) {
        clearTimeout(hapticTimerRef.current);
      }
    };
  }, []);

  const t = useMemo(() => ({
    surface: isDark ? '#130608' : '#FFFFFF',
    surfaceRaised: isDark ? '#1E0A0D' : '#FFF5F5',
    text: colors.text,
    subtext: isDark ? 'rgba(242,233,230,0.66)' : 'rgba(60,60,67,0.66)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    primary: colors.primary || '#D2121A',
    primaryDeep: '#1A0000',
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

  const handleSend = async () => {
    if (isSending) return;

    setIsSending(true);
    setStatus(null);

    impact(ImpactFeedbackStyle.Heavy);
    hapticTimerRef.current = setTimeout(() => {
      impact(ImpactFeedbackStyle.Heavy);
    }, 150);

    triggerPulseAnimation();

    try {
      const result = await MomentSignalSender.sendHeartbeat();

      if (!result.sent) {
        notification(NotificationFeedbackType.Error);
        setStatus({
          tone: 'error',
          title: 'Hold for a beat',
          subtitle: result.error || 'Pulse cooldown is still active.',
        });
        return;
      }

      notification(NotificationFeedbackType.Success);
      setStatus({
        tone: result.remote ? 'success' : 'pending',
        title: `Sent to ${partnerLabel}`,
        subtitle: result.remote
          ? (isTogetherNow ? 'Their device should pulse now.' : 'Push is on the way.')
          : (result.error || 'Saved locally and will sync when connected.'),
      });
    } catch {
      notification(NotificationFeedbackType.Error);
      setStatus({
        tone: 'pending',
        title: `Saved for ${partnerLabel}`,
        subtitle: 'Pulse will sync when the connection returns.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const bloomStyle = useAnimatedStyle(() => ({
    opacity: bloomOpacity.value,
    transform: [{ scale: bloomScale.value }],
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
          <View style={[styles.presencePill, { backgroundColor: withAlpha(isTogetherNow ? t.success : t.primary, 0.12) }]}>
            <View style={[styles.presenceDot, { backgroundColor: isTogetherNow ? t.success : t.primary }]} />
            <Text style={[styles.presenceText, { color: isTogetherNow ? t.success : t.primary }]}>
              {isTogetherNow ? 'Live now' : 'Push ready'}
            </Text>
          </View>
        </View>

        <View style={styles.centerStage}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.bloom,
              {
                backgroundColor: t.primary,
                shadowColor: t.primary,
              },
              bloomStyle,
            ]}
          />

          <Pressable onPress={handleSend} disabled={isSending} style={styles.buttonPressable}>
            <Animated.View
              style={[
                styles.pulseButton,
                {
                  backgroundColor: t.primaryDeep,
                  borderColor: t.primary,
                  shadowColor: t.primary,
                  opacity: isSending ? 0.82 : 1,
                },
                buttonStyle,
              ]}
            >
              <Icon name="pulse" size={34} color={t.primary} />
              <Text style={[styles.buttonText, { color: t.primary }]}>
                {isSending ? 'Sending...' : 'Send Pulse'}
              </Text>
            </Animated.View>
          </Pressable>
        </View>

        <View style={[styles.statusCard, { backgroundColor: t.surfaceRaised, borderColor: withAlpha(statusColor, 0.25) }]}>
          <Text style={[styles.statusTitle, { color: status ? statusColor : t.text }]}>
            {status?.title || `Send a tactile pulse to ${partnerLabel}`}
          </Text>
          <Text style={[styles.statusSubtitle, { color: t.subtext }]}>
            {status?.subtitle || (isTogetherNow
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
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
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