describe('LocalStorageService.hydrateRemoteAccount', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    const { sha256 } = require('@noble/hashes/sha2.js');
    sha256.mockReturnValue(new Uint8Array(32).fill(7));
  });

  it('creates a local session for a clean-device remote sign-in', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const SecureStore = require('expo-secure-store');

    AsyncStorage.getItem.mockImplementation(async (key) => {
      if (key === 'email_idx_review@example.com') return null;
      if (key === 'user_remote-user-1') return null;
      return null;
    });
    AsyncStorage.setItem.mockResolvedValue(undefined);

    const LocalStorageService = require('../../services/LocalStorageService').default;

    const result = await LocalStorageService.hydrateRemoteAccount({
      uid: 'remote-user-1',
      email: 'review@example.com',
      password: 'correct horse battery staple',
      displayName: 'Reviewer',
      emailVerified: true,
    });

    expect(result).toEqual({
      user: expect.objectContaining({
        uid: 'remote-user-1',
        email: 'review@example.com',
        displayName: 'Reviewer',
        emailVerified: true,
      }),
    });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('currentUserId', 'remote-user-1');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'user_remote-user-1',
      expect.stringContaining('"email":"review@example.com"')
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'cred_remote-user-1',
      expect.any(String),
      expect.objectContaining({ keychainService: 'betweenus' })
    );
  });

  it('rotates stored credentials when resetting a local password', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const SecureStore = require('expo-secure-store');
    const LocalStorageService = require('../../services/LocalStorageService').default;

    AsyncStorage.getItem.mockImplementation(async (key) => {
      if (key === 'email_idx_review@example.com') return 'remote-user-1';
      if (key === 'user_remote-user-1') {
        return JSON.stringify({
          uid: 'remote-user-1',
          email: 'review@example.com',
          displayName: 'Reviewer',
        });
      }
      return null;
    });
    AsyncStorage.setItem.mockResolvedValue(undefined);

    const updated = await LocalStorageService.updatePasswordForEmail(
      'review@example.com',
      'new horse battery staple'
    );

    expect(updated).toBe(true);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'cred_remote-user-1',
      expect.stringContaining('passwordHash'),
      expect.objectContaining({ keychainService: 'betweenus' })
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'user_remote-user-1',
      expect.stringContaining('"review@example.com"')
    );
  });

  it('restores the current user from SecureStore email state instead of the stale currentUserId key', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const SecureStore = require('expo-secure-store');
    const LocalStorageService = require('../../services/LocalStorageService').default;

    AsyncStorage.getItem.mockImplementation(async (key) => {
      if (key === 'currentUserId') return null;
      return null;
    });
    SecureStore.getItemAsync.mockImplementation(async (key) => {
      if (key === 'currentUserEmail') return 'review@example.com';
      if (key.startsWith('email_uid_')) return 'remote-user-1';
      if (key === 'user_profile_remote-user-1') {
        return JSON.stringify({
          uid: 'remote-user-1',
          email: 'review@example.com',
          displayName: 'Reviewer',
        });
      }
      return null;
    });

    const user = await LocalStorageService.getCurrentUser();

    expect(user).toEqual(
      expect.objectContaining({
        uid: 'remote-user-1',
        email: 'review@example.com',
        displayName: 'Reviewer',
      })
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'user_remote-user-1',
      expect.stringContaining('"review@example.com"')
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('currentUserId', 'remote-user-1');
    expect(SecureStore.getItemAsync).not.toHaveBeenCalledWith(
      'currentUserId',
      expect.objectContaining({ keychainService: 'betweenus' })
    );
  });
});
