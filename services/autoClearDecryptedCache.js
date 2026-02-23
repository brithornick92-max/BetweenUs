import { AppState } from 'react-native';
import EncryptedAttachments from './e2ee/EncryptedAttachments';

let currentState = AppState.currentState;

function handleAppStateChange(nextAppState) {
  if (currentState.match(/active/) && nextAppState.match(/inactive|background/)) {
    // App is going to background, clear decrypted cache
    EncryptedAttachments.clearDecryptedCache();
  }
  currentState = nextAppState;
}

export function registerAutoClearDecryptedCache() {
  AppState.addEventListener('change', handleAppStateChange);
}
