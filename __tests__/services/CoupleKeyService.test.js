/**
 * CoupleKeyService.test.js — Tests for HKDF and key exchange
 */

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// We need the real tweetnacl for crypto tests
const nacl = require('tweetnacl');
const naclUtil = require('tweetnacl-util');

// Import after mocks
const CoupleKeyService = require('../../services/security/CoupleKeyService').default;

describe('CoupleKeyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    CoupleKeyService.clearDeviceKeyPairCache();
  });

  describe('_hmacSha512', () => {
    it('produces a 64-byte output', () => {
      const key = nacl.randomBytes(32);
      const message = naclUtil.decodeUTF8('test message');
      const result = CoupleKeyService._hmacSha512(key, message);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(64);
    });

    it('produces consistent output for same inputs', () => {
      const key = nacl.randomBytes(32);
      const message = naclUtil.decodeUTF8('deterministic test');
      const r1 = CoupleKeyService._hmacSha512(key, message);
      const r2 = CoupleKeyService._hmacSha512(key, message);
      expect(naclUtil.encodeBase64(r1)).toBe(naclUtil.encodeBase64(r2));
    });

    it('produces different output for different keys', () => {
      const key1 = nacl.randomBytes(32);
      const key2 = nacl.randomBytes(32);
      const message = naclUtil.decodeUTF8('same message');
      const r1 = CoupleKeyService._hmacSha512(key1, message);
      const r2 = CoupleKeyService._hmacSha512(key2, message);
      expect(naclUtil.encodeBase64(r1)).not.toBe(naclUtil.encodeBase64(r2));
    });

    it('handles keys longer than block size', () => {
      const longKey = nacl.randomBytes(200); // > 128 block size
      const message = naclUtil.decodeUTF8('test');
      const result = CoupleKeyService._hmacSha512(longKey, message);
      expect(result.length).toBe(64);
    });
  });

  describe('_hkdf (RFC 5869)', () => {
    it('produces a 32-byte key by default', () => {
      const ikm = nacl.randomBytes(32);
      const key = CoupleKeyService._hkdf(ikm);
      expect(key).toBeInstanceOf(Uint8Array);
      expect(key.length).toBe(32);
    });

    it('produces consistent output for same inputs', () => {
      const ikm = nacl.randomBytes(32);
      const info = 'test-info';
      const k1 = CoupleKeyService._hkdf(ikm, info);
      const k2 = CoupleKeyService._hkdf(ikm, info);
      expect(naclUtil.encodeBase64(k1)).toBe(naclUtil.encodeBase64(k2));
    });

    it('produces different output for different info strings', () => {
      const ikm = nacl.randomBytes(32);
      const k1 = CoupleKeyService._hkdf(ikm, 'info-1');
      const k2 = CoupleKeyService._hkdf(ikm, 'info-2');
      expect(naclUtil.encodeBase64(k1)).not.toBe(naclUtil.encodeBase64(k2));
    });

    it('supports custom output lengths', () => {
      const ikm = nacl.randomBytes(32);
      const key16 = CoupleKeyService._hkdf(ikm, 'test', null, 16);
      const key64 = CoupleKeyService._hkdf(ikm, 'test', null, 64);
      expect(key16.length).toBe(16);
      expect(key64.length).toBe(64);
    });

    it('supports explicit salt', () => {
      const ikm = nacl.randomBytes(32);
      const salt = nacl.randomBytes(32);
      const withSalt = CoupleKeyService._hkdf(ikm, 'test', salt);
      const withoutSalt = CoupleKeyService._hkdf(ikm, 'test', null);
      expect(naclUtil.encodeBase64(withSalt)).not.toBe(naclUtil.encodeBase64(withoutSalt));
    });
  });

  describe('_kdf', () => {
    it('delegates to _hkdf and returns 32 bytes', () => {
      const ikm = nacl.randomBytes(32);
      const key = CoupleKeyService._kdf(ikm);
      expect(key.length).toBe(32);
    });

    it('uses v2 info string by default', () => {
      const ikm = nacl.randomBytes(32);
      const fromKdf = CoupleKeyService._kdf(ikm);
      const fromHkdf = CoupleKeyService._hkdf(ikm, 'betweenus-couple-key-v2');
      expect(naclUtil.encodeBase64(fromKdf)).toBe(naclUtil.encodeBase64(fromHkdf));
    });
  });

  describe('storeCoupleKey / getCoupleKey', () => {
    const SecureStore = require('expo-secure-store');

    it('rejects invalid key sizes', async () => {
      await expect(
        CoupleKeyService.storeCoupleKey('couple-1', new Uint8Array(16))
      ).rejects.toThrow('Invalid couple key');
    });

    it('stores a valid 32-byte key', async () => {
      const key = nacl.randomBytes(32);
      await CoupleKeyService.storeCoupleKey('couple-1', key);
      expect(SecureStore.setItemAsync).toHaveBeenCalled();
    });

    it('returns null for missing couple key', async () => {
      SecureStore.getItemAsync.mockResolvedValue(null);
      const key = await CoupleKeyService.getCoupleKey('couple-1');
      expect(key).toBeNull();
    });

    it('returns null for empty coupleId', async () => {
      const key = await CoupleKeyService.getCoupleKey(null);
      expect(key).toBeNull();
    });
  });

  describe('hasCoupleKey', () => {
    const SecureStore = require('expo-secure-store');

    it('returns false when no key stored', async () => {
      SecureStore.getItemAsync.mockResolvedValue(null);
      expect(await CoupleKeyService.hasCoupleKey('couple-1')).toBe(false);
    });
  });

  describe('X25519 ECDH key exchange (deriveFromKeyExchange)', () => {
    it('derives the same 32-byte key from both sides of a key exchange', async () => {
      // Simulate two devices: Alice (inviter) and Bob (scanner)
      const aliceKp = nacl.box.keyPair();
      const bobKp = nacl.box.keyPair();

      // Alice derives: nacl.box.before(bobPublicKey, aliceSecretKey) → HKDF
      const aliceRaw = nacl.box.before(bobKp.publicKey, aliceKp.secretKey);
      const aliceDerived = CoupleKeyService._kdf(aliceRaw);

      // Bob derives: nacl.box.before(alicePublicKey, bobSecretKey) → HKDF
      const bobRaw = nacl.box.before(aliceKp.publicKey, bobKp.secretKey);
      const bobDerived = CoupleKeyService._kdf(bobRaw);

      // Both sides must arrive at the same key
      expect(naclUtil.encodeBase64(aliceDerived)).toBe(naclUtil.encodeBase64(bobDerived));
      expect(aliceDerived.length).toBe(32);
    });

    it('deriveFromKeyExchange uses the stored device keypair', async () => {
      const SecureStore = require('expo-secure-store');
      const partnerKp = nacl.box.keyPair();

      // Let the device keypair be generated fresh
      SecureStore.getItemAsync.mockResolvedValueOnce(null);

      const key = await CoupleKeyService.deriveFromKeyExchange(partnerKp.publicKey);
      expect(key).toBeInstanceOf(Uint8Array);
      expect(key.length).toBe(32);
    });

    it('produces different keys for different partners', async () => {
      const SecureStore = require('expo-secure-store');
      const partnerA = nacl.box.keyPair();
      const partnerB = nacl.box.keyPair();

      SecureStore.getItemAsync.mockResolvedValue(null);

      const keyA = await CoupleKeyService.deriveFromKeyExchange(partnerA.publicKey);
      const keyB = await CoupleKeyService.deriveFromKeyExchange(partnerB.publicKey);

      expect(naclUtil.encodeBase64(keyA)).not.toBe(naclUtil.encodeBase64(keyB));
    });
  });

  describe('wrapKeyForDevice / unwrapKeyForDevice', () => {
    it('round-trips the couple key via nacl.box envelope', async () => {
      const SecureStore = require('expo-secure-store');
      SecureStore.getItemAsync.mockResolvedValue(null);

      // Generate a couple key
      const coupleKey = nacl.randomBytes(32);

      // Get this device's public key
      const kp = await CoupleKeyService.getDeviceKeyPair();

      // Wrap the couple key for this same device (self-wrapping test)
      const wrapped = await CoupleKeyService.wrapKeyForDevice(coupleKey, kp.publicKey);
      expect(typeof wrapped).toBe('string');

      const parsed = JSON.parse(wrapped);
      expect(parsed.n).toBeTruthy();
      expect(parsed.c).toBeTruthy();
      expect(parsed.from).toBeTruthy();

      // Unwrap and verify
      const unwrapped = await CoupleKeyService.unwrapKeyForDevice(wrapped);
      expect(unwrapped).toBeInstanceOf(Uint8Array);
      expect(unwrapped.length).toBe(32);
      expect(naclUtil.encodeBase64(unwrapped)).toBe(naclUtil.encodeBase64(coupleKey));
    });

    it('returns null when unwrapping a tampered envelope', async () => {
      const SecureStore = require('expo-secure-store');
      SecureStore.getItemAsync.mockResolvedValue(null);

      const coupleKey = nacl.randomBytes(32);
      const kp = await CoupleKeyService.getDeviceKeyPair();
      const wrapped = await CoupleKeyService.wrapKeyForDevice(coupleKey, kp.publicKey);

      // Tamper with the ciphertext
      const parsed = JSON.parse(wrapped);
      const cBytes = naclUtil.decodeBase64(parsed.c);
      cBytes[0] ^= 0xFF; // flip bits
      parsed.c = naclUtil.encodeBase64(cBytes);

      const result = await CoupleKeyService.unwrapKeyForDevice(JSON.stringify(parsed));
      expect(result).toBeNull();
    });

    it('returns null for malformed JSON input', async () => {
      const result = await CoupleKeyService.unwrapKeyForDevice('not-json');
      expect(result).toBeNull();
    });

    it('returns null when required fields are missing', async () => {
      const result = await CoupleKeyService.unwrapKeyForDevice(JSON.stringify({ n: 'abc' }));
      expect(result).toBeNull();
    });
  });

  describe('rotateCoupleKey', () => {
    it('generates a new 32-byte key and increments the version', async () => {
      const SecureStore = require('expo-secure-store');
      const coupleId = 'couple-rotate-test';

      // Simulate stored version of 1
      SecureStore.getItemAsync.mockImplementation(async (key) => {
        if (key.includes('_kv_')) return '1';
        return null;
      });
      SecureStore.setItemAsync.mockResolvedValue(undefined);

      const { key, version } = await CoupleKeyService.rotateCoupleKey(coupleId);
      expect(key).toBeInstanceOf(Uint8Array);
      expect(key.length).toBe(32);
      expect(version).toBe(2);
    });

    it('produces a different key each rotation', async () => {
      const SecureStore = require('expo-secure-store');
      const coupleId = 'couple-rotate-unique';

      let storedVersion = '1';
      const store = {};
      SecureStore.getItemAsync.mockImplementation(async (key) => {
        if (key.includes('_kv_')) return storedVersion;
        return store[key] || null;
      });
      SecureStore.setItemAsync.mockImplementation(async (key, value) => {
        if (key.includes('_kv_')) storedVersion = value;
        store[key] = value;
      });

      const { key: key1 } = await CoupleKeyService.rotateCoupleKey(coupleId);
      const { key: key2 } = await CoupleKeyService.rotateCoupleKey(coupleId);

      expect(naclUtil.encodeBase64(key1)).not.toBe(naclUtil.encodeBase64(key2));
    });
  });

  describe('clearCoupleKey', () => {
    it('deletes both the key and version entries from SecureStore', async () => {
      const SecureStore = require('expo-secure-store');
      SecureStore.deleteItemAsync.mockResolvedValue(undefined);

      await CoupleKeyService.clearCoupleKey('couple-clear-test');

      const deletedKeys = SecureStore.deleteItemAsync.mock.calls.map(c => c[0]);
      expect(deletedKeys.some(k => k.includes('couple_key_'))).toBe(true);
      expect(deletedKeys.some(k => k.includes('couple_kv_'))).toBe(true);
    });
  });

  describe('getDevicePublicKeyB64', () => {
    it('returns a base64-encoded 32-byte public key', async () => {
      const SecureStore = require('expo-secure-store');
      SecureStore.getItemAsync.mockResolvedValue(null);

      const pubKeyB64 = await CoupleKeyService.getDevicePublicKeyB64();
      expect(typeof pubKeyB64).toBe('string');
      const bytes = naclUtil.decodeBase64(pubKeyB64);
      expect(bytes.length).toBe(32);
    });
  });

  describe('clearDeviceKeyPairCache', () => {
    it('forces a SecureStore read on next call', async () => {
      const SecureStore = require('expo-secure-store');
      SecureStore.getItemAsync.mockResolvedValue(null);

      // Warm the cache
      await CoupleKeyService.getDeviceKeyPair();
      const callsBefore = SecureStore.getItemAsync.mock.calls.length;

      // Clear cache
      CoupleKeyService.clearDeviceKeyPairCache();

      // Next call should hit SecureStore again
      await CoupleKeyService.getDeviceKeyPair();
      expect(SecureStore.getItemAsync.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });
});
