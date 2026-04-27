import { getSupabaseOrThrow, TABLES } from '../../config/supabase';

class CloudEngine {
  constructor() {
    this.sessionPresent = false;
  }

  async initialize({ supabaseSessionPresent = false } = {}) {
    this.sessionPresent = !!supabaseSessionPresent;
    return this.sessionPresent;
  }

  _ensureSession() {
    if (!this.sessionPresent) {
      throw new Error('Supabase session required');
    }
  }

  async _getUserId() {
    const supabase = getSupabaseOrThrow();
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data?.user?.id) throw new Error('Supabase user not found');
    return data.user.id;
  }

  async getCurrentUserId() {
    this._ensureSession();
    return this._getUserId();
  }

  /**
   * Create a new couple via SECURITY DEFINER RPC.
   */
  async createCouple() {
    this._ensureSession();
    const supabase = getSupabaseOrThrow();

    const { data, error } = await supabase.rpc('create_couple_for_qr');

    if (error) throw error;
    if (!data?.success) {
      throw new Error(data?.error || 'Failed to create couple');
    }

    return data.couple_id;
  }

  /**
   * Join an existing couple.
   */
  async joinCouple(coupleId) {
    this._ensureSession();
    const supabase = getSupabaseOrThrow();
    const userId = await this._getUserId();

    const { data: existing, error: existingError } = await supabase
      .from(TABLES.COUPLE_MEMBERS)
      .select('couple_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing?.couple_id) {
      if (existing.couple_id === coupleId) return true;
      throw new Error('You are already linked to a partner. Leave your current couple first.');
    }

    const { error } = await supabase.from(TABLES.COUPLE_MEMBERS).insert({
      couple_id: coupleId,
      user_id: userId,
      role: 'member',
    });
    if (error) throw error;
    return true;
  }

  async getPartnerMembership(coupleId) {
    this._ensureSession();
    const supabase = getSupabaseOrThrow();
    const userId = await this._getUserId();
    const { data, error } = await supabase
      .from(TABLES.COUPLE_MEMBERS)
      .select('user_id')
      .eq('couple_id', coupleId)
      .neq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async waitForPartnerMembership(coupleId, timeoutMs = 120_000, intervalMs = 3_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const partner = await this.getPartnerMembership(coupleId);
      if (partner?.user_id) return partner;
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return null;
  }

  async getCoupleData(coupleId, key) {
    this._ensureSession();
    const supabase = getSupabaseOrThrow();
    const { data, error } = await supabase
      .from(TABLES.COUPLE_DATA)
      .select('*')
      .eq('couple_id', coupleId)
      .eq('key', key)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async getProfile(userId) {
    this._ensureSession();
    const supabase = getSupabaseOrThrow();
    const { data, error } = await supabase
      .from(TABLES.PROFILES)
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  }

  async upsertProfile(userId, updates) {
    this._ensureSession();
    const supabase = getSupabaseOrThrow();
    const PROFILE_COLUMNS = ['email', 'display_name', 'is_premium', 'preferences'];
    const safeUpdates = {};
    for (const key of PROFILE_COLUMNS) {
      if (key in updates) safeUpdates[key] = updates[key];
    }
    const { data, error } = await supabase
      .from(TABLES.PROFILES)
      .upsert({
        id: userId,
        ...safeUpdates,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async saveCoupleData(coupleId, key, value, createdBy, isPrivate = false, dataType = 'unknown') {
    this._ensureSession();
    const supabase = getSupabaseOrThrow();
    const { error } = await supabase.from(TABLES.COUPLE_DATA).insert({
      couple_id: coupleId,
      key,
      value,
      data_type: dataType,
      created_by: createdBy,
      is_private: !!isPrivate,
    });
    if (error) throw error;
    return true;
  }

  async updateCoupleData(coupleId, key, value) {
    this._ensureSession();
    const supabase = getSupabaseOrThrow();
    const { error } = await supabase
      .from(TABLES.COUPLE_DATA)
      .update({ value, updated_at: new Date().toISOString() })
      .eq('couple_id', coupleId)
      .eq('key', key);
    if (error) throw error;
    return true;
  }

  async deleteCoupleData(coupleId, key) {
    this._ensureSession();
    const supabase = getSupabaseOrThrow();
    const { error } = await supabase
      .from(TABLES.COUPLE_DATA)
      .delete()
      .eq('couple_id', coupleId)
      .eq('key', key);
    if (error) throw error;
    return true;
  }

  /**
   * Delete all cloud data for the current user.
   * Called during account deletion before the auth user is removed.
   */
  async deleteUserData() {
    this._ensureSession();
    const supabase = getSupabaseOrThrow();
    const userId = await this._getUserId();

    const { data: membership } = await supabase
      .from(TABLES.COUPLE_MEMBERS)
      .select('couple_id')
      .eq('user_id', userId)
      .maybeSingle();

    const coupleId = membership?.couple_id;

    if (coupleId) {
      await supabase
        .from(TABLES.COUPLE_DATA)
        .delete()
        .eq('couple_id', coupleId)
        .eq('created_by', userId);

      await supabase
        .from(TABLES.COUPLE_MEMBERS)
        .delete()
        .eq('couple_id', coupleId)
        .eq('user_id', userId);

      const { count } = await supabase
        .from(TABLES.COUPLE_MEMBERS)
        .select('id', { count: 'exact', head: true })
        .eq('couple_id', coupleId);

      if (count === 0) {
        await supabase.from(TABLES.COUPLE_DATA).delete().eq('couple_id', coupleId);
        await supabase.from(TABLES.COUPLES).delete().eq('id', coupleId);
      }
    }

    await supabase
      .from(TABLES.PROFILES)
      .delete()
      .eq('id', userId);

    return true;
  }
}

export default new CloudEngine();
