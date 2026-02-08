/**
 * CoupleKeyService.js — X25519 ECDH key exchange for Between Us
 *
 * Flow:
 *   1. Each device generates an X25519 keypair (nacl.box.keyPair).
 *   2. Inviter embeds their PUBLIC key in the QR code.
 *   3. Scanner scans QR, derives shared secret via
 *      nacl.box.before(inviterPublicKey, scannerSecretKey).
 *   4. Scanner's PUBLIC key is sent to Supabase (stored encrypted)
 *      so the inviter can derive the same shared secret.
 *   5. Shared secret is run through HKDF (SHA-512 based) to produce
 *      the final 32-byte couple symmetric key for secretbox.
 *
 * Multi-device:
 *   The couple key is wrapped (encrypted) using nacl.box for each
 *   device's public key. Adding a 2nd device = wrapping the existing
 *   couple key to the new device's pubkey. No re-pairing needed.
 *
 * Key storage (SecureStore):
 *   - Device keypair:  betweenus_device_kp       (64 bytes: secret‖public)
 *   - Couple key:      betweenus_couple_key_{id}  (32 bytes)
 *   - Key version:     betweenus_couple_kv_{id}   (integer, for rotation)
 */

import * as SecureStore from "expo-secure-store";
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";

const COUPLE_KEY_PREFIX = "betweenus_couple_key_";
const COUPLE_KV_PREFIX = "betweenus_couple_kv_";
const DEVICE_KP_NAME = "betweenus_device_kp";
const SERVICE = "betweenus_couple";

const encode = naclUtil.encodeBase64;
const decode = naclUtil.decodeBase64;

// ─── Device keypair (X25519) ────────────────────────────────────────

let _deviceKpCache = null;

