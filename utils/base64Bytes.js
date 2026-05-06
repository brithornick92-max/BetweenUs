const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_LOOKUP = BASE64_ALPHABET.split('').reduce((lookup, char, index) => {
  lookup[char] = index;
  return lookup;
}, {});

BASE64_LOOKUP['-'] = 62;
BASE64_LOOKUP['_'] = 63;

export function bytesFromBase64(base64 = '') {
  const clean = String(base64).replace(/\s/g, '').replace(/=+$/, '');
  const bytes = [];
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < clean.length; i += 1) {
    const value = BASE64_LOOKUP[clean[i]];
    if (value == null) continue;

    buffer = (buffer << 6) | value;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
      buffer &= bits > 0 ? (1 << bits) - 1 : 0;
    }
  }

  return Uint8Array.from(bytes);
}

export function base64FromBytes(bytes = new Uint8Array()) {
  let output = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const first = bytes[i];
    const second = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const third = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triplet = (first << 16) | (second << 8) | third;

    output += BASE64_ALPHABET[(triplet >> 18) & 0x3f];
    output += BASE64_ALPHABET[(triplet >> 12) & 0x3f];
    output += i + 1 < bytes.length ? BASE64_ALPHABET[(triplet >> 6) & 0x3f] : '=';
    output += i + 2 < bytes.length ? BASE64_ALPHABET[triplet & 0x3f] : '=';
  }

  return output;
}
