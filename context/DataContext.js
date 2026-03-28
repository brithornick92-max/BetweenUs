import CrashReporting from '../services/CrashReporting';

/**
 * DataContext.js — React context for the local-first + E2EE data layer
 *
 * Provides:
 *   • DataLayer instance (configured with current user/couple)
 *   • Sync status (syncing, lastSynced, error)
 *   • Auto-sync on app foreground + periodic (every 60s)
 *   • Realtime subscription for partner changes
 *
 * Wrap your app with <DataProvider> after <AuthProvider> and
 * <SubscriptionProvider> so it can read userId, coupleId, isPremium.
 *
 * Usage:
 *   const { data, syncStatus, triggerSync } = useData();
 *   const entries = await data.getJournalEntries();
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from 'react';
import { AppState } from 'react-native';
import { DataLayer, SyncEngine, Database } from '../services/localfirst';
import { MomentSignalSender } from '../services/ConnectionEngine';
import { supabase } from '../config/supabase';
import { useAuth } from './AuthContext';
import { useEntitlements } from './EntitlementsContext';
import { useAppContext as useApp } from './AppContext';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { user } = useAuth();
  const { isPremiumEffective: isPremium } = useEntitlements();
  const { state: appState, actions: appActions } = useApp();

  const userId = user?.id || user?.uid || appState?.userId;
  const coupleId = appState?.coupleId;
  const appActionsRef = useRef(appActions);
  appActionsRef.current = appActions;

  const [syncStatus, setSyncStatus] = useState({
    syncing: false,
    lastSynced: null,
    lastError: null,
    pushed: 0,
    pulled: 0,
  });

  const [isReady, setIsReady] = useState(false);
  const initializedRef = useRef(false);
  const unsubRealtimeRef = useRef(null);
  const unsubSyncEventRef = useRef(null);
  const syncIntervalRef = useRef(null);

  // ─── Initialize on auth ─────────────────────────────────────

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    (async () => {
      try {
        // Resolve the Supabase auth UUID — this MUST be used as userId for
        // SyncEngine so that `created_by` matches `auth.uid()` in RLS policies.
        // The local Crypto.randomUUID() from AppContext does NOT match and
        // causes every couple_data INSERT to be silently rejected by RLS.
        let syncUserId = userId;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            if (!supabase) break; // supabase is null — no point retrying
            const { data } = await supabase.auth.getUser();
            if (data?.user?.id) { syncUserId = data.user.id; break; }
            // User not returned yet — retry after backoff
            if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          } catch (err) {
            console.warn('[DataContext] auth.getUser attempt', attempt + 1, 'failed:', err?.message);
            if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          }
        }

        await DataLayer.init({
          userId: syncUserId,
          legacyLocalUserId: syncUserId !== userId ? userId : null,
          coupleId: coupleId || null,
          isPremium: !!isPremium,
        });

        await DataLayer.migrateLegacyStorage();

        // Configure MomentSignalSender with the same Supabase UUID
        MomentSignalSender.configure({ userId: syncUserId, coupleId: coupleId || null });

        if (cancelled) return;
        initializedRef.current = true;
        setIsReady(true);

        // Listen to sync events
        unsubSyncEventRef.current = SyncEngine.onSyncEvent(async (event, data) => {
          if (event === 'sync:start') {
            setSyncStatus(s => ({ ...s, syncing: true }));
          } else if (event === 'sync:complete') {
            setSyncStatus({
              syncing: false,
              lastSynced: new Date().toISOString(),
              lastError: null,
              pushed: data?.pushed || 0,
              pulled: data?.pulled || 0,
            });
          } else if (event === 'sync:error') {
            setSyncStatus(s => ({
              ...s,
              syncing: false,
              lastError: data?.error || 'Sync failed',
            }));
          } else if (event === 'sync:realtime' && data?.table === 'vibes') {
            // Partner sent a new vibe — fetch it and push to AppContext
            try {
              const { Database } = await import('../services/localfirst');
              const partnerVibe = await Database.getPartnerLatestVibe(userId, coupleId);
              if (partnerVibe?.vibe) {
                const parsed = (() => { try { return JSON.parse(partnerVibe.vibe); } catch { return partnerVibe.vibe; } })();
                appActionsRef.current?.setPartnerVibe(parsed);
              }
            } catch (err) {
              console.warn('[DataContext] Failed to fetch partner vibe:', err.message);
            }
          }
        });

        // Subscribe to realtime if coupled + premium
        if (coupleId && isPremium) {
          unsubRealtimeRef.current = SyncEngine.subscribeRealtime();
        }

        // Periodic sync every 60s
        syncIntervalRef.current = setInterval(() => {
          if (initializedRef.current) {
            SyncEngine.sync().catch((e) => {
              if (__DEV__) console.warn('[DataContext] Periodic sync failed:', e?.message);
              CrashReporting.captureException(e, { source: 'periodic_sync' });
            });
          }
        }, 60_000);
      } catch (err) {
        console.error('[DataContext] Init failed:', err);
        CrashReporting.captureException(err, { source: 'datacontext_init' });
      }
    })();

    return () => {
      cancelled = true;
      initializedRef.current = false;
      setIsReady(false);
      unsubRealtimeRef.current?.();
      unsubSyncEventRef.current?.();
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [userId, coupleId, isPremium]);

  // ─── Reconfigure when couple/premium changes ───────────────

  useEffect(() => {
    if (!initializedRef.current) return;
    let cancelled = false;
    // Re-resolve Supabase UUID on reconfigure
    (async () => {
      let syncUserId = userId;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (supabase) {
            const { data } = await supabase.auth.getUser();
            if (data?.user?.id) { syncUserId = data.user.id; break; }
          }
          break;
        } catch (err) {
          console.warn('[DataContext] reconfigure auth.getUser attempt', attempt + 1, 'failed:', err?.message);
          if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
      if (cancelled) return;

      DataLayer.reconfigure({
        userId: syncUserId,
        legacyLocalUserId: syncUserId !== userId ? userId : null,
        coupleId: coupleId || null,
        isPremium: !!isPremium,
      });
      MomentSignalSender.configure({ userId: syncUserId, coupleId: coupleId || null });
    })();
    return () => { cancelled = true; };
  }, [userId, coupleId, isPremium]);

  // ─── Sync on app foreground ─────────────────────────────────

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && initializedRef.current) {
        SyncEngine.sync().catch((e) => {
          if (__DEV__) console.warn('[DataContext] Foreground sync failed:', e?.message);
          CrashReporting.captureException(e, { source: 'foreground_sync' });
        });
      }
      if (nextState === 'background') {
        DataLayer.clearCache().catch((e) => {
          if (__DEV__) console.warn('[DataContext] Cache clear failed:', e?.message);
        });
      }
    });
    return () => sub.remove();
  }, []);

  // ─── Trigger manual sync ───────────────────────────────────

  const triggerSync = useCallback(async () => {
    if (!initializedRef.current) return;
    return SyncEngine.sync();
  }, []);

  // ─── Context value ─────────────────────────────────────────

  const value = useMemo(() => ({
    /** The DataLayer API — use this for all reads/writes */
    data: DataLayer,
    /** Current sync status */
    syncStatus,
    /** Manually trigger a sync cycle */
    triggerSync,
    /** Whether the data layer has been initialized */
    isReady,
  }), [syncStatus, triggerSync, isReady]);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within <DataProvider>');
  }
  return context;
}

export default DataContext;
