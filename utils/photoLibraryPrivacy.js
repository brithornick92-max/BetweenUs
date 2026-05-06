import * as ImagePicker from 'expo-image-picker';

export const PHOTO_LIBRARY_PRIVACY_NOTE =
  'Your photo library stays private. Between Us only receives the items you choose. To choose whether location is included, tap the ... button in the iOS photo picker.';

export const PRIVATE_MEDIA_PICKER_OPTIONS = {
  exif: false,
  preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
  videoExportPreset: ImagePicker.VideoExportPreset.HighestQuality,
};

export async function launchPrivateMediaLibraryAsync(options = {}) {
  return ImagePicker.launchImageLibraryAsync({
    ...options,
    ...PRIVATE_MEDIA_PICKER_OPTIONS,
  });
}
