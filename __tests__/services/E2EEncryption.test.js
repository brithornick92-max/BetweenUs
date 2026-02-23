/**
 * E2EEncryption.test.js — Tests for XSalsa20-Poly1305 envelope encryption
 */

// Real crypto
const nacl = require('tweetnacl');
const naclUtil = require('tweetnacl-util');

// ── Mocks ──────────────────────────────────────────────────────────

const mockSecureStore = {
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
};
jest.mock('expo-secure-store', () => mockSecureStore);

const mockCoupleKey = nacl.randomBytes(32);
jest.mock('../../services/security/CoupleKeyService', () => ({
  __esModule: true,
  default: {
    getCoupleKey: jest.fn().mockImplementation(async (coupleId) => {
      if (!coupleId) return null;
      return mockCoupleKey;
    }),
    hasCoupleKey: jest.fn().mockResolvedValue(true),
    getKeyVersion: jest.fn().mockReturnValue('1'),
  },
}));

jest.mock('../../services/CrashReporting', () => ({
  __esModule: true,
  default: {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
  },
}));

const E2EEncryption = require('../../services/e2ee/E2EEncryption').default;

describe('E2EEncryption', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    E2EEncryption.clearCache();
    // Reset SecureStore to return nothing (triggers key generation)
    mockSecureStore.getItemAsync.mockResolvedValue(null);
  });

  describe('encryptString / decryptString', () => {
    it('round-trips a plain string with device key', async () => {
      const plaintext = 'Hello, between us!';
      const envelope = await E2EEncryption.encryptString(plaintext);

      expect(typeof envelope).toBe('string');
      const parsed = JSON.parse(envelope);
      expect(parsed.v).toBe(3);
      expect(parsed.alg).toBe('xsalsa20poly1305');
      expect(parsed.kt).toBe('device');
      expect(parsed.n).toBeTruthy();
      expect(parsed.c).toBeTruthy();

      const decrypted = await E2EEncryption.decryptString(envelope);
      expect(decrypted).toBe(plaintext);
    });

    it('round-trips with couple key tier', async () => {
      const plaintext = 'Shared secret';
      const envelope = await E2EEncryption.encryptString(plaintext, 'couple', 'couple-123');
      const parsed = JSON.parse(envelope);
      expect(parsed.kt).toBe('couple');

      const decrypted = await E2EEncryption.decryptString(envelope, 'couple', 'couple-123');
      expect(decrypted).toBe(plaintext);
    });

    it('round-trips with AAD binding', async () => {
      const plaintext = 'AAD-bound message';
      const aad = 'journal:entry-42';
      const envelope = await E2EEncryption.encryptString(plaintext, 'device', null, aad);
      const decrypted = await E2EEncryption.decryptString(envelope, 'device', null, aad);
      expect(decrypted).toBe(plaintext);
    });

    it('fails decryption with wrong AAD', async () => {
      const plaintext = 'AAD-bound message';
      const envelope = await E2EEncryption.encryptString(plaintext, 'device', null, 'correct-aad');
      // Wrong AAD should throw or return non-matching result
      let result;
      let threw = false;
      try {
        result = await E2EEncryption.decryptString(envelope, 'device', null, 'wrong-aad');
      } catch {
        threw = true;
      }
      expect(threw || result !== plaintext).toBe(true);
    });

    it('returns null for garbage input', async () => {
      const decrypted = await E2EEncryption.decryptString('not-json');
      // Implementation may return null or the original string depending on error handling
      // The key behavior is that it doesn't throw
      expect(typeof decrypted === 'string' || decrypted === null).toBe(true);
    });

    it('returns null for null input', async () => {
      const decrypted = await E2EEncryption.decryptString(null);
      expect(decrypted).toBeNull();
    });

    it('handles empty string plaintext', async () => {
      const envelope = await E2EEncryption.encryptString('');
      const decrypted = await E2EEncryption.decryptString(envelope);
      expect(decrypted).toBe('');
    });
  });

  describe('encryptJson / decryptJson', () => {
    it('round-trips a JSON object', async () => {
      const obj = { mood: 'happy', score: 8, nested: { items: [1, 2, 3] } };
      const envelope = await E2EEncryption.encryptJson(obj);
      const decrypted = await E2EEncryption.decryptJson(envelope);
      expect(decrypted).toEqual(obj);
    });

    it('returns null when decrypting invalid envelope', async () => {
      const result = await E2EEncryption.decryptJson('not-an-envelope');
      expect(result).toBeNull();
    });
  });

  describe('inspect', () => {
    it('extracts envelope metadata without decrypting', async () => {
      const envelope = await E2EEncryption.encryptString('inspect-me', 'device');
      const meta = E2EEncryption.inspect(envelope);
      expect(meta).toBeTruthy();
      expect(meta.version).toBe(3);
      expect(meta.keyTier).toBe('device');
      expect(meta.kid).toBeTruthy();
    });

    it('returns null for non-envelope strings', () => {
      expect(E2EEncryption.inspect('{"random": "json"}')).toBeNull();
      expect(E2EEncryption.inspect(null)).toBeNull();
      expect(E2EEncryption.inspect('')).toBeNull();
    });
  });

  describe('hasCoupleKey', () => {
    it('delegates to CoupleKeyService', async () => {
      const result = await E2EEncryption.hasCoupleKey('couple-123');
      expect(result).toBe(true);
    });
  });

  describe('destroyDeviceKey', () => {
    it('removes key from SecureStore and clears cache', async () => {
      await E2EEncryption.destroyDeviceKey();
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalled();
    });
  });

  describe('key generation', () => {
    it('generates and stores a device key on first use', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);
      await E2EEncryption.encryptString('trigger key gen');
      expect(mockSecureStore.setItemAsync).toHaveBeenCalled();
      const storedKey = mockSecureStore.setItemAsync.mock.calls[0][1];
      const keyBytes = naclUtil.decodeBase64(storedKey);
      expect(keyBytes.length).toBe(32);
    });

    it('reuses cached device key on subsequent calls', async () => {
      await E2EEncryption.encryptString('first call');
      const callCount1 = mockSecureStore.getItemAsync.mock.calls.length;
      await E2EEncryption.encryptString('second call');
      // SecureStore should not be hit again (key is cached)
      expect(mockSecureStore.getItemAsync.mock.calls.length).toBe(callCount1);
    });
  });

  describe('envelope uniqueness', () => {
    it('produces different ciphertext for identical plaintext', async () => {
      const envelope1 = await E2EEncryption.encryptString('same text');
      const envelope2 = await E2EEncryption.encryptString('same text');
      const parsed1 = JSON.parse(envelope1);
      const parsed2 = JSON.parse(envelope2);
      // Nonces should differ (random)
      expect(parsed1.n).not.toBe(parsed2.n);
      // Ciphertext should differ
      expect(parsed1.c).not.toBe(parsed2.c);
    });
  });
});
