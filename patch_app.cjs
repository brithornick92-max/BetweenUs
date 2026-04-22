const fs = require('fs');

let content = fs.readFileSync('App.js', 'utf8');

if (!content.includes('react-native-get-random-values')) {
  // Insert at the literal top of the file
  content = "import 'react-native-get-random-values';\n" + content;
  fs.writeFileSync('App.js', content);
  console.log('App patched');
}
