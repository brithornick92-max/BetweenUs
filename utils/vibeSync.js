// utils/vibeSync.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from './storage';

class VibeSyncService {
  constructor() {
    this.listeners = new Set();
  }

  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  _emit(event, data) {
    this.listeners.forEach((cb) => {
      try {
        cb(event, data);
      } catch {
        // ignore listener errors
      }
    });
  }

  async sendVibeToPartner(vibe, userId) {
    try {
      const payload = {
        vibe,
        userId,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_PARTNER_ACTIVITY, `${payload.timestamp}`);
      this._emit('vibe_synced', payload);
      this._emit('partner_vibe_received', payload);
      return { success: true };
    } catch (error) {
      this._emit('vibe_sync_failed', { error: error.message });
      return { success: false, queued: true };
    }
  }
}

export const vibeSyncService = new VibeSyncService();
