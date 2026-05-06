import { base64FromBytes, bytesFromBase64 } from '../../utils/base64Bytes';

describe('base64Bytes', () => {
  it('decodes standard and url-safe base64 without global atob', () => {
    expect(Array.from(bytesFromBase64('SGVsbG8='))).toEqual([72, 101, 108, 108, 111]);
    expect(Array.from(bytesFromBase64('__8='))).toEqual([255, 255]);
  });

  it('encodes bytes with padding', () => {
    expect(base64FromBytes(Uint8Array.from([72, 101, 108, 108, 111]))).toBe('SGVsbG8=');
    expect(base64FromBytes(Uint8Array.from([255, 255]))).toBe('//8=');
  });

  it('round-trips larger binary payloads', () => {
    const bytes = Uint8Array.from(Array.from({ length: 512 }, (_, index) => index % 256));
    const encoded = base64FromBytes(bytes);

    expect(encoded).toBe(globalThis.Buffer.from(bytes).toString('base64'));
    expect(Array.from(bytesFromBase64(encoded))).toEqual(Array.from(bytes));
  });
});
