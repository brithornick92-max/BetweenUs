/**
 * Shared PIN hashing utility — PBKDF2-SHA256
 *
 * Replaces single-pass SHA-256 with iterated key derivation.
 * 50,000 iterations balances mobile UX (~50-100ms) with brute-force resistance.
 * Combined with SecureStore (hardware-backed) and rate-limiting, this provides
 * defense-in-depth for 4-digit PINs.
 */
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import * as Crypto from 'expo-crypto';

const PIN_ITERATIONS = 50_000;
const PIN_DK_LEN = 32;
const PIN_HASH_VERSION = 2;

function bytesToHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a random 16-byte hex salt.
 */
export async function generatePinSalt() {
  const saltBytes = await Crypto.getRandomBytesAsync(16);
  return bytesToHex(new Uint8Array(saltBytes));
}

/**
 * Hash a PIN with PBKDF2-SHA256 (v2).
 * Returns { hash, version } so callers can store the version alongside the hash.
 */
export function hashPin(pin, salt) {
  const enc = new TextEncoder();
  const derived = pbkdf2(sha256, enc.encode(pin), enc.encode(salt), {
    c: PIN_ITERATIONS,
    dkLen: PIN_DK_LEN,
  });
  return { hash: bytesToHex(derived), version: PIN_HASH_VERSION };
}

/**
 * Verify a PIN against a stored hash.
 * Supports both v2 (PBKDF2) and legacy v1 (single SHA-256).
 * Legacy v1 auto-migrates to v2 on successful verify (handled by callers).
 */
export async function verifyPin(pin, salt, storedHash, version) {
  if (version === PIN_HASH_VERSION) {
    const { hash } = hashPin(pin, salt);
    return hash === storedHash;
  }
  // Legacy v1: single-pass SHA-256 (salt + pin)
  // Salt is 32 hex chars so collision with 4-digit PIN is not practical,
  // but callers should auto-migrate to v2 on success.
  const legacyHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    salt ? salt + pin : pin,
  );
  return legacyHash === storedHash;
}

export { PIN_HASH_VERSION };
