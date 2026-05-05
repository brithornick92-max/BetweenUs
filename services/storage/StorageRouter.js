import CloudEngine from './CloudEngine';
import { SupabaseAuthService } from '../supabase/SupabaseAuthService';
import CoupleService from '../supabase/CoupleService';
import WeeklyContentScheduler from '../WeeklyContentScheduler';
import { cloudSyncStorage, makeId, storage, STORAGE_KEYS } from '../../utils/storage';

function isCloudUnavailableError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('not configured')
    || message.includes('network')
    || message.includes('fetch')
    || message.includes('offline')
    || message.includes('timeout')
    || message.includes('timed out')
    || message.includes('failed to fetch')
    || message.includes('network request failed')
  );
}

function isMissingRowError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === 'PGRST116'
    || message.includes('0 rows')
    || message.includes('no rows')
    || message.includes('multiple (or no) rows returned')
    || message.includes('json object requested')
  );
}

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

  if (localProfile?.quiz && typeof localProfile.quiz === 'object') {
    preferences.quiz = localProfile.quiz;
  }

  const updates = { preferences };

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

async function cacheSupabaseAccountEmail(email, session) {
  const syncStatus = await cloudSyncStorage.getSyncStatus();
  await cloudSyncStorage.setSyncStatus({
    ...syncStatus,
    email: session?.user?.email || email,
  });
}

