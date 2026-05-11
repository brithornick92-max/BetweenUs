const mockGetMemories = jest.fn();
const mockGetSharedMemories = jest.fn();
const mockSaveMemory = jest.fn();
const mockUpdateMemory = jest.fn();
const mockDeleteMemory = jest.fn();
const AsyncStorage = require('@react-native-async-storage/async-storage');
let localStorage;

jest.mock('../../services/localfirst', () => ({
  DataLayer: {
    getMemories: (...args) => mockGetMemories(...args),
    getSharedMemories: (...args) => mockGetSharedMemories(...args),
    saveMemory: (...args) => mockSaveMemory(...args),
    updateMemory: (...args) => mockUpdateMemory(...args),
    deleteMemory: (...args) => mockDeleteMemory(...args),
  },
}));

const {
  DATE_COMPLETION_HIDE_DAYS,
  getDateHistory,
  getRecentlyCompletedDateIds,
  removeDateSavedKeepsake,
  saveDateHistoryEntry,
  saveDateSavedKeepsake,
} = require('../../utils/dateHistory');
const {
  getIntimacyTried,
  toggleIntimacyFavorite,
  toggleIntimacyTried,
} = require('../../utils/intimacyFavorites');

describe('Keepsake history writers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage = new Map();
    AsyncStorage.getItem.mockImplementation(async (key) => (
      localStorage.has(key) ? localStorage.get(key) : null
    ));
    AsyncStorage.setItem.mockImplementation(async (key, value) => {
      localStorage.set(key, value);
    });
    AsyncStorage.removeItem.mockImplementation(async (key) => {
      localStorage.delete(key);
    });
    mockGetMemories.mockResolvedValue([]);
    mockGetSharedMemories.mockResolvedValue([]);
    mockSaveMemory.mockResolvedValue({ id: 'memory-1', created_at: '2026-04-28T12:00:00.000Z' });
    mockUpdateMemory.mockResolvedValue({ id: 'memory-1' });
    mockDeleteMemory.mockResolvedValue(undefined);
  });

  it('only suppresses recently completed dates for the configured cooldown window', () => {
    const now = new Date('2026-04-29T12:00:00.000Z').getTime();
    const recent = now - ((DATE_COMPLETION_HIDE_DAYS - 1) * 24 * 60 * 60 * 1000);
    const old = now - ((DATE_COMPLETION_HIDE_DAYS + 1) * 24 * 60 * 60 * 1000);

    const ids = getRecentlyCompletedDateIds([
      { id: 'recent-date', addedAt: recent },
      { id: 'old-date', addedAt: old },
    ], now);

    expect(ids.has('recent-date')).toBe(true);
    expect(ids.has('old-date')).toBe(false);
  });

  it('saves dates tried as date_tried memories for Keepsake', async () => {
    const date = {
      id: 'date-1',
      title: 'Coffee walk',
      heat: 1,
      load: 1,
      style: 'talking',
      minutes: 45,
      location: 'out',
    };

    const result = await saveDateHistoryEntry(date);

    expect(mockSaveMemory).toHaveBeenCalledWith(expect.objectContaining({
      type: 'date_tried',
      mood: 'talking',
      isPrivate: false,
    }));

    const payload = JSON.parse(mockSaveMemory.mock.calls[0][0].content);
    expect(payload).toEqual(expect.objectContaining({
      kind: 'date_history',
      dateId: 'date-1',
      title: 'Coffee walk',
    }));

    expect(result.entry).toEqual(expect.objectContaining({
      id: 'date-1',
      memoryId: 'memory-1',
    }));
  });

  it('keeps dates tried in local fallback when memory sync fails', async () => {
    mockSaveMemory.mockRejectedValueOnce(new Error('offline'));
    const date = {
      id: 'date-1',
      title: 'Coffee walk',
      heat: 1,
      load: 1,
      style: 'talking',
      minutes: 45,
      location: 'out',
    };

    const result = await saveDateHistoryEntry(date);

    expect(result.entry).toEqual(expect.objectContaining({
      id: 'date-1',
      title: 'Coffee walk',
      memoryId: null,
    }));

    mockGetMemories.mockRejectedValueOnce(new Error('read failed'));
    mockGetSharedMemories.mockRejectedValueOnce(new Error('read failed'));

    const history = await getDateHistory();
    expect(history).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'date-1',
        title: 'Coffee walk',
      }),
    ]));
  });

  it('saves saved dates as date_saved memories for Keepsake', async () => {
    const date = {
      id: 'date-1',
      title: 'Coffee walk',
      heat: 1,
      load: 1,
      style: 'talking',
      minutes: 45,
      location: 'out',
    };

    const result = await saveDateSavedKeepsake(date);

    expect(mockSaveMemory).toHaveBeenCalledWith(expect.objectContaining({
      type: 'date_saved',
      mood: 'talking',
      isPrivate: false,
    }));

    const payload = JSON.parse(mockSaveMemory.mock.calls[0][0].content);
    expect(payload).toEqual(expect.objectContaining({
      kind: 'date_saved',
      dateId: 'date-1',
      title: 'Coffee walk',
    }));

    expect(result.entry).toEqual(expect.objectContaining({
      id: 'date-1',
      memoryId: 'memory-1',
    }));
  });

  it('removes saved date memories when a date is unsaved', async () => {
    mockGetMemories.mockResolvedValue([
      {
        id: 'memory-1',
        type: 'date_saved',
        content: JSON.stringify({
          kind: 'date_saved',
          dateId: 'date-1',
          title: 'Coffee walk',
        }),
        created_at: '2026-04-28T12:00:00.000Z',
      },
    ]);

    const result = await removeDateSavedKeepsake('date-1');

    expect(mockDeleteMemory).toHaveBeenCalledWith('memory-1');
    expect(result.removed).toEqual(expect.objectContaining({
      id: 'date-1',
      memoryId: 'memory-1',
    }));
  });

  it('does not report saved date removal when the Keepsake delete fails', async () => {
    mockGetMemories.mockResolvedValue([
      {
        id: 'memory-1',
        type: 'date_saved',
        content: JSON.stringify({
          kind: 'date_saved',
          dateId: 'date-1',
          title: 'Coffee walk',
        }),
        created_at: '2026-04-28T12:00:00.000Z',
      },
    ]);
    mockDeleteMemory.mockRejectedValueOnce(new Error('delete failed'));

    await expect(removeDateSavedKeepsake('date-1')).rejects.toThrow('delete failed');
  });

  it('saves positions tried as intimacy_tried memories for Keepsake without reloading the whole tried map', async () => {
    const position = {
      id: 'ip001',
      title: 'Close Hold',
      commonName: 'Side by side',
      mood: 'tender',
      heat: 2,
    };

    const result = await toggleIntimacyTried(position, {
      currentlyTried: false,
      currentTried: {},
    });

    expect(mockGetMemories).not.toHaveBeenCalled();
    expect(mockGetSharedMemories).not.toHaveBeenCalled();
    expect(mockSaveMemory).toHaveBeenCalledWith(expect.objectContaining({
      type: 'intimacy_tried',
      mood: 'tender',
      isPrivate: false,
    }));

    const payload = JSON.parse(mockSaveMemory.mock.calls[0][0].content);
    expect(payload).toEqual(expect.objectContaining({
      kind: 'intimacy_tried',
      positionId: 'ip001',
      title: 'Close Hold',
    }));

    expect(result.tried.ip001).toEqual(expect.objectContaining({
      positionId: 'ip001',
      memoryId: 'memory-1',
    }));
  });

  it('keeps positions tried in local fallback when memory sync fails', async () => {
    mockSaveMemory.mockRejectedValueOnce(new Error('offline'));
    const position = {
      id: 'ip001',
      title: 'Close Hold',
      commonName: 'Side by side',
      mood: 'tender',
      heat: 2,
    };

    const result = await toggleIntimacyTried(position, {
      currentlyTried: false,
      currentTried: {},
    });

    expect(result.tried.ip001).toEqual(expect.objectContaining({
      positionId: 'ip001',
      title: 'Close Hold',
      memoryId: null,
    }));

    mockGetMemories.mockRejectedValueOnce(new Error('read failed'));
    mockGetSharedMemories.mockRejectedValueOnce(new Error('read failed'));

    const tried = await getIntimacyTried();
    expect(tried.ip001).toEqual(expect.objectContaining({
      positionId: 'ip001',
      title: 'Close Hold',
    }));
  });

  it('saves favorite positions as intimacy_favorite memories for Keepsake', async () => {
    const position = {
      id: 'ip001',
      title: 'Close Hold',
      commonName: 'Side by side',
      mood: 'tender',
      heat: 2,
    };

    const result = await toggleIntimacyFavorite(position, {
      currentlyFavorite: false,
    });

    expect(mockSaveMemory).toHaveBeenCalledWith(expect.objectContaining({
      type: 'intimacy_favorite',
      mood: 'tender',
      isPrivate: false,
    }));

    const payload = JSON.parse(mockSaveMemory.mock.calls[0][0].content);
    expect(payload).toEqual(expect.objectContaining({
      kind: 'intimacy_favorite',
      positionId: 'ip001',
      title: 'Close Hold',
    }));

    expect(result.favorites.ip001).toEqual(expect.objectContaining({
      positionId: 'ip001',
      memoryId: 'memory-1',
    }));
  });

  it('does not mark a favorite position saved when the Keepsake write fails', async () => {
    mockSaveMemory.mockRejectedValueOnce(new Error('write failed'));
    const position = {
      id: 'ip001',
      title: 'Close Hold',
      commonName: 'Side by side',
      mood: 'tender',
      heat: 2,
    };

    await expect(toggleIntimacyFavorite(position, {
      currentlyFavorite: false,
    })).rejects.toThrow('write failed');
  });
});
