import { getSupabaseOrThrow } from "../../config/supabase";

export const SupabaseAuthService = {
  /**
   * Create a new account with email + password.
   */
  async signUp(email, password) {
    if (!email) throw new Error("Email is required");
    if (!password || password.length < 6) throw new Error("Password must be at least 6 characters");
    const supabase = getSupabaseOrThrow();
    const { data, error } = await supabase.auth.signUp({ email, password });
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data?.session || null;
  },

  async sendMagicLink(email) {
    if (!email) throw new Error("Email is required");
    const supabase = getSupabaseOrThrow();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        redirectTo: "betweenus://auth-callback",
      },
    });
    if (error) throw error;
    return true;
  },

  async getSession() {
    const supabase = getSupabaseOrThrow();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data?.session || null;
  },

  async getUser() {
    const supabase = getSupabaseOrThrow();
    const { data, error } = await supabase.auth.getUser();
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
    const { error } = await supabase.auth.signOut({ scope });
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
    const { error } = await supabase.rpc('delete_own_account');
    if (error) throw error;
  },
};

export default SupabaseAuthService;
