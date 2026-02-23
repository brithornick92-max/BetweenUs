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
});
