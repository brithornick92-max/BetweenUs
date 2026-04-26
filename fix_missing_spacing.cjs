const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, 'screens');

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  if (content.includes('SPACING') && !content.includes('import { SPACING') && !content.includes('import {SPACING')) {
      const match = content.match(/import\s+.*?\s+from\s+['"]react-native['"];?/);
      if (match) {
         content = content.replace(match[0], match[0] + "\nimport { SPACING } from '../utils/theme';");
      } else {
         content = "import { SPACING } from '../utils/theme';\n" + content;
      }
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed SPACING in', path.basename(file));
  }
}

fs.readdirSync(screensDir).forEach(file => {
  if (file.endsWith('.js') || file.endsWith('.jsx')) {
    fixFile(path.join(screensDir, file));
  }
});
