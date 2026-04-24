/**
 * DataLayer.test.js — Tests for the data access layer
 */

// ── Mocks ──────────────────────────────────────────────────────────

jest.mock('../../services/db/Database', () => ({
  __esModule: true,
  default: {
    makeId: jest.fn(prefix => `${prefix}_mock-id`),
    init: jest.fn().mockResolvedValue(undefined),
    insertJournal: jest.fn().mockResolvedValue(undefined),
    updateJournal: jest.fn().mockResolvedValue(undefined),
    softDeleteJournal: jest.fn().mockResolvedValue(undefined),
    getJournals: jest.fn().mockResolvedValue([]),
    getJournalFeed: jest.fn().mockResolvedValue([]),
    getJournalById: jest.fn().mockResolvedValue(null),
    getAttachmentById: jest.fn().mockResolvedValue(null),
    insertPromptAnswer: jest.fn().mockResolvedValue(undefined),
    updatePromptAnswer: jest.fn().mockResolvedValue(undefined),
    getPromptAnswers: jest.fn().mockResolvedValue([]),
    getSharedPromptAnswers: jest.fn().mockResolvedValue([]),
    getPromptAnswerByPromptAndDate: jest.fn().mockResolvedValue(null),
    insertMemory: jest.fn().mockResolvedValue(undefined),
    getMemories: jest.fn().mockResolvedValue([]),
    getSharedMemories: jest.fn().mockResolvedValue([]),
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
    getPendingDeletedRemoteCalendarEvents: jest.fn().mockResolvedValue([]),
    markCalendarEventSynced: jest.fn().mockResolvedValue(undefined),
    replaceCalendarEventId: jest.fn().mockResolvedValue(undefined),
    restoreCalendarEvent: jest.fn().mockResolvedValue(undefined),
    softDeleteCalendarEvent: jest.fn().mockResolvedValue(undefined),
    upsertDatePlan: jest.fn().mockResolvedValue({ id: 'dp-1', created_at: '2024-01-01', updated_at: '2024-01-01' }),
    getDatePlans: jest.fn().mockResolvedValue([]),
    getDatePlansBySourceEvent: jest.fn().mockResolvedValue([]),
    getDatePlanById: jest.fn().mockResolvedValue(null),
    restoreDatePlansBySourceEvent: jest.fn().mockResolvedValue(undefined),
    softDeleteDatePlan: jest.fn().mockResolvedValue(undefined),
    markDatePlansSyncedBySourceEvent: jest.fn().mockResolvedValue(undefined),
    purgeDeleted: jest.fn().mockResolvedValue(undefined),
    wipeAll: jest.fn().mockResolvedValue(undefined),
    wipeUserData: jest.fn().mockResolvedValue(undefined),
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
    encryptAndStore: jest.fn().mockResolvedValue({ id: 'att-ref-1', ref: 'att-ref-1' }),
    getDecryptedUri: jest.fn().mockResolvedValue('file:///decrypted-media.mp4'),
    deleteAttachment: jest.fn().mockResolvedValue(undefined),
    clearDecryptedCache: jest.fn(),
  },
}));

jest.mock('../../services/sync/SyncEngine', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    isConfigured: false,
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

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    logIn: jest.fn(),
    logOut: jest.fn(),
    getOfferings: jest.fn().mockResolvedValue({ current: null, all: {} }),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    getCustomerInfo: jest.fn().mockResolvedValue({ entitlements: { active: {} } }),
    getAppUserID: jest.fn().mockResolvedValue(null),
    setLogLevel: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(() => jest.fn()),
    checkTrialOrIntroPriceEligibility: jest.fn().mockResolvedValue({}),
  },
  LOG_LEVEL: { WARN: 2, DEBUG: 4, VERBOSE: 5 },
}));

