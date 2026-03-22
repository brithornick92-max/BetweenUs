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
  if (file.includes('ErrorBoundary')) continue;
  
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  content = content.replace(/backgroundColor: '#070509'/g, 'backgroundColor: colors.surface');
  content = content.replace(/backgroundColor: {"#070509"}/g, 'backgroundColor: {colors.surface}');
  content = content.replace(/color="#070509"/g, 'color={colors.surface}');

  if (content !== original) {
    if (!content.includes('const { colors')) {
      console.log('Missed useTheme for ' + file);
      content = content.replace(/const theme = useTheme\(\);/, 'const theme = useTheme(); const { colors } = theme;');
    }
    fs.writeFileSync(file, content);
  }
}
console.log('Done replacing 070509');