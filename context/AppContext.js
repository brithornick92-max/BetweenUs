// context/AppContext.js
import React, { createContext, useContext, useReducer, useEffect, useMemo, useRef } from 'react';
import * as Crypto from 'expo-crypto';
import { storage, STORAGE_KEYS } from '../utils/storage';
import { useEntitlements } from './EntitlementsContext';
import RealtimeSyncService from '../services/RealtimeSyncService';

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
      let userId = await storage.get(STORAGE_KEYS.USER_ID);
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
        storage.get(STORAGE_KEYS.ONBOARDING_COMPLETED),
        storage.get(STORAGE_KEYS.USER_PROFILE),
        storage.get(STORAGE_KEYS.PARTNER_LABEL),
        storage.get(STORAGE_KEYS.COUPLE_ID),
        storage.get(STORAGE_KEYS.APP_LOCK_ENABLED),
        storage.get(STORAGE_KEYS.LAST_PARTNER_ACTIVITY),
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
            console.log('Concurrent vibe updates detected:', data);
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

  // Firebase Real-time Sync
  useEffect(() => {
    if (state.isLinked && state.coupleId && state.userId) {
      console.log('Setting up local real-time sync for couple:', state.coupleId);
      
      // Subscribe to partner activity
      const unsubscribe = RealtimeSyncService.subscribeToPartnerActivity(
        state.coupleId,
        state.userId,
        (partnerData) => {
          if (partnerData.error) {
            console.error('Partner activity sync error:', partnerData.error);
            dispatch({ type: ACTIONS.SET_SYNC_STATUS, payload: { status: 'offline' } });
            return;
          }
          
          // Update partner vibe if changed (use ref to compare without dep)
          if (partnerData.currentVibe && partnerData.currentVibe !== stateRef.current.partnerVibe) {
            dispatch({ 
              type: ACTIONS.SET_PARTNER_VIBE, 
              payload: { vibe: partnerData.currentVibe } 
            });
          }
          
          // Update partner activity timestamp
          if (partnerData.lastActivity) {
            const timestamp = partnerData.lastActivity.toMillis ? 
              partnerData.lastActivity.toMillis() : 
              partnerData.lastActivity;
            
            dispatch({ 
              type: ACTIONS.UPDATE_PARTNER_ACTIVITY, 
              payload: timestamp 
            });
            storage.set(STORAGE_KEYS.LAST_PARTNER_ACTIVITY, timestamp);
          }
          
          dispatch({ type: ACTIONS.SET_SYNC_STATUS, payload: { status: 'synced' } });
        }
      );
      
      // Cleanup on unmount or when couple changes
      return () => {
        console.log('Cleaning up local real-time sync');
        unsubscribe();
      };
    }
  }, [state.isLinked, state.coupleId, state.userId]);

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
      // Try local real-time sync first
      if (s.isLinked && s.coupleId) {
        try {
          await RealtimeSyncService.updateVibe(s.coupleId, s.userId, vibe);
          dispatch({ type: ACTIONS.SET_SYNC_STATUS, payload: { status: 'synced' } });
          return;
        } catch (error) {
          console.error('Local vibe sync failed, falling back to local sync:', error);
        }
      }
      
      // Fallback to local vibe sync service
      try {
        const { vibeSyncService } = await import('../utils/vibeSync');
        const result = await vibeSyncService.sendVibeToPartner(vibe, s.userId);
        if (result.success) {
          dispatch({ type: ACTIONS.SET_SYNC_STATUS, payload: { status: 'synced' } });
        } else if (result.queued) {
          dispatch({ type: ACTIONS.SET_SYNC_STATUS, payload: { status: 'syncing' } });
        }
      } catch (error) {
        console.error('Failed to sync vibe:', error);
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
