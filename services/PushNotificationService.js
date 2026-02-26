/**
 * PushNotificationService.js
 * Handles Expo push token registration, storage in Supabase,
 * and foreground notification display.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

let Notifications = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  Notifications = null;
}

const PushNotificationService = {
  _token: null,
  _listeners: [],

  /**
   * Initialize: configure notification handler for foreground display,
   * request permission, get Expo push token, and save it to Supabase.
   * Call this once from App.js after auth is ready.
   */
  async initialize(supabase) {
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

    // Set up Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Between Us',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF69B4',
        sound: 'default',
      });
    }

    // Request permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
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
      if (__DEV__) console.log('[Push] Token:', this._token);

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

      await supabase
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

      if (__DEV__) console.log('[Push] Token saved to Supabase');
    } catch (error) {
      if (__DEV__) console.error('[Push] Save token error:', error.message);
    }
  },

  /**
   * Remove the push token from Supabase (e.g., on sign-out).
   */
  async removeToken(supabase) {
    if (!this._token || !supabase) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('push_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('token', this._token);

      if (__DEV__) console.log('[Push] Token removed');
      this._token = null;
    } catch (error) {
      if (__DEV__) console.error('[Push] Remove token error:', error.message);
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

      await supabase.rpc('notify_partner', {
        sender_id: user.id,
        notification_title: title,
        notification_body: body,
        notification_data: data,
      });

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
