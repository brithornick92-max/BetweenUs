require('../helpers/screenTestHarness');

jest.mock('expo-blur', () => ({
  BlurView: 'BlurView',
}));

const ImagePicker = require('expo-image-picker');

const {
  renderer,
  renderScreen,
  findTouchablesByText,
  resetScreenHarnessMocks,
  mockSaveMemory,
  mockAlert,
  setAppContextMock,
  setNavigationMock,
} = require('../helpers/screenTestHarness');

const AddMemoryModule = require('../../screens/AddMemoryScreen');
const AddMemoryScreen = AddMemoryModule.default;
const {
  getInitialMediaItems,
  isSameExistingMediaSet,
  getKeepsakeSaveType,
  getKeepsakeSaveConfirmation,
} = AddMemoryModule;

describe('AddMemoryScreen media retention helpers', () => {
  beforeEach(() => {
    resetScreenHarnessMocks();
  });

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

  it('uses one snapshot post for multi-media saves', () => {
    expect(getKeepsakeSaveType({ mediaCount: 0, fallbackType: 'moment' })).toBe('moment');
    expect(getKeepsakeSaveType({ mediaCount: 1, fallbackType: 'moment' })).toBe('moment');
    expect(getKeepsakeSaveType({ mediaCount: 2, fallbackType: 'moment' })).toBe('snapshot');
  });

  it('builds media save confirmation copy', () => {
    expect(getKeepsakeSaveConfirmation({
      mediaItems: [{ type: 'image', mimeType: 'image/jpeg' }],
    })).toEqual({
      title: 'Saved to Keepsake',
      message: 'Your photo has been saved to Keepsake.',
    });

    expect(getKeepsakeSaveConfirmation({
      mediaItems: [{ type: 'video', mimeType: 'video/mp4' }],
    })).toEqual({
      title: 'Saved to Keepsake',
      message: 'Your video has been saved to Keepsake.',
    });

    expect(getKeepsakeSaveConfirmation({
      mediaItems: [{}, {}, {}],
    })).toEqual({
      title: 'Saved to Keepsake',
      message: '3 items have been saved to one Keepsake post.',
    });
  });

  it('can leave the composer even when there is no back stack', async () => {
    const navigation = setNavigationMock({
      canGoBack: jest.fn(() => false),
    });

    const tree = await renderScreen(AddMemoryScreen);
    const [closeButton] = tree.root.findAll(
      (node) => node.props.accessibilityLabel === 'Close'
    );

    renderer.act(() => {
      closeButton.props.onPress();
    });

    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenCalledWith('OurStory');
  });

  it('saves numerous selected media items as one keepsake post and confirms success', async () => {
    const navigation = setNavigationMock({
      canGoBack: jest.fn(() => true),
    });
    setAppContextMock({
      coupleId: 'couple-1',
      isLinked: true,
    });
    ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          assetId: 'photo-1',
          uri: 'file:///photo-1.jpg',
          type: 'image',
          mimeType: 'image/jpeg',
          fileName: 'photo-1.jpg',
        },
        {
          assetId: 'video-1',
          uri: 'file:///video-1.mp4',
          type: 'video',
          mimeType: 'video/mp4',
          fileName: 'video-1.mp4',
          duration: 30_000,
        },
      ],
    });

    const tree = await renderScreen(AddMemoryScreen);
    const [pickButton] = findTouchablesByText(tree.root, 'Choose from Library');

    await renderer.act(async () => {
      await pickButton.props.onPress();
    });

    const [saveButton] = findTouchablesByText(tree.root, 'Save');

    await renderer.act(async () => {
      await saveButton.props.onPress();
    });

    expect(mockSaveMemory).toHaveBeenCalledTimes(2);

    const [firstPayload, secondPayload] = mockSaveMemory.mock.calls.map(([payload]) => payload);
    expect(firstPayload).toEqual(expect.objectContaining({
      type: 'snapshot',
      snapshot_index: 0,
      snapshot_count: 2,
      mediaUri: 'file:///photo-1.jpg',
      notifyPartner: false,
    }));
    expect(secondPayload).toEqual(expect.objectContaining({
      type: 'snapshot',
      snapshot_index: 1,
      snapshot_count: 2,
      mediaUri: 'file:///video-1.mp4',
      notifyPartner: true,
    }));
    expect(secondPayload.snapshot_id).toBe(firstPayload.snapshot_id);
    expect(secondPayload.snapshot_created_at).toBe(firstPayload.snapshot_created_at);

    expect(mockAlert).toHaveBeenCalledWith(
      'Saved to Keepsake',
      '2 items have been saved to one Keepsake post.',
      [expect.objectContaining({ text: 'OK' })],
      { cancelable: false }
    );

    const [, , buttons] = mockAlert.mock.calls[mockAlert.mock.calls.length - 1];

    renderer.act(() => {
      buttons[0].onPress();
    });

    expect(navigation.goBack).toHaveBeenCalled();
  });
});
