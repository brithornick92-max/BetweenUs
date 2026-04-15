/**
 * ReferralService — Couple-to-couple referral system
 *
 * Each couple gets a unique referral code. When another couple signs up
 * using that code, both couples get 1 month of premium free.
 *
 * Architecture:
 *   - Referral codes stored in Supabase `referrals` table
 *   - Rewards tracked in `referral_rewards` table
 *   - Codes are 8-char alphanumeric, tied to couple_id
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseOrThrow } from '../config/supabase';
import { Share } from 'react-native';

const REFERRAL_CODE_KEY = '@betweenus:referral_code';

const ReferralService = {
  _code: null,

  /**
   * Get or generate this couple's referral code.
   */
  async getOrCreateCode(coupleId) {
    if (!coupleId) return null;

    // Check cache
    if (this._code) return this._code;
    const cached = await AsyncStorage.getItem(REFERRAL_CODE_KEY);
    if (cached) { this._code = cached; return cached; }

    try {
      const supabase = getSupabaseOrThrow();

      // Check if code already exists
      const { data: existing } = await supabase
        .from('referrals')
        .select('code')
        .eq('couple_id', coupleId)
        .single();

      if (existing?.code) {
        this._code = existing.code;
        await AsyncStorage.setItem(REFERRAL_CODE_KEY, existing.code);
        return existing.code;
      }

      // Generate new code
      const code = this._generateCode();
      const { error } = await supabase.from('referrals').insert({
        couple_id: coupleId,
        code,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      this._code = code;
      await AsyncStorage.setItem(REFERRAL_CODE_KEY, code);
      return code;
    } catch (e) {
      if (__DEV__) console.warn('[Referral] getOrCreateCode error:', e?.message);
      return null;
    }
  },

  /**
   * Apply a referral code during onboarding.
   */
  async applyReferralCode(code, newCoupleId) {
    if (!code || !newCoupleId) return { success: false, error: 'Missing code or couple ID' };

    try {
      const supabase = getSupabaseOrThrow();
      const { data, error } = await supabase.rpc('apply_referral', {
        referral_code: code.toUpperCase(),
        new_couple_id: newCoupleId,
      });

      if (error) throw error;

      return { success: true, referrerCoupleId: data?.referrer_couple_id };
    } catch (e) {
      if (__DEV__) console.warn('[Referral] apply error:', e?.message);
      return { success: false, error: e?.message };
    }
  },

  /**
   * Get referral stats for the current couple.
   */
  async getStats(coupleId) {
    if (!coupleId) return { code: null, referralCount: 0, rewardsEarned: 0 };

    try {
      const supabase = getSupabaseOrThrow();
      const { data } = await supabase
        .from('referrals')
        .select('code, referral_count, rewards_earned')
        .eq('couple_id', coupleId)
        .single();

      return {
        code: data?.code || null,
        referralCount: data?.referral_count || 0,
        rewardsEarned: data?.rewards_earned || 0,
      };
    } catch {
      return { code: null, referralCount: 0, rewardsEarned: 0 };
    }
  },

  /**
   * Share referral link via native share sheet.
   */
  async shareReferralLink(code) {
    if (!code) return;
    try {
      await Share.share({
        message: `My partner and I love Between Us — it's brought us closer every day. Try it with your partner and we both get a free month of Premium!\n\nUse code: ${code}\nhttps://betweenus.app/refer/${code}`,
        title: 'Share Between Us with another couple',
      });
    } catch {
      // User cancelled share
    }
  },

  _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 for readability
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  },
};

export default ReferralService;
