/**
 * Supabase Configuration (Expo + React Native)
 * - Uses SecureStore for auth session persistence
 * - Uses EXPO_PUBLIC_ env vars (safe for anon key)
 */

import { createClient } from "@supabase/supabase-js";
import { SecureSupabaseStorage } from "../services/supabase/SecureSupabaseStorage";

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          storage: SecureSupabaseStorage,
          autoRefreshToken: true,
          persistSession: true,
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
