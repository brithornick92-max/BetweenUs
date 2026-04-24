/**
 * EncryptionService.js — REMOVED
 *
 * Device-level content encryption has been removed.
 * Security is provided by Supabase Auth + RLS + HTTPS.
 *
 * This stub exists so existing import sites don't crash.
 * All methods are no-ops / passthrough.
 */

export const EncryptionService = {
  async getKey() { return null; },
  async clearKey() {},
  async encryptString(plainText) { return plainText; },
  async decryptString(payload) { return typeof payload === 'string' ? payload : null; },
  async encryptJson(obj) { return obj != null ? JSON.stringify(obj) : null; },
  async decryptJson(payload) {
    if (payload == null) return null;
    if (typeof payload === 'object') return payload;
    try { return JSON.parse(payload); } catch { return null; }
  },
  async encryptStringWithKey(plainText) { return plainText; },
  async decryptStringWithKey(payload) { return typeof payload === 'string' ? payload : null; },
  async encryptJsonWithKey(obj) { return obj != null ? JSON.stringify(obj) : null; },
  async decryptJsonWithKey(payload) {
    if (payload == null) return null;
    if (typeof payload === 'object') return payload;
    try { return JSON.parse(payload); } catch { return null; }
  },
};

export default EncryptionService;
