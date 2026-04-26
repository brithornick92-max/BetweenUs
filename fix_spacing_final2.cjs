const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, 'screens');

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  if (content.includes('SPACING') && !content.includes('import { SPACING')) {
      if (content.includes("import {") && content.includes("} from '../utils/theme'")) {
          content = content.replace(/(import\s+\{)([^}]*)(\}\s+from\s+['"]\.\.\/utils\/theme['"])/, (match, p1, p2, p3) => {
              if (p2.includes('SPACING')) return match;
              return p1 + p2 + (p2.trim() ? ', ' : '') + 'SPACING ' + p3;
          });
      } else {
         content = content.replace(/(import .*? from 'react-native';)/, "$1\nimport { SPACING } from '../utils/theme';");
      }
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed SPACING in', path.basename(file));
  }
}

const files = [
    'FAQScreen.js',
    'PrivacyPolicyScreen.js',
    'PrivacySecuritySettingsScreen.js',
    'PromptsScreen.js',
    'SyncSetupScreen.js',
    'TermsScreen.js'
];

files.forEach(file => {
  fixFile(path.join(screensDir, file));
});
