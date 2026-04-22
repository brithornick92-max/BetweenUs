const fs = require('fs');

let content = fs.readFileSync('services/security/BiometricVault.js', 'utf8');

if (content.includes("import nacl from 'tweetnacl';")) {
  content = content.replace("import nacl from 'tweetnacl';\n", "");
  content = content.replace("import naclUtil from 'tweetnacl-util';\n", "");

  content = content.replace(
    "function getOrCreateVaultKey() {",
    "async function _getNacl() { return await import('tweetnacl'); }\nasync function _getNaclUtil() { return await import('tweetnacl-util'); }\nasync function getOrCreateVaultKey() {"
  );

  content = content.replace(
    "    const keyBytes = nacl.randomBytes(nacl.secretbox.keyLength);\n    const encoded = naclUtil.encodeBase64(keyBytes);",
    "    const { default: nacl } = await import('tweetnacl');\n    const { default: naclUtil } = await import('tweetnacl-util');\n    const keyBytes = nacl.randomBytes(nacl.secretbox.keyLength);\n    const encoded = naclUtil.encodeBase64(keyBytes);"
  );

  content = content.replace(
    "function deserializeData(raw) {\n  try {\n    return JSON.parse(raw);",
    "function deserializeData(raw) {\n  try {\n    return JSON.parse(raw);"
  );

  content = content.replace(
    "    const outerKey = naclUtil.decodeBase64(keyB64);\n    const nonce = naclUtil.decodeBase64(parsed.nonce);\n    const box = naclUtil.decodeBase64(parsed.box);\n    const opened = nacl.secretbox.open(box, nonce, outerKey);\n    if (!opened) return null;\n    return naclUtil.encodeUTF8(opened);",
    "    const { default: nacl } = await import('tweetnacl');\n    const { default: naclUtil } = await import('tweetnacl-util');\n    const outerKey = naclUtil.decodeBase64(keyB64);\n    const nonce = naclUtil.decodeBase64(parsed.nonce);\n    const box = naclUtil.decodeBase64(parsed.box);\n    const opened = nacl.secretbox.open(box, nonce, outerKey);\n    if (!opened) return null;\n    return naclUtil.encodeUTF8(opened);"
  );

  content = content.replace(
    "    const outerKey = naclUtil.decodeBase64(vaultKey);\n    const plainBytes = naclUtil.decodeUTF8(encryptedData);\n    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);\n    const box = nacl.secretbox(plainBytes, nonce, outerKey);\n    return {\n      v: 1,\n      alg: 'vault_nacl_secretbox',\n      nonce: naclUtil.encodeBase64(nonce),\n      box: naclUtil.encodeBase64(box),\n    };",
    "    const { default: nacl } = await import('tweetnacl');\n    const { default: naclUtil } = await import('tweetnacl-util');\n    const outerKey = naclUtil.decodeBase64(vaultKey);\n    const plainBytes = naclUtil.decodeUTF8(encryptedData);\n    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);\n    const box = nacl.secretbox(plainBytes, nonce, outerKey);\n    return {\n      v: 1,\n      alg: 'vault_nacl_secretbox',\n      nonce: naclUtil.encodeBase64(nonce),\n      box: naclUtil.encodeBase64(box),\n    };"
  );

  fs.writeFileSync('services/security/BiometricVault.js', content);
  console.log('BiometricVault patched');
}
