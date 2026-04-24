/**
 * BiometricVault.js — REMOVED
 *
 * The biometric-gated encryption vault has been removed.
 * App lock (UI-level) is still supported via LockScreen + LocalAuthentication.
 * Content encryption on top of Supabase is no longer used.
 *
 * This stub exists so existing import sites don't crash.
 */

const BiometricVault = {
  async checkAvailability() { return { available: false, biometryTypes: [] }; },
  async initialize() { return false; },
  async isInitialized() { return false; },
  async authenticate() { throw new Error('BiometricVault has been removed'); },
  async vaultEncrypt(ciphertext) { return ciphertext; },
  async vaultDecrypt(vaultEnvelope) { return vaultEnvelope; },
  isVaultEncrypted() { return false; },
  lock() {},
  get isUnlocked() { return false; },
  async destroy() {},
  async _getVaultKeyRaw() { return null; },
};

export default BiometricVault;
