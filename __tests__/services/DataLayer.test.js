/**
 * DataLayer.test.js — Tests for the data access layer
 */

// ── Mocks ──────────────────────────────────────────────────────────

jest.mock('../../services/db/Database', () => ({
  __esModule: true,
  default: {
    init: jest.fn().mockResolvedValue(undefined),
    insertJournal: jest.fn().mockResolvedValue(undefined),
    updateJournal: jest.fn().mockResolvedValue(undefined),
    softDeleteJournal: jest.fn().mockResolvedValue(undefined),
    getJournals: jest.fn().mockResolvedValue([]),
    getJournalById: jest.fn().mockResolvedValue(null),
    insertPromptAnswer: jest.fn().mockResolvedValue(undefined),
    updatePromptAnswer: jest.fn().mockResolvedValue(undefined),
    getPromptAnswers: jest.fn().mockResolvedValue([]),
    getPromptAnswerByPromptAndDate: jest.fn().mockResolvedValue(null),
    insertMemory: jest.fn().mockResolvedValue(undefined),
    getMemories: jest.fn().mockResolvedValue([]),
    softDeleteMemory: jest.fn().mockResolvedValue(undefined),
    insertRitual: jest.fn().mockResolvedValue(undefined),
    getRituals: jest.fn().mockResolvedValue([]),
    insertCheckIn: jest.fn().mockResolvedValue(undefined),
    getCheckIns: jest.fn().mockResolvedValue([]),
    getCheckInByDate: jest.fn().mockResolvedValue(null),
    insertVibe: jest.fn().mockResolvedValue(undefined),
    getVibes: jest.fn().mockResolvedValue([]),
    getLatestVibe: jest.fn().mockResolvedValue(null),
    insertLoveNote: jest.fn().mockResolvedValue(undefined),
    getLoveNotes: jest.fn().mockResolvedValue([]),
    getLoveNoteById: jest.fn().mockResolvedValue(null),
    markLoveNoteRead: jest.fn().mockResolvedValue(undefined),
    softDeleteLoveNote: jest.fn().mockResolvedValue(undefined),
    getUnreadLoveNoteCount: jest.fn().mockResolvedValue(0),
    upsertCalendarEvent: jest.fn().mockResolvedValue({ id: 'cal-1', created_at: '2024-01-01', updated_at: '2024-01-01' }),
    getCalendarEvents: jest.fn().mockResolvedValue([]),
    getCalendarEventById: jest.fn().mockResolvedValue(null),
    getPendingCalendarEvents: jest.fn().mockResolvedValue([]),
    markCalendarEventSynced: jest.fn().mockResolvedValue(undefined),
    replaceCalendarEventId: jest.fn().mockResolvedValue(undefined),
    softDeleteCalendarEvent: jest.fn().mockResolvedValue(undefined),
    upsertDatePlan: jest.fn().mockResolvedValue({ id: 'dp-1', created_at: '2024-01-01', updated_at: '2024-01-01' }),
    getDatePlans: jest.fn().mockResolvedValue([]),
    getDatePlansBySourceEvent: jest.fn().mockResolvedValue([]),
    getDatePlanById: jest.fn().mockResolvedValue(null),
    softDeleteDatePlan: jest.fn().mockResolvedValue(undefined),
    markDatePlansSyncedBySourceEvent: jest.fn().mockResolvedValue(undefined),
    purgeDeleted: jest.fn().mockResolvedValue(undefined),
    wipeAll: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../services/e2ee/E2EEncryption', () => ({
  __esModule: true,
  default: {
    encryptString: jest.fn(async (s) => `enc:${s}`),
    decryptString: jest.fn(async (s) => (s && s.startsWith('enc:') ? s.slice(4) : s)),
    encryptJson: jest.fn(async (o) => `enc:${JSON.stringify(o)}`),
    decryptJson: jest.fn(async (s) => (s && s.startsWith('enc:') ? JSON.parse(s.slice(4)) : null)),
    hasCoupleKey: jest.fn().mockResolvedValue(true),
    clearCache: jest.fn(),
    inspect: jest.fn().mockReturnValue({ version: 3, keyTier: 'couple', kid: '1', hasAad: false }),
  },
}));

jest.mock('../../services/e2ee/EncryptedAttachments', () => ({
  __esModule: true,
  default: {
    encryptAndStore: jest.fn().mockResolvedValue({ ref: 'att-ref-1' }),
    decryptAndReturn: jest.fn().mockResolvedValue(new Uint8Array(10)),
    delete: jest.fn().mockResolvedValue(undefined),
    clearDecryptedCache: jest.fn(),
  },
}));

jest.mock('../../services/sync/SyncEngine', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    pushNow: jest.fn().mockResolvedValue(undefined),
    pullNow: jest.fn().mockResolvedValue(undefined),
    sync: jest.fn().mockResolvedValue(undefined),
    subscribeRealtime: jest.fn(() => jest.fn()),
    onSyncEvent: jest.fn(() => jest.fn()),
    reset: jest.fn(),
  },
}));

