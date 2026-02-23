import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import StorageRouter from '../services/storage/StorageRouter';
import EncryptionService from '../services/EncryptionService';
import E2EEncryption from '../services/e2ee/E2EEncryption';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CoupleKeyService from '../services/security/CoupleKeyService';
import ConnectionMemory from '../utils/connectionMemory';

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
          setUserProfile(null);
          await EncryptionService.clearKey();
          E2EEncryption.clearCache();
        } else {
          const profile = await StorageRouter.getUserDocument(localUser.uid);
          if (!active) return;
          setUserProfile(profile);

          await StorageRouter.initialize({ user: localUser });

        }
      } catch (error) {
        console.error('Error loading user profile:', error);
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

  const signUp = async (email, password, displayName) => {
    try {
      setBusy(true);
      const createdUser = await StorageRouter.createAccount(email, password, displayName);

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

      await StorageRouter.deleteUserDocument(user.uid);

      await EncryptionService.clearKey();
      E2EEncryption.clearCache();
      await ConnectionMemory.clear();

      const coupleId = await StorageRouter.getCoupleId();
      if (coupleId) {
        await CoupleKeyService.clearCoupleKey(coupleId);
      }

      await AsyncStorage.clear();

      setUser(null);
      setUserProfile(null);

      return true;
    } catch (error) {
      console.error('Error deleting account:', error);
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
