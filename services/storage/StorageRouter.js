import LocalEngine from './LocalEngine';
import CloudEngine from './CloudEngine';
import { cloudSyncStorage, storage, STORAGE_KEYS } from '../../utils/storage';
import { SENSITIVE_TYPES } from '../security/Sensitivity';

function buildCloudProfileUpdates(localProfile = {}) {
  const preferences = {
    ...(localProfile?.preferences && typeof localProfile.preferences === 'object' ? localProfile.preferences : {}),
  };

  if (localProfile?.partnerNames && typeof localProfile.partnerNames === 'object') {
    preferences.partnerNames = {
      ...(preferences.partnerNames && typeof preferences.partnerNames === 'object' ? preferences.partnerNames : {}),
      ...localProfile.partnerNames,
    };
  }

  if (localProfile?.relationshipStartDate) {
    preferences.relationshipStartDate = localProfile.relationshipStartDate;
  }

  if (typeof localProfile?.heatLevelPreference !== 'undefined') {
    preferences.heatLevelPreference = localProfile.heatLevelPreference;
  }

  if (typeof localProfile?.onboardingCompleted === 'boolean') {
    preferences.onboardingCompleted = localProfile.onboardingCompleted;
  }

  if (typeof localProfile?.tone === 'string' && localProfile.tone.trim()) {
    preferences.tone = localProfile.tone.trim();
  }

  if (localProfile?.nicknameConfig && typeof localProfile.nicknameConfig === 'object') {
    preferences.nicknameConfig = {
      ...(preferences.nicknameConfig && typeof preferences.nicknameConfig === 'object' ? preferences.nicknameConfig : {}),
      ...localProfile.nicknameConfig,
    };
  }

  if (localProfile?.relationshipSeason && typeof localProfile.relationshipSeason === 'object') {
    preferences.relationshipSeason = localProfile.relationshipSeason;
  }

  if (localProfile?.relationshipClimate && typeof localProfile.relationshipClimate === 'object') {
    preferences.relationshipClimate = localProfile.relationshipClimate;
  }

  if (typeof localProfile?.energyLevel === 'string' && localProfile.energyLevel.trim()) {
    preferences.energyLevel = localProfile.energyLevel.trim();
  }

  if (localProfile?.softBoundaries && typeof localProfile.softBoundaries === 'object') {
    preferences.softBoundaries = localProfile.softBoundaries;
  }

  const updates = {
    preferences,
  };

  const displayName =
    localProfile?.partnerNames?.myName ||
    localProfile?.display_name ||
    localProfile?.displayName ||
    null;

  if (displayName) {
    updates.display_name = displayName;
  }

  if (localProfile?.email) {
    updates.email = localProfile.email;
  }

  return updates;
}

class StorageRouter {
  constructor() {
    this.isPremium = false;
    this.syncEnabled = false;
    this.sessionPresent = false;
  }

  async _syncCloudSessionState() {
    await CloudEngine.initialize({ supabaseSessionPresent: this.sessionPresent });
  }

  async initialize({ user, isPremium = false, syncEnabled = false, supabaseSessionPresent = false } = {}) {
    this.isPremium = !!isPremium;
    this.syncEnabled = !!syncEnabled;
    this.sessionPresent = !!supabaseSessionPresent;
    await LocalEngine.initialize?.();
    await this._syncCloudSessionState();
    if (this._useCloud()) {
      await this.flushRitualSyncQueue();
    }
  }

  async configureSync({ isPremium, syncEnabled, supabaseSessionPresent } = {}) {
    if (typeof isPremium === 'boolean') this.isPremium = isPremium;
    if (typeof syncEnabled === 'boolean') this.syncEnabled = syncEnabled;
    if (typeof supabaseSessionPresent === 'boolean') this.sessionPresent = supabaseSessionPresent;
    await this._syncCloudSessionState();
    if (this._useCloud()) {
      await this.flushRitualSyncQueue();
    }
  }

  _useCloud() {
    return this.isPremium && this.syncEnabled && this.sessionPresent;
  }

  _canUseAuthenticatedCloud() {
    return this.sessionPresent;
  }

  async setCoupleId(coupleId) {
    await storage.set(STORAGE_KEYS.COUPLE_ID, coupleId);
    return coupleId;
  }

  async getCoupleId() {
    return storage.get(STORAGE_KEYS.COUPLE_ID, null);
  }

  async setActiveCoupleId(coupleId) {
    return this.setCoupleId(coupleId);
  }

  async getActiveCoupleId() {
    return this.getCoupleId();
  }

  async setSupabaseSession(session) {
    this.sessionPresent = !!session;
    await this._syncCloudSessionState();
    if (this._useCloud()) {
      await this.flushRitualSyncQueue();
    }
  }

