import { AppState } from 'react-native';
import EncryptedAttachments from './e2ee/EncryptedAttachments';

let currentState = AppState.currentState;

async function handleAppStateChange(nextAppState) {
  if (currentState.match(/active/) && nextAppState.match(/inactive|background/)) {
    // App is going to background, clear decrypted cache
    await EncryptedAttachments.clearDecryptedCache();
  }
  currentState = nextAppState;
}

export function registerAutoClearDecryptedCache() {
  const subscription = AppState.addEventListener('change', handleAppStateChange);
  return () => subscription.remove();
}
