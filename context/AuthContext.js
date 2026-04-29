import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import StorageRouter from '../services/storage/StorageRouter';
import CloudEngine from '../services/storage/CloudEngine';
import ConnectionMemory from '../utils/connectionMemory';
import { SupabaseAuthService } from '../services/supabase/SupabaseAuthService';
import { cloudSyncStorage , storage, STORAGE_KEYS } from '../utils/storage';
import AnalyticsService from '../services/AnalyticsService';
import ExperimentService from '../services/ExperimentService';
import PushNotificationService from '../services/PushNotificationService';
import { supabase } from '../config/supabase';
import { NicknameEngine, RelationshipSeasons, SoftBoundaries } from '../services/PolishEngine';
import { ContentIntensityMatcher, RelationshipClimateState } from '../services/ConnectionEngine';

const AuthContext = createContext(null);

// ─── Throttle constants ────────────────────────────────────────────────────────
const PROFILE_SYNC_COOLDOWN_MS = 30_000; // Don't re-sync display name if synced recently

function mergeCloudProfile(localProfile, remoteProfile) {
  const safeLocal = localProfile && typeof localProfile === 'object' ? localProfile : {};
  const remotePrefs = remoteProfile?.preferences && typeof remoteProfile.preferences === 'object'
    ? remoteProfile.preferences
    : {};
  const localPrefs = safeLocal.preferences && typeof safeLocal.preferences === 'object'
    ? safeLocal.preferences
    : {};

  return {
    ...safeLocal,
    ...(remoteProfile?.display_name
      ? {
          displayName: remoteProfile.display_name,
          display_name: remoteProfile.display_name,
        }
      : {}),
    ...(typeof remotePrefs.heatLevelPreference !== 'undefined'
      ? { heatLevelPreference: remotePrefs.heatLevelPreference }
      : {}),
    ...(typeof remotePrefs.onboardingCompleted === 'boolean'
      ? { onboardingCompleted: remotePrefs.onboardingCompleted }
      : {}),
    ...(typeof remotePrefs.tone === 'string' && remotePrefs.tone.trim()
      ? { tone: remotePrefs.tone.trim() }
      : {}),
    ...(remotePrefs.nicknameConfig && typeof remotePrefs.nicknameConfig === 'object'
      ? { nicknameConfig: remotePrefs.nicknameConfig }
      : {}),
    ...(remotePrefs.relationshipSeason && typeof remotePrefs.relationshipSeason === 'object'
      ? { relationshipSeason: remotePrefs.relationshipSeason }
      : {}),
    ...(remotePrefs.relationshipClimate && typeof remotePrefs.relationshipClimate === 'object'
      ? { relationshipClimate: remotePrefs.relationshipClimate }
      : {}),
    ...(typeof remotePrefs.energyLevel === 'string' && remotePrefs.energyLevel.trim()
      ? { energyLevel: remotePrefs.energyLevel.trim() }
      : {}),
    ...(remotePrefs.softBoundaries && typeof remotePrefs.softBoundaries === 'object'
      ? { softBoundaries: remotePrefs.softBoundaries }
      : {}),
    ...(remotePrefs.relationshipStartDate
      ? { relationshipStartDate: remotePrefs.relationshipStartDate }
      : {}),
    ...(remotePrefs.partnerNames && typeof remotePrefs.partnerNames === 'object'
      ? {
          partnerNames: {
            ...(safeLocal.partnerNames && typeof safeLocal.partnerNames === 'object' ? safeLocal.partnerNames : {}),
            ...remotePrefs.partnerNames,
          },
        }
      : {}),
    preferences: {
      ...localPrefs,
      ...remotePrefs,
    },
  };
}

async function persistAppUserProfile(profile) {
  const normalizedProfile = profile && typeof profile === 'object' ? profile : {};
  await storage.set(STORAGE_KEYS.USER_PROFILE, normalizedProfile);
}

