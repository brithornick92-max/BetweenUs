const fs = require('fs');

let content = fs.readFileSync('services/autoClearDecryptedCache.js', 'utf8');

if (content.includes("import EncryptedAttachments from './e2ee/EncryptedAttachments';")) {
  content = content.replace("import EncryptedAttachments from './e2ee/EncryptedAttachments';\n", "");

  content = content.replace(
    "          await EncryptedAttachments.clearDecryptionCache();",
    "          const { default: EncryptedAttachments } = await import('./e2ee/EncryptedAttachments');\n          await EncryptedAttachments.clearDecryptionCache();"
  );
  fs.writeFileSync('services/autoClearDecryptedCache.js', content);
  console.log('patched');
}
