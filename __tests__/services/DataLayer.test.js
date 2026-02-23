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

const DataLayer = require('../../services/data/DataLayer').default;
const Database = require('../../services/db/Database').default;
const E2EEncryption = require('../../services/e2ee/E2EEncryption').default;

describe('DataLayer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
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

    it('getUnreadLoveNoteCount returns count', async () => {
      Database.getUnreadLoveNoteCount.mockResolvedValueOnce(5);
      const count = await DataLayer.getUnreadLoveNoteCount();
      expect(count).toBe(5);
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
