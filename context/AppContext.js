// context/AppContext.js
import React, { createContext, useContext, useReducer, useEffect, useMemo, useRef } from 'react';
import * as Crypto from 'expo-crypto';
import { storage, STORAGE_KEYS, vibeStorage, settingsStorage, userStorage } from '../utils/storage';
import { useEntitlements , clearCouplePremiumCache } from './EntitlementsContext';
import { updateWidgetPartnerName } from '../services/widgetData';
import { NicknameEngine } from '../services/PolishEngine';
import CoupleService from '../services/supabase/CoupleService';
import CoupleKeyService from '../services/security/CoupleKeyService';
import StorageRouter from '../services/storage/StorageRouter';
import WeeklyContentScheduler from '../services/WeeklyContentScheduler';

const initialState = {
  userId: null,
  onboardingCompleted: false,
  coupleId: null,
  isLinked: false,
  isLocked: false,
  isPremium: false,
  isCouplePremium: false,
  isLoading: true,
  userProfile: null,
  appLockEnabled: false,
  
  // Premium Value Loop State
  currentVibe: null,
  partnerVibe: null,
  vibeLastUpdated: null,
  syncStatus: 'offline', // 'synced' | 'syncing' | 'offline'
  activeRitual: null,
  memoryCount: 0,
  lastMemoryDate: null,
  lastPartnerActivity: null,
};

const ACTIONS = {
  SYNC: 'SYNC',
  UNLOCK: 'UNLOCK',
  REFRESH_PREMIUM: 'REFRESH_PREMIUM',
  SET_VIBE: 'SET_VIBE',
  SET_PARTNER_VIBE: 'SET_PARTNER_VIBE',
  SET_SYNC_STATUS: 'SET_SYNC_STATUS',
  SET_ACTIVE_RITUAL: 'SET_ACTIVE_RITUAL',
  UPDATE_MEMORY_STATS: 'UPDATE_MEMORY_STATS',
  COMPLETE_ONBOARDING: 'COMPLETE_ONBOARDING',
  UPDATE_PROFILE: 'UPDATE_PROFILE',
  LEAVE_COUPLE: 'LEAVE_COUPLE',
  SET_APP_LOCK: 'SET_APP_LOCK',
  UPDATE_PARTNER_ACTIVITY: 'UPDATE_PARTNER_ACTIVITY',
};

async function persistPartnerActivity(ts) {
  const saved = await storage.set(STORAGE_KEYS.LAST_PARTNER_ACTIVITY, ts);
  if (!saved) {
    if (__DEV__) console.warn('[AppContext] Failed to persist partner activity timestamp');
  }
}

