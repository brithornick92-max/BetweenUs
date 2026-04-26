const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, 'screens');

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Make back button absolute top right
  const backBtnRegex = /backButton:\s*\{[^}]*\}/g;
  
  if (content.match(backBtnRegex)) {
      content = content.replace(backBtnRegex, "backButton: {\n    position: 'absolute',\n    top: SPACING.xl,\n    right: SPACING.xl,\n    zIndex: 10,\n    padding: 8,\n  }");
  }

  // For screens that might have it inline or in different containers, make sure the header Row doesn't conflict
  // We can just rely on absolute positioning.

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed back button position', path.basename(file));
  }
}

fs.readdirSync(screensDir).forEach(file => {
  if (file.endsWith('.js') || file.endsWith('.jsx')) {
    fixFile(path.join(screensDir, file));
  }
});
