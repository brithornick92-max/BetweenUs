import * as SecureStore from 'expo-secure-store';

function reportError(error, context) {
  import('../services/CrashReporting')
    .then(m => m.default.captureException(error, { source: `encryptedStorage.${context}` }))
    .catch(() => {});
}

export const encryptedStorage = {
  async get(key, defaultValue = null) {
    try {
      const value = await SecureStore.getItemAsync(key);
      return value ? JSON.parse(value) : defaultValue;
    } catch (error) {
      reportError(error, `get(${key})`);
      return defaultValue;
    }
  },

  async set(key, value) {
    try {
      await SecureStore.setItemAsync(key, JSON.stringify(value));
      return true;
    } catch (error) {
      reportError(error, `set(${key})`);
      return false;
    }
  },

  async remove(key) {
    try {
      await SecureStore.removeItemAsync(key);
      return true;
    } catch (error) {
      reportError(error, `remove(${key})`);
      return false;
    }
  },
};
