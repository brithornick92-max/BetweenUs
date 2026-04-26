const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, 'screens');

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Let's just find "const SYSTEM_FONT" using regex and replace all occurrences after the first one
  let declarations = 0;
  content = content.replace(/const SYSTEM_FONT\s*=\s*.*?;/g, (match) => {
      declarations++;
      if (declarations > 1) {
          return '';
      }
      return match;
  });

  if (content !== originalContent) {
     fs.writeFileSync(file, content, 'utf8');
     console.log('Fixed duplicate SYSTEM_FONT using regex in', path.basename(file));
  }
}

fs.readdirSync(screensDir).forEach(file => {
  if (file.endsWith('.js') || file.endsWith('.jsx')) {
    fixFile(path.join(screensDir, file));
  }
});
