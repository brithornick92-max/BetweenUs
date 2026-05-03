const mockSetNotificationHandler = jest.fn();
const mockGetPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
const mockRequestPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
const mockGetExpoPushTokenAsync = jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test]' });
const AsyncStorage = require('@react-native-async-storage/async-storage');

jest.mock('expo-notifications', () => ({
  setNotificationHandler: mockSetNotificationHandler,
  getPermissionsAsync: mockGetPermissionsAsync,
  requestPermissionsAsync: mockRequestPermissionsAsync,
  getExpoPushTokenAsync: mockGetExpoPushTokenAsync,
}));

jest.mock('expo-device', () => ({
  isDevice: true,
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      eas: {
        projectId: 'test-project-id',
      },
    },
  },
}));

const PushNotificationService = require('../../services/PushNotificationService').default;

describe('PushNotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    PushNotificationService._token = null;
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue(undefined);
    AsyncStorage.removeItem.mockResolvedValue(undefined);
  });

  it('registers a token and saves it to Supabase', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null });
    const supabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: jest.fn(() => ({ upsert })),
    };

    const token = await PushNotificationService.initialize(supabase);

    expect(token).toBe('ExponentPushToken[test]');
    expect(mockSetNotificationHandler).toHaveBeenCalledWith({
      handleNotification: expect.any(Function),
    });
    await expect(
      mockSetNotificationHandler.mock.calls[0][0].handleNotification()
    ).resolves.toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    });
    expect(upsert).toHaveBeenCalled();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      PushNotificationService._cacheKey,
      'ExponentPushToken[test]'
    );
  });

  it('does not prompt on silent initialization when permissions are not granted', async () => {
    mockGetPermissionsAsync.mockResolvedValueOnce({ status: 'undetermined' });
    const eq = jest.fn().mockResolvedValue({ error: null });
    const del = jest.fn(() => ({ eq: jest.fn(() => ({ eq })) }));
    const supabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: jest.fn(() => ({ delete: del })),
    };
    PushNotificationService._token = 'ExponentPushToken[test]';

    const token = await PushNotificationService.initialize(supabase, { requestPermissions: false });

    expect(token).toBeNull();
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith('token', 'ExponentPushToken[test]');
  });

  it('prompts when interactive initialization is requested', async () => {
    mockGetPermissionsAsync.mockResolvedValueOnce({ status: 'undetermined' });
    const upsert = jest.fn().mockResolvedValue({ error: null });
    const supabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: jest.fn(() => ({ upsert })),
    };

    const token = await PushNotificationService.initialize(supabase, { requestPermissions: true });

    expect(token).toBe('ExponentPushToken[test]');
    expect(mockRequestPermissionsAsync).toHaveBeenCalled();
  });

  it('does not clear the current token when token removal fails', async () => {
    const eq = jest.fn().mockResolvedValue({ error: new Error('delete failed') });
    const del = jest.fn(() => ({ eq: jest.fn(() => ({ eq })) }));
    const supabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: jest.fn(() => ({ delete: del })),
    };

    PushNotificationService._token = 'ExponentPushToken[test]';
    await PushNotificationService.removeToken(supabase);

    expect(PushNotificationService.getToken()).toBe('ExponentPushToken[test]');
  });

  it('removes a cached token even when the in-memory token is empty', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce('ExponentPushToken[cached]');
    const eqToken = jest.fn().mockResolvedValue({ error: null });
    const eqUser = jest.fn(() => ({ eq: eqToken }));
    const del = jest.fn(() => ({ eq: eqUser }));
    const supabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: jest.fn(() => ({ delete: del })),
    };

    await PushNotificationService.removeToken(supabase);

    expect(eqUser).toHaveBeenCalledWith('user_id', 'user-1');
    expect(eqToken).toHaveBeenCalledWith('token', 'ExponentPushToken[cached]');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(PushNotificationService._cacheKey);
  });

  it('calls the partner notification RPC', async () => {
    const rpc = jest.fn().mockResolvedValue({ error: null });
    const supabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      rpc,
    };

    await PushNotificationService.notifyPartner(supabase, {
      title: 'Hello',
      body: 'World',
      data: { route: 'vibe' },
    });

    expect(rpc).toHaveBeenCalledWith('notify_partner', {
      sender_id: 'user-1',
      notification_title: 'Hello',
      notification_body: 'World',
      notification_data: { route: 'vibe' },
    });
  });
});
