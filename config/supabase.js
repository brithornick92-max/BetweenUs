/**
 * Supabase Configuration (Expo + React Native)
 * - Uses EXPO_PUBLIC_ env vars (safe for anon key)
 * - Does not persist auth sessions locally; Supabase remains source of truth
 */

import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (__DEV__ && (!SUPABASE_URL || !SUPABASE_ANON_KEY)) {
  console.warn(
    '[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Set them in .env or eas.json. Supabase features will be disabled.'
  );
}

export const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: false,
          detectSessionInUrl: false,
        },
      })
    : null;

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
