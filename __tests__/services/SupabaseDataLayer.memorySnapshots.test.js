// __tests__/services/SupabaseDataLayer.memorySnapshots.test.js

const mockInsert = jest.fn();
const mockSelect = jest.fn();
const mockSingle = jest.fn();
const mockDelete = jest.fn();
const mockDeleteEq = jest.fn();
const mockDeleteSelect = jest.fn();
const mockRpc = jest.fn();
const mockStorageGet = jest.fn();
const mockStorageSet = jest.fn();
const mockCreateSignedUrl = jest.fn(() => Promise.resolve({
  data: { signedUrl: 'https://example.com/signed-media-url' },
  error: null,
}));
const mockStorageUpload = jest.fn(() => Promise.resolve({ error: null }));
const mockStorageRemove = jest.fn(() => Promise.resolve({ error: null }));
const mockMemorySaved = jest.fn(() => Promise.resolve());
const mockLoveNoteSave = jest.fn();
const mockLoveNoteGetNotes = jest.fn();
const mockLoveNoteMarkRead = jest.fn();
const mockLoveNoteDelete = jest.fn();
const mockLoveNoteUnreadCount = jest.fn();
let mockStorageState;

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
    CLOUD_SYNC_QUEUE: '@betweenus:cache:cloudSyncQueue',
  },
  loveNoteStorage: {
    saveNote: (...args) => mockLoveNoteSave(...args),
    getNotes: (...args) => mockLoveNoteGetNotes(...args),
    markRead: (...args) => mockLoveNoteMarkRead(...args),
    deleteNote: (...args) => mockLoveNoteDelete(...args),
    getUnreadCount: (...args) => mockLoveNoteUnreadCount(...args),
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

function mockCreateQueryResult(data = []) {
  const result = Promise.resolve({ data, error: null });
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    neq: jest.fn(() => query),
    or: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    range: jest.fn(() => query),
    maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
    single: jest.fn(() => Promise.resolve({ data: null, error: null })),
    then: result.then.bind(result),
    catch: result.catch.bind(result),
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
      if (!['couple_data', 'calendar_events'].includes(tableName)) {
        throw new Error(`Unexpected table: ${tableName}`);
      }

      return {
        insert: mockInsert,
        delete: mockDelete,
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(),
            })),
          })),
        })),
        select: jest.fn(() => ({
          eq: jest.fn(() => mockCreateQueryResult([])),
        })),
      };
    }),
    rpc: mockRpc,
    storage: {
      from: jest.fn(() => ({
        createSignedUrl: mockCreateSignedUrl,
        upload: mockStorageUpload,
        remove: mockStorageRemove,
      })),
    },
  },
}));

