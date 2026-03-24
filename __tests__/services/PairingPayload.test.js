const {
  PAIRING_PAYLOAD_VERSION,
  PAIRING_PAYLOAD_TYPE,
  makePairingPayload,
  parsePairingPayload,
} = require('../../services/security/PairingPayload');

describe('PairingPayload', () => {
  const publicKey = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi1234567890=';

  it('builds a v3 payload with pairingCode and publicKey', () => {
    const payload = makePairingPayload({ pairingCode: 'ABC123', publicKey });

    expect(payload).toEqual(
      expect.objectContaining({
        v: PAIRING_PAYLOAD_VERSION,
        t: PAIRING_PAYLOAD_TYPE,
        pairingCode: 'ABC123',
        publicKey,
      })
    );
    expect(typeof payload.createdAt).toBe('number');
  });

  it('parses a valid v3 payload', () => {
    const payload = makePairingPayload({ pairingCode: 'ABC123', publicKey });

    expect(parsePairingPayload(JSON.stringify(payload))).toEqual({
      ok: true,
      payload,
    });
  });

  it('rejects older payload versions', () => {
    const result = parsePairingPayload({
      v: 2,
      t: PAIRING_PAYLOAD_TYPE,
      coupleId: 'legacy-couple-id',
      publicKey,
      createdAt: Date.now(),
    });

    expect(result).toEqual({
      ok: false,
      error: 'This QR code uses an older pairing format. Ask your partner to regenerate it.',
    });
  });

  it('rejects missing pairing codes', () => {
    const result = parsePairingPayload({
      v: PAIRING_PAYLOAD_VERSION,
      t: PAIRING_PAYLOAD_TYPE,
      publicKey,
      createdAt: Date.now(),
    });

    expect(result).toEqual({
      ok: false,
      error: 'QR code is missing required data.',
    });
  });

  it('rejects expired payloads', () => {
    const result = parsePairingPayload({
      v: PAIRING_PAYLOAD_VERSION,
      t: PAIRING_PAYLOAD_TYPE,
      pairingCode: 'ABC123',
      publicKey,
      createdAt: Date.now() - 16 * 60 * 1000,
    });

    expect(result).toEqual({
      ok: false,
      error: 'This pairing code has expired. Ask your partner to create a new one.',
    });
  });
});