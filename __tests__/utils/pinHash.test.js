// @noble/hashes/pbkdf2 doesn't behave as a true PBKDF2 under the Babel/Jest
// CJS transform, so we stub it with a simple deterministic function that IS
// input-sensitive. This lets us test the full hashPin/verifyPin contract.
jest.mock('@noble/hashes/pbkdf2.js', () => ({
  pbkdf2: jest.fn((digest, password, salt, opts) => {
    // Return a fake-but-deterministic 32-byte array based on inputs
    const combined = [...password, ...salt];
    return new Uint8Array(opts.dkLen).map((_, i) => combined[i % combined.length] ^ (i + 1));
  }),
}));

jest.mock('@noble/hashes/sha2.js', () => ({ sha256: 'sha256-stub' }));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn().mockResolvedValue(new Uint8Array(16).fill(0xab)),
  digestStringAsync: jest.fn().mockResolvedValue('legacy-sha256-hash'),
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
}));

const { hashPin, verifyPin, generatePinSalt, PIN_HASH_VERSION } = require('../../utils/pinHash');

describe('hashPin', () => {
  it('returns a hex string and the current version', () => {
    const { hash, version } = hashPin('1234', 'somesalt');
    expect(typeof hash).toBe('string');
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    expect(version).toBe(PIN_HASH_VERSION);
  });

  it('produces the same hash for the same pin + salt', () => {
    const { hash: a } = hashPin('1234', 'somesalt');
    const { hash: b } = hashPin('1234', 'somesalt');
    expect(a).toBe(b);
  });

  it('produces different hashes for different pins', () => {
    const { hash: a } = hashPin('1234', 'somesalt');
    const { hash: b } = hashPin('5678', 'somesalt');
    expect(a).not.toBe(b);
  });

  it('produces different hashes for different salts', () => {
    const { hash: a } = hashPin('1234', 'salt-a');
    const { hash: b } = hashPin('1234', 'salt-b');
    expect(a).not.toBe(b);
  });

  it('returns a 64-char hex string (32-byte derived key)', () => {
    const { hash } = hashPin('0000', 'anysalt');
    expect(hash).toHaveLength(64);
  });
});

describe('verifyPin — v2 (PBKDF2)', () => {
  it('returns true for the correct pin', async () => {
    const salt = 'testsalt';
    const { hash } = hashPin('1234', salt);
    const result = await verifyPin('1234', salt, hash, PIN_HASH_VERSION);
    expect(result).toBe(true);
  });

  it('returns false for a wrong pin', async () => {
    const salt = 'testsalt';
    const { hash } = hashPin('1234', salt);
    const result = await verifyPin('9999', salt, hash, PIN_HASH_VERSION);
    expect(result).toBe(false);
  });
});

describe('verifyPin — v1 legacy (SHA-256)', () => {
  it('delegates to expo-crypto digestStringAsync for version 1', async () => {
    const { digestStringAsync } = require('expo-crypto');
    digestStringAsync.mockResolvedValueOnce('legacy-sha256-hash');
    const result = await verifyPin('1234', 'oldsalt', 'legacy-sha256-hash', 1);
    expect(result).toBe(true);
    expect(digestStringAsync).toHaveBeenCalledWith('SHA256', 'oldsalt1234');
  });

  it('returns false when legacy hash does not match', async () => {
    const { digestStringAsync } = require('expo-crypto');
    digestStringAsync.mockResolvedValueOnce('different-hash');
    const result = await verifyPin('1234', 'oldsalt', 'stored-hash', 1);
    expect(result).toBe(false);
  });
});

describe('generatePinSalt', () => {
  it('returns a hex string', async () => {
    const salt = await generatePinSalt();
    expect(typeof salt).toBe('string');
    expect(/^[0-9a-f]+$/.test(salt)).toBe(true);
  });
});