const CoupleKeyService = {
  /**
   * Get or create a persistent X25519 keypair for this device.
   * The keypair is stored as secret‖public (64 bytes) in SecureStore.
   * @returns {{ publicKey: Uint8Array, secretKey: Uint8Array }}
   */
  async getDeviceKeyPair() {
    if (_deviceKpCache) return _deviceKpCache;

    const stored = await SecureStore.getItemAsync(DEVICE_KP_NAME, {
      keychainService: SERVICE,
    });

    if (stored) {
      try {
        const bytes = decode(stored);
        if (bytes.length === 64) {
          _deviceKpCache = {
            secretKey: bytes.slice(0, 32),
            publicKey: bytes.slice(32, 64),
          };
          return _deviceKpCache;
        }
      } catch { /* fall through to regenerate */ }
    }

    // Generate fresh keypair
    const kp = nacl.box.keyPair();
    // Store as secret‖public
    const combined = new Uint8Array(64);
    combined.set(kp.secretKey, 0);
    combined.set(kp.publicKey, 32);
    await SecureStore.setItemAsync(DEVICE_KP_NAME, encode(combined), {
      keychainService: SERVICE,
    });
    _deviceKpCache = kp;
    return kp;
  },

  /**
   * Get this device's public key (base64) for embedding in QR codes.
   */
  async getDevicePublicKeyB64() {
    const kp = await this.getDeviceKeyPair();
    return encode(kp.publicKey);
  },

  // ─── Key exchange (ECDH + KDF) ─────────────────────────────────

  /**
   * KDF: SHA-512(info ‖ IKM), truncated to 32 bytes.
   *
   * ⚠️  This is NOT standard HKDF (RFC 5869) because tweetnacl lacks HMAC.
   * It is a one-pass hash-based KDF that is safe for our threat model
   * (each X25519 shared secret is unique per couple key-pair).
   *
   * @param {Uint8Array} ikm — input keying material (X25519 shared secret)
   * @param {string} info — domain separation string
   * @returns {Uint8Array} — 32-byte derived key
   */
  _kdf(ikm, info = "betweenus-couple-key-v1") {
    const infoBytes = naclUtil.decodeUTF8(info);
    const combined = new Uint8Array(ikm.length + infoBytes.length);
    combined.set(infoBytes, 0);
    combined.set(ikm, infoBytes.length);
    const hash = nacl.hash(combined); // 64 bytes (SHA-512)
    return hash.slice(0, 32);
  },

  /**
   * Derive the couple symmetric key from an X25519 shared secret.
   *
   * @param {Uint8Array} partnerPublicKey — the other device's X25519 public key
   * @returns {Promise<Uint8Array>} — 32-byte symmetric key for secretbox
   */
  async deriveFromKeyExchange(partnerPublicKey) {
    const kp = await this.getDeviceKeyPair();
    // X25519 ECDH: both sides compute the same shared secret
    const rawShared = nacl.box.before(partnerPublicKey, kp.secretKey);
    // Run through KDF to get the final couple key
    return this._kdf(rawShared);
  },

  // ─── Multi-device key wrapping ─────────────────────────────────

  /**
   * Wrap (encrypt) the couple key for a specific device's public key.
   * Uses nacl.box (X25519 + XSalsa20-Poly1305 authenticated encryption).
   *
   * @param {Uint8Array} coupleKey — the 32-byte couple symmetric key
   * @param {Uint8Array} targetPublicKey — the device's X25519 public key
   * @returns {Promise<string>} — JSON envelope { n, c } (nonce + ciphertext, base64)
   */
  async wrapKeyForDevice(coupleKey, targetPublicKey) {
    const kp = await this.getDeviceKeyPair();
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const encrypted = nacl.box(coupleKey, nonce, targetPublicKey, kp.secretKey);
    return JSON.stringify({
      n: encode(nonce),
      c: encode(encrypted),
      from: encode(kp.publicKey),
    });
  },

  /**
   * Unwrap (decrypt) a couple key that was wrapped for this device.
   *
   * @param {string} wrappedJson — output from wrapKeyForDevice
   * @returns {Promise<Uint8Array|null>} — the 32-byte couple key, or null
   */
  async unwrapKeyForDevice(wrappedJson) {
    const kp = await this.getDeviceKeyPair();
    let parsed;
    try {
      parsed = typeof wrappedJson === "string" ? JSON.parse(wrappedJson) : wrappedJson;
    } catch {
      return null;
    }

    if (!parsed?.n || !parsed?.c || !parsed?.from) return null;

    const nonce = decode(parsed.n);
    const ciphertext = decode(parsed.c);
    const senderPublicKey = decode(parsed.from);

    const opened = nacl.box.open(ciphertext, nonce, senderPublicKey, kp.secretKey);
    return opened && opened.length === 32 ? opened : null;
  },

  // ─── Couple key storage ────────────────────────────────────────

  /**
   * Store the couple symmetric key in SecureStore.
   * @param {string} coupleId
   * @param {Uint8Array} keyBytes — 32-byte key
   * @param {number} version — key version (for rotation tracking)
   */
  async storeCoupleKey(coupleId, keyBytes, version = 1) {
    if (!keyBytes || keyBytes.length !== 32) {
      throw new Error("Invalid couple key: must be exactly 32 bytes");
    }
    await SecureStore.setItemAsync(
      `${COUPLE_KEY_PREFIX}${coupleId}`,
      encode(keyBytes),
      { keychainService: SERVICE }
    );
    await SecureStore.setItemAsync(
      `${COUPLE_KV_PREFIX}${coupleId}`,
      String(version),
      { keychainService: SERVICE }
    );
    return true;
  },

  /**
   * Retrieve the couple symmetric key.
   * @returns {Uint8Array|null}
   */
  async getCoupleKey(coupleId) {
    if (!coupleId) return null;
    const stored = await SecureStore.getItemAsync(
      `${COUPLE_KEY_PREFIX}${coupleId}`,
      { keychainService: SERVICE }
    );
    if (!stored) return null;
    try {
      const bytes = decode(stored);
      if (bytes.length !== 32) return null;
      return bytes;
    } catch {
      return null;
    }
  },

  /**
   * Get the current key version (for envelope `kid` field).
   * @returns {number}
   */
  async getKeyVersion(coupleId) {
    if (!coupleId) return 0;
    const v = await SecureStore.getItemAsync(
      `${COUPLE_KV_PREFIX}${coupleId}`,
      { keychainService: SERVICE }
    );
    return v ? parseInt(v, 10) : 1;
  },

  /**
   * Rotate the couple key. Generates a new random 32-byte key,
   * stores it, and increments the version.
   *
   * @returns {{ key: Uint8Array, version: number }}
   */
  async rotateCoupleKey(coupleId) {
    const newKey = nacl.randomBytes(32);
    const oldVersion = await this.getKeyVersion(coupleId);
    const newVersion = oldVersion + 1;
    await this.storeCoupleKey(coupleId, newKey, newVersion);
    return { key: newKey, version: newVersion };
  },

  /**
   * Check if we have a valid couple key for the given coupleId.
   */
  async hasCoupleKey(coupleId) {
    const key = await this.getCoupleKey(coupleId);
    return key !== null;
  },

  /**
   * Clear the couple key and version (on unpair / account delete).
   */
  async clearCoupleKey(coupleId) {
    await SecureStore.deleteItemAsync(`${COUPLE_KEY_PREFIX}${coupleId}`, {
      keychainService: SERVICE,
    });
    await SecureStore.deleteItemAsync(`${COUPLE_KV_PREFIX}${coupleId}`, {
      keychainService: SERVICE,
    });
  },

  /**
   * Clear cached device keypair (sign-out / testing).
   */
  clearDeviceKeyPairCache() {
    _deviceKpCache = null;
  },
};

export default CoupleKeyService;
