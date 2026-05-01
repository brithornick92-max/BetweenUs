import { Alert } from 'react-native';
import * as Updates from 'expo-updates';
import CrashReporting from './CrashReporting';

const CHECK_COOLDOWN_MS = 15 * 60 * 1000;
const CHECK_TIMEOUT_MS = 10000;
const FETCH_TIMEOUT_MS = 45000;

let checkInFlight = false;
let lastCheckAt = 0;
let pendingPrompt = false;
let promptedUpdateKey = null;

function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function getUpdateKey(result) {
  return (
    result?.manifest?.id
    || result?.manifest?.createdAt
    || result?.manifest?.metadata?.updateGroup
    || 'latest'
  );
}

function canUseUpdates() {
  return !__DEV__ && Updates.isEnabled;
}

function promptToReload(updateKey) {
  if (pendingPrompt || promptedUpdateKey === updateKey) return;

  pendingPrompt = true;
  promptedUpdateKey = updateKey;

  Alert.alert(
    'Update ready',
    'A fresh app update is ready. Restart now to use the latest version.',
    [
      {
        text: 'Later',
        style: 'cancel',
        onPress: () => {
          pendingPrompt = false;
        },
      },
      {
        text: 'Restart',
        onPress: async () => {
          try {
            await Updates.reloadAsync();
          } catch (error) {
            pendingPrompt = false;
            CrashReporting.captureException(error, { source: 'expo_update_reload' });
          }
        },
      },
    ],
    { cancelable: true }
  );
}

const ExpoUpdateService = {
  async checkForUpdate({ reason = 'manual', force = false } = {}) {
    if (!canUseUpdates()) return { skipped: true, reason: 'disabled' };
    if (checkInFlight) return { skipped: true, reason: 'in_flight' };

    const now = Date.now();
    if (!force && now - lastCheckAt < CHECK_COOLDOWN_MS) {
      return { skipped: true, reason: 'cooldown' };
    }

    checkInFlight = true;
    lastCheckAt = now;

    try {
      const check = await withTimeout(
        Updates.checkForUpdateAsync(),
        CHECK_TIMEOUT_MS,
        'Expo update check'
      );

      if (!check?.isAvailable && !check?.isRollBackToEmbedded) {
        return { available: false, reason: check?.reason || null };
      }

      const fetch = await withTimeout(
        Updates.fetchUpdateAsync(),
        FETCH_TIMEOUT_MS,
        'Expo update fetch'
      );

      if (fetch?.isNew || fetch?.isRollBackToEmbedded) {
        const updateKey = getUpdateKey(fetch);
        CrashReporting.addBreadcrumb('expo_update', 'Downloaded update', {
          reason,
          updateKey,
          isRollBackToEmbedded: !!fetch?.isRollBackToEmbedded,
        });
        promptToReload(updateKey);
        return { available: true, downloaded: true, updateKey };
      }

      return { available: true, downloaded: false };
    } catch (error) {
      CrashReporting.captureException(error, {
        source: 'expo_update_check',
        reason,
      });
      return { error };
    } finally {
      checkInFlight = false;
    }
  },

  _resetForTests() {
    checkInFlight = false;
    lastCheckAt = 0;
    pendingPrompt = false;
    promptedUpdateKey = null;
  },
};

export default ExpoUpdateService;
