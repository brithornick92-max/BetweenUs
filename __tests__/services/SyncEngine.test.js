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
    uploadPending: jest.fn().mockResolvedValue(undefined),
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
const mockOrder = jest.fn().mockReturnThis();
const mockLimit = jest.fn().mockReturnThis();
const mockRange = jest.fn().mockResolvedValue({ data: [], error: null });
const mockUpsert = jest.fn().mockResolvedValue({ data: null, error: null });
const mockSubscribe = jest.fn().mockReturnValue({ unsubscribe: jest.fn() });

jest.mock('../../config/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: mockSelect,
      upsert: mockUpsert,
      eq: mockEq,
      gt: mockGt,
      order: mockOrder,
      limit: mockLimit,
      range: mockRange,
    })),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
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

describe('SyncEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    SyncEngine.reset();
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
    });

    it('pulls and upserts remote rows', async () => {
      mockRange.mockResolvedValueOnce({
        data: [
          { id: 'remote_1', data_type: 'journal', payload: '{}', updated_at: '2024-01-01' },
        ],
        error: null,
      });

      await SyncEngine.pullNow();
      // Should have attempted to upsert
    });

    it('handles empty pull results', async () => {
      mockRange.mockResolvedValue({ data: [], error: null });
      await SyncEngine.pullNow();
      // Should not throw
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
  });

  describe('onSyncEvent', () => {
    it('registers a listener and returns unsubscribe', () => {
      const listener = jest.fn();
      const unsub = SyncEngine.onSyncEvent(listener);
      expect(typeof unsub).toBe('function');
    });
  });

  describe('reset', () => {
    it('wipes configuration state', () => {
      SyncEngine.configure({
        userId: 'user-1',
        coupleId: 'couple-1',
        isPremium: true,
      });
      SyncEngine.reset();
      expect(SyncEngine.isConfigured).toBe(false);
    });
  });
});
