/**
 * UsageLimitsService — Supabase-backed daily usage enforcement
 *
 * Architecture:
 *   • Local cache (AsyncStorage) for instant UI responsiveness
 *   • Supabase usage_events table as the authoritative source
 *   • Graceful offline fallback: local cache is trusted until sync
 *
 * Every "consume" call writes to both local AND remote.
 * Every "check" call reads local first, then validates against remote when online.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { UsageEventType, FREE_LIMITS } from '../utils/featureFlags';

const LOCAL_USAGE_PREFIX = '@betweenus:usage_v2_';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5-minute cache validity

class UsageLimitsService {
  constructor() {
    this._remoteCache = new Map(); // key → { count, fetchedAt }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  _todayKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`; // e.g., '2026-02-08' (local time)
  }

  _localKey(userId, eventType, dayKey) {
    return `${LOCAL_USAGE_PREFIX}${userId}_${eventType}_${dayKey}`;
  }

  // ─── Local Cache Layer ────────────────────────────────────────────────────────

  async _getLocalCount(userId, eventType, dayKey) {
    try {
      const key = this._localKey(userId, eventType, dayKey);
      const raw = await AsyncStorage.getItem(key);
      return raw ? parseInt(raw, 10) : 0;
    } catch {
      return 0;
    }
  }

  async _incrementLocal(userId, eventType, dayKey) {
    try {
      const key = this._localKey(userId, eventType, dayKey);
      const current = await this._getLocalCount(userId, eventType, dayKey);
      await AsyncStorage.setItem(key, String(current + 1));
      return current + 1;
    } catch {
      return 1;
    }
  }

  async _setLocalCount(userId, eventType, dayKey, count) {
    try {
      const key = this._localKey(userId, eventType, dayKey);
      await AsyncStorage.setItem(key, String(count));
    } catch {
      // Ignore write failures
    }
  }

  // ─── Remote (Supabase) Layer ──────────────────────────────────────────────────

  async _getRemoteCount(coupleId, userId, eventType, dayKey) {
    if (!supabase || !coupleId) return null; // Offline or not linked

    const cacheKey = `${coupleId}_${userId}_${eventType}_${dayKey}`;
    const cached = this._remoteCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.count;
    }

    try {
      const { data, error } = await supabase.rpc('get_daily_usage_count', {
        input_couple_id: coupleId,
        input_user_id: userId,
        input_event_type: eventType,
        input_day_key: dayKey,
      });

      if (error) {
        console.warn('[UsageLimits] Remote count query failed:', error.message);
        return null;
      }

      const count = data ?? 0;
      this._remoteCache.set(cacheKey, { count, fetchedAt: Date.now() });
      return count;
    } catch (err) {
      console.warn('[UsageLimits] Remote count exception:', err.message);
      return null;
    }
  }

  async _writeRemoteEvent(coupleId, userId, eventType, dayKey, metadata = {}) {
    if (!supabase || !coupleId) return false;

    try {
      const { error } = await supabase
        .from('usage_events')
        .insert({
          couple_id: coupleId,
          user_id: userId,
          event_type: eventType,
          local_day_key: dayKey,
          metadata,
        });

      if (error) {
        console.warn('[UsageLimits] Remote write failed:', error.message);
        return false;
      }

      // Invalidate cache for this key
      const cacheKey = `${coupleId}_${userId}_${eventType}_${dayKey}`;
      this._remoteCache.delete(cacheKey);

      return true;
    } catch (err) {
      console.warn('[UsageLimits] Remote write exception:', err.message);
      return false;
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  /**
   * Get the current usage count for a given event type today.
   * Prefers remote count when available; falls back to local cache.
   *
   * @param {string} userId
   * @param {string|null} coupleId
   * @param {string} eventType — one of UsageEventType values
   * @returns {Promise<number>}
   */
  async getDailyCount(userId, coupleId, eventType) {
    const dayKey = this._todayKey();

    // Try remote first (authoritative)
    const remoteCount = await this._getRemoteCount(coupleId, userId, eventType, dayKey);
    if (remoteCount !== null) {
      // Sync local cache with remote truth
      await this._setLocalCount(userId, eventType, dayKey, remoteCount);
      return remoteCount;
    }

    // Fallback to local
    return this._getLocalCount(userId, eventType, dayKey);
  }

  /**
   * Check if a user can still consume a daily-limited item.
   *
   * @param {string} userId
   * @param {string|null} coupleId
   * @param {string} eventType
   * @param {number} limit — the daily cap (from FREE_LIMITS)
   * @returns {Promise<{ allowed: boolean, used: number, remaining: number }>}
   */
  async canConsume(userId, coupleId, eventType, limit) {
    const used = await this.getDailyCount(userId, coupleId, eventType);
    const remaining = Math.max(0, limit - used);
    return {
      allowed: used < limit,
      used,
      remaining,
    };
  }

  /**
   * Record a consumption event. Writes to both local and remote.
   *
   * @param {string} userId
   * @param {string|null} coupleId
   * @param {string} eventType
   * @param {object} metadata — optional: { promptId, dateId, ... }
   * @returns {Promise<{ success: boolean, newCount: number }>}
   */
  async recordConsumption(userId, coupleId, eventType, metadata = {}) {
    const dayKey = this._todayKey();

    // Write local immediately (for UI responsiveness)
    const newLocalCount = await this._incrementLocal(userId, eventType, dayKey);

    // Write remote (fire-and-forget for UX, but log failures)
    this._writeRemoteEvent(coupleId, userId, eventType, dayKey, metadata);

    return { success: true, newCount: newLocalCount };
  }

  /**
   * Get full daily usage summary for a user.
   *
   * @param {string} userId
   * @param {string|null} coupleId
   * @param {boolean} isPremiumEffective
   * @returns {Promise<object>}
   */
  async getDailyUsageSummary(userId, coupleId, isPremiumEffective) {
    const promptCount = await this.getDailyCount(userId, coupleId, UsageEventType.PROMPT_VIEWED);
    const dateCount = await this.getDailyCount(userId, coupleId, UsageEventType.DATE_IDEA_VIEWED);

    const promptLimit = isPremiumEffective ? Infinity : FREE_LIMITS.PROMPTS_PER_DAY;
    const dateLimit = isPremiumEffective ? Infinity : FREE_LIMITS.DATE_IDEAS_PER_DAY;

    return {
      prompts: {
        used: promptCount,
        limit: promptLimit,
        remaining: isPremiumEffective ? Infinity : Math.max(0, promptLimit - promptCount),
      },
      dates: {
        used: dateCount,
        limit: dateLimit,
        remaining: isPremiumEffective ? Infinity : Math.max(0, dateLimit - dateCount),
      },
      isPremiumEffective,
    };
  }

  /**
   * Sync local cache with remote for all tracked event types.
   * Call on app foreground / after connectivity change.
   */
  async syncWithRemote(userId, coupleId) {
    if (!supabase || !coupleId) return;

    const dayKey = this._todayKey();
    const eventTypes = Object.values(UsageEventType);

    await Promise.allSettled(
      eventTypes.map(async (eventType) => {
        const remoteCount = await this._getRemoteCount(coupleId, userId, eventType, dayKey);
        if (remoteCount !== null) {
          await this._setLocalCount(userId, eventType, dayKey, remoteCount);
        }
      })
    );
  }

  /**
   * Clear the in-memory remote cache. Useful on logout.
   */
  clearCache() {
    this._remoteCache.clear();
  }
}

export default new UsageLimitsService();
