// polyfills.js — MUST be imported before any library that uses crypto
// This provides crypto.getRandomValues for CryptoJS, tweetnacl, and Supabase
// in React Native (Hermes), where neither self nor crypto are defined.

import * as ExpoCrypto from "expo-crypto";

// ① React Native / Hermes does not define `self`.
//    tweetnacl checks `self.crypto` for its PRNG at module-load time.
//    Define self → globalThis so libraries that expect a browser-like global find it.
if (typeof self === "undefined") {
  globalThis.self = globalThis;
}

// ② Polyfill crypto.getRandomValues using expo-crypto's native implementation.
if (!global.crypto) {
  global.crypto = {};
}
if (!global.crypto.getRandomValues) {
  global.crypto.getRandomValues = function getRandomValues(typedArray) {
    const bytes = ExpoCrypto.getRandomBytes(typedArray.byteLength);
    const target = new Uint8Array(
      typedArray.buffer,
      typedArray.byteOffset,
      typedArray.byteLength
    );
    target.set(bytes);
    return typedArray;
  };
}

// ③ Ensure globalThis and self both see the same crypto object.
//    CryptoJS checks self.crypto first, then global.crypto.
//    tweetnacl checks self.crypto only.
if (typeof globalThis !== "undefined" && !globalThis.crypto) {
  globalThis.crypto = global.crypto;
}
if (!self.crypto) {
  self.crypto = global.crypto;
}
