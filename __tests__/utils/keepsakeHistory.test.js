const mockStorageGet = jest.fn();
const mockStorageSet = jest.fn();
const mockGetMemories = jest.fn();
const mockGetSharedMemories = jest.fn();
const mockSaveMemory = jest.fn();
const mockUpdateMemory = jest.fn();
const mockDeleteMemory = jest.fn();

jest.mock('../../utils/storage', () => ({
  storage: {
    get: (...args) => mockStorageGet(...args),
    set: (...args) => mockStorageSet(...args),
  },
}));

jest.mock('../../services/localfirst', () => ({
  DataLayer: {
    getMemories: (...args) => mockGetMemories(...args),
    getSharedMemories: (...args) => mockGetSharedMemories(...args),
    saveMemory: (...args) => mockSaveMemory(...args),
    updateMemory: (...args) => mockUpdateMemory(...args),
    deleteMemory: (...args) => mockDeleteMemory(...args),
  },
}));

const { saveDateHistoryEntry } = require('../../utils/dateHistory');
const { toggleIntimacyTried } = require('../../utils/intimacyFavorites');

describe('Keepsake history writers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageGet.mockResolvedValue([]);
    mockStorageSet.mockResolvedValue(undefined);
    mockGetMemories.mockResolvedValue([]);
    mockGetSharedMemories.mockResolvedValue([]);
    mockSaveMemory.mockResolvedValue({ id: 'memory-1', created_at: '2026-04-28T12:00:00.000Z' });
    mockUpdateMemory.mockResolvedValue({ id: 'memory-1' });
    mockDeleteMemory.mockResolvedValue(undefined);
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
});
