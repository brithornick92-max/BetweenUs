import CrashReporting from '../services/CrashReporting';

/**
 * DataContext.js — React context for the active data layer
 *
 * Provides:
 *   • DataLayer instance (configured with current user/couple)
 *   • Sync status (queue flush / connectivity status)
 *   • Offline queue flush on app foreground + periodic (every 60s)
 *   • Realtime subscription when provided by the active DataLayer
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
  useState,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { AppState } from 'react-native';
import { DataLayer } from '../services/localfirst';
import MemoryResurfacingService from '../services/MemoryResurfacingService';
import { MomentSignalSender } from '../services/ConnectionEngine';
import { supabase } from '../config/supabase';
import { useAuth } from './AuthContext';
import { useEntitlements } from './EntitlementsContext';
import { useAppContext as useApp } from './AppContext';
import { resolveActiveCoupleId } from '../utils/coupleProfile';

const DataContext = createContext(null);

const resolveActiveSupabaseUserId = async (fallbackId) => {
  let syncUserId = fallbackId;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (!supabase) break;
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id) { syncUserId = data.user.id; break; }
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    } catch (err) {
      if (__DEV__) console.warn('[DataContext] auth.getUser attempt', attempt + 1, 'failed:', err?.message);
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return syncUserId;
};

export function DataProvider({ children }) {
  const { user, userProfile } = useAuth();
  const { isPremiumEffective: isPremium } = useEntitlements();
  const { state: appState } = useApp();

  const userId = user?.id || user?.uid || appState?.userId;
  const coupleId = resolveActiveCoupleId({ appState, userProfile });
  const [syncStatus, setSyncStatus] = useState({
    syncing: false,
    lastSynced: null,
    lastError: null,
    pushed: 0,
    pulled: 0,
    failed: 0,
    remaining: 0,
  });

  const [isReady, setIsReady] = useState(false);
  const initializedRef = useRef(false);
  const unsubRealtimeRef = useRef(null);
  const unsubSyncEventRef = useRef(null);
  const syncIntervalRef = useRef(null);
  const applySyncResult = useCallback((result, source = 'sync') => {
    const failed = Number(result?.failed || 0);
    const remaining = Number(result?.remaining || 0);
    const flushed = Number(result?.flushed || 0);

    setSyncStatus((current) => ({
      ...current,
      syncing: false,
      lastSynced: failed > 0 ? current.lastSynced : new Date().toISOString(),
      lastError: failed > 0
        ? "Some changes haven't synced yet. We'll keep trying."
        : null,
      pushed: flushed,
      pulled: Number(result?.pulled || 0),
      failed,
      remaining,
      source,
    }));

    return result;
  }, []);


  // ─── Initialize on auth ─────────────────────────────────────

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    (async () => {
      try {
        // Resolve the Supabase auth UUID so all canonical writes line up with
        // Supabase auth/RLS expectations.
        const syncUserId = await resolveActiveSupabaseUserId(userId);

        await DataLayer.init({
          userId: syncUserId,
          legacyLocalUserId: syncUserId !== userId ? userId : null,
          coupleId: coupleId || null,
          isPremium: !!isPremium,
        });

        await DataLayer.migrateLegacyStorage();
        MemoryResurfacingService.schedule(DataLayer).catch(() => {});

        // Configure MomentSignalSender with the same Supabase UUID
        MomentSignalSender.configure({ userId: syncUserId, coupleId: coupleId || null });

        if (cancelled) return;
        initializedRef.current = true;
        setIsReady(true);

        // Listen to data-layer sync events when supported
        unsubSyncEventRef.current = DataLayer.onSyncEvent(async (event, data) => {
          if (event === 'sync:start') {
            setSyncStatus(s => ({ ...s, syncing: true }));
          } else if (event === 'sync:complete') {
            setSyncStatus({
              syncing: false,
              lastSynced: new Date().toISOString(),
              lastError: null,
              pushed: data?.pushed || 0,
              pulled: data?.pulled || 0,
              failed: data?.failed || 0,
              remaining: data?.remaining || 0,
            });
          } else if (event === 'sync:error') {
            setSyncStatus(s => ({
              ...s,
              syncing: false,
              lastError: data?.error || 'Sync failed',
              failed: data?.failed || 1,
              remaining: data?.remaining || s.remaining || 0,
            }));
          }
        });

        // Subscribe to realtime if the active data layer supports it
        if (coupleId) {
          unsubRealtimeRef.current = DataLayer.subscribeRealtime();
        }

        // Periodic queue flush every 60s
        syncIntervalRef.current = setInterval(() => {
          if (initializedRef.current) {
            DataLayer.sync()
              .then((result) => applySyncResult(result, 'periodic_sync'))
              .catch((e) => {
                if (__DEV__) console.warn('[DataContext] Periodic sync failed:', e?.message);
                setSyncStatus((s) => ({
                  ...s,
                  syncing: false,
                  lastError: "Some changes haven't synced yet. We'll keep trying.",
                  failed: s.failed || 1,
                }));
                CrashReporting.captureException(e, { source: 'periodic_sync' });
              });
          }
        }, 60_000);
      } catch (err) {
        if (__DEV__) console.error('[DataContext] Init failed:', err);
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
  }, [userId, coupleId, isPremium, applySyncResult]);

  // ─── Reconfigure when couple/premium changes ───────────────

  useEffect(() => {
    if (!initializedRef.current) return;
    let cancelled = false;
    // Re-resolve Supabase UUID on reconfigure
    (async () => {
      const syncUserId = await resolveActiveSupabaseUserId(userId);
      if (cancelled) return;

      try {
        await DataLayer.reconfigure({
          userId: syncUserId,
          legacyLocalUserId: syncUserId !== userId ? userId : null,
          coupleId: coupleId || null,
          isPremium: !!isPremium,
        });
        MomentSignalSender.configure({ userId: syncUserId, coupleId: coupleId || null });
      } catch (reconfigureErr) {
        CrashReporting.captureException(reconfigureErr, { source: 'data_reconfigure' });
      }
    })();
    return () => { cancelled = true; };
  }, [userId, coupleId, isPremium, applySyncResult]);

  // ─── Sync on app foreground ─────────────────────────────────

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && initializedRef.current) {
        DataLayer.sync()
          .then((result) => applySyncResult(result, 'foreground_sync'))
          .catch((e) => {
            if (__DEV__) console.warn('[DataContext] Foreground sync failed:', e?.message);
            setSyncStatus((s) => ({
              ...s,
              syncing: false,
              lastError: "Some changes haven't synced yet. We'll keep trying.",
              failed: s.failed || 1,
            }));
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
  }, [applySyncResult]);

  // ─── Trigger manual sync ───────────────────────────────────

  const triggerSync = useCallback(async () => {
    if (!initializedRef.current) return null;
    setSyncStatus((s) => ({ ...s, syncing: true }));

    try {
      const result = await DataLayer.sync();
      return applySyncResult(result, 'manual_sync');
    } catch (e) {
      setSyncStatus((s) => ({
        ...s,
        syncing: false,
        lastError: "Some changes haven't synced yet. We'll keep trying.",
        failed: s.failed || 1,
      }));
      CrashReporting.captureException(e, { source: 'manual_sync' });
      throw e;
    }
  }, [applySyncResult]);

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
