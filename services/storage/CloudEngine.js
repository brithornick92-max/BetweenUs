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
    const userId = await this._getUserId();
    const { data, error } = await supabase
      .from(TABLES.COUPLES)
      .insert({ created_by: userId })
      .select()
      .single();
    if (error) throw error;

    const memberRow = {
      couple_id: data.id,
      user_id: userId,
      role: 'owner',
    };
    if (devicePublicKeyB64) memberRow.public_key = devicePublicKeyB64;

    await supabase.from(TABLES.COUPLE_MEMBERS).insert(memberRow);

    return data.id;
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
      .single();
    if (error) throw error;
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
    const { data, error } = await supabase
      .from(TABLES.PROFILES)
      .upsert({
        id: userId,
        ...updates,
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
}

export default new CloudEngine();