  onAuthStateChanged(callback) {
    return LocalEngine.onAuthStateChanged(callback);
  }

  createAccount(email, password, displayName) {
    return LocalEngine.createAccount(email, password, displayName);
  }

  hydrateRemoteAccount(params) {
    return LocalEngine.hydrateRemoteAccount(params);
  }

  signInWithEmailAndPassword(email, password) {
    return LocalEngine.signInWithEmailAndPassword(email, password);
  }

  updatePasswordForEmail(email, password) {
    return LocalEngine.updatePasswordForEmail(email, password);
  }

  signOut(scope = 'global') {
    return LocalEngine.signOut(scope);
  }

  async getUserDocument(userId) {
    return LocalEngine.getUserDocument(userId);
  }

  async updateUserDocument(userId, updates) {
    const local = await LocalEngine.updateUserDocument(userId, updates);
    if (this.sessionPresent) {
      try {
        const cloudUserId = await CloudEngine.getCurrentUserId();
        await CloudEngine.upsertProfile(cloudUserId, buildCloudProfileUpdates(local));
      } catch (err) {
        console.warn('[StorageRouter] Cloud profile upsert failed:', err?.message);
      }
    }
    return local;
  }

  async getCoupleData(coupleId, key, coupleKey = null) {
    if (!this._canUseAuthenticatedCloud() || !coupleId || !key) return null;
    try {
      return await CloudEngine.getCoupleData(coupleId, key, coupleKey);
    } catch (err) {
      const message = String(err?.message || '');
      const isMissingRow =
        message.includes('JSON object requested') ||
        message.includes('multiple (or no) rows returned') ||
        message.includes('No rows found');

      if (isMissingRow) return null;
      throw err;
    }
  }

  async upsertCoupleData(coupleId, key, value, createdBy, isPrivate = false, dataType = 'unknown') {
    if (!this._canUseAuthenticatedCloud() || !coupleId || !key || !createdBy) return false;

    try {
      const cloudUserId = await CloudEngine.getCurrentUserId();
      const existing = await this.getCoupleData(coupleId, key);
      if (existing) {
        await CloudEngine.updateCoupleData(coupleId, key, value);
        return true;
      }

      await CloudEngine.saveCoupleData(coupleId, key, value, cloudUserId, isPrivate, dataType);
      return true;
    } catch (err) {
      const message = String(err?.message || '');
      const isDuplicate =
        message.includes('duplicate key') ||
        message.includes('couple_data_couple_id_key_unique');

      if (isDuplicate) {
        await CloudEngine.updateCoupleData(coupleId, key, value);
        return true;
      }

      console.warn('[StorageRouter] Couple data upsert failed:', err?.message);
      return false;
    }
  }

  async updateCloudProfilePreferences(preferenceUpdates) {
    if (!this.sessionPresent || !preferenceUpdates || typeof preferenceUpdates !== 'object') {
      return false;
    }

    try {
      const userId = await CloudEngine.getCurrentUserId();
      let existingPreferences = {};

      try {
        const remoteProfile = await CloudEngine.getProfile(userId);
        existingPreferences = remoteProfile?.preferences && typeof remoteProfile.preferences === 'object'
          ? remoteProfile.preferences
          : {};
      } catch (_) {}

      await CloudEngine.upsertProfile(userId, {
        preferences: {
          ...existingPreferences,
          ...preferenceUpdates,
        },
      });

      return true;
    } catch (err) {
      console.warn('[StorageRouter] Cloud preference sync failed:', err?.message);
      return false;
    }
  }

  async deleteUserDocument(userId) {
    await LocalEngine.deleteUserDocument(userId);
    return true;
  }

  getPrompts(filters = {}) {
    return LocalEngine.getPrompts(filters);
  }

  getDates(filters = {}) {
    return LocalEngine.getDates(filters);
  }

  async saveMemory(userId, memoryData, coupleId = null) {
    const local = await LocalEngine.saveMemory(userId, memoryData);
    if (this._useCloud() && coupleId) {
      try {
        const dataType = 'memory';
        if (SENSITIVE_TYPES.includes(dataType)) {
          await CloudEngine.saveCoupleDataEncrypted(
            coupleId,
            `memory_${local.id}`,
            memoryData,
            userId,
            memoryData.isPrivate,
            dataType
          );
        } else {
          await CloudEngine.saveCoupleData(
            coupleId,
            `memory_${local.id}`,
            memoryData,
            userId,
            memoryData.isPrivate,
            dataType
          );
        }
      } catch (err) {
        console.warn('[StorageRouter] Cloud memory save failed:', err?.message);
      }
    }
    return local;
  }

