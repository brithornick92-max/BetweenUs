// utils/privacyEngine.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import analytics from './analytics';

class PrivacyEngine {
  constructor() {
    this.PRIVACY_LEVELS = {
      HIGH: 'high',
      MEDIUM: 'medium',
      LOW: 'low',
    };

    this.isInitialized = false;
    this.encryptionKey = null;
    this.privacyLevel = this.PRIVACY_LEVELS.HIGH;
    this.retentionPolicies = null;
    this._keyCache = new Map();
  }

  async initialize(userId) {
    if (this.isInitialized && this.encryptionKey) return true;

    try {
      this.encryptionKey = await this.getOrCreateEncryptionKey(userId);
      const settings = await this.loadPrivacySettings(userId);
      this.privacyLevel = settings.level;
      this.retentionPolicies = await this.loadRetentionPolicies(userId);
      this.isInitialized = true;
      return true;
    } catch (error) {
      this.isInitialized = false;
      throw error;
    }
  }

  async getOrCreateEncryptionKey(userId) {
    if (this._keyCache.has(userId)) {
      return this._keyCache.get(userId);
    }
    const storageKey = `privacy_key_${userId}`;
    let key = await SecureStore.getItemAsync(storageKey, { keychainService: 'betweenus' });
    if (!key) {
      // Generate a cryptographically random 32-byte key (hex-encoded)
      key = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${userId}_${Date.now()}_${Math.random()}`
      );
      await SecureStore.setItemAsync(storageKey, key, { keychainService: 'betweenus' });
    }
    this._keyCache.set(userId, key);
    return key;
  }

  encryptPersonalizationData(data) {
    if (!this.encryptionKey) throw new Error('Encryption key not available');
    try {
      // Derive a 32-byte key from the hex-encoded encryption key
      const keyBytes = naclUtil.decodeUTF8(this.encryptionKey.slice(0, 32).padEnd(32, '0'));
      const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
      const messageBytes = naclUtil.decodeUTF8(JSON.stringify(data));
      const box = nacl.secretbox(messageBytes, nonce, keyBytes);
      const encrypted = naclUtil.encodeBase64(nonce) + ':' + naclUtil.encodeBase64(box);
      return {
        encrypted,
        hash: this.generateDataHash(data),
        timestamp: Date.now(),
        privacyLevel: this.privacyLevel,
      };
    } catch (error) {
      throw new Error(error.message);
    }
  }

  decryptPersonalizationData(encryptedData) {
    if (!this.encryptionKey) throw new Error('Encryption key not available');
    const keyBytes = naclUtil.decodeUTF8(this.encryptionKey.slice(0, 32).padEnd(32, '0'));
    const parts = encryptedData.encrypted.split(':');
    if (parts.length !== 2) throw new Error('Decryption failed: invalid format');
    const nonce = naclUtil.decodeBase64(parts[0]);
    const box = naclUtil.decodeBase64(parts[1]);
    const plain = nacl.secretbox.open(box, nonce, keyBytes);
    if (!plain) throw new Error('Decryption failed');
    return JSON.parse(naclUtil.encodeUTF8(plain));
  }

  async processUserData(userId, rawData, dataType = 'behavior') {
    if (!this.isInitialized) {
      await this.initialize(userId);
    }

    const startTime = Date.now();
    const features = this.extractMinimalFeatures(rawData, dataType);
    const noisy = this.addDifferentialPrivacy(features);
    const encrypted = this.encryptPersonalizationData(noisy);
    const anonymizedMetrics = {
      dataType,
      featureCount: Object.keys(features).length,
      processingTime: Date.now() - startTime,
      privacyLevel: this.privacyLevel,
      features: this.extractAnonymizedUserFeatures(rawData?.profile || rawData),
    };

    await analytics.trackFeatureUsage?.('privacy', 'processed', {
      data_type: dataType,
      privacy_level: this.privacyLevel,
    });

    return {
      localInsights: {
        features: noisy,
        privacyPreserved: true,
      },
      encryptedData: encrypted,
      anonymizedMetrics,
      privacyLevel: this.privacyLevel,
      processingTimestamp: Date.now(),
    };
  }

  extractMinimalFeatures(rawData = {}, dataType = 'behavior') {
    const exclusions = new Set(
      [rawData.personalIdentifier, rawData.privateNotes, rawData.deviceInfo, rawData.locationData]
        .filter((v) => typeof v === 'string' && v.length > 0)
    );
    const duration = this.normalizeValue(rawData.sessionDuration || 0, 0, 7200);
    const interactions = this.normalizeValue(rawData.interactionCount || 0, 0, 100);
    const featureUsage = this.normalizeValue(rawData.featureUsageCount || 0, 0, 50);
    const safeCategories = Array.isArray(rawData.contentCategories)
      ? rawData.contentCategories
          .filter((c) => !exclusions.has(c))
          .map((c) => this._hashCategory(String(c)))
      : [];
    const contentCategoryDistribution = this.normalizeDistribution(safeCategories);
    const timeOfDayPattern = this._extractTimeOfDayPattern(rawData.timestamps || []);
    const engagementDepth = this.calculateEngagementDepth(
      rawData.interactions || [
        { duration: rawData.sessionDuration || 0, actions: rawData.interactionCount || 0 },
      ]
    );

    return {
      sessionDuration: duration,
      interactionCount: interactions,
      featureUsageCount: featureUsage,
      contentCategoryDistribution,
      timeOfDayPattern,
      engagementDepth,
      dataType,
    };
  }

  _hashCategory(label) {
    // Non-cryptographic hash for category bucketing (privacy obfuscation only)
    try {
      let hash = 5381;
      for (let i = 0; i < label.length; i++) {
        hash = ((hash << 5) + hash + label.charCodeAt(i)) >>> 0;
      }
      return hash.toString(36).slice(0, 12);
    } catch {
      return 'unknown';
    }
  }

  addDifferentialPrivacy(features) {
    if (this.privacyLevel === this.PRIVACY_LEVELS.LOW) return { ...features };

    const scale = this.privacyLevel === this.PRIVACY_LEVELS.HIGH ? 0.5 : 0.08;
    const noisy = {};

    Object.entries(features).forEach(([key, value]) => {
      if (typeof value === 'number') {
        let noise = this.generateLaplaceNoise(0, scale);
        if (this.privacyLevel === this.PRIVACY_LEVELS.HIGH) {
          noise += Math.sign(noise || 1) * 0.02;
        }
        noisy[key] = this._clamp(value + noise, 0, 1);
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        const obj = {};
        Object.entries(value).forEach(([k, v]) => {
          if (typeof v === 'number') {
            let noise = this.generateLaplaceNoise(0, scale);
            if (this.privacyLevel === this.PRIVACY_LEVELS.HIGH) {
              noise += Math.sign(noise || 1) * 0.02;
            }
            obj[k] = this._clamp(v + noise, 0, 1);
          } else {
            obj[k] = v;
          }
        });
        noisy[key] = obj;
      } else {
        noisy[key] = value;
      }
    });

    return noisy;
  }

  async loadPrivacySettings(userId) {
    const key = `privacy_settings_${userId}`;
    const stored = await AsyncStorage.getItem(key);
    const defaults = {
      level: this.PRIVACY_LEVELS.HIGH,
      dataMinimization: true,
      differentialPrivacy: true,
      localProcessingOnly: true,
      automaticCleanup: true,
      analyticsOptOut: false,
    };
    if (!stored) return defaults;
    try {
      return { ...defaults, ...JSON.parse(stored) };
    } catch {
      return defaults;
    }
  }

  async updatePrivacySettings(userId, newSettings = {}) {
    const current = await this.loadPrivacySettings(userId);
    const updated = { ...current, ...newSettings };
    await AsyncStorage.setItem(`privacy_settings_${userId}`, JSON.stringify(updated));
    this.privacyLevel = updated.level;
    return updated;
  }

  async loadRetentionPolicies(userId) {
    if (this.retentionPolicies) return this.retentionPolicies;
    const key = `retention_policies_${userId}`;
    const stored = await AsyncStorage.getItem(key);
    const defaults = {
      behaviorData: 30 * 24 * 60 * 60 * 1000,
      personalizedInsights: 30 * 24 * 60 * 60 * 1000,
      mlModelData: 90 * 24 * 60 * 60 * 1000,
      analyticsEvents: 30 * 24 * 60 * 60 * 1000,
      cacheData: 7 * 24 * 60 * 60 * 1000,
      temporaryData: 7 * 24 * 60 * 60 * 1000,
    };
    if (!stored) {
      this.retentionPolicies = defaults;
      return defaults;
    }
    try {
      const merged = { ...defaults, ...JSON.parse(stored) };
      this.retentionPolicies = merged;
      return merged;
    } catch {
      this.retentionPolicies = defaults;
      return defaults;
    }
  }

  async updateRetentionPolicy(userId, dataType, retentionPeriod) {
    const policies = await this.loadRetentionPolicies(userId);
    policies[dataType] = retentionPeriod;
    await AsyncStorage.setItem(`retention_policies_${userId}`, JSON.stringify(policies));
    this.retentionPolicies = policies;
    return true;
  }

  async performDataCleanup(userId) {
    const policies = this.retentionPolicies || (await this.loadRetentionPolicies(userId));
    const keys = await AsyncStorage.getAllKeys();
    let removed = 0;
    let bytesFreed = 0;
    const categories = new Set();

    for (const key of keys) {
      if (!key.includes(userId)) continue;
      const dataType = this.determineDataType(key);
      categories.add(dataType);
      const retention = policies[dataType] || policies.temporaryData;
      const raw = await AsyncStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      const ts = parsed?.timestamp || parsed?.createdAt || parsed?.updatedAt || 0;
      if (ts && Date.now() - ts > retention) {
        await AsyncStorage.removeItem(key);
        removed += 1;
        bytesFreed += raw ? raw.length : 0;
      }
    }

    return {
      itemsRemoved: removed,
      bytesFreed,
      categoriesProcessed: Array.from(categories),
    };
  }

  determineDataType(key = '') {
    const k = key.toLowerCase();
    if (k.includes('behavior')) return 'behaviorData';
    if (k.includes('insights')) return 'personalizedInsights';
    if (k.includes('ml_model')) return 'mlModelData';
    if (k.includes('analytics')) return 'analyticsEvents';
    if (k.includes('cache')) return 'cacheData';
    return 'temporaryData';
  }

  normalizeValue(value, min, max) {
    const range = max - min;
    if (range === 0) return 0;
    if (Math.abs(range) < 1e-12) {
      return 0.5;
    }
    const clamped = Math.min(Math.max(value, min), max);
    const normalized = (clamped - min) / range;
    if (Math.abs(normalized - 0.5) < 0.001) return 0.5;
    return normalized;
  }

  normalizeDistribution(array) {
    if (!Array.isArray(array) || array.length === 0) return {};
    const counts = Object.create(null);
    array.forEach((item) => {
      const key = String(item);
      counts[key] = (counts[key] || 0) + 1;
    });
    const total = array.length;
    const normalized = {};
    Object.keys(counts).forEach((k) => {
      normalized[k] = counts[k] / total;
    });
    return normalized;
  }

  calculateEngagementDepth(interactions = []) {
    if (!Array.isArray(interactions) || interactions.length === 0) return 0;
    const total = interactions.reduce(
      (acc, item) => acc + (item.duration || 0) + (item.actions || 0) * 10,
      0
    );
    return this.normalizeValue(total, 0, 10000);
  }

  calculateContentDiversity(content = []) {
    if (!Array.isArray(content) || content.length === 0) return 0;
    const categories = new Set(content.map((c) => c.category).filter(Boolean));
    const heatLevels = new Set(content.map((c) => c.heatLevel ?? c.heat).filter((v) => v !== undefined));
    const diversityScore = categories.size + heatLevels.size;
    return this.normalizeValue(diversityScore, 0, 10);
  }

  generateDataHash(data) {
    let str;
    try {
      str = JSON.stringify(data);
    } catch {
      str = String(data);
    }
    if (str === undefined) {
      str = String(data);
    }
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(16);
  }

  async validatePrivacyCompliance(userId) {
    const issues = [];
    if (!this.encryptionKey) issues.push('Encryption key not available');
    if (this.privacyLevel === this.PRIVACY_LEVELS.LOW) {
      issues.push('Privacy level set to LOW - reduced protection');
    }

    const policies = this.retentionPolicies || (await this.loadRetentionPolicies(userId));
    const retentionPoliciesActive = !!policies && Object.keys(policies).length > 0;

    return {
      encryptionEnabled: !!this.encryptionKey,
      privacyLevel: this.privacyLevel,
      dataMinimization: true,
      localProcessing: true,
      retentionPoliciesActive,
      differentialPrivacyEnabled: this.privacyLevel !== this.PRIVACY_LEVELS.LOW,
      issues,
    };
  }

  async emergencyDataWipe(userId) {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const userKeys = keys.filter((key) => key.includes(userId));
      for (const key of userKeys) {
        await AsyncStorage.removeItem(key);
      }
      this.encryptionKey = null;
      this.isInitialized = false;
      return true;
    } catch {
      return false;
    }
  }

  generateLaplaceNoise(location = 0, scale = 1) {
    const u = Math.random() - 0.5;
    return location - scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }

  extractAnonymizedUserFeatures(userProfile = {}) {
    const stage = userProfile?.relationshipData?.stage || 'unknown';
    const sessionCount = userProfile?.behaviorMetrics?.sessionCount || 0;
    const engagementTime = userProfile?.behaviorMetrics?.totalEngagementTime || 0;
    const categories = userProfile?.preferences?.contentCategories || [];

    const engagementLevel = engagementTime > 20000 ? 'high' : engagementTime > 5000 ? 'medium' : 'low';
    const contentPreferences =
      categories.length >= 6 ? 'diverse' : categories.length >= 3 ? 'moderate' : 'focused';
    const usagePattern = sessionCount > 100 ? 'deep' : sessionCount > 30 ? 'moderate' : 'quick';

    return {
      relationshipStage: stage,
      engagementLevel,
      contentPreferences,
      usagePattern,
    };
  }

  calculateAggregatedMetrics(features = {}) {
    const values = Object.values(features).filter((v) => typeof v === 'number');
    if (values.length === 0) return { average: 0, variance: 0 };
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
    return { average: avg, variance };
  }

  _extractTimeOfDayPattern(timestamps) {
    if (!Array.isArray(timestamps) || timestamps.length === 0) return {};
    const buckets = { night: 0, morning: 0, afternoon: 0, evening: 0 };
    timestamps.forEach((ts) => {
      const date = new Date(ts);
      const hour = date.getHours();
      if (hour < 6) buckets.night += 1;
      else if (hour < 12) buckets.morning += 1;
      else if (hour < 18) buckets.afternoon += 1;
      else buckets.evening += 1;
    });
    const total = timestamps.length;
    const normalized = {};
    Object.keys(buckets).forEach((k) => {
      normalized[k] = buckets[k] / total;
    });
    return normalized;
  }

  _clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
}

export default new PrivacyEngine();
