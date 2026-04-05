describe('LocalStorageService.hydrateRemoteAccount', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
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
});