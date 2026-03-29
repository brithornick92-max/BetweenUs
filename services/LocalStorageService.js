/**
 * Local Storage Service
 * 
 * Replaces Firebase with local AsyncStorage for offline-first functionality
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as ExpoCrypto from 'expo-crypto';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import CrashReporting from './CrashReporting';

const SECURE_STORE_OPTS = { keychainService: 'betweenus' };

/** Convert Uint8Array to lowercase hex string */
function bytesToHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

class LocalStorageService {
  constructor() {
    this.currentUser = null;
    this.listeners = new Map();
  }

  _hashPassword(password, salt, iterations) {
    const enc = new TextEncoder();
    const derived = pbkdf2(sha256, enc.encode(password), enc.encode(salt), {
      c: iterations,
      dkLen: 32,
    });
    return bytesToHex(derived);
  }

  // Hash email into a SecureStore-safe key (keys only allow [\w.-])
  _emailToKey(email) {
    const enc = new TextEncoder();
    return bytesToHex(sha256(enc.encode(email.toLowerCase())));
  }

  // Persist user profile to SecureStore so it survives app reinstalls (dev builds)
  async _persistUserToSecureStore(user) {
    try {
      await SecureStore.setItemAsync(
        `user_profile_${user.uid}`,
        JSON.stringify(user),
        SECURE_STORE_OPTS
      );
    } catch (e) {
      if (__DEV__) console.warn('SecureStore user profile persist failed:', e);
    }
    try {
      await SecureStore.setItemAsync(
        `email_uid_${this._emailToKey(user.email)}`,
        user.uid,
        SECURE_STORE_OPTS
      );
    } catch (e) {
      if (__DEV__) console.warn('SecureStore email index persist failed:', e);
    }
    try {
      await SecureStore.setItemAsync('currentUserId', user.uid, SECURE_STORE_OPTS);
    } catch (e) {
      if (__DEV__) console.warn('SecureStore currentUserId persist failed:', e);
    }
  }

  // Recover user from SecureStore into AsyncStorage after a reinstall
  async _recoverUserByEmail(email) {
    try {
      const uid = await SecureStore.getItemAsync(
        `email_uid_${this._emailToKey(email)}`,
        SECURE_STORE_OPTS
      );
      if (!uid) return null;

      const raw = await SecureStore.getItemAsync(`user_profile_${uid}`, SECURE_STORE_OPTS);
      if (!raw) return null;

      const user = JSON.parse(raw);
      // Restore to AsyncStorage
      await AsyncStorage.setItem(`user_${uid}`, JSON.stringify(user));
      await AsyncStorage.setItem('currentUserId', uid);
      await this._setEmailIndex(user.email, uid);

      return user;
    } catch (e) {
      if (__DEV__) console.warn('SecureStore user recovery by email failed:', e);
      return null;
    }
  }

  // Recover the last signed-in user from SecureStore
  async _recoverCurrentUser() {
    try {
      const uid = await SecureStore.getItemAsync('currentUserId', SECURE_STORE_OPTS);
      if (!uid) return null;

      const raw = await SecureStore.getItemAsync(`user_profile_${uid}`, SECURE_STORE_OPTS);
      if (!raw) return null;

      const user = JSON.parse(raw);
      // Restore to AsyncStorage
      await AsyncStorage.setItem(`user_${uid}`, JSON.stringify(user));
      await AsyncStorage.setItem('currentUserId', uid);
      await this._setEmailIndex(user.email, uid);

      return user;
    } catch (e) {
      if (__DEV__) console.warn('SecureStore current user recovery failed:', e);
      return null;
    }
  }

