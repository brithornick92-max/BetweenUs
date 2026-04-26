const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, 'screens');

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Let's just find "const SYSTEM_FONT"
  let declarations = 0;
  let index = content.indexOf('const SYSTEM_FONT');
  while (index !== -1) {
      declarations++;
      index = content.indexOf('const SYSTEM_FONT', index + 1);
  }

  if (declarations > 1) {
      // Find the first instance
      const firstIndex = content.indexOf('const SYSTEM_FONT');
      // Find the end of the line
      const firstEnd = content.indexOf('\n', firstIndex);
      
      // Look for the second instance after the first
      let secondIndex = content.indexOf('const SYSTEM_FONT', firstEnd);
      while(secondIndex !== -1) {
          const secondEnd = content.indexOf('\n', secondIndex);
          content = content.slice(0, secondIndex) + content.slice(secondEnd !== -1 ? secondEnd + 1 : content.length);
          secondIndex = content.indexOf('const SYSTEM_FONT', secondIndex);
      }
      
      if (content !== originalContent) {
         fs.writeFileSync(file, content, 'utf8');
         console.log('Fixed duplicate SYSTEM_FONT by force in', path.basename(file));
      }
  }
}

fs.readdirSync(screensDir).forEach(file => {
  if (file.endsWith('.js') || file.endsWith('.jsx')) {
    fixFile(path.join(screensDir, file));
  }
});
