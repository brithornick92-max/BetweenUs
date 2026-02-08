// utils/promptCache.js
import AsyncStorage from '@react-native-async-storage/async-storage';

class PromptCache {
  constructor() {
    this.memoryCache = new Map();
    this.CACHE_KEYS = {
      PROMPTS_BY_STAGE: 'prompts_by_stage_',
      PROMPTS_BY_HEAT: 'prompts_by_heat_',
      LAST_UPDATED: 'cache_last_updated',
      USER_PREFERENCES: 'user_preferences_cache'
    };
    this.CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  }

  // Generate cache key based on filters
  generateCacheKey(filters) {
    const { heatLevel, relationshipDuration } = filters;
    return `${heatLevel || 'all'}_${relationshipDuration || 'all'}`;
  }

  // Check if cache is valid
  async isCacheValid(key) {
    try {
      const lastUpdated = await AsyncStorage.getItem(`${key}_timestamp`);
      if (!lastUpdated) return false;
      
      const age = Date.now() - parseInt(lastUpdated);
      return age < this.CACHE_DURATION;
    } catch (error) {
      console.error('Cache validation error:', error);
      return false;
    }
  }

  // Get cached prompts
  async getCachedPrompts(filters) {
    try {
      const cacheKey = this.generateCacheKey(filters);
      
      // Check memory cache first (fastest)
      if (this.memoryCache.has(cacheKey)) {
        const cached = this.memoryCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.CACHE_DURATION) {
          return cached.data;
        } else {
          this.memoryCache.delete(cacheKey);
        }
      }

      // Check persistent cache
      const isValid = await this.isCacheValid(cacheKey);
      if (!isValid) return null;

      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (cachedData) {
        const prompts = JSON.parse(cachedData);
        
        // Store in memory cache for faster access
        this.memoryCache.set(cacheKey, {
          data: prompts,
          timestamp: Date.now()
        });
        
        return prompts;
      }
      
      return null;
    } catch (error) {
      console.error('Cache retrieval error:', error);
      return null;
    }
  }

  // Cache prompts
  async cachePrompts(filters, prompts) {
    try {
      const cacheKey = this.generateCacheKey(filters);
      const timestamp = Date.now();
      
      // Store in memory cache
      this.memoryCache.set(cacheKey, {
        data: prompts,
        timestamp
      });
      
      // Store in persistent cache
      await Promise.all([
        AsyncStorage.setItem(cacheKey, JSON.stringify(prompts)),
        AsyncStorage.setItem(`${cacheKey}_timestamp`, timestamp.toString())
      ]);
      
      console.log(`Cached ${prompts.length} prompts for key: ${cacheKey}`);
    } catch (error) {
      console.error('Cache storage error:', error);
    }
  }

  // Preload common prompt combinations
  async preloadCommonPrompts(userPreferences) {
    try {
      const { relationshipDuration } = userPreferences;
      
      // Common combinations to preload
      const commonFilters = [
        { heatLevel: 1, relationshipDuration },
        { heatLevel: 2, relationshipDuration },
        { heatLevel: 3, relationshipDuration },
        { relationshipDuration }, // All heat levels
      ];

      // Only preload if not already cached
      for (const filters of commonFilters) {
        const cached = await this.getCachedPrompts(filters);
        if (!cached) {
          // This would trigger a background fetch and cache
          console.log('Preload needed for:', this.generateCacheKey(filters));
        }
      }
    } catch (error) {
      console.error('Preload error:', error);
    }
  }

  // Clear expired cache entries
  async clearExpiredCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => 
        key.includes(this.CACHE_KEYS.PROMPTS_BY_STAGE) || 
        key.includes(this.CACHE_KEYS.PROMPTS_BY_HEAT)
      );

      const expiredKeys = [];
      for (const key of cacheKeys) {
        const isValid = await this.isCacheValid(key);
        if (!isValid) {
          expiredKeys.push(key, `${key}_timestamp`);
        }
      }

      if (expiredKeys.length > 0) {
        await AsyncStorage.multiRemove(expiredKeys);
        console.log(`Cleared ${expiredKeys.length} expired cache entries`);
      }
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }

  // Get cache statistics
  async getCacheStats() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => 
        key.includes(this.CACHE_KEYS.PROMPTS_BY_STAGE) || 
        key.includes(this.CACHE_KEYS.PROMPTS_BY_HEAT)
      );

      let totalSize = 0;
      let validEntries = 0;
      let expiredEntries = 0;

      for (const key of cacheKeys) {
        if (key.includes('_timestamp')) continue;
        
        const data = await AsyncStorage.getItem(key);
        if (data) {
          totalSize += data.length;
          const isValid = await this.isCacheValid(key);
          if (isValid) {
            validEntries++;
          } else {
            expiredEntries++;
          }
        }
      }

      return {
        totalEntries: cacheKeys.length / 2, // Divide by 2 because of timestamp keys
        validEntries,
        expiredEntries,
        totalSizeKB: Math.round(totalSize / 1024),
        memoryCacheSize: this.memoryCache.size
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return null;
    }
  }

  // Clear all cache
  async clearAllCache() {
    try {
      this.memoryCache.clear();
      
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => 
        key.includes(this.CACHE_KEYS.PROMPTS_BY_STAGE) || 
        key.includes(this.CACHE_KEYS.PROMPTS_BY_HEAT) ||
        key.includes(this.CACHE_KEYS.USER_PREFERENCES)
      );

      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
        console.log(`Cleared all cache: ${cacheKeys.length} entries`);
      }
    } catch (error) {
      console.error('Clear cache error:', error);
    }
  }
}

export default new PromptCache();