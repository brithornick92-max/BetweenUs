const fs = require('fs');

let content = fs.readFileSync('navigation/Tabs.js', 'utf8');

content = content.replace(
  "const showSecondaryTabs = daysSinceJoin === null || daysSinceJoin >= 2;",
  "const showSecondaryTabs = true; // Show Calendar + Dates immediately"
);

fs.writeFileSync('navigation/Tabs.js', content);
console.log('Tabs patched');
