require('../helpers/screenTestHarness');

jest.mock('expo-blur', () => ({
  BlurView: 'BlurView',
}));

const {
  getInitialMediaItems,
  isSameExistingMediaSet,
} = require('../../screens/AddMemoryScreen');

describe('AddMemoryScreen media retention helpers', () => {
  it('keeps snapshot media identities when preview URLs are unavailable', () => {
    const items = getInitialMediaItems({
      kind: 'snapshot',
      mediaItems: [],
      rawItems: [
        {
          sourceId: 'memory-photo-1',
          mediaRef: 'couples/couple-1/photo-1.jpg',
          mimeType: 'image/jpeg',
          row: {
            media_ref: 'couples/couple-1/photo-1.jpg',
            mime_type: 'image/jpeg',
          },
        },
        {
          sourceId: 'memory-note-only',
          row: {
            media_ref: null,
            mime_type: null,
          },
        },
      ],
    });

    expect(items).toEqual([
      expect.objectContaining({
        sourceId: 'memory-photo-1',
        uri: null,
        mediaRef: 'couples/couple-1/photo-1.jpg',
        mimeType: 'image/jpeg',
        isExisting: true,
      }),
    ]);
    expect(isSameExistingMediaSet(items, ['memory-photo-1'])).toBe(true);
  });

  it('keeps single keepsake media identity without requiring a preview URL', () => {
    const items = getInitialMediaItems({
      kind: 'memory',
      sourceId: 'memory-video-1',
      mediaRef: 'couple-1/video-1.mp4',
      row: {
        media_ref: 'couple-1/video-1.mp4',
        mime_type: 'video/mp4',
      },
    });

    expect(items).toEqual([
      expect.objectContaining({
        sourceId: 'memory-video-1',
        uri: null,
        mediaRef: 'couple-1/video-1.mp4',
        mimeType: 'video/mp4',
        type: 'video',
        isExisting: true,
      }),
    ]);
    expect(isSameExistingMediaSet(items, ['memory-video-1'])).toBe(true);
  });
});
