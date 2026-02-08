// services/supabase/SecureSupabaseStorage.js
// ✅ SecureStore-backed storage adapter for Supabase auth
// ✅ Prevents sensitive session tokens from being stored in AsyncStorage
// ✅ Handles values exceeding SecureStore's 2048-byte limit by chunking

import * as SecureStore from "expo-secure-store";

const KEY_PREFIX = "supabase_auth_";
const SERVICE = "betweenus_supabase";
const CHUNK_SIZE = 2000; // Stay safely below 2048 limit
const CHUNK_COUNT_SUFFIX = "__chunk_count";

export const SecureSupabaseStorage = {
  async getItem(key) {
    const fullKey = KEY_PREFIX + key;
    try {
      // Check if this value was chunked
      const chunkCountStr = await SecureStore.getItemAsync(fullKey + CHUNK_COUNT_SUFFIX, { keychainService: SERVICE });
      
      if (chunkCountStr) {
        // Reassemble chunked value
        const chunkCount = parseInt(chunkCountStr, 10);
        const chunks = [];
        for (let i = 0; i < chunkCount; i++) {
          const chunk = await SecureStore.getItemAsync(`${fullKey}__chunk_${i}`, { keychainService: SERVICE });
          if (chunk === null) return null; // Corrupted chunks
          chunks.push(chunk);
        }
        return chunks.join('');
      }
      
      // Standard single-key read
      return await SecureStore.getItemAsync(fullKey, { keychainService: SERVICE });
    } catch (error) {
      console.error('SecureSupabaseStorage.getItem error:', error);
      return null;
    }
  },
  async setItem(key, value) {
    const fullKey = KEY_PREFIX + key;
    try {
      // Clean up any previous chunks for this key
      await this._clearChunks(fullKey);

      if (value.length <= CHUNK_SIZE) {
        // Fits in a single SecureStore entry
        await SecureStore.setItemAsync(fullKey, value, { keychainService: SERVICE });
      } else {
        // Value too large — split into chunks
        const chunks = [];
        for (let i = 0; i < value.length; i += CHUNK_SIZE) {
          chunks.push(value.substring(i, i + CHUNK_SIZE));
        }
        // Store chunk count
        await SecureStore.setItemAsync(fullKey + CHUNK_COUNT_SUFFIX, String(chunks.length), { keychainService: SERVICE });
        // Store each chunk
        for (let i = 0; i < chunks.length; i++) {
          await SecureStore.setItemAsync(`${fullKey}__chunk_${i}`, chunks[i], { keychainService: SERVICE });
        }
      }
    } catch (error) {
      console.error('SecureSupabaseStorage.setItem error:', error);
      // Don't throw — Supabase will still work in-memory for this session
    }
  },
  async removeItem(key) {
    const fullKey = KEY_PREFIX + key;
    try {
      await this._clearChunks(fullKey);
      await SecureStore.deleteItemAsync(fullKey, { keychainService: SERVICE });
    } catch (error) {
      console.error('SecureSupabaseStorage.removeItem error:', error);
    }
  },
  async _clearChunks(fullKey) {
    try {
      const chunkCountStr = await SecureStore.getItemAsync(fullKey + CHUNK_COUNT_SUFFIX, { keychainService: SERVICE });
      if (chunkCountStr) {
        const chunkCount = parseInt(chunkCountStr, 10);
        for (let i = 0; i < chunkCount; i++) {
          await SecureStore.deleteItemAsync(`${fullKey}__chunk_${i}`, { keychainService: SERVICE });
        }
        await SecureStore.deleteItemAsync(fullKey + CHUNK_COUNT_SUFFIX, { keychainService: SERVICE });
      }
    } catch (error) {
      // Best-effort cleanup
    }
  },
};

export default SecureSupabaseStorage;
