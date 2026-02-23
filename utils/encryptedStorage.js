import * as SecureStore from 'expo-secure-store';

export const encryptedStorage = {
  async get(key, defaultValue = null) {
    try {
      const value = await SecureStore.getItemAsync(key);
      return value ? JSON.parse(value) : defaultValue;
    } catch (error) {
      return defaultValue;
    }
  },

  async set(key, value) {
    try {
      await SecureStore.setItemAsync(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  },

  async remove(key) {
    try {
      await SecureStore.removeItemAsync(key);
      return true;
    } catch (error) {
      return false;
    }
  },
};
