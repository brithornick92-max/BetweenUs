import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import StorageRouter from '../services/storage/StorageRouter';
import CloudEngine from '../services/storage/CloudEngine';
import EncryptionService from '../services/EncryptionService';
import E2EEncryption from '../services/e2ee/E2EEncryption';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CoupleKeyService from '../services/security/CoupleKeyService';
import ConnectionMemory from '../utils/connectionMemory';
import SupabaseAuthService from '../services/supabase/SupabaseAuthService';
import { cloudSyncStorage } from '../utils/storage';
import Database from '../services/db/Database';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import AnalyticsService from '../services/AnalyticsService';
import ExperimentService from '../services/ExperimentService';
import CrashReporting from '../services/CrashReporting';
import PushNotificationService from '../services/PushNotificationService';
import { supabase } from '../config/supabase';
import { storage, STORAGE_KEYS } from '../utils/storage';
import { NicknameEngine, RelationshipSeasons, SoftBoundaries } from '../services/PolishEngine';
import { ContentIntensityMatcher, RelationshipClimateState } from '../services/ConnectionEngine';

const AuthContext = createContext(null);

function mergeCloudProfile(localProfile, remoteProfile) {
  const safeLocal = localProfile && typeof localProfile === 'object' ? localProfile : {};
  const remotePrefs = remoteProfile?.preferences && typeof remoteProfile.preferences === 'object'
    ? remoteProfile.preferences
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
      ...(safeLocal.preferences && typeof safeLocal.preferences === 'object' ? safeLocal.preferences : {}),
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

async function clearLocalAsyncStorage() {
  try {
    await AsyncStorage.clear();
  } catch (_) {}
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

  const finishBootstrap = (active) => {
    if (active && !bootstrappedRef.current) {
      bootstrappedRef.current = true;
      setInitializing(false);
    }
  };

  useEffect(() => {
    let active = true;

    const unsubscribe = StorageRouter.onAuthStateChanged(async (localUser) => {
      try {
        if (!active) return;

        // Set auth state immediately (don’t block UI while doing heavy work)
        setUser(localUser || null);

        if (!localUser) {
          AnalyticsService.setUser(null);
          ExperimentService.setUser(null);
          setUserProfile(null);
          finishBootstrap(active);
          await EncryptionService.clearKey();
          E2EEncryption.clearCache();
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

          finishBootstrap(active);

          let supabaseSession = null;
          try {
            supabaseSession = await Promise.race([
              SupabaseAuthService.getSession(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('getSession timed out')), 10000)),
            ]);
          } catch (e) {
            if (__DEV__) console.warn('[AuthContext] getSession failed (non-fatal):', e?.message);
            supabaseSession = null;
          }

          await StorageRouter.initialize({
            user: localUser,
            supabaseSessionPresent: !!supabaseSession,
          });

          if (supabaseSession) {
            try {
              const cloudUserId = supabaseSession.user?.id;
              if (!cloudUserId) {
                throw new Error('Supabase user not found in session');
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
            }
          }

          // Sync display_name to Supabase if the user has set a name in
          // Identity settings but the cloud profile still has the email
          // prefix from signup.
          if (supabaseSession && profile?.partnerNames?.myName) {
            try {
              const cloudUserId = supabaseSession.user?.id;
              if (!cloudUserId) {
                throw new Error('Supabase user not found in session');
              }

              await Promise.race([
                CloudEngine.upsertProfile(cloudUserId, {
                  display_name: profile.partnerNames.myName,
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('upsertProfile timed out')), 10000)),
              ]);
            } catch (e) {
              if (__DEV__) console.warn('[AuthContext] display_name sync (non-fatal):', e?.message);
            }
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
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  /**
   * Also create a Supabase account so pairing works without a second sign-in.
   * Failures are non-fatal — the user can still use the app locally.
   */
  const _bridgeSupabaseAuth = async (email, password, isNewAccount) => {
    try {
      let session;
      if (isNewAccount) {
        session = await SupabaseAuthService.signUp(email, password);
        // Some Supabase projects require email confirmation — signUp returns
        // null session in that case. Immediately try signIn as fallback.
        if (!session) {
          try {
            session = await SupabaseAuthService.signInWithPassword(email, password);
          } catch (e) {
              if (__DEV__) console.warn('[AuthContext] Post-signup signIn failed (confirmation may be required):', e?.message);
            }
        }
      } else {
        session = await SupabaseAuthService.signInWithPassword(email, password);
      }
      if (session) {
        await StorageRouter.setSupabaseSession(session);
        await SupabaseAuthService.storeCredentials(email, password);
        const syncStatus = await cloudSyncStorage.getSyncStatus();
        await cloudSyncStorage.setSyncStatus({
          ...syncStatus,
          email: session.user?.email || email,
        });
        if (__DEV__) console.log('✅ Supabase session bridged for', email);
      }
    } catch (err) {
      // If sign-up gets "User already registered", try sign-in instead
      if (isNewAccount && String(err?.message || '').includes('User already registered')) {
        try {
          const session = await SupabaseAuthService.signInWithPassword(email, password);
          if (session) {
            await StorageRouter.setSupabaseSession(session);
            await SupabaseAuthService.storeCredentials(email, password);
            const syncStatus = await cloudSyncStorage.getSyncStatus();
            await cloudSyncStorage.setSyncStatus({
              ...syncStatus,
              email: session.user?.email || email,
            });
          }
        } catch (e) {
          if (__DEV__) console.warn('[AuthContext] Retry signIn after "already registered" failed:', e?.message);
        }
      }
      if (__DEV__) console.warn('⚠️ Supabase bridge (non-fatal):', err?.message);
    }
  };

  const _restoreSupabaseAccount = async (email, password) => {
    const session = await SupabaseAuthService.signInWithPassword(email, password);
    return _restoreSupabaseSession(email, password, session);
  };

  const _restoreSupabaseSession = async (email, password, session) => {
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
      password,
      displayName: remoteDisplayName,
      emailVerified: !!(remoteUser?.email_confirmed_at || remoteUser?.confirmed_at),
    });
    await SupabaseAuthService.storeCredentials(remoteEmail, password);

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
      // Yield to the render cycle so the loading UI renders before the
      // blocking PBKDF2 hash computation begins on the JS thread.
      await new Promise(resolve => setTimeout(resolve, 0));
      const createdUser = await StorageRouter.createAccount(email, password, displayName);
      await Promise.all([
        storage.set(STORAGE_KEYS.ONBOARDING_COMPLETED, false),
        storage.set(STORAGE_KEYS.PENDING_ONBOARDING, true),
      ]);
      setRequiresOnboarding(true);

      // Bridge Supabase auth so pairing is ready immediately (fire-and-forget — non-fatal)
      _bridgeSupabaseAuth(email, password, true).catch(() => {});

      // Verify encryption is working for this user
      if (__DEV__) {
        try {
          const encrypted = await EncryptionService.encryptString('encryption_test');
          await EncryptionService.decryptString(encrypted);
          console.log('✅ Encryption verified for new account');
        } catch (e) {
          console.warn('⚠️ Encryption verification failed:', e.message);
        }
      }

      return createdUser;
    } finally {
      setBusy(false);
    }
  };

  const signIn = async (email, password) => {
    try {
      setBusy(true);
      await new Promise(resolve => setTimeout(resolve, 0));
      let signedInUser;
      let shouldBridgeSupabase = true;
      let remoteAuthError = null;

      try {
        const remoteSession = await Promise.race([
          SupabaseAuthService.signInWithPassword(email, password),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Remote sign-in timed out')), 5000)),
        ]);

        if (remoteSession) {
          signedInUser = await _restoreSupabaseSession(email, password, remoteSession);
          shouldBridgeSupabase = false;
        }
      } catch (remoteError) {
        remoteAuthError = remoteError;
      }

      if (!signedInUser) {
        try {
          signedInUser = await StorageRouter.signInWithEmailAndPassword(email, password);
        } catch (localError) {
          const localMessage = String(localError?.message || '');
          const shouldTrySupabase =
            localMessage.includes('User not found') ||
            localMessage.includes('Invalid password');

          if (!shouldTrySupabase) {
            throw localError;
          }

          try {
            signedInUser = await _restoreSupabaseAccount(email, password);
            shouldBridgeSupabase = false;
          } catch (fallbackRemoteError) {
            const remoteMessage = String(fallbackRemoteError?.message || '');
            if (remoteMessage.includes('Supabase is not configured')) {
              throw localError;
            }
            throw fallbackRemoteError;
          }
        }
      }

      if (!signedInUser && remoteAuthError) throw remoteAuthError;

      await storage.set(STORAGE_KEYS.PENDING_ONBOARDING, false);
      setRequiresOnboarding(false);

      if (shouldBridgeSupabase) {
        _bridgeSupabaseAuth(email, password, false).catch(() => {});
      }

      return signedInUser;
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
    try {
      setBusy(true);
      setRequiresOnboarding(false);

      // Get coupleId BEFORE signing out so it's still accessible
      const coupleId = await StorageRouter.getCoupleId();

      try {
        if (supabase) {
          await PushNotificationService.removeToken(supabase);
        }
      } catch (pushErr) {
        if (__DEV__) console.warn('[AuthContext] Push token cleanup failed:', pushErr?.message);
      }

      await StorageRouter.signOut(scope);
      await SupabaseAuthService.clearStoredCredentials();

      if (coupleId) {
        await CoupleKeyService.clearCoupleKey(coupleId);
      }
      await AnalyticsService.clearLocalCache();
      await EncryptionService.clearKey();
      E2EEncryption.clearCache();
      await ConnectionMemory.clear();

      // A signed-out device should not retain plaintext account or profile data.
      await clearLocalAsyncStorage();
    } finally {
      setBusy(false);
    }
  };

  /** Convenience: sign out only this device */
  const signOutLocal = () => signOut('local');

  /** Convenience: sign out all devices (revokes refresh tokens) */
  const signOutGlobal = () => signOut('global');

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

      // 1. Get coupleId before we start tearing things down
      const coupleId = await StorageRouter.getCoupleId();

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

      // 4. Clean up local encryption / couple key material
      await EncryptionService.clearKey();
      E2EEncryption.clearCache();
      await ConnectionMemory.clear();
      await AnalyticsService.clearLocalCache();

      if (coupleId) {
        await CoupleKeyService.clearCoupleKey(coupleId);
      }

      // 5. Delete local user document
      await StorageRouter.deleteUserDocument(user.uid);

      // 6. Clear all remaining local data
      await clearLocalAsyncStorage();

      // 6b. Clear SecureStore auth backup (persists across reinstalls)
      try {
        const SECURE_STORE_OPTS = { keychainService: 'betweenus' };
        const LocalStorageService = require('../services/LocalStorageService').default;
        await SecureStore.deleteItemAsync('currentUserId', SECURE_STORE_OPTS);
        if (user.uid) {
          await SecureStore.deleteItemAsync(`user_profile_${user.uid}`, SECURE_STORE_OPTS);
          await SecureStore.deleteItemAsync(`cred_${user.uid}`, SECURE_STORE_OPTS);
        }
        if (user.email) {
          const emailKey = LocalStorageService._emailToKey(user.email);
          await SecureStore.deleteItemAsync(`email_uid_${emailKey}`, SECURE_STORE_OPTS);
        }
      } catch (secErr) {
        if (__DEV__) console.warn('SecureStore cleanup (non-fatal):', secErr?.message);
      }

      // 7. Purge SQLite database file from disk
      try {
        await Database.close();
        const dbPath = `${FileSystem.documentDirectory}SQLite/betweenus.db`;
        await FileSystem.deleteAsync(dbPath, { idempotent: true });
      } catch (dbErr) {
        console.warn('SQLite cleanup (non-fatal):', dbErr?.message);
      }

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
