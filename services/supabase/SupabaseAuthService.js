import { getSupabaseOrThrow } from "../../config/supabase";

const AUTH_TIMEOUT_MS = 15_000;

/** Race a promise against a timeout. Rejects if timeout fires first. */
function withTimeout(promise, ms = AUTH_TIMEOUT_MS) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Auth request timed out (${ms}ms)`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export const SupabaseAuthService = {
  async signUp(email, password) {
    if (!email) throw new Error("Email is required");
    if (!password || password.length < 8) throw new Error("Password must be at least 8 characters");
    const supabase = getSupabaseOrThrow();
    const { data, error } = await withTimeout(supabase.auth.signUp({ email, password }));
    if (error) throw error;
    return data?.session || null;
  },

  async signInWithPassword(email, password) {
    if (!email) throw new Error("Email is required");
    if (!password) throw new Error("Password is required");
    const supabase = getSupabaseOrThrow();
    const { data, error } = await withTimeout(supabase.auth.signInWithPassword({ email, password }));
    if (error) throw error;
    return data?.session || null;
  },

  async sendMagicLink(email) {
    if (!email) throw new Error("Email is required");
    const supabase = getSupabaseOrThrow();
    const { error } = await withTimeout(supabase.auth.signInWithOtp({
      email,
      options: { redirectTo: "betweenus://auth-callback" },
    }));
    if (error) throw error;
    return true;
  },

  async requestRecoveryCode(email) {
    if (!email) throw new Error("Email is required");
    const supabase = getSupabaseOrThrow();
    const { data, error } = await withTimeout(supabase.functions.invoke("password-recovery", {
      body: { action: "send", email },
    }));
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return true;
  },

  async verifyRecoveryCode({ email, code, password }) {
    if (!email) throw new Error("Email is required");
    if (!code) throw new Error("Recovery code is required");
    if (!password || password.length < 8) throw new Error("Password must be at least 8 characters");
    const supabase = getSupabaseOrThrow();
    const { data, error } = await withTimeout(supabase.functions.invoke("password-recovery", {
      body: { action: "verify", email, code, password },
    }));
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return true;
  },

  async signInAnonymously() {
    const supabase = getSupabaseOrThrow();
    const { data, error } = await withTimeout(supabase.auth.signInAnonymously());
    if (error) throw error;
    return data?.session || null;
  },

  async storeCredentials() {
    return false;
  },

  async clearStoredCredentials() {
    return true;
  },

  async signInWithStoredCredentials() {
    return null;
  },

  async getSession() {
    const supabase = getSupabaseOrThrow();
    const { data, error } = await withTimeout(supabase.auth.getSession());
    if (error) throw error;
    return data?.session || null;
  },

  async getUser() {
    const supabase = getSupabaseOrThrow();
    const { data, error } = await withTimeout(supabase.auth.getUser());
    if (error) throw error;
    return data?.user || null;
  },

  onAuthStateChange(callback) {
    const supabase = getSupabaseOrThrow();
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session || null);
    });
  },

  async signOut(scope = 'global') {
    const supabase = getSupabaseOrThrow();
    const { error } = await withTimeout(supabase.auth.signOut({ scope }));
    if (error) throw error;
  },

  async signOutLocal() {
    return SupabaseAuthService.signOut('local');
  },

  async signOutGlobal() {
    return SupabaseAuthService.signOut('global');
  },

  async deleteAccount() {
    const supabase = getSupabaseOrThrow();
    const { error } = await withTimeout(supabase.rpc('delete_own_account'));
    if (error) throw error;
  },
};

export default SupabaseAuthService;
