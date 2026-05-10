const mockCloudInitialize = jest.fn();
const mockGetCurrentUserId = jest.fn();
const mockGetCoupleData = jest.fn();
const mockSaveCoupleData = jest.fn();
const mockUpdateCoupleData = jest.fn();

jest.mock('../../services/supabase/SupabaseAuthService', () => ({
  SupabaseAuthService: {
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(),
    signOut: jest.fn(),
  },
}));

jest.mock('../../services/storage/CloudEngine', () => ({
  __esModule: true,
  default: {
    initialize: (...args) => mockCloudInitialize(...args),
    getCurrentUserId: (...args) => mockGetCurrentUserId(...args),
    getCoupleData: (...args) => mockGetCoupleData(...args),
    saveCoupleData: (...args) => mockSaveCoupleData(...args),
    updateCoupleData: (...args) => mockUpdateCoupleData(...args),
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

async function loadReadyRouter() {
  const router = require('../../services/storage/StorageRouter').default;
  mockCloudInitialize.mockResolvedValue(true);
  mockGetCurrentUserId.mockResolvedValue('cloud-user-1');
  await router.initialize({ supabaseSessionPresent: true });
  return router;
}

describe('StorageRouter couple data upsert', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('preserves the first writer when an insert races into a duplicate', async () => {
    const router = await loadReadyRouter();
    mockGetCoupleData.mockResolvedValue(null);
    mockSaveCoupleData.mockRejectedValue(new Error('duplicate key value violates couple_data_couple_id_key_unique'));
    mockUpdateCoupleData.mockResolvedValue(true);

    await expect(router.upsertCoupleData(
      'couple-1',
      'daily_prompt_2026-05-09',
      { promptId: 'prompt-1' },
      'user-1',
      false,
      'couple_state',
      { preserveOnDuplicate: true }
    )).resolves.toBe(true);

    expect(mockUpdateCoupleData).not.toHaveBeenCalled();
  });

  it('keeps legacy upsert behavior when preserveOnDuplicate is not requested', async () => {
    const router = await loadReadyRouter();
    mockGetCoupleData.mockResolvedValue(null);
    mockSaveCoupleData.mockRejectedValue(new Error('duplicate key value violates couple_data_couple_id_key_unique'));
    mockUpdateCoupleData.mockResolvedValue(true);

    await expect(router.upsertCoupleData(
      'couple-1',
      'relationship_start_date',
      { startDate: '2026-01-01' },
      'user-1',
      false,
      'couple_state'
    )).resolves.toBe(true);

    expect(mockUpdateCoupleData).toHaveBeenCalledWith(
      'couple-1',
      'relationship_start_date',
      { startDate: '2026-01-01' }
    );
  });

  it('still updates an existing row before insert when repairing known state', async () => {
    const router = await loadReadyRouter();
    mockGetCoupleData.mockResolvedValue({ id: 'row-1', value: {} });
    mockUpdateCoupleData.mockResolvedValue(true);

    await expect(router.upsertCoupleData(
      'couple-1',
      'daily_prompt_2026-05-09',
      { promptId: 'prompt-2' },
      'user-1',
      false,
      'couple_state',
      { preserveOnDuplicate: true }
    )).resolves.toBe(true);

    expect(mockSaveCoupleData).not.toHaveBeenCalled();
    expect(mockUpdateCoupleData).toHaveBeenCalledWith(
      'couple-1',
      'daily_prompt_2026-05-09',
      { promptId: 'prompt-2' }
    );
  });
});
