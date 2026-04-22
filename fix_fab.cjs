const fs = require('fs');
let text = fs.readFileSync('screens/SavedMomentsScreen.js', 'utf8');

text = text.replace(
  /<BlurView intensity=\{70\} tint=\{isDark \? 'dark' : 'light'\} style=\{\[styles\.fabBlur, \{ backgroundColor: withAlpha\(t\.primary, 0\.8\) \}\]\}>\s+<Icon name="add" size=\{26\} color="#FFF" \/>\s+<\/View>/,
  "<BlurView intensity={70} tint={isDark ? 'dark' : 'light'} style={[styles.fabBlur, { backgroundColor: withAlpha(t.primary, 0.8) }]}>\n            <Icon name=\"add\" size={26} color=\"#FFF\" />\n          </BlurView>"
);

fs.writeFileSync('screens/SavedMomentsScreen.js', text);