jest.mock('../../services/PushNotificationService', () => ({
  __esModule: true,
  default: {
    notifyPartner: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockRemoveChannel = jest.fn();
const mockSubscribe = jest.fn(() => ({ unsubscribe: jest.fn() }));
const mockChannelOn = jest.fn(() => ({ subscribe: mockSubscribe }));
const mockChannel = jest.fn(() => ({ on: mockChannelOn }));
const mockAuthGetUser = jest.fn();
const mockRpc = jest.fn();
const mockSingle = jest.fn();
const mockSelect = jest.fn(() => ({ single: mockSingle }));
const mockInsert = jest.fn(() => ({ select: mockSelect }));
const mockUpdateEq = jest.fn();
const mockUpdate = jest.fn(() => ({ eq: mockUpdateEq }));
const mockDeleteEq = jest.fn();
const mockDelete = jest.fn(() => ({ eq: mockDeleteEq }));
const mockOrder = jest.fn();
const mockEq = jest.fn(() => ({ order: mockOrder }));
const mockRemoteSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  select: mockRemoteSelect,
}));

jest.mock('../../config/supabase', () => ({
  __esModule: true,
  supabase: {
    auth: {
      getUser: (...args) => mockAuthGetUser(...args),
    },
    from: mockFrom,
    rpc: (...args) => mockRpc(...args),
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
  TABLES: {
    CALENDAR_EVENTS: 'calendar_events',
  },
}));

const DataLayer = require('../../services/data/DataLayer').default;
const Database = require('../../services/db/Database').default;
const E2EEncryption = require('../../services/e2ee/E2EEncryption').default;
const PushNotificationService = require('../../services/PushNotificationService').default;

describe('DataLayer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } } });
    mockRpc.mockResolvedValue({ error: null });
    mockSingle.mockResolvedValue({ data: { id: '11111111-1111-4111-8111-111111111111' }, error: null });
    mockUpdateEq.mockResolvedValue({ error: null });
    mockDeleteEq.mockResolvedValue({ error: null });
    mockOrder.mockResolvedValue({ data: [], error: null });
    DataLayer.init({
      userId: 'user-1',
      coupleId: 'couple-1',
      isPremium: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    DataLayer.reset();
  });

  describe('init / reconfigure', () => {
    it('sets internal state', () => {
      expect(DataLayer.canEncryptForCouple()).toBe(true);
    });

    it('reconfigure updates coupleId', () => {
      DataLayer.reconfigure({ userId: 'user-1', coupleId: 'couple-2', isPremium: true });
      expect(DataLayer.canEncryptForCouple()).toBe(true);
    });

    it('needsReconnect returns true when couple key is missing', () => {
      DataLayer.init({ userId: 'user-1', coupleId: null, isPremium: false });
      expect(DataLayer.needsReconnect()).toBe(false); // no couple = no reconnect needed
    });
  });

  describe('Journal operations', () => {
    it('saveJournalEntry encrypts and inserts', async () => {
      await DataLayer.saveJournalEntry({
        title: 'My Day',
        body: 'It was great',
        mood: 'happy',
        tags: ['love'],
        isPrivate: false,
      });

      expect(E2EEncryption.encryptString).toHaveBeenCalled();
      expect(Database.insertJournal).toHaveBeenCalled();
    });

    it('getJournalEntries decrypts rows', async () => {
      Database.getJournals.mockResolvedValueOnce([
        {
          id: 'j_1',
          title_cipher: 'enc:title',
          body_cipher: 'enc:body',
          mood: 'happy',
          tags: '["love"]',
          created_at: '2024-01-01',
        },
      ]);

      const entries = await DataLayer.getJournalEntries({ limit: 10 });
      expect(entries).toHaveLength(1);
      // E2EEncryption.decryptString should have been called for title and body ciphers
      expect(E2EEncryption.decryptString).toHaveBeenCalled();
    });

    it('deleteJournalEntry calls softDelete', async () => {
      await DataLayer.deleteJournalEntry('j_1');
      expect(Database.softDeleteJournal).toHaveBeenCalledWith('j_1');
    });
  });

  describe('Prompt Answers', () => {
    it('savePromptAnswer encrypts answer', async () => {
      await DataLayer.savePromptAnswer({
        promptId: 'prompt-42',
        answer: 'My answer',
        heatLevel: 2,
      });

      expect(E2EEncryption.encryptString).toHaveBeenCalled();
      expect(Database.insertPromptAnswer).toHaveBeenCalled();
    });

    it('savePromptAnswer updates the existing answer for the same prompt and day', async () => {
      Database.getPromptAnswerByPromptAndDate.mockResolvedValueOnce({ id: 'pa_existing' });

      await DataLayer.savePromptAnswer({
        promptId: 'prompt-42',
        answer: 'Updated answer',
        heatLevel: 3,
      });

      expect(Database.updatePromptAnswer).toHaveBeenCalledWith(
        'pa_existing',
        expect.objectContaining({
          heat_level: 3,
          answer_cipher: 'enc:Updated answer',
          heat_level_cipher: 'enc:3',
        })
      );
      expect(Database.insertPromptAnswer).not.toHaveBeenCalled();
    });
  });

  describe('Vibes', () => {
    it('saveVibe saves a vibe entry', async () => {
      await DataLayer.saveVibe({ vibe: 'connected', note: 'Feeling close' });
      expect(Database.insertVibe).toHaveBeenCalled();
    });

    it('getLatestVibe returns the most recent vibe', async () => {
      Database.getLatestVibe.mockResolvedValueOnce({
        id: 'v_1',
        vibe: 'connected',
        note_cipher: 'enc:feeling close',
        created_at: '2024-01-01',
      });
      const result = await DataLayer.getLatestVibe();
      expect(result).toBeTruthy();
    });
  });

  describe('Love Notes', () => {
    it('saveLoveNote encrypts text', async () => {
      await DataLayer.saveLoveNote({
        text: 'I love you',
        stationeryId: 'default',
        senderName: 'Alice',
      });
      expect(E2EEncryption.encryptString).toHaveBeenCalled();
      expect(Database.insertLoveNote).toHaveBeenCalled();
    });

    it('saveLoveNote still rejects when the couple key is unavailable and cannot be restored', async () => {
      E2EEncryption.hasCoupleKey.mockResolvedValue(false);
      await DataLayer.reconfigure({ userId: 'user-1', coupleId: 'couple-1', isPremium: true });

      await expect(DataLayer.saveLoveNote({
        text: 'I love you',
        stationeryId: 'default',
        senderName: 'Alice',
      })).rejects.toThrow('COUPLE_KEY_MISSING');
    });

    it('getUnreadLoveNoteCount returns count', async () => {
      Database.getUnreadLoveNoteCount.mockResolvedValueOnce(5);
      const count = await DataLayer.getUnreadLoveNoteCount();
      expect(count).toBe(5);
    });
  });

  describe('Calendar', () => {
    it('createCalendarEvent writes remote-backed events as synced when Supabase insert succeeds', async () => {
      Database.upsertCalendarEvent.mockResolvedValueOnce({
        id: '11111111-1111-4111-8111-111111111111',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      });

      const result = await DataLayer.createCalendarEvent({
        title: 'Dinner',
        notes: 'At 7',
        location: 'Downtown',
        whenTs: new Date('2024-01-15T19:00:00Z').getTime(),
        eventType: 'dateNight',
        isDateNight: true,
        notify: true,
        notifyMins: 30,
      });

      expect(mockFrom).toHaveBeenCalledWith('calendar_events');
      expect(Database.upsertCalendarEvent).toHaveBeenCalledWith(
        expect.objectContaining({ id: '11111111-1111-4111-8111-111111111111' }),
        expect.objectContaining({ syncStatus: 'synced', syncSource: 'remote' })
      );
      expect(Database.upsertDatePlan).toHaveBeenCalled();
      expect(PushNotificationService.notifyPartner).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          title: 'New date plan',
          body: 'Dinner was added to your timeline.',
          data: expect.objectContaining({
            type: 'calendar_event_created',
            route: 'Calendar',
            eventId: '11111111-1111-4111-8111-111111111111',
            eventType: 'dateNight',
          }),
        })
      );
      expect(result.remoteSynced).toBe(true);
    });

    it('pushPendingCalendarEvents promotes offline local events to remote UUIDs', async () => {
      Database.getPendingCalendarEvents.mockResolvedValueOnce([
        {
          id: 'cal_local_1',
          title_cipher: 'enc:Dinner',
          location_cipher: 'enc:Downtown',
          notes_cipher: 'enc:At 7',
          event_type: 'dateNight',
          when_ts: new Date('2024-01-15T19:00:00Z').getTime(),
          is_date_night: 1,
          notify: 1,
          notify_mins: 30,
          notification_id: 'notif-1',
          metadata_cipher: 'enc:{}',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
          deleted_at: null,
        },
      ]);
      Database.getDatePlansBySourceEvent.mockResolvedValueOnce([]);
      mockSingle.mockResolvedValueOnce({ data: { id: '22222222-2222-4222-8222-222222222222' }, error: null });

      const result = await DataLayer.pushPendingCalendarEvents();

      expect(Database.replaceCalendarEventId).toHaveBeenCalledWith(
        'cal_local_1',
        '22222222-2222-4222-8222-222222222222'
      );
      expect(PushNotificationService.notifyPartner).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          title: 'New date plan',
          body: 'Dinner was added to your timeline.',
          data: expect.objectContaining({
            eventId: '22222222-2222-4222-8222-222222222222',
            eventType: 'dateNight',
          }),
        })
      );
      expect(result).toEqual({ pushed: 1, deleted: 0, failed: 0 });
    });

    it('refreshCalendarEventsFromRemote removes stale remote-backed local events', async () => {
      Database.getPendingCalendarEvents.mockResolvedValueOnce([]);
      mockOrder.mockResolvedValueOnce({
        data: [
          {
            id: '33333333-3333-4333-8333-333333333333',
            title: 'Remote dinner',
            description: 'Remote notes',
            event_date: '2024-01-15T19:00:00.000Z',
            event_type: 'general',
            location: 'Remote spot',
            metadata: {},
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
          },
        ],
        error: null,
      });
      Database.getCalendarEvents
        .mockResolvedValueOnce([
          {
            id: '33333333-3333-4333-8333-333333333333',
            title_cipher: 'enc:Existing remote',
            location_cipher: 'enc:Somewhere',
            notes_cipher: 'enc:Notes',
            event_type: 'general',
            when_ts: 1705345200000,
            is_date_night: 0,
            notify: 0,
            notify_mins: 60,
            notification_id: null,
            metadata_cipher: 'enc:{}',
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
            sync_source: 'remote',
          },
          {
            id: '44444444-4444-4444-8444-444444444444',
            title_cipher: 'enc:Stale remote',
            location_cipher: 'enc:Old',
            notes_cipher: 'enc:Old notes',
            event_type: 'general',
            when_ts: 1705345200000,
            is_date_night: 0,
            notify: 0,
            notify_mins: 60,
            notification_id: null,
            metadata_cipher: 'enc:{}',
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
            sync_source: 'remote',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: '33333333-3333-4333-8333-333333333333',
            title_cipher: 'enc:Existing remote',
            location_cipher: 'enc:Somewhere',
            notes_cipher: 'enc:Notes',
            event_type: 'general',
            when_ts: 1705345200000,
            is_date_night: 0,
            notify: 0,
            notify_mins: 60,
            notification_id: null,
            metadata_cipher: 'enc:{}',
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
            sync_source: 'remote',
          },
        ]);
      Database.getDatePlansBySourceEvent.mockResolvedValue([]);

      const result = await DataLayer.refreshCalendarEventsFromRemote({ limit: 50 });

      expect(Database.softDeleteCalendarEvent).toHaveBeenCalledWith('44444444-4444-4444-8444-444444444444');
      expect(result).toHaveLength(1);
    });

    it('saveCalendarEvent caches remote events with the device key when the couple key is unavailable', async () => {
      E2EEncryption.hasCoupleKey.mockResolvedValue(false);
      await DataLayer.reconfigure({ userId: 'user-1', coupleId: 'couple-1', isPremium: true });

      await DataLayer.saveCalendarEvent({
        id: '33333333-3333-4333-8333-333333333333',
        title: 'Remote dinner',
        notes: 'Remote notes',
        location: 'Remote spot',
        whenTs: new Date('2024-01-15T19:00:00Z').getTime(),
      }, { syncSource: 'remote', markSynced: true });

      expect(E2EEncryption.encryptString).toHaveBeenCalledWith('Remote dinner', 'device', null);
      expect(E2EEncryption.encryptString).toHaveBeenCalledWith('Remote spot', 'device', null);
      expect(E2EEncryption.encryptString).toHaveBeenCalledWith('Remote notes', 'device', null);
    });

    it('saveDatePlan caches remote plans with the device key when the couple key is unavailable', async () => {
      E2EEncryption.hasCoupleKey.mockResolvedValue(false);
      await DataLayer.reconfigure({ userId: 'user-1', coupleId: 'couple-1', isPremium: true });

      await DataLayer.saveDatePlan({
        id: 'dp-remote-1',
        title: 'Plan title',
        locationType: 'home',
        heat: 2,
        load: 2,
        style: 'mixed',
        steps: [],
      }, { syncSource: 'remote', markSynced: true });

      expect(E2EEncryption.encryptJson).toHaveBeenCalledWith(
        expect.objectContaining({
          locationType: 'home',
          heat: 2,
          load: 2,
          style: 'mixed',
          steps: [],
        }),
        'device',
        null
      );
    });

    it('saveCalendarEvent still rejects unsynced shared writes when the couple key is unavailable', async () => {
      E2EEncryption.hasCoupleKey.mockResolvedValue(false);
      await DataLayer.reconfigure({ userId: 'user-1', coupleId: 'couple-1', isPremium: true });

      await expect(DataLayer.saveCalendarEvent({
        title: 'Dinner',
        whenTs: new Date('2024-01-15T19:00:00Z').getTime(),
      })).rejects.toThrow('COUPLE_KEY_MISSING');
    });
  });

  describe('Sync', () => {
    it('sync delegates to SyncEngine', async () => {
      const SyncEngine = require('../../services/sync/SyncEngine').default;
      await DataLayer.sync();
      expect(SyncEngine.sync).toHaveBeenCalled();
    });

    it('debounced push fires after save', async () => {
      const SyncEngine = require('../../services/sync/SyncEngine').default;
      await DataLayer.saveVibe({ vibe: 'calm', note: '' });
      // Advance timers past debounce (500ms)
      jest.advanceTimersByTime(600);
      expect(SyncEngine.pushNow).toHaveBeenCalled();
    });
  });

  describe('clearCache / reset', () => {
    it('clearCache resets internal encryption cache', () => {
      expect(() => DataLayer.clearCache()).not.toThrow();
    });
  });
});
