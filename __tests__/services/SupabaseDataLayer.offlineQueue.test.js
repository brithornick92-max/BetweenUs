const mockStorageGet = jest.fn();
const mockStorageSet = jest.fn();
const mockCaptureException = jest.fn();
const mockAddBreadcrumb = jest.fn();
const mockUpsert = jest.fn();
const mockSelectAfterUpsert = jest.fn();
const mockSingleAfterUpsert = jest.fn();
const mockDelete = jest.fn();
const mockDeleteEq = jest.fn();

let mockStorageState;

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'queue-generated-id'),
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

jest.mock('../../services/PartnerNotifications', () => ({
  journalShared: jest.fn(() => Promise.resolve()),
  calendarEventCreated: jest.fn(() => Promise.resolve()),
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
      if (tableName === 'couple_data') {
        return {
          upsert: mockUpsert,
        };
      }

      if (tableName === 'calendar_events') {
        return {
          upsert: mockUpsert,
          delete: mockDelete,
        };
      }

      throw new Error(`Unexpected table: ${tableName}`);
    }),
  },
}));

const queueKey = '@betweenus:cache:cloudSyncQueue:user-1:couple:couple-1';

const makeQueuedJournalInsert = (overrides = {}) => ({
  mutationId: 'mutation-1',
  entity: 'journal',
  action: 'insert',
  id: 'journal-1',
  payload: { title: 'Offline note', body: 'Saved while offline' },
  queuedAt: '2026-05-05T10:00:00.000Z',
  status: 'pending',
  attempts: 0,
  inFlightAt: null,
  updatedAt: '2026-05-05T10:00:00.000Z',
  ...overrides,
});

describe('SupabaseDataLayer offline queue', () => {
  let SupabaseDataLayer;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageState = new Map();

    mockStorageGet.mockImplementation((key, fallback = null) => (
      Promise.resolve(mockStorageState.has(key) ? mockStorageState.get(key) : fallback)
    ));
    mockStorageSet.mockImplementation((key, value) => {
      mockStorageState.set(key, value);
      return Promise.resolve(true);
    });

    mockSingleAfterUpsert.mockResolvedValue({
      data: { id: 'journal-1' },
      error: null,
    });
    mockSelectAfterUpsert.mockReturnValue({ single: mockSingleAfterUpsert });
    mockUpsert.mockReturnValue({ select: mockSelectAfterUpsert });
    mockDeleteEq.mockResolvedValue({ error: null });
    mockDelete.mockReturnValue({ eq: mockDeleteEq });

    SupabaseDataLayer = require('../../services/data/SupabaseDataLayer').default;
  });

  afterEach(async () => {
    await SupabaseDataLayer.reset();
  });

  it('marks queued items in-flight before remote writes and removes them after success', async () => {
    mockStorageState.set(queueKey, [makeQueuedJournalInsert()]);

    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: 'couple-1',
      isPremium: true,
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'journal-1',
        couple_id: 'couple-1',
        data_type: 'journal',
        value: expect.objectContaining({ title: 'Offline note' }),
      }),
      { onConflict: 'id' }
    );

    const queueWrites = mockStorageSet.mock.calls
      .filter(([key]) => key === queueKey)
      .map(([, value]) => value);

    expect(queueWrites[0][0]).toEqual(expect.objectContaining({
      mutationId: 'mutation-1',
      status: 'pending',
    }));
    expect(queueWrites[1][0]).toEqual(expect.objectContaining({
      mutationId: 'mutation-1',
      status: 'in_flight',
      inFlightAt: expect.any(String),
    }));
    expect(queueWrites.at(-1)).toEqual([]);
    expect(mockStorageState.get(queueKey)).toEqual([]);
  });

  it('recovers stale in-flight items and retries them idempotently', async () => {
    mockStorageState.set(queueKey, [
      makeQueuedJournalInsert({
        status: 'in_flight',
        inFlightAt: '2026-05-05T09:00:00.000Z',
      }),
    ]);

    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: 'couple-1',
      isPremium: true,
    });

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockStorageState.get(queueKey)).toEqual([]);
  });

  it('keeps failed items in the queue and reports the failure', async () => {
    mockStorageState.set(queueKey, [makeQueuedJournalInsert()]);
    mockSingleAfterUpsert.mockResolvedValueOnce({
      data: null,
      error: new Error('permission denied'),
    });

    const result = await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: 'couple-1',
      isPremium: true,
    });

    const remainingQueue = mockStorageState.get(queueKey);

    expect(result).toBeUndefined();
    expect(remainingQueue).toEqual([
      expect.objectContaining({
        mutationId: 'mutation-1',
        status: 'pending',
        attempts: 1,
        lastError: 'permission denied',
        inFlightAt: null,
      }),
    ]);
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        source: 'supabase_offline_queue_flush',
        entity: 'journal',
        action: 'insert',
        mutationId: 'mutation-1',
        attempts: 1,
      })
    );
  });

  it('does not flush queue items from a different couple scope', async () => {
    mockStorageState.set(queueKey, [
      makeQueuedJournalInsert({
        coupleId: 'couple-old',
      }),
    ]);

    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: 'couple-1',
      isPremium: true,
    });

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockStorageState.get(queueKey)).toEqual([
      expect.objectContaining({
        coupleId: 'couple-old',
      }),
    ]);
  });

  it('flushes queued calendar writes with upsert instead of re-enqueueing through public APIs', async () => {
    mockStorageState.set(queueKey, [{
      mutationId: 'calendar-1',
      entity: 'calendar',
      action: 'insert',
      id: 'event-1',
      payload: {
        title: 'Dinner',
        notes: 'Try the new place',
        whenTs: Date.UTC(2026, 4, 5, 23, 0),
        eventType: 'dateNight',
        location: 'Downtown',
      },
      queuedAt: '2026-05-05T10:00:00.000Z',
      status: 'pending',
      attempts: 0,
      inFlightAt: null,
      updatedAt: '2026-05-05T10:00:00.000Z',
    }]);

    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: 'couple-1',
      isPremium: true,
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'event-1',
        couple_id: 'couple-1',
        title: 'Dinner',
        event_type: 'dateNight',
      }),
      { onConflict: 'id' }
    );
    expect(mockAddBreadcrumb).not.toHaveBeenCalledWith(
      'sync',
      'Queued offline mutation',
      expect.objectContaining({ entity: 'calendar' })
    );
    expect(mockStorageState.get(queueKey)).toEqual([]);
  });
});