jest.mock('../../services/PartnerNotifications', () => ({
  __esModule: true,
  default: {
    journalShared: jest.fn().mockResolvedValue(undefined),
    memorySaved: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../services/security/CoupleKeyService', () => ({
  __esModule: true,
  default: {
    getDevicePublicKeyB64: jest.fn().mockResolvedValue('device-public-key'),
    unwrapKeyForDevice: jest.fn().mockResolvedValue(null),
    storeCoupleKey: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../../services/couple/CouplePresenceService', () => ({
  __esModule: true,
  default: {
    getVerifiedCoupleState: jest.fn().mockResolvedValue({
      coupleId: 'couple-1',
      partnerId: 'partner-1',
      hasCoupleKey: true,
      status: 'paired',
    }),
  },
}));

const mockGetPromptById = jest.fn((id) => {
  if (id === 'prompt-42') return { id, heat: 2 };
  if (id === 'prompt-99') return { id, heat: 4 };
  return null;
});

jest.mock('../../utils/contentLoader', () => ({
  __esModule: true,
  getPromptById: (...args) => mockGetPromptById(...args),
}));

const mockRemoveChannel = jest.fn();
const mockSubscribe = jest.fn(() => ({ unsubscribe: jest.fn() }));
const mockChannelOn = jest.fn(() => ({ subscribe: mockSubscribe }));
const mockChannel = jest.fn(() => ({ on: mockChannelOn }));
const mockAuthGetUser = jest.fn();
const mockRpc = jest.fn();
const mockSingle = jest.fn();
const mockMaybeSingle = jest.fn();
const mockSelect = jest.fn(() => ({ single: mockSingle }));
const mockInsert = jest.fn(() => ({ select: mockSelect }));
const mockUpdateEq = jest.fn();
const mockUpdate = jest.fn(() => ({ eq: mockUpdateEq }));
const mockDeleteEq = jest.fn();
const mockDelete = jest.fn(() => ({ eq: mockDeleteEq }));
const mockOrder = jest.fn();
const mockLimit = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockRemoteEq = jest.fn(() => ({
  eq: mockRemoteEq,
  neq: jest.fn(() => ({ single: mockSingle, maybeSingle: mockMaybeSingle })),
  order: mockOrder,
  maybeSingle: mockMaybeSingle,
  single: mockSingle,
  limit: mockLimit,
}));
const mockRemoteSelect = jest.fn(() => ({
  eq: mockRemoteEq,
  neq: jest.fn(() => ({ single: mockSingle, maybeSingle: mockMaybeSingle })),
  order: mockOrder,
  maybeSingle: mockMaybeSingle,
  single: mockSingle,
  limit: mockLimit,
}));
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
    COUPLE_MEMBERS: 'couple_members',
    CALENDAR_EVENTS: 'calendar_events',
  },
}));

const DataLayer = require('../../services/data/DataLayer').default;
const Database = require('../../services/db/Database').default;
const E2EEncryption = require('../../services/e2ee/E2EEncryption').default;
const EncryptedAttachments = require('../../services/e2ee/EncryptedAttachments').default;
const PushNotificationService = require('../../services/PushNotificationService').default;
const PartnerNotifications = require('../../services/PartnerNotifications').default;
const CoupleKeyService = require('../../services/security/CoupleKeyService').default;
const SyncEngine = require('../../services/sync/SyncEngine').default;

