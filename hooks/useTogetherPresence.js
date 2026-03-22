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

export function useTogetherPresence() {
  const { state } = useAppContext();
  const { coupleId, userId } = state;

  const [isTogetherNow, setIsTogetherNow] = useState(false);

  const channelRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  // ── Disconnect from presence channel ──────────────────────────────────────
  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase?.removeChannel(channelRef.current).catch(() => {});
      channelRef.current = null;
    }
    setIsTogetherNow(false);
  }, []);

  // ── Connect and start tracking presence ───────────────────────────────────
  const connect = useCallback(() => {
    if (!supabase || !coupleId || !userId) return;
    if (channelRef.current) return; // already subscribed

    const channel = supabase.channel(`couple-presence:${coupleId}`, {
      config: { presence: { key: userId } },
    });

    const checkTogether = () => {
      const presenceState = channel.presenceState();
      // True if any slot key other than our own userId has at least one entry
      const partnerOnline = Object.keys(presenceState).some((k) => k !== userId);
      setIsTogetherNow(partnerOnline);
    };

    channel
      .on('presence', { event: 'sync' }, checkTogether)
      .on('presence', { event: 'join' }, checkTogether)
      .on('presence', { event: 'leave' }, checkTogether)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Announce our presence to the partner
          await channel
            .track({ online_at: new Date().toISOString() })
            .catch(() => {});
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Silently untrack and let the AppState listener reconnect on next foreground
          channelRef.current = null;
          setIsTogetherNow(false);
        }
      });

    channelRef.current = channel;
  }, [coupleId, userId]);

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
