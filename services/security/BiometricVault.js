/**
 * BiometricVault.js — Cryptographically-enforced biometric vault
 *
 * This goes beyond a UI lock screen. The vault key is stored in
 * SecureStore with `requireAuthentication: true`, meaning the OS
 * will only release it after a successful biometric prompt
 * (Face ID / Touch ID / fingerprint).
 *
 * Without a successful biometric auth, the vault key bytes are
 * cryptographically inaccessible — not just hidden behind a UI check.
 *
 * Usage:
 *   - Vault entries (journal entries marked "vault") are encrypted
 *     with an additional vault sub-key on top of the device/couple key.
 *   - To read a vault entry: biometric prompt → retrieve vault key →
 *     decrypt outer layer → then decrypt inner layer with device/couple key.
 *
 * Key hierarchy:
 *   Plaintext
 *     → encrypted with device/couple key (standard E2EE layer)
 *       → encrypted with vault key (biometric-gated layer)
 *
 * The vault key is a 32-byte random key stored in SecureStore with
 * `requireAuthentication: true`. On iOS this uses the Secure Enclave;
 * on Android it uses StrongBox or TEE with BiometricPrompt.
 */

import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

const VAULT_KEY_NAME = 'betweenus_vault_key_v1';
const VAULT_SERVICE = 'betweenus_vault';
const b64 = naclUtil.encodeBase64;
const unb64 = naclUtil.decodeBase64;

// Cache the vault key in memory only for the duration of a session.
// Cleared on lock, sign-out, or app background (if configured).
let _vaultKeyCache = null;

const BiometricVault = {
  /**
   * Check if biometric authentication is available on this device.
   * @returns {{ available: boolean, biometryType: string[] }}
   */
  async checkAvailability() {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

    return {
      available: compatible && enrolled,
      biometryTypes: types.map(t => {
        switch (t) {
          case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
            return 'face';
          case LocalAuthentication.AuthenticationType.FINGERPRINT:
            return 'fingerprint';
          case LocalAuthentication.AuthenticationType.IRIS:
            return 'iris';
          default:
            return 'unknown';
        }
      }),
    };
  },

  /**
   * Initialize the vault key. Creates one if it doesn't exist.
   * Requires biometric auth to verify the key is accessible.
   * @returns {boolean} true if vault is ready
   */
  async initialize() {
    const { available } = await this.checkAvailability();
    if (!available) {
      throw new Error('Biometric authentication is not available on this device');
    }

    // Check if vault key already exists
    const existing = await this._getVaultKeyRaw();
    if (existing) return true;

    // Generate a new vault key
    const vaultKey = nacl.randomBytes(32);
    await SecureStore.setItemAsync(VAULT_KEY_NAME, b64(vaultKey), {
      keychainService: VAULT_SERVICE,
      requireAuthentication: true,
      authenticationPrompt: 'Authenticate to set up your vault',
    });

    return true;
  },

  /**
   * Check if the vault has been initialized (key exists).
   */
  async isInitialized() {
    try {
      // We can't read the key without auth, but we can check
      // by attempting to read (will fail with auth error, not "not found")
      const key = await this._getVaultKeyRaw();
      return key !== null;
    } catch {
      // Auth required error means the key exists but needs biometric
      return true;
    }
  },

  /**
   * Authenticate and retrieve the vault key.
   * This triggers the OS biometric prompt.
   * @param {string} [reason] - reason shown to user
   * @returns {Uint8Array} 32-byte vault key
   */
  async authenticate(reason = 'Authenticate to access your vault') {
    // Return cached key if available
    if (_vaultKeyCache) return _vaultKeyCache;

    // First do an explicit biometric check for better UX
    const authResult = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
      fallbackLabel: 'Use Passcode',
    });

    if (!authResult.success) {
      throw new Error('Biometric authentication failed or was cancelled');
    }

    // Now retrieve the key from SecureStore (OS should not prompt again)
    const keyB64 = await SecureStore.getItemAsync(VAULT_KEY_NAME, {
      keychainService: VAULT_SERVICE,
      requireAuthentication: true,
      authenticationPrompt: reason,
    });

    if (!keyB64) {
      throw new Error('Vault key not found. Please re-initialize the vault.');
    }

    const keyBytes = unb64(keyB64);
    if (keyBytes.length !== 32) {
      throw new Error('Vault key is corrupted');
    }

    _vaultKeyCache = keyBytes;
    return keyBytes;
  },

  /**
   * Encrypt data with the vault key (biometric-gated layer).
   * Requires prior authentication.
   *
   * @param {string} ciphertext - already E2EE-encrypted data
   * @returns {string} JSON envelope with vault encryption
   */
  async vaultEncrypt(ciphertext) {
    const vaultKey = await this.authenticate('Authenticate to save to vault');
    const plainBytes = naclUtil.decodeUTF8(ciphertext);
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const box = nacl.secretbox(plainBytes, nonce, vaultKey);

    return JSON.stringify({
      vault: true,
      v: 1,
      n: b64(nonce),
      c: b64(box),
    });
  },

  /**
   * Decrypt vault-encrypted data. Requires biometric auth.
   *
   * @param {string} vaultEnvelope - output from vaultEncrypt
   * @returns {string} the inner E2EE ciphertext
   */
  async vaultDecrypt(vaultEnvelope) {
    if (!vaultEnvelope) return null;

    let parsed;
    try {
      parsed = typeof vaultEnvelope === 'string' ? JSON.parse(vaultEnvelope) : vaultEnvelope;
    } catch {
      return vaultEnvelope; // Not vault-encrypted, return as-is
    }

    if (!parsed?.vault) {
      return vaultEnvelope; // Not vault-encrypted
    }

    const vaultKey = await this.authenticate('Authenticate to view vault entry');
    const nonce = unb64(parsed.n);
    const box = unb64(parsed.c);
    const opened = nacl.secretbox.open(box, nonce, vaultKey);

    if (!opened) {
      throw new Error('Vault decryption failed — biometric key mismatch');
    }

    return naclUtil.encodeUTF8(opened);
  },

  /**
   * Check if a string is vault-encrypted.
   */
  isVaultEncrypted(data) {
    if (!data || typeof data !== 'string') return false;
    try {
      const p = JSON.parse(data);
      return p?.vault === true;
    } catch {
      return false;
    }
  },

  /**
   * Lock the vault (clear cached key).
   * Call on app background, sign-out, or manual lock.
   */
  lock() {
    _vaultKeyCache = null;
  },

  /**
   * Check if the vault is currently unlocked (key cached in memory).
   */
  get isUnlocked() {
    return _vaultKeyCache !== null;
  },

  /**
   * Destroy the vault key entirely (account deletion / vault disable).
   */
  async destroy() {
    _vaultKeyCache = null;
    await SecureStore.deleteItemAsync(VAULT_KEY_NAME, {
      keychainService: VAULT_SERVICE,
    });
  },

  /**
   * Internal: attempt to read the vault key without caching.
   */
  async _getVaultKeyRaw() {
    try {
      const keyB64 = await SecureStore.getItemAsync(VAULT_KEY_NAME, {
        keychainService: VAULT_SERVICE,
        requireAuthentication: true,
      });
      return keyB64 || null;
    } catch {
      return null;
    }
  },
};

export default BiometricVault;
