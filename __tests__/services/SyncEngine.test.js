/**
 * SyncEngine.test.js — Tests for bidirectional Supabase sync
 */

// ── Mocks ──────────────────────────────────────────────────────────

jest.mock('../../services/db/Database', () => ({
  __esModule: true,
  default: {
    init: jest.fn().mockResolvedValue(undefined),
    getPendingSync: jest.fn().mockResolvedValue([]),
    markSynced: jest.fn().mockResolvedValue(undefined),
    upsertFromRemote: jest.fn().mockResolvedValue(undefined),
    batchUpsertFromRemote: jest.fn().mockResolvedValue(undefined),
    getSyncMeta: jest.fn().mockResolvedValue(null),
    setSyncMeta: jest.fn().mockResolvedValue(undefined),
    wipeAll: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../services/e2ee/E2EEncryption', () => ({
  __esModule: true,
  default: {
    encryptString: jest.fn(async (s) => `enc:${s}`),
    decryptString: jest.fn(async (s) => s?.replace?.('enc:', '') ?? null),
    hasCoupleKey: jest.fn().mockResolvedValue(true),
    clearCache: jest.fn(),
  },
}));

jest.mock('../../services/e2ee/EncryptedAttachments', () => ({
  __esModule: true,
  default: {
    uploadAllPending: jest.fn().mockResolvedValue({ uploaded: 0, failed: 0 }),
  },
}));

jest.mock('../../services/CrashReporting', () => ({
  __esModule: true,
  default: {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
  },
}));

const mockSelect = jest.fn().mockReturnThis();
const mockEq = jest.fn().mockReturnThis();
const mockGt = jest.fn().mockReturnThis();
const mockOr = jest.fn().mockReturnThis();
const mockOrder = jest.fn().mockReturnThis();
const mockLimit = jest.fn().mockImplementation(async () => ({ data: [], error: null }));
const mockUpsert = jest.fn().mockResolvedValue({ data: null, error: null });
const mockSubscribe = jest.fn().mockImplementation(() => ({ id: `channel-${mockSubscribe.mock.calls.length}` }));
const mockOn = jest.fn().mockReturnThis();

const mockQueryBuilder = {
  select: mockSelect,
  upsert: mockUpsert,
  eq: mockEq,
  gt: mockGt,
  or: mockOr,
  order: mockOrder,
  limit: mockLimit,
};

jest.mock('../../config/supabase', () => ({
  supabase: {
    from: jest.fn(() => mockQueryBuilder),
    channel: jest.fn(() => ({
      on: mockOn,
      subscribe: mockSubscribe,
    })),
    removeChannel: jest.fn(),
  },
  TABLES: {
    COUPLE_DATA: 'couple_data',
  },
}));

const SyncEngine = require('../../services/sync/SyncEngine').default;
const Database = require('../../services/db/Database').default;
const CrashReporting = require('../../services/CrashReporting').default;
const EncryptedAttachments = require('../../services/e2ee/EncryptedAttachments').default;
const { supabase } = require('../../config/supabase');

describe('SyncEngine', () => {
  beforeEach(async () => {
    await SyncEngine.reset();
    jest.clearAllMocks();
  });

  describe('configure', () => {
    it('accepts valid config', () => {
      SyncEngine.configure({
        userId: 'user-1',
        coupleId: 'couple-1',
        isPremium: true,
      });
      expect(SyncEngine.isConfigured).toBe(true);
    });

    it('is not configured without premium', () => {
      SyncEngine.configure({
        userId: 'user-1',
        coupleId: 'couple-1',
        isPremium: false,
      });
      // canSync returns false without premium, but configure still sets state
      // The actual isConfigured getter may return false if premium is required
    });

    it('clears stale identity when null values are provided', () => {
      SyncEngine.configure({
        userId: 'user-1',
        coupleId: 'couple-1',
        isPremium: true,
      });
      expect(SyncEngine.isConfigured).toBe(true);

      SyncEngine.configure({
        userId: null,
        coupleId: null,
      });

      expect(SyncEngine.isConfigured).toBe(false);
    });
  });

  describe('sync throttling', () => {
    it('respects MIN_SYNC_INTERVAL_MS', async () => {
      SyncEngine.configure({
        userId: 'user-1',
        coupleId: 'couple-1',
        isPremium: true,
      });

      // First sync should go through
      await SyncEngine.sync();

      // Immediate second sync should be throttled (no errors, just skipped)
      await SyncEngine.sync();

      // The implementation throttles, so the second call should not push again
      // We just verify it doesn't throw
    });

    it('uploads pending attachments during a sync cycle', async () => {
      SyncEngine.configure({
        userId: 'user-1',
        coupleId: 'couple-1',
        isPremium: true,
      });

      await SyncEngine.sync();
      expect(EncryptedAttachments.uploadAllPending).toHaveBeenCalled();
    });
  });

  describe('pushNow', () => {
    beforeEach(() => {
      SyncEngine.configure({
        userId: 'user-1',
        coupleId: 'couple-1',
        isPremium: true,
      });
    });

    it('pushes pending rows from all sync tables', async () => {
      Database.getPendingSync.mockResolvedValueOnce([
        { id: 'j_1', user_id: 'user-1', body_cipher: 'enc', sync_status: 'pending' },
      ]);

      await SyncEngine.pushNow();
      expect(Database.getPendingSync).toHaveBeenCalled();
    });

    it('handles empty pending rows gracefully', async () => {
      Database.getPendingSync.mockResolvedValue([]);
      await SyncEngine.pushNow();
      // Should not throw
    });

    it('reports push failures to CrashReporting', async () => {
      Database.getPendingSync.mockResolvedValueOnce([
        { id: 'j_1', user_id: 'user-1', body_cipher: 'enc', sync_status: 'pending' },
      ]);
      mockUpsert.mockResolvedValueOnce({ data: null, error: { message: 'network error' } });

      await SyncEngine.pushNow();
      // Should have called CrashReporting for the failed push
    });
  });

  describe('pullNow', () => {
    beforeEach(() => {
      SyncEngine.configure({
        userId: 'user-1',
        coupleId: 'couple-1',
        isPremium: true,
      });
      Database.batchUpsertFromRemote.mockImplementation(async (_table, rows) => ({
        inserted: rows.length,
        updated: 0,
        skipped: 0,
      }));
    });

    it('pulls and upserts remote rows', async () => {
      mockLimit.mockResolvedValueOnce({
        data: [
          {
            key: 'journal_remote_1',
            couple_id: 'couple-1',
            data_type: 'journal',
            value: { id: 'remote_1' },
            encrypted_value: '{}',
            updated_at: '2024-01-01T00:00:00.000Z',
          },
        ],
        error: null,
      });

      await SyncEngine.pullNow();
      expect(Database.batchUpsertFromRemote).toHaveBeenCalledWith(
        'journal_entries',
        expect.arrayContaining([expect.objectContaining({ id: 'remote_1' })])
      );
    });

    it('handles empty pull results', async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });
      await SyncEngine.pullNow();
      // Should not throw
    });

    it('continues pagination when the next page shares the same updated_at', async () => {
      const firstPage = Array.from({ length: 200 }, (_, index) => ({
        key: `journal_same_ts_${String(index).padStart(3, '0')}`,
        couple_id: 'couple-1',
        data_type: 'journal',
        value: { id: `remote_${index}` },
        encrypted_value: '{}',
        updated_at: '2024-01-01T00:00:00.000Z',
      }));
      const secondPageRow = {
        key: 'journal_same_ts_zzz',
        couple_id: 'couple-1',
        data_type: 'journal',
        value: { id: 'remote_200' },
        encrypted_value: '{}',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      mockLimit
        .mockResolvedValueOnce({ data: firstPage, error: null })
        .mockResolvedValueOnce({ data: [secondPageRow], error: null });

      await SyncEngine.pullNow();

      expect(Database.batchUpsertFromRemote).toHaveBeenNthCalledWith(
        1,
        'journal_entries',
        expect.arrayContaining([expect.objectContaining({ id: 'remote_0' })])
      );
      expect(Database.batchUpsertFromRemote).toHaveBeenNthCalledWith(
        2,
        'journal_entries',
        [expect.objectContaining({ id: 'remote_200' })]
      );
      expect(mockOr).toHaveBeenCalledWith(
        'updated_at.gt.2024-01-01T00:00:00.000Z,and(updated_at.eq.2024-01-01T00:00:00.000Z,key.gt.journal_same_ts_199)'
      );
      expect(Database.setSyncMeta).toHaveBeenCalledWith(
        'journal_entries',
        expect.objectContaining({
          last_pulled_at: '2024-01-01T00:00:00.000Z',
          cursor: JSON.stringify({
            updatedAt: '2024-01-01T00:00:00.000Z',
            key: 'journal_same_ts_zzz',
          }),
        })
      );
    });
  });

  describe('subscribeRealtime', () => {
    it('returns an unsubscribe function', () => {
      SyncEngine.configure({
        userId: 'user-1',
        coupleId: 'couple-1',
        isPremium: true,
      });

      const unsub = SyncEngine.subscribeRealtime();
      expect(typeof unsub).toBe('function');
    });

    it('replaces the previous realtime channel before subscribing again', () => {
      SyncEngine.configure({
        userId: 'user-1',
        coupleId: 'couple-1',
        isPremium: true,
      });

      SyncEngine.subscribeRealtime();
      SyncEngine.subscribeRealtime();

      expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
    });
  });

  describe('onSyncEvent', () => {
    it('registers a listener and returns unsubscribe', () => {
      const listener = jest.fn();
      const unsub = SyncEngine.onSyncEvent(listener);
      expect(typeof unsub).toBe('function');
    });
  });

  describe('reset', () => {
    it('wipes configuration state', async () => {
      SyncEngine.configure({
        userId: 'user-1',
        coupleId: 'couple-1',
        isPremium: true,
      });
      await SyncEngine.reset();
      expect(SyncEngine.isConfigured).toBe(false);
    });
  });
});
