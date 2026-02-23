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
        await DataLayer.init({
          userId,
          coupleId: coupleId || null,
          isPremium: !!isPremium,
        });

        // Configure MomentSignalSender with user context
        MomentSignalSender.configure({ userId, coupleId: coupleId || null });

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
            SyncEngine.sync().catch(() => {});
          }
        }, 60_000);
      } catch (err) {
        console.error('[DataContext] Init failed:', err);
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
    DataLayer.reconfigure({
      userId,
      coupleId: coupleId || null,
      isPremium: !!isPremium,
    });
    MomentSignalSender.configure({ userId, coupleId: coupleId || null });
  }, [userId, coupleId, isPremium]);

  // ─── Sync on app foreground ─────────────────────────────────

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && initializedRef.current) {
        SyncEngine.sync().catch(() => {});
      }
      if (nextState === 'background') {
        // Clean up decrypted cache when backgrounding
        DataLayer.clearCache().catch(() => {});
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
