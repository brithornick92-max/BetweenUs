const fs = require('fs');
const pfPath = 'screens/ProfileScreen.js';
if (fs.existsSync(pfPath)) {
  let content = fs.readFileSync(pfPath, 'utf8');
  if (!content.includes('Seed Demo Data')) {
    content = content.replace("import Button from '../components/Button';", "import Button from '../components/Button';\nimport { seedReviewerData } from '../utils/DemoSeeder';");
    content = content.replace("          <Button title=\"Sign Out\" onPress={signOut} variant=\"danger\" />", "          {user?.email?.toLowerCase().includes('betweenusreviewer') && (\n            <Button title=\"Seed Demo Data (90 Days)\" onPress={seedReviewerData} className=\"mt-4\" />\n          )}\n          <Button title=\"Sign Out\" onPress={signOut} variant=\"danger\" />");
    fs.writeFileSync(pfPath, content);
    console.log('ProfileScreen patched');
  }
} else {
  console.log('ProfileScreen not found, try CustomerCenter');
}