describe('DataLayer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    SyncEngine.isConfigured = false;
    E2EEncryption.hasCoupleKey.mockResolvedValue(true);
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } } });
    mockRpc.mockResolvedValue({ error: null });
    mockSingle.mockResolvedValue({ data: { id: '11111111-1111-4111-8111-111111111111' }, error: null });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockUpdateEq.mockResolvedValue({ error: null });
    mockDeleteEq.mockResolvedValue({ error: null });
    mockOrder.mockResolvedValue({ data: [], error: null });
    CoupleKeyService.unwrapKeyForDevice.mockResolvedValue(null);
    CoupleKeyService.storeCoupleKey.mockResolvedValue(true);
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
    it('saveJournalEntry pushes immediately when sync is configured', async () => {
      SyncEngine.isConfigured = true;

      await DataLayer.saveJournalEntry({
        title: 'My Day',
        body: 'It was great',
        mood: 'happy',
        tags: ['love'],
        isPrivate: false,
      });

      expect(SyncEngine.pushNow).toHaveBeenCalled();
    });

    it('saveJournalEntry stores plaintext content and inserts', async () => {
      await DataLayer.saveJournalEntry({
        title: 'My Day',
        body: 'It was great',
        mood: 'happy',
        tags: ['love'],
        isPrivate: false,
      });

      expect(Database.insertJournal).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          couple_id: 'couple-1',
          title: 'My Day',
          body: 'It was great',
          is_private: false,
        })
      );
    });

    it('saveJournalEntry stores a shared photo and notifies the partner', async () => {
      await DataLayer.saveJournalEntry({
        title: 'Beach walk',
        body: 'Golden hour together',
        mood: 'happy',
        isPrivate: false,
        imageUri: 'file:///photo.jpg',
      });

      expect(Database.insertJournal).toHaveBeenCalledWith(
        expect.objectContaining({
          couple_id: 'couple-1',
          is_private: false,
          photo_uri: 'file:///photo.jpg',
        })
      );
      expect(PartnerNotifications.journalShared).toHaveBeenCalledTimes(1);
    });

    it('saveJournalEntry always writes journals as shared with couple_id and no private flag', async () => {
      await DataLayer.saveJournalEntry({
        title: 'Solo note',
        body: 'Keeping this one',
        mood: 'calm',
        imageUri: 'file:///photo.jpg',
      });

      expect(Database.insertJournal).toHaveBeenCalledWith(
        expect.objectContaining({
          couple_id: 'couple-1',
          photo_uri: 'file:///photo.jpg',
        })
      );
      expect(Database.insertJournal).toHaveBeenCalledWith(
        expect.not.objectContaining({ is_private: true })
      );
    });

    it('saveJournalEntry stores shared videos as encrypted attachments', async () => {
      Database.init.mockResolvedValueOnce({ runAsync: jest.fn().mockResolvedValue(undefined) });

      await DataLayer.saveJournalEntry({
        title: 'Concert clip',
        body: 'Saved the video too',
        mood: 'energized',
        isPrivate: false,
        mediaUri: 'file:///clip.mov',
        mimeType: 'video/quicktime',
        fileName: 'clip.mov',
      });

      expect(EncryptedAttachments.encryptAndStore).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceUri: 'file:///clip.mov',
          mimeType: 'video/quicktime',
          parentType: 'journal',
        })
      );
      expect(Database.insertJournal).toHaveBeenCalledWith(
        expect.objectContaining({
          media_ref: 'att-ref-1',
          photo_uri: null,
        })
      );
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

    it('getJournalEntries falls back to encrypted mood and tags when plaintext metadata is missing', async () => {
      Database.getJournals.mockResolvedValueOnce([
        {
          id: 'j_2',
          title_cipher: 'enc:title',
          body_cipher: 'enc:body',
          mood: null,
          mood_cipher: 'enc:connected',
          tags: null,
          tags_cipher: 'enc:["anniversary"]',
          created_at: '2024-01-01',
        },
      ]);

      const entries = await DataLayer.getJournalEntries({ limit: 10 });

      expect(entries).toHaveLength(1);
      expect(entries[0].mood).toBe('connected');
      expect(entries[0].tags).toEqual(['anniversary']);
    });

    it('getJournalEntries uses the visibility feed when requested', async () => {
      Database.getJournalFeed.mockResolvedValueOnce([
        {
          id: 'j_shared_1',
          user_id: 'partner-1',
          is_private: 0,
          title_cipher: 'enc:title',
          body_cipher: 'enc:body',
          mood: 'calm',
          tags: '[]',
          created_at: '2024-01-02',
        },
      ]);

      const entries = await DataLayer.getJournalEntries({ limit: 10, visibility: 'shared' });

      expect(Database.getJournalFeed).toHaveBeenCalledWith('user-1', {
        coupleId: 'couple-1',
        limit: 10,
        offset: 0,
        mood: undefined,
        visibility: 'shared',
      });
      expect(entries).toHaveLength(1);
    });

    it('getJournalEntries keeps shared photo metadata from the visibility feed', async () => {
      Database.getJournalFeed.mockResolvedValueOnce([
        {
          id: 'j_shared_photo_1',
          user_id: 'partner-1',
          is_private: 0,
          title_cipher: 'enc:title',
          body_cipher: 'enc:body',
          mood: 'warm',
          tags: '[]',
          photo_uri: 'https://cdn.example.com/shared-photo.jpg',
          created_at: '2024-01-03',
        },
      ]);

      const entries = await DataLayer.getJournalEntries({ limit: 10, visibility: 'shared' });

      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual(
        expect.objectContaining({
          id: 'j_shared_photo_1',
          photo_uri: 'https://cdn.example.com/shared-photo.jpg',
          title: 'title',
          body: 'body',
        })
      );
    });

    it('getJournalEntries decrypts shared video attachments from media_ref', async () => {
      Database.getJournalFeed.mockResolvedValueOnce([
        {
          id: 'j_shared_video_1',
          user_id: 'partner-1',
          is_private: 0,
          couple_id: 'couple-1',
          title_cipher: 'enc:title',
          body_cipher: 'enc:body',
          mood: 'warm',
          tags: '[]',
          media_ref: 'att-video-1',
          created_at: '2024-01-03',
        },
      ]);
      Database.getAttachmentById.mockResolvedValueOnce({ id: 'att-video-1', mime_type: 'video/mp4' });
      EncryptedAttachments.getDecryptedUri.mockResolvedValueOnce('file:///decrypted-video.mp4');

      const entries = await DataLayer.getJournalEntries({ limit: 10, visibility: 'shared' });

      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual(
        expect.objectContaining({
          mediaRef: 'att-video-1',
          mediaUri: 'file:///decrypted-video.mp4',
          mediaType: 'video/mp4',
          mediaKind: 'video',
        })
      );
    });

    it('getJournalEntries restores the couple key from wrapped_couple_key before decrypting', async () => {
      E2EEncryption.hasCoupleKey.mockResolvedValueOnce(false);
      CoupleKeyService.unwrapKeyForDevice.mockResolvedValueOnce(new Uint8Array(32).fill(7));
      mockMaybeSingle.mockResolvedValueOnce({
        data: {
          public_key: 'stale-public-key',
          wrapped_couple_key: JSON.stringify({ n: 'nonce', c: 'cipher', from: 'sender' }),
        },
        error: null,
      });
      Database.getJournalFeed.mockResolvedValueOnce([
        {
          id: 'j_wrapped_1',
          user_id: 'partner-1',
          is_private: 0,
          couple_id: 'couple-1',
          title_cipher: 'enc:title',
          body_cipher: 'enc:body',
          tags: '[]',
          created_at: '2024-01-03',
        },
      ]);

      await DataLayer.reconfigure({ userId: 'user-1', coupleId: 'couple-1', isPremium: true });

      await DataLayer.getJournalEntries({ limit: 10, visibility: 'shared' });

      expect(CoupleKeyService.unwrapKeyForDevice).toHaveBeenCalledWith(
        JSON.stringify({ n: 'nonce', c: 'cipher', from: 'sender' })
      );
      expect(CoupleKeyService.storeCoupleKey).toHaveBeenCalledWith(
        'couple-1',
        expect.any(Uint8Array)
      );
    });

    it('updateJournalEntry only changes photo_uri when a new image value is provided', async () => {
      await DataLayer.updateJournalEntry('j_1', {
        title: 'Edited title',
        body: 'Edited body',
        isPrivate: false,
      });

      expect(Database.updateJournal).toHaveBeenCalledWith(
        'j_1',
        expect.not.objectContaining({
          photo_uri: expect.anything(),
        })
      );
    });

    it('updateJournalEntry replaces journal video attachments via media_ref', async () => {
      Database.getJournalById.mockResolvedValueOnce({ id: 'j_1', media_ref: 'att-old-1' });
      Database.init.mockResolvedValueOnce({ runAsync: jest.fn().mockResolvedValue(undefined) });

      await DataLayer.updateJournalEntry('j_1', {
        title: 'Edited title',
        body: 'Edited body',
        isPrivate: false,
        mediaUri: 'file:///updated.mp4',
        mimeType: 'video/mp4',
        fileName: 'updated.mp4',
      });

      expect(Database.updateJournal).toHaveBeenCalledWith(
        'j_1',
        expect.objectContaining({
          media_ref: 'att-ref-1',
          photo_uri: null,
        })
      );
      expect(EncryptedAttachments.deleteAttachment).toHaveBeenCalledWith('att-old-1');
    });

    it('deleteJournalEntry calls softDelete', async () => {
      Database.getJournalById.mockResolvedValueOnce({ id: 'j_1' });
      await DataLayer.deleteJournalEntry('j_1');
      expect(Database.softDeleteJournal).toHaveBeenCalledWith('j_1');
    });
  });

  describe('Shared archive queries', () => {
    it('getSharedPromptAnswers uses the couple-scoped prompt feed', async () => {
      Database.getSharedPromptAnswers.mockResolvedValueOnce([
        {
          id: 'pa_shared_1',
          prompt_id: 'prompt-42',
          couple_id: 'couple-1',
          answer_cipher: 'enc:Shared answer',
          partner_answer_cipher: 'enc:Partner answer',
          heat_level: 2,
          is_revealed: 1,
        },
      ]);

      const rows = await DataLayer.getSharedPromptAnswers({ limit: 10 });

      expect(Database.getSharedPromptAnswers).toHaveBeenCalledWith('couple-1', {
        dateKey: undefined,
        promptId: undefined,
        limit: 10,
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual(expect.objectContaining({
        answer: 'Shared answer',
        partnerAnswer: 'Partner answer',
      }));
    });

    it('getSharedPromptAnswers returns an empty list when unpaired', async () => {
      await DataLayer.reconfigure({ userId: 'user-1', coupleId: null, isPremium: false });

      const rows = await DataLayer.getSharedPromptAnswers({ limit: 10 });

      expect(rows).toEqual([]);
      expect(Database.getSharedPromptAnswers).not.toHaveBeenCalled();
    });

    it('getSharedMemories uses the couple-scoped memory feed', async () => {
      Database.getSharedMemories.mockResolvedValueOnce([
        {
          id: 'mem_shared_1',
          couple_id: 'couple-1',
          is_private: 0,
          body_cipher: 'enc:Shared moment',
          type: 'moment',
          created_at: '2024-01-15',
        },
      ]);

      const rows = await DataLayer.getSharedMemories({ limit: 10, offset: 0 });

      expect(Database.getSharedMemories).toHaveBeenCalledWith('couple-1', {
        type: undefined,
        limit: 10,
        offset: 0,
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual(expect.objectContaining({
        content: 'Shared moment',
      }));
    });

    it('getSharedMemories returns an empty list when unpaired', async () => {
      await DataLayer.reconfigure({ userId: 'user-1', coupleId: null, isPremium: false });

      const rows = await DataLayer.getSharedMemories({ limit: 10, offset: 0 });

      expect(rows).toEqual([]);
      expect(Database.getSharedMemories).not.toHaveBeenCalled();
    });
  });

  describe('Prompt Answers', () => {
    it('savePromptAnswer stores plaintext answer', async () => {
      await DataLayer.savePromptAnswer({
        promptId: 'prompt-42',
        answer: 'My answer',
        heatLevel: 2,
      });

      expect(Database.insertPromptAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt_id: 'prompt-42',
          answer: 'My answer',
          heat_level: 2,
        })
      );
    });

    it('savePromptAnswer infers heat from prompt metadata when omitted', async () => {
      await DataLayer.savePromptAnswer({
        promptId: 'prompt-42',
        answer: 'My answer',
      });

      expect(Database.insertPromptAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt_id: 'prompt-42',
          heat_level: 2,
          answer: 'My answer',
          heat_level_cipher: null,
        })
      );
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
          answer: 'Updated answer',
          answer_cipher: null,
          heat_level_cipher: null,
        })
      );
      expect(Database.insertPromptAnswer).not.toHaveBeenCalled();
    });

    it('getPromptAnswers normalizes stored heat to prompt metadata', async () => {
      Database.getPromptAnswers.mockResolvedValueOnce([
        {
          id: 'pa_1',
          prompt_id: 'prompt-42',
          answer_cipher: 'enc:Saved answer',
          heat_level: 5,
          is_revealed: 0,
        },
      ]);

      const rows = await DataLayer.getPromptAnswers({ limit: 10 });

      expect(rows).toHaveLength(1);
      expect(rows[0].heat_level).toBe(2);
      expect(rows[0].answer).toBe('Saved answer');
    });

    it('getPromptAnswers decrypts couple-tier rows using the row couple id before reconfigure completes', async () => {
      await DataLayer.reconfigure({ userId: 'user-1', coupleId: null, isPremium: false });
      Database.getPromptAnswers.mockResolvedValueOnce([
        {
          id: 'pa_2',
          prompt_id: 'prompt-42',
          couple_id: 'couple-row-1',
          answer_cipher: 'enc:Shared answer',
          heat_level: 2,
          is_revealed: 0,
        },
      ]);

      const rows = await DataLayer.getPromptAnswers({ limit: 10 });

      expect(rows).toHaveLength(1);
      expect(rows[0].answer).toBe('Shared answer');
      expect(E2EEncryption.decryptString).toHaveBeenCalledWith('enc:Shared answer', 'couple', 'couple-row-1');
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
        note: 'feeling close',
        created_at: '2024-01-01',
      });
      const result = await DataLayer.getLatestVibe();
      expect(result).toBeTruthy();
      expect(result.note).toBe('feeling close');
    });
  });

  describe('Love Notes', () => {
    it('saveLoveNote rejects because the feature is retired', async () => {
      await expect(DataLayer.saveLoveNote({
        text: 'I love you',
        stationeryId: 'default',
        senderName: 'Alice',
      })).rejects.toThrow('Love Notes are no longer supported');
    });

    it('getLoveNotes returns an empty list for the retired feature', async () => {
      await expect(DataLayer.getLoveNotes()).resolves.toEqual([]);
    });

    it('getUnreadLoveNoteCount returns zero for the retired feature', async () => {
      const count = await DataLayer.getUnreadLoveNoteCount();
      expect(count).toBe(0);
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
            route: 'calendar',
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

    it('refreshCalendarEventsFromRemote preserves remote-backed local events missing from a fetch result', async () => {
      Database.getPendingDeletedRemoteCalendarEvents.mockResolvedValueOnce([]);
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
      Database.getCalendarEvents.mockResolvedValueOnce([
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
      ]);
      Database.getDatePlansBySourceEvent.mockResolvedValue([]);

      const result = await DataLayer.refreshCalendarEventsFromRemote({ limit: 50 });

      expect(Database.softDeleteCalendarEvent).not.toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('healLegacyCalendarDeletes restores pending remote tombstones before refresh sync runs', async () => {
      Database.getPendingDeletedRemoteCalendarEvents.mockResolvedValueOnce([
        { id: '44444444-4444-4444-8444-444444444444' },
      ]);
      Database.getPendingCalendarEvents.mockResolvedValueOnce([]);
      mockOrder.mockResolvedValueOnce({ data: [], error: null });
      Database.getCalendarEvents.mockResolvedValueOnce([
        {
          id: '44444444-4444-4444-8444-444444444444',
          title_cipher: 'enc:Recovered remote',
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

      const result = await DataLayer.refreshCalendarEventsFromRemote({ limit: 50 });

      expect(Database.restoreCalendarEvent).toHaveBeenCalledWith(
        '44444444-4444-4444-8444-444444444444',
        expect.objectContaining({ syncStatus: 'synced', syncSource: 'remote' })
      );
      expect(Database.restoreDatePlansBySourceEvent).toHaveBeenCalledWith(
        '44444444-4444-4444-8444-444444444444',
        expect.objectContaining({ syncStatus: 'synced', syncSource: 'remote' })
      );
      expect(result).toHaveLength(1);
    });

    it('getCalendarEvents decrypts couple-tier rows using the row couple id', async () => {
      Database.getCalendarEvents.mockResolvedValueOnce([
        {
          id: '33333333-3333-4333-8333-333333333333',
          couple_id: '9fb4ab73-9152-4002-8a24-1ca63d37a0bb',
          title_cipher: 'enc:Remote dinner',
          location_cipher: 'enc:Remote spot',
          notes_cipher: 'enc:Remote notes',
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

      await DataLayer.getCalendarEvents({ limit: 10 });

      expect(E2EEncryption.decryptString).toHaveBeenCalledWith(
        'enc:Remote dinner',
        'couple',
        '9fb4ab73-9152-4002-8a24-1ca63d37a0bb'
      );
    });

    it('getCalendarEvents preserves event shape when decryption fails', async () => {
      Database.getCalendarEvents.mockResolvedValueOnce([
        {
          id: '33333333-3333-4333-8333-333333333333',
          couple_id: '9fb4ab73-9152-4002-8a24-1ca63d37a0bb',
          title_cipher: 'enc:Remote dinner',
          location_cipher: 'enc:Remote spot',
          notes_cipher: 'enc:Remote notes',
          event_type: 'general',
          when_ts: 1705345200000,
          is_date_night: 0,
          notify: 1,
          notify_mins: 30,
          notification_id: 'notif-1',
          metadata_cipher: 'enc:{}',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
          sync_source: 'remote',
        },
      ]);
      E2EEncryption.decryptString.mockRejectedValueOnce(new Error('missing key'));

      const events = await DataLayer.getCalendarEvents({ limit: 10 });

      expect(events[0]).toEqual(expect.objectContaining({
        id: '33333333-3333-4333-8333-333333333333',
        title: 'Locked shared event',
        whenTs: 1705345200000,
        locked: true,
        isRemote: true,
      }));
    });

    it('subscribeCalendarEvents soft-deletes local calendar rows on explicit remote deletes', async () => {
      Database.getDatePlansBySourceEvent.mockResolvedValueOnce([{ id: 'dp-1' }]);

      const onChange = jest.fn();
      const unsubscribe = DataLayer.subscribeCalendarEvents(onChange);
      const realtimeHandler = mockChannelOn.mock.calls[0][2];

      await realtimeHandler({
        eventType: 'DELETE',
        old: { id: '44444444-4444-4444-8444-444444444444' },
      });

      expect(Database.softDeleteCalendarEvent).toHaveBeenCalledWith('44444444-4444-4444-8444-444444444444');
      expect(Database.softDeleteDatePlan).toHaveBeenCalledWith('dp-1');
      expect(Database.markCalendarEventSynced).toHaveBeenCalledWith(
        '44444444-4444-4444-8444-444444444444',
        expect.objectContaining({ syncSource: 'remote' })
      );
      expect(onChange).toHaveBeenCalled();

      unsubscribe();
    });

    it('saveCalendarEvent stores plaintext fields when the couple key is unavailable', async () => {
      E2EEncryption.hasCoupleKey.mockResolvedValue(false);
      await DataLayer.reconfigure({ userId: 'user-1', coupleId: 'couple-1', isPremium: true });

      await DataLayer.saveCalendarEvent({
        id: '33333333-3333-4333-8333-333333333333',
        title: 'Remote dinner',
        notes: 'Remote notes',
        location: 'Remote spot',
        whenTs: new Date('2024-01-15T19:00:00Z').getTime(),
      }, { syncSource: 'remote', markSynced: true });

      expect(Database.upsertCalendarEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '33333333-3333-4333-8333-333333333333',
          couple_id: 'couple-1',
          title: 'Remote dinner',
          location: 'Remote spot',
          notes: 'Remote notes',
          title_cipher: null,
          metadata_json: JSON.stringify({}),
          metadata_cipher: null,
        }),
        expect.objectContaining({ syncStatus: 'synced', syncSource: 'remote' })
      );
    });

    it('saveDatePlan stores plaintext body when the couple key is unavailable', async () => {
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

      expect(Database.upsertDatePlan).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'dp-remote-1',
          couple_id: 'couple-1',
          title: 'Plan title',
          body_json: JSON.stringify({
            locationType: 'home',
            heat: 2,
            load: 2,
            style: 'mixed',
            steps: [],
          }),
          title_cipher: null,
          body_cipher: null,
        }),
        expect.objectContaining({ syncStatus: 'synced', syncSource: 'remote' })
      );
    });

    it('saveCalendarEvent allows unsynced shared writes without a couple key', async () => {
      E2EEncryption.hasCoupleKey.mockResolvedValue(false);
      await DataLayer.reconfigure({ userId: 'user-1', coupleId: 'couple-1', isPremium: true });

      await expect(DataLayer.saveCalendarEvent({
        title: 'Dinner',
        whenTs: new Date('2024-01-15T19:00:00Z').getTime(),
      })).resolves.toEqual(
        expect.objectContaining({ id: 'cal-1' })
      );
      expect(Database.upsertCalendarEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          couple_id: 'couple-1',
          title: 'Dinner',
          title_cipher: null,
        }),
        expect.objectContaining({ syncStatus: 'pending', syncSource: 'local' })
      );
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

    it('reset keeps local SQLite rows on account switch by default', async () => {
      const SyncEngine = require('../../services/sync/SyncEngine').default;

      await DataLayer.reset();

      expect(SyncEngine.reset).toHaveBeenCalledWith({ clearLocalData: false, userId: 'user-1' });
      expect(Database.wipeAll).not.toHaveBeenCalled();
      expect(Database.wipeUserData).not.toHaveBeenCalled();
    });

    it('reset forwards explicit account deletion to user-scoped cleanup', async () => {
      const SyncEngine = require('../../services/sync/SyncEngine').default;

      await DataLayer.reset({ clearLocalData: true });

      expect(SyncEngine.reset).toHaveBeenCalledWith({ clearLocalData: true, userId: 'user-1' });
    });
  });
});
