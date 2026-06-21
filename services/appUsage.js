import Constants from "expo-constants";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";

import { supabase } from "../config/supabase";

/**
 * App usage days.
 *
 * One row per user per LOCAL calendar day they open the app, so we can answer
 * "which days did this customer actually use the app?" - something Supabase
 * Auth's last_sign_in_at can't tell us (a session stays valid for weeks without
 * the app ever being opened).
 *
 * The write is a cheap idempotent upsert on (user_id, used_on). An in-memory
 * guard keyed by user + local date means foregrounding the app many times in one
 * day makes at most one network call until the date rolls over (or the account
 * changes). Logging is best-effort telemetry: it never blocks or surfaces
 * errors to the user.
 */

// `${userId}|${localDate}` of the last successful write this session.
let lastLoggedKey = null;
let inFlight = null;

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function appVersion() {
  const version = Constants.expoConfig?.version;
  return typeof version === "string" && version.trim().length > 0 ? version : null;
}

export async function logAppUsageDay() {
  if (!supabase) {
    return;
  }

  // Collapse concurrent calls (e.g. mount + an immediate foreground event).
  if (inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return;
      }

      const today = localDateString();
      const key = `${user.id}|${today}`;

      if (lastLoggedKey === key) {
        return;
      }

      const { error } = await supabase.from("app_usage_days").upsert(
        {
          user_id: user.id,
          used_on: today,
          last_seen_at: new Date().toISOString(),
          platform: Platform.OS,
          app_version: appVersion(),
        },
        { onConflict: "user_id,used_on" }
      );

      if (!error) {
        lastLoggedKey = key;
      }
    } catch {
      // Usage logging is best-effort; never let it block or surface to the user.
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/**
 * Logs a usage day on mount and whenever the app returns to the foreground.
 * Mount once inside the authenticated tree.
 */
export function useLogAppUsage() {
  useEffect(() => {
    logAppUsageDay();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        logAppUsageDay();
      }
    });

    return () => subscription?.remove();
  }, []);
}
