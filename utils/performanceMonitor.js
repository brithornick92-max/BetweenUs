// utils/performanceMonitor.js
import AsyncStorage from '@react-native-async-storage/async-storage';

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.STORAGE_KEY = 'performance_metrics';
    this.MAX_STORED_METRICS = 100;
  }

  // Start timing an operation
  startTimer(operationName) {
    const startTime = Date.now();
    this.metrics.set(operationName, { startTime });
    return startTime;
  }

  // End timing and record the metric
  async endTimer(operationName, metadata = {}) {
    const metric = this.metrics.get(operationName);
    if (!metric) {
      console.warn(`No timer found for operation: ${operationName}`);
      return null;
    }

    const endTime = Date.now();
    const duration = endTime - metric.startTime;
    
    const performanceMetric = {
      operation: operationName,
      duration,
      timestamp: endTime,
      metadata
    };

    // Store metric
    await this.storeMetric(performanceMetric);
    
    // Clean up memory
    this.metrics.delete(operationName);
    
    // Log slow operations
    if (duration > 1000) { // More than 1 second
      console.warn(`Slow operation detected: ${operationName} took ${duration}ms`, metadata);
    }

    return performanceMetric;
  }

  // Record a metric without timing
  async recordMetric(operationName, value, metadata = {}) {
    const performanceMetric = {
      operation: operationName,
      value,
      timestamp: Date.now(),
      metadata
    };

    await this.storeMetric(performanceMetric);
    return performanceMetric;
  }

  // Store metric to persistent storage
  async storeMetric(metric) {
    try {
      const existingMetrics = await this.getStoredMetrics();
      const updatedMetrics = [metric, ...existingMetrics].slice(0, this.MAX_STORED_METRICS);
      
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedMetrics));
    } catch (error) {
      console.error('Failed to store performance metric:', error);
    }
  }

  // Get stored metrics
  async getStoredMetrics() {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to retrieve performance metrics:', error);
      return [];
    }
  }

  // Get performance summary
  async getPerformanceSummary(hours = 24) {
    try {
      const metrics = await this.getStoredMetrics();
      const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
      const recentMetrics = metrics.filter(m => m.timestamp > cutoffTime);

      const summary = {
        totalOperations: recentMetrics.length,
        averageResponseTime: 0,
        slowOperations: [],
        operationCounts: {},
        cacheHitRate: 0,
        errorRate: 0
      };

      if (recentMetrics.length === 0) return summary;

      // Calculate averages and counts
      let totalDuration = 0;
      let cacheHits = 0;
      let cacheTotal = 0;
      let errors = 0;

      recentMetrics.forEach(metric => {
        // Duration metrics
        if (metric.duration) {
          totalDuration += metric.duration;
          
          if (metric.duration > 2000) {
            summary.slowOperations.push({
              operation: metric.operation,
              duration: metric.duration,
              timestamp: metric.timestamp
            });
          }
        }

        // Operation counts
        summary.operationCounts[metric.operation] = 
          (summary.operationCounts[metric.operation] || 0) + 1;

        // Cache metrics
        if (metric.metadata?.cached !== undefined) {
          cacheTotal++;
          if (metric.metadata.cached) cacheHits++;
        }

        // Error metrics
        if (metric.metadata?.error) {
          errors++;
        }
      });

      // Calculate final metrics
      const durationMetrics = recentMetrics.filter(m => m.duration);
      if (durationMetrics.length > 0) {
        summary.averageResponseTime = Math.round(totalDuration / durationMetrics.length);
      }

      if (cacheTotal > 0) {
        summary.cacheHitRate = Math.round((cacheHits / cacheTotal) * 100);
      }

      summary.errorRate = Math.round((errors / recentMetrics.length) * 100);

      return summary;
    } catch (error) {
      console.error('Failed to generate performance summary:', error);
      return null;
    }
  }

  // Clear old metrics
  async clearOldMetrics(days = 7) {
    try {
      const metrics = await this.getStoredMetrics();
      const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
      const recentMetrics = metrics.filter(m => m.timestamp > cutoffTime);
      
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(recentMetrics));
      
      console.log(`Cleared ${metrics.length - recentMetrics.length} old performance metrics`);
    } catch (error) {
      console.error('Failed to clear old metrics:', error);
    }
  }

  // Monitor Firebase query performance
  async monitorFirebaseQuery(queryName, queryFunction, filters = {}) {
    const startTime = this.startTimer(`firebase_${queryName}`);
    
    try {
      const result = await queryFunction();
      
      await this.endTimer(`firebase_${queryName}`, {
        filters,
        resultCount: Array.isArray(result) ? result.length : 1,
        cached: false
      });
      
      return result;
    } catch (error) {
      await this.endTimer(`firebase_${queryName}`, {
        filters,
        error: error.message,
        cached: false
      });
      
      throw error;
    }
  }

  // Monitor cache performance
  async monitorCacheOperation(operationName, cacheFunction, fallbackFunction) {
    const startTime = this.startTimer(`cache_${operationName}`);
    
    try {
      // Try cache first
      const cachedResult = await cacheFunction();
      
      if (cachedResult) {
        await this.endTimer(`cache_${operationName}`, {
          cached: true,
          resultCount: Array.isArray(cachedResult) ? cachedResult.length : 1
        });
        
        return cachedResult;
      }
      
      // Fallback to original function
      const result = await fallbackFunction();
      
      await this.endTimer(`cache_${operationName}`, {
        cached: false,
        resultCount: Array.isArray(result) ? result.length : 1
      });
      
      return result;
    } catch (error) {
      await this.endTimer(`cache_${operationName}`, {
        cached: false,
        error: error.message
      });
      
      throw error;
    }
  }

  // Get real-time performance stats
  getCurrentStats() {
    return {
      activeTimers: Array.from(this.metrics.keys()),
      memoryUsage: this.metrics.size,
      timestamp: Date.now()
    };
  }
}

export default new PerformanceMonitor();