async function applyCloudPreferenceState(remoteProfile) {
  const remotePrefs = remoteProfile?.preferences && typeof remoteProfile.preferences === 'object'
    ? remoteProfile.preferences
    : {};

  const nicknameConfig = {};
  if (remotePrefs.nicknameConfig && typeof remotePrefs.nicknameConfig === 'object') {
    if (typeof remotePrefs.nicknameConfig.myNickname === 'string') {
      nicknameConfig.myNickname = remotePrefs.nicknameConfig.myNickname;
    }
    if (typeof remotePrefs.nicknameConfig.partnerNickname === 'string') {
      nicknameConfig.partnerNickname = remotePrefs.nicknameConfig.partnerNickname;
    }
    if (typeof remotePrefs.nicknameConfig.tone === 'string') {
      nicknameConfig.tone = remotePrefs.nicknameConfig.tone;
    }
  }

  if (remotePrefs.partnerNames && typeof remotePrefs.partnerNames === 'object') {
    if (!nicknameConfig.myNickname && typeof remotePrefs.partnerNames.myName === 'string') {
      nicknameConfig.myNickname = remotePrefs.partnerNames.myName;
    }
    if (!nicknameConfig.partnerNickname && typeof remotePrefs.partnerNames.partnerName === 'string') {
      nicknameConfig.partnerNickname = remotePrefs.partnerNames.partnerName;
    }
  }

  if (!nicknameConfig.tone && typeof remotePrefs.tone === 'string') {
    nicknameConfig.tone = remotePrefs.tone;
  }

  if (Object.keys(nicknameConfig).length > 0) {
    await NicknameEngine.setConfig(nicknameConfig);
  }

  if (remotePrefs.relationshipSeason?.id) {
    await RelationshipSeasons.set(remotePrefs.relationshipSeason.id);
  }

  if (remotePrefs.relationshipClimate?.id) {
    await RelationshipClimateState.set(remotePrefs.relationshipClimate.id);
  }

  if (typeof remotePrefs.energyLevel === 'string' && remotePrefs.energyLevel.trim()) {
    await ContentIntensityMatcher.setEnergyLevel(remotePrefs.energyLevel.trim());
  }

  if (remotePrefs.softBoundaries && typeof remotePrefs.softBoundaries === 'object') {
    await SoftBoundaries.setAll(remotePrefs.softBoundaries);
  }

  if (typeof remotePrefs.onboardingCompleted === 'boolean') {
    await storage.set(STORAGE_KEYS.ONBOARDING_COMPLETED, remotePrefs.onboardingCompleted);
    await storage.set(STORAGE_KEYS.PENDING_ONBOARDING, !remotePrefs.onboardingCompleted);
  }
}

