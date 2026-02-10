/**
 * E2EEncryption.js  v2 envelope — End-to-end encryption for Between Us
 *
 * Two key tiers:
 *   1. **Device key** — per-device 256-bit key in SecureStore.
 *      Encrypts data only THIS device should read (solo journal, local vault).
 *
 *   2. **Couple key** — shared 256-bit key derived via X25519 ECDH during pairing.
 *      Encrypts data BOTH partners must read (prompt answers, shared memories,
 *      rituals, vibes, check-ins).
 *
 * Algorithm: XSalsa20-Poly1305 (nacl.secretbox) — authenticated, 256-bit key,
 * 192-bit random nonce, ciphertext + 16-byte Poly1305 MAC.
 *
 * ─── Envelope v2 ────────────────────────────────────────────────────
 *
 *   {
 *     v:   3,                          // envelope version (bump from 2)
 *     alg: "xsalsa20poly1305",         // explicit algorithm name
 *     n:   "<base64 nonce>",           // 24-byte random nonce
 *     c:   "<base64 ciphertext+MAC>",  // nacl.secretbox output
 *     kt:  "device" | "couple",        // which key tier was used
 *     kid: "<key version string>",     // key ID for rotation (e.g. "1", "2")
 *     aad: "<base64>" | undefined      // optional authenticated associated data
 *   }
 *
 *   `kid` — the version number of the key used. On decrypt, if the
 *     envelope's kid doesn't match the current key version, the caller
 *     can look up a historical key (future: key ring support).
 *
 *   `aad` — if provided, a SHA-512 hash of the AAD is mixed into the
 *     nonce derivation before encryption. This binds metadata (like
 *     record type + id) to the ciphertext so it can't be swapped
 *     between records without detection. For nacl.secretbox (which
 *     doesn't have native AAD), we prepend the AAD hash to the
 *     plaintext before boxing, and verify + strip it on unbox.
 *
 * ─── Key fallback policy ────────────────────────────────────────────
 *
 *   NEVER silently fall back to device key when couple key is requested
 *   but missing. Instead, throw. The caller (DataLayer) must handle
 *   the error by queuing locally + showing a "Reconnect" banner.
 */

import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import * as SecureStore from 'expo-secure-store';
import CoupleKeyService from '../security/CoupleKeyService';

// ─── Base64 / UTF-8 helpers ─────────────────────────────────────────
const b64 = naclUtil.encodeBase64;
const unb64 = naclUtil.decodeBase64;
const toBytes = naclUtil.decodeUTF8;
const fromBytes = naclUtil.encodeUTF8;

// ─── Constants ──────────────────────────────────────────────────────
const ENVELOPE_VERSION = 3;
const ALG = 'xsalsa20poly1305';
const DEVICE_KEY_NAME = 'betweenus_enc_key_v1';
const AAD_TAG_LEN = 32; // first 32 bytes of SHA-512

// ─── Device key (per-device) ────────────────────────────────────────
let _deviceKeyCache = null;

async function getDeviceKey() {
  if (_deviceKeyCache) return _deviceKeyCache;
  const existing = await SecureStore.getItemAsync(DEVICE_KEY_NAME, {
    keychainService: 'betweenus',
  });
  if (existing) {
    try {
      const bytes = unb64(existing);
      if (bytes.length === nacl.secretbox.keyLength) {
        _deviceKeyCache = bytes;
        return bytes;
      }
    } catch { /* regenerate */ }
  }
  const keyBytes = nacl.randomBytes(nacl.secretbox.keyLength);
  await SecureStore.setItemAsync(DEVICE_KEY_NAME, b64(keyBytes), {
    keychainService: 'betweenus',
  });
  _deviceKeyCache = keyBytes;
  return keyBytes;
}

// ─── Key resolution (STRICT — no silent fallback) ───────────────────

