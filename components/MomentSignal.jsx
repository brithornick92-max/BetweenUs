// components/MomentSignal.jsx — "Thinking of you" one-tap micro-connections
// No words needed. Just presence.

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import Icon from './Icon';
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import { SPACING } from '../utils/theme';
import { MomentSignalSender, MOMENT_TYPES } from '../services/ConnectionEngine';

const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });

export default function MomentSignal({ partnerLabel = 'Partner', onSend, visible = true, onReceive }) {
  const { colors, isDark } = useTheme();

  const t = useMemo(() => ({
    background: isDark ? '#000000' : '#F2F2F7',
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    surfaceSecondary: isDark ? '#2C2C2E' : '#F5F5F7',
    primary: colors.primary,
    text: isDark ? '#FFFFFF' : '#000000',
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  }), [colors, isDark]);

  const [sentType, setSentType] = useState(null);
  const [sendError, setSendError] = useState(null);
  const [receivedSignal, setReceivedSignal] = useState(null);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const receiveFadeAnim = useRef(new Animated.Value(0)).current;
  const receiveScaleAnim = useRef(new Animated.Value(0.6)).current;
  const receivePulseAnim = useRef(new Animated.Value(1)).current;
  const unsubRef = useRef(null);

  // Subscribe to incoming partner signals
  useEffect(() => {
    unsubRef.current = MomentSignalSender.subscribeToSignals((signal) => {
      const momentDef = MOMENT_TYPES.find(m => m.id === signal.moment_type);
      if (!momentDef) return;

      onReceive?.();
      setReceivedSignal(momentDef);

      // Layered haptics — double tap for intimacy
      notification(NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => impact(ImpactFeedbackStyle.Light).catch(() => {}), 200);

      // Elegant entrance: scale up + fade + gentle pulse
      receiveScaleAnim.setValue(0.6);
      receivePulseAnim.setValue(1);
      Animated.parallel([
        Animated.spring(receiveScaleAnim, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(receiveFadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.delay(3200),
          // Gentle breathing pulse before fading
          Animated.sequence([
            Animated.timing(receivePulseAnim, { toValue: 1.05, duration: 600, useNativeDriver: true }),
            Animated.timing(receivePulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          ]),
          Animated.timing(receiveFadeAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]),
      ]).start(() => setReceivedSignal(null));
    });

    return () => {
      if (typeof unsubRef.current === 'function') unsubRef.current();
    };
  }, [receiveFadeAnim, receiveScaleAnim, receivePulseAnim]);

  const handleSend = useCallback(async (moment) => {
    selection();
    impact(ImpactFeedbackStyle.Medium).catch(() => {});
    setSentType(moment.id);
    setSendError(null);

    // Animate: scale up + fade in + glow pulse
    scaleAnim.setValue(0.85);
    glowAnim.setValue(0);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 7, tension: 70, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
        // Glow pulse
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.7, duration: 300, useNativeDriver: true }),
        ]),
        Animated.delay(2200),
        Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start(() => setSentType(null));

    // Second gentle haptic after a beat
    setTimeout(() => impact(ImpactFeedbackStyle.Light).catch(() => {}), 350);

    const result = await MomentSignalSender.send(moment.id);

    if (!result.sent) {
      setSendError(result.error || 'Something went wrong');
    } else if (result.error) {
      setSendError('Sent locally — will sync when connected');
    }

    // Third soft confirmation haptic
    setTimeout(() => notification(NotificationFeedbackType.Success).catch(() => {}), 600);

    onSend?.(moment);
  }, [fadeAnim, scaleAnim, glowAnim, onSend]);

  // When panel is collapsed and no incoming signal, render nothing
  if (!visible && !receivedSignal) return null;

  // ── Incoming signal from partner ──
  if (receivedSignal) {
    const tint = receivedSignal.tint || t.primary;
    return (
      <Animated.View style={[
        styles.feedbackContainer,
        {
          opacity: receiveFadeAnim,
          transform: [{ scale: Animated.multiply(receiveScaleAnim, receivePulseAnim) }],
        },
      ]}>
        <View style={[styles.feedbackGlow, { backgroundColor: tint + '12' }]}>
          <View style={[styles.feedbackIconCircle, { backgroundColor: tint + '20', borderColor: tint + '30' }]}>
            <Icon name={receivedSignal.icon} size={30} color={tint} />
          </View>
        </View>
        <Text style={[styles.feedbackEyebrow, { color: tint }]}>
          {partnerLabel}
        </Text>
        <Text style={[styles.feedbackLabel, { color: t.text }]}>
          {receivedSignal.label}
        </Text>
      </Animated.View>
    );
  }

  // ── Sent confirmation ──
  if (sentType) {
    const sent = MOMENT_TYPES.find(m => m.id === sentType);
    const tint = sent?.tint || t.primary;
    return (
      <Animated.View style={[
        styles.feedbackContainer,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}>
        <Animated.View style={[styles.feedbackGlow, { backgroundColor: tint + '12', opacity: glowAnim }]}>
          <View style={[styles.feedbackIconCircle, { backgroundColor: tint + '20', borderColor: tint + '30' }]}>
            <Icon name={sent?.icon || 'heart-outline'} size={28} color={tint} />
          </View>
        </Animated.View>
        {/* Static icon on top of glow */}
        <View style={[styles.feedbackIconCircle, { backgroundColor: tint + '20', borderColor: tint + '30', position: 'absolute', top: SPACING.xl }]}>
          <Icon name={sent?.icon || 'heart-outline'} size={28} color={tint} />
        </View>
        <Text style={[styles.feedbackEyebrow, { color: t.subtext, marginTop: 72 }]}>
          Sent to {partnerLabel}
        </Text>
        <Text style={[styles.feedbackLabel, { color: t.text }]}>
          {sent?.label}
        </Text>
        {sendError && (
          <Text style={[styles.feedbackHint, { color: t.subtext }]}>
            {sendError}
          </Text>
        )}
      </Animated.View>
    );
  }

  // ── Moment grid ──
  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {MOMENT_TYPES.map((moment) => {
          const tint = moment.tint || t.primary;
          return (
            <TouchableOpacity
              key={moment.id}
              style={[styles.momentButton, {
                backgroundColor: isDark ? tint + '10' : tint + '08',
                borderColor: isDark ? tint + '18' : tint + '12',
              }]}
              onPress={() => handleSend(moment)}
              activeOpacity={0.65}
            >
              <View style={[styles.iconWrap, {
                backgroundColor: isDark ? tint + '22' : tint + '15',
              }]}>
                <Icon name={moment.icon} size={22} color={tint} />
              </View>
              <Text style={[styles.momentLabel, { color: isDark ? tint : t.text }]} numberOfLines={1}>
                {moment.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ------------------------------------------------------------------
// STYLES
// ------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    width: '100%',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  momentButton: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  momentLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.1,
  },

  // ── Feedback states (sent / received) ──
  feedbackContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    minHeight: 160,
    gap: 4,
  },
  feedbackGlow: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  feedbackIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackEyebrow: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  feedbackLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  feedbackHint: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '500',
    marginTop: SPACING.sm,
  },
});
