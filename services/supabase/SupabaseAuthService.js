import { getSupabaseOrThrow } from "../../config/supabase";
import * as SecureStore from 'expo-secure-store';
import { EncryptionService } from '../EncryptionService';

const SUPABASE_CRED_KEY = 'betweenus_supabase_cred';
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
  /**
   * Create a new account with email + password.
   */
  async signUp(email, password) {
    if (!email) throw new Error("Email is required");
    if (!password || password.length < 8) throw new Error("Password must be at least 8 characters");
    const supabase = getSupabaseOrThrow();
    const { data, error } = await withTimeout(supabase.auth.signUp({ email, password }));
    if (error) throw error;
    return data?.session || null;
  },

  /**
   * Sign in with email + password.
   */
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
      options: {
        redirectTo: "betweenus://auth-callback",
      },
    }));
    if (error) throw error;
    return true;
  },

  /**
   * Sign in anonymously (no email/password required).
   * Creates a temporary Supabase session for device-keyed operations like pairing.
   */
  async signInAnonymously() {
    const supabase = getSupabaseOrThrow();
    const { data, error } = await withTimeout(supabase.auth.signInAnonymously());
    if (error) throw error;
    return data?.session || null;
  },

  /**
   * Store Supabase credentials encrypted in SecureStore for silent re-auth.
   * Password is encrypted with the device key before storage.
   */
  async storeCredentials(email, password) {
    const encrypted = await EncryptionService.encryptJson({ email, password });
    await SecureStore.setItemAsync(SUPABASE_CRED_KEY, encrypted, {
      keychainService: 'betweenus',
    });
  },

  /**
   * Silently re-authenticate using stored credentials.
   * Returns a session or null if no stored creds / auth fails.
   */
  async signInWithStoredCredentials() {
    const raw = await SecureStore.getItemAsync(SUPABASE_CRED_KEY, {
      keychainService: 'betweenus',
    });
    if (!raw) return null;
    try {
      // Try decrypting (v2 format); fall back to legacy plaintext JSON
      let creds;
      try {
        creds = await EncryptionService.decryptJson(raw);
      } catch {
        creds = JSON.parse(raw);
        // Auto-migrate plaintext credentials to encrypted format
        if (creds?.email && creds?.password) {
          const encrypted = await EncryptionService.encryptJson(creds);
          await SecureStore.setItemAsync(SUPABASE_CRED_KEY, encrypted, {
            keychainService: 'betweenus',
          });
        }
      }
      const { email, password } = creds || {};
      if (!email || !password) return null;
      return await this.signInWithPassword(email, password);
    } catch {
      return null;
    }
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

  /**
   * Sign out with scope control.
   * @param {'global'|'local'} scope
   *   - 'global' (default): Revokes all refresh tokens. Other devices will be
   *     forced out once their access token expires and refresh fails.
   *   - 'local': Only clears the session on this device.
   */
  async signOut(scope = 'global') {
    const supabase = getSupabaseOrThrow();
    const { error } = await withTimeout(supabase.auth.signOut({ scope }));
    if (error) throw error;
  },

  /**
   * Sign out this device only. Other sessions remain active.
   */
  async signOutLocal() {
    return this.signOut('local');
  },

  /**
   * Sign out everywhere. Revokes all refresh tokens across all devices.
   * Recommended when a phone is lost or account may be compromised.
   */
  async signOutGlobal() {
    return this.signOut('global');
  },

  /**
   * Permanently delete the authenticated user's account via server-side RPC.
   * This deletes the auth.users row (cascading to profiles), couple memberships,
   * couple data created by the user, and cleans up empty couples.
   *
   * Requires the `delete_own_account` PostgreSQL function to be deployed.
   * After this call the session is invalidated — no sign-out needed.
   */
  async deleteAccount() {
    const supabase = getSupabaseOrThrow();
    const { error } = await withTimeout(supabase.rpc('delete_own_account'));
    if (error) throw error;
  },
};

export default SupabaseAuthService;