async function resolveKey(keyTier, coupleId) {
  if (keyTier === 'device') {
    return { key: await getDeviceKey(), kid: 'device-1' };
  }
  if (keyTier === 'couple') {
    if (!coupleId) {
      throw new Error('E2EE: couple key requested but no coupleId provided');
    }
    const k = await CoupleKeyService.getCoupleKey(coupleId);
    if (!k) {
      throw new Error(`E2EE: couple key not found for ${coupleId}. Re-pairing required.`);
    }
    const version = await CoupleKeyService.getKeyVersion(coupleId);
    return { key: k, kid: `couple-${version}` };
  }
  throw new Error(`E2EE: unknown keyTier "${keyTier}"`);
}

// ─── AAD binding ────────────────────────────────────────────────────
// We simulate AAD for nacl.secretbox by prepending a 32-byte hash of
// the AAD to the plaintext. On decrypt we verify and strip it.

function computeAadTag(aadBytes) {
  return nacl.hash(aadBytes).slice(0, AAD_TAG_LEN);
}

function bindAad(plainBytes, aadString) {
  if (!aadString) return plainBytes;
  const aadBytes = toBytes(aadString);
  const tag = computeAadTag(aadBytes);
  const combined = new Uint8Array(tag.length + plainBytes.length);
  combined.set(tag, 0);
  combined.set(plainBytes, tag.length);
  return combined;
}

function unbindAad(decryptedBytes, aadString) {
  if (!aadString) return decryptedBytes;
  const aadBytes = toBytes(aadString);
  const expectedTag = computeAadTag(aadBytes);

  if (decryptedBytes.length < AAD_TAG_LEN) {
    throw new Error('E2EE: decrypted data too short to contain AAD tag');
  }

  const actualTag = decryptedBytes.slice(0, AAD_TAG_LEN);
  if (!nacl.verify(actualTag, expectedTag)) {
    throw new Error('E2EE: AAD mismatch — ciphertext may have been moved between records');
  }

  return decryptedBytes.slice(AAD_TAG_LEN);
}

// ─── Core encrypt / decrypt ─────────────────────────────────────────

function encryptBytesRaw(plainBytes, keyBytes, keyTier, kid, aadString) {
  const bound = bindAad(plainBytes, aadString);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const box = nacl.secretbox(bound, nonce, keyBytes);
  const envelope = {
    v: ENVELOPE_VERSION,
    alg: ALG,
    n: b64(nonce),
    c: b64(box),
    kt: keyTier,
    kid,
  };
  if (aadString) {
    envelope.aad = b64(toBytes(aadString));
  }
  return JSON.stringify(envelope);
}

function decryptBytesRaw(envelope, keyBytes, aadString) {
  if (envelope == null) return null;
  let parsed;
  try {
    parsed = typeof envelope === 'string' ? JSON.parse(envelope) : envelope;
  } catch {
    // Not encrypted — return raw string as-is (migration path for plaintext)
    return typeof envelope === 'string' ? toBytes(envelope) : null;
  }

  // Support legacy envelopes (v2 alg:"nacl_secretbox") and new v3
  const supportedAlgs = [ALG, 'nacl_secretbox'];
  if (!parsed || !supportedAlgs.includes(parsed.alg)) {
    // Not an envelope — raw plaintext
    return typeof envelope === 'string' ? toBytes(envelope) : null;
  }

  const nonce = unb64(parsed.n || parsed.nonce);
  const box = unb64(parsed.c || parsed.box);
  const opened = nacl.secretbox.open(box, nonce, keyBytes);
  if (!opened) {
    throw new Error('E2EE: decryption failed (wrong key or tampered data)');
  }

  // For legacy v2 envelopes without AAD binding, skip unbind
  if (parsed.v < ENVELOPE_VERSION || !parsed.aad) {
    return opened;
  }

  return unbindAad(opened, aadString);
}

// ─── Public API ─────────────────────────────────────────────────────