function reducer(state, action) {
  switch (action.type) {
    case ACTIONS.SYNC:
      return { ...state, ...action.payload, isLoading: false };
    case ACTIONS.UNLOCK:
      return { ...state, isLocked: false };
    case ACTIONS.REFRESH_PREMIUM:
      return { ...state, isPremium: action.payload.isPremium, isCouplePremium: action.payload.isCouplePremium };
    case ACTIONS.SET_VIBE:
      return { 
        ...state, 
        currentVibe: action.payload.vibe,
        vibeLastUpdated: new Date(),
        syncStatus: 'syncing'
      };
    case ACTIONS.SET_PARTNER_VIBE:
      return { 
        ...state, 
        partnerVibe: action.payload.vibe,
        syncStatus: 'synced'
      };
    case ACTIONS.SET_SYNC_STATUS:
      return { ...state, syncStatus: action.payload.status };
    case ACTIONS.SET_ACTIVE_RITUAL:
      return { ...state, activeRitual: action.payload.ritual };
    case ACTIONS.UPDATE_MEMORY_STATS:
      return { 
        ...state, 
        memoryCount: action.payload.count,
        lastMemoryDate: action.payload.lastDate
      };
    case ACTIONS.COMPLETE_ONBOARDING:
      return { ...state, onboardingCompleted: true };
    case ACTIONS.UPDATE_PROFILE:
      return {
        ...state,
        userProfile: {
          ...state.userProfile,
          ...action.payload,
          ...(action.payload?.partnerNames
            ? {
                partnerNames: {
                  ...(state.userProfile?.partnerNames || {}),
                  ...action.payload.partnerNames,
                },
              }
            : {}),
        },
      };
    case ACTIONS.LEAVE_COUPLE:
      return { 
        ...state, 
        coupleId: null,
        isLinked: false 
      };
    case ACTIONS.SET_APP_LOCK:
      return { ...state, appLockEnabled: action.payload };
    case ACTIONS.UPDATE_PARTNER_ACTIVITY:
      return { ...state, lastPartnerActivity: action.payload };
    default:
      return state;
  }
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const { isPremiumEffective: isPremium, isPremiumCouple: isCouplePremium } = useEntitlements();
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const isPremiumRef = useRef(isPremium);
  isPremiumRef.current = isPremium;
  const isCouplePremiumRef = useRef(isCouplePremium);
  isCouplePremiumRef.current = isCouplePremium;

  useEffect(() => {
    let unsubscribe = null;
    let active = true;

    const syncState = ({
      userId,
      onboardingCompleted,
      userProfile,
      coupleId,
      appLockEnabled,
      lastPartnerActivity,
    }) => {
      if (!active) return;
      dispatch({
        type: ACTIONS.SYNC,
        payload: {
          userId,
          onboardingCompleted: !!onboardingCompleted,
          userProfile,
          coupleId: coupleId || null,
          isLinked: !!coupleId,
          appLockEnabled: !!appLockEnabled,
          isPremium,
          isCouplePremium,
          lastPartnerActivity: coupleId ? lastPartnerActivity : null,
        },
      });
    };

    const init = async () => {
      await WeeklyContentScheduler.init();
      let userId = await userStorage.getUserId();
      if (!userId) {
        userId = Crypto.randomUUID();
        await userStorage.setUserId(userId);
      }

      // Load all persisted state
      const [
        onboardingCompleted,
        userProfile,
        legacyPartnerLabel,
        coupleId,
        appLockEnabled,
        lastPartnerActivity
        ] = await Promise.all([
          storage.get(STORAGE_KEYS.ONBOARDING_COMPLETED, false),
          storage.get(STORAGE_KEYS.USER_PROFILE, {}),
          storage.get(STORAGE_KEYS.PARTNER_LABEL, null),
          storage.get(STORAGE_KEYS.COUPLE_ID, null),
          settingsStorage.getAppLockEnabled(),
          storage.get(STORAGE_KEYS.LAST_PARTNER_ACTIVITY, null),
        ]);

      let hydratedUserProfile = userProfile && typeof userProfile === 'object' ? { ...userProfile } : {};
      let resolvedCoupleId = coupleId || null;

      try {
        const nicknameConfig = await NicknameEngine.getConfig();
        const legacyPartnerName = typeof legacyPartnerLabel === 'string' ? legacyPartnerLabel.trim() : '';
        const nicknamePartnerName = nicknameConfig?.partnerNickname?.trim() || '';
        const nicknameMyName = nicknameConfig?.myNickname?.trim() || '';
        const profilePartnerName = hydratedUserProfile?.partnerNames?.partnerName?.trim() || '';
        const profileMyName = hydratedUserProfile?.partnerNames?.myName?.trim() || '';

        const nextPartnerName = profilePartnerName || legacyPartnerName || nicknamePartnerName;
        const nextMyName = profileMyName || nicknameMyName;

        if ((nextPartnerName && nextPartnerName !== profilePartnerName) || (nextMyName && nextMyName !== profileMyName)) {
          hydratedUserProfile = {
            ...hydratedUserProfile,
            partnerNames: {
              ...(hydratedUserProfile.partnerNames || {}),
              ...(nextMyName ? { myName: nextMyName } : {}),
              ...(nextPartnerName ? { partnerName: nextPartnerName } : {}),
            },
          };
          await storage.set(STORAGE_KEYS.USER_PROFILE, hydratedUserProfile);
        }

        if (legacyPartnerName) {
          await storage.remove(STORAGE_KEYS.PARTNER_LABEL);
        }

        if ((nextPartnerName && nicknamePartnerName !== nextPartnerName) || (nextMyName && nicknameMyName !== nextMyName)) {
          await NicknameEngine.setConfig({
            ...(nextMyName ? { myNickname: nextMyName } : {}),
            ...(nextPartnerName ? { partnerNickname: nextPartnerName } : {}),
          });
        }
      } catch (e) {
        if (__DEV__) console.warn('[AppContext] Nickname migration failed:', e?.message);
      }

      const now = Date.now();
      let effectivePartnerActivity = lastPartnerActivity;
      if (resolvedCoupleId && !lastPartnerActivity) {
        await storage.set(STORAGE_KEYS.LAST_PARTNER_ACTIVITY, now);
        effectivePartnerActivity = now;
      }

      syncState({
        userId,
        onboardingCompleted,
        userProfile: hydratedUserProfile,
        coupleId: resolvedCoupleId,
        appLockEnabled,
        lastPartnerActivity: effectivePartnerActivity,
      });

      try {
        const remoteCouple = await Promise.race([
          CoupleService.getMyCouple(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('getMyCouple timed out')), 10000)),
        ]);
        const remoteCoupleId = remoteCouple?.couple_id || null;

        if (remoteCoupleId && remoteCoupleId !== resolvedCoupleId) {
          resolvedCoupleId = remoteCoupleId;
          await storage.set(STORAGE_KEYS.COUPLE_ID, remoteCoupleId);
        } else if (!remoteCoupleId && resolvedCoupleId) {
          // Server says no couple but we have one locally — confirm with a
          // second call before wiping.  Transient RLS glitches, timeouts, or
          // stale sessions can return null once; clearing on a single miss
          // causes random unpairing.
          let confirmed = false;
          try {
            const recheck = await Promise.race([
              CoupleService.getMyCouple(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('recheck timed out')), 8000)),
            ]);
            confirmed = !recheck?.couple_id;
          } catch (_) {
            // Second call also failed — do NOT clear, keep local state
            confirmed = false;
          }
          if (confirmed) {
            const staleCoupleId = resolvedCoupleId;
            resolvedCoupleId = null;
            await storage.remove(STORAGE_KEYS.COUPLE_ID);
            await storage.remove(STORAGE_KEYS.COUPLE_ROLE);
            await storage.remove(STORAGE_KEYS.PARTNER_PROFILE);
            await storage.remove(STORAGE_KEYS.LAST_PARTNER_ACTIVITY);
            try {
              await CoupleKeyService.clearCoupleKey(staleCoupleId);
            } catch (_) {}
          }
        }
      } catch (_) {}

      let supabaseUserId = null;

      try {
        const { supabase } = await import('../config/supabase');
        const { data: authData } = supabase ? await Promise.race([
          supabase.auth.getUser(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('getUser timed out')), 10000)),
        ]) : { data: null };
        supabaseUserId = authData?.user?.id || null;
      } catch (_) {}

      syncState({
        userId,
        onboardingCompleted,
        userProfile: hydratedUserProfile,
        coupleId: resolvedCoupleId,
        appLockEnabled,
        lastPartnerActivity: effectivePartnerActivity,
      });

      // Setup Supabase Realtime listener for partner vibe/data changes
      // (replaces the old local-only vibeSyncService which never actually synced)
      const coupleIdVal = resolvedCoupleId || null;
      if (coupleIdVal) {
        try {
          const { supabase, TABLES } = await import('../config/supabase');
          if (supabase && active) {
            const channel = supabase
              .channel(`couple_sync_${coupleIdVal}`)
              .on(
                'postgres_changes',
                {
                  event: '*',
                  schema: 'public',
                  table: TABLES.COUPLE_DATA,
                  filter: `couple_id=eq.${coupleIdVal}`,
                },
                (payload) => {
                  if (!active) return;
                  const row = payload.new;
                  // Partner vibe update
                  if (row?.data_type === 'vibe' && supabaseUserId && row?.created_by !== supabaseUserId) {
                    try {
                      const vibeData = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
                      dispatch({ type: ACTIONS.SET_PARTNER_VIBE, payload: { vibe: vibeData } });
                      vibeStorage.addPartnerVibeEntry(vibeData).catch((e) => {
                        if (__DEV__) console.warn('[AppContext] Failed to store partner vibe entry:', e?.message);
                      });
                    } catch (e) {
                      if (__DEV__) console.warn('[AppContext] Failed to parse partner vibe payload:', e?.message);
                    }
                    const ts = Date.now();
                    dispatch({ type: ACTIONS.UPDATE_PARTNER_ACTIVITY, payload: ts });
                    persistPartnerActivity(ts).catch((e) => {
                      if (__DEV__) console.warn('[AppContext] Partner activity persist failed:', e?.message);
                    });
                  }
                  dispatch({ type: ACTIONS.SET_SYNC_STATUS, payload: { status: 'synced' } });
                }
              )
              .subscribe((status) => {
                if (!active) return;
                if (status === 'SUBSCRIBED') {
                  dispatch({ type: ACTIONS.SET_SYNC_STATUS, payload: { status: 'synced' } });
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                  dispatch({ type: ACTIONS.SET_SYNC_STATUS, payload: { status: 'offline' } });
                }
              });

            unsubscribe = () => supabase.removeChannel(channel);
          }
        } catch (err) {
          // Supabase not configured — offline mode
          if (__DEV__) console.log('Realtime not available:', err.message);
        }
      }
    };

    init().catch((err) => {
      if (__DEV__) console.warn('[AppContext] init failed:', err?.message);
      if (active) {
        dispatch({ type: ACTIONS.SYNC, payload: {} });
      }
    });

    return () => {
      active = false;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    dispatch({ type: ACTIONS.REFRESH_PREMIUM, payload: { isPremium, isCouplePremium } });
  }, [isCouplePremium, isPremium]);

  const actions = useMemo(() => ({
    unlock: () => dispatch({ type: ACTIONS.UNLOCK }),
    refreshPremium: async () => {
      const p = isPremiumRef.current;
      const cp = isCouplePremiumRef.current;
      dispatch({ type: ACTIONS.REFRESH_PREMIUM, payload: { isPremium: p, isCouplePremium: cp } });
    },
    refreshPremiumStatus: async () => {
      const p = isPremiumRef.current;
      const cp = isCouplePremiumRef.current;
      dispatch({ type: ACTIONS.REFRESH_PREMIUM, payload: { isPremium: p, isCouplePremium: cp } });
    },
    
    // Premium Value Loop Actions
    setVibe: async (vibe) => {
      dispatch({ type: ACTIONS.SET_VIBE, payload: { vibe } });

      const s = stateRef.current;

      // ── Primary path: persist via DataLayer → SQLite → Supabase sync ──
      // DataLayer.saveVibe writes to local SQLite with sync_status='pending'.
      // SyncEngine.push() then encrypts and upserts to Supabase couple_data,
      // which fires a postgres_changes event the partner's SyncEngine picks up.
      try {
        const { DataLayer } = await import('../services/localfirst');
        const vibeValue = typeof vibe === 'object' ? JSON.stringify(vibe) : vibe;
        await DataLayer.saveVibe({ vibe: vibeValue, note: null });
        dispatch({ type: ACTIONS.SET_SYNC_STATUS, payload: { status: 'synced' } });
      } catch (err) {
        if (__DEV__) console.warn('[setVibe] DataLayer.saveVibe failed:', err?.message);
        dispatch({ type: ACTIONS.SET_SYNC_STATUS, payload: { status: 'offline' } });
      }
    },
    setPartnerVibe: (vibe) => {
      dispatch({ type: ACTIONS.SET_PARTNER_VIBE, payload: { vibe } });
      // Update partner activity timestamp when receiving partner vibe
      const now = Date.now();
      dispatch({ type: ACTIONS.UPDATE_PARTNER_ACTIVITY, payload: now });
      persistPartnerActivity(now).catch((e) => {
        if (__DEV__) console.warn('[AppContext] Partner activity persist failed:', e?.message);
      });
    },
    setSyncStatus: (status) => {
      dispatch({ type: ACTIONS.SET_SYNC_STATUS, payload: { status } });
    },
    setActiveRitual: (ritual) => {
      dispatch({ type: ACTIONS.SET_ACTIVE_RITUAL, payload: { ritual } });
    },
    updateMemoryStats: (count, lastDate) => {
      dispatch({ type: ACTIONS.UPDATE_MEMORY_STATS, payload: { count, lastDate } });
    },
    
    // Onboarding and Profile Actions
    completeOnboarding: async () => {
      await storage.set(STORAGE_KEYS.ONBOARDING_COMPLETED, true);
      dispatch({ type: ACTIONS.COMPLETE_ONBOARDING });
    },
    
    updateProfile: async (profileData) => {
      const currentProfile = stateRef.current.userProfile || {};
      const mergedProfile = {
        ...currentProfile,
        ...profileData,
        ...(profileData?.partnerNames
          ? {
              partnerNames: {
                ...(currentProfile.partnerNames || {}),
                ...profileData.partnerNames,
              },
            }
          : {}),
      };
      await storage.set(STORAGE_KEYS.USER_PROFILE, mergedProfile);
      if (mergedProfile.partnerNames?.partnerName) {
        updateWidgetPartnerName(mergedProfile.partnerNames.partnerName).catch(() => {});
      }
      dispatch({ type: ACTIONS.UPDATE_PROFILE, payload: profileData });
    },
    
    setAppLockEnabled: async (enabled) => {
      await settingsStorage.setAppLockEnabled(enabled);
      dispatch({ type: ACTIONS.SET_APP_LOCK, payload: enabled });
    },
    
    updatePartnerActivity: async () => {
      const now = Date.now();
      await storage.set(STORAGE_KEYS.LAST_PARTNER_ACTIVITY, now);
      dispatch({ type: ACTIONS.UPDATE_PARTNER_ACTIVITY, payload: now });
    },
    
    // Helper to check if connection is still active (within 24 hours)
    isConnectionActive: () => {
      const s = stateRef.current;
      if (!s.isLinked || !s.lastPartnerActivity) return s.isLinked;
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      return (now - s.lastPartnerActivity) < twentyFourHours;
    },
    
    leaveCouple: async () => {
      try {
        // Remove server-side couple_members row first — must succeed before
        // clearing local state, otherwise we get a zombie half-unpaired state.
        await CoupleService.unlinkFromCouple();

        await storage.remove(STORAGE_KEYS.COUPLE_ID);
        await storage.remove(STORAGE_KEYS.COUPLE_ROLE);
        await storage.remove(STORAGE_KEYS.PARTNER_PROFILE);
        await storage.remove(STORAGE_KEYS.LAST_PARTNER_ACTIVITY);

        // Clear the couple premium offline cache so the former partner's
        // premium does not bleed through the 72-hour grace window.
        await clearCouplePremiumCache();

        // Clear coupleId from the persisted user document so AuthContext
        // propagates the change to EntitlementsContext on the next read.
        const userId = stateRef.current.userId;
        if (userId) {
          try {
            await StorageRouter.updateUserDocument(userId, { coupleId: null });
          } catch (_) {}
        }

        dispatch({ type: ACTIONS.LEAVE_COUPLE });
      } catch (error) {
        if (__DEV__) console.error('Failed to leave couple:', error);
        throw error;
      }
    },
  }), []); // stable — all state access via stateRef/isPremiumRef

  const contextValue = useMemo(() => ({ state, actions }), [state, actions]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used inside provider");
  return ctx;
};