  // Authentication Methods (Local-first, SecureStore-backed)
  async createAccount(email, password, displayName) {
    try {
      const userId = this.generateUserId();
      const passwordSalt = bytesToHex(ExpoCrypto.getRandomBytes(16));
      // 120,000 iterations: improved from 50k toward OWASP recommendations,
      // balanced for mobile performance (~3-4s in pure JS). Credentials are stored
      // in hardware-backed SecureStore, not exposed database.
      const passwordIterations = 120000;
      const passwordHash = this._hashPassword(password, passwordSalt, passwordIterations);

      // Store credentials in SecureStore (not AsyncStorage)
      await SecureStore.setItemAsync(
        `cred_${userId}`,
        JSON.stringify({ passwordHash, passwordSalt, passwordIterations }),
        SECURE_STORE_OPTS
      );

      // Store non-sensitive profile in AsyncStorage
      const user = {
        uid: userId,
        email,
        displayName,
        createdAt: new Date().toISOString(),
        emailVerified: false,
      };

      // Store user data — all independent, run in parallel
      await Promise.all([
        AsyncStorage.setItem(`user_${userId}`, JSON.stringify(user)),
        AsyncStorage.setItem('currentUserId', userId),
        this._setEmailIndex(email, userId),
        this._persistUserToSecureStore(user),
      ]);

      this.currentUser = user;
      this.notifyAuthListeners(user);

      return { user };
    } catch (error) {
      if (__DEV__) console.error('Create account error:', error);
      throw error;
    }
  }

  async signInWithEmailAndPassword(email, password) {
    try {
      // Use email index for O(1) lookup instead of scanning all users
      let user = null;
      const uid = await this._getUidByEmail(email);
      if (uid) {
        const raw = await AsyncStorage.getItem(`user_${uid}`);
        if (raw) user = JSON.parse(raw);
      }
      // Fallback: scan all users if index miss (legacy accounts)
      if (!user) {
        const users = await this.getAllUsers();
        user = users.find(u => u.email === email);
        // Backfill index for next time
        if (user) await this._setEmailIndex(email, user.uid);
      }
      
      if (!user) {
        // AsyncStorage may have been wiped by a dev build reinstall;
        // try recovering the user from SecureStore (Keychain persists).
        user = await this._recoverUserByEmail(email);
      }

      if (!user) {
        throw new Error('User not found');
      }

      // Load credentials from SecureStore first, fall back to legacy AsyncStorage
      let cred = null;
      try {
        const credRaw = await SecureStore.getItemAsync(`cred_${user.uid}`, SECURE_STORE_OPTS);
        if (credRaw) cred = JSON.parse(credRaw);
      } catch { /* fall through to legacy */ }

      // Legacy: credentials were stored inside the AsyncStorage user object
      if (!cred && user.passwordHash) {
        cred = {
          passwordHash: user.passwordHash,
          passwordSalt: user.passwordSalt,
          passwordIterations: user.passwordIterations,
        };
      }

      if (cred?.passwordHash) {
        if (cred.passwordSalt && cred.passwordIterations) {
          const providedHash = this._hashPassword(password, cred.passwordSalt, cred.passwordIterations);
          if (providedHash !== cred.passwordHash) {
            throw new Error('Invalid password');
          }
        } else {
          // Legacy SHA256 verification + upgrade to PBKDF2
          const providedHash = await ExpoCrypto.digestStringAsync(
            ExpoCrypto.CryptoDigestAlgorithm.SHA256,
            password,
          );
          if (providedHash !== cred.passwordHash) {
            throw new Error('Invalid password');
          }
          const passwordSalt = bytesToHex(ExpoCrypto.getRandomBytes(16));
          const passwordIterations = 120000;
          const upgradedHash = this._hashPassword(password, passwordSalt, passwordIterations);
          cred = { passwordHash: upgradedHash, passwordSalt, passwordIterations };
        }

        // Migrate credentials to SecureStore & strip from AsyncStorage user object
        await SecureStore.setItemAsync(
          `cred_${user.uid}`,
          JSON.stringify(cred),
          SECURE_STORE_OPTS
        );
        if (user.passwordHash) {
          const { passwordHash, passwordSalt, passwordIterations, ...cleanUser } = user;
          await AsyncStorage.setItem(`user_${user.uid}`, JSON.stringify(cleanUser));
          user = cleanUser;
        }
      }

      await AsyncStorage.setItem('currentUserId', user.uid);
      await this._persistUserToSecureStore(user);
      this.currentUser = user;
      this.notifyAuthListeners(user);

      return { user };
    } catch (error) {
      if (__DEV__) console.error('Sign in error:', error);
      throw error;
    }
  }

