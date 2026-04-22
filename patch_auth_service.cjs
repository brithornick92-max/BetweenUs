const fs = require('fs');

let content = fs.readFileSync('services/supabase/SupabaseAuthService.js', 'utf8');

// remove import
content = content.replace("import { EncryptionService } from '../EncryptionService';\n", "");

// storeCredentials
content = content.replace(
  "    try {\n      const encrypted = await EncryptionService.encryptJson({ email, password });",
  "    try {\n      const { default: EncryptionService } = await import('../EncryptionService');\n      const encrypted = await EncryptionService.encryptJson({ email, password });"
);

// signInWithStoredCredentials
content = content.replace(
  "      let creds;\n      try {\n        creds = await EncryptionService.decryptJson(raw);\n      } catch {\n        creds = JSON.parse(raw);\n        // Auto-migrate plaintext credentials to encrypted format\n        if (creds?.email && creds?.password) {\n          const encrypted = await EncryptionService.encryptJson(creds);",
  "      let creds;\n      const { default: EncryptionService } = await import('../EncryptionService');\n      try {\n        creds = await EncryptionService.decryptJson(raw);\n      } catch {\n        creds = JSON.parse(raw);\n        // Auto-migrate plaintext credentials to encrypted format\n        if (creds?.email && creds?.password) {\n          const encrypted = await EncryptionService.encryptJson(creds);"
);

fs.writeFileSync('services/supabase/SupabaseAuthService.js', content);
