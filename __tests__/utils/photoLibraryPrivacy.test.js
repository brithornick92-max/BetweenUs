const mockLaunchImageLibraryAsync = jest.fn();
const mockRequestMediaLibraryPermissionsAsync = jest.fn();

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args) => mockLaunchImageLibraryAsync(...args),
  requestMediaLibraryPermissionsAsync: (...args) => mockRequestMediaLibraryPermissionsAsync(...args),
  UIImagePickerPreferredAssetRepresentationMode: { Current: 'current' },
  VideoExportPreset: { HighestQuality: 3 },
}));

const {
  PRIVATE_MEDIA_PICKER_OPTIONS,
  launchPrivateMediaLibraryAsync,
} = require('../../utils/photoLibraryPrivacy');

describe('photo library privacy picker options', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: [] });
  });

  it('launches the picker without requesting broad photo library permission', async () => {
    await launchPrivateMediaLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.88,
      allowsMultipleSelection: true,
    });

    expect(mockRequestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
    expect(mockLaunchImageLibraryAsync).toHaveBeenCalledWith({
      mediaTypes: ['images', 'videos'],
      quality: 0.88,
      allowsMultipleSelection: true,
      ...PRIVATE_MEDIA_PICKER_OPTIONS,
    });
    expect(mockLaunchImageLibraryAsync.mock.calls[0][0]).toEqual(expect.objectContaining({
      exif: false,
      preferredAssetRepresentationMode: 'current',
      videoExportPreset: 3,
    }));
  });

  it('keeps privacy-critical picker options from being overridden by callers', async () => {
    await launchPrivateMediaLibraryAsync({
      exif: true,
      preferredAssetRepresentationMode: 'automatic',
      videoExportPreset: 0,
    });

    expect(mockLaunchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({
      exif: false,
      preferredAssetRepresentationMode: 'current',
      videoExportPreset: 3,
    }));
  });
});