  getUserMemories(userId) {
    return LocalEngine.getUserMemories(userId);
  }

  async updateMemory(memoryId, updates, coupleId = null) {
    const local = await LocalEngine.updateMemory(memoryId, updates);
    if (this._useCloud() && coupleId) {
      try {
        const dataType = 'memory';
        if (SENSITIVE_TYPES.includes(dataType)) {
          await CloudEngine.updateCoupleDataEncrypted(coupleId, `memory_${memoryId}`, updates);
        } else {
          await CloudEngine.updateCoupleData(coupleId, `memory_${memoryId}`, updates);
        }
      } catch (err) {
        console.warn('[StorageRouter] Cloud memory update failed:', err?.message);
      }
    }
    return local;
  }

  async deleteMemory(memoryId, coupleId = null) {
    await LocalEngine.deleteMemory(memoryId);
    if (this._useCloud() && coupleId) {
      try {
        await CloudEngine.deleteCoupleData(coupleId, `memory_${memoryId}`);
      } catch (err) {
        console.warn('[StorageRouter] Cloud memory delete failed:', err?.message);
      }
    }
    return true;
  }

  linkPartner(userId, partnerCode) {
    return LocalEngine.linkPartner(userId, partnerCode);
  }

  unlinkPartner(userId) {
    return LocalEngine.unlinkPartner(userId);
  }

  async queueSyncOp(op) {
    await cloudSyncStorage.addToSyncQueue(op);
    if (this._useCloud()) {
      await this.flushSyncQueue();
    }
    return true;
  }

  async flushSyncQueue() {
    if (!this._useCloud()) return false;
    const queue = await cloudSyncStorage.getSyncQueue();
    const updatedQueue = [];
    const maxRetries = 3;
    let hadSuccess = false;

    for (const item of queue) {
      if (item?.attempts >= maxRetries) {
        updatedQueue.push(item);
        continue;
      }

      try {
        if (item?.action && typeof CloudEngine[item.action] === 'function') {
          await CloudEngine[item.action](...(item.args || []));
          await cloudSyncStorage.removeFromSyncQueue(item.id);
          hadSuccess = true;
        } else {
          updatedQueue.push({
            ...item,
            attempts: (item.attempts || 0) + 1,
            lastError: 'Unknown sync action',
            lastAttemptAt: Date.now(),
          });
        }
      } catch (error) {
        updatedQueue.push({
          ...item,
          attempts: (item.attempts || 0) + 1,
          lastError: error?.message || 'Sync failed',
          lastAttemptAt: Date.now(),
        });
      }
    }

    await cloudSyncStorage.setSyncQueue(updatedQueue);
    if (hadSuccess) {
      await cloudSyncStorage.setLastSyncTime(Date.now());
    }
    return true;
  }

  async queueRitualSync(payload) {
    const queue = await storage.get(STORAGE_KEYS.RITUAL_SYNC_QUEUE, []);
    const item = {
      ...payload,
      id: payload?.id || `ritual_sync_${Date.now()}`,
      queuedAt: payload?.queuedAt || Date.now(),
      attempts: payload?.attempts || 0,
    };
    await storage.set(STORAGE_KEYS.RITUAL_SYNC_QUEUE, [item, ...queue]);
    if (this._useCloud()) {
      await this.flushRitualSyncQueue();
    }
    return item;
  }

  async flushRitualSyncQueue() {
    if (!this._useCloud()) return false;
    const queue = await storage.get(STORAGE_KEYS.RITUAL_SYNC_QUEUE, []);
    if (!queue.length) return true;

    const coupleId = await this.getCoupleId();
    if (!coupleId) return false;

    const userId = await CloudEngine.getCurrentUserId();

    const updatedQueue = [];
    const maxRetries = 3;
    let hadSuccess = false;

    for (const item of queue) {
      if (item?.attempts >= maxRetries) {
        updatedQueue.push(item);
        continue;
      }

      try {
        await CloudEngine.saveCoupleDataEncrypted(
          coupleId,
          `ritual_${item.id}`,
          item,
          userId,
          true,
          'ritual'
        );
        hadSuccess = true;
      } catch (error) {
        updatedQueue.push({
          ...item,
          attempts: (item.attempts || 0) + 1,
          lastError: error?.message || 'Ritual sync failed',
          lastAttemptAt: Date.now(),
        });
      }
    }

    await storage.set(STORAGE_KEYS.RITUAL_SYNC_QUEUE, updatedQueue);
    if (hadSuccess) {
      await cloudSyncStorage.setLastSyncTime(Date.now());
    }
    return true;
  }
}

export default new StorageRouter();
