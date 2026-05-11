const mockReadAsStringAsync = jest.fn();
const mockDeleteAsync = jest.fn();
const mockUpload = jest.fn();
const mockRemove = jest.fn();
const mockInsert = jest.fn();

jest.mock('expo-file-system', () => ({
  readAsStringAsync: (...args) => mockReadAsStringAsync(...args),
  deleteAsync: (...args) => mockDeleteAsync(...args),
  EncodingType: {
    Base64: 'base64',
  },
  cacheDirectory: 'file:///cache/',
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'whisper-id'),
}));

jest.mock('../../config/supabase', () => ({
  TABLES: {
    COUPLE_DATA: 'couple_data',
  },
  supabase: {
    storage: {
      from: jest.fn(() => ({
        upload: (...args) => mockUpload(...args),
        remove: (...args) => mockRemove(...args),
      })),
    },
    from: jest.fn(() => ({
      insert: (...args) => mockInsert(...args),
    })),
  },
}));

const WhisperService = require('../../services/WhisperService').default;

beforeEach(() => {
  jest.clearAllMocks();
  mockReadAsStringAsync.mockResolvedValue('aGVsbG8=');
  mockUpload.mockResolvedValue({ error: null });
  mockRemove.mockResolvedValue({ error: null });
  mockInsert.mockResolvedValue({ error: null });
  mockDeleteAsync.mockResolvedValue(undefined);
});

describe('WhisperService.upload', () => {
  it('keeps the local recording and removes remote storage if metadata write fails', async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: 'metadata failed' } });

    await expect(WhisperService.upload({
      fileUri: 'file:///tmp/voice.m4a',
      coupleId: 'couple-1',
      senderId: 'user-1',
      durationMs: 5000,
    })).rejects.toThrow('metadata failed');

    expect(mockUpload).toHaveBeenCalled();
    expect(mockRemove).toHaveBeenCalledWith(['couple-1/couple-1_user-1_whisper-id.m4a']);
    expect(mockDeleteAsync).not.toHaveBeenCalled();
  });

  it('deletes the local recording only after storage and metadata are saved', async () => {
    const result = await WhisperService.upload({
      fileUri: 'file:///tmp/voice.m4a',
      coupleId: 'couple-1',
      senderId: 'user-1',
      durationMs: 5000,
    });

    expect(result).toEqual({ whisperId: 'couple-1_user-1_whisper-id' });
    expect(mockDeleteAsync).toHaveBeenCalledWith('file:///tmp/voice.m4a', { idempotent: true });
    expect(mockInsert.mock.invocationCallOrder[0]).toBeLessThan(mockDeleteAsync.mock.invocationCallOrder[0]);
  });
});
