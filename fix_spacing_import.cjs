const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, 'screens');

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  if (content.includes('SPACING') && !content.includes('import {') && !content.includes('../utils/theme')) {
     content = content.replace(/(import .*? from 'react-native';)/, "$1\nimport { SPACING } from '../utils/theme';");
  } else if (content.includes('SPACING') && content.includes('../utils/theme') && !content.includes('SPACING,')) {
      if (content.includes("import { withAlpha } from '../utils/theme'")) {
          content = content.replace("import { withAlpha } from '../utils/theme'", "import { withAlpha, SPACING } from '../utils/theme'");
      }
      else if (content.includes("import { SPACING }") === false && content.includes("import { withAlpha, SPACING }") === false) {
           // just inject it near imports
           if (!content.includes('import { SPACING')) {
               content = content.replace(/(import .*? from 'react-native';)/, "$1\nimport { SPACING } from '../utils/theme';");
           }
      }
  } else if (content.includes('SPACING') && !content.match(/import\s*\{[^}]*SPACING[^}]*\}\s*from\s*['"]\.\.\/utils\/theme['"]/)) {
      content = content.replace(/(import .*? from 'react-native';)/, "$1\nimport { SPACING } from '../utils/theme';");
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed imports', path.basename(file));
  }
}

fs.readdirSync(screensDir).forEach(file => {
  if (file.endsWith('.js') || file.endsWith('.jsx')) {
    fixFile(path.join(screensDir, file));
  }
});
