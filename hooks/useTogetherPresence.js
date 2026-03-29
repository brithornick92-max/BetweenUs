/**
 * useTogetherPresence — Supabase Realtime Presence
 *
 * Joins a presence channel scoped to the couple. Returns { isTogetherNow }
 * which is true when BOTH partners have the app open at the same time —
 * the digital equivalent of sitting on the same couch.
 *
 * The channel is automatically:
 *   • Connected when the component mounts or the app returns to foreground
 *   • Disconnected when the app backgrounds (saves battery + Supabase connections)
 *   • Cleaned up on unmount
 *
 * Usage:
 *   const { isTogetherNow } = useTogetherPresence();
 *   <GlowOrb togetherNow={isTogetherNow} color={colors.primaryGlow} />
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../config/supabase';
import { useAppContext } from '../context/AppContext';

// ── Resolve a valid Supabase auth UUID.
//    If the session has expired, attempt silent re-auth via stored credentials.
//    Falls back to localUserId if nothing works.
const _resolvePresenceKey = async (localUserId) => {
  if (!supabase) return localUserId;
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user?.id) return data.user.id;
  } catch (_) {}
  // Try silent re-auth
  try {
    const { SupabaseAuthService } = require('../services/supabase/SupabaseAuthService');
    const session = await SupabaseAuthService.signInWithStoredCredentials();
    if (session?.user?.id) return session.user.id;
  } catch (_) {}
  // Last resort: sign in anonymously to get a real JWT for Realtime
  try {
    const { data } = await supabase.auth.signInAnonymously();
    if (data?.user?.id) return data.user.id;
  } catch (_) {}
  return localUserId;
};

export function useTogetherPresence() {
  const { state } = useAppContext();
  const { coupleId, userId: localUserId } = state;

  const [isTogetherNow, setIsTogetherNow] = useState(false);

  const channelRef = useRef(null);
  const retryTimerRef = useRef(null);
  const connectCancelRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  // ── Disconnect from presence channel ──────────────────────────────────────
  const cleanup = useCallback(() => {
    // Cancel any in-flight async connect() so it doesn't set channelRef after cleanup
    if (connectCancelRef.current) {
      connectCancelRef.current.cancel();
      connectCancelRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (channelRef.current) {
      supabase?.removeChannel(channelRef.current).catch(() => {});
      channelRef.current = null;
    }
    setIsTogetherNow(false);
  }, []);

  // ── Connect and start tracking presence ───────────────────────────────────
  const connect = useCallback(() => {
    if (!supabase || !coupleId || !localUserId) return;
    if (channelRef.current) return; // already subscribed

    let connectCancelled = false;
    const cancelToken = { cancel: () => { connectCancelled = true; } };
    // Store cancel token so cleanup() can abort an in-flight connect
    connectCancelRef.current = cancelToken;

    _resolvePresenceKey(localUserId).then((presenceKey) => {
      // Bail if cleanup ran or another connect() won the race
      if (connectCancelled || channelRef.current) return;

      const channel = supabase.channel(`couple-presence:${coupleId}`, {
        config: { presence: { key: presenceKey } },
      });

      const checkTogether = () => {
        const presenceState = channel.presenceState();
        const partnerOnline = Object.keys(presenceState).some((k) => k !== presenceKey);
        setIsTogetherNow(partnerOnline);
      };

      channel
        .on('presence', { event: 'sync' }, checkTogether)
        .on('presence', { event: 'join' }, checkTogether)
        .on('presence', { event: 'leave' }, checkTogether)
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({ online_at: new Date().toISOString() }).catch(() => {});
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            // Channel failed — clear ref and retry after a short delay
            channelRef.current = null;
            setIsTogetherNow(false);
            if (retryTimerRef.current) return; // already scheduled
            retryTimerRef.current = setTimeout(() => {
              retryTimerRef.current = null;
              connect();
            }, 5000);
          }
        });

      channelRef.current = channel;
    }).catch((err) => {
      if (connectCancelled) return;
      if (__DEV__) console.warn('[Presence] Failed to resolve presence key:', err?.message);
      setIsTogetherNow(false);
    });
  }, [coupleId, localUserId]);

  // ── Mount / unmount ────────────────────────────────────────────────────────
  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  // ── Pause on background, resume on foreground ─────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'active' && prev !== 'active') {
        connect();
      } else if (nextState.match(/inactive|background/)) {
        cleanup();
      }
    });
    return () => sub.remove();
  }, [connect, cleanup]);

  return { isTogetherNow };
}
