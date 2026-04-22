const fs = require('fs');

let content = fs.readFileSync('context/AuthContext.js', 'utf8');

// remove import
content = content.replace("import EncryptionService from '../services/EncryptionService';\n", "");

// dynamic imports
content = content.replace(
  "          await EncryptionService.clearKey();",
  "          const { default: EncryptionService } = await import('../services/EncryptionService');\n          await EncryptionService.clearKey();"
);

content = content.replace(
  "   * ACCEPTED RISK: Password is stored (encrypted via EncryptionService) in",
  "   * ACCEPTED RISK: Password is stored (encrypted via EncryptionService) in" // skip comment
);

content = content.replace(
  "          const encrypted = await EncryptionService.encryptString('encryption_test');\n          await EncryptionService.decryptString(encrypted);",
  "          const { default: EncryptionService } = await import('../services/EncryptionService');\n          const encrypted = await EncryptionService.encryptString('encryption_test');\n          await EncryptionService.decryptString(encrypted);"
);

content = content.replace(
  "      await EncryptionService.clearKey();",
  "      const { default: EncryptionService } = await import('../services/EncryptionService');\n      await EncryptionService.clearKey();"
);

content = content.replace(
  "      await EncryptionService.clearKey();",
  "      const { default: EncryptionService } = await import('../services/EncryptionService');\n      await EncryptionService.clearKey();"
);

fs.writeFileSync('context/AuthContext.js', content);
