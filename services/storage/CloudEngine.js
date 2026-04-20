import { getSupabaseOrThrow, TABLES } from '../../config/supabase';
import E2EEncryption from '../e2ee/E2EEncryption';

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
   * Create a new couple. Stores the inviter's X25519 public key in
   * couple_members so the scanner can later read it (and vice versa).
   * @param {string} [devicePublicKeyB64] — this device's X25519 public key
   */
  async createCouple(devicePublicKeyB64) {
    this._ensureSession();
    const supabase = getSupabaseOrThrow();

    // Use a SECURITY DEFINER RPC to bypass RLS (same pattern as redeem_pairing_code).
    // Direct INSERTs into `couples` fail when the JWT is stale or the user is anonymous.
    const { data, error } = await supabase.rpc('create_couple_for_qr', {
      device_public_key: devicePublicKeyB64 ?? null,
    });

    if (error) throw error;
    if (!data?.success) {
      throw new Error(data?.error || 'Failed to create couple');
    }

    return data.couple_id;
  }

  /**
   * Join an existing couple. Stores this device's X25519 public key.
   * @param {string} coupleId
   * @param {string} [devicePublicKeyB64] — this device's X25519 public key
   */
  async joinCouple(coupleId, devicePublicKeyB64) {
    this._ensureSession();
    const supabase = getSupabaseOrThrow();
    const userId = await this._getUserId();

    // If the membership already exists for this couple, update the key in place.
    const { data: existing, error: existingError } = await supabase
      .from(TABLES.COUPLE_MEMBERS)
      .select('couple_id, public_key')
      .eq('user_id', userId)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing?.couple_id) {
      if (existing.couple_id === coupleId) {
        if (devicePublicKeyB64 && existing.public_key !== devicePublicKeyB64) {
          const { error: updateError } = await supabase
            .from(TABLES.COUPLE_MEMBERS)
            .update({ public_key: devicePublicKeyB64 })
            .eq('couple_id', coupleId)
            .eq('user_id', userId);
          if (updateError) throw updateError;
        }
        return true;
      }

      throw new Error('You are already linked to a partner. Leave your current couple first.');
    }

    const memberRow = {
      couple_id: coupleId,
      user_id: userId,
      role: 'member',
    };
    if (devicePublicKeyB64) memberRow.public_key = devicePublicKeyB64;

    const { error } = await supabase.from(TABLES.COUPLE_MEMBERS).insert(memberRow);
    if (error) throw error;
    return true;
  }

  async getMyMembershipKeyMaterial(coupleId) {
    this._ensureSession();
    const supabase = getSupabaseOrThrow();
    const userId = await this._getUserId();
    const { data, error } = await supabase
      .from(TABLES.COUPLE_MEMBERS)
      .select('public_key, wrapped_couple_key')
      .eq('couple_id', coupleId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async getPartnerMembership(coupleId) {
    this._ensureSession();
    const supabase = getSupabaseOrThrow();
    const userId = await this._getUserId();
    const { data, error } = await supabase
      .from(TABLES.COUPLE_MEMBERS)
      .select('user_id, public_key, wrapped_couple_key')
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
      if (partner?.public_key && partner?.user_id) return partner;
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return null;
  }

  async setMyWrappedCoupleKey(coupleId, wrappedCoupleKey) {
    this._ensureSession();
    const supabase = getSupabaseOrThrow();
    const userId = await this._getUserId();
    const { error } = await supabase
      .from(TABLES.COUPLE_MEMBERS)
      .update({ wrapped_couple_key: wrappedCoupleKey })
      .eq('couple_id', coupleId)
      .eq('user_id', userId);
    if (error) throw error;
    return true;
  }

  async waitForMyWrappedCoupleKey(coupleId, timeoutMs = 120_000, intervalMs = 3_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const material = await this.getMyMembershipKeyMaterial(coupleId);
      if (material?.wrapped_couple_key) return material.wrapped_couple_key;
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return null;
  }

  /**
   * Get the partner's public key from couple_members.
   * Returns null if the partner hasn't uploaded theirs yet.
   * @param {string} coupleId
   * @returns {Promise<string|null>} — base64-encoded X25519 public key
   */
  async getPartnerPublicKey(coupleId) {
    this._ensureSession();
    const supabase = getSupabaseOrThrow();
    const userId = await this._getUserId();
    const { data, error } = await supabase
      .from(TABLES.COUPLE_MEMBERS)
      .select('public_key')
      .eq('couple_id', coupleId)
      .neq('user_id', userId)
      .single();
    if (error || !data?.public_key) return null;
    return data.public_key;
  }

  /**
   * Poll until partner's public key is available (for inviter flow).
   * @param {string} coupleId
   * @param {number} timeoutMs — max wait time (default 2 min)
   * @param {number} intervalMs — poll interval (default 3s)
   * @returns {Promise<string|null>}
   */
  async waitForPartnerPublicKey(coupleId, timeoutMs = 120_000, intervalMs = 3_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const pk = await this.getPartnerPublicKey(coupleId);
      if (pk) return pk;
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return null;
  }

  async getCoupleData(coupleId, key, coupleKey = null) {
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
    if (!data) return null;
    if (data?.encrypted_value) {
      if (!coupleKey) {
        return { ...data, locked: true };
      }
      try {
        const decrypted = await E2EEncryption.decryptJson(
          data.encrypted_value, 'couple', coupleId
        );
        return { ...data, value: decrypted, encrypted_value: null, locked: false };
      } catch {
        return { ...data, locked: true };
      }
    }
    return data;
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
    // Only send columns that exist on the profiles table to avoid
    // Supabase errors from app-local fields like partnerNames.
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
      encrypted_value: null,
      data_type: dataType,
      created_by: createdBy,
      is_private: !!isPrivate,
    });
    if (error) throw error;
    return true;
  }

  async saveCoupleDataEncrypted(coupleId, key, value, createdBy, isPrivate = false, dataType = 'unknown', _coupleKey) {
    this._ensureSession();
    const supabase = getSupabaseOrThrow();
    const encryptedValue = await E2EEncryption.encryptJson(
      value, 'couple', coupleId, `${dataType}:${key}`
    );
    const { error } = await supabase.from(TABLES.COUPLE_DATA).insert({
      couple_id: coupleId,
      key,
      encrypted_value: encryptedValue,
      value: null,
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

  async updateCoupleDataEncrypted(coupleId, key, value, _coupleKey) {
    this._ensureSession();
    const supabase = getSupabaseOrThrow();
    const encryptedValue = await E2EEncryption.encryptJson(
      value, 'couple', coupleId
    );
    const { error } = await supabase
      .from(TABLES.COUPLE_DATA)
      .update({ encrypted_value: encryptedValue, value: null, updated_at: new Date().toISOString() })
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
   * Delete all cloud data for the current user: profile, couple membership,
   * couple data they created, and empty couples left behind.
   * Called during account deletion before the auth user is removed.
   */
  async deleteUserData() {
    this._ensureSession();
    const supabase = getSupabaseOrThrow();
    const userId = await this._getUserId();

    // 1. Find the user's couple (if any)
    const { data: membership } = await supabase
      .from(TABLES.COUPLE_MEMBERS)
      .select('couple_id')
      .eq('user_id', userId)
      .maybeSingle();

    const coupleId = membership?.couple_id;

    if (coupleId) {
      // 2. Delete couple_data rows this user created
      await supabase
        .from(TABLES.COUPLE_DATA)
        .delete()
        .eq('couple_id', coupleId)
        .eq('created_by', userId);

      // 3. Remove user from couple_members
      await supabase
        .from(TABLES.COUPLE_MEMBERS)
        .delete()
        .eq('couple_id', coupleId)
        .eq('user_id', userId);

      // 4. If no members remain, delete the couple entirely
      const { count } = await supabase
        .from(TABLES.COUPLE_MEMBERS)
        .select('id', { count: 'exact', head: true })
        .eq('couple_id', coupleId);

      if (count === 0) {
        await supabase.from(TABLES.COUPLE_DATA).delete().eq('couple_id', coupleId);
        await supabase.from(TABLES.COUPLES).delete().eq('id', coupleId);
      }
    }

    // 5. Delete the user's profile
    await supabase
      .from(TABLES.PROFILES)
      .delete()
      .eq('id', userId);

    return true;
  }
}

export default new CloudEngine();
