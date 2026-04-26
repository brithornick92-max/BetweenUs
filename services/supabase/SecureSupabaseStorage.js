// services/supabase/SecureSupabaseStorage.js
// ✅ SecureStore-backed storage adapter for Supabase auth
// ✅ Prevents sensitive session tokens from being stored in AsyncStorage
// ✅ Handles values exceeding SecureStore's 2048-byte limit by chunking
// ✅ Safely handles temporary iOS keychain access errors during app startup/background restore

import * as SecureStore from "expo-secure-store";

const KEY_PREFIX = "supabase_auth_";
const SERVICE = "betweenus_supabase";
const CHUNK_SIZE = 2000; // Stay safely below 2048 limit
const CHUNK_COUNT_SUFFIX = "__chunk_count";

function getErrorMessage(error) {
  return String(error?.message || error || "");
}

function isTemporaryKeychainAccessError(error) {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes("user interaction is not allowed")
    || message.includes("interaction is not allowed")
    || message.includes("errsecinteractionnotallowed")
  );
}

function warnSecureStoreIssue(method, key, error) {
  if (!__DEV__) return;

  const message = getErrorMessage(error);

  if (isTemporaryKeychainAccessError(error)) {
    console.warn(
      `[SecureSupabaseStorage.${method}] SecureStore temporarily unavailable for key "${key}". Returning null and allowing Supabase to recover. ${message}`
    );
    return;
  }

  console.warn(`[SecureSupabaseStorage.${method}] failed for key "${key}":`, error);
}

export const SecureSupabaseStorage = {
  async getItem(key) {
    const fullKey = KEY_PREFIX + key;

    try {
      const chunkCountStr = await SecureStore.getItemAsync(
        fullKey + CHUNK_COUNT_SUFFIX,
        { keychainService: SERVICE }
      );

      if (chunkCountStr) {
        const chunkCount = parseInt(chunkCountStr, 10);

        if (!Number.isFinite(chunkCount) || chunkCount <= 0) {
          await this._clearChunks(fullKey);
          return null;
        }

        const chunks = [];

        for (let i = 0; i < chunkCount; i += 1) {
          const chunk = await SecureStore.getItemAsync(
            `${fullKey}__chunk_${i}`,
            { keychainService: SERVICE }
          );

          if (chunk === null) {
            await this._clearChunks(fullKey);
            return null;
          }

          chunks.push(chunk);
        }

        return chunks.join("");
      }

      return await SecureStore.getItemAsync(fullKey, { keychainService: SERVICE });
    } catch (error) {
      warnSecureStoreIssue("getItem", key, error);
      return null;
    }
  },

  async setItem(key, value) {
    const fullKey = KEY_PREFIX + key;

    try {
      const stringValue = String(value);

      await this._clearChunks(fullKey);

      if (stringValue.length <= CHUNK_SIZE) {
        await SecureStore.setItemAsync(fullKey, stringValue, {
          keychainService: SERVICE,
        });
        return;
      }

      await SecureStore.deleteItemAsync(fullKey, { keychainService: SERVICE });

      const chunks = [];

      for (let i = 0; i < stringValue.length; i += CHUNK_SIZE) {
        chunks.push(stringValue.substring(i, i + CHUNK_SIZE));
      }

      await SecureStore.setItemAsync(
        fullKey + CHUNK_COUNT_SUFFIX,
        String(chunks.length),
        { keychainService: SERVICE }
      );

      for (let i = 0; i < chunks.length; i += 1) {
        await SecureStore.setItemAsync(
          `${fullKey}__chunk_${i}`,
          chunks[i],
          { keychainService: SERVICE }
        );
      }
    } catch (error) {
      warnSecureStoreIssue("setItem", key, error);
      // Do not throw — Supabase can still work in-memory for this session.
    }
  },

  async removeItem(key) {
    const fullKey = KEY_PREFIX + key;

    try {
      await this._clearChunks(fullKey);
      await SecureStore.deleteItemAsync(fullKey, { keychainService: SERVICE });
    } catch (error) {
      warnSecureStoreIssue("removeItem", key, error);
    }
  },

  async _clearChunks(fullKey) {
    try {
      const chunkCountStr = await SecureStore.getItemAsync(
        fullKey + CHUNK_COUNT_SUFFIX,
        { keychainService: SERVICE }
      );

      if (!chunkCountStr) return;

      const chunkCount = parseInt(chunkCountStr, 10);

      if (Number.isFinite(chunkCount) && chunkCount > 0) {
        for (let i = 0; i < chunkCount; i += 1) {
          await SecureStore.deleteItemAsync(
            `${fullKey}__chunk_${i}`,
            { keychainService: SERVICE }
          );
        }
      }

      await SecureStore.deleteItemAsync(
        fullKey + CHUNK_COUNT_SUFFIX,
        { keychainService: SERVICE }
      );
    } catch {
      // Best-effort cleanup only.
    }
  },
};

export default SecureSupabaseStorage;
