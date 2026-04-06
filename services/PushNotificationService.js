/**
 * PushNotificationService.js
 * Handles Expo push token registration, storage in Supabase,
 * and foreground notification display.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import SecureCacheStore from './security/SecureCacheStore';

const PUSH_TOKEN_CACHE_KEY = 'push_token';
const PUSH_TOKEN_SERVICE = 'betweenus_push';

let Notifications = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  Notifications = null;
}

const PushNotificationService = {
  _token: null,

  /**
   * Initialize: configure notification handler for foreground display,
   * request permission, get Expo push token, and save it to Supabase.
   * Call this once from App.js after auth is ready.
   */
  async initialize(supabase, { requestPermissions = false } = {}) {
    if (!Notifications) {
      if (__DEV__) console.log('[Push] expo-notifications not available');
      return null;
    }

    // Configure foreground notification behavior
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    // Request permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted' && requestPermissions) {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      await this.removeToken(supabase);
      if (__DEV__) console.log('[Push] Permission not granted');
      return null;
    }

    // Get Expo push token (physical device only — simulators don't support push)
    if (!Device.isDevice) {
      if (__DEV__) console.log('[Push] Not a physical device — skipping token registration');
      return null;
    }

    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      this._token = tokenData.data;
      if (__DEV__) console.log('[Push] Token registered');

      // Save to Supabase
      if (supabase && this._token) {
        await this._saveToken(supabase, this._token);
      }

      return this._token;
    } catch (error) {
      if (__DEV__) console.error('[Push] Token error:', error.message);
      return null;
    }
  },

  /**
   * Save or update the push token in the push_tokens table.
   */
  async _saveToken(supabase, token) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('push_tokens')
        .upsert(
          {
            user_id: user.id,
            token,
            platform: Platform.OS,
            device_name: Platform.OS,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,token' }
        );

      if (error) throw error;

      await SecureCacheStore.setString(PUSH_TOKEN_CACHE_KEY, token, {
        service: PUSH_TOKEN_SERVICE,
      });

      if (__DEV__) console.log('[Push] Token saved to Supabase');
    } catch (error) {
      if (__DEV__) console.error('[Push] Save token error:', error.message);
      try {
        const { default: CrashReporting } = await import('../services/CrashReporting');
        CrashReporting.captureException(error, { source: 'push_token_save' });
      } catch {}
    }
  },

  /**
   * Remove the push token from Supabase (e.g., on sign-out).
   */
  async removeToken(supabase) {
    try {
      const token = this._token || await SecureCacheStore.getString(PUSH_TOKEN_CACHE_KEY, {
        service: PUSH_TOKEN_SERVICE,
      });
      if (!token) return;

      if (!supabase) {
        this._token = null;
        await SecureCacheStore.removeItem(PUSH_TOKEN_CACHE_KEY, {
          service: PUSH_TOKEN_SERVICE,
        });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('push_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('token', token);

      if (error) throw error;

      if (__DEV__) console.log('[Push] Token removed');
      this._token = null;
      await SecureCacheStore.removeItem(PUSH_TOKEN_CACHE_KEY, {
        service: PUSH_TOKEN_SERVICE,
      });
    } catch (error) {
      if (__DEV__) console.error('[Push] Remove token error:', error.message);
      try {
        const { default: CrashReporting } = await import('../services/CrashReporting');
        CrashReporting.captureException(error, { source: 'push_token_remove' });
      } catch {}
    }
  },

  /**
   * Send a push notification to a partner.
   * Uses an RPC call so only the server has the logic to look up push tokens.
   */
  async notifyPartner(supabase, { title, body, data = {} }) {
    if (!supabase) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.rpc('notify_partner', {
        sender_id: user.id,
        notification_title: title,
        notification_body: body,
        notification_data: data,
      });

      if (error) throw error;

      if (__DEV__) console.log('[Push] Partner notification sent');
    } catch (error) {
      // Non-critical — don't crash the app if notification fails
      if (__DEV__) console.warn('[Push] Notify partner error:', error.message);
    }
  },

  /**
   * Get the current token (if registered).
   */
  getToken() {
    return this._token;
  },
};

export default PushNotificationService;
