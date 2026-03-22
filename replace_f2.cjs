const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) { 
      results.push(file);
    }
  });
  return results;
}

const allFiles = walk('screens').concat(walk('components'));

for (let file of allFiles) {
  if (file.includes('do_fix')) continue;
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  content = content.replace(/color: '#F2E9E6'/g, 'color: colors.text');

  if (content !== original) {
    if (!content.includes('const { colors')) {
      // Need to add useTheme manually if it misses, I'll just print them out for now
      console.log('Missed useTheme for ' + file);
    }
    fs.writeFileSync(file, content);
  }
}
console.log('Done replacing F2E9E6');