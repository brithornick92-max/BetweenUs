/**
 * Database.test.js — Tests for local SQLite Database service
 */

// ── Mocks ──────────────────────────────────────────────────────────

const mockExecAsync = jest.fn().mockResolvedValue(undefined);
const mockGetFirstAsync = jest.fn().mockResolvedValue({ user_version: 0 });
const mockRunAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
const mockAllAsync = jest.fn().mockResolvedValue([]);

const mockDb = {
  execAsync: mockExecAsync,
  getFirstAsync: mockGetFirstAsync,
  runAsync: mockRunAsync,
  getAllAsync: mockAllAsync,
  closeAsync: jest.fn().mockResolvedValue(undefined),
};

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockResolvedValue(mockDb),
}));

const Database = require('../../services/db/Database').default;

describe('Database', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset user_version to 0 to trigger migrations
    mockGetFirstAsync.mockResolvedValue({ user_version: 0 });
  });

  describe('init', () => {
    it('opens the database and runs migrations', async () => {
      await Database.init();
      const SQLite = require('expo-sqlite');
      expect(SQLite.openDatabaseAsync).toHaveBeenCalledWith('betweenus.db');
      // Should set WAL mode and foreign keys
      expect(mockExecAsync).toHaveBeenCalledWith('PRAGMA journal_mode = WAL;');
      expect(mockExecAsync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON;');
    });
  });

  describe('Journal CRUD', () => {
    beforeEach(async () => {
      await Database.init();
      jest.clearAllMocks();
    });

    it('insertJournal creates a journal entry', async () => {
      await Database.insertJournal({
        user_id: 'user-1',
        title_cipher: 'enc_title',
        body_cipher: 'enc_body',
        mood: 'happy',
        tags: '["love"]',
        is_private: 0,
      });
      expect(mockRunAsync).toHaveBeenCalled();
      const sql = mockRunAsync.mock.calls[0][0];
      expect(sql).toContain('INSERT');
      expect(sql).toContain('journal_entries');
    });

    it('getJournals queries journal entries by user', async () => {
      mockAllAsync.mockResolvedValueOnce([
        { id: 'j_1', user_id: 'user-1', mood: 'happy', created_at: '2024-01-01' },
      ]);
      const result = await Database.getJournals('user-1', { limit: 10, offset: 0 });
      expect(mockAllAsync).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('softDeleteJournal sets deleted_at and sync_status', async () => {
      await Database.softDeleteJournal('j_1');
      expect(mockRunAsync).toHaveBeenCalled();
      const sql = mockRunAsync.mock.calls[0][0];
      expect(sql).toContain('UPDATE');
      expect(sql).toContain('journal_entries');
      expect(sql).toContain('deleted_at');
    });
  });

  describe('Prompt Answers', () => {
    beforeEach(async () => {
      await Database.init();
      jest.clearAllMocks();
    });

    it('insertPromptAnswer creates a prompt answer', async () => {
      await Database.insertPromptAnswer({
        user_id: 'user-1',
        couple_id: 'couple-1',
        prompt_id: 'prompt-42',
        answer_cipher: 'enc_answer',
        heat_level: 2,
        date_key: '2024-01-15',
      });
      expect(mockRunAsync).toHaveBeenCalled();
      const sql = mockRunAsync.mock.calls[0][0];
      expect(sql).toContain('prompt_answers');
    });

    it('getPromptAnswerByPromptAndDate queries by user+prompt+date', async () => {
      mockGetFirstAsync.mockResolvedValueOnce(null);
      const result = await Database.getPromptAnswerByPromptAndDate('user-1', 'prompt-42', '2024-01-15');
      expect(result).toBeNull();
    });
  });

  describe('Sync helpers', () => {
    beforeEach(async () => {
      await Database.init();
      jest.clearAllMocks();
    });

    it('getPendingSync fetches rows with pending sync_status', async () => {
      mockAllAsync.mockResolvedValueOnce([
        { id: 'j_1', sync_status: 'pending' },
      ]);
      const result = await Database.getPendingSync('journal_entries');
      expect(mockAllAsync).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('markSynced updates sync_status to synced', async () => {
      await Database.markSynced('journal_entries', ['j_1', 'j_2']);
      expect(mockRunAsync).toHaveBeenCalled();
    });

    it('assertValidTable rejects invalid table names', async () => {
      await expect(Database.getPendingSync('evil_table; DROP TABLE--')).rejects.toThrow(
        'Invalid table name'
      );
    });

    it('upsertFromRemote inserts or updates a row', async () => {
      // Mock: row doesn't exist yet
      mockGetFirstAsync.mockResolvedValueOnce(null);
      const row = {
        id: 'j_remote_1',
        user_id: 'user-1',
        body_cipher: 'remote_enc',
        created_at: '2024-01-01',
        updated_at: '2024-01-02',
      };
      await Database.upsertFromRemote('journal_entries', row);
      expect(mockRunAsync).toHaveBeenCalled();
    });
  });

  describe('Maintenance', () => {
    beforeEach(async () => {
      await Database.init();
      jest.clearAllMocks();
    });

    it('purgeDeleted removes soft-deleted rows older than threshold', async () => {
      await Database.purgeDeleted(30);
      // Should run a DELETE query for each table
      expect(mockRunAsync).toHaveBeenCalled();
    });

    it('wipeAll drops and recreates all data', async () => {
      await Database.wipeAll();
      // wipeAll uses runAsync to DELETE from each table
      expect(mockRunAsync).toHaveBeenCalled();
    });
  });

  describe('Love Notes', () => {
    beforeEach(async () => {
      await Database.init();
      jest.clearAllMocks();
    });

    it('insertLoveNote creates a love note', async () => {
      await Database.insertLoveNote({
        user_id: 'user-1',
        couple_id: 'couple-1',
        text_cipher: 'encrypted_text',
        stationery_id: 'default',
        sender_name: 'Alice',
      });
      expect(mockRunAsync).toHaveBeenCalled();
      const sql = mockRunAsync.mock.calls[0][0];
      expect(sql).toContain('love_notes');
    });

    it('getUnreadLoveNoteCount returns count', async () => {
      mockGetFirstAsync.mockResolvedValueOnce({ count: 3 });
      const count = await Database.getUnreadLoveNoteCount('user-1', 'couple-1');
      expect(count).toBe(3);
    });
  });

  describe('Check-ins', () => {
    beforeEach(async () => {
      await Database.init();
      jest.clearAllMocks();
    });

    it('insertCheckIn creates a check-in', async () => {
      await Database.insertCheckIn({
        user_id: 'user-1',
        couple_id: 'couple-1',
        mood: 'content',
        intimacy: 7,
        notes_cipher: 'enc_notes',
        date_key: '2024-01-15',
      });
      expect(mockRunAsync).toHaveBeenCalled();
    });

    it('getCheckInByDate returns null for missing date', async () => {
      mockGetFirstAsync.mockResolvedValueOnce(null);
      const result = await Database.getCheckInByDate('user-1', '2024-01-15');
      expect(result).toBeNull();
    });
  });
});
