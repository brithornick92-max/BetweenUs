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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import { SPACING, BORDER_RADIUS } from '../utils/theme';
import { MomentSignalSender, MOMENT_TYPES } from '../services/ConnectionEngine';

export default function MomentSignal({ partnerLabel = 'Partner', onSend }) {
  const { colors, isDark } = useTheme();

  // STRICT Apple Editorial Theme Map
  const t = useMemo(() => ({
    background: isDark ? '#000000' : '#F2F2F7', 
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    surfaceSecondary: isDark ? '#2C2C2E' : '#E5E5EA',
    primary: colors.primary,
    text: isDark ? '#FFFFFF' : '#000000',
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  const [sentType, setSentType] = useState(null);
  const [canSend, setCanSend] = useState(true);
  const [sendError, setSendError] = useState(null);
  const [receivedSignal, setReceivedSignal] = useState(null);
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const receiveFadeAnim = useRef(new Animated.Value(0)).current;
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
      notification(NotificationFeedbackType.Success).catch(() => {});

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

    selection();
    notification(NotificationFeedbackType.Success);
    setSentType(moment.id);
    setCanSend(false);
    setSendError(null);

    // Animate confirmation: fade + scale up
    scaleAnim.setValue(0.9);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.delay(3000),
        Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
    ]).start(() => {
      setSentType(null);
    });

    // Second gentle haptic pulse after a beat
    setTimeout(() => {
      impact(ImpactFeedbackStyle.Medium).catch(() => {});
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
  }, [canSend, fadeAnim, scaleAnim, onSend]);

  // Incoming signal banner
  if (receivedSignal) {
    return (
      <Animated.View style={[styles.sentContainer, { opacity: receiveFadeAnim }]}>
        <View style={styles.receivedIconContainer}>
          <MaterialCommunityIcons name={receivedSignal.icon} size={32} color={t.primary} />
        </View>
        <Text style={styles.sentText}>
          {partnerLabel} says...
        </Text>
        <Text style={styles.sentLabel}>
          "{receivedSignal.label}"
        </Text>
      </Animated.View>
    );
  }

  if (sentType) {
    const sent = MOMENT_TYPES.find(m => m.id === sentType);
    return (
      <Animated.View style={[styles.sentContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.checkCircle}>
          <MaterialCommunityIcons name="check" size={28} color={t.surface} />
        </View>
        <Text style={styles.sentText}>
          Sent to {partnerLabel}
        </Text>
        <Text style={styles.sentLabel}>
          "{sent?.label}"
        </Text>
        {sendError && (
          <Text style={styles.errorText}>
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
                opacity: canSend ? 1 : 0.5,
              },
            ]}
            onPress={() => handleSend(moment)}
            disabled={!canSend}
            activeOpacity={0.7}
          >
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons
                name={moment.icon}
                size={22}
                color={t.primary}
              />
            </View>
            <Text
              style={styles.momentLabel}
              numberOfLines={1}
            >
              {moment.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {!canSend && (
        <Text style={styles.cooldownText}>
          Sent recently · you can send again soon
        </Text>
      )}
    </View>
  );
}

// ------------------------------------------------------------------
// STYLES - Apple Editorial
// ------------------------------------------------------------------
const createStyles = (t, isDark) => {
  const systemFont = Platform.select({ ios: "System", android: "Roboto" });

  return StyleSheet.create({
    container: {
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.sm,
      width: '100%',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'center',
    },
    momentButton: {
      width: '30%',
      alignItems: 'center',
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.xs,
      backgroundColor: t.surfaceSecondary,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      gap: 8,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: t.surface,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: isDark ? 0 : 0.05, shadowRadius: 4 },
        android: { elevation: 1 },
      }),
    },
    momentLabel: {
      fontFamily: systemFont,
      fontSize: 11,
      fontWeight: '600',
      color: t.subtext,
      textAlign: 'center',
      letterSpacing: 0.1,
    },
    
    // State Feedback (Sent / Received)
    sentContainer: {
      alignItems: 'center',
      paddingVertical: SPACING.xl,
      gap: 6,
    },
    checkCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: t.text, // Solid contrast Apple success mark
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.sm,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0 : 0.15, shadowRadius: 8 },
        android: { elevation: 3 },
      }),
    },
    receivedIconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: t.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.sm,
    },
    sentText: {
      fontFamily: systemFont,
      fontSize: 18,
      fontWeight: '700',
      color: t.text,
      letterSpacing: -0.2,
    },
    sentLabel: {
      fontFamily: systemFont,
      fontSize: 15,
      fontWeight: '500',
      color: t.subtext,
      fontStyle: 'italic',
    },
    errorText: {
      fontFamily: systemFont,
      fontSize: 12,
      fontWeight: '500',
      color: t.subtext,
      marginTop: SPACING.sm,
    },
    cooldownText: {
      fontFamily: systemFont,
      fontSize: 12,
      fontWeight: '500',
      color: t.subtext,
      textAlign: 'center',
      marginTop: SPACING.md,
    },
  });
};
