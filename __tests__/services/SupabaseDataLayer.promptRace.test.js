const mockStorageGet = jest.fn();
const mockStorageSet = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockTopLevelSelect = jest.fn();
const mockStorageFrom = jest.fn();
const mockCaptureException = jest.fn();
const mockAddBreadcrumb = jest.fn();

let mockStorageState;
let selectStarMaybeSingleQueue;

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'generated-answer-id'),
}));

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64',
  },
}));

jest.mock('../../utils/storage', () => ({
  STORAGE_KEYS: {
    CLOUD_SYNC_QUEUE: '@betweenus:cache:cloudSyncQueue',
  },
  loveNoteStorage: {
    saveNote: jest.fn(),
    getNotes: jest.fn(() => Promise.resolve([])),
    markRead: jest.fn(),
    deleteNote: jest.fn(),
    getUnreadCount: jest.fn(() => Promise.resolve(0)),
  },
  storage: {
    get: (...args) => mockStorageGet(...args),
    set: (...args) => mockStorageSet(...args),
  },
}));

jest.mock('../../services/CrashReporting', () => ({
  captureException: (...args) => mockCaptureException(...args),
  addBreadcrumb: (...args) => mockAddBreadcrumb(...args),
}));

jest.mock('../../utils/contentLoader', () => ({
  getPromptById: jest.fn(() => ({ id: 'prompt-1', heat: 2 })),
}));

function makeSelectQuery(columns) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    neq: jest.fn(() => query),
    or: jest.fn(() => query),
    order: jest.fn(() => query),
    range: jest.fn(() => Promise.resolve({ data: [], error: null })),
    limit: jest.fn(() => {
      if (columns === 'value') {
        return Promise.resolve({
          data: [{ value: { promptId: 'prompt-1', dateKey: '2026-05-05', answer: 'old answer' } }],
          error: null,
        });
      }
      return query;
    }),
    maybeSingle: jest.fn(() => {
      const next = selectStarMaybeSingleQueue.shift() || { data: null, error: null };
      return Promise.resolve(next);
    }),
  };

  return query;
}

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
        select: mockTopLevelSelect,
        insert: mockInsert,
        update: mockUpdate,
      };
    }),
    storage: {
      from: mockStorageFrom,
    },
  },
}));

const queueKey = '@betweenus:cache:cloudSyncQueue:user-1:couple:couple-1';

describe('SupabaseDataLayer prompt answer write races', () => {
  let SupabaseDataLayer;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockStorageState = new Map();
    selectStarMaybeSingleQueue = [];

    mockStorageGet.mockImplementation((key, fallback = null) => (
      Promise.resolve(mockStorageState.has(key) ? mockStorageState.get(key) : fallback)
    ));
    mockStorageSet.mockImplementation((key, value) => {
      mockStorageState.set(key, value);
      return Promise.resolve(true);
    });
    mockTopLevelSelect.mockImplementation((columns) => makeSelectQuery(columns));
    mockInsert.mockReturnValue({
      select: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({
          data: null,
          error: {
            code: '23505',
            message: 'duplicate key value violates unique constraint',
          },
        })),
      })),
    });
    mockUpdate.mockReturnValue({
      eq: jest.fn(() => ({
        select: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({
            data: [{
              id: 'existing-answer-id',
              couple_id: 'couple-1',
              created_by: 'user-1',
              value: {
                promptId: 'prompt-1',
                dateKey: '2026-05-05',
                answer: 'new answer',
                heatLevel: 2,
              },
              created_at: '2026-05-05T12:00:00.000Z',
              updated_at: '2026-05-05T12:01:00.000Z',
            }],
            error: null,
          })),
        })),
      })),
    });
    mockStorageFrom.mockReturnValue({
      createSignedUrl: jest.fn(() => Promise.resolve({ data: { signedUrl: 'url' }, error: null })),
      upload: jest.fn(() => Promise.resolve({ error: null })),
      remove: jest.fn(() => Promise.resolve({ error: null })),
    });

    SupabaseDataLayer = require('../../services/data/SupabaseDataLayer').default;
  });

  it('updates the existing prompt answer when an insert loses a unique-key race', async () => {
    selectStarMaybeSingleQueue.push(
      { data: null, error: null },
      {
        data: {
          id: 'existing-answer-id',
          couple_id: 'couple-1',
          created_by: 'user-1',
          value: {
            promptId: 'prompt-1',
            dateKey: '2026-05-05',
            answer: 'old answer',
            heatLevel: 2,
          },
          created_at: '2026-05-05T12:00:00.000Z',
          updated_at: '2026-05-05T12:00:00.000Z',
        },
        error: null,
      },
      { data: null, error: null },
      { data: null, error: null }
    );

    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: 'couple-1',
      isPremium: true,
    });

    const saved = await SupabaseDataLayer.savePromptAnswer({
      promptId: 'prompt-1',
      answer: 'new answer',
      heatLevel: 2,
      dateKey: '2026-05-05',
    });

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'generated-answer-id',
      couple_id: 'couple-1',
      data_type: 'prompt_answer',
      is_private: true,
    }));
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      value: expect.objectContaining({
        promptId: 'prompt-1',
        dateKey: '2026-05-05',
        answer: 'new answer',
      }),
    }));
    expect(saved).toEqual(expect.objectContaining({
      id: 'existing-answer-id',
      prompt_id: 'prompt-1',
      answer: 'new answer',
      heat_level: 2,
    }));
    expect(mockStorageState.get(queueKey)).toEqual([]);
  });
});
