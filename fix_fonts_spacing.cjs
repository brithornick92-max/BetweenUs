const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, 'screens');

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Add SYSTEM_FONT definition if missing
  if (content.includes('SYSTEM_FONT') && !content.includes('const SYSTEM_FONT')) {
      const systemFontDef = `\nconst SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });\n`;
      // Put it after imports
      if (!content.includes("Platform")) {
         if (content.includes("import {")) {
            content = content.replace(/(import\s+\{[^}]*?)(\}\s+from\s+['"]react-native['"])/, (m, p1, p2) => {
               if (p1.includes('Platform')) return m;
               return p1 + (p1.endsWith(' ') ? '' : ', ') + 'Platform ' + p2;
            });
         }
      }
      
      const lastImportIndex = content.lastIndexOf('import ');
      if (lastImportIndex !== -1) {
          const endOfImports = content.indexOf('\n', lastImportIndex);
          content = content.slice(0, endOfImports + 1) + systemFontDef + content.slice(endOfImports + 1);
      }
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed fonts in', path.basename(file));
  }
}

fs.readdirSync(screensDir).forEach(file => {
  if (file.endsWith('.js') || file.endsWith('.jsx')) {
    fixFile(path.join(screensDir, file));
  }
});
