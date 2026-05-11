const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockCloudInitialize = jest.fn();

jest.mock('../../services/supabase/SupabaseAuthService', () => ({
  SupabaseAuthService: {
    getSession: (...args) => mockGetSession(...args),
    onAuthStateChange: (...args) => mockOnAuthStateChange(...args),
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    signOut: jest.fn(),
  },
}));

jest.mock('../../services/storage/CloudEngine', () => ({
  __esModule: true,
  default: {
    initialize: (...args) => mockCloudInitialize(...args),
  },
}));

jest.mock('../../services/supabase/CoupleService', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../utils/storage', () => ({
  cloudSyncStorage: {
    getSyncStatus: jest.fn().mockResolvedValue({}),
    setSyncStatus: jest.fn().mockResolvedValue(true),
    getSyncQueue: jest.fn().mockResolvedValue([]),
    setSyncQueue: jest.fn().mockResolvedValue(true),
    addToSyncQueue: jest.fn().mockResolvedValue(true),
    removeFromSyncQueue: jest.fn().mockResolvedValue(true),
    setLastSyncTime: jest.fn().mockResolvedValue(true),
  },
  makeId: jest.fn(() => 'mock-id'),
  storage: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
    remove: jest.fn().mockResolvedValue(true),
    clearSession: jest.fn().mockResolvedValue(true),
  },
  STORAGE_KEYS: {
    COUPLE_ID: 'couple_id',
    USER_PROFILE: 'user_profile',
    USER_ID: 'user_id',
  },
}));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('StorageRouter auth state bootstrap', () => {
  beforeEach(() => {
    jest.resetModules();
    mockGetSession.mockReset();
    mockOnAuthStateChange.mockReset();
    mockCloudInitialize.mockReset();
    mockCloudInitialize.mockResolvedValue(true);
  });

  it('uses the initial session lookup when auth state is still unresolved', async () => {
    const session = {
      user: {
        id: 'user-1',
        email: 'alex@example.com',
        created_at: '2026-05-05T18:42:00.000Z',
        user_metadata: { display_name: 'Alex' },
      },
    };
    mockGetSession.mockResolvedValueOnce(session);
    mockOnAuthStateChange.mockReturnValue({ unsubscribe: jest.fn() });

    const router = require('../../services/storage/StorageRouter').default;
    const callback = jest.fn();

    router.onAuthStateChanged(callback);
    await flush();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      uid: 'user-1',
      email: 'alex@example.com',
      displayName: 'Alex',
      createdAt: '2026-05-05T18:42:00.000Z',
    }));
  });

  it('notifies listeners when Supabase emits a null session', async () => {
    const session = {
      user: {
        id: 'user-1',
        email: 'alex@example.com',
        user_metadata: { display_name: 'Alex' },
      },
    };
    let authStateCallback;

    mockGetSession.mockResolvedValueOnce(session);
    mockOnAuthStateChange.mockImplementation((callback) => {
      authStateCallback = callback;
      return { unsubscribe: jest.fn() };
    });

    const router = require('../../services/storage/StorageRouter').default;
    const callback = jest.fn();

    router.onAuthStateChanged(callback);
    await flush();

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      uid: 'user-1',
      email: 'alex@example.com',
    }));

    authStateCallback(null);
    await flush();

    expect(callback).toHaveBeenLastCalledWith(null);
  });

  it('ignores a stale initial session result after a newer sign-in event wins the race', async () => {
    const initialLookup = deferred();
    mockGetSession.mockReturnValueOnce(initialLookup.promise);
    mockOnAuthStateChange.mockReturnValue({ unsubscribe: jest.fn() });

    const router = require('../../services/storage/StorageRouter').default;
    const callback = jest.fn();

    router.onAuthStateChanged(callback);
    await flush();

    await router.setSupabaseSession({
      user: {
        id: 'user-2',
        email: 'jamie@example.com',
        user_metadata: { display_name: 'Jamie' },
      },
    });

    initialLookup.resolve(null);
    await flush();

    expect(callback.mock.calls).toEqual([
      [expect.objectContaining({
        uid: 'user-2',
        email: 'jamie@example.com',
        displayName: 'Jamie',
      })],
    ]);
  });
});
