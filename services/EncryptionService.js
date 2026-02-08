// services/EncryptionService.js
// ✅ Expo-managed compatible
// ✅ Authenticated encryption using tweetnacl.secretbox (XSalsa20-Poly1305)
// ✅ 32-byte key stored in SecureStore (NOT AsyncStorage)
// ✅ Payload format is versioned and portable

import * as SecureStore from "expo-secure-store";
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";

const KEY_NAME = "betweenus_enc_key_v1";

/**
 * Payload format:
 * {
 *   v: 1,
 *   alg: "nacl_secretbox",
 *   nonce: "<base64>",
 *   box: "<base64>"
 * }
 */

function b64encode(bytes) {
  return naclUtil.encodeBase64(bytes);
}

function b64decode(str) {
  return naclUtil.decodeBase64(str);
}

async function getOrCreateKeyBytes() {
  const existing = await SecureStore.getItemAsync(KEY_NAME, {
    keychainService: "betweenus",
  });
  if (existing) {
    try {
      const bytes = b64decode(existing);
      if (bytes?.length === nacl.secretbox.keyLength) return bytes;
    } catch (e) {
      // fall through to regenerate
    }
  }

  const keyBytes = nacl.randomBytes(nacl.secretbox.keyLength);
  await SecureStore.setItemAsync(KEY_NAME, b64encode(keyBytes), {
    keychainService: "betweenus",
  });
  return keyBytes;
}

export const EncryptionService = {
  async getKey() {
    return getOrCreateKeyBytes();
  },

  async clearKey() {
    await SecureStore.deleteItemAsync(KEY_NAME, { keychainService: "betweenus" });
  },

  async encryptString(plainText) {
    if (plainText == null) return null;
    const key = await getOrCreateKeyBytes();

    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const messageBytes = naclUtil.decodeUTF8(String(plainText));

    const box = nacl.secretbox(messageBytes, nonce, key);

    return JSON.stringify({
      v: 1,
      alg: "nacl_secretbox",
      nonce: b64encode(nonce),
      box: b64encode(box),
    });
  },

  async decryptString(payload) {
    if (payload == null) return null;

    if (typeof payload === "string" && payload.trim().startsWith("{")) {
      // likely encrypted payload JSON
    } else if (typeof payload === "string") {
      return payload;
    }

    let parsed;
    try {
      parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
    } catch (e) {
      return typeof payload === "string" ? payload : null;
    }

    if (!parsed || parsed.v !== 1 || parsed.alg !== "nacl_secretbox") {
      return typeof payload === "string" ? payload : null;
    }

    const key = await getOrCreateKeyBytes();
    const nonce = b64decode(parsed.nonce);
    const box = b64decode(parsed.box);

    const opened = nacl.secretbox.open(box, nonce, key);
    if (!opened) {
      throw new Error("Decryption failed: invalid payload or key");
    }

    return naclUtil.encodeUTF8(opened);
  },

  async encryptJson(obj) {
    if (obj == null) return null;
    return this.encryptString(JSON.stringify(obj));
  },

  async decryptJson(payload) {
    const text = await this.decryptString(payload);
    if (text == null) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  },

  async encryptStringWithKey(plainText, keyBytes) {
    if (plainText == null) return null;
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const messageBytes = naclUtil.decodeUTF8(String(plainText));
    const box = nacl.secretbox(messageBytes, nonce, keyBytes);

    return JSON.stringify({
      v: 1,
      alg: "nacl_secretbox",
      nonce: b64encode(nonce),
      box: b64encode(box),
    });
  },

  async decryptStringWithKey(payload, keyBytes) {
    if (payload == null) return null;

    let parsed;
    try {
      parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
    } catch (e) {
      return typeof payload === "string" ? payload : null;
    }

    if (!parsed || parsed.v !== 1 || parsed.alg !== "nacl_secretbox") {
      return typeof payload === "string" ? payload : null;
    }

    const nonce = b64decode(parsed.nonce);
    const box = b64decode(parsed.box);
    const opened = nacl.secretbox.open(box, nonce, keyBytes);
    if (!opened) {
      throw new Error("Decryption failed: invalid payload or key");
    }

    return naclUtil.encodeUTF8(opened);
  },

  async encryptJsonWithKey(obj, keyBytes) {
    if (obj == null) return null;
    return this.encryptStringWithKey(JSON.stringify(obj), keyBytes);
  },

  async decryptJsonWithKey(payload, keyBytes) {
    const text = await this.decryptStringWithKey(payload, keyBytes);
    if (text == null) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  },
};

export default EncryptionService;
