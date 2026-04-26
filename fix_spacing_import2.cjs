const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, 'screens');

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  if (content.includes('SPACING')) {
      const spacingRegex = /import\s+\{[^}]*SPACING[^}]*\}\s+from\s+['"]\.\.\/utils\/theme['"]/;
      if (!spacingRegex.test(content)) {
          // It needs SPACING import from theme
          if (content.includes("from '../utils/theme'")) {
              content = content.replace(/(import\s+\{)(.*?)(\}\s+from\s+['"]\.\.\/utils\/theme['"])/, (match, p1, p2, p3) => {
                  if (p2.includes('SPACING')) return match;
                  return p1 + (p2.trim() ? p2.trim() + ', ' : '') + 'SPACING' + p3;
              });
          } else {
             content = content.replace(/(import .*? from 'react-native';)/, "$1\nimport { SPACING } from '../utils/theme';");
          }
      }
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed imports again', path.basename(file));
  }
}

fs.readdirSync(screensDir).forEach(file => {
  if (file.endsWith('.js') || file.endsWith('.jsx')) {
    fixFile(path.join(screensDir, file));
  }
});
