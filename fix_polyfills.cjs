const fs = require('fs');

let content = fs.readFileSync('App.js', 'utf8');

if (!content.includes('import "react-native-get-random-values";\nimport "./polyfills";')) {
  console.log('App.js seems wrong');
}

let svc = fs.readFileSync('services/supabase/SupabaseAuthService.js', 'utf8');
if (svc.includes("import { EncryptionService }")) {
  console.log('Is EncryptionService imported early? Yes.');
}
