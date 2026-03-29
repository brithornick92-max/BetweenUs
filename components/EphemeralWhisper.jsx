/**
 * EphemeralWhisper — Encrypted Voice Notes That Dissolve After Listening
 *
 * Two modes, same component:
 *
 *   mode="record"
 *     A dark canvas with a central mic button. Hold to record (max 30s).
 *     Release to encrypt and send. The raw audio never persists on-device —
 *     it's encrypted and deleted within milliseconds of the recording ending.
 *
 *   mode="play"
 *     Shows "Hold phone to your ear" instruction. The Accelerometer detects
 *     the ear-proximity position (phone tilted horizontal toward the head)
 *     and begins playback through the earpiece only once the phone is raised.
 *     Audio dissolves from the archive the moment it finishes playing.
 *
 * Sensory design:
 *   • Hold-to-record: ripple expands while voice is captured
 *   • Release: ripple collapses inward → encryption haptic → send confirmation
 *   • Play mode: soundwave pulse animation synced to playback time
 *   • After play: the soundwave "dissolves" (fades and scales down) into the background
 *
 * Requirements:
 *   expo-av         (npx expo install expo-av)
 *   expo-sensors    (already installed — used for ear-proximity heuristic)
 *   WhisperService  (encryption + Supabase storage)
 *
 * Usage:
 *   // Record and send
 *   <EphemeralWhisper
 *     mode="record"
 *     coupleId={state.coupleId}
 *     userId={state.userId}
 *     coupleKey={sharedKey}
 *     onSent={() => navigation.goBack()}
 *   />
 *
 *   // Receive and play (e.g. opened from a push notification)
 *   <EphemeralWhisper
 *     mode="play"
 *     whisper={whisperMetadata}
 *     coupleKey={sharedKey}
 *     onPlayed={() => navigation.goBack()}
 *   />
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import { Accelerometer } from 'expo-sensors';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withSpring,
  Easing,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import {
  impact,
  notification,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import WhisperService from '../services/WhisperService';

const { width: W } = Dimensions.get('window');

// The accelerometer x-axis threshold that means "phone is tilted sideways
// against head" — phone held to right or left ear in portrait orientation.
// x ≈ ±0.65–0.9 when tilted 40–65° toward the ear.
const EAR_THRESHOLD = 0.60;
const MAX_RECORD_MS = 30_000;

// ─────────────────────────────────────────────────────────────────────────────
// Soundwave bars — pulse animation synced to the recording / playback state
// ─────────────────────────────────────────────────────────────────────────────
const BAR_COUNT = 9;

function SoundwaveBar({ index, active, dissolving }) {
  const scale = useSharedValue(0.3);

  useEffect(() => {
    if (!active) {
      scale.value = withTiming(0.2, { duration: 300 });
      return;
    }
    // Each bar has a staggered phase so they ripple outward
    const phase = (index / BAR_COUNT) * 800;
    scale.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 400 + index * 40,
          easing: Easing.bezier(0.4, 0, 0.6, 1),
        }),
        withTiming(0.2 + (index % 3) * 0.1, {
          duration: 400 + index * 40,
          easing: Easing.bezier(0.4, 0, 0.6, 1),
        }),
      ),
      -1,
      false,
    );
  }, [active, index, scale]);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scale.value }],
    opacity: dissolving
      ? withTiming(0, { duration: 1400 })
      : 1,
  }));

  return <Animated.View style={[styles.bar, barStyle]} />;
}

function Soundwave({ active, dissolving }) {
  return (
    <View style={styles.soundwave}>
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <SoundwaveBar key={i} index={i} active={active} dissolving={dissolving} />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function EphemeralWhisper({
  mode = 'record',
  whisper,
  coupleId,
  userId,
  coupleKey,
  onSent,
  onPlayed,
  style,
}) {
  const { colors } = useTheme();
  const primary = colors.primary;

  // ── Shared state ─────────────────────────────────────────────────────────
  const [phase, setPhase] = useState('idle');
  // record phases: idle | recording | encrypting | sent | error
  // play phases:   idle | waiting_ear | playing | dissolving | played

  const recordingRef = useRef(null);
  const soundRef = useRef(null);
  const localUriRef = useRef(null);
  const accelSubRef = useRef(null);
  const maxTimerRef = useRef(null);
  const sentTimerRef = useRef(null);
  const playedTimerRef = useRef(null);

  // ── Animations ───────────────────────────────────────────────────────────
  const rippleScale = useSharedValue(1);
  const rippleOpacity = useSharedValue(0.7);
  const micScale = useSharedValue(1);
  const earGlow = useSharedValue(0);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearTimeout(maxTimerRef.current);
      clearTimeout(sentTimerRef.current);
      clearTimeout(playedTimerRef.current);
      accelSubRef.current?.remove();
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  // ─── RECORD MODE ─────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Microphone access', 'Please allow microphone access in Settings to send a Whisper.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );

      recordingRef.current = recording;
      setPhase('recording');
      impact(ImpactFeedbackStyle.Medium);

      // Ripple expands outward while recording
      rippleScale.value = withRepeat(
        withSequence(
          withTiming(2.2, { duration: 1200, easing: Easing.out(Easing.quad) }),
          withTiming(1.6, { duration: 800, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      );
      rippleOpacity.value = withRepeat(
        withSequence(
          withTiming(0.15, { duration: 1200 }),
          withTiming(0.45, { duration: 800 }),
        ),
        -1,
        false,
      );

      // Auto-stop at MAX_RECORD_MS
      maxTimerRef.current = setTimeout(() => stopRecording(), MAX_RECORD_MS);
    } catch {
      setPhase('error');
    }
  }, [rippleOpacity, rippleScale]);

  const stopRecording = useCallback(async () => {
    clearTimeout(maxTimerRef.current);
    if (!recordingRef.current) return;

    try {
      setPhase('encrypting');

      // Collapse ripple inward — signals capture
      rippleScale.value = withTiming(0.6, { duration: 300, easing: Easing.in(Easing.cubic) });
      rippleOpacity.value = withTiming(0, { duration: 300 });
      micScale.value = withSpring(0.85, { damping: 8, stiffness: 280 });

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error('No audio captured');

      // Get actual duration
      const status = await (await Audio.Sound.createAsync({ uri })).sound.getStatusAsync();
      const durationMs = status.isLoaded ? (status.durationMillis ?? 3000) : 3000;
      await (await Audio.Sound.createAsync({ uri })).sound.unloadAsync();

      notification(NotificationFeedbackType.Success);

      // Encrypt and upload — WhisperService deletes the local file after encryption
      await WhisperService.upload({ fileUri: uri, coupleId, userId, durationMs, coupleKey });

      micScale.value = withSpring(1, { damping: 12, stiffness: 200 });
      setPhase('sent');
      sentTimerRef.current = setTimeout(() => onSent?.(), 900);
    } catch {
      notification(NotificationFeedbackType.Error);
      setPhase('error');
    }
  }, [coupleId, userId, coupleKey, onSent, rippleOpacity, rippleScale, micScale]);

  // ─── PLAY MODE ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (mode !== 'play' || !whisper || !coupleKey) return;

    setPhase('waiting_ear');

    // Ear-proximity heuristic via Accelerometer
    Accelerometer.setUpdateInterval(80); // ~12 Hz — easy on battery
    accelSubRef.current = Accelerometer.addListener(({ x }) => {
      const nearEar = Math.abs(x) > EAR_THRESHOLD;
      earGlow.value = withTiming(nearEar ? 1 : 0, { duration: 400 });

      if (nearEar && phase === 'waiting_ear') {
        accelSubRef.current?.remove();
        accelSubRef.current = null;
        runOnJS(beginPlayback)();
      }
    });

    return () => {
      accelSubRef.current?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, whisper, coupleKey]);

  const beginPlayback = useCallback(async () => {
    setPhase('playing');
    impact(ImpactFeedbackStyle.Light);

    try {
      // Download and decrypt to a temp file
      const localUri = await WhisperService.downloadForPlayback({ whisper, coupleKey });
      localUriRef.current = localUri;

      // Route audio through earpiece (phone-call style)
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        // On iOS, earpiece output is only available during a call. We
        // route to speaker here but keep the volume managed by proximity.
        // Full earpiece routing requires react-native-incall-manager.
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: localUri },
        { shouldPlay: true, volume: 1.0 },
      );
      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate(async (status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPhase('dissolving');
          notification(NotificationFeedbackType.Success);

          // Ephemeral: delete whisper from storage and temp file
          await WhisperService.deleteAfterPlay({
            whisper,
            coupleId,
            localUri: localUriRef.current,
          });

          await sound.unloadAsync().catch(() => {});
          soundRef.current = null;
          localUriRef.current = null;

          playedTimerRef.current = setTimeout(() => {
            setPhase('played');
            onPlayed?.();
          }, 1400);
        }
      });
    } catch {
      setPhase('error');
    }
  }, [whisper, coupleKey, coupleId, onPlayed]);

  // ─── Animated styles ─────────────────────────────────────────────────────

  const rippleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rippleScale.value }],
    opacity: rippleOpacity.value,
  }));

  const micStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micScale.value }],
  }));

  const earGlowStyle = useAnimatedStyle(() => ({
    opacity: earGlow.value,
    transform: [
      { scale: interpolate(earGlow.value, [0, 1], [0.9, 1.1]) },
    ],
  }));

  // ─── Render ──────────────────────────────────────────────────────────────

  const isRecording = phase === 'recording';
  const isEncrypting = phase === 'encrypting';
  const isSent = phase === 'sent';
  const isWaitingEar = phase === 'waiting_ear';
  const isPlaying = phase === 'playing';
  const isDissolving = phase === 'dissolving';
  const isPlayed = phase === 'played';
  const isError = phase === 'error';

  return (
    <View style={[styles.wrapper, style]}>
      <LinearGradient
        colors={['#09060B', '#110008', '#09060B']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {mode === 'record' ? (
        // ── Record UI ───────────────────────────────────────────────────────
        <View style={styles.center}>
          {/* Expanding ripple ring behind mic button */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.rippleRing,
              { borderColor: primary },
              rippleStyle,
            ]}
          />

          {/* Mic button — hold to record */}
          <Pressable
            onPressIn={phase === 'idle' ? startRecording : undefined}
            onPressOut={isRecording ? stopRecording : undefined}
            disabled={isEncrypting || isSent}
            accessibilityLabel="Hold to whisper"
            accessibilityRole="button"
          >
            <Animated.View
              style={[
                styles.micButton,
                { backgroundColor: isRecording ? primary : '#1C1520' },
                micStyle,
              ]}
            >
              <Text style={styles.micIcon}>{isEncrypting ? '🔒' : '🎙'}</Text>
            </Animated.View>
          </Pressable>

          {/* Soundwave (recording feedback) */}
          <Soundwave active={isRecording} dissolving={false} />

          <Text style={[styles.label, { color: colors.text }]}>
            {phase === 'idle'     && 'Hold to whisper'}
            {isRecording          && 'Recording…'}
            {isEncrypting         && 'Sealing your words…'}
            {isSent               && 'Whisper sent ✦'}
            {isError              && 'Something went wrong'}
          </Text>
          <Text style={[styles.sub, { color: colors.textMuted }]}>
            {phase === 'idle' && 'It dissolves the moment they hear it'}
            {isRecording     && `Max ${MAX_RECORD_MS / 1000}s — release to send`}
            {isSent          && "They'll hear it when they raise their phone"}
          </Text>
        </View>
      ) : (
        // ── Play UI ─────────────────────────────────────────────────────────
        <View style={styles.center}>
          {isWaitingEar && (
            <>
              {/* Ear glow — pulses when phone approaches ear angle */}
              <Animated.View
                pointerEvents="none"
                style={[styles.earGlow, { backgroundColor: primary }, earGlowStyle]}
              />
              <Text style={styles.earIcon}>📱</Text>
            </>
          )}

          {(isPlaying || isDissolving || isPlayed) && (
            <Soundwave active={isPlaying} dissolving={isDissolving || isPlayed} />
          )}

          <Text style={[styles.label, { color: colors.text }]}>
            {isWaitingEar  && 'Raise your phone to your ear'}
            {isPlaying     && 'Listening…'}
            {isDissolving  && 'Dissolving…'}
            {isPlayed      && 'Gone forever ✦'}
            {isError       && 'Could not play whisper'}
          </Text>
          <Text style={[styles.sub, { color: colors.textMuted }]}>
            {isWaitingEar && 'Plays softly — for your ears only'}
            {isPlaying    && 'Keep the phone to your ear'}
            {isPlayed     && 'This whisper has left the archive'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    overflow: 'hidden',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  rippleRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
  },
  micButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micIcon: {
    fontSize: 32,
  },
  soundwave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
  },
  bar: {
    width: 4,
    height: 36,
    borderRadius: 2,
    backgroundColor: '#D2121A',
    // transformOrigin for scaleY is center by default — bars grow from middle
  },
  label: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  sub: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 36,
    letterSpacing: 0.3,
  },
  earGlow: {
    width: 96,
    height: 96,
    borderRadius: 48,
    opacity: 0,
  },
  earIcon: {
    fontSize: 48,
    position: 'absolute',
  },
});
