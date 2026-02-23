import { getSupabaseOrThrow } from "../../config/supabase";

export const SupabaseAuthService = {
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
};

export default SupabaseAuthService;
