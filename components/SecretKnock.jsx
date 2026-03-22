/**
 * SecretKnock — Rhythmic Haptic Communication
 *
 * A dark, intimate canvas where one partner taps a rhythm on the glass.
 * The app records the exact timing of each tap, then transmits that
 * rhythm to the partner's phone, which plays back the identical pattern
 * as haptic impacts — like tapping "I love you" in Morse code.
 *
 * Modes:
 *   "record" — tap your rhythm, seal it, and send it
 *   "play"   — receives a rhythm array and plays it as haptics immediately
 *
 * Usage (sender):
 *   <SecretKnock
 *     mode="record"
 *     onSend={(offsets) => sendToPartner({ type: 'knock', offsets })}
 *   />
 *
 * Usage (receiver — e.g. from a push notification payload):
 *   <SecretKnock mode="play" rhythm={notification.data.offsets} />
 *
 * Static helper (call anywhere without mounting the component):
 *   SecretKnock.playRhythm([0, 420, 840, 1260]);
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import {
  impact,
  notification,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  playRhythm,
} from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import { withAlpha } from '../utils/theme';

const { width: W, height: H } = Dimensions.get('window');

const MAX_TAPS = 12;          // prevent accidental marathon sessions
const SEAL_DELAY_MS = 2200;   // ms of silence before the rhythm is sealed

// ─────────────────────────────────────────────────────────────
// Ripple — an expanding ring that emanates from each tap point
// ─────────────────────────────────────────────────────────────
function Ripple({ x, y, color, id, onDone }) {
  const scale = useSharedValue(0.15);
  const opacity = useSharedValue(0.85);

  useEffect(() => {
    scale.value = withTiming(3.5, {
      duration: 1000,
      easing: Easing.out(Easing.cubic),
    });
    opacity.value = withTiming(0, { duration: 1000, easing: Easing.out(Easing.quad) }, (finished) => {
      if (finished) runOnJS(onDone)(id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ripple,
        { left: x - 44, top: y - 44, borderColor: color },
        ringStyle,
      ]}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// TapDot — a bar in the visual rhythm timeline
// ─────────────────────────────────────────────────────────────
function TapDot({ active, color }) {
  return (
    <View
      style={[
        styles.dot,
        { backgroundColor: active ? color : withAlpha(color, 0.18) },
      ]}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
function SecretKnock({ mode = 'record', rhythm, onSend, style }) {
  const { colors } = useTheme();
  const primary = colors.primary; // Sexy Red #C3113D

  const [phase, setPhase] = useState('idle'); // idle | recording | sealed | playing
  const [tapCount, setTapCount] = useState(0);
  const [ripples, setRipples] = useState([]);
  const [sealedOffsets, setSealedOffsets] = useState(null);
  const [tapCoord, setTapCoord] = useState({ x: W / 2, y: H * 0.38 });

  const timestamps = useRef([]);
  const sealTimer = useRef(null);
  const rippleCounter = useRef(0);

  // Orb pulse values
  const orbScale = useSharedValue(1);
  const orbOpacity = useSharedValue(0.22);

  // ── Play received rhythm on mount if mode === 'play' ──────
  useEffect(() => {
    if (mode === 'play' && rhythm?.length) {
      setPhase('playing');
      playRhythm(rhythm, ImpactFeedbackStyle.Heavy);
    }
  }, []); // intentionally runs once on mount

  // ── Cleanup seal timer ────────────────────────────────────
  useEffect(() => () => { if (sealTimer.current) clearTimeout(sealTimer.current); }, []);

  // ── Seal the recorded rhythm after SEAL_DELAY of silence ─
  const handleSeal = useCallback(() => {
    const ts = timestamps.current;
    if (ts.length < 2) {
      // Not enough taps — reset to idle
      timestamps.current = [];
      setTapCount(0);
      setPhase('idle');
      return;
    }
    const origin = ts[0];
    const offsets = ts.map((t) => t - origin);
    setSealedOffsets(offsets);
    setPhase('sealed');
    notification(NotificationFeedbackType.Success);
  }, []);

  const scheduleSeal = useCallback(() => {
    if (sealTimer.current) clearTimeout(sealTimer.current);
    sealTimer.current = setTimeout(handleSeal, SEAL_DELAY_MS);
  }, [handleSeal]);

  // ── Remove a Ripple once its animation completes ──────────
  const removeRipple = useCallback((id) => {
    setRipples((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // ── Main tap handler ──────────────────────────────────────
  const handleTap = useCallback(
    (e) => {
      if (phase === 'sealed' || timestamps.current.length >= MAX_TAPS) return;

      if (phase === 'idle') setPhase('recording');

      const now = Date.now();
      timestamps.current.push(now);
      const count = timestamps.current.length;
      setTapCount(count);

      // Capture approximate tap position for ripple origin
      const lx = e.nativeEvent.locationX ?? W / 2;
      const ly = e.nativeEvent.locationY ?? H * 0.38;
      setTapCoord({ x: lx, y: ly });

      // Haptic — Heavy for satisfying "knock on glass" feel
      impact(ImpactFeedbackStyle.Heavy);

      // Orb pulse
      orbScale.value = withSequence(
        withSpring(1.55, { damping: 6, stiffness: 350 }),
        withSpring(1, { damping: 14, stiffness: 220 }),
      );
      orbOpacity.value = withSequence(
        withTiming(0.9, { duration: 60 }),
        withTiming(0.22, { duration: 700, easing: Easing.out(Easing.quad) }),
      );

      // Spawn ripple
      const id = ++rippleCounter.current;
      setRipples((prev) => [...prev, { id, x: lx, y: ly }]);

      // Reset seal timer
      scheduleSeal();
    },
    [phase, scheduleSeal, orbScale, orbOpacity],
  );

  // ── Send the sealed rhythm ────────────────────────────────
  const handleSend = useCallback(() => {
    if (!sealedOffsets) return;
    onSend?.(sealedOffsets);
    // Reset
    timestamps.current = [];
    setSealedOffsets(null);
    setTapCount(0);
    setPhase('idle');
    setRipples([]);
  }, [sealedOffsets, onSend]);

  // ── Reset and start over ──────────────────────────────────
  const handleReset = useCallback(() => {
    if (sealTimer.current) clearTimeout(sealTimer.current);
    timestamps.current = [];
    setSealedOffsets(null);
    setTapCount(0);
    setPhase('idle');
    setRipples([]);
  }, []);

  // ── Animated orb ──────────────────────────────────────────
  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
    opacity: orbOpacity.value,
  }));

  const isIdle = phase === 'idle';
  const isRecording = phase === 'recording';
  const isSealed = phase === 'sealed';
  const isPlaying = phase === 'playing';

  return (
    <View style={[styles.wrapper, style]}>
      {/* Dark vignette canvas */}
      <LinearGradient
        colors={['#09060B', '#130208', '#09060B']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Tap canvas ── */}
      <Pressable
        onPress={handleTap}
        style={styles.tapArea}
        disabled={isSealed || isPlaying}
        accessibilityLabel={isSealed ? 'Rhythm sealed' : 'Tap your knock rhythm'}
        accessibilityRole="button"
      >
        {/* Center glow orb — pulses on each tap */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.orbGlow,
            { backgroundColor: primary },
            orbStyle,
          ]}
        />

        {/* ── Tap counter dots ── */}
        <View style={styles.dotRow}>
          {Array.from({ length: MAX_TAPS }).map((_, i) => (
            <TapDot key={i} active={i < tapCount} color={primary} />
          ))}
        </View>

        {/* ── Status copy ── */}
        <Text style={[styles.statusLabel, { color: colors.text }]}>
          {isIdle     && 'Tap your rhythm'}
          {isRecording && `${tapCount} knock${tapCount !== 1 ? 's' : ''}…`}
          {isSealed   && 'Ready to send'}
          {isPlaying  && 'Feeling it…'}
        </Text>

        <Text style={[styles.statusSub, { color: colors.textMuted }]}>
          {isIdle     && 'Your partner will feel exactly this'}
          {isRecording && 'Wait to seal, or tap more'}
          {isSealed   && `${tapCount} beats — like a secret code`}
          {isPlaying  && 'Close your eyes'}
        </Text>
      </Pressable>

      {/* ── Ripple layer — pointerEvents=none so taps pass through ── */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {ripples.map((r) => (
          <Ripple
            key={r.id}
            id={r.id}
            x={r.x}
            y={r.y}
            color={primary}
            onDone={removeRipple}
          />
        ))}
      </View>

      {/* ── Action buttons — appear once rhythm is sealed ── */}
      {isSealed && (
        <View style={styles.actions}>
          <Pressable
            onPress={handleReset}
            style={[
              styles.btn,
              styles.btnGhost,
              { borderColor: withAlpha(primary, 0.4) },
            ]}
            accessibilityLabel="Re-tap rhythm"
            accessibilityRole="button"
          >
            <Text style={[styles.btnText, { color: colors.textMuted }]}>
              Re-tap
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSend}
            style={[styles.btn, { backgroundColor: primary }]}
            accessibilityLabel="Send knock to partner"
            accessibilityRole="button"
          >
            <Text style={[styles.btnText, { color: '#FFFFFF' }]}>
              Send Knock
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Static helper — play a received rhythm anywhere in the app
// without needing to mount the component.
//
//   const cancel = SecretKnock.playRhythm([0, 420, 840, 1680]);
//   // cancel() if the user navigates away mid-playback
// ─────────────────────────────────────────────────────────────
SecretKnock.playRhythm = (offsets, style = ImpactFeedbackStyle.Heavy) => {
  return playRhythm(offsets, style);
};

export default SecretKnock;

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    overflow: 'hidden',
  },
  tapArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  orbGlow: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 7,
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: W * 0.8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  statusSub: {
    fontSize: 14,
    letterSpacing: 0.4,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  ripple: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1.5,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 52,
  },
  btn: {
    flex: 1,
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: {
    borderWidth: 1,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
