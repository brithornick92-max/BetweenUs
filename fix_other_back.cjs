const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, 'screens');

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Let's just find <Icon name="close-outline" and see where it is relative to headers.
  // The user said "Make sure there are no back arrows on screens. Just x on the top right for the ones that need it"

  // Since we replaced 'chevron-back' with 'close-outline', let's find buttons and make them absolutely positioned to top right

  if (content.includes('name="close-outline"')) {
      // make sure it has absolute positioning if it's the main back button
      // But we just updated backButton style for many.
      // What about ones without backButton style?
      if (!content.includes('backButton: {')) {
           // We might need to add it or modify the inline style.
      }
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
  }
}

fs.readdirSync(screensDir).forEach(file => {
  if (file.endsWith('.js') || file.endsWith('.jsx')) {
    fixFile(path.join(screensDir, file));
  }
});
