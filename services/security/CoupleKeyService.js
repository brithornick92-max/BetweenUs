/**
 * CoupleKeyService.js — REMOVED
 *
 * X25519 ECDH key exchange and couple key management have been removed.
 * Security is provided by Supabase Auth + RLS + HTTPS.
 *
 * This stub exists so existing import sites don't crash.
 * All methods are no-ops.
 */

const CoupleKeyService = {
  async getDeviceKeyPair() { return { publicKey: new Uint8Array(32), secretKey: new Uint8Array(32) }; },
  async getDevicePublicKeyB64() { return ''; },
  async deriveFromKeyExchange() { return new Uint8Array(32); },
  async wrapKeyForDevice() { return null; },
  async unwrapKeyForDevice() { return null; },
  async storeCoupleKey() { return true; },
  async getCoupleKey() { return null; },
  async getKeyVersion() { return 0; },
  async rotateCoupleKey() { return { key: new Uint8Array(32), version: 1 }; },
  async hasCoupleKey() { return false; },
  async clearCoupleKey() {},
  clearDeviceKeyPairCache() {},
  _hmacSha512() { return new Uint8Array(64); },
  _hkdf() { return new Uint8Array(32); },
  _kdf() { return new Uint8Array(32); },
};

export default CoupleKeyService;
