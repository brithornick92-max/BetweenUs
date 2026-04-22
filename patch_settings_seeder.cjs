const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'screens', 'SettingsScreen.js');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('import { seedReviewerData }')) {
  // Add imports
  content = content.replace(
    "import { useAuth } from '../context/AuthContext';",
    "import { useAuth } from '../context/AuthContext';\nimport { seedReviewerData } from '../utils/DemoSeeder';\nimport { supabase } from '../config/supabase';"
  );
}

if (!content.includes('Seed Demo Data')) {
  // Define state for user email
  if (!content.includes('const [userEmail, setUserEmail]')) {
    content = content.replace(
      "const { signOutLocal } = useAuth();",
      "const { signOutLocal } = useAuth();\n  const [userEmail, setUserEmail] = useState(null);\n\n  useEffect(() => {\n    supabase.auth.getUser().then(({ data }) => {\n      if (data?.user?.email) setUserEmail(data.user.email);\n    });\n  }, []);"
    );
  }

  // Insert the button above Sign Out
  const signOutSection = `<EditorialSection title="Account" t={t} delay={900}>`;
  
  const injectButton = `
          {userEmail?.toLowerCase().includes('betweenusreviewer') && (
            <EditorialSection title="Reviewer Tools" t={t} delay={800}>
              <EditorialRow 
                icon="flask-outline" 
                title="Seed Demo Data (90 Days)" 
                onPress={async () => {
                  Alert.alert('Seeding Data', 'Generating 90 days of content...');
                  const stats = await seedReviewerData();
                  if (stats.success) Alert.alert('Success', 'Demo data injected successfully.');
                }}
                t={t}
                isLast
              />
            </EditorialSection>
          )}

          <EditorialSection title="Account" t={t} delay={900}>`;

  content = content.replace(signOutSection, injectButton);
  
  fs.writeFileSync(filePath, content);
  console.log("Successfully injected Demo Seeder into SettingsScreen");
} else {
  console.log("Seeder already exists in SettingsScreen");
}