describe('SupabaseDataLayer memory snapshots', () => {
  let SupabaseDataLayer;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageState = new Map();

    mockStorageGet.mockImplementation((key, fallback = null) => (
      Promise.resolve(mockStorageState.has(key) ? mockStorageState.get(key) : fallback)
    ));
    mockStorageSet.mockImplementation((key, value) => {
      mockStorageState.set(key, value);
      return Promise.resolve(undefined);
    });
    mockLoveNoteSave.mockImplementation(async (note) => ({ id: 'note-1', ...note }));
    mockLoveNoteGetNotes.mockResolvedValue([{ id: 'note-1', body: 'A local note', isRead: false }]);
    mockLoveNoteMarkRead.mockResolvedValue(undefined);
    mockLoveNoteDelete.mockResolvedValue(true);
    mockLoveNoteUnreadCount.mockResolvedValue(1);
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed-media-url' },
      error: null,
    });
    mockStorageUpload.mockResolvedValue({ error: null });
    mockStorageRemove.mockResolvedValue({ error: null });
    require('expo-file-system/legacy').readAsStringAsync.mockResolvedValue('aGVsbG8=');

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
    mockDeleteSelect.mockResolvedValue({ data: [], error: null });
    mockDeleteEq.mockReturnValue({ select: mockDeleteSelect });
    mockDelete.mockReturnValue({ eq: mockDeleteEq });
    mockRpc.mockResolvedValue({ data: false, error: null });

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

  it('does not send client-side partner notifications for cloud-synced memories', async () => {
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

    expect(mockMemorySaved).not.toHaveBeenCalled();
  });

  it('forces memory rows to shared even if a caller passes isPrivate true', async () => {
    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: 'couple-1',
      isPremium: true,
    });

    await SupabaseDataLayer.saveMemory({
      content: 'Shared by design',
      type: 'moment',
      isPrivate: true,
      notifyPartner: false,
    });

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      data_type: 'memory',
      is_private: false,
    }));
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
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      value: expect.objectContaining({
        notifyPartner: false,
      }),
    }));
  });

  it('uploads memory media and returns the signed media URL', async () => {
    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: 'couple-1',
      isPremium: true,
    });

    const saved = await SupabaseDataLayer.saveMemory({
      content: 'Snapshot with media',
      type: 'snapshot',
      mediaUri: 'file:///snapshot-photo.jpg',
      mimeType: 'image/jpeg',
      notifyPartner: false,
    });

    expect(mockStorageUpload).toHaveBeenCalledWith(
      'couples/couple-1/mem-test-id-123.jpeg',
      expect.any(Uint8Array),
      expect.objectContaining({
        contentType: 'image/jpeg',
        upsert: false,
      })
    );
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      data_type: 'memory',
      value: expect.objectContaining({
        mediaPath: 'couples/couple-1/mem-test-id-123.jpeg',
        mediaBucket: 'couple-media',
        mimeType: 'image/jpeg',
      }),
    }));
    expect(mockInsert.mock.calls[0][0].value).not.toHaveProperty('localMediaUri');
    expect(saved).toEqual(expect.objectContaining({
      media_ref: 'couples/couple-1/mem-test-id-123.jpeg',
      mime_type: 'image/jpeg',
      mediaUri: 'https://example.com/signed-media-url',
    }));
  });

  it('falls back to storage-compatible content type for video uploads', async () => {
    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: 'couple-1',
      isPremium: true,
    });

    mockStorageUpload
      .mockResolvedValueOnce({ error: { message: 'mime type video/mp4 is not supported' } })
      .mockResolvedValueOnce({ error: null });

    const saved = await SupabaseDataLayer.saveMemory({
      content: 'Snapshot with video',
      type: 'snapshot',
      mediaUri: 'file:///snapshot-video.mp4',
      mimeType: 'video/mp4',
      notifyPartner: false,
    });

    expect(mockStorageUpload).toHaveBeenNthCalledWith(
      1,
      'couple-1/user-1/mem-test-id-123.mp4',
      expect.any(Uint8Array),
      expect.objectContaining({
        contentType: 'video/mp4',
        upsert: false,
      })
    );
    expect(mockStorageUpload).toHaveBeenNthCalledWith(
      2,
      'couple-1/user-1/mem-test-id-123.mp4',
      expect.any(Uint8Array),
      expect.objectContaining({
        contentType: 'application/octet-stream',
        upsert: false,
      })
    );
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      data_type: 'memory',
      value: expect.objectContaining({
        mediaPath: 'couple-1/user-1/mem-test-id-123.mp4',
        mediaBucket: 'attachments',
        mimeType: 'video/mp4',
        notifyPartner: false,
      }),
    }));
    expect(saved).toEqual(expect.objectContaining({
      media_ref: 'couple-1/user-1/mem-test-id-123.mp4',
      mime_type: 'video/mp4',
      mediaUri: 'https://example.com/signed-media-url',
    }));
  });

  it('keeps selected memory media pending if storage upload fails', async () => {
    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: 'couple-1',
      isPremium: true,
    });

    mockStorageUpload.mockResolvedValueOnce({ error: { message: 'storage unavailable' } });

    const saved = await SupabaseDataLayer.saveMemory({
      content: 'Keep the photo attached',
      type: 'snapshot',
      mediaUri: 'file:///snapshot-photo.jpg',
      mimeType: 'image/jpeg',
      notifyPartner: false,
    });

    expect(mockInsert).not.toHaveBeenCalled();
    expect(saved).toEqual(expect.objectContaining({
      content: 'Keep the photo attached',
      mediaUri: 'file:///snapshot-photo.jpg',
      mime_type: 'image/jpeg',
      sync_status: 'pending',
    }));
    expect(JSON.stringify(Array.from(mockStorageState.values()))).toContain('"localMediaUri":"file:///snapshot-photo.jpg"');
  });

  it('removes uploaded memory media if the cloud row insert fails', async () => {
    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: 'couple-1',
      isPremium: true,
    });

    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'new row violates row-level security policy' },
    });

    const saved = await SupabaseDataLayer.saveMemory({
      content: 'Rollback this upload',
      type: 'snapshot',
      mediaUri: 'file:///snapshot-photo.jpg',
      mimeType: 'image/jpeg',
      notifyPartner: false,
    });

    expect(mockStorageRemove).toHaveBeenCalledWith(['couples/couple-1/mem-test-id-123.jpeg']);
    expect(saved).toEqual(expect.objectContaining({
      content: 'Rollback this upload',
      mediaUri: 'file:///snapshot-photo.jpg',
      sync_status: 'pending',
    }));
  });

  it('keeps selected journal media pending if storage upload fails', async () => {
    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: 'couple-1',
      isPremium: true,
    });

    mockStorageUpload.mockResolvedValueOnce({ error: { message: 'storage unavailable' } });

    const saved = await SupabaseDataLayer.saveJournalEntry({
      title: 'Journal with media',
      body: 'Keep this attachment visible while pending.',
      mediaUri: 'file:///journal-photo.jpg',
      mimeType: 'image/jpeg',
    });

    expect(mockInsert).not.toHaveBeenCalled();
    expect(saved).toEqual(expect.objectContaining({
      title: 'Journal with media',
      mediaUri: 'file:///journal-photo.jpg',
      mediaType: 'image/jpeg',
      mediaKind: 'image',
      sync_status: 'pending',
    }));
    expect(JSON.stringify(Array.from(mockStorageState.values()))).toContain('"localMediaUri":"file:///journal-photo.jpg"');
  });

  it('keeps pending memory rows readable while unpaired', async () => {
    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: null,
      isPremium: false,
    });

    const saved = await SupabaseDataLayer.saveMemory({
      content: JSON.stringify({
        kind: 'date_history',
        dateId: 'date-1',
        title: 'Coffee walk',
      }),
      type: 'date_tried',
      mood: 'talking',
      notifyPartner: false,
    });

    const rows = await SupabaseDataLayer.getMemories({ type: 'date_tried' });

    expect(mockInsert).not.toHaveBeenCalled();
    expect(saved).toEqual(expect.objectContaining({
      id: 'mem-test-id-123',
      user_id: 'user-1',
      couple_id: null,
      type: 'date_tried',
      sync_status: 'pending',
    }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(expect.objectContaining({
      id: 'mem-test-id-123',
      user_id: 'user-1',
      type: 'date_tried',
      content: expect.stringContaining('"dateId":"date-1"'),
    }));
  });

  it('updates and removes pending memory rows while unpaired', async () => {
    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: null,
      isPremium: false,
    });

    const saved = await SupabaseDataLayer.saveMemory({
      content: 'first',
      type: 'intimacy_tried',
      notifyPartner: false,
    });

    await SupabaseDataLayer.updateMemory(saved.id, { content: 'updated' });
    let rows = await SupabaseDataLayer.getMemories({ type: 'intimacy_tried' });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(expect.objectContaining({
      id: saved.id,
      content: 'updated',
      sync_status: 'pending',
    }));

    await SupabaseDataLayer.deleteMemory(saved.id);
    rows = await SupabaseDataLayer.getMemories({ type: 'intimacy_tried' });

    expect(rows).toEqual([]);
  });

  it('keeps prompt answers readable while unpaired', async () => {
    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: null,
      isPremium: false,
    });

    const saved = await SupabaseDataLayer.savePromptAnswer({
      promptId: 'prompt-1',
      answer: 'Local answer',
      heatLevel: 2,
      includeInKeepsake: true,
      _createdAt: '2026-04-30T12:00:00.000Z',
    });

    const rows = await SupabaseDataLayer.getPromptAnswers({ promptId: 'prompt-1' });

    expect(mockInsert).not.toHaveBeenCalled();
    expect(saved).toEqual(expect.objectContaining({
      id: 'mem-test-id-123',
      user_id: 'user-1',
      couple_id: null,
      prompt_id: 'prompt-1',
      answer: 'Local answer',
      includeInKeepsake: true,
      sync_status: 'pending',
    }));
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: saved.id,
        prompt_id: 'prompt-1',
        answer: 'Local answer',
        includeInKeepsake: true,
      }),
    ]));
  });

  it('keeps today check-ins readable and updatable while unpaired', async () => {
    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: null,
      isPremium: false,
    });

    const saved = await SupabaseDataLayer.saveCheckIn({
      mood: 'steady',
      intimacy: 3,
      notes: 'A quiet start.',
      touch: 'hand',
    });

    let today = await SupabaseDataLayer.getCheckInForToday();
    let rows = await SupabaseDataLayer.getCheckIns({ limit: 10 });

    expect(mockInsert).not.toHaveBeenCalled();
    expect(saved).toEqual(expect.objectContaining({
      id: 'mem-test-id-123',
      user_id: 'user-1',
      couple_id: null,
      mood: 'steady',
      sync_status: 'pending',
    }));
    expect(today).toEqual(expect.objectContaining({
      id: saved.id,
      mood: 'steady',
      notes: 'A quiet start.',
    }));
    expect(rows).toHaveLength(1);

    await SupabaseDataLayer.saveCheckIn({
      mood: 'warm',
      intimacy: 4,
      notes: 'Updated locally.',
      touch: 'hug',
    });

    today = await SupabaseDataLayer.getCheckInForToday();
    rows = await SupabaseDataLayer.getCheckIns({ limit: 10 });

    expect(today).toEqual(expect.objectContaining({
      id: saved.id,
      mood: 'warm',
      notes: 'Updated locally.',
    }));
    expect(rows).toHaveLength(1);
  });

  it('keeps the latest vibe readable while unpaired', async () => {
    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: null,
      isPremium: false,
    });

    const saved = await SupabaseDataLayer.saveVibe({
      vibe: 'soft',
      note: 'Saving the signal locally.',
    });
    const latest = await SupabaseDataLayer.getLatestVibe();

    expect(mockInsert).not.toHaveBeenCalled();
    expect(saved).toEqual(expect.objectContaining({
      id: 'mem-test-id-123',
      user_id: 'user-1',
      couple_id: null,
      vibe: 'soft',
      sync_status: 'pending',
    }));
    expect(latest).toEqual(expect.objectContaining({
      id: saved.id,
      vibe: 'soft',
      note: 'Saving the signal locally.',
    }));
  });

  it('keeps calendar events readable while unpaired', async () => {
    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: null,
      isPremium: false,
    });

    const saved = await SupabaseDataLayer.createCalendarEvent({
      id: 'calendar-local-1',
      title: 'Dinner downtown',
      notes: 'Try the new place.',
      whenTs: Date.parse('2026-05-01T23:00:00.000Z'),
      eventType: 'dateNight',
      isDateNight: true,
      location: 'out',
    });
    const rows = await SupabaseDataLayer.getCalendarEvents({ limit: 50 });

    expect(mockInsert).not.toHaveBeenCalled();
    expect(saved).toEqual(expect.objectContaining({
      id: 'calendar-local-1',
      title: 'Dinner downtown',
      eventType: 'dateNight',
      isDateNight: true,
      sync_status: 'pending',
      remoteSynced: false,
    }));
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'calendar-local-1',
        title: 'Dinner downtown',
        sync_status: 'pending',
      }),
    ]));
    expect(JSON.stringify(Array.from(mockStorageState.values()))).toContain('"entity":"calendar"');
  });

  it('keeps calendar events readable when the cloud insert is blocked', async () => {
    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: 'couple-1',
      isPremium: false,
    });

    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'violates row-level security policy' },
    });

    const saved = await SupabaseDataLayer.createCalendarEvent({
      id: 'calendar-blocked-1',
      title: 'Coffee walk',
      whenTs: Date.parse('2026-05-02T14:00:00.000Z'),
      eventType: 'general',
    });
    const rows = await SupabaseDataLayer.getCalendarEvents({ limit: 50 });

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'calendar-blocked-1',
      couple_id: 'couple-1',
      title: 'Coffee walk',
    }));
    expect(saved).toEqual(expect.objectContaining({
      id: 'calendar-blocked-1',
      title: 'Coffee walk',
      sync_status: 'pending',
      remoteSynced: false,
    }));
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'calendar-blocked-1',
        title: 'Coffee walk',
        sync_status: 'pending',
      }),
    ]));
  });

  it('deletes pending local calendar events without requiring remote delete permission', async () => {
    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: 'couple-1',
      isPremium: false,
    });

    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'violates row-level security policy' },
    });

    await SupabaseDataLayer.createCalendarEvent({
      id: 'calendar-blocked-delete-1',
      title: 'Coffee walk',
      whenTs: Date.parse('2026-05-02T14:00:00.000Z'),
      eventType: 'general',
    });

    await SupabaseDataLayer.deleteCalendarEvent('calendar-blocked-delete-1', {
      deleteRemote: false,
    });

    const rows = await SupabaseDataLayer.getCalendarEvents({ limit: 50 });

    expect(rows).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'calendar-blocked-delete-1' }),
    ]));
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(JSON.stringify(Array.from(mockStorageState.values()))).not.toContain('calendar-blocked-delete-1');
  });

  it('keeps date plans removable while unpaired', async () => {
    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: null,
      isPremium: false,
    });

    const saved = await SupabaseDataLayer.saveDatePlan({
      id: 'date-plan-local-1',
      title: 'Solo plan',
      locationType: 'home',
      steps: ['Light candles.'],
    });
    let rows = await SupabaseDataLayer.getDatePlans({ limit: 50 });

    expect(mockInsert).not.toHaveBeenCalled();
    expect(saved).toEqual(expect.objectContaining({
      id: 'date-plan-local-1',
      title: 'Solo plan',
      sync_status: 'pending',
    }));
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'date-plan-local-1',
        title: 'Solo plan',
      }),
    ]));

    await SupabaseDataLayer.deleteDatePlan(saved.id);
    rows = await SupabaseDataLayer.getDatePlans({ limit: 50 });

    expect(rows).toEqual([]);
    expect(JSON.stringify(Array.from(mockStorageState.values()))).toContain('"entity":"date_plan"');
    expect(JSON.stringify(Array.from(mockStorageState.values()))).toContain('"action":"delete"');
  });

  it('hides remote calendar events locally and queues a retry when remote delete is denied', async () => {
    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: 'couple-1',
      isPremium: false,
    });

    await SupabaseDataLayer.createCalendarEvent({
      id: 'calendar-remote-delete-1',
      title: 'Dinner',
      whenTs: Date.parse('2026-05-02T14:00:00.000Z'),
      eventType: 'general',
    });

    mockDeleteSelect.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'violates row-level security policy' },
    });
    mockRpc.mockResolvedValueOnce({ data: false, error: null });

    await expect(SupabaseDataLayer.deleteCalendarEvent('calendar-remote-delete-1', {
      deleteRemote: true,
      remoteId: 'calendar-remote-delete-1',
    })).resolves.toBeUndefined();

    const rows = await SupabaseDataLayer.getCalendarEvents({ limit: 50 });

    expect(rows).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'calendar-remote-delete-1' }),
    ]));
    expect(JSON.stringify(Array.from(mockStorageState.values()))).toContain('"action":"delete"');
    expect(JSON.stringify(Array.from(mockStorageState.values()))).toContain('calendar-remote-delete-1');
  });

  it('keeps journal entries readable and editable while unpaired', async () => {
    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: null,
      isPremium: false,
    });

    const saved = await SupabaseDataLayer.saveJournalEntry({
      title: 'Local journal',
      body: 'Private to this device until sync.',
      mood: 'warm',
      tags: ['fallback'],
      imageUri: 'file:///journal-photo.jpg',
    });

    let rows = await SupabaseDataLayer.getJournalEntries({ limit: 500, visibility: 'shared' });

    expect(mockInsert).not.toHaveBeenCalled();
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: saved.id,
        user_id: 'user-1',
        title: 'Local journal',
        photo_uri: 'file:///journal-photo.jpg',
        mediaUri: 'file:///journal-photo.jpg',
        sync_status: 'pending',
      }),
    ]));

    await SupabaseDataLayer.updateJournalEntry(saved.id, { title: 'Updated local journal' });
    rows = await SupabaseDataLayer.getJournalEntries({ limit: 500, visibility: 'shared' });

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: saved.id,
        title: 'Updated local journal',
        photo_uri: 'file:///journal-photo.jpg',
        mediaUri: 'file:///journal-photo.jpg',
      }),
    ]));

    await SupabaseDataLayer.updateJournalEntry(saved.id, {
      mediaUri: 'file:///updated-journal-video.mp4',
      mimeType: 'video/mp4',
    });
    rows = await SupabaseDataLayer.getJournalEntries({ limit: 500, visibility: 'shared' });

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: saved.id,
        photo_uri: null,
        mediaUri: 'file:///updated-journal-video.mp4',
        mediaType: 'video/mp4',
        mediaKind: 'video',
      }),
    ]));
    expect(JSON.stringify(Array.from(mockStorageState.values()))).toContain('"localMediaUri":"file:///updated-journal-video.mp4"');

    await SupabaseDataLayer.updateJournalEntry(saved.id, { title: 'Updated again' });
    rows = await SupabaseDataLayer.getJournalEntries({ limit: 500, visibility: 'shared' });

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: saved.id,
        title: 'Updated again',
        mediaUri: 'file:///updated-journal-video.mp4',
        mediaType: 'video/mp4',
        mediaKind: 'video',
      }),
    ]));

    await SupabaseDataLayer.updateJournalEntry(saved.id, { imageUri: null, mediaUri: null });
    rows = await SupabaseDataLayer.getJournalEntries({ limit: 500, visibility: 'shared' });

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: saved.id,
        photo_uri: null,
        mediaUri: null,
      }),
    ]));

    await SupabaseDataLayer.deleteJournalEntry(saved.id);
    rows = await SupabaseDataLayer.getJournalEntries({ limit: 500, visibility: 'shared' });

    expect(rows).toEqual([]);
  });

  it('uses local love note storage as the notes fallback', async () => {
    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: null,
      isPremium: false,
    });

    const saved = await SupabaseDataLayer.saveLoveNote({ body: 'A local note' });
    const notes = await SupabaseDataLayer.getLoveNotes();
    const note = await SupabaseDataLayer.getLoveNote('note-1');
    const unread = await SupabaseDataLayer.getUnreadLoveNoteCount();

    expect(mockLoveNoteSave).toHaveBeenCalledWith({ body: 'A local note' });
    expect(saved).toEqual(expect.objectContaining({ id: 'note-1', body: 'A local note' }));
    expect(notes).toEqual([expect.objectContaining({ id: 'note-1' })]);
    expect(note).toEqual(expect.objectContaining({ id: 'note-1' }));
    expect(unread).toBe(1);

    await SupabaseDataLayer.markLoveNoteRead('note-1');
    await SupabaseDataLayer.deleteLoveNote('note-1');

    expect(mockLoveNoteMarkRead).toHaveBeenCalledWith('note-1');
    expect(mockLoveNoteDelete).toHaveBeenCalledWith('note-1');
  });

  it('preserves pending local content after unexpected Supabase write errors and empty cloud reads', async () => {
    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: 'couple-1',
      isPremium: true,
    });

    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'new row violates row-level security policy' },
    });

    const memory = await SupabaseDataLayer.saveMemory({
      content: 'Local keepsake',
      type: 'snapshot',
      notifyPartner: false,
    });

    let memories = await SupabaseDataLayer.getMemories({ type: 'snapshot' });

    expect(memory).toEqual(expect.objectContaining({
      id: 'mem-test-id-123',
      content: 'Local keepsake',
      sync_status: 'pending',
    }));
    expect(memories).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: memory.id,
        content: 'Local keepsake',
        sync_status: 'pending',
      }),
    ]));

    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'new row violates row-level security policy' },
    });

    const journal = await SupabaseDataLayer.saveJournalEntry({
      title: 'Local journal',
      body: 'Still visible after an empty cloud read.',
    });

    const journals = await SupabaseDataLayer.getJournalEntries({ limit: 500, visibility: 'shared' });

    expect(journal).toEqual(expect.objectContaining({
      id: 'mem-test-id-123',
      title: 'Local journal',
      sync_status: 'pending',
    }));
    expect(journals).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: journal.id,
        title: 'Local journal',
        sync_status: 'pending',
      }),
    ]));
  });

  it('creates a synced date plan when creating a date-night calendar event', async () => {
    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: 'couple-1',
      isPremium: true,
    });

    const saved = await SupabaseDataLayer.createCalendarEvent({
      id: 'calendar-date-1',
      title: 'Dinner downtown',
      notes: 'Try the new place.',
      whenTs: Date.parse('2026-05-01T23:00:00.000Z'),
      eventType: 'dateNight',
      isDateNight: true,
      location: 'out',
    });

    expect(saved).toEqual(expect.objectContaining({
      id: 'calendar-date-1',
      title: 'Dinner downtown',
      isDateNight: true,
    }));

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'calendar-date-1',
      couple_id: 'couple-1',
      title: 'Dinner downtown',
      event_type: 'dateNight',
    }));

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      data_type: 'date_plan',
      created_by: 'user-1',
      value: expect.objectContaining({
        title: 'Dinner downtown',
        sourceEventId: 'calendar-date-1',
        locationType: 'out',
        steps: ['Try the new place.'],
      }),
    }));
    expect(JSON.stringify(Array.from(mockStorageState.values()))).toContain('"sourceEventId":"calendar-date-1"');
  });

  it('normalizes metadata date-night calendar events to the dateNight event type', async () => {
    await SupabaseDataLayer.init({
      userId: 'user-1',
      coupleId: 'couple-1',
      isPremium: true,
    });

    const saved = await SupabaseDataLayer.createCalendarEvent({
      id: 'calendar-date-2',
      title: 'Movie night',
      whenTs: Date.parse('2026-05-02T23:00:00.000Z'),
      eventType: 'general',
      isDateNight: true,
      location: 'home',
    });

    expect(saved).toEqual(expect.objectContaining({
      id: 'calendar-date-2',
      eventType: 'dateNight',
      isDateNight: true,
    }));
  });
});
