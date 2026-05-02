require('../helpers/screenTestHarness');

const mockGetCachedUri = jest.fn();

jest.mock('../../services/AttachmentCacheService', () => ({
  __esModule: true,
  default: {
    getCachedUri: (...args) => mockGetCachedUri(...args),
  },
}));

const { buildMemoryWallMediaItem } = require('../../screens/MemoryWallScreen');

describe('MemoryWallScreen media resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the Supabase signed media URL before the legacy attachment cache', async () => {
    const item = await buildMemoryWallMediaItem({
      id: 'memory-1',
      media_ref: 'couples/couple-1/photo.jpg',
      mediaUri: 'https://example.com/signed-photo-url',
      mime_type: 'image/jpeg',
      content: 'A saved snapshot.',
      created_at: '2026-05-02T12:00:00.000Z',
      type: 'snapshot',
    });

    expect(mockGetCachedUri).not.toHaveBeenCalled();
    expect(item).toEqual(expect.objectContaining({
      sourceId: 'memory-1',
      uri: 'https://example.com/signed-photo-url',
      mimeType: 'image/jpeg',
      caption: 'A saved snapshot.',
      media: expect.objectContaining({
        uri: 'https://example.com/signed-photo-url',
        kind: 'image',
      }),
    }));
  });

  it('falls back to cached legacy refs when no signed media URL is present', async () => {
    mockGetCachedUri.mockResolvedValueOnce('file:///cached-photo.jpg');

    const item = await buildMemoryWallMediaItem({
      id: 'memory-2',
      media_ref: 'legacy-photo-ref',
      mime_type: 'image/jpeg',
    });

    expect(mockGetCachedUri).toHaveBeenCalledWith('legacy-photo-ref');
    expect(item).toEqual(expect.objectContaining({
      sourceId: 'memory-2',
      uri: 'file:///cached-photo.jpg',
    }));
  });
});
