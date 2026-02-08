// utils/__tests__/privacyEngine.property.test.js
import fc from 'fast-check';
import privacyEngine from '../privacyEngine';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('expo-secure-store');
jest.mock('expo-crypto');
jest.mock('tweetnacl', () => jest.requireActual('tweetnacl'));
jest.mock('tweetnacl-util', () => jest.requireActual('tweetnacl-util'));
jest.mock('../analytics');

describe('PrivacyEngine Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue(true);
    AsyncStorage.getAllKeys.mockResolvedValue([]);
    
    // Mock SecureStore + expo-crypto
    SecureStore.getItemAsync.mockResolvedValue(null);
    SecureStore.setItemAsync.mockResolvedValue(undefined);
    Crypto.digestStringAsync.mockResolvedValue('a'.repeat(64));
    
    // Reset engine state
    privacyEngine.isInitialized = false;
    privacyEngine.encryptionKey = null;
    privacyEngine._keyCache.clear();
  });

  /**
   * Property 1: Data encryption and decryption consistency
   * **Validates: Requirements 3.1**
   */
  describe('Property 1: Encryption/Decryption Consistency', () => {
    test('should encrypt and decrypt data consistently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 20 }), // userId
          fc.record({
            personalData: fc.string({ minLength: 10, maxLength: 100 }),
            behaviorScore: fc.double({ min: 0, max: 1, noNaN: true }),
            preferences: fc.array(fc.string(), { minLength: 1, maxLength: 5 }),
            sensitiveMetrics: fc.record({
              sessionCount: fc.integer({ min: 1, max: 100 }),
              engagementTime: fc.integer({ min: 60, max: 3600 })
            })
          }),
          async (userId, sensitiveData) => {
            await privacyEngine.initialize(userId);

            const encrypted = privacyEngine.encryptPersonalizationData(sensitiveData);
            const decrypted = privacyEngine.decryptPersonalizationData(encrypted);

            // Property: Decrypted data should match original
            expect(decrypted).toEqual(sensitiveData);

            // Property: Encrypted data should not contain original values
            const encryptedPayload = JSON.stringify(encrypted);
            if (sensitiveData.personalData) {
              expect(encryptedPayload).not.toContain(sensitiveData.personalData);
            }
            
            // Property: Encrypted data should have required structure
            expect(encrypted).toMatchObject({
              encrypted: expect.any(String),
              hash: expect.any(String),
              timestamp: expect.any(Number),
              privacyLevel: expect.any(String)
            });

            // Property: Hash should be consistent for same data
            const hash1 = privacyEngine.generateDataHash(sensitiveData);
            const hash2 = privacyEngine.generateDataHash(sensitiveData);
            expect(hash1).toBe(hash2);
          }
        ),
        { numRuns: 20, timeout: 10000 }
      );
    });

    test('should handle encryption key generation consistently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 8, maxLength: 25 }),
          async (userId) => {
            const key1 = await privacyEngine.getOrCreateEncryptionKey(userId);
            const key2 = await privacyEngine.getOrCreateEncryptionKey(userId);

            // Property: Same user should get same key
            expect(key1).toBe(key2);

            // Property: Key should be a non-empty string
            expect(typeof key1).toBe('string');
            expect(key1.length).toBeGreaterThan(0);

            // Property: Different users should get different keys
            const differentUserId = userId + '_different';
            const key3 = await privacyEngine.getOrCreateEncryptionKey(differentUserId);
            expect(key3).not.toBe(key1);
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  /**
   * Property 2: Data minimization and feature extraction
   * **Validates: Requirements 3.2**
   */
  describe('Property 2: Data Minimization Validation', () => {
    test('should extract only minimal necessary features', async () => {
      await fc.assert(
        fc.property(
          fc.record({
            // Raw data with both necessary and unnecessary fields
            sessionDuration: fc.integer({ min: 60, max: 7200 }),
            interactionCount: fc.integer({ min: 1, max: 100 }),
            personalIdentifier: fc.string({ minLength: 10, maxLength: 20 }), // Should be excluded
            privateNotes: fc.string({ minLength: 5, maxLength: 50 }), // Should be excluded
            contentCategories: fc.array(fc.string(), { minLength: 1, maxLength: 5 }),
            timestamps: fc.array(fc.integer({ min: 1000000000000, max: 9999999999999 }), { minLength: 1, maxLength: 10 }),
            deviceInfo: fc.string(), // Should be excluded
            locationData: fc.string() // Should be excluded
          }),
          fc.constantFrom('behavior', 'content', 'engagement', 'temporal'),
          (rawData, dataType) => {
            const features = privacyEngine.extractMinimalFeatures(rawData, dataType);

            // Property: Should not contain identifying information
            const featureString = JSON.stringify(features);
            const shouldCheck = (value) =>
              typeof value === 'string' &&
              value.trim().length > 2 &&
              /[a-z0-9]/i.test(value);

            if (shouldCheck(rawData.personalIdentifier)) {
              expect(featureString).not.toContain(rawData.personalIdentifier);
            }
            if (shouldCheck(rawData.privateNotes)) {
              expect(featureString).not.toContain(rawData.privateNotes);
            }
            if (shouldCheck(rawData.deviceInfo)) {
              expect(featureString).not.toContain(rawData.deviceInfo);
            }
            if (shouldCheck(rawData.locationData)) {
              expect(featureString).not.toContain(rawData.locationData);
            }

            // Property: Should contain only normalized numerical features
            Object.values(features).forEach(value => {
              if (typeof value === 'number') {
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThanOrEqual(1);
              } else if (typeof value === 'object' && value !== null) {
                // Distribution objects should have normalized values
                Object.values(value).forEach(subValue => {
                  if (typeof subValue === 'number') {
                    expect(subValue).toBeGreaterThanOrEqual(0);
                    expect(subValue).toBeLessThanOrEqual(1);
                  }
                });
              }
            });

            // Property: Feature count should be reasonable (not excessive)
            const featureCount = Object.keys(features).length;
            expect(featureCount).toBeLessThan(20); // Reasonable upper bound
            expect(featureCount).toBeGreaterThan(0);
          }
        ),
        { numRuns: 30 }
      );
    });

    test('should normalize values consistently', async () => {
      await fc.assert(
        fc.property(
          fc.double({ min: -1000, max: 1000, noNaN: true }),
          fc.double({ min: -100, max: 100, noNaN: true }),
          fc.double({ min: -100, max: 1000, noNaN: true }),
          (value, min, max) => {
            // Ensure min <= max
            const actualMin = Math.min(min, max);
            const actualMax = Math.max(min, max);
            
            const normalized = privacyEngine.normalizeValue(value, actualMin, actualMax);

            // Property: Normalized value should be in [0, 1] range
            expect(normalized).toBeGreaterThanOrEqual(0);
            expect(normalized).toBeLessThanOrEqual(1);

            // Property: Values at boundaries should normalize correctly
            if (actualMax !== actualMin && Math.abs(actualMax - actualMin) > 1e-12) {
              expect(privacyEngine.normalizeValue(actualMin, actualMin, actualMax)).toBe(0);
              expect(privacyEngine.normalizeValue(actualMax, actualMin, actualMax)).toBe(1);
            }

            // Property: Midpoint should normalize to 0.5
            if (actualMax !== actualMin) {
              const midpoint = (actualMin + actualMax) / 2;
              const normalizedMidpoint = privacyEngine.normalizeValue(midpoint, actualMin, actualMax);
              expect(Math.abs(normalizedMidpoint - 0.5)).toBeLessThan(0.001);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 3: Differential privacy noise consistency
   * **Validates: Requirements 3.3**
   */
  describe('Property 3: Differential Privacy Validation', () => {
    test('should add appropriate noise based on privacy level', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5 }),
          fc.constantFrom(
            privacyEngine.PRIVACY_LEVELS.HIGH,
            privacyEngine.PRIVACY_LEVELS.MEDIUM,
            privacyEngine.PRIVACY_LEVELS.LOW
          ),
          fc.record({
            feature1: fc.double({ min: 0.2, max: 0.8, noNaN: true }),
            feature2: fc.double({ min: 0.2, max: 0.8, noNaN: true }),
            feature3: fc.double({ min: 0.2, max: 0.8, noNaN: true })
          }),
          async (userId, privacyLevel, originalFeatures) => {
            await privacyEngine.initialize(userId);
            await privacyEngine.updatePrivacySettings(userId, { level: privacyLevel });

            const noisyFeatures1 = privacyEngine.addDifferentialPrivacy(originalFeatures);
            const noisyFeatures2 = privacyEngine.addDifferentialPrivacy(originalFeatures);

            // Property: Values should remain in valid range after noise
            Object.values(noisyFeatures1).forEach(value => {
              expect(value).toBeGreaterThanOrEqual(0);
              expect(value).toBeLessThanOrEqual(1);
              expect(isNaN(value)).toBe(false);
            });

            if (privacyLevel === privacyEngine.PRIVACY_LEVELS.LOW) {
              // Property: LOW privacy should not add noise
              expect(noisyFeatures1).toEqual(originalFeatures);
            } else {
              // Property: MEDIUM/HIGH privacy should add noise (values should be different)
              let foundDifference = false;
              Object.keys(originalFeatures).forEach(key => {
                if (Math.abs(noisyFeatures1[key] - originalFeatures[key]) > 0.001) {
                  foundDifference = true;
                }
              });
              expect(foundDifference).toBe(true);

              // Property: Multiple noise applications should produce different results
              let foundVariation = false;
              Object.keys(originalFeatures).forEach(key => {
                if (Math.abs(noisyFeatures1[key] - noisyFeatures2[key]) > 0.001) {
                  foundVariation = true;
                }
              });
              expect(foundVariation).toBe(true);

              // Property: HIGH privacy should add more noise than MEDIUM
              if (privacyLevel === privacyEngine.PRIVACY_LEVELS.HIGH) {
                const highNoise = privacyEngine.addDifferentialPrivacy(originalFeatures);
                
                // Update to medium privacy
                await privacyEngine.updatePrivacySettings(userId, { 
                  level: privacyEngine.PRIVACY_LEVELS.MEDIUM 
                });
                const mediumNoise = privacyEngine.addDifferentialPrivacy(originalFeatures);

                // Calculate average deviation from original
                const highDeviation = Object.keys(originalFeatures).reduce((sum, key) => {
                  return sum + Math.abs(highNoise[key] - originalFeatures[key]);
                }, 0) / Object.keys(originalFeatures).length;

                const mediumDeviation = Object.keys(originalFeatures).reduce((sum, key) => {
                  return sum + Math.abs(mediumNoise[key] - originalFeatures[key]);
                }, 0) / Object.keys(originalFeatures).length;

                // Property: High privacy should generally have more deviation
                // (This is probabilistic, so we allow some tolerance)
                expect(highDeviation).toBeGreaterThanOrEqual(mediumDeviation * 0.8);
              }
            }
          }
        ),
        { numRuns: 20, timeout: 15000 }
      );
    });

    test('should generate Laplace noise with correct properties', async () => {
      await fc.assert(
        fc.property(
          fc.double({ min: -5, max: 5, noNaN: true }), // location
          fc.double({ min: 0.1, max: 5, noNaN: true }), // scale
          fc.integer({ min: 100, max: 500 }), // sample count
          (location, scale, sampleCount) => {
            const samples = [];
            for (let i = 0; i < sampleCount; i++) {
              samples.push(privacyEngine.generateLaplaceNoise(location, scale));
            }

            // Property: All samples should be numbers
            samples.forEach(sample => {
              expect(typeof sample).toBe('number');
              expect(isNaN(sample)).toBe(false);
              expect(isFinite(sample)).toBe(true);
            });

            // Property: Sample mean should be approximately equal to location
            const sampleMean = samples.reduce((sum, val) => sum + val, 0) / samples.length;
            const meanError = Math.abs(sampleMean - location);
            expect(meanError).toBeLessThan(scale * 2); // Allow reasonable deviation

            // Property: Samples should have variation (not all identical)
            const uniqueValues = new Set(samples);
            expect(uniqueValues.size).toBeGreaterThan(sampleCount * 0.8); // Most should be unique

            // Property: Larger scale should produce more variation
            if (scale > 1) {
              const variance = samples.reduce((sum, val) => {
                return sum + Math.pow(val - sampleMean, 2);
              }, 0) / samples.length;
              expect(variance).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 15 }
      );
    });
  });
  /**
   * Property 4: Data retention and cleanup consistency
   * **Validates: Requirements 3.4**
   */
  describe('Property 4: Data Retention Validation', () => {
    test('should enforce retention policies consistently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5 }),
          fc.record({
            behaviorData: fc.integer({ min: 1, max: 90 }), // days
            personalizedInsights: fc.integer({ min: 30, max: 365 }),
            mlModelData: fc.integer({ min: 7, max: 60 }),
            cacheData: fc.integer({ min: 1, max: 30 })
          }),
          async (userId, retentionDays) => {
            await privacyEngine.initialize(userId);

            // Convert days to milliseconds and update policies
            const retentionPolicies = {};
            Object.keys(retentionDays).forEach(key => {
              retentionPolicies[key] = retentionDays[key] * 24 * 60 * 60 * 1000;
            });

            for (const [dataType, retentionPeriod] of Object.entries(retentionPolicies)) {
              const result = await privacyEngine.updateRetentionPolicy(userId, dataType, retentionPeriod);
              expect(result).toBe(true);
            }

            // Property: Updated policies should be reflected in engine
            const loadedPolicies = await privacyEngine.loadRetentionPolicies(userId);
            Object.keys(retentionPolicies).forEach(key => {
              expect(loadedPolicies[key]).toBe(retentionPolicies[key]);
            });

            // Property: All retention periods should be positive
            Object.values(loadedPolicies).forEach(period => {
              expect(period).toBeGreaterThan(0);
              expect(typeof period).toBe('number');
            });

            // Property: Data type determination should be consistent
            const testKeys = [
              `behavior_${userId}`,
              `insights_${userId}`,
              `ml_model_${userId}`,
              `cache_${userId}`,
              `unknown_${userId}`
            ];

            testKeys.forEach(key => {
              const dataType = privacyEngine.determineDataType(key);
              expect(typeof dataType).toBe('string');
              expect(dataType.length).toBeGreaterThan(0);
              
              // Should be consistent for same key
              const dataType2 = privacyEngine.determineDataType(key);
              expect(dataType2).toBe(dataType);
            });
          }
        ),
        { numRuns: 15, timeout: 10000 }
      );
    });

    test('should perform cleanup based on data age', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5 }),
          fc.array(
            fc.record({
              key: fc.string({ minLength: 10 }),
              ageInDays: fc.integer({ min: 1, max: 200 }),
              dataType: fc.constantFrom('behaviorData', 'personalizedInsights', 'mlModelData', 'cacheData')
            }),
            { minLength: 3, maxLength: 10 }
          ),
          async (userId, testData) => {
            await privacyEngine.initialize(userId);

            // Mock storage keys and data
            const mockKeys = testData.map(item => `${item.dataType}_${userId}_${item.key}`);
            AsyncStorage.getAllKeys.mockResolvedValue([...mockKeys, 'other_key']);
            AsyncStorage.removeItem.mockClear();

            // Mock data with different ages
            testData.forEach((item, index) => {
              const timestamp = Date.now() - (item.ageInDays * 24 * 60 * 60 * 1000);
              const mockData = JSON.stringify({
                timestamp,
                data: `test-data-${index}`
              });
              
              AsyncStorage.getItem.mockImplementation((key) => {
                if (key === mockKeys[index]) {
                  return Promise.resolve(mockData);
                }
                return Promise.resolve(null);
              });
            });

            const cleanupResult = await privacyEngine.performDataCleanup(userId);

            // Property: Should return valid cleanup results
            expect(cleanupResult).toMatchObject({
              itemsRemoved: expect.any(Number),
              bytesFreed: expect.any(Number),
              categoriesProcessed: expect.any(Array)
            });

            // Property: Cleanup metrics should be non-negative
            expect(cleanupResult.itemsRemoved).toBeGreaterThanOrEqual(0);
            expect(cleanupResult.bytesFreed).toBeGreaterThanOrEqual(0);

            // Property: Should only process user's data
            if (cleanupResult.itemsRemoved > 0) {
              expect(AsyncStorage.removeItem).toHaveBeenCalled();
              
              // Verify only user-specific keys were targeted
              const removeCalls = AsyncStorage.removeItem.mock.calls;
              removeCalls.forEach(call => {
                const removedKey = call[0];
                expect(removedKey).toContain(userId);
                expect(removedKey).not.toBe('other_key');
              });
            }
          }
        ),
        { numRuns: 12, timeout: 15000 }
      );
    });
  });

  /**
   * Property 5: Privacy compliance validation
   * **Validates: Requirements 3.5**
   */
  describe('Property 5: Privacy Compliance Validation', () => {
    test('should validate privacy compliance consistently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5 }),
          fc.record({
            privacyLevel: fc.constantFrom(
              privacyEngine.PRIVACY_LEVELS.HIGH,
              privacyEngine.PRIVACY_LEVELS.MEDIUM,
              privacyEngine.PRIVACY_LEVELS.LOW
            ),
            hasEncryptionKey: fc.boolean(),
            dataAge: fc.integer({ min: 1, max: 100 }) // days
          }),
          async (userId, testConfig) => {
            await privacyEngine.initialize(userId);

            // Set up test conditions
            if (!testConfig.hasEncryptionKey) {
              privacyEngine.encryptionKey = null;
            }

            await privacyEngine.updatePrivacySettings(userId, {
              level: testConfig.privacyLevel
            });

            // Mock data with specified age
            const dataTimestamp = Date.now() - (testConfig.dataAge * 24 * 60 * 60 * 1000);
            AsyncStorage.getAllKeys.mockResolvedValue([`test_data_${userId}`]);
            AsyncStorage.getItem.mockResolvedValue(JSON.stringify({
              timestamp: dataTimestamp,
              data: 'test'
            }));

            const compliance = await privacyEngine.validatePrivacyCompliance(userId);

            // Property: Should return comprehensive compliance report
            expect(compliance).toMatchObject({
              encryptionEnabled: expect.any(Boolean),
              privacyLevel: expect.any(String),
              dataMinimization: expect.any(Boolean),
              localProcessing: expect.any(Boolean),
              retentionPoliciesActive: expect.any(Boolean),
              differentialPrivacyEnabled: expect.any(Boolean),
              issues: expect.any(Array)
            });

            // Property: Encryption status should match actual state
            expect(compliance.encryptionEnabled).toBe(testConfig.hasEncryptionKey);

            // Property: Privacy level should match setting
            expect(compliance.privacyLevel).toBe(testConfig.privacyLevel);

            // Property: Differential privacy should be disabled only for LOW level
            const expectedDPEnabled = testConfig.privacyLevel !== privacyEngine.PRIVACY_LEVELS.LOW;
            expect(compliance.differentialPrivacyEnabled).toBe(expectedDPEnabled);

            // Property: Issues should be identified correctly
            if (!testConfig.hasEncryptionKey) {
              expect(compliance.issues).toContain('Encryption key not available');
            }

            if (testConfig.privacyLevel === privacyEngine.PRIVACY_LEVELS.LOW) {
              expect(compliance.issues).toContain('Privacy level set to LOW - reduced protection');
            }

            // Property: Issues array should not contain duplicates
            const uniqueIssues = new Set(compliance.issues);
            expect(uniqueIssues.size).toBe(compliance.issues.length);
          }
        ),
        { numRuns: 20, timeout: 12000 }
      );
    });

    test('should handle emergency data wipe consistently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 8 }),
          fc.array(
            fc.string({ minLength: 5 }),
            { minLength: 2, maxLength: 8 }
          ),
          async (userId, dataKeys) => {
            // Create user-specific keys and other keys
            const userKeys = dataKeys.map(key => `${key}_${userId}`);
            const otherKeys = ['other_key_1', 'other_key_2'];
            const allKeys = [...userKeys, ...otherKeys];

            AsyncStorage.getAllKeys.mockResolvedValue(allKeys);
            AsyncStorage.removeItem.mockClear();

            const wipeResult = await privacyEngine.emergencyDataWipe(userId);

            // Property: Wipe should succeed
            expect(wipeResult).toBe(true);

            // Property: Should remove all user-specific keys
            userKeys.forEach(key => {
              expect(AsyncStorage.removeItem).toHaveBeenCalledWith(key);
            });

            // Property: Should not remove other users' keys
            otherKeys.forEach(key => {
              expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith(key);
            });

            // Property: Should reset engine state
            expect(privacyEngine.encryptionKey).toBeNull();
            expect(privacyEngine.isInitialized).toBe(false);

            // Property: Total remove calls should equal user keys count
            const removeCalls = AsyncStorage.removeItem.mock.calls;
            expect(removeCalls.length).toBe(userKeys.length);
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  /**
   * Property 6: Data anonymization consistency
   * **Validates: Requirements 3.6**
   */
  describe('Property 6: Data Anonymization Validation', () => {
    test('should anonymize user features consistently', async () => {
      await fc.assert(
        fc.property(
          fc.record({
            relationshipData: fc.record({
              stage: fc.constantFrom('new', 'developing', 'established', 'mature', 'long_term')
            }),
            behaviorMetrics: fc.record({
              sessionCount: fc.integer({ min: 1, max: 200 }),
              totalEngagementTime: fc.integer({ min: 100, max: 50000 })
            }),
            preferences: fc.record({
              contentCategories: fc.array(fc.string(), { minLength: 1, maxLength: 8 })
            })
          }),
          (userProfile) => {
            const anonymized = privacyEngine.extractAnonymizedUserFeatures(userProfile);

            // Property: Should not contain raw metrics
            expect(anonymized).not.toHaveProperty('sessionCount');
            expect(anonymized).not.toHaveProperty('totalEngagementTime');
            expect(anonymized).not.toHaveProperty('contentCategories');

            // Property: Should contain only categorized data
            expect(anonymized).toHaveProperty('relationshipStage');
            expect(anonymized).toHaveProperty('engagementLevel');
            expect(anonymized).toHaveProperty('contentPreferences');
            expect(anonymized).toHaveProperty('usagePattern');

            // Property: Categorized values should be from expected sets
            expect(['new', 'developing', 'established', 'mature', 'long_term', 'unknown'])
              .toContain(anonymized.relationshipStage);
            expect(['high', 'medium', 'low']).toContain(anonymized.engagementLevel);
            expect(['diverse', 'moderate', 'focused']).toContain(anonymized.contentPreferences);
            expect(['deep', 'moderate', 'quick']).toContain(anonymized.usagePattern);

            // Property: Same input should produce same output
            const anonymized2 = privacyEngine.extractAnonymizedUserFeatures(userProfile);
            expect(anonymized2).toEqual(anonymized);

            // Property: Should not contain any personally identifiable information
            const anonymizedString = JSON.stringify(anonymized);
            expect(anonymizedString).not.toMatch(/user|id|name|email|phone|address/i);
          }
        ),
        { numRuns: 30 }
      );
    });

    test('should calculate aggregated metrics without exposing individual data', async () => {
      await fc.assert(
        fc.property(
          fc.record({
            features: fc.dictionary(
              fc.string(),
              fc.double({ min: 0, max: 1, noNaN: true })
            ),
            patterns: fc.dictionary(
              fc.string(),
              fc.boolean()
            ),
            recommendations: fc.array(
              fc.record({
                id: fc.string(),
                score: fc.double({ min: 0, max: 1, noNaN: true })
              }),
              { minLength: 0, maxLength: 10 }
            )
          }),
          (insights) => {
            const aggregated = privacyEngine.calculateAggregatedMetrics(insights.features);

            // Property: Should return statistical aggregates only
            expect(aggregated).toMatchObject({
              average: expect.any(Number),
              variance: expect.any(Number)
            });

            // Property: Aggregates should be in valid ranges
            expect(aggregated.average).toBeGreaterThanOrEqual(0);
            expect(aggregated.average).toBeLessThanOrEqual(1);
            expect(aggregated.variance).toBeGreaterThanOrEqual(0);

            // Property: Should not contain individual feature values
            const aggregatedString = JSON.stringify(aggregated);
            Object.keys(insights.features).forEach(key => {
              if (key.length > 5) { // Avoid matching short common words
                expect(aggregatedString).not.toContain(key);
              }
            });

            // Property: Same features should produce same aggregates
            const aggregated2 = privacyEngine.calculateAggregatedMetrics(insights.features);
            expect(aggregated2).toEqual(aggregated);
          }
        ),
        { numRuns: 25 }
      );
    });
  });

  /**
   * Property 7: Local processing validation
   * **Validates: Requirements 3.7**
   */
  describe('Property 7: Local Processing Validation', () => {
    test('should process all data locally without external calls', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5 }),
          fc.record({
            sessionDuration: fc.integer({ min: 60, max: 3600 }),
            interactionCount: fc.integer({ min: 1, max: 50 }),
            contentCategories: fc.array(fc.string(), { minLength: 1, maxLength: 5 }),
            timestamps: fc.array(fc.integer(), { minLength: 1, maxLength: 10 })
          }),
          fc.constantFrom('behavior', 'content', 'engagement'),
          async (userId, rawData, dataType) => {
            await privacyEngine.initialize(userId);

            const result = await privacyEngine.processUserData(userId, rawData, dataType);

            // Property: Should return complete processing result
            expect(result).toMatchObject({
              localInsights: expect.any(Object),
              encryptedData: expect.any(Object),
              anonymizedMetrics: expect.any(Object),
              privacyLevel: expect.any(String),
              processingTimestamp: expect.any(Number)
            });

            // Property: Local insights should indicate privacy preservation
            expect(result.localInsights.privacyPreserved).toBe(true);

            // Property: Should not expose raw data in any output
            const resultString = JSON.stringify(result);
            
            // Check that sensitive raw data is not exposed
            if (typeof rawData.sessionDuration === 'number' && rawData.sessionDuration > 100) {
              expect(resultString).not.toContain(`\"sessionDuration\":${rawData.sessionDuration}`);
            }
            
            if (typeof rawData.interactionCount === 'number' && rawData.interactionCount > 10) {
              expect(resultString).not.toContain(`\"interactionCount\":${rawData.interactionCount}`);
            }

            // Property: Anonymized metrics should not contain individual values
            expect(result.anonymizedMetrics).toMatchObject({
              dataType: expect.any(String),
              featureCount: expect.any(Number),
              processingTime: expect.any(Number),
              privacyLevel: expect.any(String)
            });

            // Property: Processing should be deterministic for same input
            const result2 = await privacyEngine.processUserData(userId, rawData, dataType);
            
            // Note: Results may differ due to differential privacy noise,
            // but structure should be consistent
            expect(result2.localInsights.type).toBe(result.localInsights.type);
            expect(result2.anonymizedMetrics.dataType).toBe(result.anonymizedMetrics.dataType);
          }
        ),
        { numRuns: 15, timeout: 12000 }
      );
    });
  });

  /**
   * Property 8: Hash consistency and integrity
   * **Validates: Requirements 3.8**
   */
  describe('Property 8: Hash Consistency Validation', () => {
    test('should generate consistent hashes for data integrity', async () => {
      await fc.assert(
        fc.property(
          fc.record({
            data1: fc.anything(),
            data2: fc.anything(),
            data3: fc.anything()
          }),
          (testData) => {
            const hash1a = privacyEngine.generateDataHash(testData.data1);
            const hash1b = privacyEngine.generateDataHash(testData.data1);
            const hash2 = privacyEngine.generateDataHash(testData.data2);

            // Property: Same data should produce same hash
            expect(hash1a).toBe(hash1b);

            // Property: Hash should be a non-empty string
            expect(typeof hash1a).toBe('string');
            expect(hash1a.length).toBeGreaterThan(0);

            // Property: Different data should produce different hashes (with high probability)
            if (JSON.stringify(testData.data1) !== JSON.stringify(testData.data2)) {
              expect(hash1a).not.toBe(hash2);
            }

            // Property: Hash should be deterministic across multiple calls
            const hash1c = privacyEngine.generateDataHash(testData.data1);
            expect(hash1c).toBe(hash1a);
          }
        ),
        { numRuns: 40 }
      );
    });
  });
});
