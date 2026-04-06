import * as SecureStore from 'expo-secure-store';

const DEFAULT_SERVICE = 'betweenus_secure_cache';
const CHUNK_SIZE = 1900;
const CHUNK_COUNT_SUFFIX = '__chunk_count';

async function clearChunks(fullKey, service) {
  try {
    const chunkCountStr = await SecureStore.getItemAsync(`${fullKey}${CHUNK_COUNT_SUFFIX}`, {
      keychainService: service,
    });
    if (!chunkCountStr) return;

    const chunkCount = parseInt(chunkCountStr, 10);
    for (let i = 0; i < chunkCount; i += 1) {
      await SecureStore.deleteItemAsync(`${fullKey}__chunk_${i}`, {
        keychainService: service,
      });
    }
    await SecureStore.deleteItemAsync(`${fullKey}${CHUNK_COUNT_SUFFIX}`, {
      keychainService: service,
    });
  } catch {
    // Best-effort cleanup.
  }
}

const SecureCacheStore = {
  async getString(key, { service = DEFAULT_SERVICE } = {}) {
    const fullKey = String(key);

    try {
      const chunkCountStr = await SecureStore.getItemAsync(`${fullKey}${CHUNK_COUNT_SUFFIX}`, {
        keychainService: service,
      });

      if (chunkCountStr) {
        const chunkCount = parseInt(chunkCountStr, 10);
        const chunks = [];
        for (let i = 0; i < chunkCount; i += 1) {
          const chunk = await SecureStore.getItemAsync(`${fullKey}__chunk_${i}`, {
            keychainService: service,
          });
          if (chunk == null) return null;
          chunks.push(chunk);
        }
        return chunks.join('');
      }

      return await SecureStore.getItemAsync(fullKey, { keychainService: service });
    } catch {
      return null;
    }
  },

  async setString(key, value, { service = DEFAULT_SERVICE } = {}) {
    const fullKey = String(key);
    const stringValue = String(value);

    await clearChunks(fullKey, service);
    await SecureStore.deleteItemAsync(fullKey, { keychainService: service }).catch(() => {});

    if (stringValue.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(fullKey, stringValue, { keychainService: service });
      return;
    }

    const chunks = [];
    for (let i = 0; i < stringValue.length; i += CHUNK_SIZE) {
      chunks.push(stringValue.slice(i, i + CHUNK_SIZE));
    }

    await SecureStore.setItemAsync(`${fullKey}${CHUNK_COUNT_SUFFIX}`, String(chunks.length), {
      keychainService: service,
    });

    for (let i = 0; i < chunks.length; i += 1) {
      await SecureStore.setItemAsync(`${fullKey}__chunk_${i}`, chunks[i], {
        keychainService: service,
      });
    }
  },

  async removeItem(key, { service = DEFAULT_SERVICE } = {}) {
    const fullKey = String(key);
    await clearChunks(fullKey, service);
    await SecureStore.deleteItemAsync(fullKey, { keychainService: service }).catch(() => {});
  },

  async getJson(key, defaultValue = null, { service = DEFAULT_SERVICE } = {}) {
    const raw = await this.getString(key, { service });
    if (!raw) return defaultValue;
    try {
      return JSON.parse(raw);
    } catch {
      return defaultValue;
    }
  },

  async setJson(key, value, { service = DEFAULT_SERVICE } = {}) {
    await this.setString(key, JSON.stringify(value), { service });
  },
};

export default SecureCacheStore;