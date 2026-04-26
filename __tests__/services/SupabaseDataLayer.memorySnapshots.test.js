// __tests__/services/SupabaseDataLayer.memorySnapshots.test.js

const mockInsert = jest.fn();
const mockSelect = jest.fn();
const mockSingle = jest.fn();
const mockStorageGet = jest.fn();
const mockStorageSet = jest.fn();
const mockMemorySaved = jest.fn(() => Promise.resolve());

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'mem-test-id-123'),
}));

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64',
  },
}));

jest.mock('../../utils/storage', () => ({
  STORAGE_KEYS: {
    CLOUD_SYNC_QUEUE: '@betweenus:cloudSyncQueue',
  },
  storage: {
    get: (...args) => mockStorageGet(...args),
    set: (...args) => mockStorageSet(...args),
  },
}));

jest.mock('../../services/PartnerNotifications', () => ({
  memorySaved: (...args) => mockMemorySaved(...args),
}));

jest.mock('../../utils/contentLoader', () => ({
  getPromptById: jest.fn(() => null),
}));

jest.mock('../../config/supabase', () => ({
  TABLES: {
    COUPLE_DATA: 'couple_data',
    CALENDAR_EVENTS: 'calendar_events',
  },
  supabase: {
    from: jest.fn((tableName) => {
      if (tableName !== 'couple_data') {
        throw new Error(`Unexpected table: ${tableName}`);
      }

      return {
        insert: mockInsert,
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(),
            })),
          })),
        })),
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              or: jest.fn(() => ({
                order: jest.fn(() => ({
                  range: jest.fn(() => Promise.resolve({ data: [], error: null })),
                })),
              })),
            })),
          })),
        })),
      };
    }),
    storage: {
      from: jest.fn(() => ({
        createSignedUrl: jest.fn(() => Promise.resolve({
          data: { signedUrl: 'https://example.com/signed-media-url' },
          error: null,
        })),
        upload: jest.fn(() => Promise.resolve({ error: null })),
        remove: jest.fn(() => Promise.resolve({ error: null })),
      })),
    },
  },
}));

describe('SupabaseDataLayer memory snapshots', () => {
  let SupabaseDataLayer;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStorageGet.mockResolvedValue([]);
    mockStorageSet.mockResolvedValue(undefined);

    mockSingle.mockImplementation(() => {
      const insertedPayload = mockInsert.mock.calls.at(-1)?.[0];

      return Promise.resolve({
        data: {
          ...insertedPayload,
          created_at: insertedPayload.created_at || '2026-04-26T09:15:55.806Z',
          updated_at: insertedPayload.updated_at || '2026-04-26T09:15:55.806Z',
        },
        error: null,
      });
    });

    mockSelect.mockReturnValue({
      single: mockSingle,
    });

    mockInsert.mockReturnValue({
      select: mockSelect,
    });

    SupabaseDataLayer = require('../../services/data/SupabaseDataLayer').default;
  });

  it('saves grouped Snapshot metadata into Supabase couple_data.value', async () => {
    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: 'couple-1',
      isPremium: true,
    });

    const saved = await SupabaseDataLayer.saveMemory({
      content: 'Let’s see',
      type: 'snapshot',
      mood: null,
      isPrivate: false,
      snapshot_id: 'snapshot_test_123',
      snapshot_index: 1,
      snapshot_count: 2,
      snapshot_created_at: '2026-04-26T09:15:55.806Z',
      notifyPartner: false,
    });

    expect(mockInsert).toHaveBeenCalledTimes(1);

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'mem-test-id-123',
      couple_id: 'couple-1',
      key: 'mem-test-id-123',
      data_type: 'memory',
      created_by: 'user-1',
      is_private: false,
      value: expect.objectContaining({
        content: 'Let’s see',
        type: 'snapshot',
        mood: null,
        snapshot_id: 'snapshot_test_123',
        snapshot_index: 1,
        snapshot_count: 2,
        snapshot_created_at: '2026-04-26T09:15:55.806Z',
      }),
    }));

    expect(saved).toEqual(expect.objectContaining({
      id: 'mem-test-id-123',
      user_id: 'user-1',
      couple_id: 'couple-1',
      type: 'snapshot',
      content: 'Let’s see',
      snapshot_id: 'snapshot_test_123',
      snapshot_index: 1,
      snapshot_count: 2,
      snapshot_created_at: '2026-04-26T09:15:55.806Z',
    }));

    expect(mockMemorySaved).not.toHaveBeenCalled();
  });

  it('sends one partner notification only when notifyPartner is true', async () => {
    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: 'couple-1',
      isPremium: true,
    });

    await SupabaseDataLayer.saveMemory({
      content: 'Final item saved',
      type: 'snapshot',
      snapshot_id: 'snapshot_notify_once',
      snapshot_index: 1,
      snapshot_count: 2,
      snapshot_created_at: '2026-04-26T09:15:55.806Z',
      notifyPartner: true,
    });

    expect(mockMemorySaved).toHaveBeenCalledTimes(1);
    expect(mockMemorySaved).toHaveBeenCalledWith(null, 'snapshot');
  });

  it('does not notify partner when notifyPartner is false', async () => {
    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: 'couple-1',
      isPremium: true,
    });

    await SupabaseDataLayer.saveMemory({
      content: 'Intermediate media item',
      type: 'snapshot',
      snapshot_id: 'snapshot_no_notify',
      snapshot_index: 0,
      snapshot_count: 2,
      snapshot_created_at: '2026-04-26T09:15:55.806Z',
      notifyPartner: false,
    });

    expect(mockMemorySaved).not.toHaveBeenCalled();
  });
});
