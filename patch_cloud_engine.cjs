const fs = require('fs');

let content = fs.readFileSync('services/storage/CloudEngine.js', 'utf8');

if (content.includes("import E2EEncryption from '../e2ee/E2EEncryption';")) {
  content = content.replace("import E2EEncryption from '../e2ee/E2EEncryption';\n", "");

  content = content.replace(
    "const decrypted = await E2EEncryption.decryptJson(",
    "const { default: E2EEncryption } = await import('../e2ee/E2EEncryption');\n      const decrypted = await E2EEncryption.decryptJson("
  );

  content = content.replace(
    "const encrypted = await E2EEncryption.encryptJson(",
    "const { default: E2EEncryption } = await import('../e2ee/E2EEncryption');\n      const encrypted = await E2EEncryption.encryptJson("
  );

  content = content.replace(
    "const decryptedUpdate = await E2EEncryption.decryptJson(",
    "const { default: E2EEncryption } = await import('../e2ee/E2EEncryption');\n      const decryptedUpdate = await E2EEncryption.decryptJson("
  );

  content = content.replace(
    "const encryptedUpdates = await E2EEncryption.encryptJson(",
    "const { default: E2EEncryption } = await import('../e2ee/E2EEncryption');\n      const encryptedUpdates = await E2EEncryption.encryptJson("
  );

  fs.writeFileSync('services/storage/CloudEngine.js', content);
  console.log('CloudEngine patched');
}
