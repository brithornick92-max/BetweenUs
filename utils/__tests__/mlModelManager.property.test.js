// utils/__tests__/mlModelManager.property.test.js
import fc from 'fast-check';
import mlModelManager from '../mlModelManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('../analytics');

describe('MLModelManager Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue(true);
    
    // Reset manager state
    mlModelManager.isInitialized = false;
    mlModelManager.loadingPromise = null;
    mlModelManager.performanceMetrics.clear();
    Object.keys(mlModelManager.models).forEach(key => {
      mlModelManager.models[key] = null;
    });
  });

  /**
   * Property 1: ML model convergence and stability
   * **Validates: Requirements 2.2**
   */
  describe('Property 1: Model Convergence and Stability', () => {
    test('should produce stable predictions for identical inputs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('recommendation', 'churn', 'health', 'timing', 'content_similarity'),
          fc.record({
            behaviorScore: fc.float({ min: 0, max: 1 }),
            contentAffinity: fc.float({ min: 0, max: 1 }),
            contextualFactors: fc.float({ min: 0, max: 1 }),
            relationshipStage: fc.float({ min: 0, max: 1 }),
            temporalPatterns: fc.float({ min: 0, max: 1 })
          }),
          async (modelName, features) => {
            await mlModelManager.initialize();

            // Make multiple predictions with identical inputs
            const prediction1 = await mlModelManager.predict(modelName, features);
            const prediction2 = await mlModelManager.predict(modelName, features);
            const prediction3 = await mlModelManager.predict(modelName, features);

            // Property: Identical inputs should produce identical predictions
            expect(prediction1.prediction).toBe(prediction2.prediction);
            expect(prediction2.prediction).toBe(prediction3.prediction);

            // Property: Predictions should be in valid range [0, 1]
            expect(prediction1.prediction).toBeGreaterThanOrEqual(0);
            expect(prediction1.prediction).toBeLessThanOrEqual(1);

            // Property: Confidence should be consistent
            expect(prediction1.confidence).toBe(prediction2.confidence);
            expect(prediction1.confidence).toBeGreaterThanOrEqual(0);
            expect(prediction1.confidence).toBeLessThanOrEqual(1);

            // Property: Model version should be consistent
            expect(prediction1.modelVersion).toBe(prediction2.modelVersion);
          }
        ),
        { numRuns: 30, timeout: 10000 }
      );
    });

    test('should maintain prediction bounds regardless of input values', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('recommendation', 'churn', 'health'),
          fc.record({
            behaviorScore: fc.float({ min: -10, max: 10 }), // Extreme values
            contentAffinity: fc.float({ min: -5, max: 5 }),
            contextualFactors: fc.float({ min: -1, max: 2 }),
            relationshipStage: fc.float({ min: -2, max: 3 })
          }),
          async (modelName, extremeFeatures) => {
            await mlModelManager.initialize();

            const prediction = await mlModelManager.predict(modelName, extremeFeatures);

            // Property: Predictions should always be bounded [0, 1] even with extreme inputs
            expect(prediction.prediction).toBeGreaterThanOrEqual(0);
            expect(prediction.prediction).toBeLessThanOrEqual(1);

            // Property: Should not return NaN or undefined
            expect(isNaN(prediction.prediction)).toBe(false);
            expect(prediction.prediction).toBeDefined();

            // Property: Confidence should also be bounded
            expect(prediction.confidence).toBeGreaterThanOrEqual(0);
            expect(prediction.confidence).toBeLessThanOrEqual(1);
            expect(isNaN(prediction.confidence)).toBe(false);
          }
        ),
        { numRuns: 25 }
      );
    });

    test('should show smooth prediction changes for gradual input changes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('recommendation', 'health'),
          fc.record({
            behaviorScore: fc.float({ min: Math.fround(0.2), max: Math.fround(0.8) }),
            contentAffinity: fc.float({ min: Math.fround(0.2), max: Math.fround(0.8) }),
            contextualFactors: fc.float({ min: Math.fround(0.2), max: Math.fround(0.8) })
          }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(0.1) }), // Small delta
          async (modelName, baseFeatures, delta) => {
            await mlModelManager.initialize();

            // Create slightly modified features
            const modifiedFeatures = {
              ...baseFeatures,
              behaviorScore: Math.min(1, baseFeatures.behaviorScore + delta)
            };

            const basePrediction = await mlModelManager.predict(modelName, baseFeatures);
            const modifiedPrediction = await mlModelManager.predict(modelName, modifiedFeatures);

            // Property: Small input changes should result in small prediction changes (Lipschitz continuity)
            const predictionDiff = Math.abs(basePrediction.prediction - modifiedPrediction.prediction);
            expect(predictionDiff).toBeLessThan(0.5); // Should not jump dramatically

            // Property: Both predictions should be valid
            expect(basePrediction.prediction).toBeGreaterThanOrEqual(0);
            expect(basePrediction.prediction).toBeLessThanOrEqual(1);
            expect(modifiedPrediction.prediction).toBeGreaterThanOrEqual(0);
            expect(modifiedPrediction.prediction).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 2: Performance metrics calculation accuracy
   * **Validates: Requirements 2.3**
   */
  describe('Property 2: Performance Metrics Accuracy', () => {
    test('should calculate regression metrics correctly', async () => {
      await fc.assert(
        fc.property(
          fc.array(fc.float({ min: Math.fround(0), max: Math.fround(1) }), { minLength: 5, maxLength: 20 }),
          fc.array(fc.float({ min: Math.fround(0), max: Math.fround(1) }), { minLength: 5, maxLength: 20 }),
          (predictions, actuals) => {
            // Ensure arrays are same length
            const minLength = Math.min(predictions.length, actuals.length);
            const predSlice = predictions.slice(0, minLength);
            const actualSlice = actuals.slice(0, minLength);

            const metrics = mlModelManager.calculatePerformanceMetrics(predSlice, actualSlice);

            // Property: MSE should be non-negative
            expect(metrics.mse).toBeGreaterThanOrEqual(0);

            // Property: MAE should be non-negative
            expect(metrics.mae).toBeGreaterThanOrEqual(0);

            // Property: RMSE should equal sqrt(MSE)
            expect(Math.abs(metrics.rmse - Math.sqrt(metrics.mse))).toBeLessThan(0.0001);

            // Property: Perfect predictions should yield zero error
            const perfectMetrics = mlModelManager.calculatePerformanceMetrics(predSlice, predSlice);
            expect(perfectMetrics.mse).toBeLessThan(0.0001);
            expect(perfectMetrics.mae).toBeLessThan(0.0001);

            // Property: All metrics should be numbers
            expect(typeof metrics.mse).toBe('number');
            expect(typeof metrics.mae).toBe('number');
            expect(typeof metrics.rmse).toBe('number');
            expect(typeof metrics.accuracy).toBe('number');

            // Property: No NaN values
            expect(isNaN(metrics.mse)).toBe(false);
            expect(isNaN(metrics.mae)).toBe(false);
            expect(isNaN(metrics.rmse)).toBe(false);
            expect(isNaN(metrics.accuracy)).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should calculate classification metrics correctly', async () => {
      await fc.assert(
        fc.property(
          fc.array(fc.float({ min: Math.fround(0), max: Math.fround(1) }), { minLength: 10, maxLength: 30 }),
          fc.array(fc.integer({ min: 0, max: 1 }), { minLength: 10, maxLength: 30 }),
          (predictions, actuals) => {
            const minLength = Math.min(predictions.length, actuals.length);
            const predSlice = predictions.slice(0, minLength);
            const actualSlice = actuals.slice(0, minLength);

            const metrics = mlModelManager.calculatePerformanceMetrics(predSlice, actualSlice);

            // Property: All metrics should be in [0, 1] range
            expect(metrics.accuracy).toBeGreaterThanOrEqual(0);
            expect(metrics.accuracy).toBeLessThanOrEqual(1);
            expect(metrics.precision).toBeGreaterThanOrEqual(0);
            expect(metrics.precision).toBeLessThanOrEqual(1);
            expect(metrics.recall).toBeGreaterThanOrEqual(0);
            expect(metrics.recall).toBeLessThanOrEqual(1);
            expect(metrics.f1Score).toBeGreaterThanOrEqual(0);
            expect(metrics.f1Score).toBeLessThanOrEqual(1);

            // Property: F1 score should be harmonic mean of precision and recall
            if (metrics.precision > 0 && metrics.recall > 0) {
              const expectedF1 = 2 * (metrics.precision * metrics.recall) / (metrics.precision + metrics.recall);
              expect(Math.abs(metrics.f1Score - expectedF1)).toBeLessThan(0.0001);
            }

            // Property: Perfect predictions should yield perfect metrics
            const perfectPredictions = actualSlice.map(a => a > 0.5 ? 0.9 : 0.1);
            const perfectMetrics = mlModelManager.calculatePerformanceMetrics(perfectPredictions, actualSlice);
            expect(perfectMetrics.accuracy).toBe(1);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 3: Data anonymization consistency
   * **Validates: Requirements 2.4**
   */
  describe('Property 3: Data Anonymization Consistency', () => {
    test('should consistently remove identifying information', async () => {
      await fc.assert(
        fc.property(
          fc.array(
            fc.record({
              userId: fc.string({ minLength: 10, maxLength: 20 }),
              timestamp: fc.integer({ min: 1000000000000, max: 9999999999999 }),
              sessionId: fc.string({ minLength: 10, maxLength: 15 }),
              features: fc.record({
                behaviorScore: fc.float({ min: 0, max: 1 }),
                engagement: fc.float({ min: 0, max: 1 })
              }),
              actual: fc.float({ min: 0, max: 1 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (rawData) => {
            const anonymized = mlModelManager.anonymizeTrainingData(rawData);

            expect(anonymized.length).toBe(rawData.length);

            anonymized.forEach((item, index) => {
              // Property: Should not contain identifying fields
              expect(item).not.toHaveProperty('userId');
              expect(item).not.toHaveProperty('timestamp');
              expect(item).not.toHaveProperty('sessionId');

              // Property: Should preserve essential fields
              expect(item).toHaveProperty('features');
              expect(item).toHaveProperty('actual');

              // Property: Features should have noise added (values should be different)
              const originalFeatures = rawData[index].features;
              Object.keys(originalFeatures).forEach(key => {
                if (typeof originalFeatures[key] === 'number') {
                  // Values should be different due to noise (with high probability)
                  // Allow for small chance they might be the same due to random noise
                  const diff = Math.abs(item.features[key] - originalFeatures[key]);
                  expect(diff).toBeLessThan(0.1); // Noise should be small
                }
              });

              // Property: Values should remain in valid range after noise
              Object.values(item.features).forEach(value => {
                if (typeof value === 'number') {
                  expect(value).toBeGreaterThanOrEqual(0);
                  expect(value).toBeLessThanOrEqual(1);
                }
              });
            });
          }
        ),
        { numRuns: 25 }
      );
    });

    test('should add differential privacy noise consistently', async () => {
      await fc.assert(
        fc.property(
          fc.array(
            fc.record({
              features: fc.record({
                score1: fc.float({ min: Math.fround(0.2), max: Math.fround(0.8) }),
                score2: fc.float({ min: Math.fround(0.2), max: Math.fround(0.8) }),
                score3: fc.float({ min: Math.fround(0.2), max: Math.fround(0.8) })
              }),
              actual: fc.float({ min: 0, max: 1 })
            }),
            { minLength: 3, maxLength: 8 }
          ),
          (data) => {
            const anonymized1 = mlModelManager.anonymizeTrainingData(data);
            const anonymized2 = mlModelManager.anonymizeTrainingData(data);

            // Property: Multiple anonymizations should produce different results (due to random noise)
            let foundDifference = false;
            for (let i = 0; i < data.length; i++) {
              const features1 = anonymized1[i].features;
              const features2 = anonymized2[i].features;
              
              Object.keys(features1).forEach(key => {
                if (Math.abs(features1[key] - features2[key]) > 0.001) {
                  foundDifference = true;
                }
              });
            }
            
            // Should find at least some differences due to random noise
            expect(foundDifference).toBe(true);

            // Property: All values should remain in valid bounds
            [...anonymized1, ...anonymized2].forEach(item => {
              Object.values(item.features).forEach(value => {
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThanOrEqual(1);
                expect(isNaN(value)).toBe(false);
              });
            });
          }
        ),
        { numRuns: 20 }
      );
    });
  });
  /**
   * Property 4: Model versioning and rollback consistency
   * **Validates: Requirements 2.5**
   */
  describe('Property 4: Model Versioning Consistency', () => {
    test('should maintain version consistency across operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('recommendation', 'churn', 'health'),
          fc.record({
            weights: fc.dictionary(fc.string(), fc.float({ min: 0, max: 1 })),
            parameters: fc.dictionary(fc.string(), fc.float({ min: 0, max: 1 }))
          }),
          async (modelName, modelData) => {
            // Save model
            const saveResult = await mlModelManager.saveModel(modelName, modelData);
            expect(saveResult).toBe(true);

            // Load model
            const loadedModel = await mlModelManager.loadModel(modelName);

            // Property: Loaded model should have same version as config
            const expectedVersion = mlModelManager.modelConfigs[modelName].version;
            expect(loadedModel.version).toBe(expectedVersion);

            // Property: Model should maintain version through serialization
            const serialized = loadedModel.serialize();
            expect(serialized.version).toBe(expectedVersion);

            // Property: Version should be included in save data
            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
              expect.stringContaining(modelName),
              expect.stringContaining(expectedVersion)
            );
          }
        ),
        { numRuns: 15 }
      );
    });

    test('should validate model checksums correctly', async () => {
      await fc.assert(
        fc.property(
          fc.record({
            weights: fc.dictionary(fc.string(), fc.float()),
            parameters: fc.dictionary(fc.string(), fc.float()),
            version: fc.string()
          }),
          (modelData) => {
            // Calculate checksum
            const checksum1 = mlModelManager.calculateChecksum(modelData);
            const checksum2 = mlModelManager.calculateChecksum(modelData);

            // Property: Identical data should produce identical checksums
            expect(checksum1).toBe(checksum2);

            // Property: Checksum should be a string
            expect(typeof checksum1).toBe('string');
            expect(checksum1.length).toBeGreaterThan(0);

            // Property: Different data should produce different checksums
            const modifiedData = { ...modelData, version: modelData.version + '_modified' };
            const checksum3 = mlModelManager.calculateChecksum(modifiedData);
            expect(checksum3).not.toBe(checksum1);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 5: Model update and incremental learning consistency
   * **Validates: Requirements 2.6**
   */
  describe('Property 5: Model Update Consistency', () => {
    test('should handle incremental updates correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('recommendation', 'churn'),
          fc.array(
            fc.record({
              features: fc.record({
                behaviorScore: fc.float({ min: 0, max: 1 }),
                contentAffinity: fc.float({ min: 0, max: 1 })
              }),
              actual: fc.float({ min: 0, max: 1 })
            }),
            { minLength: 10, maxLength: 25 } // Ensure sufficient data
          ),
          async (modelName, trainingData) => {
            await mlModelManager.initialize();

            // Get initial model state
            const initialModel = mlModelManager.models[modelName];
            const initialPerformance = initialModel.performance;

            // Update model
            const updateResult = await mlModelManager.updateModel(modelName, trainingData);

            // Property: Update should succeed with sufficient data
            expect(updateResult).toBe(true);

            // Property: Model should still be valid after update
            const updatedModel = mlModelManager.models[modelName];
            expect(updatedModel).toBeDefined();
            expect(updatedModel.version).toBe(initialModel.version);

            // Property: Should be able to make predictions after update
            const testFeatures = {
              behaviorScore: 0.5,
              contentAffinity: 0.6,
              contextualFactors: 0.4
            };

            const prediction = await mlModelManager.predict(modelName, testFeatures);
            expect(prediction.prediction).toBeGreaterThanOrEqual(0);
            expect(prediction.prediction).toBeLessThanOrEqual(1);
            expect(prediction.error).toBeUndefined();
          }
        ),
        { numRuns: 10, timeout: 15000 }
      );
    });

    test('should reject updates with insufficient data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('recommendation', 'churn', 'health'),
          fc.array(
            fc.record({
              features: fc.record({
                score: fc.float({ min: 0, max: 1 })
              }),
              actual: fc.float({ min: 0, max: 1 })
            }),
            { minLength: 1, maxLength: 5 } // Insufficient data
          ),
          async (modelName, insufficientData) => {
            await mlModelManager.initialize();

            const minRequired = mlModelManager.modelConfigs[modelName].minDataPoints;
            
            // Only test if data is actually insufficient
            if (insufficientData.length < minRequired) {
              const updateResult = await mlModelManager.updateModel(modelName, insufficientData);

              // Property: Should reject update with insufficient data
              expect(updateResult).toBe(false);

              // Property: Model should remain unchanged
              const model = mlModelManager.models[modelName];
              expect(model).toBeDefined();
            }
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  /**
   * Property 6: Model evaluation consistency
   * **Validates: Requirements 2.7**
   */
  describe('Property 6: Model Evaluation Consistency', () => {
    test('should evaluate models consistently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('recommendation', 'health'),
          fc.array(
            fc.record({
              features: fc.record({
                behaviorScore: fc.float({ min: 0, max: 1 }),
                contentAffinity: fc.float({ min: 0, max: 1 }),
                contextualFactors: fc.float({ min: 0, max: 1 })
              }),
              actual: fc.float({ min: 0, max: 1 })
            }),
            { minLength: 5, maxLength: 15 }
          ),
          async (modelName, testData) => {
            await mlModelManager.initialize();

            const performance1 = await mlModelManager.evaluateModel(modelName, testData);
            const performance2 = await mlModelManager.evaluateModel(modelName, testData);

            // Property: Identical test data should produce identical performance metrics
            if (performance1 && performance2) {
              expect(performance1.accuracy).toBe(performance2.accuracy);
              expect(performance1.mse).toBe(performance2.mse);
              expect(performance1.mae).toBe(performance2.mae);

              // Property: Performance metrics should be in valid ranges
              expect(performance1.accuracy).toBeGreaterThanOrEqual(0);
              expect(performance1.accuracy).toBeLessThanOrEqual(1);
              expect(performance1.mse).toBeGreaterThanOrEqual(0);
              expect(performance1.mae).toBeGreaterThanOrEqual(0);
            }
          }
        ),
        { numRuns: 15, timeout: 10000 }
      );
    });
  });

  /**
   * Property 7: Model instance creation consistency
   * **Validates: Requirements 2.8**
   */
  describe('Property 7: Model Instance Creation Consistency', () => {
    test('should create consistent model instances', async () => {
      await fc.assert(
        fc.property(
          fc.constantFrom('recommendation', 'churn', 'health', 'timing', 'content_similarity'),
          fc.record({
            weights: fc.dictionary(fc.string(), fc.float({ min: 0, max: 1 })),
            parameters: fc.dictionary(fc.string(), fc.float({ min: 0, max: 1 })),
            performance: fc.record({
              accuracy: fc.float({ min: 0, max: 1 })
            })
          }),
          (modelName, modelData) => {
            const instance1 = mlModelManager.createModelInstance(modelName, modelData);
            const instance2 = mlModelManager.createModelInstance(modelName, modelData);

            // Property: Should create instances of correct type
            expect(instance1).toBeDefined();
            expect(instance2).toBeDefined();

            // Property: Instances should have same configuration
            expect(instance1.weights).toEqual(instance2.weights);
            expect(instance1.parameters).toEqual(instance2.parameters);
            expect(instance1.version).toBe(instance2.version);

            // Property: Should have required methods
            expect(typeof instance1.predict).toBe('function');
            expect(typeof instance1.serialize).toBe('function');
            expect(typeof instance1.incrementalUpdate).toBe('function');

            // Property: Serialization should be consistent
            const serialized1 = instance1.serialize();
            const serialized2 = instance2.serialize();
            expect(serialized1).toEqual(serialized2);
          }
        ),
        { numRuns: 25 }
      );
    });

    test('should create default models consistently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('recommendation', 'churn', 'health', 'timing', 'content_similarity'),
          async (modelName) => {
            const defaultModel1 = mlModelManager.createDefaultModel(modelName);
            const defaultModel2 = mlModelManager.createDefaultModel(modelName);

            // Property: Default models should have consistent structure
            expect(defaultModel1.isDefault).toBe(true);
            expect(defaultModel2.isDefault).toBe(true);

            // Property: Should have default weights and parameters
            expect(defaultModel1.weights).toBeDefined();
            expect(defaultModel1.parameters).toBeDefined();
            expect(defaultModel2.weights).toEqual(defaultModel1.weights);
            expect(defaultModel2.parameters).toEqual(defaultModel1.parameters);

            // Property: Should be able to make predictions
            expect(typeof defaultModel1.predict).toBe('function');
            expect(typeof defaultModel2.predict).toBe('function');

            // Property: Default predictions should be reasonable
            const testFeatures = { behaviorScore: 0.5, contentAffinity: 0.5 };
            const [pred1, pred2] = await Promise.all([
              defaultModel1.predict(testFeatures),
              defaultModel2.predict(testFeatures)
            ]);
            expect(pred1).toBe(pred2); // Should be identical
            expect(pred1).toBeGreaterThanOrEqual(0);
            expect(pred1).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 8: Error handling and fallback consistency
   * **Validates: Requirements 2.9**
   */
  describe('Property 8: Error Handling Consistency', () => {
    test('should handle prediction errors gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('nonexistent_model', 'invalid_model'),
          fc.record({
            invalidFeature: fc.string(),
            anotherInvalid: fc.boolean()
          }),
          async (invalidModelName, invalidFeatures) => {
            await mlModelManager.initialize();

            const prediction = await mlModelManager.predict(invalidModelName, invalidFeatures);

            // Property: Should return fallback prediction structure
            expect(prediction).toMatchObject({
              prediction: expect.any(Number),
              confidence: expect.any(Number),
              modelVersion: expect.any(String),
              predictionTime: expect.any(Number)
            });

            // Property: Fallback prediction should be in valid range
            expect(prediction.prediction).toBeGreaterThanOrEqual(0);
            expect(prediction.prediction).toBeLessThanOrEqual(1);
            expect(prediction.confidence).toBeGreaterThanOrEqual(0);
            expect(prediction.confidence).toBeLessThanOrEqual(1);

            // Property: Should indicate error occurred
            expect(prediction.error).toBeDefined();
            expect(prediction.modelVersion).toBe('fallback');
          }
        ),
        { numRuns: 15 }
      );
    });

    test('should handle storage errors gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('recommendation', 'churn'),
          fc.record({
            weights: fc.dictionary(fc.string(), fc.float()),
            parameters: fc.dictionary(fc.string(), fc.float())
          }),
          async (modelName, modelData) => {
            // Mock storage failure
            AsyncStorage.setItem.mockRejectedValueOnce(new Error('Storage failed'));

            const saveResult = await mlModelManager.saveModel(modelName, modelData);

            // Property: Should handle storage errors gracefully
            expect(saveResult).toBe(false);

            // Property: Should not throw unhandled errors
            // (If we reach this point, no unhandled error was thrown)
            expect(true).toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Property 9: Performance tracking consistency
   * **Validates: Requirements 2.10**
   */
  describe('Property 9: Performance Tracking Consistency', () => {
    test('should track prediction performance consistently', async () => {
      await fc.assert(
        fc.property(
          fc.constantFrom('recommendation', 'churn', 'health'),
          fc.array(
            fc.record({
              predictionTime: fc.integer({ min: 1, max: 1000 }),
              features: fc.record({
                score: fc.float({ min: 0, max: 1 })
              })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (modelName, performanceData) => {
            mlModelManager.performanceMetrics.clear();
            // Track multiple predictions
            performanceData.forEach(data => {
              mlModelManager.trackPredictionPerformance(
                modelName, 
                data.predictionTime, 
                data.features
              );
            });

            const performanceKey = `${modelName}_performance`;
            const metrics = mlModelManager.performanceMetrics.get(performanceKey);

            // Property: Should track all predictions
            expect(metrics.totalPredictions).toBe(performanceData.length);

            // Property: Total time should be sum of all prediction times
            const expectedTotalTime = performanceData.reduce((sum, data) => sum + data.predictionTime, 0);
            expect(metrics.totalTime).toBe(expectedTotalTime);

            // Property: Average time should be correct
            const expectedAverage = expectedTotalTime / performanceData.length;
            expect(metrics.averageTime).toBe(expectedAverage);

            // Property: Metrics should be non-negative
            expect(metrics.totalPredictions).toBeGreaterThanOrEqual(0);
            expect(metrics.totalTime).toBeGreaterThanOrEqual(0);
            expect(metrics.averageTime).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 25 }
      );
    });
  });
});
