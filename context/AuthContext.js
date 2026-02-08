import React, { createContext, useContext, useEffect, useState } from 'react';
import StorageRouter from '../services/storage/StorageRouter';
import EncryptionService from '../services/EncryptionService';
import E2EEncryption from '../services/e2ee/E2EEncryption';
import AsyncStorage from '@react-native-async-storage/async-storage';
import personalizationEngine from '../utils/personalizationEngine';
import mlModelManager from '../utils/mlModelManager';
import CoupleKeyService from '../services/security/CoupleKeyService';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribe = StorageRouter.onAuthStateChanged(async (localUser) => {
      try {
        if (localUser) {
          setUser(localUser);
          // Load user profile from storage
          const profile = await StorageRouter.getUserDocument(localUser.uid);
          setUserProfile(profile);
          await StorageRouter.initialize({ user: localUser });
          
          // Initialize personalization engine
          await personalizationEngine.initializeUser(localUser.uid, profile);
          
          // Initialize ML models
          await mlModelManager.initialize();
        } else {
          setUser(null);
          setUserProfile(null);
          // Clear encryption keys on logout
          await EncryptionService.clearKey();
          E2EEncryption.clearCache();
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const signUp = async (email, password, displayName) => {
    try {
      setLoading(true);
      const user = await StorageRouter.createAccount(email, password, displayName);
      
      // Test encryption on first signup
      const encrypted = await EncryptionService.encryptString('encryption_test');
      await EncryptionService.decryptString(encrypted);
      
      return user;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    try {
      setLoading(true);
      const user = await StorageRouter.signInWithEmailAndPassword(email, password);
      return user;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await StorageRouter.signOut();
      const coupleId = await StorageRouter.getCoupleId();
      if (coupleId) {
        await CoupleKeyService.clearCoupleKey(coupleId);
      }
      await EncryptionService.clearKey();
      E2EEncryption.clearCache();
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates) => {
    try {
      if (!user) throw new Error('No user logged in');
      await StorageRouter.updateUserDocument(user.uid, updates);
      
      // Reload profile
      const updatedProfile = await StorageRouter.getUserDocument(user.uid);
      setUserProfile(updatedProfile);
      
      return updatedProfile;
    } catch (error) {
      throw error;
    }
  };

  const deleteUserAccount = async () => {
    try {
      if (!user) throw new Error('No user logged in');
      
      setLoading(true);
      
      // Delete user data from storage
      await StorageRouter.deleteUserDocument(user.uid);
      
      // Clear local data
      await EncryptionService.clearKey();
      E2EEncryption.clearCache();
      const coupleId = await StorageRouter.getCoupleId();
      if (coupleId) {
        await CoupleKeyService.clearCoupleKey(coupleId);
      }
      await AsyncStorage.clear();
      
      // Clear state
      setUser(null);
      setUserProfile(null);
      
      return true;
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    userProfile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    deleteUserAccount,
    coupleId: userProfile?.coupleId || null,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
