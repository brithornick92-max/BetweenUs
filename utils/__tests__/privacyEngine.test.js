// utils/__tests__/privacyEngine.test.js
import privacyEngine from '../privacyEngine';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('expo-secure-store');
jest.mock('expo-crypto');
jest.mock('tweetnacl', () => {
  const nacl = jest.requireActual('tweetnacl');
  return nacl;
});
jest.mock('tweetnacl-util', () => {
  const naclUtil = jest.requireActual('tweetnacl-util');
  return naclUtil;
});
jest.mock('../analytics');

describe('PrivacyEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue(true);
    AsyncStorage.getAllKeys.mockResolvedValue([]);
    
    // Mock SecureStore (replaces CryptoJS key storage)
    SecureStore.getItemAsync.mockResolvedValue(null);
    SecureStore.setItemAsync.mockResolvedValue(undefined);
    
    // Mock expo-crypto
    Crypto.digestStringAsync.mockResolvedValue('a'.repeat(64)); // 64-char hex hash
    
    // Reset engine state
    privacyEngine.isInitialized = false;
    privacyEngine.encryptionKey = null;
    privacyEngine._keyCache.clear();
  });

  describe('Initialization', () => {
    test('should initialize privacy engine successfully', async () => {
      const userId = 'test-user-123';
      
      const result = await privacyEngine.initialize(userId);

      expect(result).toBe(true);
      expect(privacyEngine.isInitialized).toBe(true);
      expect(privacyEngine.encryptionKey).toBeDefined();
    });

    test('should not reinitialize if already initialized', async () => {
      privacyEngine.isInitialized = true;
      privacyEngine.encryptionKey = 'test-key';
      
      const result = await privacyEngine.initialize('test-user');
      
      expect(result).toBe(true);
      expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    });

    test('should handle initialization errors gracefully', async () => {
      AsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));
      
      await expect(privacyEngine.initialize('test-user')).rejects.toThrow();
      expect(privacyEngine.isInitialized).toBe(false);
    });
  });

  describe('Data Processing', () => {
    beforeEach(async () => {
      await privacyEngine.initialize('test-user-123');
    });

    test('should process user data with privacy preservation', async () => {
      const userId = 'test-user-123';
      const rawData = {
        sessionDuration: 300,
        interactionCount: 15,
        contentCategories: ['connection', 'fun'],
        timestamps: [Date.now() - 3600000, Date.now()]
      };

      const result = await privacyEngine.processUserData(userId, rawData, 'behavior');

      expect(result).toMatchObject({
        localInsights: expect.any(Object),
        encryptedData: expect.any(Object),
        anonymizedMetrics: expect.any(Object),
        privacyLevel: expect.any(String),
        processingTimestamp: expect.any(Number)
      });

      expect(result.localInsights.privacyPreserved).toBe(true);
    });

    test('should extract minimal features correctly', () => {
      const rawData = {
        sessionDuration: 1800, // 30 minutes
        interactionCount: 25,
        featureUsageCount: 8,
        contentCategories: ['connection', 'fun', 'connection'],
        timestamps: [Date.now() - 7200000, Date.now() - 3600000, Date.now()]
      };

      const features = privacyEngine.extractMinimalFeatures(rawData, 'behavior');

      expect(features).toMatchObject({
        sessionDuration: expect.any(Number),
        interactionCount: expect.any(Number),
        featureUsageCount: expect.any(Number),
        contentCategoryDistribution: expect.any(Object),
        timeOfDayPattern: expect.any(Object),
        engagementDepth: expect.any(Number)
      });

      // Values should be normalized (0-1)
      expect(features.sessionDuration).toBeGreaterThanOrEqual(0);
      expect(features.sessionDuration).toBeLessThanOrEqual(1);
    });

    test('should add differential privacy noise', () => {
      const features = {
        sessionDuration: 0.5,
        interactionCount: 0.7,
        engagementScore: 0.8
      };

      const noisyFeatures = privacyEngine.addDifferentialPrivacy(features);

      // Values should be different due to noise (unless privacy level is LOW)
      if (privacyEngine.privacyLevel !== privacyEngine.PRIVACY_LEVELS.LOW) {
        expect(noisyFeatures.sessionDuration).not.toBe(0.5);
        expect(noisyFeatures.interactionCount).not.toBe(0.7);
      }

      // But should still be in valid range
      expect(noisyFeatures.sessionDuration).toBeGreaterThanOrEqual(0);
      expect(noisyFeatures.sessionDuration).toBeLessThanOrEqual(1);
    });
  });

  describe('Encryption and Decryption', () => {
    beforeEach(async () => {
      await privacyEngine.initialize('test-user-123');
    });

    test('should encrypt data correctly', () => {
      const data = { sensitive: 'information', score: 0.8 };

      const encrypted = privacyEngine.encryptPersonalizationData(data);

      expect(encrypted).toMatchObject({
        encrypted: expect.any(String),
        hash: expect.any(String),
        timestamp: expect.any(Number),
        privacyLevel: expect.any(String)
      });

      // Encrypted data should contain nonce:ciphertext format (nacl.secretbox)
      expect(encrypted.encrypted).toContain(':');
    });

    test('should decrypt data correctly', () => {
      const data = { test: 'data' };

      // Encrypt first, then decrypt to verify round-trip
      const encrypted = privacyEngine.encryptPersonalizationData(data);
      const decrypted = privacyEngine.decryptPersonalizationData(encrypted);

      expect(decrypted).toEqual(data);
    });

    test('should handle decryption errors', () => {
      const encryptedData = {
        encrypted: 'invalid-data',
        hash: 'test-hash'
      };

      expect(() => {
        privacyEngine.decryptPersonalizationData(encryptedData);
      }).toThrow();
    });
  });

  describe('Privacy Settings', () => {
    test('should load default privacy settings', async () => {
      const userId = 'test-user-123';
      
      const settings = await privacyEngine.loadPrivacySettings(userId);

      expect(settings).toMatchObject({
        level: privacyEngine.PRIVACY_LEVELS.HIGH,
        dataMinimization: true,
        differentialPrivacy: true,
        localProcessingOnly: true,
        automaticCleanup: true,
        analyticsOptOut: false
      });
    });

    test('should update privacy settings', async () => {
      const userId = 'test-user-123';
      await privacyEngine.initialize(userId);

      const newSettings = {
        level: privacyEngine.PRIVACY_LEVELS.MEDIUM,
        dataMinimization: false
      };

      const updated = await privacyEngine.updatePrivacySettings(userId, newSettings);

      expect(updated.level).toBe(privacyEngine.PRIVACY_LEVELS.MEDIUM);
      expect(updated.dataMinimization).toBe(false);
      expect(privacyEngine.privacyLevel).toBe(privacyEngine.PRIVACY_LEVELS.MEDIUM);
    });
  });
  describe('Data Retention and Cleanup', () => {
    beforeEach(async () => {
      await privacyEngine.initialize('test-user-123');
    });

    test('should load default retention policies', async () => {
      const userId = 'test-user-123';
      
      const policies = await privacyEngine.loadRetentionPolicies(userId);

      expect(policies).toMatchObject({
        behaviorData: expect.any(Number),
        personalizedInsights: expect.any(Number),
        mlModelData: expect.any(Number),
        analyticsEvents: expect.any(Number),
        cacheData: expect.any(Number),
        temporaryData: expect.any(Number)
      });

      // Check that all values are positive numbers (milliseconds)
      Object.values(policies).forEach(value => {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThan(0);
      });
    });

    test('should update retention policy', async () => {
      const userId = 'test-user-123';
      const newRetentionPeriod = 7 * 24 * 60 * 60 * 1000; // 7 days

      const result = await privacyEngine.updateRetentionPolicy(userId, 'behaviorData', newRetentionPeriod);

      expect(result).toBe(true);
      expect(privacyEngine.retentionPolicies.behaviorData).toBe(newRetentionPeriod);
    });

    test('should perform data cleanup', async () => {
      const userId = 'test-user-123';
      
      // Mock old data
      const oldData = JSON.stringify({
        timestamp: Date.now() - (100 * 24 * 60 * 60 * 1000), // 100 days old
        data: 'old-data'
      });

      const recentData = JSON.stringify({
        timestamp: Date.now() - (1 * 24 * 60 * 60 * 1000), // 1 day old
        data: 'recent-data'
      });

      AsyncStorage.getAllKeys.mockResolvedValue([
        `old_data_${userId}`,
        `recent_data_${userId}`,
        'other_key'
      ]);

      AsyncStorage.getItem
        .mockResolvedValueOnce(oldData)
        .mockResolvedValueOnce(recentData)
        .mockResolvedValueOnce('other-data');

      const result = await privacyEngine.performDataCleanup(userId);

      expect(result.itemsRemoved).toBeGreaterThan(0);
      expect(result.categoriesProcessed.length).toBeGreaterThan(0);
      expect(AsyncStorage.removeItem).toHaveBeenCalled();
    });

    test('should determine data type correctly', () => {
      expect(privacyEngine.determineDataType('behavior_test_user')).toBe('behaviorData');
      expect(privacyEngine.determineDataType('insights_test_user')).toBe('personalizedInsights');
      expect(privacyEngine.determineDataType('ml_model_test')).toBe('mlModelData');
      expect(privacyEngine.determineDataType('analytics_event')).toBe('analyticsEvents');
      expect(privacyEngine.determineDataType('cache_data')).toBe('cacheData');
      expect(privacyEngine.determineDataType('unknown_key')).toBe('temporaryData');
    });
  });

  describe('Utility Methods', () => {
    test('should normalize values correctly', () => {
      expect(privacyEngine.normalizeValue(5, 0, 10)).toBe(0.5);
      expect(privacyEngine.normalizeValue(0, 0, 10)).toBe(0);
      expect(privacyEngine.normalizeValue(10, 0, 10)).toBe(1);
      expect(privacyEngine.normalizeValue(-5, 0, 10)).toBe(0);
      expect(privacyEngine.normalizeValue(15, 0, 10)).toBe(1);
    });

    test('should normalize distribution correctly', () => {
      const array = ['a', 'b', 'a', 'c', 'a'];
      const normalized = privacyEngine.normalizeDistribution(array);

      expect(normalized).toEqual({
        'a': 0.6, // 3/5
        'b': 0.2, // 1/5
        'c': 0.2  // 1/5
      });
    });

    test('should handle empty arrays in normalization', () => {
      expect(privacyEngine.normalizeDistribution([])).toEqual({});
      expect(privacyEngine.normalizeDistribution(null)).toEqual({});
    });

    test('should calculate engagement depth', () => {
      const interactions = [
        { duration: 300, actions: 5 },
        { duration: 600, actions: 10 },
        { duration: 150, actions: 2 }
      ];

      const depth = privacyEngine.calculateEngagementDepth(interactions);

      expect(depth).toBeGreaterThanOrEqual(0);
      expect(depth).toBeLessThanOrEqual(1);
    });

    test('should calculate content diversity', () => {
      const content = [
        { category: 'connection', heatLevel: 1 },
        { category: 'fun', heatLevel: 2 },
        { category: 'connection', heatLevel: 3 },
        { category: 'intimacy', heatLevel: 2 }
      ];

      const diversity = privacyEngine.calculateContentDiversity(content);

      expect(diversity).toBeGreaterThanOrEqual(0);
      expect(diversity).toBeLessThanOrEqual(1);
    });

    test('should generate consistent data hashes', () => {
      const data1 = { a: 1, b: 2 };
      const data2 = { a: 1, b: 2 };
      const data3 = { a: 1, b: 3 };

      const hash1 = privacyEngine.generateDataHash(data1);
      const hash2 = privacyEngine.generateDataHash(data2);
      const hash3 = privacyEngine.generateDataHash(data3);

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
    });
  });

  describe('Privacy Compliance', () => {
    beforeEach(async () => {
      await privacyEngine.initialize('test-user-123');
    });

    test('should validate privacy compliance', async () => {
      const userId = 'test-user-123';
      
      AsyncStorage.getAllKeys.mockResolvedValue([
        `data_${userId}`,
        'other_key'
      ]);

      AsyncStorage.getItem.mockResolvedValue(JSON.stringify({
        timestamp: Date.now() - (1 * 24 * 60 * 60 * 1000) // 1 day old
      }));

      const compliance = await privacyEngine.validatePrivacyCompliance(userId);

      expect(compliance).toMatchObject({
        encryptionEnabled: expect.any(Boolean),
        privacyLevel: expect.any(String),
        dataMinimization: true,
        localProcessing: true,
        retentionPoliciesActive: expect.any(Boolean),
        differentialPrivacyEnabled: expect.any(Boolean),
        issues: expect.any(Array)
      });
    });

    test('should identify privacy issues', async () => {
      const userId = 'test-user-123';
      
      // Set up conditions that should trigger issues
      privacyEngine.encryptionKey = null;
      privacyEngine.privacyLevel = privacyEngine.PRIVACY_LEVELS.LOW;

      const compliance = await privacyEngine.validatePrivacyCompliance(userId);

      expect(compliance.issues).toContain('Encryption key not available');
      expect(compliance.issues).toContain('Privacy level set to LOW - reduced protection');
    });
  });

  describe('Emergency Data Wipe', () => {
    test('should perform emergency data wipe', async () => {
      const userId = 'test-user-123';
      
      AsyncStorage.getAllKeys.mockResolvedValue([
        `data_${userId}`,
        `profile_${userId}`,
        'other_key'
      ]);

      const result = await privacyEngine.emergencyDataWipe(userId);

      expect(result).toBe(true);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`data_${userId}`);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`profile_${userId}`);
      expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith('other_key');
      
      expect(privacyEngine.encryptionKey).toBeNull();
      expect(privacyEngine.isInitialized).toBe(false);
    });

    test('should handle emergency wipe errors', async () => {
      const userId = 'test-user-123';
      
      AsyncStorage.getAllKeys.mockRejectedValue(new Error('Storage error'));

      const result = await privacyEngine.emergencyDataWipe(userId);

      expect(result).toBe(false);
    });
  });

  describe('Laplace Noise Generation', () => {
    test('should generate Laplace noise', () => {
      const noise1 = privacyEngine.generateLaplaceNoise(0, 1);
      const noise2 = privacyEngine.generateLaplaceNoise(0, 1);

      // Noise should be different each time
      expect(noise1).not.toBe(noise2);
      
      // Should be numbers
      expect(typeof noise1).toBe('number');
      expect(typeof noise2).toBe('number');
    });

    test('should generate noise with different scales', () => {
      const smallNoise = privacyEngine.generateLaplaceNoise(0, 0.1);
      const largeNoise = privacyEngine.generateLaplaceNoise(0, 10);

      // Larger scale should generally produce larger absolute values
      // (This is probabilistic, so we just check they're different)
      expect(Math.abs(smallNoise)).not.toBe(Math.abs(largeNoise));
    });
  });

  describe('Error Handling', () => {
    test('should handle storage errors during initialization', async () => {
      AsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      await expect(privacyEngine.initialize('test-user')).rejects.toThrow();
      expect(privacyEngine.isInitialized).toBe(false);
    });

    test('should handle encryption errors', async () => {
      await privacyEngine.initialize('test-user-123');
      
      // Clear encryption key to force an error
      privacyEngine.encryptionKey = null;

      const data = { test: 'data' };

      expect(() => {
        privacyEngine.encryptPersonalizationData(data);
      }).toThrow('Encryption key not available');
    });

    test('should handle processing errors gracefully', async () => {
      const userId = 'test-user-123';
      await privacyEngine.initialize(userId);

      // Mock a processing error
      privacyEngine.extractMinimalFeatures = jest.fn().mockImplementation(() => {
        throw new Error('Processing error');
      });

      await expect(privacyEngine.processUserData(userId, {}, 'behavior')).rejects.toThrow();
    });
  });
});
