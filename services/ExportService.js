// services/ExportService.js — Editorial Snapshot Generation
// Captures the off-screen ViewShot ref mounted in YearReflectionScreen,
// then shares the resulting image via expo-sharing (iOS + Android).
// On Android, saves to the device library first via expo-media-library.

import { Platform, Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import CrashReporting from './CrashReporting';

const EXPORT_CONTEXT = 'ExportService_exportParagraphSnapshot';

const ExportService = {
  /**
   * Captures the already-mounted off-screen ViewShot ref and shares the result.
   *
   * @param {React.RefObject} snapshotRef - ref attached to the <ViewShot> in YearReflectionScreen
   * @param {number} year - the reflection year (used in share title)
   * @returns {{ success: boolean, cancelled?: boolean }}
   */
  async exportParagraphSnapshot(snapshotRef, year) {
    try {
      if (!snapshotRef?.current) {
        throw new Error('Snapshot ref is not mounted');
      }

      // Guard: capture() only exists when react-native-view-shot's native module is
      // linked. If the dev client predates the package being added, fail gracefully.
      if (typeof snapshotRef.current.capture !== 'function') {
        Alert.alert(
          'Rebuild Required',
          'The snapshot feature needs a fresh build. Your current dev client was compiled before this module was added — install the new build once it finishes.',
        );
        return { success: false, cancelled: true };
      }

      // 1. Capture the off-screen ViewShot at 2× pixel ratio for crisp sharing.
      const uri = await snapshotRef.current.capture({
        format: 'jpg',
        quality: 0.92,
        result: 'tmpfile',
        // pixelRatio 2 doubles the physical pixels → sharp on Retina / high-DPI screens.
        pixelRatio: 2,
      });

      if (!uri) throw new Error('ViewShot returned empty URI');

      // 2. Platform-specific share strategy.
      if (Platform.OS === 'ios') {
        const canShare = await Sharing.isAvailableAsync();
        if (!canShare) throw new Error('Sharing not available on this device');

        await Sharing.shareAsync(uri, {
          mimeType: 'image/jpeg',
          dialogTitle: `Our ${year} Reflection`,
          UTI: 'public.jpeg',
        });

        return { success: true };
      } else {
        // Android: save to media library first, then share the persisted URI.
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Needed',
            'Allow access to your photos so we can save your snapshot.',
          );
          return { success: false, permissionDenied: true };
        }

        const asset = await MediaLibrary.createAssetAsync(uri);

        // Ensure the "Between Us" album exists.
        const album = await MediaLibrary.getAlbumAsync('Between Us');
        if (album === null) {
          await MediaLibrary.createAlbumAsync('Between Us', asset, false);
        } else {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        }

        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(asset.uri, {
            mimeType: 'image/jpeg',
            dialogTitle: `Our ${year} Reflection`,
          });
        }

        return { success: true };
      }
    } catch (error) {
      // expo-sharing throws when the user dismisses the share sheet on some
      // platforms — treat that as a graceful cancellation, not a hard error.
      const msg = error?.message ?? '';
      if (
        msg.includes('cancelled') ||
        msg.includes('canceled') ||
        msg.includes('dismissed') ||
        msg.includes('User cancelled')
      ) {
        return { success: false, cancelled: true };
      }

      CrashReporting.captureException(error, {
        context: EXPORT_CONTEXT,
        extra: { year },
      });

      throw error;
    }
  },
};

export default ExportService;
