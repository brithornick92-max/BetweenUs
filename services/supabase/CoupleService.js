/**
 * CoupleService.js — Secure partner linking via Supabase
 *
 * Handles:
 *   • Generating hashed, single-use, time-limited invite codes
 *   • Redeeming codes (calls the server-side redeem_partner_code function)
 *   • Getting couple info / membership status
 *   • Uploading photos with signed URLs
 *
 * Security guarantees:
 *   - Invite codes are SHA-256 hashed before storage (plaintext NEVER sent to DB)
 *   - Codes expire in 15 minutes
 *   - Single-use (atomically marked used in a SECURITY DEFINER function)
 *   - Photos stored in private bucket under couples/<couple_id>/
 *   - Signed URLs with short expiry for photo viewing
 */

import { getSupabaseOrThrow } from '../../config/supabase';
import CryptoJS from 'crypto-js';

const CODE_EXPIRY_MINUTES = 15;
const SIGNED_URL_EXPIRY_SECONDS = 300; // 5 minutes
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
const CODE_LENGTH = 6;

const CoupleService = {
  // ─── Partner Linking ──────────────────────────────────────────

  /**
   * Generate a partner invite code.
   * Returns the plaintext code (to show in UI) and stores the hash in Supabase.
   */
  async generateInviteCode() {
    const supabase = getSupabaseOrThrow();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Check user isn't already in a couple
    const { data: existing } = await supabase
      .from('couple_members')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      throw new Error('You are already in a couple');
    }

    // Generate random code
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
    }

    // Hash it — never store the plain code
    const codeHash = CryptoJS.SHA256(code).toString(CryptoJS.enc.Hex);

    // Store hashed code with expiry
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

    const { error } = await supabase
      .from('partner_link_codes')
      .insert({
        code_hash: codeHash,
        created_by: user.id,
        expires_at: expiresAt,
      });

    if (error) throw error;

    return {
      code,             // Show this in the UI (NEVER stored server-side)
      expiresAt,        // Tell the user when it expires
      expiresInMinutes: CODE_EXPIRY_MINUTES,
    };
  },

  /**
   * Redeem a partner invite code.
   * Hashes the input, calls the server-side atomic function.
   * Returns { success, couple_id } or throws.
   */
  async redeemInviteCode(plainCode) {
    const supabase = getSupabaseOrThrow();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Hash the code the same way
    const codeHash = CryptoJS.SHA256(plainCode.toUpperCase().trim()).toString(CryptoJS.enc.Hex);

    // Call the atomic server-side function
    const { data, error } = await supabase
      .rpc('redeem_partner_code', {
        input_code_hash: codeHash,
        redeemer_id: user.id,
      });

    if (error) throw error;

    if (!data?.success) {
      throw new Error(data?.error || 'Failed to redeem code');
    }

    return {
      coupleId: data.couple_id,
      partnerId: data.creator_id,
    };
  },

  // ─── Couple Queries ───────────────────────────────────────────

  /**
   * Get the current user's couple (if any).
   */
  async getMyCouple() {
    const supabase = getSupabaseOrThrow();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: membership } = await supabase
      .from('couple_members')
      .select('couple_id, role, couples(*)')
      .eq('user_id', user.id)
      .maybeSingle();

    return membership || null;
  },

  /**
   * Get my partner's profile (the other couple member).
   */
  async getPartnerProfile() {
    const supabase = getSupabaseOrThrow();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Get my couple
    const { data: myMembership } = await supabase
      .from('couple_members')
      .select('couple_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!myMembership) return null;

    // Get partner membership
    const { data: partnerMembership } = await supabase
      .from('couple_members')
      .select('user_id, profiles(*)')
      .eq('couple_id', myMembership.couple_id)
      .neq('user_id', user.id)
      .maybeSingle();

    return partnerMembership?.profiles || null;
  },

  /**
   * Unlink from couple (remove self from couple_members).
   */
  async unlinkFromCouple() {
    const supabase = getSupabaseOrThrow();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('couple_members')
      .delete()
      .eq('user_id', user.id);

    if (error) throw error;
    return true;
  },

  // ─── Photo Storage ────────────────────────────────────────────

  /**
   * Upload a photo to the couple's private bucket.
   * @param {string} coupleId
   * @param {string} fileUri - Local file URI
   * @param {string} mimeType - e.g. 'image/jpeg'
   * @returns {{ path: string }} - Storage path
   */
  async uploadPhoto(coupleId, fileUri, mimeType = 'image/jpeg') {
    const supabase = getSupabaseOrThrow();

    const ext = mimeType === 'image/png' ? 'png' : 'jpg';
    const fileName = `${crypto.randomUUID?.() || Date.now()}.${ext}`;
    const storagePath = `couples/${coupleId}/${fileName}`;

    // Read the file as blob
    const response = await fetch(fileUri);
    const blob = await response.blob();

    const { error } = await supabase.storage
      .from('couple-media')
      .upload(storagePath, blob, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) throw error;

    return { path: storagePath };
  },

  /**
   * Get a short-lived signed URL for viewing a photo.
   * @param {string} storagePath - e.g. 'couples/<couple_id>/<uuid>.jpg'
   * @returns {string} Signed URL (expires in 5 minutes)
   */
  async getSignedPhotoUrl(storagePath) {
    const supabase = getSupabaseOrThrow();

    const { data, error } = await supabase.storage
      .from('couple-media')
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);

    if (error) throw error;
    return data?.signedUrl;
  },

  /**
   * Delete a photo from the couple's bucket.
   * @param {string} storagePath
   */
  async deletePhoto(storagePath) {
    const supabase = getSupabaseOrThrow();

    const { error } = await supabase.storage
      .from('couple-media')
      .remove([storagePath]);

    if (error) throw error;
    return true;
  },

  // ─── Entitlements (read-only on client) ───────────────────────

  /**
   * Check if the current user has premium (server-side source of truth).
   */
  async checkServerPremium() {
    const supabase = getSupabaseOrThrow();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data } = await supabase
      .from('user_entitlements')
      .select('is_premium, expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!data) return false;

    return data.is_premium && (!data.expires_at || new Date(data.expires_at) > new Date());
  },
};

export default CoupleService;
