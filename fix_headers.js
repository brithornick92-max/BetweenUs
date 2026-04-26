const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, 'screens');

const TARGET_HEADER = `  header: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
  },`;

const TARGET_HEADER_SUBTITLE = `  headerSubtitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
  },`;

const TARGET_HEADER_TITLE = `  headerTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 42,
  },`;

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Add SPACING to theme import if not there
  if (content.includes('import {') && content.includes('../utils/theme') && !content.includes('SPACING')) {
      content = content.replace(/(import\s+\{[^}]*?)(\}\s+from\s+['"]\.\.\/utils\/theme['"])/, (match, p1, p2) => {
          return p1 + (p1.endsWith(' ') ? '' : ', ') + 'SPACING ' + p2;
      });
  } else if (!content.includes('SPACING') && content.includes('../utils/theme')) {
      content = content.replace(/import\s+(.*?)\s+from\s+['"]\.\.\/utils\/theme['"]/, "import $1, { SPACING } from '../utils/theme'");
  } else if (!content.includes('SPACING') && !content.includes('../utils/theme')) {
      // It might not have the import at all, add it after react-native
      content = content.replace(/(import .*? from 'react-native';)/, "$1\nimport { SPACING } from '../utils/theme';");
  }

  // Replace header
  content = content.replace(/  header: \{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\},/, TARGET_HEADER);
  
  // Replace headerSubtitle
  content = content.replace(/  headerSubtitle: \{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\},/, TARGET_HEADER_SUBTITLE);

  // Replace headerTitle
  content = content.replace(/  headerTitle: \{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\},/, TARGET_HEADER_TITLE);


  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed', path.basename(file));
  }
}

fs.readdirSync(screensDir).forEach(file => {
  if (file.endsWith('.js') || file.endsWith('.jsx')) {
    fixFile(path.join(screensDir, file));
  }
});
