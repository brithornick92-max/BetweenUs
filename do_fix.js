const fs = require('fs');
const files = ['screens/SyncSetupScreen.js', 'screens/PairingScanScreen.js', 'screens/PairingQRCodeScreen.js'];

for (let file of files) {
  let content = fs.readFileSync(file, 'utf8');

  if (content.includes('const createStyles =')) continue;

  content = content.replace(/const styles = StyleSheet\.create\(\{/, 'const createStyles = (colors, isDark) => StyleSheet.create({');

  content = content.replace(/const theme = useTheme\(\);/g, 'const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);');
  content = content.replace(/const \{ colors, isDark \} = useTheme\(\);/g, 'const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);'); 

  content = content.replace(/'rgba\(255,255,255,0\.08\)'/g, 'colors.borderGlass || colors.border');
  content = content.replace(/'rgba\(255,255,255,0\.06\)'/g, 'colors.borderGlass || colors.border');
  content = content.replace(/'rgba\(0,0,0,0\.4\)'/g, "isDark ? 'rgba(0,0,0,0.4)' : 'rgba(19,16,22,0.15)'");
  content = content.replace(/'rgba\(0,0,0,0\.15\)'/g, "isDark ? 'rgba(0,0,0,0.15)' : 'rgba(19,16,22,0.05)'");
  content = content.replace(/'#070509'/g, 'colors.surface');
  content = content.replace(/'#A89060'/g, "colors.accent || '#A89060'");
  content = content.replace(/'rgba\(255,255,255,0\.5\)'/g, 'colors.textMuted');

  fs.writeFileSync(file, content);
}
console.log('Fixed scripts');
