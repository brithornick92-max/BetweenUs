const mockSetNotificationHandler = jest.fn();
const mockGetPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
const mockRequestPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
const mockGetExpoPushTokenAsync = jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test]' });

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
    expect(upsert).toHaveBeenCalled();
  });

  it('does not prompt on silent initialization when permissions are not granted', async () => {
    mockGetPermissionsAsync.mockResolvedValueOnce({ status: 'undetermined' });
    const supabase = {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn(),
    };

    const token = await PushNotificationService.initialize(supabase, { requestPermissions: false });

    expect(token).toBeNull();
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
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