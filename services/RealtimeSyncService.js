/**
 * Realtime Sync Service (Local Version)
 * 
 * ⚠️ DEPRECATED: This service polls LOCAL AsyncStorage, which only works
 * on a single device. It cannot sync data between partners on different
 * devices. Cross-device real-time sync is handled by:
 *   - SyncEngine.subscribeRealtime() — Supabase Realtime channels
 *   - DataLayer — unified local-first + E2EE data access
 *
 * Retained for backward compatibility until all consumers migrate to
 * DataLayer / SyncEngine.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import LocalStorageService from './LocalStorageService';

const DEPRECATION_WARNED = new Set();
function warnDeprecated(method) {
  if (!DEPRECATION_WARNED.has(method)) {
    console.warn(
      `⚠️ RealtimeSyncService.${method}() is DEPRECATED. ` +
      'It polls local AsyncStorage and cannot sync across devices. ' +
      'Migrate to DataLayer / SyncEngine for real cross-device sync.'
    );
    DEPRECATION_WARNED.add(method);
  }
}

class RealtimeSyncService {
  constructor() {
    this.listeners = new Map();
    this.pollingIntervals = new Map();
  }

  /**
   * Subscribe to partner activity updates (simulated with local storage)
   * @deprecated Use SyncEngine.subscribeRealtime() for cross-device sync
   */
  subscribeToPartnerActivity(coupleId, userId, callback) {
    warnDeprecated('subscribeToPartnerActivity');
    const key = `partner_${coupleId}`;
    
    // Store the callback
    this.listeners.set(key, callback);
    
    // Poll for updates every 5 seconds
    const interval = setInterval(async () => {
      try {
        const partnerData = await this.getPartnerActivity(coupleId, userId);
        callback(partnerData);
      } catch (error) {
        callback({ error: error.message });
      }
    }, 5000);
    
    // Clear any existing interval for this key to prevent leaks
    if (this.pollingIntervals.has(key)) {
      clearInterval(this.pollingIntervals.get(key));
    }
    this.pollingIntervals.set(key, interval);
    
    // Return unsubscribe function
    return () => {
      this.unsubscribe(key);
    };
  }

  /**
   * Get partner activity from local storage
   */
  async getPartnerActivity(coupleId, userId) {
    try {
      const coupleData = await AsyncStorage.getItem(`couple_${coupleId}`);
      if (!coupleData) {
        return { lastActivity: null, currentVibe: null, vibeUpdatedAt: null };
      }

      const couple = JSON.parse(coupleData);
      const partner = couple.partner1.userId === userId ? couple.partner2 : couple.partner1;
      
      return {
        lastActivity: partner.lastActivity,
        currentVibe: partner.currentVibe,
        vibeUpdatedAt: partner.vibeUpdatedAt
      };
    } catch (error) {
      console.error('Error getting partner activity:', error);
      return { lastActivity: null, currentVibe: null, vibeUpdatedAt: null };
    }
  }

  /**
   * Update user activity timestamp
   */
  async updateActivity(coupleId, userId) {
    try {
      const coupleData = await AsyncStorage.getItem(`couple_${coupleId}`);
      let couple;
      
      if (!coupleData) {
        // Create new couple document
        couple = {
          partner1: { userId, lastActivity: null, currentVibe: null, vibeUpdatedAt: null },
          partner2: { userId: null, lastActivity: null, currentVibe: null, vibeUpdatedAt: null },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      } else {
        couple = JSON.parse(coupleData);
      }
      
      const isPartner1 = couple.partner1.userId === userId;
      const partnerKey = isPartner1 ? 'partner1' : 'partner2';
      
      couple[partnerKey].lastActivity = new Date().toISOString();
      couple.updatedAt = new Date().toISOString();
      
      await AsyncStorage.setItem(`couple_${coupleId}`, JSON.stringify(couple));
    } catch (error) {
      console.error('Error updating activity:', error);
      throw error;
    }
  }

  /**
   * Update vibe signal
   */
  async updateVibe(coupleId, userId, vibe) {
    try {
      const coupleData = await AsyncStorage.getItem(`couple_${coupleId}`);
      if (!coupleData) {
        throw new Error('Couple not found');
      }
      
      const couple = JSON.parse(coupleData);
      const isPartner1 = couple.partner1.userId === userId;
      const partnerKey = isPartner1 ? 'partner1' : 'partner2';
      
      couple[partnerKey].currentVibe = vibe;
      couple[partnerKey].vibeUpdatedAt = new Date().toISOString();
      couple[partnerKey].lastActivity = new Date().toISOString();
      couple.updatedAt = new Date().toISOString();
      
      await AsyncStorage.setItem(`couple_${coupleId}`, JSON.stringify(couple));
    } catch (error) {
      console.error('Error updating vibe:', error);
      throw error;
    }
  }

  /**
   * Subscribe to shared prompt answers
   * @deprecated Use SyncEngine.subscribeRealtime() for cross-device sync
   */
  subscribeToSharedPrompt(coupleId, date, callback) {
    warnDeprecated('subscribeToSharedPrompt');
    const key = `prompt_${coupleId}_${date}`;
    
    // Store the callback
    this.listeners.set(key, callback);
    
    // Poll for updates every 3 seconds
    const interval = setInterval(async () => {
      try {
        const promptData = await this.getSharedPrompt(coupleId, date);
        callback(promptData);
      } catch (error) {
        callback({ error: error.message });
      }
    }, 3000);
    
    this.pollingIntervals.set(key, interval);
    
    // Return unsubscribe function
    return () => {
      this.unsubscribe(key);
    };
  }

  /**
   * Get shared prompt from local storage
   */
  async getSharedPrompt(coupleId, date) {
    try {
      const promptData = await AsyncStorage.getItem(`sharedPrompt_${coupleId}_${date}`);
      return promptData ? JSON.parse(promptData) : null;
    } catch (error) {
      console.error('Error getting shared prompt:', error);
      return null;
    }
  }

  /**
   * Save prompt answer to shared collection
   */
  async savePromptAnswer(coupleId, date, userId, promptId, promptText, answer) {
    try {
      const promptKey = `sharedPrompt_${coupleId}_${date}`;
      const existingData = await AsyncStorage.getItem(promptKey);
      
      const answerData = {
        userId,
        answer,
        answeredAt: new Date().toISOString(),
        isRevealed: false
      };
      
      let promptDoc;
      
      if (!existingData) {
        // Create new shared prompt
        promptDoc = {
          coupleId,
          date,
          promptId,
          promptText,
          partner1Answer: answerData,
          partner2Answer: null,
          bothAnswered: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      } else {
        // Update existing shared prompt
        promptDoc = JSON.parse(existingData);
        const isPartner1 = promptDoc.partner1Answer?.userId === userId;
        const isPartner2 = promptDoc.partner2Answer?.userId === userId;
        
        // Determine which partner slot to use
        let partnerKey;
        if (isPartner1) {
          partnerKey = 'partner1Answer';
        } else if (isPartner2) {
          partnerKey = 'partner2Answer';
        } else if (!promptDoc.partner1Answer) {
          partnerKey = 'partner1Answer';
        } else {
          partnerKey = 'partner2Answer';
        }
        
        promptDoc[partnerKey] = answerData;
        // Compute bothAnswered AFTER assignment
        promptDoc.bothAnswered = !!promptDoc.partner1Answer && !!promptDoc.partner2Answer;
        promptDoc.updatedAt = new Date().toISOString();
      }
      
      await AsyncStorage.setItem(promptKey, JSON.stringify(promptDoc));
    } catch (error) {
      console.error('Error saving prompt answer:', error);
      throw error;
    }
  }

  /**
   * Mark prompt as revealed
   */
  async revealPrompt(coupleId, date, userId) {
    try {
      const promptKey = `sharedPrompt_${coupleId}_${date}`;
      const promptData = await AsyncStorage.getItem(promptKey);
      
      if (!promptData) {
        throw new Error('Shared prompt not found');
      }
      
      const promptDoc = JSON.parse(promptData);
      const isPartner1 = promptDoc.partner1Answer?.userId === userId;
      const partnerKey = isPartner1 ? 'partner1Answer' : 'partner2Answer';
      
      if (promptDoc[partnerKey]) {
        promptDoc[partnerKey].isRevealed = true;
        promptDoc[partnerKey].revealedAt = new Date().toISOString();
        promptDoc.updatedAt = new Date().toISOString();
        
        await AsyncStorage.setItem(promptKey, JSON.stringify(promptDoc));
      }
    } catch (error) {
      console.error('Error revealing prompt:', error);
      throw error;
    }
  }

  /**
   * Create couple document for real-time sync
   */
  async createCoupleDocument(coupleId, userId1, userId2, relationshipStartDate = null) {
    try {
      const coupleDoc = {
        partner1: {
          userId: userId1,
          lastActivity: new Date().toISOString(),
          currentVibe: null,
          vibeUpdatedAt: null
        },
        partner2: {
          userId: userId2,
          lastActivity: new Date().toISOString(),
          currentVibe: null,
          vibeUpdatedAt: null
        },
        relationshipStartDate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await AsyncStorage.setItem(`couple_${coupleId}`, JSON.stringify(coupleDoc));
    } catch (error) {
      console.error('Error creating couple document:', error);
      throw error;
    }
  }

  /**
   * Subscribe to shared journal entries (placeholder)
   * @deprecated Use SyncEngine.subscribeRealtime() for cross-device sync
   */
  subscribeToSharedJournals(userId, partnerId, callback) {
    warnDeprecated('subscribeToSharedJournals');
    console.log('Shared journals subscription - using local storage');
    
    const key = `journals_${userId}_${partnerId}`;
    
    // Poll for updates every 10 seconds
    const interval = setInterval(async () => {
      try {
        const journals = await this.getSharedJournals(userId, partnerId);
        callback(journals);
      } catch (error) {
        callback({ error: error.message });
      }
    }, 10000);
    
    // Clear any existing interval for this key to prevent leaks
    if (this.pollingIntervals.has(key)) {
      clearInterval(this.pollingIntervals.get(key));
    }
    this.pollingIntervals.set(key, interval);
    
    return () => {
      this.unsubscribe(key);
    };
  }

  /**
   * Get shared journals from local storage
   */
  async getSharedJournals(userId, partnerId) {
    try {
      const userJournals = await LocalStorageService.getUserMemories(userId);
      const partnerJournals = await LocalStorageService.getUserMemories(partnerId);
      
      // Combine and sort by date
      const allJournals = [...userJournals, ...partnerJournals]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      return allJournals;
    } catch (error) {
      console.error('Error getting shared journals:', error);
      return [];
    }
  }

  /**
   * Unsubscribe from all listeners
   */
  unsubscribeAll() {
    // Clear all intervals
    this.pollingIntervals.forEach(interval => {
      clearInterval(interval);
    });
    
    // Clear all maps
    this.listeners.clear();
    this.pollingIntervals.clear();
  }

  /**
   * Unsubscribe from specific listener
   */
  unsubscribe(key) {
    if (this.pollingIntervals.has(key)) {
      clearInterval(this.pollingIntervals.get(key));
      this.pollingIntervals.delete(key);
    }
    
    if (this.listeners.has(key)) {
      this.listeners.delete(key);
    }
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions() {
    return Array.from(this.listeners.keys());
  }

  /**
   * Simulate real-time updates by triggering callbacks
   */
  triggerUpdate(key, data) {
    if (this.listeners.has(key)) {
      const callback = this.listeners.get(key);
      callback(data);
    }
  }

  /**
   * Get couple data
   */
  async getCoupleData(coupleId) {
    try {
      const coupleData = await AsyncStorage.getItem(`couple_${coupleId}`);
      return coupleData ? JSON.parse(coupleData) : null;
    } catch (error) {
      console.error('Error getting couple data:', error);
      return null;
    }
  }

  /**
   * Update couple data
   */
  async updateCoupleData(coupleId, updates) {
    try {
      const existingData = await this.getCoupleData(coupleId);
      if (!existingData) {
        throw new Error('Couple not found');
      }
      
      const updatedData = {
        ...existingData,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      await AsyncStorage.setItem(`couple_${coupleId}`, JSON.stringify(updatedData));
      return updatedData;
    } catch (error) {
      console.error('Error updating couple data:', error);
      throw error;
    }
  }
}

export default new RealtimeSyncService();