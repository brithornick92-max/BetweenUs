/**
 * Supabase Configuration (Expo + React Native)
 * - Uses EXPO_PUBLIC_ env vars (safe for anon key)
 * - Persists only Supabase auth sessions locally so users stay signed in
 * - Supabase remains the source of truth for app data
 */

import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (__DEV__ && (!SUPABASE_URL || !SUPABASE_ANON_KEY)) {
  console.warn(
    '[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Set them in .env or eas.json. Supabase features will be disabled.'
  );
}

/**
 * Custom storage adapter for Supabase auth that wraps AsyncStorage.
 * This ensures compatibility with Supabase JS v2's expected storage interface.
 */
const SupabaseAsyncStorage = {
  getItem: async (key) => {
    try {
      const secureValue = await SecureStore.getItemAsync(key);
      if (secureValue !== null) return secureValue;

      const legacyValue = await AsyncStorage.getItem(key);
      if (legacyValue !== null) {
        await SecureStore.setItemAsync(key, legacyValue).catch(() => {});
        await AsyncStorage.removeItem(key).catch(() => {});
      }

      return legacyValue;
    } catch {
      try {
        return await AsyncStorage.getItem(key);
      } catch {
        return null;
      }
    }
  },
  setItem: async (key, value) => {
    try {
      await SecureStore.setItemAsync(key, value);
      await AsyncStorage.removeItem(key).catch(() => {});
    } catch {
      try {
        await AsyncStorage.setItem(key, value);
      } catch {
        // Silently fail - session will work for current app lifecycle
      }
    }
  },
  removeItem: async (key) => {
    try {
      await SecureStore.deleteItemAsync(key);
      await AsyncStorage.removeItem(key);
    } catch {
      try {
        await AsyncStorage.removeItem(key);
      } catch {
        // Silently fail
      }
    }
  },
};

export const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          storage: SupabaseAsyncStorage,
          // Fix for React Native: tell Supabase when app is in foreground
          // so it can refresh tokens at the right time
          flowType: 'pkce',
        },
      })
    : null;

// Handle app state changes to trigger token refresh when app comes to foreground
if (supabase) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

export const getSupabaseOrThrow = () => {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return supabase;
};

export const TABLES = {
  PROFILES: "profiles",
  COUPLES: "couples",
  COUPLE_MEMBERS: "couple_members",
  COUPLE_DATA: "couple_data",
  CALENDAR_EVENTS: "calendar_events",
  MOMENTS: "moments",
  PARTNER_LINK_CODES: "partner_link_codes",
  USER_ENTITLEMENTS: "user_entitlements",
  USAGE_EVENTS: "usage_events",
};

export default supabase;
