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

  onAuthStateChange(callback) {
    const supabase = getSupabaseOrThrow();
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session || null);
    });
  },

  async signOut() {
    const supabase = getSupabaseOrThrow();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};

export default SupabaseAuthService;
