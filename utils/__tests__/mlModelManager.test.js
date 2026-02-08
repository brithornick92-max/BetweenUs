// utils/__tests__/mlModelManager.test.js
import mlModelManager from '../mlModelManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('../analytics');

describe('MLModelManager', () => {
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

  describe('Initialization', () => {
    test('should initialize all models successfully', async () => {
      const result = await mlModelManager.initialize();

      expect(result).toBe(true);
      expect(mlModelManager.isInitialized).toBe(true);
      
      // Check that all models are initialized
      Object.values(mlModelManager.models).forEach(model => {
        expect(model).toBeDefined();
      });
    });

    test('should not reinitialize if already initialized', async () => {
      mlModelManager.isInitialized = true;
      
      const result = await mlModelManager.initialize();
      
      expect(result).toBe(true);
      // Should not call storage methods again
      expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    });

    test('should handle initialization errors gracefully', async () => {
      AsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));
      
      await expect(mlModelManager.initialize()).rejects.toThrow('Storage error');
      expect(mlModelManager.isInitialized).toBe(false);
    });
  });

  describe('Model Loading and Saving', () => {
    test('should load model from storage', async () => {
      const modelData = {
        weights: { test: 0.5 },
        parameters: { learningRate: 0.01 },
        version: '1.0.0',
        checksum: 'test-checksum'
      };

      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(modelData));
      
      const model = await mlModelManager.loadModel('recommendation');
      
      expect(model).toBeDefined();
      expect(model.weights).toEqual(modelData.weights);
    });

    test('should create default model when none exists', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      
      const model = await mlModelManager.loadModel('recommendation');
      
      expect(model).toBeDefined();
      expect(model.isDefault).toBe(true);
    });

    test('should save model to storage', async () => {
      const modelData = {
        weights: { test: 0.5 },
        parameters: { learningRate: 0.01 }
      };

      const result = await mlModelManager.saveModel('recommendation', modelData);

      expect(result).toBe(true);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('recommendation'),
        expect.stringContaining('test')
      );
    });
  });

  describe('Model Predictions', () => {
    test('should make predictions successfully', async () => {
      await mlModelManager.initialize();
      
      const features = {
        behaviorScore: 0.7,
        contentAffinity: 0.6,
        contextualFactors: 0.5
      };

      const prediction = await mlModelManager.predict('recommendation', features);

      expect(prediction).toMatchObject({
        prediction: expect.any(Number),
        confidence: expect.any(Number),
        modelVersion: expect.any(String),
        predictionTime: expect.any(Number)
      });

      expect(prediction.prediction).toBeGreaterThanOrEqual(0);
      expect(prediction.prediction).toBeLessThanOrEqual(1);
    });

    test('should return fallback prediction on error', async () => {
      // Don't initialize to force error
      const features = { behaviorScore: 0.7 };

      const prediction = await mlModelManager.predict('nonexistent', features);

      expect(prediction).toMatchObject({
        prediction: expect.any(Number),
        confidence: 0.3,
        modelVersion: 'fallback',
        error: expect.any(String)
      });
    });
  });

  describe('Model Updates', () => {
    test('should update model with sufficient data', async () => {
      await mlModelManager.initialize();
      
      const newData = Array.from({ length: 15 }, (_, i) => ({
        features: { behaviorScore: Math.random() },
        actual: Math.random()
      }));

      const result = await mlModelManager.updateModel('recommendation', newData);

      expect(result).toBe(true);
    });

    test('should reject update with insufficient data', async () => {
      await mlModelManager.initialize();
      
      const newData = [
        { features: { behaviorScore: 0.5 }, actual: 0.7 }
      ]; // Only 1 data point, need 10+

      const result = await mlModelManager.updateModel('recommendation', newData);

      expect(result).toBe(false);
    });
  });

  describe('Performance Metrics', () => {
    test('should calculate performance metrics for regression', () => {
      const predictions = [0.8, 0.6, 0.9, 0.7];
      const actuals = [0.9, 0.5, 0.8, 0.8];

      const metrics = mlModelManager.calculatePerformanceMetrics(predictions, actuals);

      expect(metrics).toMatchObject({
        mse: expect.any(Number),
        mae: expect.any(Number),
        rmse: expect.any(Number),
        accuracy: expect.any(Number)
      });

      expect(metrics.mse).toBeGreaterThanOrEqual(0);
      expect(metrics.accuracy).toBeGreaterThanOrEqual(0);
      expect(metrics.accuracy).toBeLessThanOrEqual(1);
    });

    test('should calculate performance metrics for classification', () => {
      const predictions = [0.8, 0.3, 0.9, 0.2]; // Will be converted to 1, 0, 1, 0
      const actuals = [1, 0, 1, 0];

      const metrics = mlModelManager.calculatePerformanceMetrics(predictions, actuals);

      expect(metrics).toMatchObject({
        accuracy: expect.any(Number),
        precision: expect.any(Number),
        recall: expect.any(Number),
        f1Score: expect.any(Number)
      });

      expect(metrics.accuracy).toBe(1); // Perfect classification in this case
    });

    test('should handle empty predictions gracefully', () => {
      const metrics = mlModelManager.calculatePerformanceMetrics([], []);

      expect(metrics).toMatchObject({
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0
      });
    });
  });
  describe('Privacy and Data Anonymization', () => {
    test('should anonymize training data', () => {
      const rawData = [
        {
          userId: 'user123',
          timestamp: Date.now(),
          sessionId: 'session456',
          features: { behaviorScore: 0.7, engagement: 0.8 },
          actual: 0.9
        }
      ];

      const anonymized = mlModelManager.anonymizeTrainingData(rawData);

      expect(anonymized[0]).not.toHaveProperty('userId');
      expect(anonymized[0]).not.toHaveProperty('timestamp');
      expect(anonymized[0]).not.toHaveProperty('sessionId');
      expect(anonymized[0]).toHaveProperty('features');
      expect(anonymized[0]).toHaveProperty('actual');
      
      // Features should have noise added
      expect(anonymized[0].features.behaviorScore).not.toBe(0.7);
      expect(anonymized[0].features.engagement).not.toBe(0.8);
    });

    test('should add differential privacy noise', () => {
      const originalData = [
        { features: { score: 0.5 }, actual: 0.7 },
        { features: { score: 0.6 }, actual: 0.8 }
      ];

      const anonymized = mlModelManager.anonymizeTrainingData(originalData);

      // Values should be different due to noise
      expect(anonymized[0].features.score).not.toBe(0.5);
      expect(anonymized[1].features.score).not.toBe(0.6);
      
      // But should still be in reasonable range
      expect(anonymized[0].features.score).toBeGreaterThanOrEqual(0);
      expect(anonymized[0].features.score).toBeLessThanOrEqual(1);
    });
  });

  describe('Model Validation', () => {
    test('should validate model structure correctly', () => {
      const validModel = {
        weights: { test: 0.5 },
        parameters: { learningRate: 0.01 },
        version: '1.0.0',
        checksum: 'valid-checksum'
      };

      const config = mlModelManager.modelConfigs.recommendation;
      
      // Mock checksum calculation to return expected value
      mlModelManager.calculateChecksum = jest.fn().mockReturnValue('valid-checksum');
      
      const isValid = mlModelManager.validateModel(validModel, config);
      expect(isValid).toBe(true);
    });

    test('should reject invalid model structure', () => {
      const invalidModel = {
        // Missing required fields
        version: '1.0.0'
      };

      const config = mlModelManager.modelConfigs.recommendation;
      const isValid = mlModelManager.validateModel(invalidModel, config);
      
      expect(isValid).toBe(false);
    });

    test('should reject model with wrong version', () => {
      const wrongVersionModel = {
        weights: { test: 0.5 },
        parameters: { learningRate: 0.01 },
        version: '2.0.0' // Wrong version
      };

      const config = mlModelManager.modelConfigs.recommendation;
      const isValid = mlModelManager.validateModel(wrongVersionModel, config);
      
      expect(isValid).toBe(false);
    });
  });

  describe('Model Status and Health', () => {
    test('should return comprehensive model status', async () => {
      await mlModelManager.initialize();
      
      const status = mlModelManager.getModelStatus();

      expect(status).toMatchObject({
        initialized: true,
        models: expect.any(Object),
        totalModels: expect.any(Number),
        loadedModels: expect.any(Number)
      });

      // Check individual model status
      Object.keys(mlModelManager.models).forEach(modelName => {
        expect(status.models[modelName]).toMatchObject({
          loaded: expect.any(Boolean),
          isDefault: expect.any(Boolean),
          version: expect.any(String),
          config: expect.any(Object)
        });
      });
    });

    test('should track prediction performance', () => {
      const modelName = 'recommendation';
      const predictionTime = 50;
      const features = { behaviorScore: 0.7 };

      mlModelManager.trackPredictionPerformance(modelName, predictionTime, features);

      const performanceKey = `${modelName}_performance`;
      const metrics = mlModelManager.performanceMetrics.get(performanceKey);

      expect(metrics).toMatchObject({
        totalPredictions: 1,
        totalTime: predictionTime,
        averageTime: predictionTime
      });
    });
  });

  describe('Cleanup and Maintenance', () => {
    test('should clear specific model data', async () => {
      const modelName = 'recommendation';
      
      AsyncStorage.getAllKeys.mockResolvedValue([
        `ml_models_${modelName}`,
        `model_performance_${modelName}`,
        'other_key'
      ]);

      const result = await mlModelManager.clearModelData(modelName);

      expect(result).toBe(true);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`ml_models_${modelName}`);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`model_performance_${modelName}`);
      expect(mlModelManager.models[modelName]).toBeNull();
    });

    test('should clear all model data', async () => {
      AsyncStorage.getAllKeys.mockResolvedValue([
        'ml_models_recommendation',
        'ml_models_churn',
        'model_performance_recommendation',
        'other_key'
      ]);

      const result = await mlModelManager.clearModelData();

      expect(result).toBe(true);
      expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(3); // 3 model-related keys
      expect(mlModelManager.isInitialized).toBe(false);
      
      Object.values(mlModelManager.models).forEach(model => {
        expect(model).toBeNull();
      });
    });
  });

  describe('Model Classes', () => {
    test('HybridFilteringModel should make predictions', async () => {
      const modelData = {
        weights: {
          behaviorScore: 0.35,
          contentAffinity: 0.25,
          contextualFactors: 0.20,
          relationshipStage: 0.15,
          temporalPatterns: 0.05
        }
      };

      const config = mlModelManager.modelConfigs.recommendation;
      const model = mlModelManager.createModelInstance('recommendation', modelData);

      const features = {
        behaviorScore: 0.8,
        contentAffinity: 0.7,
        contextualFactors: 0.6,
        relationshipStage: 0.9,
        temporalPatterns: 0.5
      };

      const prediction = await model.predict(features);

      expect(prediction).toBeGreaterThanOrEqual(0);
      expect(prediction).toBeLessThanOrEqual(1);
    });

    test('should calculate confidence scores', () => {
      const modelData = { performance: { accuracy: 0.8 } };
      const config = mlModelManager.modelConfigs.recommendation;
      const model = mlModelManager.createModelInstance('recommendation', modelData);

      const features = {
        behaviorScore: 0.8,
        contentAffinity: 0.7,
        contextualFactors: 0.6,
        relationshipStage: 0.9,
        temporalPatterns: 0.5
      };

      const confidence = model.getConfidence(features);

      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Error Handling', () => {
    test('should handle storage errors during initialization', async () => {
      AsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      await expect(mlModelManager.initialize()).rejects.toThrow();
      expect(mlModelManager.isInitialized).toBe(false);
    });

    test('should handle prediction errors gracefully', async () => {
      // Initialize with a broken model
      mlModelManager.models.recommendation = {
        predict: jest.fn().mockRejectedValue(new Error('Prediction error'))
      };
      mlModelManager.isInitialized = true;

      const prediction = await mlModelManager.predict('recommendation', {});

      expect(prediction.error).toBeDefined();
      expect(prediction.prediction).toBe(0.5); // Default fallback
    });
  });
});
