const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, 'screens');

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  const fontDeclaration = /const SYSTEM_FONT = Platform\.select\(\{ ios: "System", android: "Roboto" \}\);\n?/g;
  const matches = content.match(fontDeclaration);
  
  if (matches && matches.length > 1) {
      let firstMatch = true;
      content = content.replace(fontDeclaration, (match) => {
          if (firstMatch) {
              firstMatch = false;
              return match;
          }
          return ''; // Remove subsequent matches
      });
  }

  // Also check if SYSTEM_FONT is defined twice with var, let, or without newline
  const allDecls = /(?:const|let|var)\s+SYSTEM_FONT\s*=\s*Platform\.select[^\n;]*;?\n?/g;
  const allMatches = content.match(allDecls);
  if (allMatches && allMatches.length > 1) {
      let firstMatch = true;
      content = content.replace(allDecls, (match) => {
          if (firstMatch) {
              firstMatch = false;
              return match;
          }
          return '';
      });
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed duplicate SYSTEM_FONT in', path.basename(file));
  }
}

fs.readdirSync(screensDir).forEach(file => {
  if (file.endsWith('.js') || file.endsWith('.jsx')) {
    fixFile(path.join(screensDir, file));
  }
});