const E2EEncryption = {
  /**
   * Encrypt a string.
   * @param {string} plaintext
   * @param {'device'|'couple'} keyTier
   * @param {string|null} coupleId  - required when keyTier='couple'
   * @param {string|null} aad      - optional associated data string (e.g. "journal_entry:uuid")
   * @returns {Promise<string>}     - JSON envelope (ciphertext)
   */
  async encryptString(plaintext, keyTier = 'device', coupleId = null, aad = null) {
    if (plaintext == null) return null;
    const { key, kid } = await resolveKey(keyTier, coupleId);
    return encryptBytesRaw(toBytes(String(plaintext)), key, keyTier, kid, aad);
  },

  /**
   * Decrypt a string.
   * @param {string} envelope     - JSON envelope from encryptString
   * @param {'device'|'couple'} keyTier
   * @param {string|null} coupleId
   * @param {string|null} aad    - must match the AAD used during encryption
   * @returns {Promise<string|null>}
   */
  async decryptString(envelope, keyTier = 'device', coupleId = null, aad = null) {
    if (envelope == null) return null;
    const { key } = await resolveKey(keyTier, coupleId);
    const bytes = decryptBytesRaw(envelope, key, aad);
    return bytes ? fromBytes(bytes) : null;
  },

  /**
   * Encrypt a JSON-serializable object.
   */
  async encryptJson(obj, keyTier = 'device', coupleId = null, aad = null) {
    if (obj == null) return null;
    return this.encryptString(JSON.stringify(obj), keyTier, coupleId, aad);
  },

  /**
   * Decrypt a JSON object.
   */
  async decryptJson(envelope, keyTier = 'device', coupleId = null, aad = null) {
    const text = await this.decryptString(envelope, keyTier, coupleId, aad);
    if (text == null) return null;
    try {
      return JSON.parse(text);
    } catch (err) {
      console.warn('[E2EEncryption] decryptJson: JSON.parse failed after successful decryption:', err?.message);
      return null;
    }
  },

  /**
   * Encrypt raw bytes (for file encryption).
   * Returns { ciphertext: Uint8Array, nonce: string (base64), kid: string }
   */
  async encryptFile(fileBytes, keyTier = 'device', coupleId = null) {
    const { key, kid } = await resolveKey(keyTier, coupleId);
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const box = nacl.secretbox(fileBytes, nonce, key);
    return { ciphertext: box, nonce: b64(nonce), kid };
  },

  /**
   * Decrypt raw bytes (for file decryption).
   * @param {Uint8Array} cipherBytes
   * @param {string} nonceB64  - base64 nonce from encryptFile
   */
  async decryptFile(cipherBytes, nonceB64, keyTier = 'device', coupleId = null) {
    const { key } = await resolveKey(keyTier, coupleId);
    const nonce = unb64(nonceB64);
    const opened = nacl.secretbox.open(cipherBytes, nonce, key);
    if (!opened) throw new Error('E2EE: file decryption failed');
    return opened;
  },

  /**
   * Re-encrypt a value from one key tier to another
   * (e.g. device -> couple when user links a partner).
   */
  async reEncrypt(envelope, fromTier, fromCoupleId, toTier, toCoupleId) {
    const plaintext = await this.decryptString(envelope, fromTier, fromCoupleId);
    if (plaintext == null) return null;
    return this.encryptString(plaintext, toTier, toCoupleId);
  },

  /**
   * Inspect an envelope without decrypting.
   * Returns { version, keyTier, kid, hasAad } or null if not an envelope.
   */
  inspect(envelope) {
    if (!envelope || typeof envelope !== 'string') return null;
    try {
      const p = JSON.parse(envelope);
      if ([ALG, 'nacl_secretbox'].includes(p.alg)) {
        return {
          version: p.v || 1,
          keyTier: p.kt || 'device',
          kid: p.kid || null,
          hasAad: !!p.aad,
        };
      }
    } catch { /* not an envelope */ }
    return null;
  },

  /**
   * Check if a couple key is available for the given coupleId.
   * Use this before attempting couple-tier encryption to avoid throwing.
   */
  async hasCoupleKey(coupleId) {
    return CoupleKeyService.hasCoupleKey(coupleId);
  },

  /** Clear cached device key (call on sign-out). */
  clearCache() {
    _deviceKeyCache = null;
  },

  /** Delete device key from SecureStore (call on account delete). */
  async destroyDeviceKey() {
    _deviceKeyCache = null;
    await SecureStore.deleteItemAsync(DEVICE_KEY_NAME, {
      keychainService: 'betweenus',
    });
  },
};

export default E2EEncryption;
