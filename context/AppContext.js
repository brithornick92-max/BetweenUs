// context/AppContext.js
import React, { createContext, useContext, useReducer, useEffect, useMemo, useRef } from 'react';
import * as Crypto from 'expo-crypto';
import { storage, STORAGE_KEYS } from '../utils/storage';
import { useEntitlements } from './EntitlementsContext';
import { NicknameEngine } from '../services/PolishEngine';

const initialState = {
  userId: null,
  onboardingCompleted: false,
  partnerLabel: 'Partner',
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
  SET_PARTNER_LABEL: 'SET_PARTNER_LABEL',
  SET_APP_LOCK: 'SET_APP_LOCK',
  UPDATE_PARTNER_ACTIVITY: 'UPDATE_PARTNER_ACTIVITY',
};

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
      return { ...state, userProfile: { ...state.userProfile, ...action.payload } };
    case ACTIONS.LEAVE_COUPLE:
      return { 
        ...state, 
        coupleId: null,
        isLinked: false 
      };
    case ACTIONS.SET_PARTNER_LABEL:
      return { ...state, partnerLabel: action.payload };
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

  useEffect(() => {
    let unsubscribe = null;
    let active = true;

    const init = async () => {
      let userId = await storage.get(STORAGE_KEYS.USER_ID, null);
      if (!userId) {
        userId = Crypto.randomUUID();
        await storage.set(STORAGE_KEYS.USER_ID, userId);
      }

      // Load all persisted state
      const [
        onboardingCompleted,
        userProfile,
        partnerLabel,
        coupleId,
        appLockEnabled,
        lastPartnerActivity
        ] = await Promise.all([
          storage.get(STORAGE_KEYS.ONBOARDING_COMPLETED, false),
          storage.get(STORAGE_KEYS.USER_PROFILE, {}),
          storage.get(STORAGE_KEYS.PARTNER_LABEL, null),
          storage.get(STORAGE_KEYS.COUPLE_ID, null),
          storage.get(STORAGE_KEYS.APP_LOCK_ENABLED, false),
          storage.get(STORAGE_KEYS.LAST_PARTNER_ACTIVITY, null),
        ]);

      // QR pairing does not use invite codes, so coupleId alone marks linkage.
      const now = Date.now();
      const isActuallyLinked = !!coupleId;
      
      // If linked but no recent activity, set initial activity timestamp
      if (coupleId && !lastPartnerActivity) {
        await storage.set(STORAGE_KEYS.LAST_PARTNER_ACTIVITY, now);
      }

      dispatch({ 
        type: ACTIONS.SYNC, 
        payload: { 
          userId, 
          onboardingCompleted: !!onboardingCompleted,
          userProfile,
          partnerLabel: partnerLabel || 'Partner',
          coupleId: isActuallyLinked ? coupleId : null,
          isLinked: isActuallyLinked,
          appLockEnabled: !!appLockEnabled,
          isPremium, 
          isCouplePremium: isPremium,
          lastPartnerActivity: isActuallyLinked ? lastPartnerActivity : null,
        } 
      });
      
      // ── Sync partnerLabel ↔ NicknameEngine on boot ──
      // If one system has a name and the other doesn't, propagate.
      try {
        const nicknameConfig = await NicknameEngine.getConfig();
        const effectiveLabel = partnerLabel || 'Partner';
        const hasNicknamePartner = !!nicknameConfig.partnerNickname?.trim();
        const hasContextLabel = effectiveLabel !== 'Partner';

        if (hasNicknamePartner && !hasContextLabel) {
          // NicknameEngine has a name → push to AppContext storage
          await storage.set(STORAGE_KEYS.PARTNER_LABEL, nicknameConfig.partnerNickname.trim());
          dispatch({ type: ACTIONS.SET_PARTNER_LABEL, payload: nicknameConfig.partnerNickname.trim() });
        } else if (hasContextLabel && !hasNicknamePartner) {
          // AppContext has a name → seed NicknameEngine
          await NicknameEngine.setConfig({ partnerNickname: effectiveLabel });
        }
      } catch (e) {
        // Non-critical — swallow
      }

      // Setup vibe sync listeners
      const { vibeSyncService } = await import('../utils/vibeSync');

      if (!active) return;

      unsubscribe = vibeSyncService.addListener((event, data) => {
        switch (event) {
          case 'partner_vibe_received':
            dispatch({ type: ACTIONS.SET_PARTNER_VIBE, payload: { vibe: data.vibe } });
            // Update partner activity timestamp
            const now = Date.now();
            dispatch({ type: ACTIONS.UPDATE_PARTNER_ACTIVITY, payload: now });
            storage.set(STORAGE_KEYS.LAST_PARTNER_ACTIVITY, now);
            break;
          case 'vibe_synced':
            dispatch({ type: ACTIONS.SET_SYNC_STATUS, payload: { status: 'synced' } });
            break;
          case 'vibe_sync_failed':
            dispatch({ type: ACTIONS.SET_SYNC_STATUS, payload: { status: 'offline' } });
            break;
          case 'network_restored':
            dispatch({ type: ACTIONS.SET_SYNC_STATUS, payload: { status: 'syncing' } });
            break;
          case 'network_lost':
            dispatch({ type: ACTIONS.SET_SYNC_STATUS, payload: { status: 'offline' } });
            break;
          case 'concurrent_vibes':
            // Handle concurrent vibe updates gracefully
            if (__DEV__) console.log('Concurrent vibe updates detected:', data);
            break;
          case 'concurrent_resolved':
            dispatch({ type: ACTIONS.SET_PARTNER_VIBE, payload: { vibe: data.vibe } });
            // Update partner activity timestamp
            const resolvedNow = Date.now();
            dispatch({ type: ACTIONS.UPDATE_PARTNER_ACTIVITY, payload: resolvedNow });
            storage.set(STORAGE_KEYS.LAST_PARTNER_ACTIVITY, resolvedNow);
            break;
        }
      });
    };
    
    init();

    return () => {
      active = false;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    dispatch({ type: ACTIONS.REFRESH_PREMIUM, payload: { isPremium, isCouplePremium } });
  }, [isPremium]);

  const actions = useMemo(() => ({
    unlock: () => dispatch({ type: ACTIONS.UNLOCK }),
    refreshPremium: async () => {
      const p = isPremiumRef.current;
      dispatch({ type: ACTIONS.REFRESH_PREMIUM, payload: { isPremium: p, isCouplePremium: p } });
    },
    refreshPremiumStatus: async () => {
      const p = isPremiumRef.current;
      dispatch({ type: ACTIONS.REFRESH_PREMIUM, payload: { isPremium: p, isCouplePremium: p } });
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
        console.warn('[setVibe] DataLayer.saveVibe failed:', err.message);
        dispatch({ type: ACTIONS.SET_SYNC_STATUS, payload: { status: 'offline' } });
      }
    },
    setPartnerVibe: (vibe) => {
      dispatch({ type: ACTIONS.SET_PARTNER_VIBE, payload: { vibe } });
      // Update partner activity timestamp when receiving partner vibe
      const now = Date.now();
      dispatch({ type: ACTIONS.UPDATE_PARTNER_ACTIVITY, payload: now });
      storage.set(STORAGE_KEYS.LAST_PARTNER_ACTIVITY, now);
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
      await storage.set(STORAGE_KEYS.USER_PROFILE, profileData);
      dispatch({ type: ACTIONS.UPDATE_PROFILE, payload: profileData });
    },
    
    setPartnerLabel: async (label) => {
      await storage.set(STORAGE_KEYS.PARTNER_LABEL, label);
      dispatch({ type: ACTIONS.SET_PARTNER_LABEL, payload: label });
    },
    
    setAppLockEnabled: async (enabled) => {
      await storage.set(STORAGE_KEYS.APP_LOCK_ENABLED, enabled);
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
        await storage.remove(STORAGE_KEYS.COUPLE_ID);
        await storage.remove(STORAGE_KEYS.COUPLE_ROLE);
        await storage.remove(STORAGE_KEYS.PARTNER_PROFILE);
        await storage.remove(STORAGE_KEYS.LAST_PARTNER_ACTIVITY);
        
        dispatch({ type: ACTIONS.LEAVE_COUPLE });
      } catch (error) {
        console.error('Failed to leave couple:', error);
        throw error;
      }
    },
  }), []); // stable — all state access via stateRef/isPremiumRef

  return (
    <AppContext.Provider value={{ state, actions }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used inside provider");
  return ctx;
};
