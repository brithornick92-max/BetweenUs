const INSTALL_MARKER_KEY = '@betweenus:cache:installMarker';
const AUTH_STORAGE_KEY = 'sb-test-auth-token';

function loadSupabaseAuthStorage({
  installMarker = null,
  existingKeys = [],
  markerReadError = null,
} = {}) {
  jest.resetModules();
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

  const AsyncStorage = require('@react-native-async-storage/async-storage');
  const SecureStore = require('expo-secure-store');
  const { createClient } = require('@supabase/supabase-js');

  AsyncStorage.getItem.mockReset();
  AsyncStorage.setItem.mockReset();
  AsyncStorage.removeItem.mockReset();
  AsyncStorage.getAllKeys.mockReset();
  SecureStore.getItemAsync.mockReset();
  SecureStore.setItemAsync.mockReset();
  SecureStore.deleteItemAsync.mockReset();
  createClient.mockClear();

  AsyncStorage.getItem.mockImplementation(async (key) => {
    if (markerReadError && key === INSTALL_MARKER_KEY) throw markerReadError;
    if (key === INSTALL_MARKER_KEY) return installMarker;
    return null;
  });
  AsyncStorage.setItem.mockResolvedValue(undefined);
  AsyncStorage.removeItem.mockResolvedValue(undefined);
  AsyncStorage.getAllKeys.mockResolvedValue(existingKeys);
  SecureStore.getItemAsync.mockResolvedValue(null);
  SecureStore.setItemAsync.mockResolvedValue(undefined);
  SecureStore.deleteItemAsync.mockResolvedValue(undefined);

  require('../../config/supabase');

  return {
    AsyncStorage,
    SecureStore,
    storage: createClient.mock.calls[0][2].auth.storage,
  };
}

describe('Supabase auth storage reinstall handling', () => {
  const originalEnv = {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  };

  afterEach(() => {
    if (originalEnv.EXPO_PUBLIC_SUPABASE_URL === undefined) {
      delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    } else {
      process.env.EXPO_PUBLIC_SUPABASE_URL = originalEnv.EXPO_PUBLIC_SUPABASE_URL;
    }

    if (originalEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY === undefined) {
      delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    }
  });

  it('clears surviving SecureStore auth on a fresh reinstall', async () => {
    const { AsyncStorage, SecureStore, storage } = loadSupabaseAuthStorage();

    SecureStore.getItemAsync.mockResolvedValueOnce('secure-session');

    await expect(storage.getItem(AUTH_STORAGE_KEY)).resolves.toBeNull();

    expect(AsyncStorage.getItem).toHaveBeenCalledWith(INSTALL_MARKER_KEY);
    expect(AsyncStorage.getAllKeys).toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(AUTH_STORAGE_KEY);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY);
    expect(SecureStore.getItemAsync).not.toHaveBeenCalledWith(AUTH_STORAGE_KEY);
  });

  it('keeps auth through an app update when existing app cache is present', async () => {
    const { AsyncStorage, SecureStore, storage } = loadSupabaseAuthStorage({
      existingKeys: ['@betweenus:cache:userProfile'],
    });

    SecureStore.getItemAsync.mockResolvedValueOnce('secure-session');

    await expect(storage.getItem(AUTH_STORAGE_KEY)).resolves.toBe('secure-session');

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(INSTALL_MARKER_KEY, expect.any(String));
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith(AUTH_STORAGE_KEY);
  });

  it('keeps auth when the install marker already exists', async () => {
    const { AsyncStorage, SecureStore, storage } = loadSupabaseAuthStorage({
      installMarker: '{"createdAt":1}',
    });
    SecureStore.getItemAsync.mockResolvedValueOnce('secure-session');

    await expect(storage.getItem(AUTH_STORAGE_KEY)).resolves.toBe('secure-session');

    expect(AsyncStorage.getAllKeys).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith(AUTH_STORAGE_KEY);
  });

  it('fails closed if install marker state cannot be read', async () => {
    const { SecureStore, storage } = loadSupabaseAuthStorage({
      markerReadError: new Error('storage unavailable'),
    });
    SecureStore.getItemAsync.mockResolvedValueOnce('secure-session');

    await expect(storage.getItem(AUTH_STORAGE_KEY)).resolves.toBeNull();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(AUTH_STORAGE_KEY);
    expect(SecureStore.getItemAsync).not.toHaveBeenCalledWith(AUTH_STORAGE_KEY);
  });

  it('migrates legacy AsyncStorage auth only after install presence is known', async () => {
    const { AsyncStorage, SecureStore, storage } = loadSupabaseAuthStorage({
      installMarker: '{"createdAt":1}',
    });

    AsyncStorage.getItem.mockImplementation(async (key) => {
      if (key === INSTALL_MARKER_KEY) return '{"createdAt":1}';
      if (key === AUTH_STORAGE_KEY) return 'legacy-session';
      return null;
    });

    await expect(storage.getItem(AUTH_STORAGE_KEY)).resolves.toBe('legacy-session');

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(AUTH_STORAGE_KEY, 'legacy-session');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY);
  });

  it('uses the module-load install snapshot even if app cache appears before auth read', async () => {
    const { AsyncStorage, SecureStore, storage } = loadSupabaseAuthStorage();

    await new Promise((resolve) => setTimeout(resolve, 0));
    AsyncStorage.getAllKeys.mockResolvedValueOnce(['@betweenus:cache:userId']);
    SecureStore.getItemAsync.mockResolvedValueOnce('secure-session');

    await expect(storage.getItem(AUTH_STORAGE_KEY)).resolves.toBeNull();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(AUTH_STORAGE_KEY);
    expect(SecureStore.getItemAsync).not.toHaveBeenCalledWith(AUTH_STORAGE_KEY);
  });
});
