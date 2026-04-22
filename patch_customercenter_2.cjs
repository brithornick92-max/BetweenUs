const fs = require('fs');

const ccPath = 'components/CustomerCenter.jsx';
if (fs.existsSync(ccPath)) {
  let content = fs.readFileSync(ccPath, 'utf8');
  if (!content.includes('Seed Demo Data')) {
    content = content.replace("import Button from './Button';", "import Button from './Button';\nimport { seedReviewerData } from '../utils/DemoSeeder';");
    content = content.replace(
      "<Button title=\"Sign Out\" onPress={handleSignOut} variant=\"danger\" />",
      `{user?.email?.toLowerCase().includes('betweenusreviewer') && (
            <Button title="Seed Demo Data (90 Days)" onPress={async () => {
              try { await seedReviewerData(); alert('Demo data seeded!'); }
              catch (e) { alert('Failed to seed: ' + e.message); }
            }} className="mt-4" />
          )}
          <Button title="Sign Out" onPress={handleSignOut} variant="danger" />`
    );
    fs.writeFileSync(ccPath, content);
    console.log('CustomerCenter patched');
  } else {
    console.log('CustomerCenter already patched');
  }
} else {
  console.log('CustomerCenter.jsx not found');
}