async function clearLocalCache() {
  await storage.clearSession().catch(() => {});
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [requiresOnboarding, setRequiresOnboarding] = useState(false);

  // ✅ Only for first bootstrapping auth state (RootNavigator can gate on this)
  const [initializing, setInitializing] = useState(true);

  // ✅ Only for disabling buttons/spinners during actions (screens use this)
  const [busy, setBusy] = useState(false);

  const bootstrappedRef = useRef(false);
  const lastDisplayNameSyncRef = useRef({ timestamp: 0, name: null });
  const isSigningOutRef = useRef(false); // Prevent auth listener from running during sign out
  const pendingBackgroundOpsRef = useRef(new Set()); // Track pending operations
  const lastAuthStateRef = useRef(null); // Prevent duplicate processing

  const finishBootstrap = (active) => {
    if (active && !bootstrappedRef.current) {
      bootstrappedRef.current = true;
      setInitializing(false);
    }
  };

  useEffect(() => {
    let active = true;
    storage.purgeLegacyLocalStorage().catch(() => {});

    const unsubscribe = StorageRouter.onAuthStateChanged(async (localUser) => {
      try {
        if (!active) {
          console.log('[AuthContext] Auth listener skipped - component unmounted');
          return;
        }
        
        // Skip all auth listener work if we're in the middle of signing out
        if (isSigningOutRef.current) {
          console.log('[AuthContext] Auth listener skipped - sign out in progress');
          return;
        }

        // Debounce: Skip if we just processed this exact auth state
        const authStateKey = localUser ? `user:${localUser.uid}` : 'no-user';
        if (lastAuthStateRef.current === authStateKey) {
          console.log('[AuthContext] Auth listener skipped - duplicate state:', authStateKey);
          return;
        }
        console.log('[AuthContext] Auth listener processing:', authStateKey);
        lastAuthStateRef.current = authStateKey;

        // Set auth state immediately (don’t block UI while doing heavy work)
        setUser(localUser || null);

        if (!localUser) {
          AnalyticsService.setUser(null);
          ExperimentService.setUser(null);
          setUserProfile(null);
          finishBootstrap(active);
          await StorageRouter.initialize({ user: null, supabaseSessionPresent: false });
        } else {
          AnalyticsService.setUser(localUser.uid);
          ExperimentService.setUser(localUser.uid);
          let profile = await StorageRouter.getUserDocument(localUser.uid);
          if (!active) return;
          setUserProfile(profile);
          await persistAppUserProfile(profile);

          try {
            const pendingOnboarding = await storage.get(STORAGE_KEYS.PENDING_ONBOARDING, false);
            if (!active) return;
            setRequiresOnboarding(!!pendingOnboarding);
          } catch (_) {
            if (!active) return;
            setRequiresOnboarding(false);
          }

          let supabaseSession = null;
          let sessionCheckFailed = false;

          try {
            // Use shorter timeout and skip if already timing out
            supabaseSession = await Promise.race([
              SupabaseAuthService.getSession(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Session check timeout')), 5000)),
            ]);
          } catch (e) {
            sessionCheckFailed = true;
            if (__DEV__) console.warn('[AuthContext] getSession failed (non-fatal):', e?.message);
          }

          // A timeout/network failure means auth is unknown, not signed out.
          // Keep the local user and avoid clearing React auth state.
          if (sessionCheckFailed) {
            await StorageRouter.initialize({
              user: localUser,
              supabaseSessionPresent: false,
            });
            finishBootstrap(active);
            return;
          }

          // Only clear auth after a completed Supabase check explicitly returns no session.
          if (!supabaseSession) {
            await StorageRouter.signOut('local').catch(() => {});
            if (!active) return;
            AnalyticsService.setUser(null);
            ExperimentService.setUser(null);
            setUser(null);
            setUserProfile(null);
            setRequiresOnboarding(false);
            await StorageRouter.initialize({ user: null, supabaseSessionPresent: false });
            finishBootstrap(active);
            return;
          }

          await StorageRouter.initialize({
            user: localUser,
            supabaseSessionPresent: !!supabaseSession,
          });

          if (supabaseSession) {
            // Create a unique operation ID
            const opId = `profile-sync-${Date.now()}`;
            pendingBackgroundOpsRef.current.add(opId);
            
            // ✅ Fetch profile in background - don't block UI
            (async () => {
              try {
                // Check if we should still run (not cancelled)
                if (!active || !pendingBackgroundOpsRef.current.has(opId)) return;
                
                const cloudUserId = supabaseSession.user?.id;
                if (!cloudUserId) {
                  throw new Error('Supabase user not found in session');
                }

                // MIGRATION: Ensure email/account ID is the global source of truth.
                // If the local user ID is a legacy device ID (e.g. user_xxx), migrate them to the cloud ID.
                if (localUser.uid !== cloudUserId) {
                  if (__DEV__) console.log(`[AuthContext] Migrating legacy user ${localUser.uid} to canonical ID ${cloudUserId}`);

                  const migratedUserResult = await StorageRouter.hydrateRemoteAccount({
                    uid: cloudUserId,
                    email: supabaseSession.user.email || localUser.email,
                    displayName: profile?.displayName || localUser.displayName,
                    emailVerified: !!(supabaseSession.user?.email_confirmed_at || supabaseSession.user?.confirmed_at)
                  });
                  
                  localUser = migratedUserResult.user;
                  profile = await StorageRouter.getUserDocument(localUser.uid);
                  
                  if (active) {
                    setUser(localUser);
                    setUserProfile(profile);
                    await persistAppUserProfile(profile);
                    AnalyticsService.setUser(localUser.uid);
                    ExperimentService.setUser(localUser.uid);
                  }
                }

                const remoteProfile = await Promise.race([
                  CloudEngine.getProfile(cloudUserId),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('getProfile timed out')), 10000)),
                ]);
                const mergedProfile = mergeCloudProfile(profile, remoteProfile);

                if (active && JSON.stringify(mergedProfile) !== JSON.stringify(profile)) {
                  profile = await StorageRouter.updateUserDocument(localUser.uid, mergedProfile);
                  setUserProfile(profile);
                  await persistAppUserProfile(profile);
                }

                await applyCloudPreferenceState(remoteProfile);

                if (typeof remoteProfile?.preferences?.onboardingCompleted === 'boolean' && active) {
                  setRequiresOnboarding(!remoteProfile.preferences.onboardingCompleted);
                }
              } catch (e) {
                if (__DEV__) console.warn('[AuthContext] getProfile failed (non-fatal):', e?.message);
              } finally {
                // Clean up
                pendingBackgroundOpsRef.current.delete(opId);
              }
            })();
          }

          // Sync display_name to Supabase in background (non-blocking)
          if (supabaseSession && profile?.partnerNames?.myName) {
            const opId = `name-sync-${Date.now()}`;
            pendingBackgroundOpsRef.current.add(opId);
            
            (async () => {
              try {
                if (!active || !pendingBackgroundOpsRef.current.has(opId)) return;
                
                const myName = profile.partnerNames.myName;
                const lastSync = lastDisplayNameSyncRef.current;
                const now = Date.now();

                // Skip if same name was synced recently
                if (
                  lastSync.name !== myName ||
                  now - lastSync.timestamp > PROFILE_SYNC_COOLDOWN_MS
                ) {
                  try {
                    const cloudUserId = supabaseSession.user?.id;
                    if (!cloudUserId) {
                      throw new Error('Supabase user not found in session');
                    }

                    await Promise.race([
                      CloudEngine.upsertProfile(cloudUserId, {
                        display_name: myName,
                      }),
                      new Promise((_, reject) => setTimeout(() => reject(new Error('upsertProfile timed out')), 10000)),
                    ]);

                    // Update tracking
                    lastDisplayNameSyncRef.current = { timestamp: now, name: myName };
                  } catch (e) {
                    if (__DEV__) console.warn('[AuthContext] display_name sync (non-fatal):', e?.message);
                  }
                }
              } finally {
                pendingBackgroundOpsRef.current.delete(opId);
              }
            })();
          }

        }
      } catch (error) {
        if (__DEV__) console.error('Error loading user profile:', error);
      } finally {
        finishBootstrap(active);
      }
    });

    return () => {
      active = false;
      // Cancel all pending background operations
      pendingBackgroundOpsRef.current.clear();
      lastAuthStateRef.current = null;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const _restoreSupabaseSession = async (email, session) => {
    const remoteUser = session?.user;
    const remoteEmail = remoteUser?.email || email;
    const remoteDisplayName =
      remoteUser?.user_metadata?.display_name ||
      remoteUser?.user_metadata?.full_name ||
      remoteEmail.split('@')[0] ||
      'Between Us';

    await StorageRouter.setSupabaseSession(session);
      const restoredUser = await StorageRouter.hydrateRemoteAccount({
      uid: remoteUser?.id,
      email: remoteEmail,
      displayName: remoteDisplayName,
      emailVerified: !!(remoteUser?.email_confirmed_at || remoteUser?.confirmed_at),
    });

    const syncStatus = await cloudSyncStorage.getSyncStatus();
    await cloudSyncStorage.setSyncStatus({
      ...syncStatus,
      email: remoteEmail,
    });

    return restoredUser;
  };

  const signUp = async (email, password, displayName) => {
    try {
      setBusy(true);
      
      // Yield to the render cycle
      await new Promise(resolve => setTimeout(resolve, 0));

      // 1. ALWAYS sign up via Supabase first to ensure email is the global source of truth
      // and we get the canonical UUID immediately.
      let supabaseSession = null;
      try {
        supabaseSession = await SupabaseAuthService.signUp(email, password);
        // If confirmation is required, signUp returns null session
        if (!supabaseSession) {
          supabaseSession = await SupabaseAuthService.signInWithPassword(email, password).catch(() => null);
        }
      } catch (err) {
        if (String(err?.message || '').includes('User already registered')) {
          supabaseSession = await SupabaseAuthService.signInWithPassword(email, password).catch(() => null);
        } else {
          throw err;
        }
      }

      if (!supabaseSession?.user?.id) {
        throw new Error('Could not create cloud account. Please check your connection.');
      }

      // 2. Use the canonical Auth UUID for the local user as well
      const canonicalUid = supabaseSession.user.id;

      // Create local account but we MUST pass the uid, OR we just hydrate it?
      // StorageRouter.createAccount doesn't take uid. We should use hydrateRemoteAccount!
      await StorageRouter.setSupabaseSession(supabaseSession);
      const createdUser = await StorageRouter.hydrateRemoteAccount({
        uid: canonicalUid,
        email,
        displayName,
        emailVerified: !!(supabaseSession.user?.email_confirmed_at || supabaseSession.user?.confirmed_at)
      });

      const syncStatus = await cloudSyncStorage.getSyncStatus();
      await cloudSyncStorage.setSyncStatus({
        ...syncStatus,
        email,
      });

      await Promise.all([
        storage.set(STORAGE_KEYS.ONBOARDING_COMPLETED, false),
        storage.set(STORAGE_KEYS.PENDING_ONBOARDING, true),
      ]);
      setRequiresOnboarding(true);

      return createdUser;
    } finally {
      setBusy(false);
    }
  };

  const signIn = async (email, password) => {
    try {
      console.log('[AuthContext] signIn called for:', email);
      setBusy(true);
      await new Promise(resolve => setTimeout(resolve, 0));

      let signedInUser;

      console.log('[AuthContext] Calling SupabaseAuthService.signInWithPassword...');
      const session = await Promise.race([
        SupabaseAuthService.signInWithPassword(email, password),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Remote sign-in timed out')), 10000)),
      ]);

      console.log('[AuthContext] Got session:', !!session);
      if (!session?.user?.id) {
        throw new Error('Supabase session required');
      }

      console.log('[AuthContext] Restoring session...');
      signedInUser = await _restoreSupabaseSession(email, session);

      if (!signedInUser) throw new Error('Sign-in failed');

      console.log('[AuthContext] Setting onboarding flags...');
      await storage.set(STORAGE_KEYS.PENDING_ONBOARDING, false);
      setRequiresOnboarding(false);

      console.log('[AuthContext] Sign in complete!');

      // Initialize push notifications after login
      try {
        if (supabase) {
          await PushNotificationService.initialize(supabase);
        }
      } catch (pushErr) {
        if (__DEV__) console.warn('[AuthContext] Push init failed:', pushErr?.message);
      }
      return signedInUser;
    } catch (error) {
      console.error('[AuthContext] Sign in error:', error);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  /**
   * Sign out with scope control.
   * @param {'global'|'local'} scope
   *   - 'global' (default): Revokes all refresh tokens everywhere.
   *     Recommended for "Sign out everywhere" / lost phone.
   *   - 'local': Only clears session on this device.
   */
  const signOut = async (scope = 'global') => {
    // Set flag to prevent auth listener from running during sign out
    isSigningOutRef.current = true;
    
    try {
      setBusy(true);
      setRequiresOnboarding(false);

      // Clear React state FIRST to immediately show loading state
      setUser(null);
      setUserProfile(null);
      setInitializing(true);
      try {
        if (supabase) {
          await Promise.race([
            PushNotificationService.removeToken(supabase),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Push token removal timeout')), 3000)
            )
          ]);
        }
      } catch (pushErr) {
        if (__DEV__) console.warn('[AuthContext] Push token cleanup failed:', pushErr?.message);
      }

      await StorageRouter.signOut(scope);
      await SupabaseAuthService.clearStoredCredentials();
      await AnalyticsService.clearLocalCache();
      await ConnectionMemory.clear();
      await clearLocalCache();
    } catch (error) {
      console.error('[AuthContext] signOut error:', error);
      // Even if there's an error, we still want to sign out locally
      setUser(null);
      setUserProfile(null);
    } finally {
      // Reset the flag BEFORE setting initializing to false
      // This prevents the auth listener from running when initializing becomes false
      isSigningOutRef.current = false;
      
      // Reset bootstrap ref so user can sign in again
      bootstrappedRef.current = false;
      
      setBusy(false);
      setInitializing(false);
    }
  };

  /** Convenience: sign out only this device */
  const signOutLocal = async () => await signOut('local');

  /** Convenience: sign out all devices (revokes refresh tokens) */
  const signOutGlobal = async () => await signOut('global');

  const markOnboardingComplete = async () => {
    await Promise.all([
      storage.set(STORAGE_KEYS.ONBOARDING_COMPLETED, true),
      storage.set(STORAGE_KEYS.PENDING_ONBOARDING, false),
    ]);
    if (user) {
      await updateProfile({ onboardingCompleted: true });
    }
    setRequiresOnboarding(false);
  };

  const updateProfile = async (updates) => {
    if (!user) throw new Error('No user logged in');

    await StorageRouter.updateUserDocument(user.uid, updates);

    const updatedProfile = await StorageRouter.getUserDocument(user.uid);
    setUserProfile(updatedProfile);
    await persistAppUserProfile(updatedProfile);

    return updatedProfile;
  };

  const deleteUserAccount = async () => {
    try {
      if (!user) throw new Error('No user logged in');
      setBusy(true);

      try {
        if (supabase) {
          await PushNotificationService.removeToken(supabase);
        }
      } catch (pushErr) {
        if (__DEV__) console.warn('[AuthContext] Push token cleanup failed during delete:', pushErr?.message);
      }

      // 2. Delete cloud data (profile, couple membership, couple data)
      //    Non-fatal — the RPC will also handle this, but doing it
      //    explicitly first gives us cleaner error isolation.
      try {
        if (CloudEngine.sessionPresent) {
          await CloudEngine.deleteUserData();
        }
      } catch (cloudErr) {
        console.warn('Cloud data cleanup (non-fatal):', cloudErr?.message);
      }

      // 3. Delete the Supabase auth user via RPC
      //    This is the critical step — removes auth.users row which
      //    cascades to profiles and invalidates all sessions.
      try {
        await SupabaseAuthService.deleteAccount();
      } catch (rpcErr) {
        if (__DEV__) console.error('Supabase account deletion failed:', rpcErr?.message);
        // If RPC fails (e.g. function not deployed yet), still try sign-out
        try {
          await SupabaseAuthService.signOut('global');
        } catch (_) { /* swallow */ }
      }
      await SupabaseAuthService.clearStoredCredentials();

      // 4. Clean up cache and in-memory state
      await ConnectionMemory.clear();
      await AnalyticsService.clearLocalCache();

      // 5. Delete cached user document
      await StorageRouter.deleteUserDocument(user.uid);

      // 6. Clear all remaining device cache
      await clearLocalCache();

      // 8. Update React state — triggers navigation to auth screen
      setUser(null);
      setUserProfile(null);

      return true;
    } catch (error) {
      if (__DEV__) console.error('Error deleting account:', error);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const value = useMemo(() => ({
    user,
    userProfile,

    // ✅ Use this for startup gating in RootNavigator
    initializing,

    // ✅ Use this for button disabling/spinners in screens
    busy,

    signUp,
    signIn,
    signOut,
    signOutLocal,
    signOutGlobal,
    requiresOnboarding,
    markOnboardingComplete,
    updateProfile,
    deleteUserAccount,

    coupleId: userProfile?.coupleId || null,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user, userProfile, initializing, busy, requiresOnboarding]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
