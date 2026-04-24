/**
 * E2EEncryption.js — REMOVED
 *
 * Client-side content encryption has been removed.
 * Security is provided by Supabase Auth + RLS + HTTPS.
 *
 * This stub exists only so that the legacy migrateLegacyStorage() path
 * can still import it without crashing. All methods are no-ops that
 * return the input unchanged (plaintext passthrough).
 */

const E2EEncryption = {
  async encryptString(plaintext) { return plaintext; },
  async decryptString(envelope) { return envelope; },
  async encryptJson(obj) { return obj != null ? JSON.stringify(obj) : null; },
  async decryptJson(envelope) {
    if (envelope == null) return null;
    if (typeof envelope === 'object') return envelope;
    try { return JSON.parse(envelope); } catch { return null; }
  },
  async encryptFile(fileBytes) { return { ciphertext: fileBytes, nonce: '', kid: '' }; },
  async decryptFile(cipherBytes) { return cipherBytes; },
  async reEncrypt(envelope) { return envelope; },
  inspect() { return null; },
  async hasCoupleKey() { return false; },
  clearCache() {},
  async destroyDeviceKey() {},
};

export default E2EEncryption;