function buildCanonicalLocalProfile(localProfile = {}, remoteProfile = null) {
  const safeLocal = localProfile && typeof localProfile === 'object' ? localProfile : {};
  if (!remoteProfile || typeof remoteProfile !== 'object') {
    return safeLocal;
  }

  const remotePrefs = remoteProfile.preferences && typeof remoteProfile.preferences === 'object'
    ? remoteProfile.preferences
    : {};
  const localPrefs = safeLocal.preferences && typeof safeLocal.preferences === 'object'
    ? safeLocal.preferences
    : {};

  return {
    ...safeLocal,
    ...(remoteProfile.email ? { email: remoteProfile.email } : {}),
    ...(remoteProfile.display_name
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
    ...(remotePrefs.quiz && typeof remotePrefs.quiz === 'object'
      ? { quiz: remotePrefs.quiz }
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

class StorageRouter {
  constructor() {
    this.isPremium = false;
    this.syncEnabled = false;
    this.sessionPresent = false;
    this.currentUser = undefined; // undefined = not yet checked, null = checked but no user
    this.listeners = new Map();
    this.supabaseAuthSubscription = null;
  }

  _notifyAuthListeners(user) {
    this.listeners.forEach((callback) => {
      try {
        callback(user || null);
      } catch (error) {
        if (__DEV__) console.warn('[StorageRouter] Auth listener failed:', error?.message);
      }
    });
  }

  _userFromSession(session) {
    const authUser = session?.user;
    if (!authUser?.id) return null;
    const email = authUser.email || '';
    return {
      uid: authUser.id,
      id: authUser.id,
      email,
      displayName:
        authUser.user_metadata?.display_name ||
        authUser.user_metadata?.full_name ||
        email.split('@')[0] ||
        'Between Us',
      emailVerified: !!(authUser.email_confirmed_at || authUser.confirmed_at),
    };
  }

  async _syncCloudSessionState() {
    await CloudEngine.initialize({ supabaseSessionPresent: this.sessionPresent });
  }

  async initialize({ user, isPremium = false, syncEnabled = false, supabaseSessionPresent = false } = {}) {
    this.isPremium = !!isPremium;
    this.syncEnabled = !!syncEnabled;
    this.sessionPresent = !!supabaseSessionPresent;
    await this._syncCloudSessionState();
  }

  async configureSync({ isPremium, syncEnabled, supabaseSessionPresent } = {}) {
    if (typeof isPremium === 'boolean') this.isPremium = isPremium;
    if (typeof syncEnabled === 'boolean') this.syncEnabled = syncEnabled;
    if (typeof supabaseSessionPresent === 'boolean') this.sessionPresent = supabaseSessionPresent;
    await this._syncCloudSessionState();
  }

  _useCloud() {
    return this.syncEnabled && this.sessionPresent;
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
    if (session) {
      this.currentUser = this._userFromSession(session);
      this._notifyAuthListeners(this.currentUser);
    }
    await this._syncCloudSessionState();
  }

  onAuthStateChanged(callback) {
    const listenerId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    this.listeners.set(listenerId, callback);

    // If we already have a current user from Supabase subscription, use it immediately
    // Otherwise, check session once (not on every listener registration)
    if (this.currentUser !== undefined) {
      // We already know the auth state, notify immediately
      Promise.resolve().then(() => callback(this.currentUser));
    } else {
      // First listener - check session once
      Promise.resolve()
        .then(async () => {
          let session = null;

          try {
            session = await SupabaseAuthService.getSession();
          } catch (error) {
            if (__DEV__) {
              console.warn('[StorageRouter] Initial auth session check failed; preserving unknown auth state:', error?.message);
            }

            // Timeout/network failure means auth is unknown, not signed out.
            // Do not notify callback(null), because that can restart auth bootstrap
            // and make the UI behave like the user was signed out.
            this.sessionPresent = false;
            return;
          }

          // Ignore stale bootstrap results if a newer auth event already resolved state.
          if (this.currentUser !== undefined) {
            return;
          }

          this.sessionPresent = !!session;
          this.currentUser = this._userFromSession(session);
          callback(this.currentUser);
          await this._syncCloudSessionState();
        })
        .catch((error) => {
          if (__DEV__) {
            console.warn('[StorageRouter] Initial auth listener callback failed:', error?.message);
          }
        });
    }

    if (!this.supabaseAuthSubscription) {
      try {
        const result = SupabaseAuthService.onAuthStateChange((session) => {
          this.sessionPresent = !!session;
          if (!session) {
            this._syncCloudSessionState().catch(() => {});
            return;
          }

          this.currentUser = this._userFromSession(session);
          this._syncCloudSessionState().catch(() => {});
          this._notifyAuthListeners(this.currentUser);
        });
        this.supabaseAuthSubscription = result?.data?.subscription || result?.subscription || result || null;
      } catch (error) {
        if (__DEV__) console.warn('[StorageRouter] Supabase auth listener unavailable:', error?.message);
      }
    }

    return () => {
      this.listeners.delete(listenerId);
    };
  }

  async createAccount(email, password, displayName) {
    let session = await SupabaseAuthService.signUp(email, password);
    if (!session) {
      session = await SupabaseAuthService.signInWithPassword(email, password);
    }
    if (!session?.user?.id) {
      throw new Error('Cloud account creation did not return a Supabase session');
    }

    await this.setSupabaseSession(session);
    await cacheSupabaseAccountEmail(email, session);
    return this.hydrateRemoteAccount({
      uid: session.user.id,
      email: session.user.email || email,
      displayName,
      emailVerified: !!(session.user?.email_confirmed_at || session.user?.confirmed_at),
    });
  }

  hydrateRemoteAccount(params) {
    const uid = params?.uid;
    if (!uid) throw new Error('Remote user id is required');
    const email = params?.email || '';
    const user = {
      uid,
      id: uid,
      email,
      displayName: params?.displayName || email.split('@')[0] || 'Between Us',
      emailVerified: params?.emailVerified ?? true,
    };
    this.currentUser = user;
    this.sessionPresent = true;
    this._notifyAuthListeners(user);
    return { user };
  }

  async signInWithEmailAndPassword(email, password) {
    const session = await SupabaseAuthService.signInWithPassword(email, password);
    if (!session?.user?.id) throw new Error('Supabase session required');

    await this.setSupabaseSession(session);
    await cacheSupabaseAccountEmail(email, session);
    return this.hydrateRemoteAccount({
      uid: session.user.id,
      email: session.user.email || email,
      displayName:
        session.user?.user_metadata?.display_name ||
        session.user?.user_metadata?.full_name ||
        (session.user.email || email).split('@')[0],
      emailVerified: !!(session.user?.email_confirmed_at || session.user?.confirmed_at),
    });
  }

  async updatePasswordForEmail() {
    return true;
  }

  async signOut(scope = 'global') {
    await SupabaseAuthService.signOut(scope).catch((error) => {
      if (__DEV__) console.warn('[StorageRouter] Supabase sign-out failed:', error?.message);
    });
    this.currentUser = null;
    this.sessionPresent = false;
    this._notifyAuthListeners(null);
    await this._syncCloudSessionState();
    return true;
  }

  async _getRemoteProfileOrCreate(cloudUserId, localProfile = {}) {
    if (!this.sessionPresent || !cloudUserId) {
      return null;
    }

    try {
      return await CloudEngine.getProfile(cloudUserId);
    } catch (error) {
      if (!isMissingRowError(error)) throw error;
      return CloudEngine.upsertProfile(cloudUserId, buildCloudProfileUpdates(localProfile));
    }
  }

  async _readRemoteCoupleId() {
    const membership = await CoupleService.getMyCouple();
    return membership?.couple_id || null;
  }

  async getUserDocument(userId) {
    const cachedProfile = await storage.get(STORAGE_KEYS.USER_PROFILE, {});
    if (!this.sessionPresent) {
      return cachedProfile;
    }

    if (!this.sessionPresent) {
      return cachedProfile;
    }

    try {
      const cloudUserId = await CloudEngine.getCurrentUserId();
      const [remoteProfile, remoteCoupleIdResult] = await Promise.all([
        this._getRemoteProfileOrCreate(cloudUserId, cachedProfile),
        this._readRemoteCoupleId()
          .then((coupleId) => ({ ok: true, coupleId }))
          .catch((error) => ({ ok: false, error })),
      ]);

      const canonicalLocal = buildCanonicalLocalProfile(cachedProfile, remoteProfile);
      if (remoteCoupleIdResult.ok) {
        canonicalLocal.coupleId = remoteCoupleIdResult.coupleId || null;
        if (remoteCoupleIdResult.coupleId) {
          await storage.set(STORAGE_KEYS.COUPLE_ID, remoteCoupleIdResult.coupleId);
        } else {
          await storage.remove(STORAGE_KEYS.COUPLE_ID);
        }
      }

      await storage.set(STORAGE_KEYS.USER_PROFILE, canonicalLocal);
      return canonicalLocal;
    } catch (err) {
      if (!isCloudUnavailableError(err)) {
        if (__DEV__) console.warn('[StorageRouter] Cloud profile read failed:', err?.message);
      }
      return cachedProfile;
    }
  }

  async updateUserDocument(userId, updates) {
    if (this.sessionPresent) {
      try {
        const cloudUserId = await CloudEngine.getCurrentUserId();
        const existingLocal = await storage.get(STORAGE_KEYS.USER_PROFILE, {});
        const remoteProfile = await this._getRemoteProfileOrCreate(cloudUserId, existingLocal);
        const remoteBackedLocal = buildCanonicalLocalProfile(existingLocal, remoteProfile);
        const localCandidate = {
          ...(remoteBackedLocal && typeof remoteBackedLocal === 'object' ? remoteBackedLocal : {}),
          ...(updates && typeof updates === 'object' ? updates : {}),
          updatedAt: new Date().toISOString(),
        };
        const savedRemoteProfile = await CloudEngine.upsertProfile(cloudUserId, buildCloudProfileUpdates(localCandidate));
        const canonicalLocal = buildCanonicalLocalProfile(localCandidate, savedRemoteProfile);
        await storage.set(STORAGE_KEYS.USER_PROFILE, canonicalLocal);
        return canonicalLocal;
      } catch (err) {
        if (__DEV__) console.warn('[StorageRouter] Cloud profile upsert failed:', err?.message);
        throw err;
      }
    }
    const cached = await storage.get(STORAGE_KEYS.USER_PROFILE, {});
    const updated = { ...cached, ...(updates || {}), updatedAt: new Date().toISOString() };
    await storage.set(STORAGE_KEYS.USER_PROFILE, updated);
    return updated;
  }

  async getCoupleData(coupleId, key) {
    if (!this._canUseAuthenticatedCloud() || !coupleId || !key) return null;
    try {
      return await CloudEngine.getCoupleData(coupleId, key);
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

      if (__DEV__) console.warn('[StorageRouter] Couple data upsert failed:', err?.message);
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
      if (__DEV__) console.warn('[StorageRouter] Cloud preference sync failed:', err?.message);
      return false;
    }
  }

  async deleteUserDocument(userId) {
    await storage.remove(STORAGE_KEYS.USER_PROFILE);
    await storage.remove(STORAGE_KEYS.USER_ID);
    return true;
  }

  getPrompts(filters = {}) {
    const promptsData = require('../../content/prompts.json');
    let prompts = Array.isArray(promptsData?.items) ? promptsData.items : [];
    prompts = WeeklyContentScheduler.filterAvailable(prompts);
    if (filters.category) prompts = prompts.filter((p) => p.category === filters.category);
    if (Array.isArray(filters.categories) && filters.categories.length > 0) {
      prompts = prompts.filter((p) => filters.categories.includes(p.category));
    }
    if (filters.heat) prompts = prompts.filter((p) => p.heat === filters.heat);
    if (typeof filters.heatLevel === 'number') prompts = prompts.filter((p) => p.heat === filters.heatLevel);
    if (typeof filters.minHeatLevel === 'number') prompts = prompts.filter((p) => p.heat >= filters.minHeatLevel);
    if (typeof filters.maxHeatLevel === 'number') prompts = prompts.filter((p) => p.heat <= filters.maxHeatLevel);
    if (Array.isArray(filters.heatLevels) && filters.heatLevels.length > 0) {
      prompts = prompts.filter((p) => filters.heatLevels.includes(p.heat));
    }
    if (filters.limit) prompts = prompts.slice(0, filters.limit);
    return prompts;
  }

  getDates(filters = {}) {
    const datesData = require('../../content/dates.json');
    let dates = Array.isArray(datesData?.items) ? datesData.items : [];
    dates = WeeklyContentScheduler.filterAvailable(dates);
    if (filters.category) dates = dates.filter((d) => d.category === filters.category);
    if (filters.heat) dates = dates.filter((d) => d.heat === filters.heat);
    if (typeof filters.heatLevel === 'number') dates = dates.filter((d) => d.heat === filters.heatLevel);
    if (Array.isArray(filters.categories) && filters.categories.length > 0) {
      dates = dates.filter((d) => filters.categories.includes(d.category));
    }
    if (filters.limit) dates = dates.slice(0, filters.limit);
    return dates;
  }

  async saveMemory(userId, memoryData, coupleId = null) {
    const id = memoryData?.id || makeId('memory');
    const local = {
      id,
      userId,
      ...(memoryData || {}),
      createdAt: memoryData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (this._canUseAuthenticatedCloud() && coupleId) {
      try {
        await CloudEngine.saveCoupleData(
          coupleId,
          `memory_${id}`,
          memoryData,
          userId,
          memoryData.isPrivate,
          'memory'
        );
      } catch (err) {
        if (__DEV__) console.warn('[StorageRouter] Cloud memory save failed:', err?.message);
      }
    }
    return local;
  }

  getUserMemories(userId) {
    return [];
  }

  async updateMemory(memoryId, updates, coupleId = null) {
    const local = { id: memoryId, ...(updates || {}), updatedAt: new Date().toISOString() };
    if (this._canUseAuthenticatedCloud() && coupleId) {
      try {
        await CloudEngine.updateCoupleData(coupleId, `memory_${memoryId}`, updates);
      } catch (err) {
        if (__DEV__) console.warn('[StorageRouter] Cloud memory update failed:', err?.message);
      }
    }
    return local;
  }

  async deleteMemory(memoryId, coupleId = null) {
    if (this._canUseAuthenticatedCloud() && coupleId) {
      try {
        await CloudEngine.deleteCoupleData(coupleId, `memory_${memoryId}`);
      } catch (err) {
        if (__DEV__) console.warn('[StorageRouter] Cloud memory delete failed:', err?.message);
      }
    }
    return true;
  }

  async linkPartner(userId, partnerCode) {
    return this.updateUserDocument(userId, { partnerId: partnerCode, partnerLinkedAt: new Date().toISOString() });
  }

  async unlinkPartner(userId) {
    return this.updateUserDocument(userId, { partnerId: null, partnerLinkedAt: null, partnerUnlinkedAt: new Date().toISOString() });
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
}

export default new StorageRouter();