  async signOut(scope = 'global') {
    try {
      // Sign out from Supabase with scope control
      try {
        const SupabaseAuthService = require('./supabase/SupabaseAuthService').default;
        await SupabaseAuthService.signOut(scope);
      } catch (e) {
        // Supabase may not be configured — continue with local cleanup
        if (__DEV__) console.warn('[LocalStorageService] Supabase sign-out skipped:', e?.message);
      }

      await AsyncStorage.removeItem('currentUserId');
      try {
        await SecureStore.deleteItemAsync('currentUserId', SECURE_STORE_OPTS);
      } catch { /* non-critical */ }
      // Clear couple state so a different account doesn't inherit a stale couple ID
      await AsyncStorage.multiRemove([
        '@betweenus:coupleId',
        '@betweenus:coupleRole',
        '@betweenus:partnerProfile',
        '@betweenus:lastPartnerActivity',
        '@betweenus:onboardingCompleted',
        '@betweenus:couplePremiumCache',
      ]);
      this.currentUser = null;
      this.notifyAuthListeners(null);
    } catch (error) {
      if (__DEV__) console.error('Sign out error:', error);
      throw error;
    }
  }

  async getCurrentUser() {
    try {
      if (this.currentUser) {
        return this.currentUser;
      }

      const userId = await AsyncStorage.getItem('currentUserId');
      if (!userId) {
        // AsyncStorage wiped (dev build reinstall) — try SecureStore recovery
        const recovered = await this._recoverCurrentUser();
        if (recovered) {
          this.currentUser = recovered;
          return recovered;
        }
        return null;
      }

      const userData = await AsyncStorage.getItem(`user_${userId}`);
      if (userData) {
        const parsed = JSON.parse(userData);
        if (parsed && typeof parsed === 'object' && parsed.uid) {
          // Strip legacy credential fields from AsyncStorage if still present
          if (parsed.passwordHash) {
            const { passwordHash, passwordSalt, passwordIterations, ...cleanUser } = parsed;
            await AsyncStorage.setItem(`user_${userId}`, JSON.stringify(cleanUser));
            this.currentUser = cleanUser;
          } else {
            this.currentUser = parsed;
          }
          return this.currentUser;
        }
      }

      return null;
    } catch (error) {
      if (__DEV__) console.error('Get current user error:', error);
      return null;
    }
  }

