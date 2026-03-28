import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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
import CrashReporting from '../services/CrashReporting';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  // ✅ Only for first bootstrapping auth state (RootNavigator can gate on this)
  const [initializing, setInitializing] = useState(true);

  // ✅ Only for disabling buttons/spinners during actions (screens use this)
  const [busy, setBusy] = useState(false);

  const bootstrappedRef = useRef(false);

  useEffect(() => {
    let active = true;

    const unsubscribe = StorageRouter.onAuthStateChanged(async (localUser) => {
      try {
        if (!active) return;

        // Set auth state immediately (don’t block UI while doing heavy work)
        setUser(localUser || null);

        if (!localUser) {
          AnalyticsService.setUser(null);
          setUserProfile(null);
          await EncryptionService.clearKey();
          E2EEncryption.clearCache();
          await StorageRouter.initialize({ user: null, supabaseSessionPresent: false });
        } else {
          AnalyticsService.setUser(localUser.uid);
          const profile = await StorageRouter.getUserDocument(localUser.uid);
          if (!active) return;
          setUserProfile(profile);

          let supabaseSession = null;
          try {
            supabaseSession = await SupabaseAuthService.getSession();
          } catch (e) {
            if (__DEV__) console.warn('[AuthContext] getSession failed (non-fatal):', e?.message);
            supabaseSession = null;
          }

          await StorageRouter.initialize({
            user: localUser,
            supabaseSessionPresent: !!supabaseSession,
          });

          // Sync display_name to Supabase if the user has set a name in
          // Identity settings but the cloud profile still has the email
          // prefix from signup.
          if (supabaseSession && profile?.partnerNames?.myName) {
            try {
              await CloudEngine.upsertProfile(localUser.uid, {
                display_name: profile.partnerNames.myName,
              });
            } catch (e) {
              if (__DEV__) console.warn('[AuthContext] display_name sync (non-fatal):', e?.message);
            }
          }

        }
      } catch (error) {
        if (__DEV__) console.error('Error loading user profile:', error);
      } finally {
        // ✅ End initializing exactly once
        if (!bootstrappedRef.current) {
          bootstrappedRef.current = true;
          if (active) setInitializing(false);
        }
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

  const signUp = async (email, password, displayName) => {
    try {
      setBusy(true);
      const createdUser = await StorageRouter.createAccount(email, password, displayName);

      // Bridge Supabase auth so pairing is ready immediately
      await _bridgeSupabaseAuth(email, password, true);

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
      const signedInUser = await StorageRouter.signInWithEmailAndPassword(email, password);

      // Bridge Supabase auth so pairing is ready immediately
      await _bridgeSupabaseAuth(email, password, false);

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

      // Get coupleId BEFORE signing out so it's still accessible
      const coupleId = await StorageRouter.getCoupleId();

      await StorageRouter.signOut(scope);

      if (coupleId) {
        await CoupleKeyService.clearCoupleKey(coupleId);
      }
      await EncryptionService.clearKey();
      E2EEncryption.clearCache();
      await ConnectionMemory.clear();
    } finally {
      setBusy(false);
    }
  };

  /** Convenience: sign out only this device */
  const signOutLocal = () => signOut('local');

  /** Convenience: sign out all devices (revokes refresh tokens) */
  const signOutGlobal = () => signOut('global');

  const updateProfile = async (updates) => {
    if (!user) throw new Error('No user logged in');

    await StorageRouter.updateUserDocument(user.uid, updates);

    const updatedProfile = await StorageRouter.getUserDocument(user.uid);
    setUserProfile(updatedProfile);

    return updatedProfile;
  };

  const deleteUserAccount = async () => {
    try {
      if (!user) throw new Error('No user logged in');
      setBusy(true);

      // 1. Get coupleId before we start tearing things down
      const coupleId = await StorageRouter.getCoupleId();

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

      // 4. Clean up local encryption / couple key material
      await EncryptionService.clearKey();
      E2EEncryption.clearCache();
      await ConnectionMemory.clear();

      if (coupleId) {
        await CoupleKeyService.clearCoupleKey(coupleId);
      }

      // 5. Delete local user document
      await StorageRouter.deleteUserDocument(user.uid);

      // 6. Clear all remaining local data
      await AsyncStorage.clear();

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

  const value = {
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
    updateProfile,
    deleteUserAccount,

    coupleId: userProfile?.coupleId || null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
