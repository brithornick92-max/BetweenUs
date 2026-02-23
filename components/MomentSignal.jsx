// components/MomentSignal.jsx — "Thinking of you" one-tap micro-connections
// No words needed. Just presence.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { SPACING, BORDER_RADIUS } from '../utils/theme';
import { MomentSignalSender, MOMENT_TYPES } from '../services/ConnectionEngine';

const FONTS = {
  body: Platform.select({
    ios: 'Inter',
    android: 'Inter_400Regular',
    default: 'sans-serif',
  }),
  bodyBold: Platform.select({
    ios: 'Inter-SemiBold',
    android: 'Inter_600SemiBold',
    default: 'sans-serif',
  }),
};

export default function MomentSignal({ partnerLabel = 'Partner', onSend }) {
  const { colors } = useTheme();
  const [sentType, setSentType] = useState(null);
  const [canSend, setCanSend] = useState(true);
  const [sendError, setSendError] = useState(null);
  const [receivedSignal, setReceivedSignal] = useState(null);
  const fadeAnim = useState(() => new Animated.Value(0))[0];
  const scaleAnim = useState(() => new Animated.Value(0.8))[0];
  const receiveFadeAnim = useState(() => new Animated.Value(0))[0];
  const unsubRef = useRef(null);

  // Check send availability on mount
  useEffect(() => {
    MomentSignalSender.canSend().then(setCanSend);
  }, []);

  // Subscribe to incoming partner signals
  useEffect(() => {
    unsubRef.current = MomentSignalSender.subscribeToSignals((signal) => {
      const momentDef = MOMENT_TYPES.find(m => m.id === signal.moment_type);
      if (!momentDef) return;

      setReceivedSignal(momentDef);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      // Fade in, hold, fade out
      Animated.sequence([
        Animated.timing(receiveFadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.delay(3500),
        Animated.timing(receiveFadeAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start(() => {
        setReceivedSignal(null);
      });
    });

    return () => {
      if (typeof unsubRef.current === 'function') unsubRef.current();
    };
  }, [receiveFadeAnim]);

  const handleSend = useCallback(async (moment) => {
    if (!canSend) return;

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSentType(moment.id);
    setCanSend(false);
    setSendError(null);

    // Animate confirmation: fade + scale up
    scaleAnim.setValue(0.8);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(3000),
        Animated.timing(fadeAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
    ]).start(() => {
      setSentType(null);
    });

    // Second gentle haptic pulse after a beat
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }, 400);

    const result = await MomentSignalSender.send(moment.id);

    if (!result.sent) {
      // Cooldown blocked it — re-enable after cooldown
      setSendError(result.error || 'Please wait before sending again');
      setCanSend(false);
    } else if (result.error) {
      // Sent locally but remote failed — show subtle warning
      setSendError('Sent locally — will sync when connected');
    }

    onSend?.(moment);
  }, [canSend, fadeAnim, onSend]);

  // Incoming signal banner
  if (receivedSignal) {
    return (
      <Animated.View style={[styles.sentContainer, { opacity: receiveFadeAnim }]}>
        <MaterialCommunityIcons name={receivedSignal.icon} size={24} color={colors.primary} />
        <Text style={[styles.sentText, { color: colors.text }]}>
          {partnerLabel} says...
        </Text>
        <Text style={[styles.sentLabel, { color: colors.textMuted }]}>
          {receivedSignal.label}
        </Text>
      </Animated.View>
    );
  }

  if (sentType) {
    const sent = MOMENT_TYPES.find(m => m.id === sentType);
    return (
      <Animated.View style={[styles.sentContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={[styles.checkCircle, { backgroundColor: colors.primary }]}>
          <MaterialCommunityIcons name="check" size={28} color="#fff" />
        </View>
        <Text style={[styles.sentText, { color: colors.text }]}>
          Sent to {partnerLabel}
        </Text>
        <Text style={[styles.sentLabel, { color: colors.textMuted }]}>
          {sent?.label}
        </Text>
        {sendError && (
          <Text style={[styles.errorText, { color: colors.textMuted }]}>
            {sendError}
          </Text>
        )}
      </Animated.View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {MOMENT_TYPES.map((moment) => (
          <TouchableOpacity
            key={moment.id}
            style={[
              styles.momentButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: canSend ? 1 : 0.4,
              },
            ]}
            onPress={() => handleSend(moment)}
            disabled={!canSend}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={moment.icon}
              size={22}
              color={colors.primary}
            />
            <Text
              style={[styles.momentLabel, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              {moment.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {!canSend && (
        <Text style={[styles.cooldownText, { color: colors.textMuted }]}>
          Sent recently · you can send again soon
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    justifyContent: 'center',
  },
  momentButton: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    gap: 6,
  },
  momentLabel: {
    fontFamily: FONTS.body,
    fontSize: 11,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  sentContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  checkCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  sentText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
  },
  sentLabel: {
    fontFamily: FONTS.body,
    fontSize: 13,
    fontStyle: 'italic',
  },
  errorText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: SPACING.xs,
    opacity: 0.7,
  },
  cooldownText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    textAlign: 'center',
    marginTop: SPACING.sm,
    fontStyle: 'italic',
  },
});