  onAuthStateChanged(callback) {
    const listenerId = Date.now().toString();
    this.listeners.set(listenerId, callback);

    // Call immediately with current state
    this.getCurrentUser()
      .then((user) => {
        callback(user);
      })
      .catch((err) => {
        if (__DEV__) console.error('onAuthStateChanged init error:', err);
        try {
          callback(null);
        } catch (e) {
          // swallow callback errors to avoid crashing listener registration
        }
      });

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listenerId);
    };
  }

  // Document Methods
  async getUserDocument(userId) {
    try {
      const userData = await AsyncStorage.getItem(`userDoc_${userId}`);
      return userData ? JSON.parse(userData) : {};
    } catch (error) {
      if (__DEV__) console.error('Get user document error:', error);
      return {};
    }
  }

  async updateUserDocument(userId, data) {
    try {
      const existing = await this.getUserDocument(userId);
      const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
      await AsyncStorage.setItem(`userDoc_${userId}`, JSON.stringify(updated));
      return updated;
    } catch (error) {
      if (__DEV__) console.error('Update user document error:', error);
      throw error;
    }
  }

  async deleteUserDocument(userId) {
    try {
      await AsyncStorage.removeItem(`userDoc_${userId}`);
      await AsyncStorage.removeItem(`user_${userId}`);
    } catch (error) {
      if (__DEV__) console.error('Delete user document error:', error);
      throw error;
    }
  }

  // Content Methods
  async getPrompts(filters = {}) {
    try {
      // Load from local content files
      const promptsData = require('../content/prompts.json');
      const prompts = Array.isArray(promptsData?.items) ? promptsData.items : [];
      
      let filteredPrompts = prompts;

      // Apply filters
      if (filters.category) {
        filteredPrompts = filteredPrompts.filter(p => p.category === filters.category);
      }

      if (Array.isArray(filters.categories) && filters.categories.length > 0) {
        filteredPrompts = filteredPrompts.filter(p => filters.categories.includes(p.category));
      }
      
      if (filters.heat) {
        filteredPrompts = filteredPrompts.filter(p => p.heat === filters.heat);
      }

      if (typeof filters.heatLevel === 'number') {
        filteredPrompts = filteredPrompts.filter(p => p.heat === filters.heatLevel);
      }

      if (typeof filters.minHeatLevel === 'number') {
        filteredPrompts = filteredPrompts.filter(p => p.heat >= filters.minHeatLevel);
      }

      if (typeof filters.maxHeatLevel === 'number') {
        filteredPrompts = filteredPrompts.filter(p => p.heat <= filters.maxHeatLevel);
      }

      if (Array.isArray(filters.heatLevels) && filters.heatLevels.length > 0) {
        filteredPrompts = filteredPrompts.filter(p => filters.heatLevels.includes(p.heat));
      }

      if (filters.limit) {
        filteredPrompts = filteredPrompts.slice(0, filters.limit);
      }

      return filteredPrompts;
    } catch (error) {
      if (__DEV__) console.error('Get prompts error:', error);
      return [];
    }
  }

  async getDates(filters = {}) {
    try {
      // Load from local content files
      const datesData = require('../content/dates.json');
      const dates = Array.isArray(datesData?.items) ? datesData.items : [];
      
      let filteredDates = dates;

      // Apply filters
      if (filters.category) {
        filteredDates = filteredDates.filter(d => d.category === filters.category);
      }
      
      if (filters.heat) {
        filteredDates = filteredDates.filter(d => d.heat === filters.heat);
      }

      if (typeof filters.heatLevel === 'number') {
        filteredDates = filteredDates.filter(d => d.heat === filters.heatLevel);
      }

      if (Array.isArray(filters.categories) && filters.categories.length > 0) {
        filteredDates = filteredDates.filter(d => filters.categories.includes(d.category));
      }

      if (filters.limit) {
        filteredDates = filteredDates.slice(0, filters.limit);
      }

      return filteredDates;
    } catch (error) {
      if (__DEV__) console.error('Get dates error:', error);
      return [];
    }
  }

  // Usage Tracking
  async getDailyUsage(userId) {
    try {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const usageData = await AsyncStorage.getItem(`usage_${userId}_${today}`);
      
      return usageData ? JSON.parse(usageData) : {
        date: today,
        prompts: 0,
        dates: 0,
        challenges: 0
      };
    } catch (error) {
      if (__DEV__) console.error('Get daily usage error:', error);
      return { date: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })(), prompts: 0, dates: 0, challenges: 0 };
    }
  }

  async trackDailyUsage(userId, type) {
    try {
      const d2 = new Date();
      const today = `${d2.getFullYear()}-${String(d2.getMonth()+1).padStart(2,'0')}-${String(d2.getDate()).padStart(2,'0')}`;
      const usage = await this.getDailyUsage(userId);
      
      usage[type] = (usage[type] || 0) + 1;
      usage.lastUpdated = new Date().toISOString();

      await AsyncStorage.setItem(`usage_${userId}_${today}`, JSON.stringify(usage));
      return usage;
    } catch (error) {
      if (__DEV__) console.error('Track daily usage error:', error);
      throw error;
    }
  }

  // Memory/Journal Methods
  async saveMemory(userId, memoryData) {
    try {
      const memoryId = this.generateId();
      const memory = {
        id: memoryId,
        userId,
        ...memoryData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await AsyncStorage.setItem(`memory_${memoryId}`, JSON.stringify(memory));
      
      // Update user's memory list
      const memories = await this.getUserMemories(userId);
      memories.push(memoryId);
      await AsyncStorage.setItem(`userMemories_${userId}`, JSON.stringify(memories));

      return memory;
    } catch (error) {
      if (__DEV__) console.error('Save memory error:', error);
      throw error;
    }
  }

  async getUserMemories(userId) {
    try {
      const memoriesData = await AsyncStorage.getItem(`userMemories_${userId}`);
      const memoryIds = memoriesData ? JSON.parse(memoriesData) : [];
      
      const memories = [];
      for (const memoryId of memoryIds) {
        const memoryData = await AsyncStorage.getItem(`memory_${memoryId}`);
        if (memoryData) {
          memories.push(JSON.parse(memoryData));
        }
      }

      return memories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (error) {
      if (__DEV__) console.error('Get user memories error:', error);
      return [];
    }
  }

  async updateMemory(memoryId, updates) {
    try {
      const memoryData = await AsyncStorage.getItem(`memory_${memoryId}`);
      if (!memoryData) {
        throw new Error('Memory not found');
      }

      const memory = JSON.parse(memoryData);
      const updatedMemory = {
        ...memory,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await AsyncStorage.setItem(`memory_${memoryId}`, JSON.stringify(updatedMemory));
      return updatedMemory;
    } catch (error) {
      if (__DEV__) console.error('Update memory error:', error);
      throw error;
    }
  }

  async deleteMemory(memoryId) {
    try {
      const memoryData = await AsyncStorage.getItem(`memory_${memoryId}`);
      if (!memoryData) {
        return;
      }

      const memory = JSON.parse(memoryData);
      await AsyncStorage.removeItem(`memory_${memoryId}`);

      // Remove from user's memory list
      const memories = await this.getUserMemories(memory.userId);
      const filteredMemories = memories.filter(m => m.id !== memoryId).map(m => m.id);
      await AsyncStorage.setItem(`userMemories_${memory.userId}`, JSON.stringify(filteredMemories));
    } catch (error) {
      if (__DEV__) console.error('Delete memory error:', error);
      throw error;
    }
  }

  // Partner Methods
  async linkPartner(userId, partnerCode) {
    try {
      // In a real app, this would validate the partner code
      // For now, we'll just store the link
      const userDoc = await this.getUserDocument(userId);
      const updatedDoc = {
        ...userDoc,
        partnerId: partnerCode,
        partnerLinkedAt: new Date().toISOString()
      };

      await this.updateUserDocument(userId, updatedDoc);
      return updatedDoc;
    } catch (error) {
      if (__DEV__) console.error('Link partner error:', error);
      throw error;
    }
  }

  async unlinkPartner(userId) {
    try {
      const userDoc = await this.getUserDocument(userId);
      const updatedDoc = {
        ...userDoc,
        partnerId: null,
        partnerLinkedAt: null,
        partnerUnlinkedAt: new Date().toISOString()
      };

      await this.updateUserDocument(userId, updatedDoc);
      return updatedDoc;
    } catch (error) {
      if (__DEV__) console.error('Unlink partner error:', error);
      throw error;
    }
  }

  // Utility Methods
  generateUserId() {
    const { randomUUID } = require('expo-crypto');
    return 'user_' + randomUUID();
  }

  generateId() {
    const { randomUUID } = require('expo-crypto');
    return randomUUID();
  }

  // Email-to-UID index for O(1) lookups
  async _setEmailIndex(email, uid) {
    try {
      await AsyncStorage.setItem(`email_idx_${email.toLowerCase()}`, uid);
    } catch { /* non-critical */ }
  }

  async _getUidByEmail(email) {
    try {
      return await AsyncStorage.getItem(`email_idx_${email.toLowerCase()}`);
    } catch {
      return null;
    }
  }

  async getAllUsers() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const userKeys = keys.filter(key => key.startsWith('user_'));
      
      const users = [];
      for (const key of userKeys) {
        const userData = await AsyncStorage.getItem(key);
        if (userData) {
          users.push(JSON.parse(userData));
        }
      }

      return users;
    } catch (error) {
      if (__DEV__) console.error('Get all users error:', error);
      return [];
    }
  }

  notifyAuthListeners(user) {
    this.listeners.forEach(callback => {
      try {
        callback(user);
      } catch (error) {
        if (__DEV__) console.error('Auth listener error:', error);
      }
    });
  }

  // Batch operations
  async batchWrite(operations) {
    try {
      for (const operation of operations) {
        const { type, key, data } = operation;
        
        switch (type) {
          case 'set':
            await AsyncStorage.setItem(key, JSON.stringify(data));
            break;
          case 'remove':
            await AsyncStorage.removeItem(key);
            break;
          case 'update': {
            const existing = await AsyncStorage.getItem(key);
            let existingData = {};
            if (existing) {
              const parsed = JSON.parse(existing);
              existingData = (parsed && typeof parsed === 'object') ? parsed : {};
            }
            const updatedData = { ...existingData, ...data };
            await AsyncStorage.setItem(key, JSON.stringify(updatedData));
            break;
          }
        }
      }
    } catch (error) {
      if (__DEV__) console.error('Batch write error:', error);
      throw error;
    }
  }

  // Clear all data (for testing/reset)
  async clearAllData() {
    try {
      await AsyncStorage.clear();
      this.currentUser = null;
      this.notifyAuthListeners(null);
    } catch (error) {
      if (__DEV__) console.error('Clear all data error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export default new LocalStorageService();
